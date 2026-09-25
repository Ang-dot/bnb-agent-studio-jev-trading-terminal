import { describe,it,expect,vi } from 'vitest';
import { MemoryLoop } from './memory-loop.js';
import { SqliteStore } from './store.js';
import type { Decision } from '../src/types.js';
const token='0x'+'1'.repeat(40),pool='0x'+'2'.repeat(40),start=1790000000000;
function decision(id='d',time=start):Decision{return {id,time,name:'TEST',pool,action:'hold',status:'held',reasons:['Waiting'],memories:[],memoryStatus:'cold start',checks:[],snapshot:{pool,token,name:'TEST',priceUsd:1,liquidityUsd:20000,observedAt:time,marketAt:time,source:'bitquery',volume24h:10000,change1h:1,buyCount:10,sellCount:5,candleId:id},judgment:{action:'hold',confidence:.8,quality:1,toxic:.1,probabilities:{hold:.8,buy:.1,sell:.1},model:'fixture',requestId:id,costUsd:0}};}
function setup(){let time=start;const store=new SqliteStore(':memory:');const provider={captureEpisode:vi.fn(async()=>({id:'source',status:'pending' as const,affectedPageIds:[]})),captureStatuses:vi.fn(async()=>[{id:'source',status:'completed' as const,affectedPageIds:['page']}]),pool:vi.fn(async()=>({token,address:pool,priceUsd:1.2,discoveredAt:time}))};const loop=new MemoryLoop(store,provider as any,()=>time);return{store,provider,loop,setTime:(t:number)=>time=t};}
describe('durable observation memory',()=>{
 it('annotates outcome lineage without upgrading an observation into a learned result',async()=>{
  const {store,loop}=setup();await loop.record(decision());
  await store.mutate(s=>{s.memoryEpisodes![0].capture={status:'completed',compiledAt:start+10,pageIds:['page'],attempts:1,nextAt:0};});
  const memories=[{pageId:'page',slug:'p',title:'Context',summary:'Context only',similarity:.7,status:'active'}];
  expect((await loop.annotate(memories,start+20))[0].localProvenance).toMatchObject({kinds:['decision'],includesOutcome:false});
  expect((await loop.annotate(memories,start))[0].localProvenance).toBeUndefined();store.close();
 });
 it('consolidates measured outcome records once, without claiming independent samples or changing policy',async()=>{
  const {store,loop}=setup();await loop.record(decision());
  await store.mutate(s=>{const template=s.memoryEpisodes![0];s.memoryEpisodes=[...[-1,3,1,2,0].map((change,i)=>({...structuredClone(template),id:'o'+i,kind:'outcome' as const,followUps:[],capture:{...template.capture,status:'completed' as const},content:{horizonMinutes:30,grossPriceChangePct:change}}))];});
  await loop.tick();await loop.tick();const s=await store.read(),reviews=s.memoryEpisodes!.filter(e=>e.kind==='review');
  expect(reviews).toHaveLength(1);expect(reviews[0].content).toMatchObject({sampleSize:5,uniqueTokens:1,medianGrossPriceChangePct:1});
  expect(reviews[0].content.limitations).toContain('not independent trades');expect(s.ledger.fills).toHaveLength(0);store.close();
 });
 it('records qualified observations without inventing a JEV decision or trade',async()=>{
  const {store,loop}=setup();
  const p={address:pool,token,name:'TEST',priceUsd:1,discoveredAt:start} as any;
  await loop.observe(p,{kind:'auto-monitor'} as any);await loop.observe(p,{kind:'auto-monitor'} as any);
  const s=await store.read();expect(s.memoryEpisodes).toHaveLength(1);expect(s.memoryEpisodes![0].kind).toBe('observation');expect(s.decisions).toHaveLength(0);expect(s.ledger.fills).toHaveLength(0);store.close();
 });
 it('does not link a page read before this episode compiled',async()=>{
  const {store,loop,provider,setTime}=setup();await loop.record(decision());await loop.tick();
  provider.captureStatuses.mockResolvedValue([{id:'source',status:'completed',affectedPageIds:['page'],compiledAt:new Date(start+35000).toISOString()}] as any);
  setTime(start+40000);await loop.tick();
  const d=decision('later',start+45000);d.memoryReadAt=start+30000;d.memories=[{pageId:'page',slug:'p',title:'Older page',summary:'Older version',similarity:.7,status:'active'}];
  await loop.record(d);expect((await store.read()).memoryEpisodes![0].recalledBy).toHaveLength(0);store.close();
 });
 it('captures HOLD, deduplicates unchanged ticks, tracks compilation then a real recall',async()=>{
  const {store,loop,provider,setTime}=setup();
  await loop.record(decision());await loop.record(decision('d2',start+1000));
  expect((await store.read()).memoryEpisodes).toHaveLength(1);
  await loop.tick();expect(provider.captureEpisode).toHaveBeenCalledTimes(1);
  setTime(start+31000);await loop.tick();
  expect((await store.read()).memoryEpisodes?.[0].capture.status).toBe('completed');
  const d=decision('d3',start+40000);d.memories=[{pageId:'page',slug:'p',title:'Observed episode',summary:'Unproven',similarity:.7,status:'active'}];
  await loop.record(d);expect((await store.read()).memoryEpisodes?.[0].recalledBy[0].decisionId).toBe('d3');store.close();
 });
 it('preserves an outbox across restart and retries an uncertain write with the same id',async()=>{
  const {store,loop,provider,setTime}=setup();provider.captureEpisode.mockRejectedValueOnce(new Error('secret provider body'));
  await loop.record(decision());await loop.tick();const id=(await store.read()).memoryEpisodes![0].id;
  setTime(start+120000);await new MemoryLoop(store,provider as any,()=>start+120000).tick();
  expect(provider.captureEpisode.mock.calls.map((x:any)=>x[0].id)).toEqual([id,id]);
  expect(JSON.stringify(await store.read())).not.toContain('secret provider');store.close();
 });
 it('records a timestamped follow-up mark for a HOLD without pretending a fill or causal lesson',async()=>{
  const {store,loop,setTime}=setup();await loop.record(decision());setTime(start+300000);await loop.tick();
  const episodes=(await store.read()).memoryEpisodes!;
  const outcome=episodes.find(e=>e.kind==='outcome')!;
  expect(outcome.content).toMatchObject({grossPriceChangePct:expect.closeTo(20),baselineDecisionId:'d',hypothetical:true});
  expect((await store.read()).ledger.fills).toHaveLength(0);store.close();
 });
 it('does not backfill missed horizons with later prices or write replay/unidentified evidence',async()=>{
  const {store,loop,provider,setTime}=setup();await loop.record(decision());setTime(start+600000);await loop.tick();
  expect(provider.pool).not.toHaveBeenCalled();
  expect((await store.read()).memoryEpisodes![0].followUps[0].status).toBe('unavailable');store.close();
 });
});
