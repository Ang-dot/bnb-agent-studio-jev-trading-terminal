import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, CircleHelp, ExternalLink, Maximize2, Pause, Play, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import './trading-revision6.css';
import brainLogo from '../assets/living-brain-logo.png';
import { SiteHeader } from './SiteHeader.js';
import { Button } from './ui/button.js';
import { Badge } from './ui/badge.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog.js';
import { BrainScene } from './BrainScene.js';
import { PriceChart } from './PriceChart.js';
import { CoinAvatar } from './CoinAvatar.js';
import { DecisionImpact } from './DecisionImpact.js';
import { HistoricalEvaluationRecord } from './HistoricalEvaluationRecord.js';
import { getHistoricalPrices } from './historical-prices.js';
import { getCasePeriod, type CasePeriod } from './case-periods.js';
import { cases, getCase, DEMO_NOTICE, PRICE_NOTICE, SOURCE_NOTICE, type CaseStudy, type MemoryNode, type ReplayStep } from './cases.js';
import { initialReplayState, replayReducer, hydrateReplayState, getReplayStep, getCheckpoint, getAvailableSources, getVisibleMemory, type ReplayState, type ReplayAction } from './replay-state.js';
import { cn } from './lib/utils.js';
import { NAVIGATION_START_EVENT, replayDestination, workspaceNavigation } from './navigation.js';

