import { describe, it, expect } from 'vitest';
import { normalizeEvidence } from './enrichment.js';
import { researchInput } from './research-input.js';
const token='0x'+'1'.repeat(40),pool='0x'+'2'.repeat(40),now=1790000000000;
const fixture=()=>normalizeEvidence(token,[{key:'info',requestedAt:now-1000,receivedAt:now,raw:{address:token,price:{buy_volume_1m:'120',sell_volume_1m:'80',buy_volume_5m:'300',sell_volume_5m:'200'},pool:{base_address:token,pool_address:pool,exchange:'pancake_v3',base_reserve_value:10000},stat:{top_10_holder_rate:.6}}}],now);
describe('research input contract',()=>{
 it('sends bounded, source-timed context with overlapping-window normalization and no trading thresholds',()=>{
   const r=researchInput(fixture(),token,pool,now)!;
   expect(r.version).toBe('bsc-context-v1');
   const flow=r.sections.find(s=>s.id==='Rflow')!;
   expect(flow.facts).toMatchObject({windows:[{window:'1m',buyShare:.6,netUsd:40,usdPerMinute:200},{window:'5m',buyShare:.6,netUsd:100,usdPerMinute:100},expect.anything()]});
   expect(JSON.stringify(r)).toContain('not validated predictive alpha');
   expect(JSON.stringify(r)).not.toContain('impact50Pct');
 });
 it('omits stale or future inputs and mismatched execution-pool depth',()=>{
   expect(researchInput(fixture(),token,pool,now-1)).toBeUndefined();
   expect(researchInput(fixture(),token,pool,now+300001)).toBeUndefined();
   const r=researchInput(fixture(),token,'0x'+'3'.repeat(40),now)!;
   expect(r.sections.find(s=>s.id==='Rdepth')?.facts).not.toHaveProperty('baseUsd');
   expect(r.sections.find(s=>s.id==='Rdepth')?.availability).toBe('unavailable');
 });
 it('does not infer accumulation from overlapping or cumulative samples, or absence from missing sources',()=>{
   const r=researchInput(fixture(),token,pool,now)!;
   expect(r.sections.find(s=>s.id==='Rwallets')?.caveats.join(' ')).toContain('cumulative');
   expect(r.sections.find(s=>s.id==='Rcreator')?.availability).toBe('unavailable');
   expect(r.sections.find(s=>s.id==='Rflow')?.facts).toMatchObject({smartEvents:null});
 });
});
