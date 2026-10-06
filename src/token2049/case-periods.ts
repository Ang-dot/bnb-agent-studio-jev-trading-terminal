import { getChartMetrics, type ChartMetrics } from './chart-metrics.js';
import type { Candle } from './cases.js';
import displayArchiveJson from './case-period-candles.data.json?raw';

interface PeriodDisplayCapture {
  intervalSeconds: number;
  intervalLabel: '1D' | '4H' | '1H';
  candles: Candle[];
  coverage: {
    from: number;
    to: number;
    missingIntervals: number[];
    leadingEmptyIntervals: number;
    note: string;
  };
}

const displayArchive = JSON.parse(displayArchiveJson) as Record<string, PeriodDisplayCapture>;

export interface CasePeriod extends ChartMetrics {
  displayCandles: Candle[];
  displayIntervalSeconds: number;
  displayIntervalLabel: '1D' | '4H' | '1H';
  /** Actual display-candle open containing the canonical high; null means no verified match. */
  displayPeakTime: number | null;
  displayCoverage: PeriodDisplayCapture['coverage'];
  period: {
    /** Inclusive first candle open, in UTC seconds. */
    from: number;
    /** Exclusive end, in UTC seconds. */
    to: number;
    label: string;
    note: string;
  };
}

const endDates: Record<string, string> = {
  coin1: '2025-09-23T00:00:00Z',
  coin2: '2025-10-28T00:00:00Z',
  coin3: '2025-03-21T00:00:00Z',
  coin4: '2025-10-11T00:00:00Z',
};

const day = 86_400;
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** The case-study window is curated; the underlying longer source archive is unchanged. */
export function getCasePeriod(id: string): CasePeriod | undefined {
  const source = getChartMetrics(id);
  if (!source || !endDates[source.caseId]) return undefined;
  const to = Date.parse(endDates[source.caseId]) / 1000;
  const from = source.dailyCandles[0]?.time;
  if (from === undefined) return undefined;
  const dailyCandles = source.dailyCandles.filter(bar => bar.time >= from && bar.time < to);
  // A daily bucket that straddles the decision cannot establish a later high.
  const later = dailyCandles.filter(bar => bar.time >= source.entry.time);
  if (!later.length) return undefined;
  const peak = later.reduce((highest, bar) => bar.high > highest.high ? bar : highest);
  const display = displayArchive[source.caseId];
  if (!display) return undefined;
  const displayCandles = display.candles.filter(bar => bar.time >= from && bar.time + display.intervalSeconds <= to);
  const tolerance = Math.max(1e-12, Math.abs(peak.high) * 1e-10);
  const matchingHigh = displayCandles.find(bar =>
    bar.time >= source.entry.time && bar.time >= peak.time && bar.time < peak.time + day && Math.abs(bar.high - peak.high) <= tolerance,
  );
  const present = new Set(dailyCandles.map(bar => bar.time));
  const missingDays: number[] = [];
  for (let time = from; time < to; time += day) if (!present.has(time)) missingDays.push(time);
  const label = `${shortDate.format(from * 1000)} – ${fullDate.format((to - day) * 1000)}`;
  const periodNote = 'Retrospectively selected case-study period, from the earliest captured launch day through two calendar days after this narrative-cycle high. This is a display window, not an assumed holding period or trade exit.';

  return {
    ...source,
    dailyCandles,
    displayCandles,
    displayIntervalSeconds: display.intervalSeconds,
    displayIntervalLabel: display.intervalLabel,
    displayPeakTime: matchingHigh?.time ?? null,
    displayCoverage: display.coverage,
    peak: {
      time: peak.time,
      intervalSeconds: day,
      price: peak.high,
      multiple: peak.high / source.entry.price,
      changePercent: (peak.high / source.entry.price - 1) * 100,
      isAllTimeHigh: false,
      note: 'Recorded period high: the greatest observed post-decision daily high inside the selected display period. Its timestamp is the candle interval open; the exact trade time is unknown. The reference is a completed minute candle, not a fill. Endpoint ratios omit the intervening price path, fees, taxes, slippage and liquidity.',
    },
    coverage: {
      ...source.coverage,
      from,
      to,
      missingDays,
      complete: missingDays.length === 0,
      latestCandleComplete: to <= Date.parse(source.coverage.retrievedAt) / 1000,
      note: 'Coverage here describes only the selected display period. Every displayed candle comes from the unchanged longer GMGN source archive; missing buckets are not generated.',
    },
    period: { from, to, label, note: periodNote },
    provenanceUrl: '/assets/examples/selected-periods.json',
  };
}
