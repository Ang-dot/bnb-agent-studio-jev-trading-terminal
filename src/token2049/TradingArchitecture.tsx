import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BrainCircuit, Check,
  ChevronLeft, ChevronRight, FileClock, FileText, Layers3, Network,
  Play, Radar, RotateCcw, Search, Server, ShieldCheck, Workflow, X,
  type LucideIcon,
} from 'lucide-react';
import { SiteHeader } from './SiteHeader.js';
import { HistoricalEvaluationRecord } from './HistoricalEvaluationRecord.js';
import { Button } from './ui/button.js';
import { Badge } from './ui/badge.js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog.js';
import { DEFAULT_CASE_ID, getCase, sourceAvailableAt } from './cases.js';
import { TypeSafeLogo } from '../TypeSafeLogo.js';
import bnbLogo from '../assets/bnb-chain-symbol-yellow.svg';
import gmgnLogo from '../assets/gmgn-symbol.svg';
import grokLogo from '../assets/grok-symbol.svg';
import geckoLogo from '../assets/geckoterminal-symbol.svg';
import brainLogo from '../assets/living-brain-logo.png';
import nodeopsLogo from '../assets/nodeops-symbol.png';
import noderealLogo from '../assets/nodereal-logo.svg';
import './architecture.css';

type ComponentId = 'gmgn' | 'market' | 'research' | 'studio' | 'brain' | 'jev' | 'policy' | 'journal' | 'reassessment' | 'sdk' | 'hosting' | 'chain';
interface ComponentInfo {
  name: string;
  summary: string;
  icon: LucideIcon;
  responsibility: string;
  inputs: string;
  outputs: string;
  step: number;
  stages: number[];
}

