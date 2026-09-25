import type {Position,Snapshot} from "../src/types.js";
import {marketExecutable,netExitUnit,PAPER_POLICY} from "./policy.js";
export function paperExit(position:Position,s:Snapshot,now:number):{reason:string;sellFraction:number}|null {
  if(!marketExecutable(s,now)||position.pool!==s.pool||position.token.toLowerCase()!==s.token.toLowerCase() ||
    !Number.isFinite(position.quantity)||position.quantity<=0||!Number.isFinite(position.costUsd)||position.costUsd<=0) return null;
  const net=netExitUnit(s),gain=(net*position.quantity/position.costUsd-1)*100,p=PAPER_POLICY;
  const trims=position.takeProfits??0;
  if(gain<=-p.stopLossPct) return {reason:"stop-loss",sellFraction:1};
  if(trims>0&&net<=(position.peakNetUnitUsd??net)*(1-p.trailingPct/100)) return {reason:"trailing-stop",sellFraction:1};
  if(trims===0&&gain>=p.firstTakeProfitPct) return {reason:"take-profit-1",sellFraction:0.5};
  if(trims===1&&gain>=p.secondTakeProfitPct) return {reason:"take-profit-2",sellFraction:0.5};
  return null;
}
