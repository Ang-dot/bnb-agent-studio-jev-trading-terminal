import type {Launch} from "./launches.js";
import type {Position} from "./types.js";
import {PAPER_POLICY as p} from "./paper-settings.js";
const usd=(n:number)=>n.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2});
export function PositionBook({positions,launches,now,running,onSelect}:{positions:Position[];launches:Launch[];now:number;running:boolean;onSelect:(token:string)=>void}) {
  return <div className="position-book">{positions.map(position=>{
    const mark=launches.find(l=>l.address.toLowerCase()===position.token.toLowerCase());
    const fresh=!!mark&&mark.observedAt<=now&&now-mark.observedAt<=90000&&mark.priceUsd!=null&&Number.isFinite(mark.priceUsd)&&mark.priceUsd>0;
    const pnl=fresh?position.quantity*mark!.priceUsd!*(1-p.slippageBps/10000)*(1-p.feeBps/10000)-position.costUsd:null;
    const pct=pnl==null?null:pnl/position.costUsd*100,trims=position.takeProfits??0;
    return <button className="position-card" key={position.pool} onClick={()=>onSelect(position.token)}>
      <div><strong>{position.name}</strong><span>{trims?"Runner":"Starter / building"} · {running?"Exits armed":"Exits paused"}</span></div>
      <div className={pnl!=null&&pnl>=0?"signal-up":"signal-down"}><strong>{pnl==null?"—":usd(pnl)}</strong><span>{pct==null?"Fresh mark unavailable":(pct>=0?"+":"")+pct.toFixed(1)+"% indicative net"}</span></div>
      <div className="position-plan"><span className={trims>0?"done":""}>TP1 +50% · half {trims>0?"sold":""}</span><span className={trims>1?"done":""}>TP2 +100% · half again {trims>1?"sold":""}</span><span>{trims?"25% trailing remainder":"−25% stop trigger"}</span></div>
      <small>{usd(position.costUsd)} remaining cost · GMGN indicative mark; tax, gas and API costs excluded</small>
    </button>;
  })}</div>;
}
