import { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, ColorType, createSeriesMarkers, type UTCTimestamp, type SeriesMarker, type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type Time, type PriceFormat } from 'lightweight-charts';
import type { Candle, ReplayStep } from './cases.js';
import { DEFAULT_CHART_WINDOW, decisionMarkerAnchors, resolveChartWindow, type ChartWindow } from './chart-window.js';
import { chartMultiplier, inCoverageEvents, layoutChartEventLabels, scaleChartCandles, validEntryToPeak, withChartTimes, type ChartEventAnnotation, type EntryToPeak } from './price-chart-model.js';
import './price-chart.css';

export type { ChartEventAnnotation, EntryToPeak } from './price-chart-model.js';
export interface DecisionCursor { time: number; label: string; action: 'ENTRY' | 'WAIT' | 'REVIEW' | 'SKIP' }
export interface PriceChartProps {
  candles: Candle[];
  steps: ReplayStep[];
  compact?: boolean;
  interactive?: boolean;
  timeWindow?: ChartWindow;
  resetKey?: string | number;
  intervalSeconds?: number;
  priceFormat?: PriceFormat;
  priceLabel?: string;
  decisionCursor?: DecisionCursor;
  valueMultiplier?: number;
  events?: readonly ChartEventAnnotation[];
  onEventSelect?: (id: string) => void;
  entryToPeak?: EntryToPeak;
  highlightAfterEntry?: boolean;
}
interface PlotSnapshot {
  key: string; width: number; height: number; cursorX: number | null;
  events: {id: string; x: number}[];
  peak: {entryX: number; entryY: number; peakX: number; peakY: number} | null;
}
const DEFAULT_PRICE_FORMAT: PriceFormat = {type:'price',precision:1,minMove:.1};
const NO_EVENTS: readonly ChartEventAnnotation[] = [];
const dateLabel = (time: number) => new Date(time*1000).toLocaleDateString('en-GB',{timeZone:'UTC',day:'2-digit',month:'short'});
const exactDate = (time: number) => new Date(time*1000).toISOString();

