import { ArrowUpRight, FileClock } from 'lucide-react';
import { HISTORICAL_POLICY_CONTEXT, EVALUATION_SCOPE, SOURCE_ATTRIBUTION_CONTEXT } from './evaluation-publication.js';
import './evaluation-record.css';

/** Keep every public archive link next to its historical policy and source context. */
export function HistoricalEvaluationRecord({ receiptUrl }: { receiptUrl: string }) {
  return <section className="lb-evaluation-record" aria-label="Historical evaluation context">
    <h3><FileClock size={16} aria-hidden="true" />Historical evaluation policy</h3>
    <p>{HISTORICAL_POLICY_CONTEXT}</p>
    <p>{EVALUATION_SCOPE}</p>
    <details>
      <summary>Placeholder identities and record scope</summary>
      <p>{SOURCE_ATTRIBUTION_CONTEXT}</p>
      <p>The downloadable example retains generalized context and the six recorded output values. It omits original source links, contract addresses and model input bodies.</p>
      <a href={receiptUrl} target="_blank" rel="noreferrer">Open redacted example record <ArrowUpRight size={14} aria-hidden="true" /></a>
    </details>
  </section>;
}