const components: Record<ComponentId, ComponentInfo> = {
  gmgn: {
    name: 'GMGN', summary: 'Liquidity, holders and wallet activity', icon: Radar, step: 0, stages: [0],
    responsibility: 'Supply token-specific market and wallet context while preserving source identity, observation time and missing fields.',
    inputs: 'Selected token contract, chain and the requested market or wallet observations.',
    outputs: 'Liquidity, holder, activity and market context attributed to the token and observation window.',
  },
  market: {
    name: 'GeckoTerminal API', summary: 'Timestamped, same-pool prices', icon: Radar, step: 0, stages: [0],
    responsibility: 'Supply same-pool trade prices matched to the selected token, retaining the block timestamp and source identity.',
    inputs: 'BNB Chain token contract, pool address and the requested observation window.',
    outputs: 'Matching trade prices with pool, token, transaction and block references. Market time remains separate from API receipt time.',
  },
  research: {
    name: 'Grok research', summary: 'Events and community narratives', icon: Search, step: 0, stages: [0],
    responsibility: 'Research the project and community narratives around the selected token and public events, retaining source attribution, dates, identity checks and competing interpretations.',
    inputs: 'Token identity, current event, research questions and the evidence cutoff.',
    outputs: 'Attributed project claims and community interpretations alongside verified facts. Each interpretation remains tied to its source and date.',
  },
  studio: {
    name: 'BNB Agent Studio', summary: 'Scaffolds the builder’s workflow', icon: Workflow, step: 1, stages: [1],
    responsibility: 'Coordinate evidence, memory recall, JEV assessment and a structured result through the application’s custom work handler.',
    inputs: 'A selected token, current evidence, assessment request and trading-specific application logic.',
    outputs: 'A bounded assessment workflow with consistent request and delivery boundaries.',
  },
  brain: {
    name: 'Living Brain', summary: 'Maintains knowledge across decisions', icon: BrainCircuit, step: 3, stages: [1, 3],
    responsibility: 'Preserve useful knowledge across assessments and sessions.',
    inputs: 'Sourced project and community narratives, token identity checks, assessment records and corrections to earlier claims.',
    outputs: 'Relevant pages, relationships, versions and knowledge changes, with source claims kept distinct from confirmed facts.',
  },
  jev: {
    name: 'JEV', summary: 'Assesses the supplied evidence', icon: Layers3, step: 1, stages: [1],
    responsibility: 'Assess how a public event relates to the selected token’s existing project or community narrative under the application’s configured strategy. Prior context is supplied alongside the current evidence.',
    inputs: 'Current event and market evidence, retrieved context, prior decision reasons and trading constraints.',
    outputs: 'Structured assessment labels and model-choice probabilities. ENTRY labels the model’s screening result; it is not advice from a quoted source or BNB Chain.',
  },
  policy: {
    name: 'Trading policy + execution', summary: 'Checks conditions before acting', icon: ShieldCheck, step: 2, stages: [2],
    responsibility: 'Independently check contract identity, liquidity, entry conditions, sizing, exposure, invalidation and exits. Public commentary alone cannot authorize an order.',
    inputs: 'JEV’s proposed action, current market observations, position state and deterministic trading rules.',
    outputs: 'A permitted or blocked intent and the rule results.',
  },
  journal: {
    name: 'Decision journal', summary: 'Preserves the decision record', icon: FileClock, step: 3, stages: [2, 3],
    responsibility: 'Keep each assessment linked to its source references, policy result, outcome and the knowledge available at the time.',
    inputs: 'Assessments, recalled page versions, source references, policy checks and observed outcomes—including waiting and rejected decisions.',
    outputs: 'An inspectable decision record and research, reasons and outcomes ready for memory capture.',
  },
  reassessment: {
    name: 'Application reassessment', summary: 'Reopens affected decisions', icon: RotateCcw, step: 3, stages: [3],
    responsibility: 'Match new sources or corrected assumptions to saved assessment conditions, then schedule affected research for review.',
    inputs: 'Knowledge changes, saved thesis conditions, token identity and previous review requests.',
    outputs: 'A deduplicated assessment request. JEV decides whether the changed context alters the thesis.',
  },
  sdk: {
    name: 'BNB Agent SDK', summary: 'Chain context and intent interfaces', icon: Network, step: 1, stages: [1, 2],
    responsibility: 'Provide the chain context and intent interfaces used by the application’s assessment and execution boundaries.',
    inputs: 'BNB Chain configuration, agent context and structured action intents.',
    outputs: 'Consistent chain metadata and intent interfaces for the application’s adapters.',
  },
  hosting: {
    name: 'NodeOps', summary: 'Application and agent hosting', icon: Server, step: 1, stages: [0, 1, 2, 3],
    responsibility: 'Host the application and its agent service independently of a visitor’s browser session.',
    inputs: 'Application configuration, deployment artifacts and service requests.',
    outputs: 'Application and agent processes with their configured service boundaries.',
  },
  chain: {
    name: 'NodeReal', summary: 'On-demand chain inspection', icon: Search, step: 0, stages: [0],
    responsibility: 'Provide a chain-level inspection path for explicit application checks.',
    inputs: 'A chain query and the token or account identity being inspected.',
    outputs: 'RPC observations attributed to their query and chain context.',
  },
};

const steps: { title: string; detail: string; focus: ComponentId }[] = [
  { title: 'Gather evidence', detail: 'Establish what is known', focus: 'gmgn' },
  { title: 'Assess with context', detail: 'Connect the past to now', focus: 'jev' },
  { title: 'Apply trading rules', detail: 'Verify before any action', focus: 'policy' },
  { title: 'Remember and revisit', detail: 'Carry knowledge forward', focus: 'brain' },
];

const brandMarks: Partial<Record<ComponentId, { src: string; alt: string }>> = {
  gmgn: { src: gmgnLogo, alt: 'GMGN' },
  research: { src: grokLogo, alt: 'Grok' },
  market: { src: geckoLogo, alt: 'GeckoTerminal' },
  studio: { src: bnbLogo, alt: 'BNB Chain' },
  sdk: { src: bnbLogo, alt: 'BNB Chain' },
  brain: { src: brainLogo, alt: 'Living Brain' },
  hosting: { src: nodeopsLogo, alt: 'NodeOps' },
  chain: { src: noderealLogo, alt: 'NodeReal' },
};

function ComponentMark({ id, size = 28 }: { id: ComponentId; size?: number }) {
  if (id === 'jev') return <TypeSafeLogo size={size} />;
  const mark = brandMarks[id];
  if (id === 'chain' && mark) return <span className="lb-arch-nodereal-mark" style={{ '--lb-arch-mark-size': `${size}px` } as CSSProperties}><img src={mark.src} alt={mark.alt} /></span>;
  if (mark) return <img className="lb-arch-brand-mark" src={mark.src} alt={mark.alt} width={size} height={size} />;
  const Icon = components[id].icon;
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}

