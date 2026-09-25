import {describe,it,expect} from "vitest";
import {paperExit} from "./exits.js";
import {applyPaperFill,emptyLedger} from "./policy.js";
import type {Snapshot} from "../src/types.js";
const now=1790000000000;
const s={pool:"pool",token:"token",name:"fixture",priceUsd:1,source:"bitquery",marketAt:now,observedAt:now,candleId:"1"} as Snapshot;
const entry=()=>applyPaperFill(emptyLedger(),s,"buy","entry",now).positions[0];
describe("deterministic paper exit plan",()=>{
  it("cuts at -25%, trims at +50% and +100%, then trails the runner",()=>{
    const p=entry();
    expect(paperExit(p,{...s,priceUsd:0.7},now)?.reason).toBe("stop-loss");
    expect(paperExit(p,{...s,priceUsd:1.6},now)).toMatchObject({reason:"take-profit-1",sellFraction:0.5});
    expect(paperExit({...p,takeProfits:1},{...s,priceUsd:2.2},now)).toMatchObject({reason:"take-profit-2",sellFraction:0.5});
    expect(paperExit({...p,takeProfits:2,peakNetUnitUsd:3},{...s,priceUsd:2.1},now)?.reason).toBe("trailing-stop");
  });
  it("never exits on stale, future, chart-only or mismatched price data",()=>{
    for(const patch of [{marketAt:now-90001},{observedAt:now+1},{source:"geckoterminal"},{priceUsd:NaN},{token:"other"}]) {
      expect(paperExit(entry(),{...s,priceUsd:0.5,...patch} as Snapshot,now)).toBeNull();
    }
  });
  it("does not repeatedly trim the same threshold",()=>{
    const bought=applyPaperFill(emptyLedger(),s,"buy","entry",now);
    const once=applyPaperFill(bought,{...s,priceUsd:1.6},"sell","trim",now,{sellFraction:0.5,reason:"take-profit-1"});
    expect(paperExit(once.positions[0],{...s,priceUsd:1.6},now)).toBeNull();
  });
});
