import { useEffect, useReducer, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, ChevronLeft, ChevronRight, Database, FileText, Info, LoaderCircle, Play, ShieldCheck, X } from 'lucide-react';
import { TypeSafeLogo } from './TypeSafeLogo.js';
import bnbLogo from './assets/bnb-chain-symbol-yellow.svg';
import brainLogo from './assets/living-brain-logo.png';
import geckoLogo from './assets/geckoterminal-symbol.svg';
import githubMark from './assets/github-mark.svg';
import gmgnLogo from './assets/gmgn-symbol.svg';
import grokLogo from './assets/grok-symbol.svg';
import nodeopsLogo from './assets/nodeops-symbol.png';
import noderealLogo from './assets/nodereal-logo.svg';
import { AssessmentReceiptView } from './AssessmentReceipt.js';
import { architectureComponents as components, architectureReducer, architectureSteps as steps, initialArchitecture, loadLatestReceipt, REPOSITORY_URL, type ArchitectureComponent } from './architecture-model.js';
import type { Decision } from './types.js';
import './style.css';
import './architecture.css';

const brandMarks = {
  gmgn: {src: gmgnLogo, alt: 'GMGN'},
  grok: {src: grokLogo, alt: 'Grok'},
  geckoterminal: {src: geckoLogo, alt: 'GeckoTerminal'},
  nodeops: {src: nodeopsLogo, alt: 'NodeOps'},
  nodereal: {src: noderealLogo, alt: 'NodeReal'},
} as const;
type BrandMarkId = keyof typeof brandMarks | 'supabase';

function BrandMark({id, decorative=false}:{id:BrandMarkId; decorative?:boolean}) {
  if (id==='supabase') return <Database className="arch-brand-mark" aria-label={decorative?undefined:'Supabase'} aria-hidden={decorative} width={28} height={28}/>;
  const mark = brandMarks[id];
  const alt = decorative ? '' : mark.alt;
  if (id==='nodereal') return <span className="arch-nodereal-mark"><img src={mark.src} alt={alt}/></span>;
  return <img className="arch-brand-mark" src={mark.src} alt={alt} width={28} height={28}/>;
}

