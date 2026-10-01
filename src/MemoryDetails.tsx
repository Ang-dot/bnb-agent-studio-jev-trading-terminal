import { ArrowUpRight } from 'lucide-react';
import { AssessmentCard } from './DecisionBreakdown.js';
import { memorySearchLabel } from './memory-presentation.js';
import type { Decision, Memory } from './types.js';

export function MemoryDetails({memory,memoryName,record}:{memory:Memory;memoryName:string;record?:Decision}) {
  const assessment=record?.judgment?.assessments?.find(a=>a.kind==='memory'&&a.referenceId===memory.pageId);
  return <>
    <div className="tt-inline-brand"><span>{memoryName} · retrieved episode</span></div>
    <h2>{memory.title}</h2>
    <div className="tt-memory-metadata"><span>{memory.episodeKind||memory.status}</span>{memory.recordedAt&&<time dateTime={new Date(memory.recordedAt).toISOString()}>{new Date(memory.recordedAt).toLocaleString('en-GB')}</time>}<span>{memorySearchLabel(memory)}</span></div>
    <p className="tt-memory-text">{memory.preview||memory.summary}</p>
    {memory.outcome&&<p><strong>Observed follow-up:</strong> {memory.outcome}. Gross price movement is not achievable P&amp;L.</p>}
    {memory.limitation&&<p><strong>Limit:</strong> {memory.limitation}</p>}
    {memory.preview&&<details><summary>Evidence supplied to JEV</summary><p className="tt-memory-text">{memory.summary}</p></details>}
    <small>Memory ID: {memory.pageId}</small>
    <p>Captured as an input to the selected decision. This does not show that memory improved the result.</p>
    {assessment?<AssessmentCard assessment={assessment}/>:<p>JEV did not return an individual relevance assessment for this result.</p>}
  </>;
}

export function MemoryEvidenceList({record,memoryName,onMemory}:{record:Decision;memoryName:string;onMemory:(memory:Memory)=>void}) {
  return <><h3>{memoryName}</h3>{record.memories.map((memory,i)=>{
    const assessment=record.judgment?.assessments?.find(a=>a.kind==='memory'&&a.referenceId===memory.pageId);
    return <button key={memory.pageId} className="tt-ledger-row" id={`evidence-M${i+1}`} onClick={()=>onMemory(memory)}>
      <span><strong>{memory.title}</strong><small>{memory.episodeKind||'memory'}{memory.recordedAt?` · ${new Date(memory.recordedAt).toLocaleString('en-GB')}`:''} · {assessment?.valueLabel||'relevance not returned'}</small><small>{memory.preview||memory.summary}</small>{memory.outcome&&<small>{memory.outcome}</small>}</span><ArrowUpRight size={15}/>
    </button>;
  })}{!record.memories.length&&<p>{record.memoryStatus||'No retrieved memories recorded.'}</p>}</>;
}
