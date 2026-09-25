import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { gmgnRead } from "./launch-feed.js";
import type { EvidenceReceipt, SupportingEvidence, WalletEvidence } from "../src/enrichment.js";

export interface RawObservation { key: string; requestedAt: number; receivedAt: number; raw?: unknown; error?: true }
const obj = (v: unknown): Record<string, any> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {};
const addr = (v: unknown) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v) ? v.toLowerCase() : null;
const number = (v: unknown, signed = false) => (typeof v === "number" || typeof v === "string" && v.trim() !== "") && Number.isFinite(Number(v)) && (signed || Number(v) >= 0) ? Number(v) : null;
const string = (v: unknown) => typeof v === "string" && v.length > 0 ? v.slice(0, 160) : null;
const ratio = (v: unknown) => { const n = number(v); return n !== null && n <= 1 ? n : null; };
const timestamp = (v: unknown) => { const n = number(v); return n && n > 0 ? n * 1000 : null; };
const tags = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map(x => x.slice(0, 40)).slice(0, 20) : [];
const pathValue = (raw: unknown, path: string) => path.split(".").reduce((v: any, part) => v?.[part], raw);
export function estimateExitImpact(exchange: string | null, baseUsd: number | null, sellUsd: number) {
  return exchange === "pancake_v2" && baseUsd !== null && baseUsd > 0 && sellUsd > 0 ? 100 * sellUsd / (baseUsd + sellUsd) : null;
}
export function normalizeEvidence(token: string, raws: RawObservation[], completedAt: number): SupportingEvidence {
  if (!addr(token)) throw new Error("Invalid token identity");
  const sources: EvidenceReceipt[] = [];
  function source(key: string, valid: (v: Record<string, any>) => boolean) {
    const r = raws.find(r => r.key === key);
    const raw = obj(r?.raw);
    const receipt: EvidenceReceipt = { key, source: "GMGN", requestedAt: r?.requestedAt ?? completedAt, receivedAt: r?.receivedAt ?? completedAt, providerAsOf: null, status: !r ? "unavailable" : r.error ? "error" : valid(raw) ? "ready" : "invalid", availability: {} };
    sources.push(receipt);
    return {
      raw: receipt.status === "ready" ? raw : {},
      get<T>(path: string, parse: (v: unknown) => T | null): T | null {
        const value = receipt.status === "ready" ? parse(pathValue(raw, path)) : null;
        receipt.availability[path] = value !== null ? "present" : "missing";
        return value;
      },
    };
  }
  const infoRaw = raws.find(r => r.key === "info");
  if (infoRaw?.raw && addr(obj(infoRaw.raw).address) !== token) throw new Error("GMGN token identity mismatch");
  const info = source("info", r => addr(r.address) === token);
  const createdAt = info.get("creation_timestamp", timestamp);
  const creator = source("creator", r => number(r.inner_count) !== null && number(r.open_count) !== null && Array.isArray(r.tokens));
  const inner = creator.get("inner_count", number), graduated = creator.get("open_count", number);
  const totalLaunches = inner !== null && graduated !== null ? inner + graduated : null;
  const priorTokens = (Array.isArray(creator.raw.tokens) ? creator.raw.tokens : []).flatMap((r: any, i: number) => {
    const address = creator.get(`tokens.${i}.token_address`, addr), time = creator.get(`tokens.${i}.create_timestamp`, timestamp);
    const peak = creator.get(`tokens.${i}.token_ath_mc`, number);
    if (!address || address === token || !time || !createdAt || time >= createdAt) return [];
    return [{ address, symbol: string(r.symbol) || address.slice(0, 8), createdAt: time, peakMarketCapUsd: peak }];
  }).slice(0, 100);
  const wallets: WalletEvidence[] = [];
  let excludedPoolRows = 0;
  for (const key of ["holders", "traders"] as const) {
    const s = source(key, r => Array.isArray(r.list));
    for (const [i, raw] of (Array.isArray(s.raw.list) ? s.raw.list : []).slice(0, 20).entries()) {
      const address = s.get(`list.${i}.address`, addr);
      // Only explicit EOA/wallet rows, never exchange/pool balances as trader concentration.
      if (raw.addr_type === 2) { excludedPoolRows++; continue; }
      if (!address || raw.addr_type !== 0) continue;
      const platformTags = s.get(`list.${i}.tags`, v => Array.isArray(v) ? tags(v) : null);
      const tokenTags = s.get(`list.${i}.maker_token_tags`, v => Array.isArray(v) ? tags(v) : null);
      wallets.push({ address, sample: key, tags: [...new Set([...(platformTags ?? []), ...(tokenTags ?? [])])],
        holdingShare: s.get(`list.${i}.amount_percentage`, ratio), holdingUsd: s.get(`list.${i}.usd_value`, number),
        buyUsd: s.get(`list.${i}.buy_volume_cur`, number), sellUsd: s.get(`list.${i}.sell_volume_cur`, number),
        profitUsd: s.get(`list.${i}.profit`, v => number(v, true)), realizedUsd: s.get(`list.${i}.realized_profit`, v => number(v, true)), unrealizedUsd: s.get(`list.${i}.unrealized_profit`, v => number(v, true)),
        lastActiveAt: s.get(`list.${i}.last_active_timestamp`, timestamp) });
    }
  }
  const smart = source("smartmoney", r => Array.isArray(r.list));
  const events: SupportingEvidence["events"] = (Array.isArray(smart.raw.list) ? smart.raw.list : []).flatMap((r: any, i: number) => {
    const t = smart.get(`list.${i}.timestamp`, timestamp), wallet = smart.get(`list.${i}.maker`, addr);
    if (addr(r.base_address) !== token || !wallet || !t || t > completedAt || !["buy", "sell"].includes(r.side)) return [];
    return [{ wallet, side: r.side, usd: smart.get(`list.${i}.amount_usd`, number), time: t, tx: typeof r.transaction_hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(r.transaction_hash) ? r.transaction_hash : null, tags: tags(r.maker_info?.tags) }];
  }).sort((a: any,b: any) => b.time - a.time).slice(0, 30);
  const price = info.get("price.price", number);
  const flow: SupportingEvidence["flow"] = (["1m", "5m", "1h"] as const).map(window => {
    const buyUsd = info.get(`price.buy_volume_${window}`, number), sellUsd = info.get(`price.sell_volume_${window}`, number), start = info.get(`price.price_${window}`, number);
    return { window, buyUsd, sellUsd, netUsd: buyUsd !== null && sellUsd !== null ? buyUsd - sellUsd : null, swaps: info.get(`price.swaps_${window}`, number), priceChangePct: price !== null && start !== null && start > 0 ? (price / start - 1) * 100 : null };
  });
  const poolMatches = info.get("pool.base_address", addr) === token;
  const poolField = <T,>(path: string, parse: (v: unknown) => T | null) => { const value = info.get("pool." + path, parse); return poolMatches ? value : null; };
  const baseUsd = poolField("base_reserve_value", number), exchange = poolField("exchange", string);
  return { id: randomUUID(), version: 1, mode: "shadow", token, startedAt: Math.min(completedAt, ...raws.map(r => r.requestedAt)), completedAt, sources,
    creator: { address: info.get("dev.creator_address", addr), totalLaunches, graduated, graduationRate: totalLaunches && graduated !== null ? graduated / totalLaunches : null, priorTokens, returnedTokenCount: Array.isArray(creator.raw.tokens) ? creator.raw.tokens.length : null },
    top10Share: info.get("stat.top_10_holder_rate", ratio), creatorShare: info.get("stat.creator_hold_rate", ratio), wallets, excludedPoolRows,
    walletCounts: Object.fromEntries(["smart_wallets", "renowned_wallets", "sniper_wallets", "rat_trader_wallets", "bundler_wallets", "creator_wallets"].map(key => [key, info.get("wallet_tags_stat." + key, number)])),
    pool: { address: poolField("pool_address", addr), exchange, quoteAddress: poolField("quote_address", addr), quoteSymbol: poolField("quote_symbol", string), createdAt: poolField("creation_timestamp", timestamp), baseReserve: poolField("base_reserve", number), quoteReserve: poolField("quote_reserve", number), baseUsd, quoteUsd: poolField("quote_reserve_value", number), impact50Pct: estimateExitImpact(exchange, baseUsd, 50), impact150Pct: estimateExitImpact(exchange, baseUsd, 150) },
    flow, events };
}

