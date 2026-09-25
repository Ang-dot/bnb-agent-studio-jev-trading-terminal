import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronRight, FlaskConical, Play, ShieldCheck } from "lucide-react";
import { TypeSafeLogo } from "./TypeSafeLogo.js";
import type { Decision, TerminalState } from "./types.js";
import type { Launch } from "./launches.js";
import type { MonitorState } from "./monitoring.js";
import { paperPerformance } from "./terminal-insights.js";

const usd = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("en-US", {style:"currency",currency:"USD",maximumFractionDigits:2});
const stamp = (n: number) => new Date(n).toLocaleString("en-GB", {month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"});
export function PerformanceStrip({state, launches, now, onPositions}: {state: TerminalState | null; launches: Launch[]; now: number; onPositions:()=>void}) {
  const p = state ? paperPerformance(state.ledger, launches, now) : null;
  return <section className="performance-strip" aria-label="Paper performance">
    <div className="performance-mode"><FlaskConical size={18}/><span>Paper ledger<strong>{state?.halted?"Stop latched":state?.running?"Paper hunting":"Execution paused"}</strong></span></div>
    <div><small>Marked equity</small><strong>{usd(p?.equity)}</strong><span>{p?.unmarked ? `${p.unmarked} positions lack fresh marks` : "Indicative · not exit proceeds"}</span></div>
    <div><small>Realized P&amp;L</small><strong className={p && p.realized !== 0 ? p.realized > 0 ? "signal-up" : "signal-down" : ""}>{usd(p?.realized)}</strong><span>After recorded paper costs</span></div>
    <div><small>Unrealized P&amp;L</small><strong>{usd(p?.unrealized)}</strong><span>Before exit costs</span></div>
    <div><small>Profitable sell fills</small><strong>{p?.winRate == null ? "—" : `${p.winRate.toFixed(0)}%`}</strong><span>{p ? `${p.exits} sells incl. partial trims` : "Loading ledger"}</span></div>
    <button onClick={onPositions}><small>Open positions</small><strong>{state?.ledger.positions.length ?? "—"} <ChevronRight size={15}/></strong><span>Cash {usd(p?.cash)}</span></button>
  </section>;
}

export function AgentTape({state, monitor, onRecord, onReplay, motion, disconnected}: {state: TerminalState|null; monitor: MonitorState|null; onRecord:(id:string)=>void; onReplay:()=>void; motion:boolean; disconnected:boolean}) {
  const decisions = [...(state?.decisions ?? [])].sort((a,b)=>b.time-a.time);
  const seen = useRef<Set<string> | null>(null);
  const [freshIds,setFreshIds] = useState<string[]>([]);
  const [onlyCalls,setOnlyCalls] = useState(true);
  useEffect(()=>{
    if (!state) return;
    const ids = state.decisions.map(d=>d.id);
    setFreshIds(seen.current ? ids.filter(id=>!seen.current!.has(id)) : []);
    seen.current = new Set([...(seen.current ?? []), ...ids]);
    const timer = window.setTimeout(()=>setFreshIds([]),4000);
    return ()=>window.clearTimeout(timer);
  },[state?.revision]);
  const judged = decisions.filter(d=>d.judgment);
  const actions = decisions.filter(d=>d.judgment||d.ruleExit);
  const attempts = monitor?.items.filter(i=>i.status === "assessing" || i.status === "verifying") ?? [];
  return <section className="agent-tape panel" aria-label="Agent activity across all tokens">
    <div className="section-heading"><h2><TypeSafeLogo size={22}/> Agent tape</h2><span className="count">{state ? judged.length : "—"} calls</span></div>
    <p className="agent-tape-intro">The call. The evidence. The result.</p>
    <div className="tape-stats">
      {(["buy","hold","sell"] as const).map(action=><div key={action}><strong>{state ? judged.filter(d=>d.judgment?.action===action).length : "—"}</strong><small>JEV {action}</small></div>)}
    </div>
    <div className="tape-now" role="status"><i className={`dot ${!disconnected && attempts.length ? "green" : "amber"}`}/>{disconnected ? "Connection lost · showing saved activity" : attempts.length ? `${attempts[0].symbol} · ${attempts[0].status === "assessing" ? "JEV + memory assessing" : "Resolving market data"}` : monitor?.error ? "Monitoring interrupted · check providers" : monitor?.enabled ? "Watching for the next qualified graduate" : "JEV monitoring paused"}</div>
    <div className="tape-filter" aria-label="Agent activity filter"><button aria-pressed={!onlyCalls} onClick={()=>setOnlyCalls(false)}>All events</button><button aria-pressed={onlyCalls} onClick={()=>setOnlyCalls(true)}>Calls & fills</button></div>
    <div className="tape-scroll">
      {(onlyCalls ? actions : decisions).slice(0,15).map(d=><button className={`tape-event ${motion && freshIds.includes(d.id) ? "event-pop" : ""}`} key={d.id} onClick={()=>onRecord(d.id)} aria-label={`Inspect ${d.name} decision from ${stamp(d.time)}`}>
        <div className="tape-event-title"><strong>{d.name}</strong><span className={`stance-pill ${d.ruleExit?"sell":d.judgment?.action ?? "unavailable"}`}>{d.ruleExit ? "CODE EXIT" : d.judgment ? `JEV ${d.judgment.action.toUpperCase()}` : "NOT RUN"}</span></div>
        <time>{stamp(d.time)} · {d.snapshot?.monitoring ? "Auto-watch" : "Stored inspection"}</time>
        <p>{d.judgment ? `${(d.judgment.confidence*100).toFixed(0)}% model confidence · ${d.judgment.quality.toFixed(1)}/3 quality` : d.reasons[0] || "No successful model response"}</p>
        <div className="tape-provenance"><span>{d.research?.sources.length ?? 0} X sources</span><span>{d.memories.length} memories</span></div>
        {d.fill&&<div className="tape-fill"><strong>{d.fill.side.toUpperCase()} {usd(d.fill.priceUsd*d.fill.quantity)}</strong><span>{d.fill.side==="sell"?`Realized ${usd(d.fill.realizedPnlUsd)} · ${Math.round((d.fill.fraction??1)*100)}% sold`:"Starter / add · simulated"}</span></div>}
        <div className="tape-result"><ShieldCheck size={12}/>{d.status === "executed" ? "Paper fill recorded" : d.judgment ? "No fill · inspect code policy" : "Evidence incomplete · no fill"}<ArrowUpRight size={13}/></div>
      </button>)}
      {!(onlyCalls ? actions : decisions).length && <p className="tape-empty">{state ? "No recorded assessments in this view. A quiet market is not a model decision." : "Loading stored activity…"}</p>}
    </div>
    <div className="replay-invite"><span className="eyebrow">SEE JEV IN ACTION</span><strong>Watch the calls unfold.</strong><p>Saved historical candles + genuine model responses. Separate from live activity and paper P&amp;L.</p><button onClick={onReplay}><Play size={14}/> Open decision replay <ArrowUpRight size={14}/></button></div>
    <p className="tape-footnote">Confidence is not a win probability. Counts cover stored records, not all market activity.</p>
  </section>;
}
