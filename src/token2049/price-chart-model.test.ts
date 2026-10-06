import { describe, expect, it } from 'vitest';
import { chartMultiplier, inCoverageEvents, layoutChartEventLabels, scaleChartCandles, validEntryToPeak, withChartTimes } from './price-chart-model.js';

const candles = [{time:100,open:.1,high:.3,low:.05,close:.2,volume:12},{time:200,open:.2,high:.4,low:.1,close:.3,volume:15}];

describe('historical chart annotations and display units', () => {
  it('scales OHLC only, preserves raw USD and provider volume, and ignores invalid multipliers', () => {
    const original = structuredClone(candles);
    expect(scaleChartCandles(candles, 1_000_000)[0]).toEqual({time:100,open:100000,high:300000,low:50000,close:200000,volume:12});
    expect(candles).toEqual(original);
    for (const invalid of [0, -1, NaN, Infinity]) expect(chartMultiplier(invalid)).toBe(1);
  });
  it('only charts dated events within available history and preserves exact timestamps', () => {
    const events = [90,100,125,200,201].map(time => ({id:String(time),time,title:'Dated source',kind:'memory' as const}));
    const visible = inCoverageEvents(candles, [...events, events[1]]);
    expect(visible.map(event=>event.time)).toEqual([100,125,200]);
    expect(withChartTimes(candles, [...visible.map(event=>event.time),250,250,NaN])).toEqual([candles[0],{time:125},candles[1],{time:250}]);
    expect(withChartTimes([], [100])).toEqual([]);
  });
  it('computes an observed price multiple without using cap scaling or asserting a fill', () => {
    expect(validEntryToPeak({entryTime:100,entryPrice:.2,peakTime:200,peakPrice:.8})?.multiple).toBe(4);
    expect(validEntryToPeak({entryTime:100,entryPrice:0,peakTime:200,peakPrice:.8})).toBeNull();
    expect(validEntryToPeak({entryTime:100,entryPrice:.2,peakTime:90,peakPrice:.8})).toBeNull();
    expect(validEntryToPeak({entryTime:100,entryPrice:.2,peakTime:200,peakPrice:Infinity})).toBeNull();
  });
  it('keeps annotation labels in the plot and apart, including narrow and crowded layouts', () => {
    const events = Array.from({length:8},(_,index)=>({id:String(index),x:10+index*10}));
    const positions = layoutChartEventLabels(events, 190);
    for (const position of positions) {
      expect(position.left).toBeGreaterThanOrEqual(0);
      expect(position.left+position.width).toBeLessThanOrEqual(190);
      if (position.lane === null) continue;
      const same = positions.filter(other=>other.id!==position.id && other.lane===position.lane);
      for (const other of same) expect(position.left >= other.left+other.width+5 || position.left+position.width+5 <= other.left).toBe(true);
    }
    expect(positions.some(position=>position.lane===null)).toBe(true);
    expect(layoutChartEventLabels([{id:'small',x:20}], 50)[0]).toMatchObject({left:0,width:50});
    const desktop = layoutChartEventLabels([{id:'earlier',x:15},{id:'linked',x:24},{id:'current',x:38}],590);
    expect(desktop.every(position=>position.width>200)).toBe(true);
    expect(desktop.map(position=>position.lane)).toEqual([0,1,2]);
  });

  it('keeps the current catalyst labeled when four sources compete for three lanes', () => {
    const positions = layoutChartEventLabels([
      {id:'memory-1',x:10}, {id:'memory-2',x:20}, {id:'memory-3',x:30},
      {id:'current-event',x:40,priority:1},
    ],590);
    expect(positions.find(position=>position.id==='current-event')?.lane).toBe(0);
    expect(positions.filter(position=>position.lane!==null)).toHaveLength(3);
    expect(positions.filter(position=>position.lane===null).map(position=>position.id)).toEqual(['memory-3']);
    expect(positions.every(position=>position.left>=0 && position.left+position.width<=590)).toBe(true);
  });
});