const shortDate=(value:string)=>new Date(value).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const clock=(value:string)=>new Date(value).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'});
function restoreState():ReplayState {
  if(typeof window==='undefined')return initialReplayState;
  let state=initialReplayState;
  try { state=hydrateReplayState(JSON.parse(sessionStorage.getItem('lb-presentation-state-v3')||'null')); } catch { /* A blocked or old browser store falls back to the public fixture. */ }
  const query=new URLSearchParams(window.location.search),requested=query.get('case');
  if(requested)state=replayReducer(state,{type:'select-case',caseId:requested});
  const position=query.get('step');if(position!==null&&Number.isFinite(Number(position)))state=replayReducer(state,{type:'step',step:Number(position)});
  return state;
}
function ActionBadge({step}:{step:ReplayStep}) { return <span className={cn('lb-action-badge',`lb-action-${step.action.toLowerCase()}`)}>{step.action==='ENTRY'?'MODEL ENTRY':step.action==='WAIT'?'WATCH':step.action}</span>; }
function relativePosition(index:number,selected:number){const count=cases.length,difference=(index-selected+count)%count;return difference>Math.floor(count/2)?difference-count:difference;}
type Resolution = 'event' | 'wide' | 'all';
const resolutions: { id: Resolution; label: string }[] = [
  { id: 'all', label: 'Period' }, { id: 'wide', label: 'Story · 1H' }, { id: 'event', label: 'Event · 1m' },
];
const compactUsd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(value);
const percentage = (value: number) => `${value >= 0 ? '+' : ''}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}%`;
function peakSourceLabel(metrics: CasePeriod) {
  if (metrics.displayPeakTime === null) return 'Daily source high; finer interval unverified';
  const start = metrics.displayPeakTime;
  const window = metrics.displayIntervalSeconds < 86400 ? ` · ${clock(new Date(start * 1000).toISOString())}–${clock(new Date((start + metrics.displayIntervalSeconds) * 1000).toISOString())} UTC` : '';
  return `${metrics.displayIntervalLabel} candle high${window}; exact trade time is unknown`;
}
function chartData(study: CaseStudy, resolution: Resolution) {
  const history = getHistoricalPrices(study.id)!;
  const metrics = getCasePeriod(study.id);
  const selectedPeriod = resolution === 'all' && metrics?.dailyCandles.length;
  return {
    candles: selectedPeriod ? (metrics.displayCandles ?? metrics.dailyCandles) : resolution === 'event' ? history.eventCandles : history.wideCandles,
    interval: selectedPeriod ? (metrics.displayIntervalSeconds ?? 86400) : resolution === 'event' ? 60 : 3600,
    intervalLabel: selectedPeriod ? (metrics.displayIntervalLabel ?? '1D') : resolution === 'event' ? '1m' : '1H',
    priceFormat: metrics ? { type: 'custom' as const, minMove: 1, formatter: (value: number) => value < 0 ? '' : compactUsd(value) } : history.priceFormat,
    multiplier: metrics?.supply.tokens ?? 1,
    label: metrics ? 'Est. FDV · USD' : 'Price · USD',
  };
}
function HistoricalChart({ study, state, resolution = 'all', compact = false, interactive = true, resetKey, onSource }: {
  study: CaseStudy; state: ReplayState; resolution?: Resolution; compact?: boolean; interactive?: boolean;
  resetKey?: number; onSource?: (id: string) => void;
}) {
  const data = useMemo(() => chartData(study, resolution), [study, resolution]);
  const metrics = getCasePeriod(study.id);
  const events = useMemo(() => study.sources.filter(source => state.memoryEnabled || study.evaluation.candidate.currentEvidence.some(fact => fact.id === source.id)).map(source => ({
    id: source.id, time: Date.parse(source.publishedAt) / 1000, title: source.title,
    kind: study.evaluation.candidate.currentEvidence.some(fact => fact.id === source.id) ? 'event' as const : 'memory' as const,
  })), [study, state.memoryEnabled]);
  const peak = metrics && metrics.displayPeakTime !== null && state.memoryEnabled ? {
    entryTime: metrics.entry.time, entryPrice: metrics.entry.price,
    peakTime: metrics.displayPeakTime, peakPrice: metrics.peak.price,
    peakLabel: 'Period high',
  } : undefined;
  return <PriceChart candles={data.candles} steps={[]} compact={compact} interactive={interactive}
    resetKey={resetKey} intervalSeconds={data.interval} priceFormat={data.priceFormat} priceLabel={data.label}
    valueMultiplier={data.multiplier} events={compact ? [] : events} onEventSelect={onSource}
    entryToPeak={compact ? undefined : peak} highlightAfterEntry={!compact}
    decisionCursor={{ time: Date.parse(study.evaluation.cutoff) / 1000, label: state.memoryEnabled ? 'MODEL ENTRY' : 'MODEL WATCH', action: state.memoryEnabled ? 'ENTRY' : 'WAIT' }} />;
}
function ChartRanges({ value, periodInterval, onChange }: { value: Resolution; periodInterval: string; onChange: (value: Resolution) => void }) {
  return <div className="lb-inline-ranges" role="group" aria-label="Chart timeline range">
    {resolutions.map(range => <button key={range.id} aria-pressed={value === range.id} title={value === range.id ? 'Fit this complete range again' : range.id === 'all' ? 'Selected narrative period with a candle interval suited to this case' : undefined} onClick={() => onChange(range.id)}>{range.label}{range.id === 'all' && ` · ${periodInterval}`}</button>)}
  </div>;
}
function PeakSummary({ study, enabled, onInspect }: { study: CaseStudy; enabled: boolean; onInspect: () => void }) {
  const metrics = getCasePeriod(study.id);
  if (!metrics) return null;
  return <button className={cn('lb-peak-summary', !enabled && 'is-watch')} onClick={onInspect} aria-label="Inspect historical price-change calculation">
    <span className="lb-peak-heading"><span>{enabled ? 'ASSESSMENT → PERIOD HIGH' : 'CURRENT EVIDENCE ONLY'}</span><span className="lb-peak-date">{enabled && shortDate(new Date(metrics.peak.time * 1000).toISOString())}<CircleHelp size={12} /></span></span>
    <span className="lb-peak-values"><strong>{enabled ? percentage(metrics.peak.changePercent) : 'WATCH'}</strong><span>{enabled ? `${metrics.peak.multiple.toFixed(1)}×` : 'No entry'}</span></span>
    <span className="lb-peak-detail">{enabled ? `${compactUsd(metrics.entry.price * metrics.supply.tokens)} → ${compactUsd(metrics.peak.price * metrics.supply.tokens)} FDV` : 'The recorded model result is WATCH.'}</span>
    <span className="lb-peak-footnote">{enabled ? 'Observed price change · selected period' : 'Add remembered context to compare the model output.'}</span>
  </button>;
}
function MemoryTimeline({ study, enabled, onSelect }: { study: CaseStudy; enabled: boolean; onSelect: (id: string) => void }) {
  const events = [...study.sources].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  return <div className={cn('lb-memory-timeline', !enabled && 'is-excluded')}>
    <span className="lb-chart-section-label">Memory timeline <span>select an event</span></span>
    <div className="lb-memory-events" role="group" aria-label="Dated memory events">
      {events.map((source, index) => <button key={source.id} onClick={() => onSelect(source.id)} title={`${source.title} · ${shortDate(source.publishedAt)} ${clock(source.publishedAt)} UTC`}>
        <span className="lb-event-index">{index + 1}</span><span><time>{shortDate(source.publishedAt)} · {clock(source.publishedAt)}</time><strong>{source.title}</strong></span>
      </button>)}
    </div>
  </div>;
}
function ContextControls({ study, state, dispatch }: { study: CaseStudy; state: ReplayState; dispatch: (action: ReplayAction) => void }) {
  const checkpoint = getCheckpoint(state);
  return <div className="lb-chart-context-controls" aria-label="Context flow controls">
    <button className="lb-context-play" aria-label={state.playing ? 'Pause explanation' : 'Replay explanation'} onClick={() => {
      if (state.playing) dispatch({ type: 'pause' });
      else if (checkpoint === study.steps.length - 1) { dispatch({ type: 'step', step: 0 }); dispatch({ type: 'toggle-play' }); }
      else dispatch({ type: 'toggle-play' });
    }}>{state.playing ? <Pause size={13} /> : <Play size={13} />}</button>
    <div className="lb-context-phases">{study.steps.map((item, index) => <button key={item.id} aria-current={index === checkpoint ? 'step' : undefined} onClick={() => dispatch({ type: 'step', step: index })}>
      <span>{index + 1}</span>{['New event', 'Recall', 'Decision'][index]}
    </button>)}</div>
  </div>;
}
function ChartCard({ study, state, active, position, onSelect, onExpand, resetKey, resolution = 'all', onResolution, onSource, onMetrics, dispatch }: {
  study: CaseStudy; state: ReplayState; active: boolean; position: number; onSelect: () => void; onExpand: () => void;
  resetKey: number; resolution?: Resolution; onResolution: (value: Resolution) => void; onSource: (id: string) => void;
  onMetrics: () => void; dispatch: (action: ReplayAction) => void;
}) {
  const selectedState = useMemo(() => ({ ...state, caseId: study.id }), [state, study.id]);
  const data = chartData(study, resolution);
  const firstDate=shortDate(new Date(data.candles[0].time*1000).toISOString());
  const lastDate=shortDate(new Date(data.candles.at(-1)!.time*1000).toISOString());
  const displayedRange=firstDate===lastDate?firstDate:`${firstDate} – ${lastDate}`;
  return <article className={cn('lb-chart-card', active ? 'is-foreground' : 'is-background')} data-position={position} data-side={position < 0 ? 'left' : 'right'} style={{ '--position': position, zIndex: 10 - Math.abs(position) } as CSSProperties} aria-label={`${study.ticker} chart`}>
    {!active && <button className="lb-chart-select" onClick={onSelect} aria-label={`Select ${study.ticker}`}><span className="lb-sr-only">Select {study.ticker}</span></button>}
    <div className="lb-chart-heading"><div className="lb-chart-identity"><CoinAvatar caseId={study.id} size={active ? 38 : 32} /><div><div className="lb-chart-ticker">{study.ticker}</div><p>{shortDate(study.date)}</p></div></div>{active && <Button variant="outline" size="icon" className="lb-expand-chart" aria-label={`Expand ${study.ticker} chart`} onClick={onExpand}><Maximize2 size={16} /></Button>}</div>
    {active && <PeakSummary study={study} enabled={state.memoryEnabled} onInspect={onMetrics} />}
    {active && <div className="lb-chart-toolbar"><ChartRanges value={resolution} periodInterval={getCasePeriod(study.id)?.displayIntervalLabel ?? '1D'} onChange={onResolution} /><span title="Fully diluted value: token price multiplied by total supply. Historical circulating supply is not independently verified.">{data.label}</span></div>}
    <div className="lb-chart-plot"><HistoricalChart study={study} state={selectedState} resolution={resolution} compact={!active} interactive={active} resetKey={resetKey} onSource={onSource} /></div>
    {active && <><MemoryTimeline study={study} enabled={state.memoryEnabled} onSelect={onSource} /><ContextControls study={study} state={state} dispatch={dispatch} /></>}
    <div className="lb-chart-bottom"><span>{active ? displayedRange : 'GMGN'} · {data.intervalLabel} candles · UTC</span><span className="lb-chart-action">{state.memoryEnabled ? 'MODEL ENTRY' : 'MODEL WATCH'}</span></div>
  </article>;
}

