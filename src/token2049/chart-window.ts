import type { Candle } from './cases.js';

export type ChartWindow =
  | { mode: 'all' | 'focus' | 'lead-in' }
  | { mode: 'custom'; from: number; to: number };

export interface ChartTimeRange { from: number; to: number }
export type ChartPoint = Candle | { time: number };
type TimedCandle = Pick<Candle, 'time'>;

export const DEFAULT_CHART_WINDOW: ChartWindow = { mode: 'all' };
export const CHART_WINDOW_PRESETS = [
  { mode: 'focus', label: 'Focus', description: 'Most recent 16 provided candles' },
  { mode: 'lead-in', label: 'More context', description: 'Most recent 32 provided candles' },
  { mode: 'all', label: 'Full timeline', description: 'Every candle currently supplied to the chart' },
] as const;

function providedTimes(candles: readonly TimedCandle[]): number[] {
  return [...new Set(candles.map(candle => candle.time).filter(Number.isFinite))].sort((a, b) => a - b);
}

export function chartCoverage(candles: readonly TimedCandle[]): (ChartTimeRange & { count: number }) | null {
  const times = providedTimes(candles);
  return times.length ? { from: times[0], to: times[times.length - 1], count: times.length } : null;
}

/** Viewport bounds only: never generates, resamples or mutates candles or evidence. */
export function resolveChartWindow(candles: readonly TimedCandle[], window: ChartWindow = DEFAULT_CHART_WINDOW): ChartTimeRange | null {
  const times = providedTimes(candles);
  if (times.length < 2) return null;
  const last = times[times.length - 1];
  if (window.mode === 'custom') {
    if (!Number.isFinite(window.from) || !Number.isFinite(window.to) || window.from >= window.to) return null;
    const from = Math.max(times[0], window.from), to = Math.min(last, window.to);
    const contained = times.filter(time => time >= from && time <= to);
    if (from >= to || contained.length < 2) return null;
    // Exact supplied timestamps prevent the chart API from rounding the end into a later bucket.
    return { from: contained[0], to: contained[contained.length - 1] };
  }
  const count = window.mode === 'focus' ? 16 : window.mode === 'lead-in' ? 32 : times.length;
  return { from: times[Math.max(0, times.length - count)], to: last };
}

/** Later-price review can close again while a custom range is selected. */
export function availableChartWindow(candles: readonly TimedCandle[], window: ChartWindow): ChartWindow {
  return window.mode === 'custom' && !resolveChartWindow(candles, window) ? DEFAULT_CHART_WINDOW : window;
}

/** Preserve event time; optionally position an event inside its supplied OHLC bucket. */
export function decisionMarkerAnchors<T extends { date: string }>(candles: readonly TimedCandle[], steps: readonly T[], intervalSeconds?: number): { step: T; index: number; time: number; eventTime: number }[] {
  const times = providedTimes(candles);
const available = new Set(times);
  const canBucket = intervalSeconds !== undefined && Number.isFinite(intervalSeconds) && intervalSeconds > 0;
  return steps.flatMap((step, index) => {
    const eventTime = Math.floor(Date.parse(step.date) / 1000);
    if (!Number.isFinite(eventTime)) return [];
    if (available.has(eventTime)) return [{ step, index, time: eventTime, eventTime }];
    if (!canBucket) return [];
    // A gap or an event beyond the final candle's interval is not chart coverage.
    let time: number | undefined;
    for (let candleIndex = times.length - 1; candleIndex >= 0; candleIndex--) {
      if (times[candleIndex] <= eventTime) { time = times[candleIndex]; break; }
    }
    return time !== undefined && eventTime < time + intervalSeconds!
      ? [{ step, index, time, eventTime }]
      : [];
  });
}

/** An exact event cursor needs a time-scale point, never an invented price or volume. */
export function withDecisionWhitespace(candles: readonly Candle[], decisionTime?: number): ChartPoint[] {
  if (!candles.length || decisionTime === undefined || !Number.isFinite(decisionTime) || decisionTime <= 0 || candles.some(candle => candle.time === decisionTime)) return [...candles];
  return [...candles, { time: decisionTime }].sort((a, b) => a.time - b.time);
}

export function toUtcInput(time: number): string {
  return Number.isFinite(time) ? new Date(time * 1000).toISOString().slice(0, 19) : '';
}

export function fromUtcInput(value: string): number {
  // datetime-local has no zone; these controls explicitly present and accept UTC.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return NaN;
  return Date.parse(`${value}Z`) / 1000;
}
