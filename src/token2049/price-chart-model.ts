import type { Candle } from './cases.js';
import type { ChartPoint } from './chart-window.js';

export interface ChartEventAnnotation {
  id: string;
  time: number;
  title: string;
  kind: 'memory' | 'event';
}

export interface EntryToPeak {
  entryTime: number;
  entryPrice: number;
  peakTime: number;
  peakPrice: number;
  peakLabel?: string;
}

export function chartMultiplier(value = 1): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/** Display conversion only. Raw USD candles and provider volume remain untouched. */
export function scaleChartCandles(candles: readonly Candle[], multiplier = 1): Candle[] {
  const scale = chartMultiplier(multiplier);
  return candles.map(candle => ({ ...candle, open: candle.open * scale, high: candle.high * scale, low: candle.low * scale, close: candle.close * scale }));
}

export function inCoverageEvents(candles: readonly Candle[], events: readonly ChartEventAnnotation[]): ChartEventAnnotation[] {
  if (!candles.length) return [];
  const first = candles[0].time, last = candles[candles.length - 1].time;
  const seen = new Set<string>();
  return events.filter(event => {
    if (!event.id || seen.has(event.id) || !Number.isFinite(event.time) || event.time < first || event.time > last) return false;
    seen.add(event.id);
    return true;
  }).sort((a, b) => a.time - b.time);
}

/** Exact event times extend only the time scale, never OHLC or volume. */
export function withChartTimes(candles: readonly Candle[], times: readonly number[]): ChartPoint[] {
  const points: ChartPoint[] = [...candles];
  if (!candles.length) return points;
  const included = new Set(candles.map(candle => candle.time));
  for (const time of times) {
    if (!Number.isFinite(time) || time <= 0 || included.has(time)) continue;
    included.add(time);
    points.push({ time });
  }
  return points.sort((a, b) => a.time - b.time);
}

export function validEntryToPeak(value?: EntryToPeak): (EntryToPeak & { multiple: number }) | null {
  if (!value || ![value.entryTime, value.entryPrice, value.peakTime, value.peakPrice].every(Number.isFinite)
    || value.entryTime <= 0 || value.peakTime < value.entryTime || value.entryPrice <= 0 || value.peakPrice <= 0) return null;
  const multiple = value.peakPrice / value.entryPrice;
  return Number.isFinite(multiple) ? { ...value, multiple } : null;
}

export interface EventLabelPosition { id: string; x: number; left: number; width: number; lane: number | null }

/** Three bounded label lanes; higher-priority catalysts get a label before older context. */
export function layoutChartEventLabels(events: readonly { id: string; x: number; priority?: number }[], plotWidth: number, compact = false): EventLabelPosition[] {
  const width = Math.min(compact ? 78 : plotWidth > 400 ? Math.min(220, plotWidth * .36) : 120, Math.max(0, plotWidth));
  const lanes: { left: number; right: number }[][] = [[], [], []];
  return [...events].filter(event => Number.isFinite(event.x) && event.x >= 0 && event.x <= plotWidth).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.x - b.x).map(event => {
    const left = Math.max(0, Math.min(event.x - width / 2, plotWidth - width));
    const lane = lanes.findIndex(occupied => occupied.every(other => left >= other.right + 5 || left + width + 5 <= other.left));
    if (lane >= 0) lanes[lane].push({ left, right: left + width });
    return { ...event, left, width, lane: lane >= 0 ? lane : null };
  });
}
