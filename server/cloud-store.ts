import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { initialState, type Store } from './store.js';
import type { AgentState } from '../src/types.js';
import type { SupportingEvidence } from '../src/enrichment.js';
import type { RawObservation } from './enrichment.js';
import { initPostgresSchema, postgresPool } from './postgres.js';
import { encodeState, decodeState } from './state-codec.js';
export { encodeState, decodeState } from './state-codec.js';

interface Lease {owner:string|null;epoch:number;expires:number}
export function ownsLease(l:Lease,owner:string,epoch:number,now:number){return l.owner===owner&&l.epoch===epoch&&l.expires>now;}
export function claimLease(l:Lease,owner:string,now:number,ttl:number):Lease|null {
  if(l.owner!==owner&&l.expires>now)return null;
  return {owner,epoch:l.owner===owner&&l.expires>now?l.epoch:l.epoch+1,expires:now+ttl};
}
export interface JsonPersistence {read():Promise<string|undefined>;write(value:string):Promise<void>}
export class CloudStore implements Store {
  label='Supabase Postgres · TLS · fenced single worker';
  private pool:pg.Pool;
  private owner=randomUUID();
  private epoch=0;
  private expires=0;
  constructor(url:string){this.pool=postgresPool(url,6);}
  async init(){
    await initPostgresSchema(this.pool);
    await this.pool.query('INSERT INTO jev_private.jev_terminal_state (id,data) VALUES (1,$1) ON CONFLICT (id) DO NOTHING',[JSON.stringify(initialState())]);
    // Row 1 retains the existing TOKEN2049 journal; KBW starts independently.
    await this.pool.query('INSERT INTO jev_private.jev_terminal_state (id,data) VALUES (2,$1) ON CONFLICT (id) DO NOTHING',[JSON.stringify(initialState())]);
    await this.pool.query('CREATE TABLE IF NOT EXISTS jev_private.jev_worker_lease (id integer PRIMARY KEY, owner varchar(64), epoch bigint NOT NULL, expires bigint NOT NULL)');
    await this.pool.query('INSERT INTO jev_private.jev_worker_lease (id,owner,epoch,expires) VALUES (1,NULL,0,0) ON CONFLICT (id) DO NOTHING');
    await this.pool.query('CREATE TABLE IF NOT EXISTS jev_private.jev_runtime_records (name varchar(64) PRIMARY KEY, data text NOT NULL)');
    await this.pool.query('CREATE TABLE IF NOT EXISTS jev_private.jev_evidence (id varchar(64) PRIMARY KEY, token varchar(42) NOT NULL, observed_at bigint NOT NULL, data text NOT NULL, raw text NOT NULL)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS jev_evidence_token_time ON jev_private.jev_evidence (token, observed_at DESC)');
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
  async read(){const {rows}=await this.pool.query<{data:string}>('SELECT data FROM jev_private.jev_terminal_state WHERE id=1');return decodeState(rows[0].data);}
  async mutate(fn:(s:AgentState)=>void){return this.fenced(async c=>{
    const {rows}=await c.query<{data:string}>('SELECT data FROM jev_private.jev_terminal_state WHERE id=1 FOR UPDATE');
    const state=decodeState(rows[0].data);fn(state);state.revision++;
    await c.query('UPDATE jev_private.jev_terminal_state SET data=$1 WHERE id=1',[encodeState(state)]);return state;
  });}
  kbwStore():Store {
    return {
      label:this.label+' · KBW',
      read:async()=>{const {rows}=await this.pool.query<{data:string}>('SELECT data FROM jev_private.jev_terminal_state WHERE id=2');return decodeState(rows[0].data);},
      mutate:async fn=>this.fenced(async c=>{
        const {rows}=await c.query<{data:string}>('SELECT data FROM jev_private.jev_terminal_state WHERE id=2 FOR UPDATE');
        const state=decodeState(rows[0].data);fn(state);state.revision++;
        await c.query('UPDATE jev_private.jev_terminal_state SET data=$1 WHERE id=2',[encodeState(state)]);return state;
      }),
      close:()=>{}, // Shared pool and lease are owned by the root CloudStore.
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
