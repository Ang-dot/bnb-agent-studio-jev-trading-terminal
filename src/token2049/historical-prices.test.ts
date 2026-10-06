import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { closedAsOf, getHistoricalPrices, normalizeGmgnCandles } from './historical-prices.js';

const row = (time: number, close = '0.0009') => ({ time, open: '0.0008', high: '0.0010', low: '0.0007', close, volume: '12.3456789' });

describe('captured historical prices', () => {
  it('converts milliseconds and numeric strings without rounding USD prices or volume', () => {
    const candles = normalizeGmgnCandles({ list: [row(1759679100000)] });
    expect(candles).toEqual([{ time: 1759679100, open: 0.0008, high: 0.001, low: 0.0007, close: 0.0009, volume: 12.3456789 }]);
  });

  it('deduplicates deterministically and preserves gaps without mutating captured rows', () => {
    const first = { list: [row(400000), row(100000)] };
    const second = { list: [row(100000, '0.00095')] };
    const before = structuredClone(first);
    const candles = normalizeGmgnCandles(first, second);
    expect(candles.map(candle => candle.time)).toEqual([100, 400]);
    expect(candles[0].close).toBe(0.00095);
    expect(first).toEqual(before);
  });

  it('rejects malformed observations instead of replacing missing values with zero', () => {
    expect(normalizeGmgnCandles({ list: [
      row(100000), { ...row(200000), volume: null }, { ...row(300000), high: '' },
      { ...row(400000), low: '0.002' }, { ...row(500000), close: 'NaN' },
    ] }).map(candle => candle.time)).toEqual([100]);
  });

  it('excludes unfinished minute and hourly bars at the exact evidence cutoff', () => {
    const at = Date.parse('2025-10-05T16:27:41Z') / 1000;
    const candles = normalizeGmgnCandles({ list: [row((at - 101) * 1000), row((at - 41) * 1000), row((at + 19) * 1000)] });
    expect(closedAsOf(candles, 60, at).map(candle => candle.time)).toEqual([at - 101]);
    expect(closedAsOf(candles, 60, '2025-10-05T16:28:00Z').map(candle => candle.time)).toEqual([at - 101, at - 41]);
    expect(closedAsOf(candles, 3600, at)).toEqual([]);
    expect(closedAsOf(candles, 60, 'invalid')).toEqual([]);
    expect(closedAsOf(candles, 0, at)).toEqual([]);
  });

  it('loads the four asset fixtures, merges overlapping captures, and preserves missing minutes', () => {
    const expected = { coin1: [97, 80], coin2: [81, 91], coin3: [88, 91], coin4: [130, 91] };
    for (const [id, [wideCount, eventCount]] of Object.entries(expected)) {
      const data = getHistoricalPrices(id)!;
      expect(data.wideCandles).toHaveLength(wideCount);
      expect(data.eventCandles).toHaveLength(eventCount);
      expect(data.provenance.assetId).toBe(id);
      expect(data.provenance).not.toHaveProperty('contract');
      expect(data.provenance.priceCurrency).toBe('USD');
      expect(data.provenance.sourceFiles.length).toBeGreaterThan(0);
      expect(data.provenance.sourceFiles.every(file => file.startsWith('/assets/examples/'))).toBe(true);
      expect(data.wideIntervalSeconds).toBe(3600);
      expect(data.eventIntervalSeconds).toBe(60);
      expect(new Set(data.wideCandles.map(candle => candle.time)).size).toBe(wideCount);
      expect(getHistoricalPrices(id.toUpperCase())).toBe(data);
      expect(getHistoricalPrices(`BNB-${id.toUpperCase()}`)).toBe(data);
      expect(getHistoricalPrices(`bnb-${id}`)).toBe(data);
    }
    const minutes = getHistoricalPrices('coin1')!.eventCandles;
    expect(minutes.some((candle, index) => index > 0 && candle.time - minutes[index - 1].time > 60)).toBe(true);
    expect(getHistoricalPrices('coin2')!.priceFormat.precision).toBe(4);
    expect(getHistoricalPrices('coin2')!.eventCandles[0].time).toBe(Date.parse('2025-09-21T16:40:00Z') / 1000);
    expect(getHistoricalPrices('coin3')!.eventCandles[0].time).toBe(Date.parse('2025-03-14T14:50:00Z') / 1000);
    for (const unknown of ['coin5', 'BNB-COIN5', 'coin-1', '1', '']) {
      expect(getHistoricalPrices(unknown)).toBeUndefined();
    }
  });

  it('retains every captured numerical observation under the placeholder identities', () => {
    // Hash only UTC time, OHLC and volume; identity and provenance text are intentionally excluded.
    const expected = {
      coin1: ['f10f25263728dc71e4cd9ecc842a9f8985968de8f646d7941c3d07a69ae40eaf', '910637953cd977cc8c19553ff285fb43f8f22fd9c65e8861c5c39560d03b8f0b'],
      coin2: ['f7d3ada999c4a76e2780ece415d2a14e370afb9e2990e3241510debee71395ba', '13e63a2e92906b36917a2e5b288a991e51d7eebcbfebfae1ea8b741c4ccf4a28'],
      coin3: ['01d3cf080c1f4d86498042cafd9eec2ad8a42b346ba28eb523b76e79729d627e', 'f508a61424251d575dccb2a0fcf3620b59bb15829b06166be9cf7c58b1ba5906'],
      coin4: ['82092e9f18e83e11bc8efb8154501f5c4f8712fa40dd1153ae917da0f739a6ab', 'f186ad98c9b0ece4f5756a759e24dd2f1f73e9ffd054e33cd3842b2d4340c1c6'],
    };
    for (const [id, hashes] of Object.entries(expected)) {
      const data = getHistoricalPrices(id)!;
      for (const [index, candles] of [data.wideCandles, data.eventCandles].entries()) {
        const values = candles.map(bar => [bar.time, bar.open, bar.high, bar.low, bar.close, bar.volume]);
        expect(createHash('sha256').update(JSON.stringify(values)).digest('hex')).toBe(hashes[index]);
      }
    }
  });
});