export function TradingArchitecture() {
  const [selected, setSelected] = useState<ComponentId>('studio');
  const [step, setStep] = useState(1);
  const [presenting, setPresenting] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordContext] = useState(() => {
    const query = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    const study = getCase(query.get('case') ?? DEFAULT_CASE_ID);
    const requested = Number(query.get('step') ?? 2);
    const checkpoint = Number.isFinite(requested) ? Math.max(0, Math.min(study.steps.length - 1, Math.trunc(requested))) : 2;
    return { study, checkpoint };
  });
  const presentButton = useRef<HTMLButtonElement>(null);
  const spotlight = components[selected];
  const record = recordContext.study.steps[recordContext.checkpoint];
  const recordSources = recordContext.study.sources.filter(source => record.sourceIds.includes(source.id) && sourceAvailableAt(source) <= Date.parse(record.date));

  function select(id: ComponentId) {
    setSelected(id);
    setStep(components[id].step);
  }

  function goToStep(index: number) {
    const next = Math.max(0, Math.min(steps.length - 1, index));
    setStep(next);
    setSelected(steps[next].focus);
  }

  function stopPresenting() {
    setPresenting(false);
    presentButton.current?.focus();
  }

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Trading architecture';
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    if (!presenting || recordOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        stopPresenting();
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        goToStep(step + (event.key === 'ArrowRight' ? 1 : -1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presenting, step, recordOpen]);

  function node(id: ComponentId, compact = false, className = '') {
    const component = components[id];
    const isCurrent = selected === id;
    const dimmed = presenting && !component.stages.includes(step);
    return <button
      type="button"
      className={`lb-arch-node${compact ? ' lb-arch-node-compact' : ''}${isCurrent ? ' lb-arch-node-selected' : ''}${dimmed ? ' lb-arch-node-dimmed' : ''} ${className}`}
      onClick={() => select(id)} aria-pressed={isCurrent}
      aria-label={`Inspect ${component.name}`} key={id}
    >
      <span className="lb-arch-node-main">
        <span className={`lb-arch-node-icon${brandMarks[id] || id === 'jev' ? ' lb-arch-node-brand' : ''}`}><ComponentMark id={id} size={id === 'jev' || id === 'brain' ? 42 : 28} /></span>
        <span className="lb-arch-node-copy">{id === 'studio' && <span className="lb-arch-card-eyebrow">Core engine</span>}<strong>{component.name}</strong><span>{component.summary}</span></span>
      </span>
      {id === 'studio' && <span className="lb-arch-studio-detail">Evidence intake · Memory recall<br />Assessment · Structured result</span>}
      {id === 'sdk' && <span className="lb-arch-sdk-detail">BNB Chain context · Action intents</span>}
      {id === 'jev' && <span className="lb-arch-actions" aria-label="Model assessment labels"><span>WATCH</span><span>ENTRY</span><span>IGNORE</span></span>}
      {id === 'brain' && <span className="lb-arch-brain-cycle">Capture <ArrowRight size={11} aria-hidden="true" /> Compile <ArrowRight size={11} aria-hidden="true" /> Recall</span>}
      {isCurrent && <Check className="lb-arch-node-check" size={14} aria-hidden="true" />}
    </button>;
  }

  return <div className={`lb-app lb-architecture${presenting ? ' lb-arch-presenting' : ''}`}>
    <a className="lb-arch-skip" href="#lb-architecture-map">Skip to architecture</a>
    <SiteHeader active="architecture" />
    <main className="lb-arch-main">
      <section className="lb-arch-intro" aria-labelledby="lb-arch-title">
        <div><p className="lb-arch-eyebrow">Builder architecture · Inside the terminal</p><h1 id="lb-arch-title">From sources to a traceable assessment.</h1></div>
        <Button ref={presentButton} variant={presenting ? 'default' : 'outline'} onClick={() => {
          if (presenting) stopPresenting();
          else { goToStep(0); setPresenting(true); }
        }} aria-pressed={presenting}>
          {presenting ? <X size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          {presenting ? 'Exit walkthrough' : 'Present walkthrough'}
        </Button>
      </section>
      <div className="lb-arch-context">
        <p>Build an agent that connects public events with earlier project and community narratives, checks identity and records its assessment.</p>
        <span>{presenting ? 'Use ← → to present · Esc to exit' : 'Explore the components and their connections'}</span>
      </div>

      <nav className="lb-arch-steps" aria-label="Decision journey">
        {steps.map((item, index) => <button type="button" key={item.title} onClick={() => goToStep(index)} aria-current={step === index ? 'step' : undefined}>
          <span className="lb-arch-step-number">0{index + 1}</span>
          <span><strong>{item.title}</strong><small>{item.detail}</small></span>
        </button>)}
      </nav>

      <div className="lb-arch-workspace">
        <section id="lb-architecture-map" tabIndex={-1} className="lb-arch-map" aria-labelledby="lb-arch-map-title">
          <header className="lb-arch-section-header"><h2 id="lb-arch-map-title">Explore the engine</h2><span>Select any component</span></header>
          <div className="lb-arch-diagram" data-step={step}>
            <section className="lb-arch-inputs" aria-label="Evidence sources"><h3>Market evidence</h3>{node('gmgn')}{node('research')}{node('market')}</section>
            <div className={`lb-arch-connection lb-arch-evidence-bridge${step === 0 ? ' lb-arch-connection-active' : ''}`} aria-hidden="true"><span>Current<br />evidence</span><i /><ArrowRight size={21} /></div>
            <section className={`lb-arch-engine${selected === 'studio' || selected === 'sdk' ? ' lb-arch-engine-selected' : ''}`} aria-label="Core engine">{node('studio', false, 'lb-arch-studio')}{node('sdk', false, 'lb-arch-sdk')}</section>
            <div className={`lb-arch-connection lb-arch-to-jev${step === 1 ? ' lb-arch-connection-active' : ''}`} aria-hidden="true"><span>Evidence +<br />recalled context</span><i /><ArrowRight size={21} /></div>
            <div className={`lb-arch-connection lb-arch-from-jev${step === 1 ? ' lb-arch-connection-active' : ''}`} aria-hidden="true"><span>Typed judgment</span><ArrowLeft size={21} /><i /></div>
            {node('jev', false, 'lb-arch-specialist lb-arch-jev')}
            {node('brain', false, 'lb-arch-specialist lb-arch-brain')}
            <div className={`lb-arch-connection lb-arch-recall lb-arch-memory-line${step === 1 || step === 3 ? ' lb-arch-connection-active' : ''}`} aria-hidden="true"><span>Relevant context</span><ArrowLeft size={21} /><i /></div>
            <div className={`lb-arch-connection lb-arch-to-policy${step === 2 ? ' lb-arch-connection-active' : ''}`} aria-hidden="true"><i /><span>Proposed action</span><ArrowDown size={21} /></div>
            {node('policy', false, 'lb-arch-policy')}
            <div className={`lb-arch-connection lb-arch-policy-result${step === 2 ? ' lb-arch-connection-active' : ''}`} aria-hidden="true"><span>Policy result</span><i /><ArrowRight size={21} /></div>
            {node('journal', false, 'lb-arch-journal')}
            <div className={`lb-arch-connection lb-arch-capture lb-arch-memory-line${step === 3 ? ' lb-arch-connection-active' : ''}`} aria-hidden="true"><ArrowUp size={21} /><span>Decision +<br />outcome</span><i /></div>
            {node('reassessment', false, 'lb-arch-reassessment')}
            <div className={`lb-arch-connection lb-arch-knowledge-loop lb-arch-memory-line${step === 3 ? ' lb-arch-connection-active' : ''}`} aria-hidden="true"><span>Knowledge changes</span><small>Application chooses which thesis to revisit</small><ArrowUp size={21} /><i /></div>
            <div className={`lb-arch-connection lb-arch-reassessment-return${step === 3 ? ' lb-arch-connection-active' : ''}`} aria-hidden="true"><span>Review<br />affected<br />thesis</span><ArrowRight size={21} /><i /></div>
            <p className="lb-arch-mobile-flow">Current evidence and Living Brain context inform JEV through Studio. The trading policy checks its proposed action. The journal captures the decision and outcome; knowledge changes help the application select a thesis for reassessment.</p>
          </div>
          <footer className="lb-arch-map-footer">JEV assesses. Trading rules govern action. Living Brain carries knowledge forward.</footer>
        </section>

        <aside className="lb-arch-spotlight" aria-labelledby="lb-arch-spotlight-title">
          <div className="lb-arch-spotlight-body" aria-live="polite" aria-atomic="true">
            <p className="lb-arch-eyebrow">Component spotlight</p>
            <h2 id="lb-arch-spotlight-title"><span className="lb-arch-spotlight-icon"><ComponentMark id={selected} size={32} /></span>{spotlight.name}</h2>
            <p className="lb-arch-spotlight-summary">{spotlight.summary}</p>
            <dl>
              <div><dt>Responsibility</dt><dd>{spotlight.responsibility}</dd></div>
              <div><dt>Inputs</dt><dd>{spotlight.inputs}</dd></div>
              <div><dt>Outputs</dt><dd>{spotlight.outputs}</dd></div>
            </dl>
            {selected === 'brain' && <div className="lb-arch-memory-detail"><span>Capture</span><ArrowRight size={13} aria-hidden="true" /><span>Compile</span><ArrowRight size={13} aria-hidden="true" /><span>Recall</span></div>}
            {selected === 'market' && <a className="lb-arch-data-attribution" href="https://www.geckoterminal.com" target="_blank" rel="noopener noreferrer">On-chain data provided by GeckoTerminal <ArrowUpRight size={13} aria-hidden="true" /></a>}
          </div>
          <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
            <footer className="lb-arch-spotlight-footer">
              <DialogTrigger asChild><Button variant="ghost" className="lb-arch-record-trigger"><FileText size={16} aria-hidden="true" />Assessment record<ArrowUpRight size={14} aria-hidden="true" /></Button></DialogTrigger>
              <p>{presenting ? 'Use ← → to move through the journey · Esc to exit' : 'Follow the journey or inspect any component.'}</p>
              <div className="lb-arch-pager"><Button variant="outline" size="icon" aria-label="Previous journey step" disabled={step === 0} onClick={() => goToStep(step - 1)}><ChevronLeft size={17} /></Button><span><strong>{step + 1}</strong> / {steps.length}</span><Button variant="outline" size="icon" aria-label="Next journey step" disabled={step === steps.length - 1} onClick={() => goToStep(step + 1)}><ChevronRight size={17} /></Button></div>
            </footer>
            <DialogContent className="lb-architecture lb-arch-record">
              <DialogHeader>
                <p className="lb-arch-eyebrow">{recordContext.study.ticker} · {new Date(record.date).toLocaleString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} UTC</p>
                <DialogTitle>Assessment record</DialogTitle>
                <DialogDescription>An educational record using BNB-COIN placeholders and generalized source summaries. The historical comparison illustrates how earlier context can change a model assessment; it identifies no real token and implies no endorsement. No trade or native Living Brain revision was recorded.</DialogDescription>
              </DialogHeader>
              <div className="lb-arch-record-heading"><Badge variant="outline">{record.action === 'WAIT' ? 'WATCH' : record.action}</Badge><h3>{record.title}</h3></div>
              <p className="lb-arch-record-reason">{record.reason}</p>
              <dl className="lb-arch-record-fields"><div><dt>What changed</dt><dd>{record.changed}</dd></div><div><dt>What carries forward</dt><dd>{record.retained}</dd></div><div><dt>Still unresolved</dt><dd>{record.unresolved}</dd></div></dl>
              <section className="lb-arch-record-sources" aria-label="Sources available at this checkpoint"><h3>Sources at this checkpoint</h3>{recordSources.length ? recordSources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer"><span><strong>{source.title}</strong><small>{source.publishedAt} · {source.attribution} · Generalized summary</small><span>{source.note}</span></span><ArrowUpRight size={16} aria-hidden="true" /></a>) : <p>No dated source is available in this record.</p>}</section>
              <HistoricalEvaluationRecord receiptUrl={recordContext.study.evaluation.receiptUrl}/>
              <Button asChild variant="outline"><a href={`/token2049?case=${recordContext.study.id}&step=${recordContext.checkpoint}`}>Open this decision in Trading<ArrowRight size={15} aria-hidden="true" /></a></Button>
            </DialogContent>
          </Dialog>
        </aside>
      </div>

      <section className="lb-arch-infrastructure" aria-labelledby="lb-arch-infrastructure-title">
        <h2 id="lb-arch-infrastructure-title">Supporting infrastructure</h2>
        <div>{(['hosting', 'chain'] as const).map(id => node(id, true))}</div>
      </section>
    </main>
  </div>;
}
