import type {Launch} from "./launches.js";
import type {MonitorItem} from "./monitoring.js";
import {WATCH_POLICY as w} from "./monitoring.js";
export function huntCandidates(launches:Launch[],items:MonitorItem[],now:number) {
  const fresh=(at:number|undefined)=>at!=null&&Number.isFinite(at)&&at<=now&&now-at<=w.maxAgeMs;
  return launches.filter(l=>l.stage==="graduated_reported"&&fresh(l.observedAt)&&l.reportedGraduatedAt!=null&&
    l.reportedGraduatedAt<=now&&now-l.reportedGraduatedAt<=w.maxGraduationAgeMs).map(launch=>{
    const item=items.find(i=>i.token===launch.address);
    const a=fresh(item?.activity?.observedAt)?item?.activity:undefined;
    const numbers=[launch.liquidityUsd,launch.holders,a?.volume5mUsd,a?.swaps5m];
    const floors=[w.minLiquidityUsd,w.minHolders,w.minVolume5mUsd,w.minSwaps5m];
    const readiness=numbers.some(n=>n==null||!Number.isFinite(n)||n<0)?null:
      Math.round(numbers.reduce<number>((sum,n,i)=>sum+Math.min(1,n!/floors[i]),0)/4*100);
    return {launch,item,activity:a,readiness};
  }).sort((a,b)=>Number(!!b.item?.admission.eligible)-Number(!!a.item?.admission.eligible)||
    (b.readiness??-1)-(a.readiness??-1)||(b.activity?.volume5mUsd??0)-(a.activity?.volume5mUsd??0)).slice(0,6);
}
