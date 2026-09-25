import { describe, expect, it, vi } from "vitest";
import { EvidenceArchive, EvidenceCollector, normalizeEvidence, estimateExitImpact } from "./enrichment.js";
const token = "0x" + "1".repeat(40), creator = "0x" + "2".repeat(40);
const now = 1_790_000_000_000;
const receipt = (key: string, raw: unknown) => ({ key, requestedAt: now - 1000, receivedAt: now, raw });
const info = { address: token, creation_timestamp: 100, dev: { creator_address: creator }, price: { price: "2", price_1m: "1", buy_volume_1m: "0", sell_volume_1m: "10" }, pool: { base_address: token, pool_address: "0x" + "3".repeat(40), exchange: "pancake_v2", base_reserve_value: "10000", quote_reserve_value: "10000", creation_timestamp: 0 } };
describe("observational GMGN enrichment", () => {
  it("preserves zero versus missing, source fields and request times", () => {
    const e = normalizeEvidence(token, [receipt("info", info)], now);
    expect(e.mode).toBe("shadow");
    expect(e.flow[0]).toMatchObject({ buyUsd: 0, sellUsd: 10, netUsd: -10, priceChangePct: 100 });
    expect(e.flow[1].buyUsd).toBeNull();
    expect(e.pool.createdAt).toBeNull();
    expect(e.sources[0].availability["price.buy_volume_1m"]).toBe("present");
    expect(e.sources[0].availability["price.buy_volume_5m"]).toBe("missing");
    expect(e.sources[0].requestedAt).toBe(now - 1000);
    expect(e.sources[0].providerAsOf).toBeNull();
  });
  it("uses aggregate counts, and excludes the current or later launches from prior samples", () => {
    const e = normalizeEvidence(token, [receipt("info", info), receipt("creator", {
      inner_count: 964, open_count: 14, tokens: [
        { token_address: token, create_timestamp: 100, token_ath_mc: "999" },
        { token_address: creator, create_timestamp: 50, token_ath_mc: "100" },
      ],
    })], now);
    expect(e.creator.totalLaunches).toBe(978);
    expect(e.creator.graduationRate).toBeCloseTo(14 / 978);
    expect(e.creator.priorTokens).toHaveLength(1);
    expect(e.creator.priorTokens[0].peakMarketCapUsd).toBe(100);
  });
  it("retains overlapping tags and negative profit; excludes pool accounts from wallet samples", () => {
    const e = normalizeEvidence(token, [receipt("info", info), receipt("holders", { list: [
      { address: creator, addr_type: 0, tags: ["smart_degen"], maker_token_tags: ["bundler"], profit: -10, amount_percentage: .2 },
      { address: token, addr_type: 2, amount_percentage: .5 },
    ] })], now);
    expect(e.wallets).toHaveLength(1);
    expect(e.wallets[0]).toMatchObject({ tags: ["smart_degen", "bundler"], profitUsd: -10, holdingShare: .2, buyUsd: null });
    expect(e.excludedPoolRows).toBe(1);
  });
  it("does not accept mismatched token info or unrelated/future smart-money events", () => {
    expect(() => normalizeEvidence(token, [receipt("info", { ...info, address: creator })], now)).toThrow();
    const e = normalizeEvidence(token, [receipt("info", info), receipt("smartmoney", { list: [
      { base_address: creator, maker: creator, timestamp: now / 1000 - 10, side: "buy" },
      { base_address: token, maker: creator, timestamp: now / 1000 + 5, side: "buy" },
      { base_address: token, maker: creator, timestamp: now / 1000 - 5, side: "sell", amount_usd: 12 },
    ] })], now);
    expect(e.events).toHaveLength(1);
    expect(e.events[0].side).toBe("sell");
  });
  it("only estimates constant-product reserve impact, never missing or concentrated liquidity", () => {
    expect(estimateExitImpact("pancake_v2", 10000, 50)).toBeCloseTo(100 * 50 / 10050);
    expect(estimateExitImpact("pancake_v3", 10000, 50)).toBeNull();
    expect(estimateExitImpact("pancake_v2", null, 50)).toBeNull();
  });
  it("archives immutable observations and rejects future/stale evidence for a decision", async () => {
    const archive = new EvidenceArchive(":memory:");
    const e = normalizeEvidence(token, [receipt("info", info)], now);
    archive.save(e, []);
    expect(archive.latest(token, now - 1)).toBeUndefined();
    expect(archive.latest(token, now + 1)?.id).toBe(e.id);
    expect(archive.latest(token, now + 300001)).toBeUndefined();
    archive.close();
  });
  it("deduplicates collection, caches it, and retains partial data if holder queries fail", async () => {
    const archive = new EvidenceArchive(":memory:");
    const read = vi.fn(async (args: string[]) => {
      if (args[1] === "info") return info;
      if (args[1] === "holders") throw new Error("credential-bearing provider error");
      return args[1] === "created-tokens" ? { inner_count: 2, open_count: 1, tokens: [] } : { list: [] };
    });
    const collector = new EvidenceCollector(archive, read, () => now, async () => {});
    await Promise.all([collector.refresh(token), collector.refresh(token)]);
    await collector.refresh(token);
    expect(read.mock.calls.filter(([a]) => a[1] === "info")).toHaveLength(1);
    expect(archive.latest(token, now)?.sources.find(s => s.key === "holders")?.status).toBe("error");
    expect(JSON.stringify(archive.latest(token, now))).not.toContain("credential-bearing");
    archive.close();
  });
});
