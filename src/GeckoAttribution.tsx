import type { Snapshot } from './types.js';

// Official on-chain attribution covers the authenticated API as well as public REST.
export function GeckoAttribution({snapshot}:{snapshot?:Snapshot}) {
  if (!snapshot || !['coingecko','geckoterminal'].includes(snapshot.source)) return null;
  return <p className="gecko-attribution"><small>On-chain data provided by <a href="https://www.geckoterminal.com" target="_blank" rel="noopener noreferrer">GeckoTerminal</a></small></p>;
}
