import pg from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { initialState, type Store } from './store.js';
import type { AgentState } from '../src/types.js';
import type { SupportingEvidence } from '../src/enrichment.js';
import type { RawObservation } from './enrichment.js';
import { initPostgresSchema, postgresPool } from './postgres.js';
import { encodeState, decodeState } from './state-codec.js';
import type { MemoryEpisode } from '../src/memory.js';
import type { EpisodeJournal, JournalView } from './journal-store.js';
export { encodeState, decodeState } from './state-codec.js';

const ACTIVE_DECISION_LIMIT=100;

interface Lease {owner:string|null;epoch:number;expires:number}
export function ownsLease(l:Lease,owner:string,epoch:number,now:number){return l.owner===owner&&l.epoch===epoch&&l.expires>now;}
export function claimLease(l:Lease,owner:string,now:number,ttl:number):Lease|null {
  if(l.owner!==owner&&l.expires>now)return null;
  return {owner,epoch:l.owner===owner&&l.expires>now?l.epoch:l.epoch+1,expires:now+ttl};
}
export interface JsonPersistence {read():Promise<string|undefined>;write(value:string):Promise<void>}
export class CloudStore implements Store {
  label='Supabase Postgres · TLS · fenced single worker';
  journal:EpisodeJournal;
  private pool:pg.Pool;
  private stateCache=new Map<number,{hash:string;state:AgentState}>();
  private owner=randomUUID();
  private epoch=0;
  private expires=0;
  constructor(url:string,pool?:pg.Pool){this.pool=pool??postgresPool(url,6);this.journal=this.journalFor(1);}
  async init(){
    await initPostgresSchema(this.pool);
    await this.pool.query('INSERT INTO jev_private.jev_terminal_state (id,data) VALUES (1,$1) ON CONFLICT (id) DO NOTHING',[JSON.stringify(initialState())]);
    // Row 1 retains the existing TOKEN2049 journal; KBW starts independently.
    await this.pool.query('INSERT INTO jev_private.jev_terminal_state (id,data) VALUES (2,$1) ON CONFLICT (id) DO NOTHING',[JSON.stringify(initialState())]);
    await this.pool.query('CREATE TABLE IF NOT EXISTS jev_private.jev_worker_lease (id integer PRIMARY KEY, owner varchar(64), epoch bigint NOT NULL, expires bigint NOT NULL)');
    await this.pool.query('INSERT INTO jev_private.jev_worker_lease (id,owner,epoch,expires) VALUES (1,NULL,0,0) ON CONFLICT (id) DO NOTHING');
    await this.pool.query('CREATE TABLE IF NOT EXISTS jev_private.jev_runtime_records (name varchar(64) PRIMARY KEY, data text NOT NULL)');
    await this.pool.query('CREATE TABLE IF NOT EXISTS jev_private.jev_decision_archive (edition smallint NOT NULL, id text NOT NULL, time bigint NOT NULL, data jsonb NOT NULL, PRIMARY KEY (edition,id))');
    await this.pool.query('CREATE INDEX IF NOT EXISTS jev_decision_archive_time ON jev_private.jev_decision_archive (edition,time DESC)');
    await this.pool.query('CREATE TABLE IF NOT EXISTS jev_private.jev_evidence (id varchar(64) PRIMARY KEY, token varchar(42) NOT NULL, observed_at bigint NOT NULL, data text NOT NULL, raw text NOT NULL)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS jev_evidence_token_time ON jev_private.jev_evidence (token, observed_at DESC)');
    await this.pool.query(`CREATE TABLE IF NOT EXISTS jev_private.jev_memory_episode (
      edition smallint NOT NULL, id text NOT NULL, token text NOT NULL, kind text NOT NULL,
      created_at bigint NOT NULL, capture_status text NOT NULL, next_capture_at bigint,
      next_followup_at bigint, recalled_count integer NOT NULL DEFAULT 0,
      reviewed boolean NOT NULL DEFAULT false, data jsonb NOT NULL,
      PRIMARY KEY (edition,id))`);
    await this.pool.query('ALTER TABLE jev_private.jev_memory_episode ADD COLUMN IF NOT EXISTS reviewed boolean NOT NULL DEFAULT false');
    await this.pool.query('CREATE INDEX IF NOT EXISTS jev_memory_recent ON jev_private.jev_memory_episode (edition,created_at DESC)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS jev_memory_token_recent ON jev_private.jev_memory_episode (edition,token,kind,created_at DESC)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS jev_memory_capture_due ON jev_private.jev_memory_episode (edition,capture_status,next_capture_at)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS jev_memory_followup_due ON jev_private.jev_memory_episode (edition,next_followup_at) WHERE next_followup_at IS NOT NULL');
    await this.pool.query("CREATE INDEX IF NOT EXISTS jev_memory_outcomes_unreviewed ON jev_private.jev_memory_episode (edition,created_at) WHERE kind='outcome' AND NOT reviewed");
    await this.pool.query("CREATE INDEX IF NOT EXISTS jev_memory_pages ON jev_private.jev_memory_episode USING gin ((data #> '{capture,pageIds}'))");
    return this;
  }
  private async lease(connection:pg.PoolClient){
    const {rows}=await connection.query<{owner:string|null;epoch:string;expires:string;now_ms:string}>('SELECT owner,epoch,expires,floor(extract(epoch from clock_timestamp())*1000)::bigint AS now_ms FROM jev_private.jev_worker_lease WHERE id=1 FOR UPDATE');
    const r=rows[0];return {row:{owner:r.owner,epoch:Number(r.epoch),expires:Number(r.expires)},now:Number(r.now_ms)};
  }
  async acquire(){
    const c=await this.pool.connect();
    try {await c.query('BEGIN');const {row,now}=await this.lease(c);const next=claimLease(row,this.owner,now,45000);
      if(!next){await c.query('ROLLBACK');return false;}
      await c.query('UPDATE jev_private.jev_worker_lease SET owner=$1,epoch=$2,expires=$3 WHERE id=1',[this.owner,next.epoch,next.expires]);
      await this.migrateLegacyJournal(c);
      await c.query('UPDATE jev_private.jev_worker_lease SET expires=floor(extract(epoch from clock_timestamp())*1000)::bigint+45000 WHERE id=1');
      await c.query('COMMIT');this.epoch=next.epoch;this.expires=Date.now()+40000;return true;
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }
  get active(){return this.epoch>0&&Date.now()<this.expires;}
  async renew(){
    await this.fenced(async c=>{
      const {now}=await this.lease(c);
      await c.query('UPDATE jev_private.jev_worker_lease SET expires=$1 WHERE id=1',[now+45000]);
    });this.expires=Date.now()+40000;
  }
  async assertLease(){await this.fenced(async()=>{});}
  private async migrateLegacyJournal(c:pg.PoolClient){
    for(const edition of [1,2]){
      const {rows}=await c.query<{data:string}>('SELECT data FROM jev_private.jev_terminal_state WHERE id=$1 FOR UPDATE',[edition]);
      const state=decodeState(rows[0].data);
      const episodes=state.memoryEpisodes;
      if(!episodes?.length)continue;
      // The lease and row locks make this a one-time, atomic move. A failed
      // migration leaves the original journal intact for the next attempt.
      await c.query(`INSERT INTO jev_private.jev_memory_episode
        (edition,id,token,kind,created_at,capture_status,next_capture_at,next_followup_at,recalled_count,data)
        SELECT $1,(e->>'id'),(e->>'token'),(e->>'kind'),(e->>'createdAt')::bigint,
          (e #>> '{capture,status}'),NULLIF(e #>> '{capture,nextAt}','')::bigint,
          (SELECT min((f->>'dueAt')::bigint) FROM jsonb_array_elements(e->'followUps') f WHERE f->>'status'='waiting'),
          jsonb_array_length(e->'recalledBy'),e
        FROM jsonb_array_elements($2::jsonb) e ON CONFLICT (edition,id) DO NOTHING`,[edition,JSON.stringify(episodes)]);
      await c.query(`UPDATE jev_private.jev_memory_episode o SET reviewed=true
        WHERE o.edition=$1 AND o.kind='outcome' AND EXISTS (
          SELECT 1 FROM jev_private.jev_memory_episode r WHERE r.edition=o.edition AND r.kind='review'
          AND (r.data #> '{content,episodeIds}') ? o.id)`,[edition]);
      delete state.memoryEpisodes;
      await c.query('UPDATE jev_private.jev_terminal_state SET data=$2 WHERE id=$1',[edition,encodeState(state)]);
      this.stateCache.delete(edition);
    }
  }
  private async fenced<T>(work:(c:pg.PoolClient)=>Promise<T>):Promise<T>{
    const c=await this.pool.connect();
    try {await c.query('BEGIN');const {row,now}=await this.lease(c);
      if(!ownsLease(row,this.owner,this.epoch,now))throw new Error('Worker lease unavailable');
      const result=await work(c);
      const after=await this.lease(c);
      if(!ownsLease(after.row,this.owner,this.epoch,after.now))throw new Error('Worker lease expired');
      await c.query('COMMIT');return result;
    }catch(e){await c.query('ROLLBACK');this.expires=0;throw e;}finally{c.release();}
  }
  private async readRow(id:number){
    const cached=this.stateCache.get(id);
    const {rows}=await this.pool.query<{hash:string;data:string|null}>(
      'SELECT md5(data) AS hash, CASE WHEN md5(data)=$2 THEN NULL ELSE data END AS data FROM jev_private.jev_terminal_state WHERE id=$1',
      [id,cached?.hash??'']);
    if(!rows[0])throw new Error('Terminal state missing');
    if(rows[0].data!==null){
      const state=decodeState(rows[0].data);delete state.memoryEpisodes;
      this.stateCache.set(id,{hash:rows[0].hash,state});
    }
    return structuredClone(this.stateCache.get(id)!.state);
  }
  private async mutateRow(id:number,fn:(s:AgentState)=>void){
    const result=await this.fenced(async c=>{
      const cached=this.stateCache.get(id);
      const {rows}=await c.query<{hash:string;data:string|null}>(
        'SELECT md5(data) AS hash, CASE WHEN md5(data)=$2 THEN NULL ELSE data END AS data FROM jev_private.jev_terminal_state WHERE id=$1 FOR UPDATE',
        [id,cached?.hash??'']);
      const state=rows[0].data===null?structuredClone(cached!.state):decodeState(rows[0].data);
      delete state.memoryEpisodes;
      fn(state);state.revision++;
      const archival=state.decisions.slice(ACTIVE_DECISION_LIMIT);
      for(let offset=0;offset<archival.length;offset+=25){
        await c.query(`INSERT INTO jev_private.jev_decision_archive (edition,id,time,data)
          SELECT $1,d->>'id',(d->>'time')::bigint,d FROM jsonb_array_elements($2::jsonb) d
          ON CONFLICT (edition,id) DO NOTHING`,[id,JSON.stringify(archival.slice(offset,offset+25))]);
      }
      if(archival.length)state.decisions=state.decisions.slice(0,ACTIVE_DECISION_LIMIT);
      const encoded=encodeState(state);
      await c.query('UPDATE jev_private.jev_terminal_state SET data=$2 WHERE id=$1',[id,encoded]);
      return {state,hash:createHash('md5').update(encoded).digest('hex'),archived:archival.length};
    });
    this.stateCache.set(id,result);
    if(result.archived)console.info(`Archived ${result.archived} historical decisions for edition ${id}`);
    return structuredClone(result.state);
  }
  async read(){return this.readRow(1);}
  async mutate(fn:(s:AgentState)=>void){return this.mutateRow(1,fn);}
  kbwStore():Store {
    return {
      label:this.label+' · KBW',
      journal:this.journalFor(2),
      read:()=>this.readRow(2),
      mutate:fn=>this.mutateRow(2,fn),
      close:()=>{}, // Shared pool and lease are owned by the root CloudStore.
    };
  }
  private journalFor(edition:number):EpisodeJournal {
    const one=async(sql:string,args:unknown[])=>{
      const {rows}=await this.pool.query<{data:MemoryEpisode}>(sql,args);
      return rows[0]?.data;
    };
    const values=(e:MemoryEpisode):(string|number|null)[]=>[
      edition,e.id,e.token,e.kind,e.createdAt,e.capture.status,e.capture.nextAt,
      Math.min(...e.followUps.filter(f=>f.status==='waiting').map(f=>f.dueAt)),
      e.recalledBy.length,JSON.stringify(e),
    ];
    const write=async(c:pg.PoolClient,e:MemoryEpisode)=>{
      const args=values(e);
      if(!Number.isFinite(args[7] as number))args[7]=null;
      await c.query(`UPDATE jev_private.jev_memory_episode SET token=$3,kind=$4,created_at=$5,
        capture_status=$6,next_capture_at=$7,next_followup_at=$8,recalled_count=$9,data=$10::jsonb
        WHERE edition=$1 AND id=$2`,args);
    };
    return {
      latest:(token,kind)=>one('SELECT data FROM jev_private.jev_memory_episode WHERE edition=$1 AND token=$2 AND kind=$3 ORDER BY created_at DESC LIMIT 1',[edition,token,kind]),
      get:id=>one('SELECT data FROM jev_private.jev_memory_episode WHERE edition=$1 AND id=$2',[edition,id]),
      byPages:async pageIds=>{
        if(!pageIds.length)return [];
        const {rows}=await this.pool.query<{data:MemoryEpisode}>("SELECT data FROM jev_private.jev_memory_episode WHERE edition=$1 AND (data #> '{capture,pageIds}') ?| $2::text[] ORDER BY created_at DESC",[edition,pageIds]);
        return rows.map(r=>r.data);
      },
      dueCapture:async(statuses,now,limit,oldestFirst)=>{
        const {rows}=await this.pool.query<{data:MemoryEpisode}>(`SELECT data FROM jev_private.jev_memory_episode WHERE edition=$1 AND capture_status=ANY($2::text[]) AND next_capture_at<=$3 ORDER BY created_at ${oldestFirst?'ASC':'DESC'} LIMIT $4`,[edition,statuses,now,limit]);
        return rows.map(r=>r.data);
      },
      dueFollowUp:now=>one('SELECT data FROM jev_private.jev_memory_episode WHERE edition=$1 AND next_followup_at<=$2 ORDER BY next_followup_at ASC LIMIT 1',[edition,now]),
      unreviewedOutcomes:async()=>{
        const {rows}=await this.pool.query<{data:MemoryEpisode}>(`SELECT data FROM jev_private.jev_memory_episode
          WHERE edition=$1 AND kind='outcome' AND NOT reviewed AND data #>> '{content,horizonMinutes}'='30'
          ORDER BY created_at ASC LIMIT 5`,[edition]);
        return rows.map(r=>r.data);
      },
      insert:async episode=>this.fenced(async c=>{
        const args=values(episode);
        if(!Number.isFinite(args[7] as number))args[7]=null;
        const {rowCount}=await c.query(`INSERT INTO jev_private.jev_memory_episode
          (edition,id,token,kind,created_at,capture_status,next_capture_at,next_followup_at,recalled_count,data)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) ON CONFLICT (edition,id) DO NOTHING`,args);
        if(episode.kind==='review'&&Array.isArray(episode.content.episodeIds))
          await c.query("UPDATE jev_private.jev_memory_episode SET reviewed=true WHERE edition=$1 AND id=ANY($2::text[])",[edition,episode.content.episodeIds]);
        return rowCount===1;
      }),
      update:(id,change)=>this.fenced(async c=>{
        const {rows}=await c.query<{data:MemoryEpisode}>('SELECT data FROM jev_private.jev_memory_episode WHERE edition=$1 AND id=$2 FOR UPDATE',[edition,id]);
        const episode=rows[0]?.data;
        if(!episode)return undefined;
        change(episode);
        await write(c,episode);
        return episode;
      }),
      view:async(token,linkedId,publicOnly=false):Promise<JournalView>=>{
        // Project private evidence away in Postgres so public browsing never
        // transfers full episode content from Supabase to the API process.
        const projected=publicOnly?"data || jsonb_build_object('content',jsonb_build_object('summary',data->>'summary','publicView',true),'capture',(data->'capture')-'sourceId')":'data';
        const [recent,forToken,linked,counts]=await Promise.all([
          this.pool.query<{data:MemoryEpisode}>(`SELECT ${projected} AS data FROM jev_private.jev_memory_episode WHERE edition=$1 ORDER BY created_at DESC LIMIT 6`,[edition]),
          token?this.pool.query<{data:MemoryEpisode}>(`SELECT ${projected} AS data FROM jev_private.jev_memory_episode WHERE edition=$1 AND (token=$2 OR kind='review') ORDER BY created_at DESC LIMIT 6`,[edition,token]):Promise.resolve(null),
          linkedId?this.pool.query<{data:MemoryEpisode}>(`SELECT ${projected} AS data FROM jev_private.jev_memory_episode WHERE edition=$1 AND id=$2`,[edition,linkedId]).then(r=>r.rows[0]?.data):Promise.resolve(undefined),
          this.pool.query<{saved:string;available:string;recalled:string}>("SELECT count(*) AS saved,count(*) FILTER(WHERE capture_status IN ('completed','stored')) AS available,count(*) FILTER(WHERE recalled_count>0) AS recalled FROM jev_private.jev_memory_episode WHERE edition=$1",[edition]),
        ]);
        return {recent:recent.rows.map(r=>r.data),token:(forToken??recent).rows.map(r=>r.data),linked,counts:{saved:Number(counts.rows[0].saved),available:Number(counts.rows[0].available),recalled:Number(counts.rows[0].recalled)}};
      },
    };
  }
  record(name:string):JsonPersistence {
    if(!/^[a-z0-9-]{1,64}$/.test(name))throw new Error('Invalid record');
    return {read:async()=>{const {rows}=await this.pool.query<{data:string}>('SELECT data FROM jev_private.jev_runtime_records WHERE name=$1',[name]);return rows[0]?.data;},
      write:async value=>{await this.fenced(async c=>{await c.query('INSERT INTO jev_private.jev_runtime_records (name,data) VALUES ($1,$2) ON CONFLICT (name) DO UPDATE SET data=EXCLUDED.data',[name,value]);});}};
  }
  async save(e:SupportingEvidence,raw:RawObservation[]){await this.fenced(async c=>{await c.query('INSERT INTO jev_private.jev_evidence (id,token,observed_at,data,raw) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',[e.id,e.token,e.completedAt,JSON.stringify(e),JSON.stringify(raw)]);});}
  async latest(token:string,at=Date.now(),maxAge=300000):Promise<SupportingEvidence|undefined>{
    const {rows}=await this.pool.query<{data:string}>('SELECT data FROM jev_private.jev_evidence WHERE token=$1 AND observed_at<=$2 AND observed_at>=$3 ORDER BY observed_at DESC LIMIT 1',[token,at,at-maxAge]);return rows[0]?JSON.parse(rows[0].data):undefined;
  }
  // Never release before in-flight work has drained; on a forced shutdown TTL expires naturally.
  async release(){
    await this.pool.query('UPDATE jev_private.jev_worker_lease SET expires=0 WHERE id=1 AND owner=$1 AND epoch=$2',[this.owner,this.epoch]);
    this.expires=0;
  }
  async close(){await this.pool.end();}
}
