import type { Launch, Graduation } from '../src/launches.js';
import type { LaunchActivity } from '../src/monitoring.js';
import type { Pool, Snapshot, Candle, EntrySetup } from '../src/types.js';
import { PAPER_POLICY, isLaunchPaper } from '../src/paper-settings.js';

export const launchMarketId = (token: string) => `launch:${token.toLowerCase()}`;
const fresh = (at: number, now: number) => Number.isFinite(at) && at > 0 && at <= now && now-at <= PAPER_POLICY.maxAgeMs;
export function launchPaperPool(launch: Launch, activity: LaunchActivity | undefined, now: number): Pool {
  if (!/^0x[0-9a-f]{40}$/i.test(launch.address) || /^0x0{40}$/i.test(launch.address) ||
    !['flap','fourmeme'].includes(launch.platform) || !['new','bonding','graduated_reported'].includes(launch.stage) ||
    !fresh(launch.observedAt, now) || ![launch.priceUsd, launch.liquidityUsd, launch.volume24h].every(n => n != null && Number.isFinite(n) && n >= 0) || !launch.priceUsd)
    throw new Error('Fresh launch paper mark unavailable');
  const a = activity?.token.toLowerCase() === launch.address.toLowerCase() && fresh(activity.observedAt, now) ? activity : undefined;
  return {
    address: launchMarketId(launch.address), token: launch.address.toLowerCase(), name: launch.name, symbol: launch.symbol,
    dex: `${launch.platform} · indicative paper`, priceUsd: launch.priceUsd, liquidityUsd: launch.liquidityUsd!, volume24h: launch.volume24h!,
    change1h: null, change24h: null, buys: a?.buys5m ?? null, sells: a?.sells5m ?? null,
    discoveredAt: launch.observedAt, url: `https://gmgn.ai/bsc/token/${launch.address}`,
    launchQuote: {kind:'launch-indicative', token:launch.address.toLowerCase(), platform:launch.platform, stage:launch.stage,
      observedAt:launch.observedAt, providerAsOf:null, riskFlags:launch.riskFlags, activity:a},
  };
}
export function launchPaperVerification(launch: Launch, now: number): Graduation {
  const base = {token:launch.address, checkedAt:launch.observedAt, source:'GMGN' as const};
  try {
    const pool = launchPaperPool(launch, undefined, now);
    return {...base, status:'paper_launch', pool:pool.address, poolSource:'GMGN',
      detail:'Indicative launch paper simulation available. GMGN token mark; provider price time and executable curve quote unavailable. No on-chain trade.'};
  } catch { return {...base,status:'unverified',detail:'Fresh launch price, liquidity and volume are required for paper simulation.'}; }
}
export function launchPaperSnapshot(pool: Pool, now: number): Snapshot {
  const q = pool.launchQuote;
  if (!q || !isLaunchPaper(pool.address) || pool.address !== launchMarketId(pool.token) || q.token !== pool.token || !fresh(q.observedAt,now))
    throw new Error('Launch paper identity or receipt expired');
  return {pool:pool.address, token:pool.token, name:pool.name, priceUsd:pool.priceUsd, liquidityUsd:pool.liquidityUsd,
    volume24h:pool.volume24h, change1h:null, buyCount:pool.buys, sellCount:pool.sells,
    source:'gmgn-paper', launchQuote:q, observedAt:q.observedAt,
    // Zero explicitly means unavailable, never the receipt disguised as a trade time.
    marketAt:0, metricsSource:'GMGN', metricsScope:'token', metricsReceivedAt:q.observedAt,
    candleId:`${pool.address}:${Math.floor(q.observedAt/60000)}`};
}

// "Bottom" is only a recent observed range low, never a claim about the future low.
export function launchEntrySetup(launch: Launch, candles: Candle[], now: number): EntrySetup {
  // Early curves need a recent base, rather than anchoring every entry to their launch price.
  const lookbackMinutes = ['new','bonding'].includes(launch.stage) ? 5 : 30;
  const recent=candles.filter(c=>Number.isFinite(c.time)&&c.time*1000<=now&&c.time*1000>=now-lookbackMinutes*60000&&Number.isFinite(c.low)&&c.low>0)
    .sort((a,b)=>a.time-b.time);
  // GMGN 1m timestamps label the opening of each bucket. Preserve them;
  // freshness of historical range coverage is measured from the bucket end.
  const candleIntervalMs = 60000;
  const covered=recent.length>=3 && recent.at(-1)!.time-recent[0].time>=120 && now-recent.at(-1)!.time*1000<=PAPER_POLICY.maxAgeMs+candleIntervalMs;
  const low=covered?Math.min(...recent.map(c=>c.low)):null;
  return {token:launch.address.toLowerCase(),observedAt:launch.observedAt,source:'GMGN',lookbackMinutes,candleIntervalMs,
    marketCapUsd:launch.marketCapUsd!=null&&Number.isFinite(launch.marketCapUsd)&&launch.marketCapUsd>0?launch.marketCapUsd:null,
    rangeLowUsd:low,distanceFromLowPct:low&&launch.priceUsd?Math.max(0,(launch.priceUsd/low-1)*100):null,
    candleFrom:covered?recent[0].time*1000:null,candleTo:covered?recent.at(-1)!.time*1000:null};
}
