// Experimental simulation settings, not live-money limits or validated alpha.
export const PAPER_POLICY = Object.freeze({
  orderUsd: 50,
  maxPositionUsd: 150,
  maxPositions: 6,
  maxExposureUsd: 600,
  dailyLossUsd: 200,
  minLiquidityUsd: 20000,
  maxAgeMs: 90000,
  confidence: 0.8,
  minQuality: 2,
  maxToxic: 0.25,
  feeBps: 30,
  slippageBps: 50,
  stopLossPct: 25,
  firstTakeProfitPct: 50,
  secondTakeProfitPct: 100,
  trailingPct: 25,
});
