import { describe, it, expect } from "vitest";
import { evaluatePolicy, applyPaperFill, emptyLedger, PAPER_POLICY } from "./policy.js";
import type { Snapshot, Judgment, XResearch } from "../src/types.js";
const now = Date.parse("2026-09-25T10:00:00Z");
const snapshot: Snapshot = {
  pool: "0x" + "1".repeat(40),
  token: "0x" + "2".repeat(40),
  name: "TEST / WBNB",
  priceUsd: 1,
  liquidityUsd: 200000,
  volume24h: 800000,
  change1h: 4,
  buyCount: 100,
  sellCount: 40,
  observedAt: now,
  marketAt: now - 1000,
  source: "bitquery",
  candleId: "bar-1",
};
const judgment: Judgment = {
  action: "buy",
  confidence: 0.9,
  probabilities: { buy: 0.9, sell: 0.03, hold: 0.07 },
  quality: 2.7,
  toxic: 0.1,
  model: "typesafe/jev-1.13",
  requestId: "test",
  costUsd: 0,
};
const context = {
  now,
  approved: true,
  halted: false,
  memoryReady: true,
  ledger: emptyLedger(),
  snapshot,
  judgment,
  research: {
    token: snapshot.token, status: "ready", detail: "Fixture", model: "fixture",
    window: { from: now - 86400000, to: now }, collectedAt: now, expiresAt: now + 300000,
    searchCalls: 1, rejectedCount: 0,
    sources: [{ url: "https://x.com/fixture/status/2103362829185974272", postId: "2103362829185974272", handle: "fixture", publishedAt: now - 1000,
      timestampSource: "post-id", summary: "Fixture", identityExcerpt: snapshot.token }],
  } satisfies XResearch,
};
describe("paper execution policy", () => {
  it("uses six small positions and an aggregate cost budget", () => {
    expect(PAPER_POLICY).toMatchObject({orderUsd:50,maxPositionUsd:150,maxPositions:6,maxExposureUsd:600,minLiquidityUsd:20000});
    const first = applyPaperFill(emptyLedger(), snapshot, "buy", "starter", now);
    expect(first.cashUsd).toBeCloseTo(1949.85);
    const full = {...emptyLedger(), positions:[{pool:"other",token:"other",name:"OTHER",quantity:600,costUsd:600,openedAt:now}]};
    expect(evaluatePolicy({...context,ledger:full}).action).toBe("hold");
    expect(()=>applyPaperFill(full,snapshot,"buy","over-budget",now)).toThrow();
  });
  it("allows exits when entry-only research, liquidity and daily loss checks fail", () => {
    const ledger = applyPaperFill(emptyLedger(),snapshot,"buy","entry",now);
    ledger.dailyLoss[new Date(now).toISOString().slice(0,10)] = 250;
    const result = evaluatePolicy({...context,ledger,approved:false,memoryReady:false,
      snapshot:{...snapshot,liquidityUsd:500},
      research:{...context.research,status:"error"},
      judgment:{...judgment,action:"sell",confidence:0.6,quality:0,toxic:1}});
    expect(result.action).toBe("sell");
    expect(evaluatePolicy({...context,ledger,halted:true,judgment:{...judgment,action:"sell"}}).action).toBe("hold");
  });
  it("supports idempotent partial exits with proportional cost basis", () => {
    const ledger = applyPaperFill(emptyLedger(),snapshot,"buy","entry",now);
    const next = applyPaperFill(ledger,{...snapshot,priceUsd:2},"sell","trim",now+1,{sellFraction:0.5,reason:"take-profit-1"});
    expect(next.positions[0].quantity).toBeCloseTo(ledger.positions[0].quantity/2);
    expect(next.positions[0].costUsd).toBeCloseTo(25.075);
    expect(next.fills[0].reason).toBe("take-profit-1");
    expect(next.fills[0].realizedPnlUsd).toBeCloseTo(next.fills[0].quantity*next.fills[0].priceUsd-next.fills[0].feeUsd-25.075);
    expect(applyPaperFill(next,snapshot,"sell","trim",now+2,{sellFraction:0.5})).toEqual(next);
  });
  it("sizes the final add to fee-inclusive headroom and never averages down",()=>{
    const first=applyPaperFill(emptyLedger(),snapshot,"buy","1",now);
    expect(()=>applyPaperFill(first,snapshot,"buy","bad-add",now+120000)).toThrow("strength");
    const second=applyPaperFill(first,{...snapshot,priceUsd:1.3},"buy","2",now+120000);
    const third=applyPaperFill(second,{...snapshot,priceUsd:1.6},"buy","3",now+240000);
    expect(third.positions[0].costUsd).toBeLessThanOrEqual(150);
    expect(third.positions[0].costUsd).toBeGreaterThan(149.98);
    expect(()=>applyPaperFill(third,{...snapshot,priceUsd:2},"buy","4",now+360000)).toThrow();
  });
  it("limits six distinct tokens and blocks another pool for the same token",()=>{
    let ledger=emptyLedger();
    for(let i=0;i<6;i++) ledger=applyPaperFill(ledger,{...snapshot,pool:"p"+i,token:"t"+i},"buy","e"+i,now);
    expect(()=>applyPaperFill(ledger,snapshot,"buy","seventh",now)).toThrow();
    const one=applyPaperFill(emptyLedger(),snapshot,"buy","one",now);
    expect(()=>applyPaperFill(one,{...snapshot,pool:"another-pool"},"buy","duplicate-token",now)).toThrow();
  });
  it("starts a new launch-trading paper ledger with $2,000", () => {
    expect(emptyLedger()).toMatchObject({ cashUsd: 2000, initialCashUsd: 2000, fills: [], positions: [] });
  });
  it("allows a qualified paper buy, never a live execution", () => {
    const result = evaluatePolicy(context);
    expect(result.action).toBe("buy");
    expect(result.mode).toBe("paper");
    expect(result.checks.some(c => c.label === "Token security")).toBe(false);
  });
  it.each([
    "approved",
    "memoryReady",
  ] as const)("fails closed when %s is false", (key) => {
    expect(evaluatePolicy({ ...context, [key]: false }).action).toBe("hold");
  });
  it("rejects stale or future-dated state", () => {
    for (const marketAt of [now - 180000, now + 1000])
      expect(
        evaluatePolicy({ ...context, snapshot: { ...snapshot, marketAt } })
          .action,
      ).toBe("hold");
  });
  it("rejects expired, future, wrong-contract and unverified X research", () => {
    for (const patch of [{ expiresAt: now - 1 }, { collectedAt: now + 1 }, { token: "different" }, { status: "unverified" as const }, { window: { from: now - 86400000, to: now - 300001 } }]) {
      expect(evaluatePolicy({ ...context, research: { ...context.research, ...patch } }).action).toBe("hold");
    }
  });
  it("holds on kill switch and non-finite numeric inputs", () => {
    expect(evaluatePolicy({ ...context, halted: true }).action).toBe("hold");
    expect(
      evaluatePolicy({ ...context, snapshot: { ...snapshot, priceUsd: NaN } })
        .action,
    ).toBe("hold");
  });
  it("does not use a public chart fallback for execution", () => {
    expect(
      evaluatePolicy({
        ...context,
        snapshot: { ...snapshot, source: "geckoterminal" },
      }).action,
    ).toBe("hold");
  });
  it("charges paper costs and prevents duplicate fills across restart", () => {
    const first = applyPaperFill(
      emptyLedger(),
      snapshot,
      "buy",
      "decision-1",
      now,
    );
    expect(first.cashUsd).toBeLessThan(9900);
    expect(first.positions[0].quantity).toBeLessThan(100);
    expect(
      applyPaperFill(
        JSON.parse(JSON.stringify(first)),
        snapshot,
        "buy",
        "decision-1",
        now,
      ),
    ).toEqual(first);
  });
  it("cannot sell inventory it does not have", () => {
    expect(() =>
      applyPaperFill(emptyLedger(), snapshot, "sell", "sell-1", now),
    ).toThrow("No position");
  });
});
