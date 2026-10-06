import type { PriceFormatBuiltIn } from 'lightweight-charts';
import type { Candle } from './cases.js';
import archiveJson from './historical-prices.data.json?raw';

export interface HistoricalPriceProvenance {
  provider: 'GMGN';
  chain: 'bsc';
  assetId: string;
  priceCurrency: 'USD';
  capturedOn: '2026-10-05';
  captureNote: string;
  sourceFiles: string[];
  volumeNote: string;
  gapPolicy: string;
}

export interface HistoricalPrices {
  wideCandles: Candle[];
  eventCandles: Candle[];
  wideIntervalSeconds: 3600;
  eventIntervalSeconds: 60;
  provenance: HistoricalPriceProvenance;
  priceFormat: PriceFormatBuiltIn;
}

const archive = JSON.parse(archiveJson) as Record<string, unknown>;

function finiteNumber(value: unknown): number {
  return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN;
}

/** GMGN capture timestamps are milliseconds. Later valid duplicates replace earlier ones. */
export function normalizeGmgnCandles(...captures: unknown[]): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const capture of captures) {
    const rows = Array.isArray(capture) ? capture : capture && typeof capture === 'object' && 'list' in capture && Array.isArray(capture.list) ? capture.list : [];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const raw = row as Record<string, unknown>;
      const milliseconds = finiteNumber(raw.time);
      const open = finiteNumber(raw.open), high = finiteNumber(raw.high), low = finiteNumber(raw.low), close = finiteNumber(raw.close), volume = finiteNumber(raw.volume);
      if (![milliseconds, open, high, low, close, volume].every(Number.isFinite)) continue;
      if (milliseconds <= 0 || Math.min(open, high, low, close) <= 0 || volume < 0 || high < Math.max(open, close) || low > Math.min(open, close)) continue;
      const time = Math.floor(milliseconds / 1000);
      byTime.set(time, { time, open, high, low, close, volume });
    }
  }
  // Missing buckets remain missing; volume stays in the provider's reported unit.
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/** Numeric cutoffs are UTC seconds; ISO strings retain sub-second precision. */
export function closedAsOf(candles: readonly Candle[], intervalSeconds: number, cutoff: number | string): Candle[] {
  const at = typeof cutoff === 'string' ? Date.parse(cutoff) / 1000 : cutoff;
  if (!Number.isFinite(at) || !Number.isFinite(intervalSeconds) || intervalSeconds <= 0) return [];
  return candles.filter(candle => Number.isFinite(candle.time) && candle.time + intervalSeconds <= at);
}

const definitions = {
  coin1: { wide: ['coin1-wide-1.json'], event: 'coin1-event.json' },
  coin2: { wide: ['coin2-wide-1.json'], event: 'coin2-event.json' },
  coin3: { wide: ['coin3-wide-1.json'], event: 'coin3-event.json' },
  coin4: { wide: ['coin4-wide-1.json', 'coin4-wide-2.json'], event: 'coin4-event.json' },
} as const;
type HistoricalCaseId = keyof typeof definitions;

const prices = Object.fromEntries(Object.entries(definitions).map(([id, definition]) => {
  const wideCandles = normalizeGmgnCandles(...definition.wide.map(file => archive[file]));
  const eventCandles = normalizeGmgnCandles(archive[definition.event]);
  const precision = id === 'coin2' ? 4 : 8;
  const data: HistoricalPrices = {
    wideCandles, eventCandles, wideIntervalSeconds: 3600, eventIntervalSeconds: 60,
    provenance: {
      provider: 'GMGN', chain: 'bsc', assetId: id, priceCurrency: 'USD', capturedOn: '2026-10-05',
      captureNote: 'Historical candles retained for an educational illustration. Original token identity and direct source links are omitted. Timestamps are candle bucket opens.',
      sourceFiles: ['/assets/examples/selected-periods.json'],
      volumeNote: 'Provider-reported volume is retained without conversion. Its unit is unverified; it is not labeled USD volume.',
      gapPolicy: 'No interpolated or appended candles. Duplicate bucket opens use the later listed capture.',
    },
    priceFormat: { type: 'price', precision, minMove: 10 ** -precision },
  };
  return [id, data];
})) as Record<HistoricalCaseId, HistoricalPrices>;

export function getHistoricalPrices(id: string): HistoricalPrices | undefined {
  const canonical = id.trim().toLowerCase().replace(/^bnb-/, '');
  return Object.hasOwn(prices, canonical) ? prices[canonical as HistoricalCaseId] : undefined;
}
