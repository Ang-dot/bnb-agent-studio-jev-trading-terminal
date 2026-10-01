// Experimental simulation settings, not live-money limits or validated alpha.
export const PAPER_POLICY = Object.freeze({
  profile: 'Aggressive paper',
  orderUsd: 50,
  probeUsd: 25,
  launchMaxPositionUsd: 75,
  launchMinLiquidityUsd: 2000,
  launchFeeBps: 100,
  launchSlippageBps: 300,
  exposureFraction: 0.5,
  addGainPct: 5,
  addCooldownMs: 60000,
  rotationAfterMs: 15 * 60000,
  maxPositionUsd: 150,
  maxPositions: 10,
  maxExposureUsd: 1000,
  dailyLossUsd: 400,
  minLiquidityUsd: 5000,
  maxAgeMs: 90000,
  probeConfidence: 0.4,
  probeBuyProbability: 0.55,
  probeMinQuality: 1.25,
  maxEntryDriftPct: 5,
  confidence: 0.65,
  minQuality: 1.5,
  maxToxic: 0.4,
  feeBps: 30,
  slippageBps: 50,
  stopLossPct: 20,
  firstTakeProfitPct: 100,
  secondTakeProfitPct: 200,
  thirdTakeProfitPct: 300,
  runnerTrimOriginalFraction: 0.15,
  nearLowPct: 25,
  maxChasePct: 100,
  entryMarketCapMinUsd: 15000,
  entryMarketCapMaxUsd: 25000,
  trailingPct: 25,
});

export const isLaunchPaper = (market: string) => /^launch:0x[0-9a-f]{40}$/i.test(market);
export const paperCosts = (market: string) => isLaunchPaper(market)
  ? {feeBps: PAPER_POLICY.launchFeeBps, slippageBps: PAPER_POLICY.launchSlippageBps}
  : {feeBps: PAPER_POLICY.feeBps, slippageBps: PAPER_POLICY.slippageBps};
