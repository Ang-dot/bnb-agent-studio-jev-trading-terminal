import type {Position,Snapshot} from "../src/types.js";
import {marketExecutable,netExitUnit,PAPER_POLICY} from "./policy.js";
export function paperExit(position:Position,s:Snapshot,now:number):{reason:string;sellFraction:number}|null {
  if(!marketExecutable(s,now)||position.pool!==s.pool||position.token.toLowerCase()!==s.token.toLowerCase() ||
    !Number.isFinite(position.quantity)||position.quantity<=0||!Number.isFinite(position.costUsd)||position.costUsd<=0) return null;
  const net=netExitUnit(s),p=PAPER_POLICY;
  const invested=position.investedUsd??position.costUsd,acquired=position.acquiredQuantity??position.quantity;
  const proceeds=position.realizedProceedsUsd??0;
  const gain=(net/(invested/acquired)-1)*100;
  const trims=position.takeProfits??0;
  if(gain<=-p.stopLossPct) return {reason:"stop-loss",sellFraction:1};
  if(position.principalRecovered&&net<=(position.peakNetUnitUsd??net)*(1-p.trailingPct/100)) return {reason:"trailing-stop",sellFraction:1};
  if(!position.principalRecovered&&gain>=p.firstTakeProfitPct) {
    const fraction=Math.min(1,Math.max(0,invested-proceeds)/(net*position.quantity));
    if(fraction>0)return {reason:"take-profit-1-principal",sellFraction:fraction};
  }
  // 15% is explicitly interpreted as original acquired tokens, not the shrinking remainder.
  const runnerFraction=Math.min(1,p.runnerTrimOriginalFraction*acquired/position.quantity);
  if(position.principalRecovered&&trims<=1&&gain>=p.secondTakeProfitPct) return {reason:"take-profit-2",sellFraction:runnerFraction};
  if(position.principalRecovered&&trims===2&&gain>=p.thirdTakeProfitPct) return {reason:"take-profit-3",sellFraction:runnerFraction};
  if(!position.principalRecovered&&now-position.openedAt>=p.rotationAfterMs && gain<=0 && s.buyCount!=null && s.sellCount!=null &&
    s.sellCount>s.buyCount && (!s.launchQuote || (s.launchQuote.activity && s.launchQuote.activity.observedAt<=now&&now-s.launchQuote.activity.observedAt<=p.maxAgeMs)))
    return {reason:"weak-position-rotation",sellFraction:1};
  return null;
}
