import { describe, expect, it } from 'vitest';
import { availableChartWindow, chartCoverage, decisionMarkerAnchors, fromUtcInput, resolveChartWindow, toUtcInput, withDecisionWhitespace } from './chart-window.js';

describe('bounded chart viewport', () => {
  it('uses provided candle counts rather than inventing uniform time intervals', () => {
    const candles = Array.from({ length: 40 }, (_, index) => ({ time: 100 + index ** 2 }));
    expect(chartCoverage(candles)).toEqual({ from: 100, to: 1621, count: 40 });
    expect(resolveChartWindow(candles, { mode: 'focus' })).toEqual({ from: 676, to: 1621 });
    expect(resolveChartWindow(candles, { mode: 'lead-in' })).toEqual({ from: 164, to: 1621 });
    const checkpoint = candles.slice(0, 16);
    expect(resolveChartWindow(checkpoint, { mode: 'all' })?.to).toBe(325);
    expect(resolveChartWindow(checkpoint, { mode: 'lead-in' })).toEqual(resolveChartWindow(checkpoint, { mode: 'all' }));
  });

  it('clamps a requested window to supplied history without appending or changing data', () => {
    const candles = [{ time: 100 }, { time: 130 }, { time: 205 }, { time: 800 }];
    const before = structuredClone(candles);
    expect(resolveChartWindow(candles, { mode: 'custom', from: 0, to: 1000 })).toEqual({ from: 100, to: 800 });
    expect(resolveChartWindow(candles, { mode: 'custom', from: 110, to: 500 })).toEqual({ from: 130, to: 205 });
    expect(candles).toEqual(before);
  });

  it('returns to the available timeline when later-price review hides a custom range', () => {
    const candles = [{ time: 100 }, { time: 130 }, { time: 205 }, { time: 800 }];
    const custom = { mode: 'custom' as const, from: 200, to: 900 };
    expect(availableChartWindow(candles, custom)).toBe(custom);
    const closed = candles.slice(0, 2);
    const fallback = availableChartWindow(closed, custom);
    expect(fallback).toEqual({ mode: 'all' });
    expect(resolveChartWindow(closed, fallback)).toEqual({ from: 100, to: 130 });
    expect(custom).toEqual({ mode: 'custom', from: 200, to: 900 });
  });

  it('rejects invalid ranges and gaps that contain fewer than two actual observations', () => {
    const candles = [{ time: 100 }, { time: 130 }, { time: 205 }, { time: 800 }];
    for (const [from, to] of [[300, 700], [0, 50], [900, 1000], [130, 130], [205, 100], [NaN, 800], [100, Infinity]]) {
      expect(resolveChartWindow(candles, { mode: 'custom', from, to })).toBeNull();
    }
    expect(resolveChartWindow([])).toBeNull();
    expect(resolveChartWindow([{ time: 100 }])).toBeNull();
    expect(chartCoverage([])).toBeNull();
  });

  it('anchors markers to event timestamps after slicing and never moves a future event onto an earlier candle', () => {
    const candles = [{ time: 100 }, { time: 130 }, { time: 205 }, { time: 800 }];
    const steps = [100, 205, 800].map(time => ({ id: String(time), date: new Date(time * 1000).toISOString() }));
    const anchors = decisionMarkerAnchors(candles.slice(1), steps);
    expect(anchors.map(anchor => anchor.step.id)).toEqual(['205', '800']);
    expect(anchors.map(anchor => anchor.time)).toEqual([205, 800]);
    expect(anchors.map(anchor => anchor.index)).toEqual([1, 2]);
    expect(decisionMarkerAnchors(candles.slice(0, 2), steps).map(anchor => anchor.step.id)).toEqual(['100']);
  });

  it('interprets custom values explicitly in UTC, including seconds', () => {
    const timestamp = Date.parse('2025-03-16T11:31:08Z') / 1000;
    expect(toUtcInput(timestamp)).toBe('2025-03-16T11:31:08');
    expect(fromUtcInput(toUtcInput(timestamp))).toBe(timestamp);
    expect(fromUtcInput('2025-03-16T11:31')).toBe(Date.parse('2025-03-16T11:31:00Z') / 1000);
    expect(fromUtcInput('')).toBeNaN();
    expect(fromUtcInput('2025-03-16')).toBeNaN();
  });

  it('optionally maps events to supplied OHLC buckets while preserving exact event time', () => {
    const candles = [{ time: 100 }, { time: 160 }, { time: 280 }];
    const steps = [99, 125, 160, 205, 230, 305, 340].map(time => ({ id: String(time), date: new Date(time * 1000).toISOString() }));
    const anchors = decisionMarkerAnchors(candles, steps, 60);
    expect(anchors.map(({ time, eventTime }) => [time, eventTime])).toEqual([[100, 125], [160, 160], [160, 205], [280, 305]]);
    expect(decisionMarkerAnchors(candles, steps).map(anchor => anchor.eventTime)).toEqual([160]);
    expect(decisionMarkerAnchors(candles.slice(1), steps, 60).map(anchor => anchor.eventTime)).toEqual([160, 205, 305]);
  });

  it('inserts an exact decision time as whitespace without inventing or backdating an OHLC candle', () => {
    const candles=[{time:100,open:1,high:2,low:1,close:2,volume:3},{time:160,open:2,high:3,low:1,close:2,volume:4}];
    const before=structuredClone(candles);
    expect(withDecisionWhitespace(candles,220)).toEqual([...candles,{time:220}]);
    expect(withDecisionWhitespace(candles,130)).toEqual([candles[0],{time:130},candles[1]]);
    expect(withDecisionWhitespace(candles,160)).toEqual(candles);
    expect(withDecisionWhitespace(candles,NaN)).toEqual(candles);
    expect(withDecisionWhitespace([],220)).toEqual([]);
    expect(candles).toEqual(before);
  });
});
