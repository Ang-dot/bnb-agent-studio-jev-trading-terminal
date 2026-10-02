import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { CloudStore, decodeState, encodeState } from './cloud-store.js';
import { initialState } from './store.js';
import type { MemoryEpisode } from '../src/memory.js';
import type { Decision } from '../src/types.js';

const url=process.env.JEV_EGRESS_TEST_POSTGRES_URL;
const local=url?new URL(url):null;
describe.skipIf(!local || local.hostname!=='127.0.0.1' || local.port!=='55432')('cloud journal migration',()=>{
  it('moves a full legacy journal without losing entries, then accepts more than 2,000 entries',async()=>{
    const pool=new pg.Pool({connectionString:url!,max:2});
    const cloud=await new CloudStore(url!,pool).init();
    try {
      await pool.query('TRUNCATE jev_private.jev_memory_episode');
      const episode=(n:number):MemoryEpisode=>({
        id:`episode-${n}`,kind:'observation',token:'0x'+'a'.repeat(40),pool:'pool',name:'Token',createdAt:n,
        signature:'qualified-launch',summary:`Observation ${n}`,content:{marker:n},
        baseline:{priceUsd:1,marketAt:null,action:'observe',executed:false},followUps:[],
        capture:{status:'completed',pageIds:[`page-${n}`],attempts:1,nextAt:0,compiledAt:n},recalledBy:[],
      });
      const legacy={...initialState(),memoryEpisodes:Array.from({length:2000},(_,i)=>episode(2000-i))};
      await pool.query('UPDATE jev_private.jev_terminal_state SET data=$1 WHERE id=2',[encodeState(legacy)]);
      expect(await cloud.acquire()).toBe(true);
      const {rows}=await pool.query<{data:string}>('SELECT data FROM jev_private.jev_terminal_state WHERE id=2');
      expect(decodeState(rows[0].data).memoryEpisodes).toBeUndefined();
      expect((await cloud.kbwStore().read()).memoryEpisodes).toBeUndefined();
      await cloud.kbwStore().mutate(s=>{s.running=true;});
      expect((await cloud.kbwStore().read()).running).toBe(true);
      const external=await cloud.kbwStore().read();
      external.halted=true;
      await pool.query('UPDATE jev_private.jev_terminal_state SET data=$1 WHERE id=2',[encodeState(external)]);
      expect((await cloud.kbwStore().read()).halted).toBe(true);
      const journal=cloud.kbwStore().journal!;
      expect((await journal.view()).counts.saved).toBe(2000);
      expect((await journal.byPages(['page-42'])).map(e=>e.id)).toEqual(['episode-42']);
      const next=episode(2001);
      next.capture.status='queued';next.capture.nextAt=0;
      next.capture.sourceId='private-receipt';
      next.followUps=[{minutes:5,dueAt:100,status:'waiting'}];
      expect(await journal.insert(next)).toBe(true);
      expect(await journal.insert(next)).toBe(false);
      expect((await journal.view()).counts.saved).toBe(2001);
      expect((await journal.dueCapture(['queued'],2001,2,true)).map(e=>e.id)).toEqual(['episode-2001']);
      expect((await journal.dueFollowUp(2001))?.id).toBe('episode-2001');
      await journal.update('episode-2001',e=>{e.recalledBy.push({decisionId:'d',at:2002,pageId:'page-2001'});});
      const view=await journal.view(episode(0).token,'episode-2001');
      expect(view.linked?.recalledBy).toHaveLength(1);
      expect(view.counts.recalled).toBe(1);
      expect(view.recent).toHaveLength(6);
      const publicView=await journal.view(next.token,next.id,true);
      expect(JSON.stringify(publicView)).not.toContain('private-receipt');
      expect(publicView.linked?.content).toEqual({summary:next.summary,publicView:true});
      const outcomes=Array.from({length:5},(_,i)=>({...episode(3000+i),id:`outcome-${i}`,kind:'outcome' as const,content:{horizonMinutes:30,grossPriceChangePct:i}}));
      for(const outcome of outcomes)expect(await journal.insert(outcome)).toBe(true);
      expect((await journal.unreviewedOutcomes()).map(e=>e.id)).toEqual(outcomes.map(e=>e.id));
      expect(await journal.insert({...episode(4000),kind:'review',content:{episodeIds:outcomes.map(e=>e.id)}})).toBe(true);
      expect(await journal.unreviewedOutcomes()).toEqual([]);
      const decisions=Array.from({length:103},(_,i)=>({id:`retention-${i}`,time:103-i} as Decision));
      await cloud.kbwStore().mutate(s=>{s.decisions=decisions;});
      expect((await cloud.kbwStore().read()).decisions.map(d=>d.id)).toEqual(decisions.slice(0,100).map(d=>d.id));
      const archived=await pool.query<{id:string;data:Decision}>('SELECT id,data FROM jev_private.jev_decision_archive WHERE edition=2 AND id LIKE $1 ORDER BY time DESC',['retention-%']);
      expect(archived.rows.map(r=>r.id)).toEqual(decisions.slice(100).map(d=>d.id));
      expect(archived.rows.map(r=>r.data)).toEqual(decisions.slice(100));
      await cloud.release();
    } finally {await cloud.close();}
  });
});
