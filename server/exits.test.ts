import {describe,it,expect} from "vitest";
import {paperExit} from "./exits.js";
import {applyPaperFill,emptyLedger,netExitUnit,restorePositionBasis} from "./policy.js";
import type {Snapshot} from "../src/types.js";
const now=1790000000000;
const s={pool:"pool",token:"token",name:"fixture",priceUsd:1,source:"bitquery",marketAt:now,observedAt:now,candleId:"1"} as Snapshot;
const entry=()=>applyPaperFill(emptyLedger(),s,"buy","entry",now);
describe("principal recovery and runner exits",()=>{
  it("recovers exact invested principal after fees at 2x, then trims 15% of original at 3x and 4x",()=>{
    let ledger=entry();const initial=structuredClone(ledger.positions[0]);
    expect(paperExit(initial,{...s,priceUsd:1.6},now)).toBeNull();
    const doubled={...s,priceUsd:2.2};
    const first=paperExit(initial,doubled,now)!;
    expect(first.reason).toBe('take-profit-1-principal');
    expect(first.sellFraction).toBeLessThan(.5);
    ledger=applyPaperFill(ledger,doubled,'sell','principal',now,first);
    expect(ledger.positions[0].realizedProceedsUsd).toBeCloseTo(initial.investedUsd!,10);
    expect(ledger.cashUsd).toBeCloseTo(2000,10);
    expect(ledger.positions[0].principalRecovered).toBe(true);
    expect(paperExit(ledger.positions[0],doubled,now)).toBeNull();
    const triple={...s,priceUsd:3.2},second=paperExit(ledger.positions[0],triple,now)!;
    expect(second.reason).toBe('take-profit-2');
    ledger=applyPaperFill(ledger,triple,'sell','trim2',now,second);
    expect(ledger.fills[0].quantity).toBeCloseTo(initial.quantity*.15,10);
    expect(paperExit(ledger.positions[0],triple,now)).toBeNull();
    const fourth={...s,priceUsd:4.2},third=paperExit(ledger.positions[0],fourth,now)!;
    ledger=applyPaperFill(ledger,fourth,'sell','trim3',now,third);
    expect(ledger.fills[0].quantity).toBeCloseTo(initial.quantity*.15,10);
    expect(ledger.positions[0].takeProfits).toBe(3);
    expect(paperExit(ledger.positions[0],fourth,now)).toBeNull();
    expect(paperExit({...ledger.positions[0],peakNetUnitUsd:5},triple,now)?.reason).toBe('trailing-stop');
  });
  it('keeps profitable runners and rotates only losing, sell-dominated old positions',()=>{
    const p=entry().positions[0],later=now+16*60000;
    const fresh={...s,observedAt:later,marketAt:later,buyCount:5,sellCount:10};
    expect(paperExit(p,{...fresh,priceUsd:.95},later)?.reason).toBe('weak-position-rotation');
    expect(paperExit(p,{...fresh,priceUsd:1.4},later)).toBeNull();
    expect(paperExit(p,{...fresh,priceUsd:.95,buyCount:20},later)).toBeNull();
    expect(paperExit(p,{...fresh,priceUsd:.7},later)?.reason).toBe('stop-loss');
  });
  it('does not re-sell recovered capital after restart and restores old lot accounting from fills',()=>{
    let ledger=entry();const initial=ledger.positions[0].investedUsd!;
    const price={...s,priceUsd:2.2};
    ledger=applyPaperFill(ledger,price,'sell','p',now,paperExit(ledger.positions[0],price,now)!);
    ledger=JSON.parse(JSON.stringify(ledger));
    delete ledger.positions[0].investedUsd;delete ledger.positions[0].acquiredQuantity;delete ledger.positions[0].realizedProceedsUsd;
    restorePositionBasis(ledger,ledger.positions[0]);
    expect(ledger.positions[0].investedUsd).toBeCloseTo(initial);
    expect(ledger.positions[0].principalRecovered).toBe(true);
    expect(paperExit(ledger.positions[0],price,now)).toBeNull();
  });
  it('uses all adds in the original cost and quantity basis',()=>{
    let ledger=entry();ledger=applyPaperFill(ledger,{...s,priceUsd:1.3},'buy','add',now+60000);
    const p=ledger.positions[0],snap={...s,priceUsd:3,observedAt:now+60000,marketAt:now+60000};
    const exit=paperExit(p,snap,now+60000)!;
    expect(netExitUnit(snap)*p.quantity*exit.sellFraction).toBeCloseTo(p.investedUsd!);
  });
  it("never exits on stale, future, chart-only or mismatched price data",()=>{
    for(const patch of [{marketAt:now-90001},{observedAt:now+1},{source:"geckoterminal"},{priceUsd:NaN},{token:"other"}])
      expect(paperExit(entry().positions[0],{...s,priceUsd:0.5,...patch} as Snapshot,now)).toBeNull();
  });
});
