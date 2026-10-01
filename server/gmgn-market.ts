import { z } from 'zod';
import type { Pool } from '../src/types.js';
import { gmgnRead } from './launch-feed.js';

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(v => v.toLowerCase())
  .refine(v => !/^0x0{40}$/.test(v));
const numeric = z.union([z.number(), z.string().trim().min(1)]).transform(Number).refine(Number.isFinite);
const positive = numeric.refine(n => n > 0);
const nonnegative = numeric.refine(n => n >= 0);
const metadataText = (value: unknown, limit: number) => typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null;
// Exact fields observed with gmgn-cli 1.6.6. In this response pool.address is
// the TOKEN; pool.pool_address is the POOL. Never guess aliases between them.
const schema = z.object({
  address, name: z.string(), symbol: z.string(), biggest_pool_address: address,
  link: z.unknown().optional(),
  pool: z.object({address, base_address: address, pool_address: address, quote_address: address,
    exchange: z.enum(['pancake_v2', 'pancake_v3']), liquidity: positive}),
  price: z.object({address, price: positive, price_1h: positive, price_24h: positive,
    volume_24h: nonnegative, buys_1h: nonnegative.refine(Number.isInteger), sells_1h: nonnegative.refine(Number.isInteger)}),
});

export function parseGmgnMarket(raw: unknown, token: string, requestedAt: number, receivedAt: number): Pool {
  token = address.parse(token);
  if (![requestedAt, receivedAt].every(Number.isFinite) || requestedAt <= 0 || receivedAt < requestedAt || receivedAt - requestedAt > 90000)
    throw new Error('Invalid or stale GMGN receipt');
  const r = schema.parse(raw), p = r.pool, price = r.price;
  if ([r.address, p.address, p.base_address, price.address].some(a => a !== token) ||
      r.biggest_pool_address !== p.pool_address || p.pool_address === token ||
      p.pool_address === p.quote_address || p.quote_address === token)
    throw new Error('GMGN market identity mismatch');
  const change1h = (price.price / price.price_1h - 1) * 100;
  const change24h = (price.price / price.price_24h - 1) * 100;
  if (![change1h, change24h].every(Number.isFinite)) throw new Error('Invalid GMGN price changes');
  const link = z.object({description: z.unknown().optional(), twitter_username: z.unknown().optional()}).safeParse(r.link);
  const handle = metadataText(link.success ? link.data.twitter_username : null, 80)?.replace(/^@/, '') ?? null;
  return {
    address: p.pool_address, token, name: r.name.slice(0, 160), symbol: r.symbol.slice(0, 80), dex: p.exchange,
    priceUsd: price.price, liquidityUsd: p.liquidity, volume24h: price.volume_24h,
    change1h, change24h, buys: price.buys_1h, sells: price.sells_1h,
    // Conservative receipt age includes CLI queue/request latency. NOT trade time.
    discoveredAt: requestedAt, url: `https://gmgn.ai/bsc/token/${token}`,
    marketData: {source: 'GMGN', requestedAt, receivedAt, providerAsOf: null, priceScope: 'token', metricsScope: 'token'},
    narrativeMetadata: {
      token, name: r.name.trim().slice(0, 160), symbol: r.symbol.trim().slice(0, 80),
      description: metadataText(link.success ? link.data.description : null, 1600),
      reportedXHandle: handle && /^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle : null,
      source: 'GMGN', requestedAt, receivedAt,
    },
  };
}

export class GmgnMarketData {
  private cache = new Map<string, Pool>();
  private pending = new Map<string, Promise<Pool>>();
  constructor(private read = gmgnRead, private now = Date.now) {}
  async metadataForToken(token: string) {
    token = address.parse(token);
    const requestedAt = this.now();
    const raw = await this.read(['token', 'info', '--chain', 'bsc', '--address', token, '--raw']);
    const r = z.object({address, name:z.string(), symbol:z.string(), link:z.unknown().optional()}).parse(raw);
    if (r.address !== token) throw new Error('GMGN metadata identity mismatch');
    const link = z.object({description:z.unknown().optional(),twitter_username:z.unknown().optional()}).safeParse(r.link);
    const handle = metadataText(link.success ? link.data.twitter_username : null,80)?.replace(/^@/,'');
    return {token,name:r.name.trim().slice(0,160),symbol:r.symbol.trim().slice(0,80),
      description:metadataText(link.success ? link.data.description : null,1600),
      reportedXHandle:handle && /^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle : null,
      source:'GMGN' as const,requestedAt,receivedAt:this.now()};
  }
  async poolForToken(token: string): Promise<Pool> {
    token = address.parse(token);
    const hit = this.cache.get(token), now = this.now();
    if (hit && hit.discoveredAt <= now && now - hit.discoveredAt < 30000) return structuredClone(hit);
    let task = this.pending.get(token);
    if (!task) {
      if (this.pending.size >= 64) throw new Error('GMGN market queue full');
      task = (async () => {
        const requestedAt = this.now();
        const raw = await this.read(['token', 'info', '--chain', 'bsc', '--address', token, '--raw']);
        const pool = parseGmgnMarket(raw, token, requestedAt, this.now());
        if (this.cache.size >= 256) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(token, pool);
        return pool;
      })().finally(() => this.pending.delete(token));
      this.pending.set(token, task);
    }
    return structuredClone(await task);
  }
  async pool(pool: string, token: string): Promise<Pool> {
    pool = address.parse(pool);
    const result = await this.poolForToken(token);
    // A held position or memory episode remains pinned to its original pool.
    // The token's new biggest pool is NOT a transparent replacement.
    if (result.address !== pool) throw new Error('Pool identity changed; original pool unavailable from GMGN');
    return result;
  }
}
