import { describe, it, expect, vi } from 'vitest';
import { GmgnMarketData, parseGmgnMarket } from './gmgn-market.js';

const token = '0x' + '1'.repeat(40), pool = '0x' + '2'.repeat(40), quote = '0x' + '3'.repeat(40);
const at = 1790000000000;
const fixture = () => ({
  address: token, name: 'Fixture', symbol: 'TEST', biggest_pool_address: pool,
  creation_timestamp: 1700000000,
  pool: { address: token, base_address: token, pool_address: pool, quote_address: quote, quote_symbol: 'WBNB', exchange: 'pancake_v2', liquidity: '20000' },
  price: { address: token, price: '0.01', price_1h: '0.008', price_24h: '0.005', volume_24h: '10000', buys_1h: 30, sells_1h: 10 },
});

describe('GMGN market adapter', () => {
  it('retains contract-bound metadata from exact GMGN fields, with unknown descriptions left null', () => {
    const p = parseGmgnMarket({...fixture(), link: {description: 'A lunar meme', twitter_username: '@MoonFixture'}}, token, at, at + 1000);
    expect(p.narrativeMetadata).toEqual({token, name: 'Fixture', symbol: 'TEST', description: 'A lunar meme', reportedXHandle: 'MoonFixture', reportedXUrl: null, source: 'GMGN', requestedAt: at, receivedAt: at + 1000});
    expect(parseGmgnMarket(fixture(), token, at, at).narrativeMetadata?.description).toBeNull();
    expect(parseGmgnMarket({...fixture(), description: 'Wrong field', link: {description: {}, twitter_username: 'https://evil.invalid'}}, token, at, at).narrativeMetadata).toMatchObject({description: null, reportedXHandle: null});
    expect(parseGmgnMarket({...fixture(), link: {description: 'x'.repeat(2000)}}, token, at, at).narrativeMetadata?.description).toHaveLength(1600);
  });
  it('resolves exact identities, keeps token metrics distinct, and never invents market time', () => {
    const p = parseGmgnMarket(fixture(), token, at, at + 1000);
    expect(p).toMatchObject({address: pool, token, liquidityUsd: 20000, change1h: 25, change24h: 100, buys: 30,
      discoveredAt: at, marketData: {source: 'GMGN', requestedAt: at, receivedAt: at + 1000, providerAsOf: null, priceScope: 'token', metricsScope: 'token'}});
    expect(p).not.toHaveProperty('marketAt');
  });

  it('rejects wrong tokens, inconsistent biggest pools, self pools and unsupported exchanges', () => {
    for (const mutate of [
      (r: any) => r.address = quote, (r: any) => r.pool.base_address = quote,
      (r: any) => r.price.address = quote, (r: any) => r.biggest_pool_address = quote,
      (r: any) => r.pool.pool_address = token, (r: any) => r.pool.pool_address = '0x' + '0'.repeat(40),
      (r: any) => r.pool.exchange = 'unknown',
      (r: any) => { r.pool.pool_address = quote; r.biggest_pool_address = quote; },
    ]) { const r = fixture(); mutate(r); expect(() => parseGmgnMarket(r, token, at, at)).toThrow(); }
  });

  it('rejects absent, empty, negative and nonfinite required metrics, instead of supplying zero', () => {
    for (const bad of [null, undefined, '', ' ', -1, Infinity, 'NaN']) {
      const r: any = fixture(); r.price.volume_24h = bad;
      expect(() => parseGmgnMarket(r, token, at, at)).toThrow();
    }
    expect(() => parseGmgnMarket(fixture(), token, at + 1, at)).toThrow();
  });

  it('single-flights and caches without refreshing receipt timestamps on a cache hit', async () => {
    let now = at;
    const read = vi.fn(async () => { now += 1000; return fixture(); });
    const market = new GmgnMarketData(read, () => now);
    const [a, b] = await Promise.all([market.poolForToken(token), market.poolForToken(token)]);
    expect(read).toHaveBeenCalledTimes(1); expect(a).toEqual(b);
    now += 15000;
    const cached = await market.pool(pool, token);
    expect(cached.discoveredAt).toBe(at); expect(read).toHaveBeenCalledTimes(1);
    cached.priceUsd = 999;
    expect((await market.pool(pool, token)).priceUsd).toBe(.01);
    now += 30000;
    await market.pool(pool, token); expect(read).toHaveBeenCalledTimes(2);
  });

  it('never switches a held pool to the new biggest pool, including after restart', async () => {
    const nextPool = '0x' + '4'.repeat(40);
    const r = fixture(); r.biggest_pool_address = nextPool; r.pool.pool_address = nextPool;
    const market = new GmgnMarketData(async () => r, () => at);
    await expect(market.pool(pool, token)).rejects.toThrow('Pool identity changed');
    expect((await market.poolForToken(token)).address).toBe(nextPool);
  });

  it('rejects stale in-flight receipts and does not serve expired data after a failed refresh', async () => {
    let now = at;
    const read = vi.fn(async () => fixture());
    const market = new GmgnMarketData(read, () => now);
    await market.poolForToken(token);
    now += 31000; read.mockRejectedValueOnce(new Error('unavailable'));
    await expect(market.poolForToken(token)).rejects.toThrow();
    read.mockImplementationOnce(async () => { now += 90001; return fixture(); });
    await expect(market.poolForToken(token)).rejects.toThrow('receipt');
  });
});

it('keeps a reported post as an unverified clue without claiming a project handle',()=>{
 const p=parseGmgnMarket({...fixture(),link:{description:'',twitter_username:'Example/status/2105504522697338933'}},token,at,at);
 expect(p.narrativeMetadata).toMatchObject({description:null,reportedXHandle:null,reportedXUrl:'https://x.com/Example/status/2105504522697338933'});
});
