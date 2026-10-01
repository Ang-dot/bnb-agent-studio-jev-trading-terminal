import type { Snapshot } from './types';

export function marketSources(snapshot: Snapshot) {
  return {
    price: snapshot.source === 'gmgn-paper' ? 'GMGN · indicative launch paper mark (price time unknown)' : snapshot.source === 'bitquery' ? 'Bitquery · pool trade' : snapshot.source === 'coingecko' ? 'GeckoTerminal · pool trade' : 'GeckoTerminal · indicative pool price',
    // Missing fields belong to historical records, never retroactively GMGN.
    metrics: snapshot.source === 'gmgn-paper' ? 'GMGN · reported launch liquidity, token volume and 5m counts' : snapshot.metricsSource === 'GMGN'
      ? 'GMGN · token-wide volume/change/1h counts; matching-pool liquidity'
      : 'GeckoTerminal · pool metrics',
  };
}
