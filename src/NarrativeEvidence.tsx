import { ExternalLink } from 'lucide-react';
import { narrativeDimensions, type NarrativeDimension, type NarrativeResearch } from './narrative.js';
import type { EvidenceAssessment, XResearch } from './types.js';
import './narrative.css';

export function NarrativeSummary({research, assessments}: {research?: XResearch; assessments?: EvidenceAssessment[]}) {
  const narrative = research?.narrative;
  if (!narrative) return null;
  const potential = assessments?.find(a => a.id === 'narrative_potential');
  const spread = assessments?.find(a => a.id === 'narrative_spread');
  return <div className="narrative-summary" aria-label="Narrative and spread assessments">
    <div><small>Narrative potential</small><strong>{potential?.valueLabel ?? (narrative.status === 'ready' ? 'Awaiting JEV assessment' : 'Assessment unavailable')}</strong></div>
    <div><small>Observed token spread</small><strong>{spread?.valueLabel ?? (research?.status === 'no_results' ? 'No token spread observed' : `${narrative.spreadSample.posts} sampled posts`)}</strong></div>
    {potential?.value === 'strong' && research?.status === 'no_results' && <p className="narrative-watch">Strong angle, no token spread observed · a small paper probe may qualify with fresh metadata, cited catalyst, timing and positive buying. It is not token endorsement.</p>}
  </div>;
}

function Finding({id, narrative}: {id: NarrativeDimension; narrative: NarrativeResearch}) {
  const finding = narrative.findings?.[id];
  if (!finding) return null;
  return <div className="narrative-finding">
    <div><strong>{narrativeDimensions[id]}</strong><span className={`narrative-verdict ${finding.verdict}`}>{({supports: 'Support in evidence', cautions: 'Caution', unknown: 'Unknown'})[finding.verdict]}</span></div>
    <p>{finding.summary}</p>
    {!!finding.evidenceIds.length && <div className="narrative-refs" aria-label={`${narrativeDimensions[id]} sources`}>{finding.evidenceIds.map(ref => <a key={ref} href={`#evidence-${ref}`}>{ref === 'TOKEN' ? 'Token metadata' : ref}</a>)}</div>}
  </div>;
}

export function NarrativeEvidence({research, assessments}: {research: XResearch; assessments?: EvidenceAssessment[]}) {
  const narrative = research.narrative;
  if (!narrative) return <p className="narrative-missing">Narrative potential was not collected for this record. A new assessment needs fresh token metadata.</p>;
  return <section className="narrative-evidence" aria-label="Narrative research">
    <NarrativeSummary research={research} assessments={assessments}/>
    {narrative.angle && <p className="narrative-angle"><b>Proposed angle</b>{narrative.angle}</p>}
    <div className="narrative-columns">
      <section aria-label="Narrative potential evidence"><h4>Narrative potential</h4><p className="narrative-caption">Grok’s interpretation of the angle and its supporting context.</p>
        {(['fit', 'catalyst', 'originality', 'timing'] as const).map(id => <Finding key={id} id={id} narrative={narrative}/>)}</section>
      <section aria-label="Observed spread evidence"><h4>Observed spread</h4>
        <p className="narrative-caption">{narrative.spreadSample.posts} contract-linked posts · {narrative.spreadSample.authors} distinct authors in this sample{narrative.spreadSample.largestAuthorShare !== null ? ` · largest author ${(narrative.spreadSample.largestAuthorShare * 100).toFixed(0)}%` : ''}.</p>
        {(['community', 'kol', 'promotion'] as const).map(id => <Finding key={id} id={id} narrative={narrative}/>)}</section>
    </div>
    <small>Findings and author roles are Grok-reported. Distinct authors do not establish independence or organic reach. Narrative potential is not a price forecast.</small>
    {!!narrative.issues.length && <div className="narrative-issues" role="note">{narrative.issues.map(issue => <p key={issue}>{issue}</p>)}</div>}
    <details className="narrative-metadata" id="evidence-TOKEN"><summary>Token metadata used</summary>
      <p><b>{narrative.metadata.name || 'Name unavailable'}</b> · {narrative.metadata.symbol || 'Ticker unavailable'}</p>
      <p>{narrative.metadata.description ?? 'Description unavailable; no description was inferred.'}</p>
      <small>{narrative.metadata.reportedXHandle ? `Provider-reported handle: @${narrative.metadata.reportedXHandle}. Ownership is unverified.` : 'Project X handle unavailable.'}</small>
      <small>GMGN receipt {new Date(narrative.metadata.receivedAt).toISOString()} · creator-supplied text, not verified claims.</small>
    </details>
    <details className="narrative-themes" open><summary>Broader theme sources · {narrative.themeSources.length}</summary>
      <p>Context for the angle. These posts do not establish discussion or endorsement of this token.</p>
      {narrative.themeSources.map((source, i) => <article className="x-source" id={`evidence-T${i + 1}`} key={source.postId}>
        <strong><span className="evidence-id">T{i + 1}</span> @{source.handle}</strong><p>{source.summary}</p>
        <small>{new Date(source.publishedAt).toISOString()} · time derived from post ID</small>
        <a href={source.url} target="_blank" rel="noopener noreferrer">Open theme post <ExternalLink size={11}/></a>
      </article>)}
      {!narrative.themeSources.length && <small>No accepted broader-theme posts returned.</small>}
    </details>
  </section>;
}
