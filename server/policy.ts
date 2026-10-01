import type { Action, Check, Judgment, Ledger, Position, Snapshot, XResearch } from "../src/types.js";
import { freshNarrativeMetadata } from "./narrative.js";
import { PAPER_POLICY, isLaunchPaper, paperCosts } from "../src/paper-settings.js";
export { PAPER_POLICY };
export const exposure = (ledger: Ledger) => ledger.positions.reduce((sum, p) => sum + p.costUsd, 0);
export const exposureLimit = (ledger: Ledger) => Math.min(PAPER_POLICY.maxExposureUsd, ledger.initialCashUsd * PAPER_POLICY.exposureFraction);
export const netExitUnit = (s: Snapshot) => s.priceUsd * (1 - paperCosts(s.pool).slippageBps / 10000) * (1 - paperCosts(s.pool).feeBps / 10000);
export const emptyLedger = (): Ledger => ({
  cashUsd: 2000, initialCashUsd: 2000, positions: [], fills: [], consumedDecisions: [], realizedPnlUsd: 0, dailyLoss: {},
});
export function marketExecutable(s: Snapshot, now: number) {
  // This predicate authorizes PAPER marks only. No live executor consumes it.
  if (s.source === 'gmgn-paper') {
    const q = s.launchQuote;
    return !!q && q.kind === 'launch-indicative' && q.providerAsOf === null && s.marketAt === 0 &&
      isLaunchPaper(s.pool) && s.pool === `launch:${s.token.toLowerCase()}` && q.token === s.token &&
      !/^0x0{40}$/i.test(s.token) && ['flap','fourmeme'].includes(q.platform) &&
      ['new','bonding','graduated_reported'].includes(q.stage) && Number.isFinite(s.priceUsd) && s.priceUsd > 0 &&
      Number.isFinite(now) && s.observedAt === q.observedAt &&
      Number.isFinite(q.observedAt) && q.observedAt > 0 && q.observedAt <= now && now-q.observedAt <= PAPER_POLICY.maxAgeMs;
  }
  if (isLaunchPaper(s.pool)) return false;
  if (!Number.isFinite(now) || !Number.isFinite(s.priceUsd) || s.priceUsd <= 0 ||
    ![s.marketAt, s.observedAt].every(t => Number.isFinite(t) && t > 0 && t <= now && now - t <= PAPER_POLICY.maxAgeMs)) return false;
  if (s.source === 'bitquery') return true; // Preserve historical primary-trade records.
  const e = s.tradeEvidence;
  return s.source === 'coingecko' && !!e && e.kind === 'pool-trade' && e.network === 'bsc' &&
    /^0x[0-9a-f]{40}$/i.test(e.pool) && /^0x[0-9a-f]{40}$/i.test(e.token) &&
    e.pool.toLowerCase() === s.pool.toLowerCase() && e.token.toLowerCase() === s.token.toLowerCase() &&
    e.pool.toLowerCase() !== e.token.toLowerCase() && /^0x[0-9a-f]{64}$/i.test(e.txHash) &&
    Number.isSafeInteger(e.blockNumber) && e.blockNumber > 0 &&
    [e.requestedAt, e.receivedAt].every(t => Number.isFinite(t) && t > 0 && t <= now && now-t <= PAPER_POLICY.maxAgeMs) &&
    e.requestedAt <= e.receivedAt && s.marketAt <= e.receivedAt;
}
export function buyAmount(ledger: Ledger, s: Snapshot, probe = false) {
  const tokenCost = ledger.positions.filter(p => p.token.toLowerCase() === s.token.toLowerCase()).reduce((n,p)=>n+p.costUsd,0);
  const budget = Math.min(ledger.cashUsd, (isLaunchPaper(s.pool)?PAPER_POLICY.launchMaxPositionUsd:PAPER_POLICY.maxPositionUsd)-tokenCost, exposureLimit(ledger)-exposure(ledger));
  // Round DOWN to cents so fees can never overrun a cost budget.
  return Math.max(0, Math.floor(Math.min(isLaunchPaper(s.pool)||probe?PAPER_POLICY.probeUsd:PAPER_POLICY.orderUsd, budget / (1 + paperCosts(s.pool).feeBps / 10000))*100)/100);
}
// Broader theme evidence can support a probe, but cannot masquerade as token endorsement.
export function narrativeProbe(research: XResearch, s: Snapshot, now: number) {
  const n=research.narrative, f=n?.findings, a=s.monitoring?.activity ?? s.launchQuote?.activity;
  return !!n && n.status==='ready' && !!freshNarrativeMetadata(n.metadata,s.token,now) &&
    !!f && ['fit','catalyst','timing'].every(k=>f[k as 'fit'|'catalyst'|'timing'].verdict==='supports') &&
    f.originality.verdict!=='cautions' && f.promotion.verdict!=='cautions' &&
    ['catalyst','timing'].every(k=>f[k as 'catalyst'|'timing'].evidenceIds.some(id=>{
      const index=/^T([1-9][0-9]*)$/.exec(id);
      const source=index?n.themeSources[Number(index[1])-1]:undefined;
      return !!source && source.publishedAt<=now && source.publishedAt>=research.window.from;
    })) && !!a && a.token===s.token && a.observedAt<=now && now-a.observedAt<=PAPER_POLICY.maxAgeMs &&
    !a.riskFlags.length && a.buys5m!=null && a.sells5m!=null && a.buys5m>a.sells5m &&
    (a.volume5mUsd??0)>=300 && (a.swaps5m??0)>=5;
}
export function entryLocation(s: Snapshot, now: number) {
  const e=s.entrySetup,p=PAPER_POLICY;
  if(!e || e.token!==s.token || !Number.isFinite(e.observedAt) || e.observedAt>now || now-e.observedAt>p.maxAgeMs) return false;
  const rangeFresh=e.candleTo!=null&&e.candleTo<=now&&now-e.candleTo<=p.maxAgeMs;
  const distance=rangeFresh?e.distanceFromLowPct:null;
  if(distance!=null&&distance>p.maxChasePct)return false;
  return (distance!=null&&Number.isFinite(distance)&&distance>=0&&distance<=p.nearLowPct) ||
    (e.marketCapUsd!=null&&Number.isFinite(e.marketCapUsd)&&e.marketCapUsd>=p.entryMarketCapMinUsd&&e.marketCapUsd<=p.entryMarketCapMaxUsd);
}
// Recover legacy positions from their own opening lot's recorded fills when possible.
export function restorePositionBasis(ledger: Ledger, position: Position) {
  if(position.investedUsd!=null&&position.acquiredQuantity!=null&&position.realizedProceedsUsd!=null)return;
  const fills=ledger.fills.filter(f=>f.pool===position.pool&&f.time>=position.openedAt);
  const buys=fills.filter(f=>f.side==='buy'),sells=fills.filter(f=>f.side==='sell');
  const acquired=buys.reduce((n,f)=>n+f.quantity,0), sold=sells.reduce((n,f)=>n+f.quantity,0);
  const matched=buys.length>0&&Math.abs(acquired-sold-position.quantity)<=Math.max(1e-9,position.quantity*1e-8);
  position.investedUsd=matched?buys.reduce((n,f)=>n+f.quantity*f.priceUsd+f.feeUsd,0):position.costUsd;
  position.acquiredQuantity=matched?acquired:position.quantity;
  position.realizedProceedsUsd=matched?sells.reduce((n,f)=>n+f.quantity*f.priceUsd-f.feeUsd,0):0;
  position.principalRecovered=position.realizedProceedsUsd>=position.investedUsd-1e-8;
  // Previously recorded trims used another ladder. Start this ladder from its known principal state.
  position.takeProfits=position.principalRecovered?1:0;
}
export function copycatStatus(s: Snapshot, research: XResearch, now: number): 'clear'|'supported'|'unresolved'|'conflict' {
  const n=research.narrative,f=n?.findings?.originality;
  const usable=n?.status==='ready' && !!freshNarrativeMetadata(n.metadata,s.token,now) &&
    research.token===s.token && ['ready','no_results'].includes(research.status) && research.collectedAt<=now && research.expiresAt>now;
  if(usable && f?.verdict==='cautions' && f.evidenceIds.length) return 'conflict';
  if(!(s.entrySetup?.competingTickers)) return 'clear';
  // A theme's popularity cannot establish this CA as the original or a differentiated contender.
  const tokenSupport=usable && f?.verdict==='supports' && f.evidenceIds.some(id=>{
    const index=/^X([1-9][0-9]*)$/.exec(id);
    return !!index && !!research.sources[Number(index[1])-1];
  });
  return tokenSupport ? 'supported' : 'unresolved';
}
export const needsProbe = (s: Snapshot, research: XResearch, now: number) =>
  !research.sources.length || copycatStatus(s,research,now)==='unresolved';
