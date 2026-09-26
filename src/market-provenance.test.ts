import { describe, expect, it } from 'vitest';
import { marketSources } from './market-provenance';
describe('market source labels', () => {
  it('labels authenticated on-chain pool trades as GeckoTerminal, not an indicative chart price',()=>{
    expect(marketSources({source:'coingecko',metricsSource:'GMGN'} as any).price).toBe('GeckoTerminal · pool trade');
  });
  it('separates new GMGN token metrics from Bitquery pool prices', () => {
    expect(marketSources({source:'bitquery',metricsSource:'GMGN',metricsScope:'token'} as any))
      .toEqual({price:'Bitquery · pool trade',metrics:'GMGN · token-wide volume/change/1h counts; matching-pool liquidity'});
  });
  it('preserves the provenance of historical records instead of relabeling them GMGN', () => {
    expect(marketSources({source:'bitquery'} as any).metrics).toContain('GeckoTerminal');
    expect(marketSources({source:'geckoterminal'} as any).price).toContain('GeckoTerminal');
  });
});
