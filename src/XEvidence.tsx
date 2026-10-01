import { ExternalLink } from "lucide-react";
import type { EvidenceAssessment, XResearch } from "./types.js";
import { AssessmentCard } from "./DecisionBreakdown.js";
import { NarrativeEvidence } from './NarrativeEvidence.js';
const utc = (n: number) => new Date(n).toISOString().slice(0, 19).replace("T", " ") + " UTC";
export function XEvidence({ research, now, assessments }: { research?: XResearch; now: number; assessments?: EvidenceAssessment[] }) {
  if (!research) return <>
    <p>No X research captured for this decision.</p>
    <small>Inspect a new decision to search the token’s exact BSC contract.</small>
  </>;
  const label = { ready: "Cited posts", no_results: "No matching posts", unverified: "Unusable evidence", error: "Search unavailable" }[research.status];
  return <div className="x-evidence">
    <NarrativeEvidence research={research} assessments={assessments}/>
    <h4>Contract-linked X posts</h4>
    <span className={`x-status ${research.status}`}>{label}</span>
    <p>{research.detail}</p>
    <small>Searched {utc(research.collectedAt)} · {research.searchCalls} search receipts in that request</small>
    {research.delivery && <small>{research.delivery==='fresh' ? 'New Grok request for this assessment.' : research.delivery==='cache' ? 'Reused cached research; no new X request for this assessment.' : 'Shared an in-flight Grok request; no duplicate request.'}</small>}
    {research.sources.map((source, i) => <details className="x-source" key={source.postId} open>
      <summary><span className="evidence-id">X{i + 1}</span> @{source.handle} · {new Date(source.publishedAt).toISOString().slice(11, 16)} UTC</summary>
      <p id={`evidence-X${i + 1}`}><b>Grok summary:</b> {source.summary}</p>
      <small>Grok-reported contract excerpt</small>
      <p className="x-excerpt">{source.identityExcerpt}</p>
      <small>{utc(source.publishedAt)} · time derived from post ID</small>
      <a href={source.url} target="_blank" rel="noopener noreferrer">Open cited post <ExternalLink size={11} /></a>
      {assessments?.filter(a => a.kind === "x" && a.referenceId === source.postId).map(a => <AssessmentCard key={a.id} assessment={a} />)}
      <small>Reported excerpt, not independently verified raw post text.</small>
    </details>)}
    <details className="x-provenance">
      <summary>Search scope & provenance</summary>
      <p>Exact BSC contract: <code>{research.token}</code></p>
      <p>{utc(research.window.from)} → {utc(research.window.to)} · 24-hour window</p>
      <p>{research.model} via OpenRouter · {research.rejectedCount} results rejected</p>
      {research.requestId && <p>Request: <code>{research.requestId}</code></p>}
      {research.costUsd !== undefined && <p>Provider-reported request cost: ${research.costUsd.toFixed(5)}. Not a cost cap.</p>}
      <p>{now >= research.expiresAt ? "Historical evidence; a new inspection refreshes expired research." : "Successful evidence is reusable for up to five minutes. New/bonding tokens with no CA posts refresh after 90 seconds when assessed again."}</p>
      <p>Citations do not verify a claim. Grok reports the text and contract association; code checks citations, address matching and post-ID timestamps. Search is not an exhaustive measure of X activity.</p>
    </details>
  </div>;
}