export function PriceChart({candles,steps,compact=false,interactive=true,timeWindow=DEFAULT_CHART_WINDOW,resetKey,intervalSeconds,priceFormat=DEFAULT_PRICE_FORMAT,priceLabel,decisionCursor,valueMultiplier=1,events=NO_EVENTS,onEventSelect,entryToPeak,highlightAfterEntry=false}: PriceChartProps) {
  const element=useRef<HTMLDivElement>(null);
  const [plot,setPlot]=useState<PlotSnapshot|null>(null);
  const decisionTime=decisionCursor && Number.isFinite(decisionCursor.time) && decisionCursor.time>0 ? decisionCursor.time : undefined;
  const multiplier=chartMultiplier(valueMultiplier);
  const peak=useMemo(()=>validEntryToPeak(entryToPeak),[entryToPeak]);
  const plottedEvents=useMemo(()=>inCoverageEvents(candles,events),[candles,events]);
  const points=useMemo(()=>{
    const first=candles[0]?.time,last=candles.at(-1)?.time;
    const peakTimes=peak && first!==undefined && last!==undefined ? [peak.entryTime,peak.peakTime].filter(time=>time>=first && time<=last) : [];
    return withChartTimes(scaleChartCandles(candles,multiplier),[...plottedEvents.map(event=>event.time),...peakTimes,...(decisionTime===undefined?[]:[decisionTime])]);
  },[candles,multiplier,plottedEvents,peak,decisionTime]);
  const plotKey=`${candles.length}:${candles[0]?.time}:${candles.at(-1)?.time}:${candles[0]?.close}:${decisionTime}:${multiplier}:${peak?.peakTime}:${peak?.peakPrice}:${plottedEvents.map(event=>`${event.id}:${event.time}`).join(',')}`;
  const instance=useRef<{chart:IChartApi;series:ISeriesApi<'Candlestick'>;volume:ISeriesApi<'Histogram'>;markers:ISeriesMarkersPluginApi<Time>}|null>(null);
  useEffect(()=>{
    if(!element.current)return;
    const chart=createChart(element.current,{
      autoSize:true,
      layout:{background:{type:ColorType.Solid,color:'transparent'},textColor:'#8995a7',fontFamily:'Inter,system-ui,sans-serif',fontSize:10,attributionLogo:false},
      grid:{vertLines:{color:'#eaf0f680'},horzLines:{color:'#eaf0f6'}},
      rightPriceScale:{borderVisible:false,scaleMargins:{top:.18,bottom:.22}},
      timeScale:{borderVisible:false,timeVisible:true,rightOffset:3,barSpacing:6,minBarSpacing:.1,fixLeftEdge:true,fixRightEdge:true},
      crosshair:{vertLine:{color:'#a4aebc',labelBackgroundColor:'#253343'},horzLine:{color:'#a4aebc',labelBackgroundColor:'#253343'}},
    });
    const series=chart.addSeries(CandlestickSeries,{upColor:'#26a593',downColor:'#ef7280',wickUpColor:'#26a593',wickDownColor:'#ef7280',borderVisible:false,priceLineVisible:false,lastValueVisible:false,priceFormat:DEFAULT_PRICE_FORMAT});
    const volume=chart.addSeries(HistogramSeries,{priceScaleId:'',priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false});
    volume.priceScale().applyOptions({scaleMargins:{top:.86,bottom:0}});
    instance.current={chart,series,volume,markers:createSeriesMarkers(series,[])};
    return ()=>{instance.current=null;chart.remove();};
  },[]);
  useEffect(()=>{
    const current=instance.current;if(!current)return;
    current.series.setData(points.map(point=>({...point,time:point.time as UTCTimestamp})));
    current.volume.setData(points.map(point=>'volume' in point ? {time:point.time as UTCTimestamp,value:point.volume,color:point.close>=point.open?'#26a59335':'#ef728035'} : {time:point.time as UTCTimestamp}));
  },[points]);
  useEffect(()=>{
    const current=instance.current;if(!current)return;
    // A fixed right edge would hide a decision after the last priced bar.
    current.chart.applyOptions({layout:{fontSize:compact?9:10},rightPriceScale:{visible:!compact,scaleMargins:{top:plottedEvents.length && !compact?.32:.18,bottom:.22}},timeScale:{timeVisible:!compact,fixRightEdge:decisionTime===undefined},handleScroll:interactive,handleScale:interactive});
    current.series.applyOptions({priceFormat});
    const anchors=decisionMarkerAnchors(candles,steps,intervalSeconds);
    const markers:SeriesMarker<UTCTimestamp>[]=anchors.map(({step,index,time},visibleIndex)=>({time:time as UTCTimestamp,position:index%2===0?'belowBar':'aboveBar',shape:'circle',color:step.action==='ENTRY'?'#1b9787':step.action==='SKIP'?'#d46572':'#c89a00',text:compact?(visibleIndex===anchors.length-1?step.action:''):(index===1?'NEWS':index===2?'LINKED':step.action),size:compact?.6:1}));
    current.markers.setMarkers(markers);
  },[candles,steps,compact,interactive,intervalSeconds,priceFormat,decisionTime,plottedEvents.length]);
  useEffect(()=>{
    const current=instance.current;if(!current || !candles.length)return;
    const range=resolveChartWindow(candles,timeWindow);
    if(timeWindow.mode==='all')current.chart.timeScale().fitContent();
    else if(range){const to=timeWindow.mode!=='custom' && decisionTime!==undefined && decisionTime>=range.to?decisionTime:range.to;current.chart.timeScale().setVisibleRange({from:range.from as UTCTimestamp,to:to as UTCTimestamp});}
    else current.chart.timeScale().fitContent();
    // A promoted carousel card refits its full selected range instead of keeping
    // the background viewport. Ordinary resize, pan and zoom still stay intact.
  },[candles,timeWindow,resetKey,decisionTime,compact]);
  useEffect(()=>{
    const current=instance.current,host=element.current;
    if(!current || !host || !candles.length){setPlot(null);return;}
    const scale=current.chart.timeScale();let frame:number|undefined;
    const update=()=>{
      const width=scale.width(),height=Math.max(0,host.clientHeight-scale.height());
      const xFor=(time:number)=>scale.timeToCoordinate(time as UTCTimestamp);
      let peakPosition:PlotSnapshot['peak']=null;
      if(peak){
        const entryX=xFor(peak.entryTime),peakX=xFor(peak.peakTime),entryY=current.series.priceToCoordinate(peak.entryPrice*multiplier),peakY=current.series.priceToCoordinate(peak.peakPrice*multiplier);
        if(entryX!==null && peakX!==null && entryY!==null && peakY!==null)peakPosition={entryX,entryY,peakX,peakY};
      }
      setPlot(height>0?{key:plotKey,width,height,cursorX:decisionTime===undefined?null:xFor(decisionTime),events:plottedEvents.flatMap(event=>{const x=xFor(event.time);return x===null?[]:[{id:event.id,x}];}),peak:peakPosition}:null);
    };
    const schedule=()=>{if(frame!==undefined)cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};
    scale.subscribeVisibleLogicalRangeChange(schedule);scale.subscribeSizeChange(schedule);
    current.chart.subscribeCrosshairMove(schedule);
    host.addEventListener('wheel',schedule,{passive:true});host.addEventListener('pointermove',schedule,{passive:true});host.addEventListener('dblclick',schedule);
    window.addEventListener('pointerup',schedule);schedule();
    return ()=>{if(frame!==undefined)cancelAnimationFrame(frame);scale.unsubscribeVisibleLogicalRangeChange(schedule);scale.unsubscribeSizeChange(schedule);current.chart.unsubscribeCrosshairMove(schedule);host.removeEventListener('wheel',schedule);host.removeEventListener('pointermove',schedule);host.removeEventListener('dblclick',schedule);window.removeEventListener('pointerup',schedule);};
  },[candles,points,decisionTime,peak,multiplier,plottedEvents,plotKey,timeWindow,resetKey]);

  const visibleAnchors=decisionMarkerAnchors(candles,steps,intervalSeconds);
  const cursorTitle=decisionTime!==undefined && decisionCursor?`${decisionCursor.label} · ${exactDate(decisionTime)} · Recorded model assessment, not an investment recommendation or executed order.`:'';
  const activePlot=plot?.key===plotKey?plot:null;
  const labelPositions=activePlot?layoutChartEventLabels(activePlot.events.map(event=>({...event,priority:plottedEvents.find(source=>source.id===event.id)?.kind==='event'?1:0})),activePlot.width,compact):[];
  const cursorX=activePlot?.cursorX;
  const cursorVisible=activePlot && cursorX!==null && cursorX!==undefined && cursorX>=0 && cursorX<=activePlot.width;
  const split=activePlot && cursorX!==null && cursorX!==undefined?Math.max(0,Math.min(cursorX,activePlot.width)):null;
  const peakVisible=activePlot?.peak && activePlot.peak.peakX>=0 && activePlot.peak.peakX<=activePlot.width && activePlot.peak.peakY>=0 && activePlot.peak.peakY<=activePlot.height;
  const peakTitle=peak?`${peak.peakLabel??'Period high'} · ${exactDate(peak.peakTime).slice(0,10)} UTC · Source interval high; exact trade time is unknown. ${peak.multiple.toFixed(2)}× = period high ÷ assessment reference price.`:'';
  return <div className={`lb-price-chart${compact?' is-compact':''}`} role="group" aria-label={`${priceLabel??'Illustrative indexed'} price chart`}>
    <div ref={element} className="lb-price-canvas" role="img" aria-label={`${priceLabel??'Illustrative indexed'} candlestick chart, ${candles.length} observations, ${visibleAnchors.length} decision checkpoints. ${cursorTitle}${priceLabel?'':' Prices and volume are authored, not historical market data.'}`} title={[...visibleAnchors.map(({step})=>`${step.action}: ${step.date} (UTC)`),cursorTitle].filter(Boolean).join('\n')}/>
    {activePlot && <div className={`lb-chart-annotations${decisionCursor?.action==='ENTRY'?' is-entry':''}`} style={{width:activePlot.width,height:activePlot.height}}>
      {highlightAfterEntry && split!==null && <div className="lb-chart-periods" aria-hidden="true"><div className="lb-chart-before" style={{width:split}}>{!compact && split>100 && <span>Before assessment</span>}</div><div className="lb-chart-after" style={{left:split}}>{!compact && activePlot.width-split>100 && <span>After assessment</span>}</div></div>}
      {cursorVisible && <><div className="lb-chart-decision-line" style={{left:cursorX}}/><span className="lb-chart-decision-label" title={cursorTitle} style={{left:Math.min(Math.max(cursorX-55,0),Math.max(0,activePlot.width-110))}}>{decisionCursor?.label}</span></>}
      {labelPositions.map(position=>{
        const event=plottedEvents.find(item=>item.id===position.id)!;
        const title=`${event.kind==='memory'?'Remembered context':'Current event'} · ${exactDate(event.time)} · ${event.title}`;
        return <div key={event.id} className={`lb-chart-source is-${event.kind}`}>
          <div className="lb-chart-source-line" style={{left:position.x,top:compact?32:32+(position.lane??2)*25}}/>
          {position.lane!==null?<button type="button" disabled={!onEventSelect} className="lb-chart-source-label" style={{left:position.left,width:position.width,top:compact?30+position.lane*21:31+position.lane*25}} onClick={()=>onEventSelect?.(event.id)} title={title} aria-label={title}><span className="lb-chart-source-dot"/><strong>{dateLabel(event.time)}</strong><span className="lb-chart-source-title">{!compact && activePlot.width>400?event.title:event.kind==='memory'?'Memory':'Event'}</span></button>:<button type="button" disabled={!onEventSelect} className="lb-chart-source-overflow" style={{left:Math.max(0,Math.min(position.x-5,activePlot.width-10))}} onClick={()=>onEventSelect?.(event.id)} title={title} aria-label={title}/>}
        </div>;
      })}
      {peak && activePlot.peak && <svg className="lb-chart-peak-line" width={activePlot.width} height={activePlot.height} aria-hidden="true"><line x1={activePlot.peak.entryX} y1={activePlot.peak.entryY} x2={activePlot.peak.peakX} y2={activePlot.peak.peakY}/><circle cx={activePlot.peak.entryX} cy={activePlot.peak.entryY} r="3.5"/>{peakVisible && <circle cx={activePlot.peak.peakX} cy={activePlot.peak.peakY} r="4.5"/>}</svg>}
      {peak && peakVisible && activePlot.peak && <span className="lb-chart-peak-label" title={peakTitle} style={{left:Math.max(0,Math.min(activePlot.peak.peakX-66,activePlot.width-132)),top:Math.max(compact?96:111,Math.min(activePlot.peak.peakY+12,activePlot.height-54))}}><strong>{peak.multiple.toFixed(2)}× <span>{peak.peakLabel??'Period high'}</span></strong>{!compact && <small>vs assessment reference · {dateLabel(peak.peakTime)}</small>}</span>}
    </div>}
  </div>;
}
