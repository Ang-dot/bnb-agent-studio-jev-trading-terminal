import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getCasePeriod } from './case-periods.js';
import { getChartMetrics } from './chart-metrics.js';

const expected = [
  ['coin1', '2025-02-06', '2025-09-23', '2025-09-20', 0.18597036],
  ['coin2', '2025-09-21', '2025-10-28', '2025-10-25', 294.90464454],
  ['coin3', '2025-03-13', '2025-03-21', '2025-03-18', 0.27092449],
  ['coin4', '2025-10-04', '2025-10-11', '2025-10-08', 0.52293423],
] as const;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`) / 1000;

describe('curated case-study periods', () => {
  for (const [id, first, exclusiveEnd, peakDay, high] of expected) {
    it(`${id}: ends after the selected cycle and retains the original entry reference`, () => {
      const archive = getChartMetrics(id)!;
      const originalLength = archive.dailyCandles.length;
      const period = getCasePeriod(id)!;
      expect(period.period.from).toBe(utc(first));
      expect(period.period.to).toBe(utc(exclusiveEnd));
      expect(period.dailyCandles[0].time).toBe(utc(first));
      expect(period.dailyCandles.at(-1)!.time).toBe(utc(exclusiveEnd) - 86_400);
      expect(period.dailyCandles.every(bar => bar.time < period.period.to)).toBe(true);
      expect(period.peak.time).toBe(utc(peakDay));
      expect(period.peak.price).toBe(high);
      expect(period.period.to - period.peak.time).toBe(3 * 86_400);
      expect(period.peak.multiple).toBeCloseTo(high / archive.entry.price, 10);
      expect(period.peak.changePercent).toBeCloseTo((high / archive.entry.price - 1) * 100, 8);
      expect(period.peak.isAllTimeHigh).toBe(false);
      expect(period.entry).toEqual(archive.entry);
      expect(period.supply).toEqual(archive.supply);
      expect(period.coverage.complete).toBe(true);
      expect(period.coverage.latestCandleComplete).toBe(true);
      expect(archive.dailyCandles).toHaveLength(originalLength);
      expect(period.dailyCandles.length).toBeLessThan(originalLength);
    });
  }

  it('keeps the selected cycle high separate from later archive values', () => {
    expect(getChartMetrics('coin1')!.peak.price).toBe(0.29450416);
    expect(getCasePeriod('coin1')!.peak.price).toBe(0.18597036);
    expect(getCasePeriod('coin1')!.peak.price * getCasePeriod('coin1')!.supply.tokens).toBe(185_970_360);
  });

  it('preserves placeholder aliases and rejects unknown assets', () => {
    expect(getCasePeriod('BNB-COIN4')?.caseId).toBe('coin4');
    expect(getCasePeriod('coin5')).toBeUndefined();
  });

  it('exports the exact displayed period calculation for all four cases', () => {
    const exported = JSON.parse(readFileSync(new URL('../../public/assets/examples/selected-periods.json', import.meta.url), 'utf8'));
    const archiveBytes = readFileSync(new URL('./chart-metrics.data.json', import.meta.url));
    expect(exported.sourceArchiveSha256).toBe(createHash('sha256').update(archiveBytes).digest('hex'));
    const displayBytes = readFileSync(new URL('./case-period-candles.data.json', import.meta.url));
    expect(exported.displaySourceArchiveSha256).toBe(createHash('sha256').update(displayBytes).digest('hex'));
    expect(Object.keys(exported.cases).sort()).toEqual(['coin1', 'coin2', 'coin3', 'coin4']);
    for (const [id] of expected) {
      const period = getCasePeriod(id)!;
      const record = exported.cases[id];
      expect(period.provenanceUrl).toBe('/assets/examples/selected-periods.json');
      expect(record.period).toEqual(period.period);
      expect(record.entry).toEqual(period.entry);
      expect(record.supply).toEqual(period.supply);
      expect(record.dailyCandleCount).toBe(period.dailyCandles.length);
      expect(record.display.candleCount).toBe(period.displayCandles.length);
      expect(record.display.intervalSeconds).toBe(period.displayIntervalSeconds);
      expect(record.display.intervalLabel).toBe(period.displayIntervalLabel);
      expect(record.display.peakTime).toBe(period.displayPeakTime);
      expect(record.display.coverage).toEqual(period.displayCoverage);
      const { isAllTimeHigh: _ignored, ...periodPeak } = period.peak;
      expect(record.peak).toEqual(periodPeak);
      expect(record.peak.time).toBeGreaterThanOrEqual(record.entry.time);
      expect(record.peak.time).toBeLessThan(record.period.to);
    }
  });

  const adaptive = [
    ['coin1', 86_400, '1D', 229, '2025-09-20T00:00:00Z', 0],
    ['coin2', 14_400, '4H', 218, '2025-10-25T04:00:00Z', 4],
    ['coin3', 3_600, '1H', 183, '2025-03-18T17:00:00Z', 9],
    ['coin4', 3_600, '1H', 153, '2025-10-08T04:00:00Z', 15],
  ] as const;

  for (const [id, interval, label, count, highAt, leading] of adaptive) {
    it(`${id}: locates its high on a genuine display candle at the selected interval`, () => {
      const period = getCasePeriod(id)!;
      expect(period.displayIntervalSeconds).toBe(interval);
      expect(period.displayIntervalLabel).toBe(label);
      expect(period.displayCandles).toHaveLength(count);
      expect(period.displayPeakTime).toBe(Date.parse(highAt) / 1000);
      const peakBar = period.displayCandles.find(bar => bar.time === period.displayPeakTime)!;
      expect(peakBar.high).toBe(period.peak.price);
      expect(peakBar.time).toBeGreaterThanOrEqual(period.entry.time);
      expect(period.peak.price).toBe(Math.max(...period.displayCandles.filter(bar => bar.time >= period.entry.time).map(bar => bar.high)));
      expect(period.displayCoverage.missingIntervals).toEqual([]);
      expect(period.displayCoverage.leadingEmptyIntervals).toBe(leading);
      expect(period.displayCoverage.from - period.period.from).toBe(leading * interval);
      expect(period.displayCoverage.to).toBe(period.period.to);
      for (let i = 0; i < period.displayCandles.length; i++) {
        const bar = period.displayCandles[i];
        expect(bar.time % interval).toBe(0);
        expect(bar.time + interval).toBeLessThanOrEqual(period.period.to);
        if (i) expect(bar.time - period.displayCandles[i - 1].time).toBe(interval);
      }
    });
  }

  it('preserves the normalized display fixtures without filling absent buckets', () => {
    const archive = JSON.parse(readFileSync(new URL('./case-period-candles.data.json', import.meta.url), 'utf8'));
    const expectedHashes = {
      coin1: '210de3ef377a04763a78a9b2f5517f056f93812584e67b239258d1c71d419f1e',
      coin2: '627463878e747bd3a65fe545b4b8c086a49f657ced4e711a5273f0ac72ed31e1',
      coin3: '8b7e17f130918d831fd17a5e5e7c758605df595674c24ce838b3bc847c5d4a5e',
      coin4: 'c2362a1a9113d61f932bb50b39e06f8a44a98f73ef80f8f9042f650c0fed13b8',
    };
    expect(Object.keys(archive).sort()).toEqual(Object.keys(expectedHashes));
    for (const [id, hash] of Object.entries(expectedHashes)) {
      const period = getCasePeriod(id)!;
      expect(period.displayCandles).toEqual(archive[id].candles);
      expect(archive[id]).not.toHaveProperty('captures');
      expect(archive[id]).not.toHaveProperty('contract');
      const values = period.displayCandles.map(bar => [bar.time, bar.open, bar.high, bar.low, bar.close, bar.volume]);
      expect(createHash('sha256').update(JSON.stringify(values)).digest('hex')).toBe(hash);
    }
  });
});
