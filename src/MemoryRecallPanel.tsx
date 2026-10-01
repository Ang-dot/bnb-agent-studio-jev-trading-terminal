import { ArrowUpRight } from 'lucide-react';
import { MemoryLogo } from './FrontendEdition.js';
import { TypeSafeLogo } from './TypeSafeLogo.js';
import type { Decision, Memory } from './types.js';

export function MemoryRecallPanel({memoryName,record,emptyTitle,onMemory,onEvidence}:{
  memoryName:string;record?:Decision;emptyTitle:string;
  onMemory:(memory:Memory)=>void;onEvidence:()=>void;
}) {
  const alignment=record?.judgment?.assessments?.find(a=>a.id==='memory_alignment');
  return <div className="tt-memory-coordination">
    <div className="tt-memory-recall">
      <MemoryLogo size={44} className="tt-brain-logo"/>
      <div className="tt-recall-results">
        <div className="tt-mini-heading">{memoryName} <small>{record?`${record.memories.length} retrieved`:'Awaiting assessment'}</small></div>
        {record?.memories.length ? <>
          <div className="tt-recall-list">{record.memories.map(memory=>{
            const assessment=record.judgment?.assessments?.find(a=>a.kind==='memory'&&a.referenceId===memory.pageId);
            return <button key={memory.pageId} className="tt-recall-card" onClick={()=>onMemory(memory)}>
              <span className="tt-recall-meta">{memory.episodeKind||'memory'}{memory.recordedAt?` · ${new Date(memory.recordedAt).toLocaleString('en-GB')}`:''}</span>
              <strong>{memory.title}</strong>
              <p>{memory.preview||memory.summary}</p>
              {memory.outcome&&<small className="tt-recall-outcome">{memory.outcome} · observed price, not P&L</small>}
              <small>{assessment?.valueLabel||'JEV relevance not returned'} <ArrowUpRight size={11}/></small>
            </button>;
          })}</div>
          <small>Retrieved for JEV. Each result is assessed separately; retrieval alone is not a validated lesson.</small>
        </> : <><strong>{emptyTitle}</strong><p>{record?.memoryStatus||'Relevant past episodes will appear beside JEV’s assessment.'}</p><small>Retrieval is shown as recorded.</small></>}
      </div>
    </div>
    <div className="tt-model-assessment"><TypeSafeLogo size={34}/><div><div className="tt-mini-heading">JEV memory alignment</div>{record?.judgment?<>
      <strong>{alignment?.valueLabel||'No memory alignment returned'}</strong>
      <p>{record.memories.length?'This assessment considers the retrieved set. Open a result to see its individual relevance.':'This decision had no recalled episode.'}</p>
      <button className="tt-text-button" onClick={onEvidence}>View decision evidence <ArrowUpRight size={12}/></button>
    </>:<p>Waiting for a recorded model response.</p>}</div></div>
  </div>;
}
