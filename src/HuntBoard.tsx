import {Crosshair,Flame,ArrowUpRight,BrainCircuit,Clock3} from "lucide-react";
import type {Launch} from "./launches.js";
import type {MonitorState} from "./monitoring.js";
import type {TerminalState} from "./types.js";
import {huntCandidates} from "./hunt.js";
import {PAPER_POLICY as p} from "./paper-settings.js";
import "./hunt.css";
const usd=(n:number|null|undefined)=>n==null?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:1}).format(n);
export function HuntBoard({launches,monitor,state,now,onSelect,motion}:{launches:Launch[];monitor:MonitorState|null;state:TerminalState|null;now:number;onSelect:(token:string)=>void;motion:boolean}) {
  const candidates=huntCandidates(launches,monitor?.items??[],now);
  const exposure=state?.ledger.positions.reduce((n,p)=>n+p.costUsd,0)??0;
  const qualified=candidates.filter(c=>c.item?.admission.eligible&&c.readiness!=null).length;
  return <section className={"hunt-board "+(motion?"":"motion-off")} aria-label="Launch hunt">
    <div className="hunt-heading"><div><span className="hunt-eyebrow"><Crosshair size={15}/> THE HUNT · FLAP + FOUR.MEME</span><h2>Early probes. Principal out. Room for runners.</h2></div>
      <div className="hunt-budget"><strong>{state?.ledger.positions.length??"—"} / {p.maxPositions} slots</strong><span>{state?usd(exposure):"—"} / {usd(p.maxExposureUsd)} deployed cost</span></div></div>
    <div className="hunt-playbook"><span><b>$25 / $50</b> probe / starter</span><span><b>$150</b> / token</span><span><b>2×</b> recover principal</span><span><b>3× / 4×</b> trim 15% original</span><span><b>25%</b> runner trail</span><span><b>−20%</b> stop trigger</span></div>
    <div className="hunt-subheading"><strong><Flame size={15}/>{qualified?"On JEV’s radar":"Next to qualify"}</strong><span>Scout readiness · not a buy probability</span></div>
    <div className="hunt-candidates">
      {candidates.slice(0,3).map(({launch:l,item,activity:a,readiness})=><button key={l.address} className="hunt-candidate" onClick={()=>onSelect(l.address)}>
        <div className="hunt-token"><strong>{l.symbol}</strong><span className={item?.admission.eligible?"hunt-qualified":""}>{item?.status==="assessing"?"JEV assessing":item?.admission.eligible?"In the queue":"Building activity"}<ArrowUpRight size={13}/></span></div>
        <div className="hunt-numbers"><span>5m volume<b>{usd(a?.volume5mUsd)}</b></span><span>5m swaps<b>{a?.swaps5m??"—"}</b></span><span>Liquidity<b>{usd(l.liquidityUsd)}</b></span></div>
        <div className="hunt-meter"><span style={{width:(readiness??0)+"%"}}/></div>
        <small>{readiness==null?<><Clock3 size={12}/>Awaiting fresh activity coverage</>:item?.admission.eligible?<><BrainCircuit size={12}/>{item.status==="monitoring"?"JEV "+item.modelAction?.toUpperCase()+" · rechecks automatically":item.status==="blocked"||item.status==="error"?item.detail:"Liquidity + holders + activity qualified"}</>:<>{readiness}% of numeric scout thresholds · {item?.admission.checks.find(c=>!c.pass)?.label??"Awaiting screening"}</>}</small>
      </button>)}
      {!candidates.length&&<div className="hunt-empty">Watching new, bonding and graduated launches for an early narrative setup.</div>}
    </div>
    <p className="hunt-note">Experimental paper playbook. Stops and trims use fresh observed prices, not guaranteed exits. JEV selects entries; code manages size and exits.</p>
  </section>;
}
