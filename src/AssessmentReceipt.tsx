import { Boxes, ChevronDown, Check, Clock3 } from 'lucide-react';
import type { Decision } from './types.js';
import type { MemoryEpisode } from './memory.js';
import './assessment-receipt.css';
import { marketSources } from './market-provenance.js';
import { GeckoAttribution } from './GeckoAttribution.js';

const duration=(ms:number)=>ms<1000?`${ms} ms`:`${(ms/1000).toFixed(2)} s`;
export function AssessmentReceiptView({decision,episodes=[]}:{decision?:Decision;episodes?:MemoryEpisode[]}) {
  const receipt=decision?.assessmentReceipt;
  if(!receipt||!decision)return null;
  const jev=receipt.stages.find(s=>s.name==='JEV');
  const episode=episodes.find(e=>e.id===decision.memoryEpisodeId);
  const memoryAssessments=decision.judgment?.assessments?.filter(a=>a.kind==='memory')??[];
  return <details className="studio-receipt">
    <summary><Boxes size={17} aria-hidden="true"/><span><strong>BNB Agent Studio</strong><small>Assessment receipt</small></span><b>{receipt.outcome==='completed'?'Delivered':receipt.outcome==='skipped'?'Assessment stopped':'Duplicate skipped'}</b><ChevronDown size={15} aria-hidden="true"/></summary>
    <div className="studio-receipt-body">
      <div className="studio-receipt-meta"><span>Service v{receipt.serviceVersion} · Runtime {receipt.runtimeVersion}</span><span>Private HTTP · no payment</span></div>
      <code>Request {receipt.requestId}</code>
      <dl className="studio-receipt-metrics">
        <div><dt>Assessment pipeline</dt><dd>{duration(receipt.durationMs)}</dd></div>
        <div><dt>JEV API round-trip</dt><dd>{jev?duration(jev.durationMs):'Not called'}</dd></div>
        <div><dt>Proposed action</dt><dd>{decision.judgment?.action.toUpperCase()??'Not evaluated'}</dd></div>
        <div><dt>Paper execution</dt><dd>{decision.status==='executed'?'Fill recorded':'No fill'}</dd></div>
      </dl>
      <ol className="studio-receipt-stages">{receipt.stages.map((stage,i)=><li key={i}>
        <span className={stage.status==='failed'?'failed':''}>{stage.status==='completed'?<Check size={12}/>:<Clock3 size={12}/>}</span>
        <strong>{stage.name}</strong><small>{stage.status==='failed'?'Failed · ':''}{duration(stage.durationMs)}</small>
      </li>)}</ol>
      <div className="studio-receipt-evidence">
        <p><b>{decision.judgment?'Inputs supplied to JEV:':'Evidence collected before stop:'}</b> {decision.research?.sources.length??0} cited X posts · {decision.memories.length} recalled memories · {memoryAssessments.length} memory assessments.</p>
        {decision.snapshot&&<p><b>{decision.snapshot.source === "gmgn-paper" ? "Indicative paper receipt:" : "Pool trade observed:"}</b> {new Date(decision.snapshot.source === "gmgn-paper" ? decision.snapshot.observedAt : decision.snapshot.marketAt).toISOString()} · {marketSources(decision.snapshot).price}. {decision.snapshot.metricsSource??'Market'} metrics received {new Date(decision.snapshot.metricsReceivedAt??decision.snapshot.observedAt).toISOString()}.</p>}
        <GeckoAttribution snapshot={decision.snapshot}/>
        {decision.memories.length>0&&<div className="studio-receipt-links">{decision.memories.map((m,i)=><span key={m.pageId} title={m.pageId}>M{i+1} · {m.pageId}</span>)}</div>}
        <p><b>Memory write now:</b> {episode?`${episode.capture.status} · ${episode.summary}`:decision.memoryCapture??'No linked memory episode'}</p>
        {episode&&<small>{episode.decisionId!==decision.id?'Unchanged context links to an earlier episode. ':''}{episode.followUps.filter(f=>f.status==='observed').length} outcome checks observed · {episode.recalledBy.length} later recall links.</small>}
      </div>
      <small className="studio-receipt-note">Durations are measured service/API time, not model-internal latency. A retrieved memory or completed capture does not prove a better trade.</small>
    </div>
  </details>;
}
