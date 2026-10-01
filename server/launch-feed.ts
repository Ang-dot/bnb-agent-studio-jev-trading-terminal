import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { serialReadLane } from "./read-lane.js";
import type { JsonPersistence } from './cloud-store.js';
import { z } from "zod";
import type { Launch, LaunchFeedState, Platform } from "../src/launches.js";
import { platforms, platformLabel, stageLabel } from "../src/launches.js";
import type { Candle } from "../src/types.js";
import type { LaunchActivity } from "../src/monitoring.js";

const address = /^0x[0-9a-fA-F]{40}$/;
const rowSchema = z
  .object({
    address: z.string().regex(address),
    chain: z.literal("bsc"),
    launchpad_platform: z.enum(platforms),
    symbol: z.string(),
    name: z.string(),
  })
  .passthrough();
const envelope = z.object({
  new_creation: z.array(z.unknown()),
  near_completion: z.array(z.unknown()),
  completed: z.array(z.unknown()),
});
const numeric = (v: unknown): number | null =>
  (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) &&
  Number.isFinite(Number(v)) &&
  Number(v) >= 0
    ? Number(v)
    : null;
const timestamp = (v: unknown) => {
  const n = numeric(v);
  return n && n > 0 ? n * 1000 : null;
};
export function parseLaunchActivity(
  raw: unknown,
  now: number,
): LaunchActivity[] {
  const ranks = z
    .object({
      code: z.literal(0),
      data: z.object({ rank: z.array(z.unknown()) }),
    })
    .parse(raw).data.rank;
  return ranks.flatMap((value) => {
    const parsed = rowSchema.safeParse(value);
    if (!parsed.success) return [];
    const r = parsed.data,
      riskFlags: string[] = [];
    if (r.is_honeypot === 1) riskFlags.push("GMGN honeypot flag");
    if (r.is_wash_trading === true) riskFlags.push("GMGN wash-trading flag");
    if ((numeric(r.rug_ratio) ?? -1) > 0.3)
      riskFlags.push("GMGN elevated rug risk");
    if ((numeric(r.bundler_rate) ?? -1) > 0.3)
      riskFlags.push("GMGN bundle concentration >30%");
    if ((numeric(r.rat_trader_amount_rate) ?? -1) > 0.3)
      riskFlags.push("GMGN insider activity >30%");
    if ((numeric(r.top_10_holder_rate) ?? -1) > 0.6)
      riskFlags.push("GMGN top-10 concentration >60%");
    return [
      {
        token: r.address.toLowerCase(),
        observedAt: now,
        volume5mUsd: numeric(r.volume),
        swaps5m: numeric(r.swaps),
        buys5m: numeric(r.buys),
        sells5m: numeric(r.sells),
        riskFlags,
      },
    ];
  });
}
// Token-info exposes explicit 5m fields; never substitute 1h totals or derive missing swaps.
export function parseTokenActivity(raw:unknown, token:string, at:number):LaunchActivity {
  const r=z.object({address:z.string(),price:z.object({address:z.string()}).passthrough()}).passthrough().parse(raw);
  if(r.address.toLowerCase()!==token.toLowerCase() || r.price.address.toLowerCase()!==token.toLowerCase()) throw new Error('Activity identity mismatch');
  const riskFlags:string[]=[];
  if(r.is_honeypot===1 || r.is_honeypot==='yes')riskFlags.push('GMGN honeypot flag');
  if(r.is_wash_trading===true)riskFlags.push('GMGN wash-trading flag');
  if((numeric(r.rug_ratio)??0)>.3)riskFlags.push('GMGN elevated rug risk');
  const stat=z.object({top_10_holder_rate:z.unknown().optional(),top_bundler_trader_percentage:z.unknown().optional(),top_rat_trader_percentage:z.unknown().optional()}).safeParse(r.stat);
  if(stat.success) {
    if((numeric(stat.data.top_10_holder_rate)??0)>.6)riskFlags.push('GMGN top-10 concentration >60%');
    if((numeric(stat.data.top_bundler_trader_percentage)??0)>.3)riskFlags.push('GMGN bundle concentration >30%');
    if((numeric(stat.data.top_rat_trader_percentage)??0)>.3)riskFlags.push('GMGN insider activity >30%');
  }
  return {token:token.toLowerCase(),observedAt:at,volume5mUsd:numeric(r.price.volume_5m),swaps5m:numeric(r.price.swaps_5m),
    buys5m:numeric(r.price.buys_5m),sells5m:numeric(r.price.sells_5m),riskFlags};
}
export function parseTrenches(
  raw: unknown,
  platform: Platform,
  now: number,
): Launch[] {
  const input = envelope.parse(raw);
  const result = new Map<string, Launch>();
  for (const [category, stage] of [
    ["new_creation", "new"],
    ["near_completion", "bonding"],
    ["completed", "graduated_reported"],
  ] as const) {
    for (const value of input[category]) {
      const parsed = rowSchema.safeParse(value);
      if (!parsed.success || parsed.data.launchpad_platform !== platform)
        continue;
      const r = parsed.data;
      const token = r.address.toLowerCase();
      const riskFlags: string[] = [];
      if (r.is_honeypot === "yes") riskFlags.push("GMGN honeypot flag");
      if (r.is_wash_trading === true) riskFlags.push("GMGN wash-trading flag");
      if ((numeric(r.rug_ratio) ?? 0) > 0.3)
        riskFlags.push("GMGN elevated rug-risk flag");
      const progress = numeric(r.progress);
      result.set(token, {
        id: `56:${token}`,
        address: token,
        platform,
        symbol: r.symbol.slice(0, 80),
        name: r.name.slice(0, 160),
        stage,
        createdAt: timestamp(r.created_timestamp),
        reportedGraduatedAt: timestamp(r.complete_timestamp),
        observedAt: now,
        firstSeenAt: now,
        priceUsd: numeric(r.price),
        liquidityUsd: numeric(r.liquidity),
        marketCapUsd: numeric(r.market_cap),
        volume24h: numeric(r.volume_24h),
        progress: progress !== null && progress <= 1 ? progress : null,
        holders: numeric(r.holder_count),
        top10: numeric(r.top_10_holder_rate),
        logo:
          typeof r.logo === "string" &&
          /^https:\/\/(gmgn\.ai|static\.four\.meme)\//.test(r.logo)
            ? r.logo
            : null,
        quote:
          typeof r.quote_address === "string" && address.test(r.quote_address)
            ? r.quote_address.toLowerCase()
            : null,
        riskFlags,
      });
    }
  }
  return [...result.values()];
}
export function parseLaunchCandles(raw: unknown, now: number): Candle[] {
  const data = z
    .object({
      list: z.array(
        z.object({
          time: z.number(),
          open: z.string(),
          high: z.string(),
          low: z.string(),
          close: z.string(),
          volume: z.string(),
        }),
      ),
    })
    .parse(raw);
  const unique = new Map<number, Candle>();
  for (const r of data.list) {
    // Observed gmgn-cli 1.6.6 response uses milliseconds; accept explicit Unix seconds too.
    const time = Math.floor(r.time > 1e12 ? r.time / 1000 : r.time);
    const [open, high, low, close, volume] = [
      r.open,
      r.high,
      r.low,
      r.close,
      r.volume,
    ].map(numeric);
    if (
      [open, high, low, close, volume].some((n) => n === null) ||
      time > now / 1000 ||
      time <= 0
    )
      continue;
    if (
      high! < Math.max(open!, close!) ||
      low! > Math.min(open!, close!) ||
      low! > high!
    )
      continue;
    unique.set(time, {
      time,
      open: open!,
      high: high!,
      low: low!,
      close: close!,
      volume: volume!,
    });
  }
  return [...unique.values()].sort((a, b) => a.time - b.time);
}
const exec = promisify(execFile);
const binary =
  process.env.GMGN_CLI_PATH || join(homedir(), ".local/bin/gmgn-cli");