type Panel='chart'|'brain'|'evidence'|'changes'|'comparison'|'methodology'|'node'|'metrics'|null;
export function TradingPage(){
  const [state,dispatch]=useReducer(replayReducer,undefined,restoreState);
  const [panel,setPanel]=useState<Panel>(null);
  const [chartReset,setChartReset]=useState(0);
  const [resolutions,setResolutions]=useState<Record<string,Resolution>>({});
  const resolution=resolutions[state.caseId]??'all';
  const setResolution=(value:Resolution)=>{setResolutions(previous=>({...previous,[state.caseId]:value}));setChartReset(previous=>previous+1);};
  const [selectedNode,setSelectedNode]=useState<MemoryNode|null>(null);
  const [comparisonTab,setComparisonTab]=useState<'context'|'conditions'>('context');
  const focusReturn=useRef<HTMLElement|null>(null);
  const ownedUrl=useRef(typeof window==='undefined'?'':window.location.href);
  const study=getCase(state.caseId),checkpoint=getCheckpoint(state),step=getReplayStep(state);
  const selectedIndex=cases.findIndex(c=>c.id===state.caseId);
  const sources=useMemo(()=>getAvailableSources(state),[study,checkpoint]);
  const nodes=useMemo(()=>getVisibleMemory(state),[study,checkpoint,state.memoryEnabled]);
  const selectedStep={...step,action:(state.memoryEnabled?'ENTRY':'WAIT') as ReplayStep['action']};
  const selectedReason=state.memoryEnabled?step.withMemory:step.withoutMemory;
  const selectedTitle=state.memoryEnabled?step.title:'Current event: relationship unresolved';
  const open=(target:Panel)=>{if(panel===null)focusReturn.current=document.activeElement as HTMLElement;setPanel(target);if(state.playing)dispatch({type:'toggle-play'});};
  const closePanel=()=>setPanel(null);
  const selectNode=(node:MemoryNode)=>{setSelectedNode(node);open('node');};
  const selectSource=(id:string)=>{const node=study.memory.find(memory=>memory.sourceIds.includes(id));if(node)selectNode(node);};
  const metrics=getCasePeriod(study.id);
  const data=chartData(study,resolution);
  const panelDate=panel==='node'&&selectedNode?.sourceIds.length ? study.sources.find(source=>source.id===selectedNode.sourceIds[0])?.publishedAt??step.date : step.date;
  const selectCase=(id:string)=>{setPanel(null);setSelectedNode(null);dispatch({type:'select-case',caseId:id});};
  const moveCoin=(direction:number)=>selectCase(cases[(selectedIndex+direction+cases.length)%cases.length].id);
  useEffect(()=>{
    const pause=()=>dispatch({type:'pause'});
    window.addEventListener(NAVIGATION_START_EVENT,pause);
    return()=>window.removeEventListener(NAVIGATION_START_EVENT,pause);
  },[]);
  useEffect(()=>{
    try {sessionStorage.setItem('lb-presentation-state-v3',JSON.stringify(state));} catch { /* The replay also works without browser storage. */ }
    const url=replayDestination(ownedUrl.current,window.location.href,state.caseId,getCheckpoint(state),workspaceNavigation.isPending());
    if(!url)return;
    window.history.replaceState(window.history.state,'',`${url.pathname}${url.search}${url.hash}`);
    ownedUrl.current=url.href;
  },[state]);
  useEffect(()=>{
    if(!state.playing)return;
    const timer=window.setInterval(()=>{if(!workspaceNavigation.isPending())dispatch({type:'next',caseId:state.caseId,autoplay:true});},2400);
    return()=>window.clearInterval(timer);
  },[state.playing,state.caseId]);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(panel||event.repeat||event.altKey||event.metaKey||event.ctrlKey||event.shiftKey||window.getSelection()?.toString())return;
      if((event.target as HTMLElement).closest('input,textarea,select,button,a,summary,[contenteditable=true]'))return;
      if(event.key==='ArrowLeft'){event.preventDefault();dispatch({type:'previous'});}
      if(event.key==='ArrowRight'){event.preventDefault();dispatch({type:'next'});}
      if(event.key===' '){event.preventDefault();dispatch({type:'toggle-play'});}
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[panel]);
  const title=panel==='chart'?`${study.ticker} · valuation and decisions`:panel==='brain'?`${study.ticker} · connected memory`:panel==='evidence'?'Evidence behind this checkpoint':panel==='changes'?'What changed in memory':panel==='comparison'?'Same event. Different context.':panel==='node'?selectedNode?.label:panel==='metrics'?'Historical price-change calculation':'About this replay';
  return <div className="lb-app lb-trading">
    <SiteHeader query={`?case=${state.caseId}&step=${checkpoint}`}/>
    <main className="lb-main">
      <div className="lb-workspace-top"><div><span className="lb-eyebrow">{cases.length} HISTORICAL CASES · ONE STRATEGY BRAIN</span><h1>See how community context changes a decision.</h1></div><div className="lb-workspace-status"><Badge><span className="lb-status-dot"/> Recorded model comparisons</Badge><button onClick={()=>open('methodology')} className="lb-data-note">How this was tested <CircleHelp size={13}/></button></div></div>
      <p className="lb-source-notice">Living Brain connects public events with earlier community narratives, project claims and token records for JEV to assess.</p>
      <p className="lb-presentation-notice"><ShieldCheck size={16} aria-hidden="true"/><span>{SOURCE_NOTICE}</span></p>
      <div className="lb-workspace">
        <section className="lb-market-workspace" aria-label="Selected trading stories">
          <div className="lb-carousel" aria-roledescription="carousel" aria-label="Select a trading story">
            {cases.map((item,index)=><ChartCard key={item.id} study={item} state={state} active={item.id===state.caseId} position={relativePosition(index,selectedIndex)} onSelect={()=>selectCase(item.id)} onExpand={()=>open('chart')} resetKey={chartReset} resolution={item.id===state.caseId?resolution:'all'} onResolution={setResolution} onSource={selectSource} onMetrics={()=>open('metrics')} dispatch={dispatch}/>)}
          </div>
          <div className="lb-coin-navigation"><Button variant="outline" size="icon" aria-label="Select previous coin" onClick={()=>moveCoin(-1)}><ChevronLeft size={21}/></Button><div className="lb-carousel-dots" aria-label="Select coin">{cases.map(item=><button key={item.id} className={item.id===state.caseId?'is-selected':''} aria-label={`Show ${item.ticker}`} aria-pressed={item.id===state.caseId} onClick={()=>selectCase(item.id)}/>)}</div><Button variant="outline" size="icon" aria-label="Select next coin" onClick={()=>moveCoin(1)}><ChevronRight size={21}/></Button></div>
          <p className="lb-carousel-hint">Explore how earlier community context changes JEV’s assessment of the same event.</p>
          <div className="lb-case-intro" key={study.id}><div><span className="lb-eyebrow">{study.ticker} / THE STORY</span><h2>{study.name}</h2></div><p>{study.summary}</p><Button variant="ghost" size="sm" onClick={()=>open('evidence')}>Inspect evidence <ArrowUpRight/></Button></div>
        </section>
        <aside className="lb-brain-panel" aria-label="Living Brain and selected decision">
          <div className="lb-brain-heading"><img src={brainLogo} alt="Living Brain"/><div><h2>Living Brain</h2><p>Focused on <strong>{study.ticker}</strong></p></div><Button size="icon" variant="outline" aria-label="Expand brain" onClick={()=>open('brain')}><Maximize2/></Button></div>
          <BrainScene nodes={nodes} step={step} enabled={state.memoryEnabled} onSelect={selectNode}/>
          <div className="lb-brain-caption"><span className={state.memoryEnabled?'lb-lit-dot':'lb-off-dot'}/>{state.memoryEnabled?`${nodes.length} connected nodes · select a node`:'Memory context excluded'}<button aria-label="About the brain visualization" onClick={()=>open('methodology')}><CircleHelp size={13}/></button></div>
          <DecisionImpact comparison={study.comparison} enabled={state.memoryEnabled} onToggle={()=>dispatch({type:'toggle-memory'})} onInspect={()=>{setComparisonTab('context');open('comparison');}}/>
        </aside>
      </div>
      <div className="lb-footer"><span><ShieldCheck size={13}/> Same evidence, prices and policy. Compare the model with and without prior context.</span><button onClick={()=>open('methodology')}>Curated JEV evaluations · reconstructed memory <ArrowUpRight size={12}/></button></div>
    </main>
    <Dialog open={panel!==null} onOpenChange={opened=>!opened&&closePanel()}><DialogContent className={cn((panel==='chart'||panel==='brain')&&'lb-expanded-modal')} onCloseAutoFocus={event=>{event.preventDefault();focusReturn.current?.focus();}}><DialogHeader className={panel==='chart'?'lb-expanded-chart-heading':undefined}>{panel==='chart'&&<CoinAvatar caseId={study.id} size={48}/>}<DialogTitle>{title}</DialogTitle><DialogDescription>{panel==='methodology'?'How to read the charts, memory and decision records.':`${shortDate(panelDate)} · ${clock(panelDate)} UTC · ${study.ticker}`}</DialogDescription></DialogHeader>
      <p className="lb-presentation-notice"><ShieldCheck size={16} aria-hidden="true"/><span>{SOURCE_NOTICE}</span></p>
      {panel==='chart'&&<><div className="lb-expanded-chart-layout"><div className="lb-expanded-market">
        <PeakSummary study={study} enabled={state.memoryEnabled} onInspect={()=>setPanel('metrics')}/>
        <div className="lb-chart-toolbar"><ChartRanges value={resolution} periodInterval={metrics?.displayIntervalLabel ?? '1D'} onChange={setResolution}/><span title="Price multiplied by total supply; historical circulating supply is not independently verified.">{data.label}</span></div>
        <div className="lb-chart-large"><HistoricalChart study={study} state={state} resolution={resolution} resetKey={chartReset} onSource={selectSource}/></div>
        <MemoryTimeline study={study} enabled={state.memoryEnabled} onSelect={selectSource}/><ContextControls study={study} state={state} dispatch={dispatch}/>
        <p className="lb-caption">{PRICE_NOTICE}. Chart ranges change presentation only; JEV’s inputs stay fixed at the decision cutoff.</p>
        </div><div className="lb-expanded-context"><ActionBadge step={selectedStep}/><h3>{selectedTitle}</h3><p>{selectedReason}</p><BrainScene nodes={nodes} step={step} enabled={state.memoryEnabled} onSelect={selectNode}/></div></div></>}
      {panel==='brain'&&<><div className="lb-expanded-brain-layout"><BrainScene expanded nodes={nodes} step={step} enabled={state.memoryEnabled} onSelect={selectNode}/><div className="lb-expanded-context"><span className="lb-eyebrow">THE ACTIVE THESIS</span><h3>{selectedTitle}</h3><p>{selectedReason}</p><div className="lb-mini-chart"><HistoricalChart study={study} state={state} resolution={resolution} compact/></div><Button variant="outline" onClick={()=>setPanel('changes')}>Inspect the knowledge change <ArrowRight/></Button></div></div><p className="lb-caption">Conceptual Living Brain visualization · paths reconstructed from the dated evidence supplied to JEV.</p><div className="lb-modal-pager"><Button variant="outline" disabled={checkpoint===0} onClick={()=>dispatch({type:'previous'})}><ArrowLeft/> Previous step</Button><span>{checkpoint+1} / {study.steps.length}</span><Button variant="outline" disabled={checkpoint===study.steps.length-1} onClick={()=>dispatch({type:'next'})}>Next step <ArrowRight/></Button></div></>}
      {panel==='evidence'&&<><p className="lb-panel-lead">{step.reason}</p><div className="lb-sources">{sources.map(source=><article key={source.id}><div><Badge variant="outline">Example context</Badge><time>{source.publishedAt.slice(0,10)}</time></div><h3><a href={source.url} target="_blank" rel="noreferrer">{source.title} <ExternalLink size={14}/></a></h3><p className="lb-source-attribution">Source: {source.attribution}</p><p>{source.note}</p></article>)}</div><p className="lb-caption">Generalized historical context for an educational presentation. Asset identities, named participants and direct source links are omitted. The linked example records are redacted presentation copies.</p></>}
      {panel==='changes'&&<div className="lb-change-list"><article><Badge variant="default">Updated</Badge><h3>What changed</h3><p>{step.changed}</p></article><article><Badge>Retained</Badge><h3>What still holds</h3><p>{step.retained}</p></article><article><Badge variant="outline">Unresolved</Badge><h3>What still needs checking</h3><p>{step.unresolved}</p></article><p className="lb-caption">Source-backed interpretation of the tested context packet. Native Living Brain page versions were not recorded for these historical examples.</p></div>}
      {panel==='comparison'&&<><div className="lb-drawer-tabs"><Button size="sm" variant={comparisonTab==='context'?'default':'ghost'} onClick={()=>setComparisonTab('context')}>Decision context</Button><Button size="sm" variant={comparisonTab==='conditions'?'default':'ghost'} onClick={()=>setComparisonTab('conditions')}>Held constant</Button></div>{comparisonTab==='context'?<><div className="lb-comparison-grid"><article><span className="lb-eyebrow">CURRENT EVENT ONLY</span><h2>MODEL WATCH</h2><h3>{step.withoutMemory}</h3><p>The same new event, selected token and completed historical candles.</p></article><article className="with-memory"><span className="lb-eyebrow">WITH REMEMBERED CONTEXT</span><h2>MODEL ENTRY</h2><h3>{step.withMemory}</h3><p>{step.changed}</p></article></div><HistoricalEvaluationRecord receiptUrl={study.evaluation.receiptUrl}/><p className="lb-caption">Actual paired JEV outputs · three fresh repeats after exploratory case selection. The explanations summarize the supplied evidence, not a model reasoning trace.</p></>:<div className="lb-conditions">{['Same JEV model and assessment instructions','Same new event and source cutoff','Same token identity and market snapshot','Same configured assessment policy; execution checks remain separate'].map(t=><p key={t}><ShieldCheck size={17}/>{t}</p>)}<p className="lb-caption">Relationship removal and GraphRAG controls: not evaluated.</p></div>}</>}
      {panel==='node'&&selectedNode&&<><Badge variant="default">{selectedNode.type}</Badge><p className="lb-panel-lead">{selectedNode.summary}</p><div className="lb-sources">{study.sources.filter(s=>selectedNode.sourceIds.includes(s.id)).map(s=><article key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title} <ExternalLink size={13}/></a><p className="lb-source-attribution">Source: {s.attribution}</p><p>Published {shortDate(s.publishedAt)} · {clock(s.publishedAt)} UTC</p></article>)}</div><p className="lb-caption">Generalized source summary with identities removed. The glowing path illustrates the historical context supplied to JEV. The linked record is a redacted educational example.</p></>}
      {panel==='metrics'&&metrics&&<div className="lb-methodology">
        <p>Retrospective price change from the model assessment timestamp to the highest later candle in the selected period. The date range and endpoint were chosen after observing the price history. This does not establish that a public post caused the move or that the model could realize the displayed change.</p>
        <dl className="lb-metric-detail"><div><dt>Assessment-time reference · {shortDate(study.date)} {clock(study.date)} UTC</dt><dd>{compactUsd(metrics.entry.price*metrics.supply.tokens)} <small>Est. FDV · latest available closed minute</small></dd></div><div><dt>Period high · {shortDate(new Date(metrics.peak.time*1000).toISOString())}</dt><dd>{compactUsd(metrics.peak.price*metrics.supply.tokens)} <small>{peakSourceLabel(metrics)}</small></dd></div><div><dt>Observed price change</dt><dd>{percentage(metrics.peak.changePercent)} <small>(peak price ÷ reference price − 1) × 100</small></dd></div><div><dt>Price multiple</dt><dd>{metrics.peak.multiple.toFixed(2)}× <small>peak price ÷ reference price</small></dd></div></dl>
        <h3>Valuation basis</h3><p>{metrics.supply.basis} The graph uses {metrics.supply.tokens.toLocaleString('en-US')} tokens. Historical circulating supply is not independently verified, so this is estimated FDV rather than circulating market cap. The percentage change is calculated from unscaled prices.</p>
        <p>Reference candle closed at {shortDate(new Date(metrics.entry.candleCloseTime*1000).toISOString())} {clock(new Date(metrics.entry.candleCloseTime*1000).toISOString())} UTC, before or at the assessment cutoff.</p><h3>Selected period</h3><p>{shortDate(new Date(metrics.period.from*1000).toISOString())} through {shortDate(new Date((metrics.period.to-1)*1000).toISOString())}. {metrics.period.note} {metrics.peak.note}</p>
        <p>ENTRY is the demo label for JEV’s recorded entry_candidate output, not advice from a source author or BNB Chain. No trade was filled, no holding period or exit policy was tested, and the price ratio excludes costs and execution limits. The chart preserves intervening declines.</p>
        <a href={metrics.provenanceUrl} className="lb-text-link" target="_blank" rel="noreferrer">Inspect chart data and calculation <ArrowUpRight size={13}/></a>
      </div>}
      {panel==='methodology'&&<div className="lb-methodology"><p>{DEMO_NOTICE}</p><h3>Selected for a visible decision change</h3><p>These examples were deliberately selected after exploratory research and strategy configuration. Each displayed WATCH → ENTRY change was repeated in three fresh pairs with the same JEV model, questions, current event and completed historical candles. This is a demonstration, not a representative benchmark against other memory systems.</p><h3>Price history and decision time</h3><p>The complete selected narrative period is shown immediately, ending after its recorded high rather than extending into a later market cycle. Candle spacing adapts to each case: daily for BNB-COIN1, four-hour for BNB-COIN2, and hourly for BNB-COIN3 and BNB-COIN4. Switch to the hourly story or minute event window to inspect the event, then select the active range again to refit after panning. Only fully completed pre-cutoff candles were supplied to JEV. ENTRY is the demo label for the recorded entry_candidate output; no trade was filled and no source author is presented as recommending a purchase.</p><h3>Placeholder identities and educational scope</h3><p>{SOURCE_NOTICE} The example retains the source’s role, earlier claims and their limits while omitting identifying details. A recorded model choice does not establish token affiliation, source-author intent or a recommendation from BNB Chain.</p><h3>Community context in these examples</h3><p>The context packets contain earlier community posts, project claims and token references. They do not measure the scale or sentiment of the community’s response to the new event, or establish what caused a later price move.</p><h3>Memory informs the assessment</h3><p>Living Brain maintains knowledge. Application code decides which thesis to revisit. JEV assesses it, and the same execution rules apply with or without memory.</p><h3>What the memory adds</h3><p>Persistent entity links, an earlier objection and its correction let a new event reopen an existing thesis. The agent can preserve this revision for its next decision. These evaluations test the supplied context’s effect on JEV; they do not establish superiority over RAG or other memory providers.</p><h3>Inspect the record</h3><p>Each placeholder case includes generalized context and six recorded output values. Original names, contracts, source links and model input bodies are omitted from public downloads. The chart history and output values are retained for education. Trading and monitoring remain paused.</p><HistoricalEvaluationRecord receiptUrl={study.evaluation.receiptUrl}/><a href="https://docs.livingbrain.com/api-reference/workspace/graph" target="_blank" rel="noreferrer" className="lb-text-link">Living Brain graph documentation <ArrowUpRight size={14}/></a></div>}
    </DialogContent></Dialog>
  </div>;
}
