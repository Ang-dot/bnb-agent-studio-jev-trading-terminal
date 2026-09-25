export interface EvidenceReceipt {
  key: string;
  source: "GMGN";
  requestedAt: number;
  receivedAt: number;
  providerAsOf: null;
  status: "ready" | "error" | "invalid" | "unavailable";
  availability: Record<string, "present" | "missing">;
}
export interface WalletEvidence {
  address: string;
  sample: "holders" | "traders";
  tags: string[];
  holdingShare: number | null;
  holdingUsd: number | null;
  buyUsd: number | null;
  sellUsd: number | null;
  profitUsd: number | null;
  realizedUsd: number | null;
  unrealizedUsd: number | null;
  lastActiveAt: number | null;
}
export interface SupportingEvidence {
  id: string;
  version: 1;
  mode: "shadow";
  token: string;
  startedAt: number;
  completedAt: number;
  sources: EvidenceReceipt[];
  creator: {
    address: string | null;
    totalLaunches: number | null;
    graduated: number | null;
    graduationRate: number | null;
    priorTokens: { address: string; symbol: string; createdAt: number; peakMarketCapUsd: number | null }[];
    returnedTokenCount: number | null;
  };
  top10Share: number | null;
  creatorShare: number | null;
  wallets: WalletEvidence[];
  excludedPoolRows: number;
  walletCounts: Record<string, number | null>;
  pool: {
    address: string | null;
    exchange: string | null;
    quoteSymbol: string | null;
    quoteAddress: string | null;
    createdAt: number | null;
    baseReserve: number | null;
    quoteReserve: number | null;
    baseUsd: number | null;
    quoteUsd: number | null;
    impact50Pct: number | null;
    impact150Pct: number | null;
  };
  flow: { window: "1m" | "5m" | "1h"; buyUsd: number | null; sellUsd: number | null; netUsd: number | null; swaps: number | null; priceChangePct: number | null }[];
  events: { wallet: string; side: "buy" | "sell"; usd: number | null; time: number; tx: string | null; tags: string[] }[];
  comparison?: { previousId: string; previousAt: number; top10DeltaPp: number | null; wallets: { address: string; shareDeltaPp: number; }[] };
}