// Separate point-in-time research archive. Never writes to the portfolio or to model inputs.
export class EvidenceArchive {
  private db: DatabaseSync;
  constructor(path = ".data/evidence.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, token TEXT NOT NULL, observed_at INTEGER NOT NULL, data TEXT NOT NULL, raw TEXT NOT NULL); CREATE INDEX IF NOT EXISTS evidence_token_time ON evidence(token, observed_at)");
  }
  save(e: SupportingEvidence, raw: RawObservation[]) {
    this.db.prepare("INSERT OR IGNORE INTO evidence VALUES (?,?,?,?,?)").run(e.id, e.token, e.completedAt, JSON.stringify(e), JSON.stringify(raw));
  }
  latest(token: string, at = Date.now(), maxAge = 300000): SupportingEvidence | undefined {
    const row = this.db.prepare("SELECT data FROM evidence WHERE token=? AND observed_at<=? AND observed_at>=? ORDER BY observed_at DESC LIMIT 1").get(token, at, at - maxAge);
    return row ? JSON.parse(row.data as string) : undefined;
  }
  close() { this.db.close(); }
}
export class EvidenceCollector {
  private pending = new Map<string, Promise<void>>();
  private tail: Promise<void> = Promise.resolve();
  private attempts = new Map<string, number>();
  private smartCache?: RawObservation;
  constructor(readonly archive: EvidenceArchive, private read = gmgnRead, private clock = Date.now, private wait: () => Promise<unknown> = () => delay(1200)) {}
  refresh(token: string): Promise<void> {
    token = token.toLowerCase();
    if (!addr(token)) return Promise.resolve();
    if (this.pending.has(token)) return this.pending.get(token)!;
    if (this.clock() - (this.attempts.get(token) ?? 0) < 60000 || this.pending.size >= 3) return Promise.resolve();
    const task = this.tail.then(() => this.collect(token)).catch(() => { /* Isolated research failure must not affect execution. */ });
    this.tail = task;
    this.pending.set(token, task);
    void task.finally(() => this.pending.delete(token));
    return task;
  }
  private async collect(token: string) {
    this.attempts.set(token, this.clock());
    const raws: RawObservation[] = [];
    const call = async (key: string, args: string[]) => {
      // Space read-only requests; no burst of expensive holder/trader queries.
      await this.wait();
      const r: RawObservation = { key, requestedAt: this.clock(), receivedAt: this.clock() };
      try { r.raw = await this.read([...args, "--raw"]); } catch { r.error = true; }
      r.receivedAt = this.clock(); raws.push(r); return r;
    };
    const info = await call("info", ["token", "info", "--chain", "bsc", "--address", token]);
    if (info.error || addr(obj(info.raw).address) !== token) {
      const e = normalizeEvidence(token, [{ ...info, raw: undefined, error: true }], this.clock());
      this.archive.save(e, raws); return;
    }
    const creator = addr(obj(obj(info.raw).dev).creator_address);
    if (creator) await call("creator", ["portfolio", "created-tokens", "--chain", "bsc", "--wallet", creator, "--order-by", "token_ath_mc", "--direction", "desc"]);
    await call("holders", ["token", "holders", "--chain", "bsc", "--address", token, "--limit", "20", "--order-by", "amount_percentage", "--direction", "desc"]);
    await call("traders", ["token", "traders", "--chain", "bsc", "--address", token, "--limit", "20", "--order-by", "sell_volume_cur", "--direction", "desc"]);
    if (this.smartCache && this.clock() - this.smartCache.receivedAt < 60000) raws.push(structuredClone(this.smartCache));
    else { const r = await call("smartmoney", ["track", "smartmoney", "--chain", "bsc", "--limit", "100"]); if (!r.error) this.smartCache = r; }
    const e = normalizeEvidence(token, raws, this.clock());
    const previous = this.archive.latest(token, e.startedAt, 3600000);
    if (previous) {
      e.comparison = { previousId: previous.id, previousAt: previous.completedAt,
        top10DeltaPp: e.top10Share !== null && previous.top10Share !== null ? (e.top10Share - previous.top10Share) * 100 : null,
        wallets: e.wallets.filter(w => w.sample === "holders").flatMap(w => {
          const old = previous.wallets.find(p => p.sample === "holders" && p.address === w.address);
          return w.holdingShare !== null && old?.holdingShare != null ? [{ address: w.address, shareDeltaPp: (w.holdingShare - old.holdingShare) * 100 }] : [];
        }) };
    }
    this.archive.save(e, raws);
  }
}
