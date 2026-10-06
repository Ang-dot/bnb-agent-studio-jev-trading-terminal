export type CoinAsset = { caseId: string; name: string; src: string; alt: string; accent: string };

/** Generic artwork and labels identify presentation cases, never tradable assets. */
export const coinAssets: Record<string, CoinAsset> = Object.fromEntries([1, 2, 3, 4].map(index => {
  const caseId = `coin${index}`, name = `BNB-COIN${index}`;
  return [caseId, { caseId, name, src: '/assets/coins/coin.svg', alt: `${name} generic coin placeholder`, accent: '#F0B90B' }];
}));
export function getCoinAsset(caseId: string): CoinAsset | undefined {
  return Object.hasOwn(coinAssets, caseId) ? coinAssets[caseId] : undefined;
}
