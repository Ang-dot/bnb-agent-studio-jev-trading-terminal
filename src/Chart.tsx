import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  ColorType,
  createSeriesMarkers,
  type UTCTimestamp,
  type SeriesMarker,
} from "lightweight-charts";
import type { Candle, Decision, Position } from "./types.js";
import { PAPER_POLICY as paper } from "./paper-settings.js";
import { decisionMarker } from "./terminal-insights.js";
const noAnnotations: { time: number; label: string; color: string }[] = [];
export function Chart({
  candles,
  decisions,
  interval,
  milestone,
  position,
  compactMarkers = false,
  annotations = noAnnotations,
}: {
  candles: Candle[];
  decisions: Decision[];
  interval: number;
  milestone?: { time: number; label: string };
  position?: Position;
  compactMarkers?: boolean;
  annotations?: { time: number; label: string; color: string }[];
}) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current || !candles.length) return;
    const chart = createChart(el.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#808691",
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "#f4f5f7" },
        horzLines: { color: "#f1f2f4" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: compactMarkers ? 10 : 0,
      },
      crosshair: {
        vertLine: { color: "#a2a8b0", labelBackgroundColor: "#32363e" },
        horzLine: { color: "#a2a8b0", labelBackgroundColor: "#32363e" },
      },
    });
    const price = chart.addSeries(CandlestickSeries, {
      upColor: "#159b73",
      downColor: "#e36465",
      wickUpColor: "#159b73",
      wickDownColor: "#e36465",
      borderVisible: false,
      priceFormat: { type: "price", precision: 8, minMove: 0.00000001 },
    });
    price.setData(candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })));
    if(position&&position.quantity>0) {
      const breakEven=position.costUsd/position.quantity/((1-paper.slippageBps/10000)*(1-paper.feeBps/10000));
      const levels=[{value:breakEven,label:"Paper breakeven",color:"#657084"},{value:breakEven*.75,label:"Stop −25% · paper",color:"#c45b55"},
        ...((position.takeProfits??0)<1?[{value:breakEven*1.5,label:"TP1 +50% · half",color:"#159b73"}]:[]),
        ...((position.takeProfits??0)<2?[{value:breakEven*2,label:"TP2 +100% · half",color:"#159b73"}]:[]),
        ...((position.takeProfits??0)>0&&position.peakNetUnitUsd?[{value:position.peakNetUnitUsd*.75/((1-paper.slippageBps/10000)*(1-paper.feeBps/10000)),label:"Runner trail · paper",color:"#bc8513"}]:[])];
      for(const l of levels) price.createPriceLine({price:l.value,color:l.color,lineWidth:1,lineStyle:2,axisLabelVisible:true,title:l.label});
    }
    price
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.12, bottom: 0.22 } });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volume
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
    volume.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "#159b7325" : "#e3646525",
      })),
    );
    const markers: SeriesMarker<UTCTimestamp>[] = decisions
      .filter(
        (d) =>
          d.snapshot && (d.judgment || d.status === "executed") &&
          d.time / 1000 >= candles[0].time &&
          d.time / 1000 <= candles.at(-1)!.time + interval * 60,
      )
      .map((d) => ({
        time: [...candles].reverse().find((c) => c.time <= d.time / 1000)!
          .time as UTCTimestamp,
        position: decisionMarker(d).action === "sell" ? "aboveBar" : "belowBar",
        shape:
          d.status === "executed"
            ? d.action === "buy"
              ? "arrowUp"
              : "arrowDown"
            : "circle",
        color: d.status === "executed" ? "#159b73" : "#bd941d",
        text: compactMarkers ? d.ruleExit ? "Code exit" : d.status === "executed" ? `Paper ${d.action.toUpperCase()}` : `JEV ${d.judgment?.action.toUpperCase()}` : decisionMarker(d).text,
      }));
    if (
      milestone &&
      milestone.time / 1000 >= candles[0].time &&
      milestone.time / 1000 <= candles.at(-1)!.time + interval * 60
    ) {
      const bar = [...candles]
        .reverse()
        .find((c) => c.time <= milestone.time / 1000);
      if (bar)
        markers.push({
          time: bar.time as UTCTimestamp,
          position: "aboveBar",
          shape: "circle",
          color: "#c09100",
          text: milestone.label,
        });
    }
    for (const note of annotations) {
      const bar = [...candles].reverse().find(c => (c.time + interval * 60) * 1000 <= note.time);
      if (bar) markers.push({ time: bar.time as UTCTimestamp, position: "aboveBar", shape: "circle", color: note.color, text: note.label });
    }
    createSeriesMarkers(
      price,
      markers.sort((a, b) => Number(a.time) - Number(b.time)),
    );
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles, decisions, interval, milestone?.time, milestone?.label, annotations,position?.costUsd,position?.quantity,position?.takeProfits,position?.peakNetUnitUsd,compactMarkers]);
  return (
    <div
      className="chart-canvas"
      ref={el}
      aria-label="Token candlestick chart with recorded agent decision markers, UTC time"
    />
  );
}
