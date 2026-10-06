import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cases } from './cases.js';
import { recordedEvaluations } from './recorded-cases.js';
import { getHistoricalPrices, closedAsOf } from './historical-prices.js';
import { coinAssets } from './coin-assets.js';

type Output = {repeat:number;condition:'current_only'|'with_prior_context';answers:{entry_signal:{choice:string;probabilities:Record<string,number>}}};
const readPacket = (path:string) => JSON.parse(readFileSync(new URL(`../../public${path}`, import.meta.url),'utf8')) as {
  schemaVersion:string;caseId:string;model:string;cutoff:string;sources:Array<{id:string;url:string;content:string;availableAt:string}>;
  outputs:Output[];presentation:{redactions:string};
};

describe('placeholder presentation integrity',()=>{
  it('publishes exactly four placeholder identities with one generic coin image',()=>{
    expect(cases.map(c=>c.id)).toEqual(['coin1','coin2','coin3','coin4']);
    expect(cases.map(c=>c.ticker)).toEqual(['BNB-COIN1','BNB-COIN2','BNB-COIN3','BNB-COIN4']);
    expect(Object.values(coinAssets).map(c=>c.src)).toEqual(Array(4).fill('/assets/coins/coin.svg'));
    expect(readdirSync(new URL('../../public/assets/coins/',import.meta.url))).toEqual(['coin.svg']);
    expect(readdirSync(new URL('../../public/assets/',import.meta.url)).sort()).toEqual(['coins','examples','living-brain-neural.png']);
  });

  for(const record of recordedEvaluations){
    it(`${record.caseId}: retains six recorded outputs and their aggregate probabilities`,()=>{
      const packet=readPacket(record.receiptUrl);
      expect(packet.schemaVersion).toBe('jev-placeholder-presentation-v1');
      expect(packet.caseId).toBe(record.caseId);
      expect(packet.model).toBe(record.model);
      expect(packet.cutoff).toBe(record.cutoff);
      expect(packet.outputs).toHaveLength(6);
      for(const condition of ['current_only','with_prior_context'] as const){
        const outputs=packet.outputs.filter(o=>o.condition===condition);
        expect(outputs.map(o=>o.repeat).sort()).toEqual([1,2,3]);
        const expectedAction=condition==='current_only'?'watch':'entry_candidate';
        expect(outputs.map(o=>o.answers.entry_signal.choice)).toEqual(Array(3).fill(expectedAction));
        const mean=outputs.reduce((total,o)=>total+o.answers.entry_signal.probabilities.entry_candidate,0)/3;
        expect(mean).toBeCloseTo(condition==='current_only'?record.withoutEntryProbability:record.withEntryProbability,12);
      }
    });

    it(`${record.caseId}: public evidence is redacted and remains before the assessment cutoff`,()=>{
      const packet=readPacket(record.receiptUrl),cutoff=Date.parse(record.cutoff);
      expect(packet.presentation.redactions).toContain('not an original model receipt');
      const text=JSON.stringify(packet);
      expect(text).not.toMatch(/0x[a-fA-F0-9]{40}|https?:\/\/[^\s"<>]*(?:x\.com|bscscan|dexscreener|gmgn\.ai)/);
      expect(packet).not.toHaveProperty('receipts');
      expect(packet).not.toHaveProperty('questions');
      expect(packet).not.toHaveProperty('candidate');
      for(const source of packet.sources){
        expect(source.id).toMatch(new RegExp(`^${record.caseId}-source-\\d+$`));
        expect(source.url).toBe(`${record.receiptUrl}#${source.id}`);
        expect(Date.parse(source.availableAt)).toBeLessThanOrEqual(cutoff);
      }
      const history=getHistoricalPrices(record.caseId)!;
      const before=closedAsOf(history.eventCandles,60,record.cutoff);
      expect(before.length).toBeGreaterThan(0);
      expect(before.every(c=>(c.time+60)*1000<=cutoff)).toBe(true);
      const study=cases.find(c=>c.id===record.caseId)!;
      expect(study.comparison.without.entryProbability).toBe(record.withoutEntryProbability);
      expect(study.comparison.with.entryProbability).toBe(record.withEntryProbability);
    });
  }
});
