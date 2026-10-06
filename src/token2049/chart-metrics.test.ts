import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chartMetrics, getChartMetrics } from './chart-metrics.js';

const records = JSON.parse(readFileSync(new URL('./recorded-evaluations.json', import.meta.url), 'utf8')) as Array<{caseId: string; cutoff: string}>;
const sourceArchive = JSON.parse(readFileSync(new URL('./historical-prices.data.json', import.meta.url), 'utf8')) as Record<string, {list: Array<Record<string, string | number>>}>;
const expected = {
  coin1: { days: 606, cutoff: '2025-03-17T07:45:00Z', entry: 0.002233394, peak: 0.29450416, hash: '65d4dcb57cea36af830ff4aa1b4b13c1a4951225654395c0c108ad72fcbfb476' },
  coin2: { days: 379, cutoff: '2025-09-21T17:08:00Z', entry: 3.37188713, peak: 294.90464454, hash: 'de1b23961be2ea18718cb2fac0b2dee78e128f02b12898d792c19275c574a2a6' },
  coin3: { days: 571, cutoff: '2025-03-14T15:35:00Z', entry: 0.0062887072, peak: 0.27092449, hash: '9b723b80059ea7dd5712ce1507b44a346acbc6a29b0a220342dd81c0ed492b0f' },
  coin4: { days: 366, cutoff: '2025-10-05T16:28:00Z', entry: 0.0044539067, peak: 0.90255278, hash: '5bd19a5f94490921eda8e563d3b2c1adb3823b59356c29f73b9e2ff763f6f990' },
};

describe('historical chart metric provenance', () => {
  it('contains exactly four placeholder assets and accepts only their supported aliases', () => {
    expect(Object.keys(chartMetrics).sort()).toEqual(['coin1', 'coin2', 'coin3', 'coin4']);
    for (const id of Object.keys(expected)) {
      expect(getChartMetrics(id.toUpperCase())).toBe(getChartMetrics(id));
      expect(getChartMetrics(`BNB-${id.toUpperCase()}`)).toBe(getChartMetrics(id));
      expect(getChartMetrics(`bnb-${id}`)).toBe(getChartMetrics(id));
    }
    for (const unknown of ['coin5', 'BNB-COIN5', 'coin-1', '1', '']) {
      expect(getChartMetrics(unknown)).toBeUndefined();
    }
  });

  for (const [id, snapshot] of Object.entries(expected)) {
    it(`${id}: anchors its ratio to the latest available completed minute at the frozen cutoff`, () => {
      const metrics = getChartMetrics(id)!;
      const cutoff = Date.parse(records.find(row => row.caseId === id)!.cutoff) / 1000;
      expect(cutoff).toBe(Date.parse(snapshot.cutoff) / 1000);
      const rows = sourceArchive[`${id}-event.json`].list.filter(row => Number(row.time) / 1000 + 60 <= cutoff);
      const reference = rows.reduce((latest, row) => Number(row.time) > Number(latest.time) ? row : latest);
      expect(metrics.entry.time).toBe(cutoff);
      expect(metrics.entry.candleOpenTime).toBe(Number(reference.time) / 1000);
      expect(metrics.entry.candleCloseTime).toBe(Number(reference.time) / 1000 + 60);
      expect(metrics.entry.candleCloseTime).toBeLessThanOrEqual(cutoff);
      expect(metrics.entry.price).toBe(Number(reference.close));
      expect(metrics.entry.price).toBe(snapshot.entry);
      expect(metrics.peak.price).toBe(snapshot.peak);
      expect(metrics.peak.multiple).toBeCloseTo(metrics.peak.price / Number(reference.close), 10);
      expect(metrics.peak.changePercent).toBeCloseTo((metrics.peak.price / Number(reference.close) - 1) * 100, 8);
    });

    it(`${id}: preserves every daily observation and qualifies the incomplete final day`, () => {
      const metrics = getChartMetrics(id)!;
      const { dailyCandles, coverage, entry, peak, supply } = metrics;
      expect(metrics.assetId).toBe(id);
      expect(metrics).not.toHaveProperty('contract');
      expect(coverage.complete).toBe(true);
      expect(coverage.missingDays).toEqual([]);
      expect(dailyCandles).toHaveLength(snapshot.days);
      const values = dailyCandles.map(bar => [bar.time, bar.open, bar.high, bar.low, bar.close, bar.volume]);
      expect(createHash('sha256').update(JSON.stringify(values)).digest('hex')).toBe(snapshot.hash);
      for (let index = 0; index < dailyCandles.length; index++) {
        const bar = dailyCandles[index];
        expect(bar.time % 86400).toBe(0);
        expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close, bar.low));
        expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close));
        expect(bar.volume).toBeGreaterThanOrEqual(0);
        if (index) expect(bar.time - dailyCandles[index - 1].time).toBe(86400);
      }
      expect(peak.time).toBeGreaterThanOrEqual(entry.time);
      expect(peak.price).toBe(Math.max(...dailyCandles.filter(bar => bar.time >= entry.time).map(bar => bar.high)));
      const retrievedAt = Date.parse(coverage.retrievedAt) / 1000;
      expect(coverage.to).toBeLessThanOrEqual(retrievedAt);
      expect(coverage.latestCandleComplete).toBe(dailyCandles.at(-1)!.time + 86400 <= retrievedAt);
      expect(supply.label).toBe('FDV');
      expect(supply.historicalMarketCapAvailable).toBe(false);
      expect(supply.tokens).toBe(id === 'coin2' ? 1_000_000 : 1_000_000_000);
      expect(supply.sourceNote).toEqual(expect.any(String));
      expect(supply.sourceNote.length).toBeGreaterThan(0);
      expect(supply).not.toHaveProperty('sourceUrls');
    });
  }

  it('preserves the available-minute gap instead of moving the reference to the decision minute', () => {
    const entry = getChartMetrics('coin1')!.entry;
    expect(entry.time - entry.candleCloseTime).toBe(60);
    expect(entry.candleCloseTime - entry.candleOpenTime).toBe(60);
  });
});
