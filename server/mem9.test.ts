import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { Mem9Memory } from './mem9.js';

const token='0x'+'1'.repeat(40);
const other='0x'+'2'.repeat(40);
const at='2026-09-30T10:00:00.000Z';

function row(id:string,kind:'decision'|'observation'|'outcome'|'review',episodeToken=token,extra:Record<string,unknown>={}) {
  const content=JSON.stringify({episodeId:id,kind,name:'TEST',token:episodeToken,createdAt:Date.parse(at),
    summary:`${kind} source`,...extra});
  return {id,content,appId:'jev-kbw',memory_type:'pinned',state:'active',agent_id:'jev-kbw',
    tags:['jev-paper',`jev-episode-${id}`,kind],metadata:{episodeId:id,
      contentHash:createHash('sha256').update(content).digest('hex'),title:`PAPER ${kind} · TEST`},
    created_at:at,updated_at:at,score:0.72};
}

function client(exact:unknown[],analog:unknown[],partial=false) {
  const fetchImpl=vi.fn(async(input:RequestInfo|URL)=>{
    const url=new URL(String(input));
    const memories=url.searchParams.get('search_mode')==='keyword'?exact:analog;
    return new Response(JSON.stringify({memories,partial}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  return {memory:new Mem9Memory({MEM9_API_KEY:'fixture-key'},fetchImpl as typeof fetch),fetchImpl};
}

describe('KBW mem9 recall',()=>{
  it('preserves the decision assessment after a long stored payload',async()=>{
    const decision=row('decision','decision',token,{xEvidence:'x'.repeat(3000),modelAction:'hold',execution:'held',
      assessments:[{label:'Entry evidence',valueLabel:'Conflicting evidence'}],reasons:['Flow deteriorated']});
    const {memory}=client([decision],[]);
    const result=await memory.search('comparable launch',token);
    expect(result).toHaveLength(1);
    expect(result[0].summary).toContain('Entry evidence: Conflicting evidence');
    expect(result[0].summary).toContain('Flow deteriorated');
    expect(result[0].summary).not.toContain('xxxx');
  });

  it('reserves slots for exact-token outcomes and decisions, then diverse comparable cases',async()=>{
    const exact=[row('observation','observation'),row('decision','decision'),
      row('outcome','outcome',token,{horizonMinutes:30,grossPriceChangePct:-12.4,hypothetical:true}),
      row('false-hit','decision',other)];
    const analog=[exact[1],row('analog-decision','decision',other),row('review','review',other,
      {sampleSize:5,medianGrossPriceChangePct:-2,limitations:'Selected observations only'})];
    const {memory,fetchImpl}=client(exact,analog);
    const result=await memory.search('comparable launch',token);
    expect(result.map(m=>m.pageId)).toEqual(['outcome','decision','review','analog-decision']);
    expect(result[0].outcome).toContain('30m observed gross price change -12.4%');
    const urls=fetchImpl.mock.calls.map(call=>new URL(String(call[0])));
    expect(urls[0].searchParams.get('search_mode')).toBe('keyword');
    expect(urls[0].searchParams.get('q')).toBe(token);
    expect(urls[1].searchParams.get('q')).toBe('comparable launch');
  });

  it('fails recall when either provider result is incomplete',async()=>{
    const {memory}=client([],[],true);
    await expect(memory.search('comparable launch',token)).rejects.toThrow('incomplete search');
  });
});
