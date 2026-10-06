import type { Candle } from './cases.js';
import archiveJson from './chart-metrics.data.json?raw';

export interface ChartMetrics {
  caseId: string;
  assetId: string;
  /** Historical USD prices. Times are UTC candle-open seconds. */
  dailyCandles: Candle[];
  entry: {
    /** Frozen assessment cutoff, not a transaction or fill. */
    time: number;
    candleOpenTime: number;
    candleCloseTime: number;
    price: number;
  };
  supply: {
    tokens: number;
    label: 'FDV';
    basis: string;
    verifiedAt: string;
    historicalMarketCapAvailable: false;
    sourceNote: string;
  };
  peak: {
    /** Open of the interval containing the high; exact trade time is unknown. */
    time: number;
    intervalSeconds: number;
    price: number;
    multiple: number;
    changePercent: number;
    isAllTimeHigh: boolean;
    note: string;
  };
  allTimeHigh: {
    time: number;
    intervalSeconds: number;
    price: number;
    note: string;
  };
  coverage: {
    /** First daily candle open and last observed interval end, in UTC seconds. */
    from: number;
    to: number;
    retrievedAt: string;
    missingDays: number[];
    complete: boolean;
    latestCandleComplete: boolean;
    note: string;
  };
  provenanceUrl: string;
}

const metrics = JSON.parse(archiveJson) as Record<string, ChartMetrics>;
export function getChartMetrics(id: string): ChartMetrics | undefined {
  const key = id.trim().toLowerCase().replace(/^bnb-/, '');
  return Object.hasOwn(metrics, key) ? metrics[key] : undefined;
}

export const chartMetrics = metrics;