let configured: Promise<unknown> | undefined;
let cooldownUntil = 0;
const cooldownFile = ".data/gmgn-cooldown.json";
let cloudCooldown: JsonPersistence | undefined;
let readGuard: (()=>Promise<void>) | undefined;
export async function configureGmgnRuntime(record:JsonPersistence,guard:()=>Promise<void>){
  cloudCooldown=record;readGuard=guard;
  const raw=await record.read();
  if(raw!==undefined){const saved=JSON.parse(raw);if(!Number.isFinite(saved.until))throw new Error('Invalid GMGN cooldown');cooldownUntil=Math.max(cooldownUntil,saved.until);}
}
try {
  const saved = JSON.parse(readFileSync(cooldownFile, "utf8"));
  if (Number.isFinite(saved.until)) cooldownUntil = Math.max(0, saved.until);
} catch { /* First run has no cooldown. */ }
export const gmgnRead = serialReadLane(gmgnReadNow);
async function gmgnReadNow(args: string[]): Promise<unknown> {
  if(readGuard)await readGuard();
  if (Date.now() < cooldownUntil) throw new Error("GMGN cooling down");
  configured ??= exec(binary, ["config", "--check"], {
    timeout: 10000,
    maxBuffer: 64 * 1024,
  }).catch(() => {
    configured = undefined;
    throw new Error("GMGN configuration unavailable");
  });
  await configured;
  try {
    const { stdout } = await exec(binary, args, {
      timeout: 20000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (e) {
    // Never send CLI errors or credential-bearing URLs to the client.
    const error = e as { stderr?: string; stdout?: string };
    if (/429|RATE_LIMIT/.test(`${error.stderr || ""} ${error.stdout || ""}`)) {
      cooldownUntil = Date.now() + 310_000;
      try {
        if(cloudCooldown)await cloudCooldown.write(JSON.stringify({until:cooldownUntil}));
        else {
        mkdirSync(".data", {recursive:true,mode:0o700});
        writeFileSync(cooldownFile+".tmp",JSON.stringify({until:cooldownUntil}),{mode:0o600});
        renameSync(cooldownFile+".tmp",cooldownFile);
        }
      } catch { /* In-process cooldown still applies if disk is unavailable. */ }
    }
    throw new Error("GMGN read unavailable");
  }
}
export class LaunchFeed {
  state: LaunchFeedState = {
    launches: [],
    events: [],
    enabled: true,
    updatedAt: null,
    errors: [],
    source: "GMGN",
    pollMs: 30000,
    coverage: {
      flap: { status: "pending", checkedAt: null, count: null },
      fourmeme: { status: "pending", checkedAt: null, count: null },
    },
  };
  private pending: Promise<void> | null = null;
  private chartCache = new Map<string, { at: number; candles: Candle[] }>();
  private chartPending = new Map<string, Promise<Candle[]>>();
  private activityCache: { at: number; rows: LaunchActivity[] } | null = null;
  private targetedActivity = new Map<string,LaunchActivity>();
  private targetedAttempts = new Map<string,number>();
  private activityPending: Promise<LaunchActivity[]> | null = null;
  constructor(private read: typeof gmgnRead = gmgnRead) {}
  async activity(): Promise<LaunchActivity[]> {
    if (this.activityCache && Date.now() - this.activityCache.at < 30000)
      return this.activityCache.rows;
    if (this.activityPending) return this.activityPending;
    this.activityPending = (async () => {
      const raw = await this.read([
        "market",
        "trending",
        "--chain",
        "bsc",
        "--interval",
        "5m",
        "--platform",
        "flap",
        "--platform",
        "fourmeme",
        "--order-by",
        "volume",
        "--limit",
        "100",
        "--raw",
      ]);
      const at=Date.now(),rows=parseLaunchActivity(raw,at),covered=new Set(rows.map(a=>a.token));
      for(const [token,value] of this.targetedActivity) {
        if(at-value.observedAt>90000){this.targetedActivity.delete(token);continue;}
        if(!covered.has(token)){rows.push(value);covered.add(token);}
      }
      const candidates=this.state.launches.filter(l=>l.stage!=='graduated_reported' && l.observedAt<=at && at-l.observedAt<=90000 &&
        (l.liquidityUsd??0)>=2000 && (l.holders??0)>=10 && !l.riskFlags.length && !covered.has(l.address))
        .sort((a,b)=>(this.targetedAttempts.get(a.address)??0)-(this.targetedAttempts.get(b.address)??0)).slice(0,3);
      for(const launch of candidates) {
        this.targetedAttempts.set(launch.address,Date.now());
        try {
          const requested=Date.now(),raw=await this.read(['token','info','--chain','bsc','--address',launch.address,'--raw']);
          const activity=parseTokenActivity(raw,launch.address,requested);
          rows.push(activity);this.targetedActivity.set(launch.address,activity);
        } catch { /* No inferred activity; other candidates remain usable. */ }
      }
      if(this.targetedAttempts.size>600) for(const key of this.targetedAttempts.keys())if(!this.state.launches.some(l=>l.address===key))this.targetedAttempts.delete(key);
      this.activityCache = { at, rows };
      return rows;
    })().finally(() => {
      this.activityPending = null;
    });
    return this.activityPending;
  }
  refresh(): Promise<void> {
    if (!this.state.enabled) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = this.fetch().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
  private async fetch() {
    const old = new Map(this.state.launches.map((l) => [l.id, l]));
    const errors: string[] = [];
    const coverage = { ...this.state.coverage };
    let succeeded = false;
    for (const platform of platforms) {
      try {
        const raw = await this.read([
          "market",
          "trenches",
          "--chain",
          "bsc",
          "--launchpad-platform",
          platform,
          "--type",
          "new_creation",
          "--type",
          "near_completion",
          "--type",
          "completed",
          "--limit",
          "60",
          "--raw",
        ]);
        const now = Date.now();
        const incoming = parseTrenches(raw, platform, now);
        coverage[platform] = {
          status: incoming.length ? "observed" : "empty",
          checkedAt: now,
          count: incoming.length,
        };
        for (const l of incoming) {
          const prior = old.get(l.id);
          l.firstSeenAt = prior?.firstSeenAt ?? now;
          old.set(l.id, l);
          if (this.state.updatedAt && (!prior || prior.stage !== l.stage))
            this.state.events.unshift({
              id: `${l.id}:${l.stage}:${now}`,
              token: l.address,
              symbol: l.symbol,
              time: now,
              kind: prior ? "stage" : "detected",
              detail: prior
                ? `GMGN: ${stageLabel(l.stage)}`
                : "First detected in the launch feed",
            });
        }
        succeeded = true;
      } catch {
        coverage[platform] = {
          status: "unavailable",
          checkedAt: Date.now(),
          count: null,
        };
        errors.push(
          `${platformLabel(platform)} feed unavailable. Retaining timestamped observations.`,
        );
      }
    }
    // Fresh graduates must not be evicted merely because bonding took days.
    const recentGraduates = [...old.values()]
      .filter(
        (l) =>
          l.stage === "graduated_reported" &&
          l.reportedGraduatedAt !== null &&
          l.reportedGraduatedAt <= Date.now() &&
          Date.now() - l.reportedGraduatedAt <= 86400000,
      )
      .sort(
        (a, b) => (b.reportedGraduatedAt ?? 0) - (a.reportedGraduatedAt ?? 0),
      )
      .slice(0, 120);
    const retained = new Map(recentGraduates.map((l) => [l.id, l]));
    for (const l of [...old.values()].sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
    )) {
      if (retained.size >= 600) break;
      retained.set(l.id, l);
    }
    this.state = {
      ...this.state,
      errors,
      coverage,
      updatedAt: succeeded ? Date.now() : this.state.updatedAt,
      launches: [...retained.values()].sort(
        (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
      ),
      events: this.state.events.slice(0, 60),
    };
  }
  async candles(token: string, interval: "1" | "5" | "15") {
    if (
      !address.test(token) ||
      !this.state.launches.some((l) => l.address === token)
    )
      throw new Error("Unknown token");
    return this.tokenCandles(token, interval);
  }
  // Callers must bind this token to a known launch or a persisted position.
  // Held tokens can leave the bounded launch feed without losing their charts.
  async tokenCandles(token: string, interval: "1" | "5" | "15", options: {fresh?:boolean} = {}) {
    if (!address.test(token)) throw new Error("Invalid chart token");
    token = token.toLowerCase();
    const key = `${token}:${interval}`;
    const cache = this.chartCache.get(key);
    if (cache && !options.fresh && Date.now() - cache.at < 30000) return cache.candles;
    const pending = this.chartPending.get(key);
    if (pending) return pending;
    const task = (async () => {
      const now = Date.now();
      const raw = await this.read([
        "market",
        "kline",
        "--chain",
        "bsc",
        "--address",
        token,
        "--resolution",
        `${interval}m`,
        "--from",
        String(Math.floor(now / 1000) - Number(interval) * 60 * 120),
        "--to",
        String(Math.floor(now / 1000)),
        "--raw",
      ]);
      const candles = parseLaunchCandles(raw, now);
      if (this.chartCache.size >= 60)
        this.chartCache.delete(this.chartCache.keys().next().value!);
      this.chartCache.set(key, { at: now, candles });
      return candles;
    })().finally(() => this.chartPending.delete(key));
    this.chartPending.set(key, task);
    return task;
  }
}
