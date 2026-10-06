import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from './ui/button.js';
import type { Candle } from './cases.js';
import { CHART_WINDOW_PRESETS, availableChartWindow, chartCoverage, fromUtcInput, resolveChartWindow, toUtcInput, type ChartWindow } from './chart-window.js';
import './chart-window.css';

interface ChartWindowControlsProps {
  candles: readonly Candle[];
  value: ChartWindow;
  onChange: (window: ChartWindow) => void;
  onReset?: () => void;
  className?: string;
  compact?: boolean;
}

const labelTime = (seconds: number) => new Date(seconds * 1000).toLocaleString('en-GB', {
  timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export function ChartWindowControls({ candles, value, onChange, onReset, className = '', compact = false }: ChartWindowControlsProps) {
  const id = useId();
  const change = useRef(onChange);
  change.current = onChange;
  const coverage = chartCoverage(candles);
  const availableWindow = availableChartWindow(candles, value);
  const resolved = resolveChartWindow(candles, availableWindow);
  const windowKey = value.mode === 'custom' ? `${value.mode}:${value.from}:${value.to}` : value.mode;
  const [from, setFrom] = useState(() => resolved ? toUtcInput(resolved.from) : '');
  const [to, setTo] = useState(() => resolved ? toUtcInput(resolved.to) : '');
  useEffect(() => {
    const available = availableChartWindow(candles, value);
    if (available !== value) change.current(available);
    const range = resolveChartWindow(candles, available);
    setFrom(range ? toUtcInput(range.from) : '');
    setTo(range ? toUtcInput(range.to) : '');
    // Editing either date must survive an equivalent parent rerender. Array and
    // window object identity do not represent a changed chart selection.
  }, [windowKey, resolved?.from, resolved?.to, coverage?.from, coverage?.to, coverage?.count]);
  const requested: ChartWindow = { mode: 'custom', from: fromUtcInput(from), to: fromUtcInput(to) };
  const validRange = resolveChartWindow(candles, requested);
  const enoughCandles = (coverage?.count ?? 0) > 1;

  function applyCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Read the submitted fields as a pair, including a native date input's most
    // recent edit even if its change event has not reached React state yet.
    const fields = new FormData(event.currentTarget);
    const range = resolveChartWindow(candles, {
      mode: 'custom',
      from: fromUtcInput(String(fields.get('from') ?? '')),
      to: fromUtcInput(String(fields.get('to') ?? '')),
    });
    if (range) onChange({ mode: 'custom', ...range });
  }

  return <section className={`lb-chart-window ${className}`} aria-label="Chart time window">
    <div className="lb-chart-window-toolbar">
      <div className="lb-chart-window-presets" role="group" aria-label="View provided history">
        {CHART_WINDOW_PRESETS.map(preset => <Button key={preset.mode} size="sm" variant={availableWindow.mode === preset.mode ? 'default' : 'outline'} disabled={!enoughCandles} aria-pressed={availableWindow.mode === preset.mode} title={preset.description} onClick={() => onChange({ mode: preset.mode })}>{preset.label}</Button>)}
      </div>
      <Button size="sm" variant="ghost" disabled={!enoughCandles} onClick={() => onReset ? onReset() : onChange({ ...value })} aria-label="Reset chart pan and zoom"><RotateCcw size={13} aria-hidden="true" />Reset view</Button>
    </div>
    {!compact && <p className="lb-chart-window-caption">Zoom or drag to explore. The selected decision stays fixed.</p>}
    <details className="lb-chart-window-custom">
      <summary>Custom range <span>UTC</span></summary>
      <form onSubmit={applyCustom}>
        <label htmlFor={`${id}-from`}>From<input id={`${id}-from`} name="from" type="datetime-local" step="1" value={from} min={coverage ? toUtcInput(coverage.from) : undefined} max={coverage ? toUtcInput(coverage.to) : undefined} disabled={!enoughCandles} onInput={event => setFrom(event.currentTarget.value)} onChange={event => setFrom(event.target.value)} aria-describedby={`${id}-range-note`} /></label>
        <label htmlFor={`${id}-to`}>To<input id={`${id}-to`} name="to" type="datetime-local" step="1" value={to} min={coverage ? toUtcInput(coverage.from) : undefined} max={coverage ? toUtcInput(coverage.to) : undefined} disabled={!enoughCandles} onInput={event => setTo(event.currentTarget.value)} onChange={event => setTo(event.target.value)} aria-describedby={`${id}-range-note`} /></label>
        <Button size="sm" variant="outline" type="submit" disabled={!validRange}>Apply range</Button>
        <p id={`${id}-range-note`} className="lb-chart-window-range-note">{!enoughCandles ? 'More price history is needed to choose a range.' : !validRange ? 'Choose a wider range within the available history.' : 'The selected decision and its evidence stay fixed.'}</p>
      </form>
    </details>
    {!compact && <p className="lb-chart-window-coverage">{resolved ? <>Viewing {labelTime(resolved.from)} – {labelTime(resolved.to)} UTC</> : 'No price history is available at this checkpoint.'}</p>}
  </section>;
}
