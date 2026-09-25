import { describe, it, expect } from "vitest";
import { setEmptyPaperCapital } from "./capital.js";
import { initialState } from "./store.js";
describe("explicit empty-ledger capital change", () => {
  it("changes only cash and initial cash, preserving decisions and controls", () => {
    const state = initialState();
    state.ledger.cashUsd = state.ledger.initialCashUsd = 10000;
    state.halted = true;
    state.lastCycleAt = 123;
    state.decisions = [{ id: "existing" }] as any;
    setEmptyPaperCapital(state, 2000);
    expect(state.ledger.cashUsd).toBe(2000);
    expect(state.ledger.initialCashUsd).toBe(2000);
    expect(state.decisions).toEqual([{ id: "existing" }]);
    expect(state.halted).toBe(true);
    expect(state.lastCycleAt).toBe(123);
  });
  it.each(["fills", "positions", "consumedDecisions"] as const)("refuses to reset a ledger with %s", key => {
    const state = initialState();
    (state.ledger[key] as unknown[]).push({});
    expect(() => setEmptyPaperCapital(state, 2000)).toThrow("empty");
  });
  it("refuses active trading, changed cash, P&L, losses and invalid capital", () => {
    for (const mutate of [
      (s: ReturnType<typeof initialState>) => { s.running = true; },
      (s: ReturnType<typeof initialState>) => { s.ledger.cashUsd -= 1; },
      (s: ReturnType<typeof initialState>) => { s.ledger.realizedPnlUsd = 1; },
      (s: ReturnType<typeof initialState>) => { s.ledger.dailyLoss = { today: 1 }; },
    ]) { const s = initialState(); mutate(s); expect(() => setEmptyPaperCapital(s, 2000)).toThrow(); }
    for (const n of [0, -1, NaN, Infinity]) expect(() => setEmptyPaperCapital(initialState(), n)).toThrow();
  });
});
