import { useId } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, FileText } from 'lucide-react';
import { TypeSafeLogo } from '../TypeSafeLogo.js';
import brainLogo from '../assets/living-brain-logo.png';
import { Button } from './ui/button.js';
import './decision-impact.css';

export interface DecisionMemory {
  id: string;
  title: string;
  date: string;
  url: string;
  relationship: string;
}

export interface DecisionArm {
  action: string;
  summary: string;
  /** Probability of the model choosing entry, on a 0–1 scale. */
  entryProbability?: number;
}

export interface DecisionComparison {
  status: 'tested' | 'pending';
  eventTitle: string;
  eventTime: string;
  model?: string;
  contextTitle: string;
  contextSummary: string;
  sourceLimit?: string;
  memories: DecisionMemory[];
  without: DecisionArm;
  with: DecisionArm;
  repeats?: number;
  receiptUrl?: string;
}

export interface DecisionImpactProps {
  comparison: DecisionComparison;
  enabled: boolean;
  onToggle: () => void;
  onInspect: () => void;
}

function displayDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return `${date.toLocaleString('en-GB', {
    timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric',
    ...(!dateOnly ? { hour: '2-digit' as const, minute: '2-digit' as const } : {}),
  })}${dateOnly ? '' : ' UTC'}`;
}

function actionTone(action: string): string {
  const normalized = action.trim().toUpperCase();
  if (/^(ENTRY|BUY)(\b|_)/.test(normalized)) return 'entry';
  if (normalized === 'EXIT' || normalized === 'SELL' || normalized === 'SKIP') return 'exit';
  return 'neutral';
}

function DecisionCard({ arm, label, active, tested, pendingSummary }: { arm: DecisionArm; label: string; active: boolean; tested: boolean; pendingSummary: string }) {
  const probability = arm.entryProbability;
  const showProbability = tested && probability !== undefined && Number.isFinite(probability) && probability >= 0 && probability <= 1;
  return <div className={`lb-impact-decision${active ? ' is-active' : ''}`}>
    <div className="lb-impact-decision-label"><span>{label}</span>{active && <span className="lb-impact-active" role="img" aria-label="Selected condition"><Check size={12} aria-hidden="true" /></span>}</div>
    <strong className={`lb-impact-action is-${tested ? actionTone(arm.action) : 'pending'}`}>{tested ? arm.action : 'Awaiting run'}</strong>
    <p className="lb-impact-reason" title={tested ? arm.summary : pendingSummary}>{tested ? arm.summary : pendingSummary}</p>
    {showProbability && <div className="lb-impact-probability" title="The model's probability of choosing entry; not a win rate."><span>Model choice</span><strong>{new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 }).format(probability)}</strong></div>}
  </div>;
}

export function DecisionImpact({ comparison, enabled, onToggle, onInspect }: DecisionImpactProps) {
  const id = useId();
  const tested = comparison.status === 'tested';
  const hasProbability = tested && [comparison.without.entryProbability, comparison.with.entryProbability].some(value => value !== undefined && Number.isFinite(value) && value >= 0 && value <= 1);
  return <section className="lb-decision-impact" aria-labelledby={`${id}-title`}>
    <div className="lb-impact-heading"><h3 id={`${id}-title`}>{tested ? 'What memory adds' : 'Context ready for JEV'}</h3><span className={`lb-impact-status${tested ? ' is-tested' : ''}`}>{tested ? 'Model output' : 'Pending'}</span></div>

    <div className="lb-impact-handoff" aria-label="Living Brain supplies remembered context to JEV">
      <span className="lb-impact-brand"><img src={brainLogo} alt="" width="25" height="25" /><span>Living Brain</span></span>
      <span className="lb-impact-connector"><span>Context</span><ArrowRight size={19} aria-hidden="true" /></span>
      <span className="lb-impact-brand lb-impact-jev"><TypeSafeLogo size={24} /><span>JEV</span></span>
    </div>
    <div className="lb-impact-decisions" aria-label="Decisions at the same event and time">
      <DecisionCard arm={comparison.without} label="Current event only" active={!enabled} tested={tested} pendingSummary="JEV will assess the current event." />
      <DecisionCard arm={comparison.with} label="With remembered context" active={enabled} tested={tested} pendingSummary="JEV will assess the same event with remembered context." />
    </div>
    {hasProbability && <p className="lb-impact-signal-caption">Probability of choosing ENTRY in the recorded test. It is not a win rate or investment recommendation.</p>}
    <div className="lb-impact-context"><h4 title={comparison.contextTitle}>{comparison.contextTitle}</h4><p title={comparison.contextSummary}>{comparison.contextSummary}</p></div>
    {comparison.sourceLimit && <p className="lb-impact-source-limit"><strong>Source limits</strong>{comparison.sourceLimit}</p>}
    {comparison.memories.length > 0 && <details className="lb-impact-sources">
      <summary><span>({Math.min(3, comparison.memories.length)}) remembered links</span><ChevronDown size={13} aria-hidden="true" /></summary>
      <ul className="lb-impact-memories" aria-label="Remembered facts supplied to JEV">{comparison.memories.slice(0, 3).map(memory => <li key={memory.id}>
        <a href={memory.url} target="_blank" rel="noreferrer" aria-label={`${memory.title}, ${displayDate(memory.date)}. ${memory.relationship}. Open source in a new tab.`}>
          <span className="lb-impact-memory-top"><time dateTime={memory.date}>{displayDate(memory.date)}</time><ArrowUpRight size={12} aria-hidden="true" /></span>
          <strong>{memory.title}</strong><span className="lb-impact-relationship">{memory.relationship}</span>
        </a>
      </li>)}</ul>
      {comparison.memories.length > 3 && <p className="lb-impact-source-more">{comparison.memories.length - 3} more in the decision record</p>}
    </details>}
    <div className="lb-impact-event"><strong title={comparison.eventTitle}>{comparison.eventTitle}</strong><time dateTime={comparison.eventTime}>Same event · {displayDate(comparison.eventTime)}</time></div>
    <div className="lb-impact-selection"><span id={`${id}-toggle-label`}>Use remembered context</span><button type="button" className={`lb-impact-toggle${enabled ? ' is-on' : ''}`} role="switch" aria-checked={enabled} aria-labelledby={`${id}-toggle-label`} onClick={onToggle}><span /></button></div>

    {tested && (comparison.repeats || comparison.receiptUrl) && <div className="lb-impact-run-details">
      <span title={comparison.model}>{comparison.repeats && comparison.repeats > 0 ? `${comparison.repeats} paired ${comparison.repeats === 1 ? 'run' : 'runs'}` : ''}</span>
      {comparison.receiptUrl && <button type="button" onClick={onInspect}>Evaluation context <ArrowRight size={12} aria-hidden="true" /></button>}
    </div>}
    <Button className="lb-impact-inspect" variant="outline" onClick={onInspect}><FileText size={14} aria-hidden="true" />Inspect decision record<ArrowRight size={14} aria-hidden="true" /></Button>
  </section>;
}