export interface PolicyContext {
  now: number; approved: boolean; halted: boolean; memoryReady: boolean; ledger: Ledger;
  snapshot: Snapshot; judgment: Judgment; research: XResearch;
}
export function evaluatePolicy(c: PolicyContext): {action: Action; mode:"paper"; checks:Check[]; reasons:string[]} {
  const s=c.snapshot, j=c.judgment, p=PAPER_POLICY;
  const position=c.ledger.positions.find(x=>x.pool===s.pool);
  const check=(label:string,pass:boolean,detail:string):Check=>({label,pass,detail});
  const checks = [
    check("Kill switch",!c.halted,"No execution while the stop is latched."),
    check("Fresh paper price",marketExecutable(s,c.now),"DEX: matching-pool trade. Launch paper: indicative GMGN receipt, provider price time unknown. Both receipts ≤90 seconds old."),
    check("Jev response",["buy","sell","hold"].includes(j.action) && [j.confidence,j.quality,j.toxic,...Object.values(j.probabilities)].every(Number.isFinite) &&
      j.confidence>=0 && j.confidence<=1 && j.quality>=0 && j.quality<=3 && j.toxic>=0 && j.toxic<=1,"Typed model outputs must be valid."),
  ];
  if(j.action==="buy") {
    const early=narrativeProbe(c.research,s,c.now);
    const amount=buyAmount(c.ledger,s,needsProbe(s,c.research,c.now));
    checks.push(
      check("Operator approval",c.approved,"Approved pool or freshly qualified launch in an armed paper session."),
      check("Valid market data",[s.liquidityUsd,s.volume24h,...(s.source==='gmgn-paper'?[]:[s.change1h]),s.buyCount,s.sellCount].every(Number.isFinite),"Missing entry evidence is not a zero."),
      check("Liquidity",s.liquidityUsd>=(isLaunchPaper(s.pool)?p.launchMinLiquidityUsd:p.minLiquidityUsd),"Paper entry floor: $2,000 reported launch liquidity; $5,000 DEX pool liquidity."),
      check("Entry location",!!position || entryLocation(s,c.now),"New entries need a fresh near-low observation (within 25%) or roughly $15k–$25k market cap. Reject a measured chase above 100% from the recent low."),
      check("Copycat evidence",copycatStatus(s,c.research,c.now)!=='conflict',"Same ticker alone is not a veto. Unresolved rivalry uses a $25 probe; accepted CA-linked differentiation permits normal sizing. Fresh cited copycat confusion still blocks buys."),
      check("Memory retrieval",c.memoryReady,"The configured memory provider must respond; no relevant memories is a valid cold start."),
      check("X research freshness",!!c.research && ["ready","no_results"].includes(c.research.status) && c.research.token===s.token &&
        c.research.searchCalls>0 && c.research.window.to<=c.research.collectedAt && c.research.collectedAt<=c.now &&
        c.research.window.to<=c.now && c.now-c.research.window.to<=300000 && c.research.expiresAt>c.now,"Contract-specific search receipt must be within five minutes."),
      check("Cited narrative or token context",(c.research?.status==="ready" && c.research.sources.length>0) || early,"Contract-linked source, or a $25 probe with fresh metadata, cited fit/catalyst/timing and positive fresh 5m flow. A ticker alone is insufficient."),
      check("Launch flow and flags",!s.launchQuote || (!!s.launchQuote.activity &&
        s.launchQuote.activity.observedAt<=c.now && c.now-s.launchQuote.activity.observedAt<=p.maxAgeMs &&
        !s.launchQuote.riskFlags.length && !s.launchQuote.activity.riskFlags.length &&
        (s.launchQuote.activity.volume5mUsd??0)>=300 && (s.launchQuote.activity.swaps5m??0)>=5),"Launch probes require current activity and no reported hard flags; missing data waits."),
      check("Decision confidence",j.confidence>=p.confidence,"Experimental threshold: 0.65, not a win probability."),
      check("Setup quality",j.quality>=p.minQuality,"Experimental threshold: 1.5 / 3."),
      check("Toxic narrative",j.toxic<=p.maxToxic,"Evidence risk probability at most 0.40."),
      check("Daily realized loss",(c.ledger.dailyLoss[new Date(c.now).toISOString().slice(0,10)]??0)<p.dailyLossUsd,"Pause new entries after $400 gross realized losses per UTC day; exits remain available."),
      check("Cash",c.ledger.cashUsd>=10.03,"At least $10 plus modeled fees for an entry."),
      check("Position ceiling",amount>=10,"Up to $75 per launch-paper token / $150 per DEX token including fees; final add sizes to remaining headroom."),
      check("Total exposure",exposure(c.ledger)<exposureLimit(c.ledger),"Remaining entry cost capped at $1,000 or 50% of starting capital, whichever is lower."),
      check("Portfolio slots",!!position || c.ledger.positions.length<p.maxPositions,"At most ten paper positions."),
      check("One pool per token",!c.ledger.positions.some(x=>x.token.toLowerCase()===s.token.toLowerCase() && x.pool!==s.pool),"Do not double-count a token as a new slot."),
      check("Add only to strength",!position || ((position.takeProfits??0)===0 && (position.entries??1)<3 &&
        netExitUnit(s)*position.quantity>=position.costUsd*(1+p.addGainPct/100) && c.now-(position.lastEntryAt??position.openedAt)>=p.addCooldownMs),
        "Fresh JEV BUY, +5% indicative net return and one-minute cooldown required to add. Max three entries; no averaging down or adding after a trim."),
    );
  }
  if(j.action==="sell") checks.push(check("Inventory",!!position && position.token.toLowerCase()===s.token.toLowerCase(),"Spot only: sell existing matching inventory."));
  const failures=checks.filter(x=>!x.pass).map(x=>x.label+": "+x.detail);
  return {action:failures.length?"hold":j.action,mode:"paper",checks,reasons:failures.length?failures:[j.action==="hold"?"JEV is waiting for a better setup.":"Paper policy checks passed."]};
}
export interface FillOptions {sellFraction?:number; reason?:string;probe?:boolean}
export function applyPaperFill(ledger:Ledger,s:Snapshot,side:"buy"|"sell",decisionId:string,now:number,options:FillOptions={}):Ledger {
  if(ledger.consumedDecisions.includes(decisionId)) return ledger;
  if(!Number.isFinite(s.priceUsd)||s.priceUsd<=0) throw new Error("Invalid fill price");
  const next=structuredClone(ledger),p=PAPER_POLICY,costs=paperCosts(s.pool);
  const price=s.priceUsd*(1+(side==="buy"?1:-1)*costs.slippageBps/10000);
  const position=next.positions.find(x=>x.pool===s.pool);
  if(position) restorePositionBasis(next,position);
  let quantity:number,fee:number,pnl=0;
  const fraction=options.sellFraction??1;
  if(!Number.isFinite(fraction)||fraction<=0||fraction>1) throw new Error("Invalid sell fraction");
  if(side==="buy") {
    const amount=buyAmount(next,s,options.probe);
    if(amount<10 || (!position&&next.positions.length>=p.maxPositions) ||
      next.positions.some(x=>x.token.toLowerCase()===s.token.toLowerCase()&&x.pool!==s.pool)) throw new Error("Position limit");
    if(position && ((position.takeProfits??0)>0 || (position.entries??1)>=3 ||
      netExitUnit(s)*position.quantity<position.costUsd*(1+p.addGainPct/100) || now-(position.lastEntryAt??position.openedAt)<p.addCooldownMs)) throw new Error("Add requires strength and cooldown");
    fee=amount*costs.feeBps/10000; quantity=amount/price;
    next.cashUsd-=amount+fee;
    if(position) {
      position.quantity+=quantity; position.costUsd+=amount+fee;
      position.investedUsd!+=amount+fee; position.acquiredQuantity!+=quantity;
      position.entries=(position.entries??1)+1; position.lastEntryAt=now;
      position.peakNetUnitUsd=Math.max(position.peakNetUnitUsd??0,netExitUnit(s));
    } else next.positions.push({pool:s.pool,token:s.token,name:s.name,quantity,costUsd:amount+fee,openedAt:now,investedUsd:amount+fee,acquiredQuantity:quantity,realizedProceedsUsd:0,principalRecovered:false,lastEntryAt:now,entries:1,takeProfits:0,peakNetUnitUsd:netExitUnit(s)});
  } else {
    if(!position || position.token.toLowerCase()!==s.token.toLowerCase()) throw new Error("No position to sell");
    quantity=position.quantity*fraction; fee=quantity*price*costs.feeBps/10000;
    const cost=position.costUsd*fraction;
    pnl=quantity*price-fee-cost; next.cashUsd+=quantity*price-fee; next.realizedPnlUsd+=pnl;
    position.realizedProceedsUsd!+=quantity*price-fee;
    position.principalRecovered=position.realizedProceedsUsd!>=position.investedUsd!-1e-8;
    if(fraction===1) next.positions=next.positions.filter(x=>x.pool!==s.pool);
    else {position.quantity-=quantity;position.costUsd-=cost;if(options.reason?.startsWith("take-profit")) position.takeProfits=(position.takeProfits??0)+1;}
    const day=new Date(now).toISOString().slice(0,10);
    next.dailyLoss[day]=(next.dailyLoss[day]??0)+Math.max(0,-pnl);
  }
  next.fills.unshift({priceSource:s.source,launchQuote:s.launchQuote,modeledFeeBps:costs.feeBps,modeledSlippageBps:costs.slippageBps,id:"paper-"+decisionId,decisionId,pool:s.pool,name:s.name,side,priceUsd:price,quantity,feeUsd:fee,time:now,mode:"paper",realizedPnlUsd:pnl,reason:options.reason??"jev",fraction:side==="sell"?fraction:undefined});
  next.consumedDecisions.push(decisionId); return next;
}