function RecordedReceipt({close}:{close:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [decision,setDecision]=useState<Decision|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{dialog.current?.showModal();return ()=>dialog.current?.close();},[]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    void loadLatestReceipt(fetch,controller.signal).then(d=>{if(!controller.signal.aborted)setDecision(d);}).catch(()=>{if(!controller.signal.aborted)setError('Recorded assessments are temporarily unavailable. Nothing new was requested.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[retry]);
  return <dialog ref={dialog} className="arch-receipt-dialog" aria-labelledby="arch-receipt-title" onCancel={close} onClose={close}>
    <header><div><span className="arch-eyebrow">RECORDED EVIDENCE</span><h2 id="arch-receipt-title">Latest assessment receipt</h2></div><button onClick={close} aria-label="Close assessment receipt"><X size={22}/></button></header>
    <p>This reads the public journal. It does not run JEV, arm paper trading or place an order.</p>
    {loading?<div className="arch-receipt-state" role="status"><LoaderCircle className="arch-loading" size={22}/> Loading the latest recorded receipt…</div>:error?<div className="arch-receipt-state" role="alert"><p>{error}</p><button className="arch-text-button" onClick={()=>setRetry(n=>n+1)}>Retry reading</button></div>:decision?<><p className="arch-record-title"><strong>{decision.name}</strong><span>{new Date(decision.time).toLocaleString()} · {decision.status==='executed'?'Paper fill':decision.judgment?'Model assessed':'Stopped before judgment'}</span></p><AssessmentReceiptView decision={decision}/><small>Request status and durations are recorded values, not an illustrative success path. A skipped request is not a JEV judgment.</small></>:<div className="arch-receipt-state"><FileText size={24}/><p>No Studio receipt is retained yet. Historical decisions are not relabelled as Studio assessments.</p></div>}
  </dialog>;
}

export function ArchitecturePage() {
  const [state,dispatch]=useReducer(architectureReducer,initialArchitecture);
  const [receiptOpen,setReceiptOpen]=useState(false);
  const presentButton=useRef<HTMLButtonElement>(null),receiptButton=useRef<HTMLButtonElement>(null);
  const spotlightPanel=useRef<HTMLElement>(null),hadReceiptOpen=useRef(false);
  const spotlight=components[state.component];
  const select=(component:ArchitectureComponent)=>{
    dispatch({type:'select',component});
    if(window.matchMedia('(max-width:980px)').matches) requestAnimationFrame(()=>spotlightPanel.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
  };
  const nodeClass=(id:ArchitectureComponent)=>`${state.component===id?' is-selected':''}${state.presenting&&components[id].step!==state.step?' is-dimmed':''}`;
  useEffect(()=>{const prior=document.title;document.title='Architecture | JEV Trading Terminal';return ()=>{document.title=prior;};},[]);
  useEffect(()=>{
    if(hadReceiptOpen.current&&!receiptOpen)receiptButton.current?.focus();
    hadReceiptOpen.current=receiptOpen;
  },[receiptOpen]);
  useEffect(()=>{
    if(!state.presenting||receiptOpen)return;
    const key=(event:KeyboardEvent)=>{
      if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
      if(event.key==='Escape'){dispatch({type:'exit'});presentButton.current?.focus();}
      if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();dispatch({type:event.key==='ArrowRight'?'next':'previous'});}
    };
    window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);
  },[state.presenting,receiptOpen]);
  return <div className={`arch-app${state.presenting?' arch-presenting':''}`}>
    <a className="arch-skip" href="#architecture-map">Skip to architecture</a>
    <header className="arch-header">
      <a className="arch-brand" href="/" aria-label="BNB Chain JEV Trading Terminal"><span className="arch-chain"><img src={bnbLogo} alt="BNB Chain"/> <span>BNB CHAIN</span></span><span className="arch-brand-divider" aria-hidden="true"/><span className="arch-product"><TypeSafeLogo size={38}/><b>JEV</b><span>Trading Terminal</span></span></a>
      <nav aria-label="Main navigation"><a href="/">Terminal</a><a href="/architecture" aria-current="page">Architecture</a><a className="arch-github" href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="View the public source repository"><img src={githubMark} alt=""/></a></nav>
      <button ref={presentButton} className="arch-present" aria-pressed={state.presenting} onClick={()=>dispatch({type:state.presenting?'exit':'present'})}>{state.presenting?<X size={16}/>:<Play size={16} fill="currentColor"/>}{state.presenting?'Exit walkthrough':'Present walkthrough'}</button>
    </header>
    <main>
      <section className="arch-hero" aria-labelledby="arch-title"><span className="arch-eyebrow">INSIDE THE TERMINAL</span><h1 id="arch-title">From new launch to informed action.</h1><div><p>BNB Agent Studio serves the assessment. JEV judges. Living Brain remembers.</p><small>{state.presenting?'Use ← → to present · Esc to exit':'System architecture · Paper execution only'}</small></div></section>
      <nav className="arch-steps" aria-label="Decision journey">{steps.map((step,index)=><button key={step.label} aria-current={state.step===index?'step':undefined} onClick={()=>dispatch({type:'step',step:index})}><span className="arch-step-number">{String(index+1).padStart(2,'0')}</span><span><strong>{step.label}</strong><small>{step.description}</small></span></button>)}</nav>
      <div className="arch-workspace">
        <section id="architecture-map" className="arch-map" aria-labelledby="arch-map-title"><header><h2 id="arch-map-title">Explore the engine</h2><span>Select any component</span></header>
          <div className="arch-diagram" data-step={state.step}>
            <section className="arch-inputs" aria-label="Market evidence"><h3>MARKET EVIDENCE</h3>{(['gmgn','grok','geckoterminal'] as const).map(id=><button key={id} className={`arch-source${nodeClass(id)}`} onClick={()=>select(id)} aria-pressed={state.component===id} aria-label={`Inspect ${components[id].name}`}><span className="arch-function-icon"><BrandMark id={id}/></span><span><strong>{components[id].name}</strong><small>{id==='gmgn'?<>Flap + Four.meme discovery<br/>Creator, holders, flow &amp; depth</>:id==='grok'?'Contract-matched social research':'Timestamped same-pool prices'}</small></span></button>)}</section>
            <div className={`arch-evidence-bridge arch-connection${state.step===0?' is-active':''}`} aria-hidden="true"><span>Fresh<br/>evidence</span><i/><ArrowRight size={22}/></div>
            <section className={`arch-engine${state.component==='studio'||state.component==='sdk'?' is-selected':''}`} aria-label="Core engine">
              <button className={`arch-studio${nodeClass('studio')}`} onClick={()=>select('studio')} aria-label="Inspect BNB Agent Studio" aria-pressed={state.component==='studio'}><span className="arch-core-label"><span>CORE ENGINE</span><small>Runtime integrated</small></span><strong>BNB Agent Studio</strong><span>Private assessment service</span><span>Work dispatch · deadline · delivery</span></button>
              <button className={`arch-sdk${nodeClass('sdk')}`} onClick={()=>select('sdk')} aria-label="Inspect BNB Agent SDK" aria-pressed={state.component==='sdk'}><span className="arch-sdk-heading"><strong>BNB Agent SDK</strong><small>Live signer locked</small></span><span>BNB Chain context</span><span>Unsigned intent interface</span></button>
            </section>
            <div className={`arch-to-jev arch-connection${state.step===1?' is-active':''}`} aria-hidden="true"><span>Evidence +<br/>recalled context</span><i/><ArrowRight size={22}/></div>
            <div className={`arch-from-jev arch-connection${state.step===1?' is-active':''}`} aria-hidden="true"><span>Typed judgment</span><ArrowLeft size={22}/><i/></div>
            <button className={`arch-specialist arch-jev${nodeClass('jev')}`} onClick={()=>select('jev')} aria-label="Inspect JEV by TypeSafe" aria-pressed={state.component==='jev'}><span className="arch-specialist-heading"><TypeSafeLogo size={52}/><span><strong>JEV by TypeSafe</strong><small>Context-aware typed judgment</small></span></span><span className="arch-actions"><span>BUY</span><span>SELL</span><span>HOLD</span></span></button>
            <button className={`arch-specialist arch-memory${nodeClass('memory')}`} onClick={()=>select('memory')} aria-label="Inspect Living Brain" aria-pressed={state.component==='memory'}><img src={brainLogo} alt="Living Brain"/><span><strong>Living Brain</strong><small>Recall prior episodes</small><small>Capture decisions + outcomes</small></span></button>
            <div className={`arch-recall arch-connection arch-memory-line${state.step===1||state.step===3?' is-active':''}`} aria-hidden="true"><span>Recall</span><ArrowLeft size={22}/><i/></div>
            <div className={`arch-to-paper arch-connection${state.step===2?' is-active':''}`} aria-hidden="true"><i/><span>Judgment + unsigned intent</span><ArrowDown size={22}/></div>
            <button className={`arch-paper${nodeClass('paper')}`} onClick={()=>select('paper')} aria-label="Inspect Paper policy and execution" aria-pressed={state.component==='paper'}><span className="arch-function-icon"><ShieldCheck size={29}/></span><span><strong>Paper policy + execution</strong><small>Code owns limits, sizing and fills</small></span></button>
            <div className={`arch-write arch-connection arch-memory-line${state.step===3?' is-active':''}`} aria-hidden="true"><ArrowUp size={22}/><span>Write episodes + follow-up outcomes</span><i/><small>Available to future assessments</small></div>
            <p className="arch-mobile-flow">Fresh evidence and recalled episodes inform JEV. Its judgment passes through code-owned checks; recorded outcomes return to Living Brain for later recall.</p>
          </div>
          <p className="arch-map-caption">“JEV proposes. Code gates execution. Memory preserves experience.”</p>
        </section>
        <aside ref={spotlightPanel} className="arch-spotlight" aria-label="Component spotlight"><div className="arch-spotlight-copy" aria-live="polite" aria-atomic="true"><span className="arch-eyebrow">COMPONENT SPOTLIGHT</span><h2>{(state.component==='gmgn'||state.component==='grok'||state.component==='geckoterminal'||state.component==='nodeops'||state.component==='supabase'||state.component==='nodereal')&&<BrandMark id={state.component} decorative/>}{spotlight.name}</h2><p className="arch-tagline">{spotlight.tagline}</p><dl><div><dt>ROLE</dt><dd>{spotlight.role}</dd></div><div><dt>WHY IT MATTERS</dt><dd>{spotlight.advantage}</dd></div><div><dt>IN THIS DEMO</dt><dd>{spotlight.demo}</dd></div></dl>
          {state.component==='studio'&&<section className="arch-sdk-summary"><h3>SDK foundation</h3><p>Chain context and unsigned intents keep model judgment separate from execution.</p></section>}
          <p className="arch-component-note"><Info size={19}/><span>{spotlight.note}</span></p></div>
          {state.component==='geckoterminal'&&<p className="arch-data-attribution"><a href="https://www.geckoterminal.com" target="_blank" rel="noopener noreferrer">On-chain data provided by GeckoTerminal <ArrowUpRight size={14}/></a></p>}
          <button ref={receiptButton} className="arch-receipt-link" onClick={()=>setReceiptOpen(true)}><FileText size={19}/> View assessment receipt <ArrowRight size={17}/></button>
          <div className="arch-pager"><button aria-label="Previous journey step" disabled={state.step===0} onClick={()=>dispatch({type:'previous'})}><ChevronLeft size={20}/></button><span>{state.step+1} of {steps.length}</span><button aria-label="Next journey step" disabled={state.step===3} onClick={()=>dispatch({type:'next'})}><ChevronRight size={20}/></button></div>
        </aside>
      </div>
    </main>
    <footer className="arch-infrastructure"><h2>SUPPORTING INFRASTRUCTURE</h2>{(['nodeops','supabase','nodereal'] as const).map(id=><button key={id} onClick={()=>select(id)} aria-label={`Inspect ${components[id].name}`} aria-pressed={state.component===id} className={nodeClass(id)}><BrandMark id={id}/><span><strong>{components[id].name}</strong><small>{id==='nodeops'?'Hosts the always-on worker':id==='supabase'?'Durable ledger, evidence and outcomes':'On-demand read-only chain checks'}</small></span></button>)}<p>Explore a component, or present the decision journey.</p></footer>
    {receiptOpen&&<RecordedReceipt close={()=>setReceiptOpen(false)}/>}
  </div>;
}
