import { describe, expect, it } from "vitest";
import { paperPerformance, initialFocus, decisionMarker, forwardObservation } from "./terminal-insights.js";
import type { Launch } from "./launches.js";
import type { Decision, Ledger, Candle } from "./types.js";

const now = 1_000_000;
const launch = (address: string, extra: Partial<Launch> = {}): Launch => ({
  id: address, address, symbol: address, name: address, platform: "flap", stage: "new",
  observedAt: now, firstSeenAt: now, createdAt: now, reportedGraduatedAt: null,
  priceUsd: 2, liquidityUsd: 100, marketCapUsd: 200, volume24h: null, progress: null,
  holders: 2, top10: null, logo: null, quote: null, riskFlags: [], ...extra,
});
const ledger: Ledger = { cashUsd: 900, initialCashUsd: 1000, positions: [], fills: [],
  consumedDecisions: [], realizedPnlUsd: 0, dailyLoss: {} };

describe("honest terminal summaries", () => {
  it("does not invent an equity mark or win rate without evidence", () => {
    const position = { pool: "p", token: "a", name: "a", quantity: 50, costUsd: 100, openedAt: 1 };
    expect(paperPerformance({ ...ledger, positions: [position] }, [], now)).toMatchObject({ equity: null, unrealized: null, winRate: null, unmarked: 1 });
    expect(paperPerformance({ ...ledger, positions: [position] }, [launch("a", { observedAt: now - 90_001 })], now).equity).toBeNull();
    expect(paperPerformance({ ...ledger, positions: [position] }, [launch("a", { priceUsd: 3 })], now)).toMatchObject({ equity: 1050, unrealized: 50 });
  });
  it("uses stored net realized P&L and sell outcomes, without counting buys as wins", () => {
    const fill = { id: "f", decisionId: "d", pool: "p", name: "a", priceUsd: 2, quantity: 1, feeUsd: 1, time: now, mode: "paper" as const, realizedPnlUsd: 0 };
    expect(paperPerformance({ ...ledger, realizedPnlUsd: 4, fills: [{ ...fill, side: "buy" }, { ...fill, id: "s", side: "sell", realizedPnlUsd: 4 }] }, [], now)).toMatchObject({ realized: 4, fees: 2, winRate: 100, exits: 1 });
  });
  it("opens a fresh graduate before a random creation, never a stale high-cap winner", () => {
    expect(initialFocus([launch("new"), launch("stale", { stage: "graduated_reported", observedAt: 1 }), launch("graduate", { stage: "graduated_reported", reportedGraduatedAt: now - 10 })], [], now)).toBe("graduate");
  });
  it("does not relabel a blocked JEV buy as a model hold on the chart", () => {
    const d = { action: "hold", status: "held", judgment: { action: "buy" } } as Decision;
    expect(decisionMarker(d).text).toBe("JEV BUY · no fill");
    expect(decisionMarker({ ...d, status: "not_evaluated", judgment: undefined }).text).toBe("Not evaluated");
  });
});

describe("retrospective price outcome, not a trade", () => {
  const c = (time: number, close: number): Candle => ({time, open:close, high:close, low:close, close, volume:0});
  it("requires the exact closed +15m candle, never leaks an unfinished or later bar", () => {
    expect(forwardObservation([c(0, 10), c(900, 12)], 300_000)?.returnPct).toBeCloseTo(20);
    expect(forwardObservation([c(0, 10), c(900, 12)], 300_000)).toMatchObject({ from: 300_000, to: 1_200_000 });
    expect(forwardObservation([c(0, 10), c(1200, 15)], 300_000)).toBeNull();
    expect(forwardObservation([c(0, 0), c(900, 12)], 300_000)).toBeNull();
  });
});
