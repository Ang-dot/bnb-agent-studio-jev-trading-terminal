import { describe, expect, it } from "vitest";
import { currentActivity, decisionAction, groupDecisions, memoryPhases, tokenForDecision, chartRecords, recentlyAssessedToken, xRecoveredAt, marketCapForToken } from "./trading-view.js";
import type { Launch } from "./launches.js";
import type { Decision, TerminalState } from "./types.js";

const decision = (id: string, extra: Partial<Decision> = {}): Decision => ({
  id, time: 100_000, pool: "pool", name: "Test / WBNB", action: "hold", status: "held", reasons: [], memories: [], memoryStatus: "Connected · cold start (no relevant memories)", checks: [],
  judgment: { action: "hold", confidence: .8, probabilities: { buy: .1, sell: .1, hold: .8 }, quality: 2, toxic: .1, model: "jev", requestId: id, costUsd: 0 }, ...extra,
});
const state = (d: Decision): TerminalState => ({ running: true, halted: false, busy: false, decisions: [d] } as TerminalState);

describe("truthful trading presentation", () => {
  it('shows market cap for the exact selected token and labels recorded fallback without substituting for missing feed data',()=>{
    const launch={address:'0xabc',marketCapUsd:20000,observedAt:100000} as Launch;
    const recorded=decision('cap',{snapshot:{token:'0xabc',entrySetup:{token:'0xabc',marketCapUsd:18000,observedAt:90000}} as any});
    expect(marketCapForToken('0xABC',launch,recorded)).toEqual({value:20000,observedAt:100000,recorded:false});
    expect(marketCapForToken('0xabc',undefined,recorded)).toEqual({value:18000,observedAt:90000,recorded:true});
    expect(marketCapForToken('0xabc',{...launch,marketCapUsd:null},recorded).value).toBeNull();
    expect(marketCapForToken('0xdef',launch,recorded).value).toBeNull();
    expect(marketCapForToken('0xabc',{...launch,marketCapUsd:NaN}).value).toBeNull();
  });

  it("marks a historical X skip recovered only from a later successful search for the same pool", () => {
    const failed=decision("old",{status:"not_evaluated",judgment:undefined,reasons:["X search unavailable"]});
    const recovered=decision("new",{time:200000,research:{status:"no_results",collectedAt:190000,token:"token"} as any});
    expect(xRecoveredAt(failed,[recovered])).toBe(190000);
    expect(xRecoveredAt(failed,[{...recovered,pool:"different"}])).toBeNull();
    expect(xRecoveredAt(failed,[{...recovered,research:{...recovered.research!,status:"error"}}])).toBeNull();
  });
  it("does not present an old model action as current", () => {
    expect(currentActivity(state(decision("old")), null, 400_000).title).toBe("Watching early launches");
    expect(currentActivity(state(decision("fresh")), null, 110_000).title).toBe("JEV selected HOLD");
  });
  it("labels deterministic exits separately from JEV", () => {
    expect(decisionAction(decision("exit", { ruleExit: "take-profit-1", action: "sell", status: "executed", judgment: undefined, fill: { fraction: .5 } as Decision["fill"] }))).toEqual({ label: "TRIM 50%", tone: "sell", source: "Code exit" });
  });
  it("only groups consecutive identical holds and preserves changes / fills", () => {
    const same = decision("a"), next = decision("b", { time: 99_000 });
    expect(groupDecisions([same, next])[0].records).toHaveLength(2);
    expect(groupDecisions([same, decision("different", { pool: "other" }), next])).toHaveLength(3);
    expect(groupDecisions([same, decision("captured", { memoryCapture: "compiling · source" }), next])).toHaveLength(3);
    expect(groupDecisions([same, decision("filled", { status: "executed" }), next])).toHaveLength(3);
  });
  it("does not claim an asynchronous memory capture is compiled", () => {
    expect(memoryPhases(decision("a", { memoryCapture: "compiling · source-id" })).capture).toBe("compiling");
    expect(memoryPhases(decision("b" )).recall).toBe("cold start");
    expect(memoryPhases(undefined).capture).toBe("not reached");
    expect(memoryPhases(decision("c", { memoryCapture: "failed · API" })).capture).toBe("failed");
    expect(memoryPhases(decision("d", { memoryCapture: "pending · source-id" })).capture).toBe("queued");
    expect(memoryPhases(decision("e", { memoryCapture: "completed · source-id" })).capture).toBe("completed");
  });
  it("resolves a decision by exact token or known pool, never by symbol", () => {
    expect(tokenForDecision(decision("a"), [{ address: "pool", token: "0xABC" }] as TerminalState["pools"])).toBe("0xabc");
    expect(tokenForDecision(decision("a"), [])).toBeNull();
  });
  it("keeps fills and one focal model assessment without colliding HOLD labels", () => {
    const newest = decision("new", { time: 120_000 }), selected = decision("selected"), old = decision("old", { time: 80_000 }), fill = decision("fill", { time: 70_000, status: "executed" });
    expect(chartRecords([newest, selected, old, fill], "selected").map(d => d.id)).toEqual(["selected", "fill"]);
    expect(chartRecords([newest, selected, old, fill]).map(d => d.id)).toEqual(["new", "fill"]);
  });
  it("opens a recent genuine assessment only when its token is still in the fresh feed", () => {
    const d = decision("a"), pools = [{ address: "pool", token: "0xabc" }] as TerminalState["pools"];
    const launches = [{ address: "0xabc", observedAt: 100_000 }] as Launch[];
    expect(recentlyAssessedToken([d], pools, launches, 110_000)).toBe("0xabc");
    expect(recentlyAssessedToken([d], pools, launches, 3_800_000)).toBeNull();
    expect(recentlyAssessedToken([d], pools, [], 110_000)).toBeNull();
  });
});
