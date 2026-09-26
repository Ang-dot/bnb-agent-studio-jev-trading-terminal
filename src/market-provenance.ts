import type { Snapshot } from './types';

export function marketSources(snapshot: Snapshot) {
  return {
    price: snapshot.source === 'bitquery' ? 'Bitquery · pool trade' : 'GeckoTerminal · indicative pool price',
    // Missing fields belong to historical records, never retroactively GMGN.
    metrics: snapshot.metricsSource === 'GMGN'
      ? 'GMGN · token-wide volume/change/1h counts; matching-pool liquidity'
      : 'GeckoTerminal · pool metrics',
  };
}
