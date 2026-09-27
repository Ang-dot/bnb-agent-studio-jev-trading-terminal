import { memorySearchLabel } from "./memory-presentation.js";
import { marketSources } from "./market-provenance";
import { GeckoAttribution } from "./GeckoAttribution.js";
import { apiPath } from "./api-path.js";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Activity, ArrowUpRight, BarChart3, Check, ChevronDown, Circle, Clock3, Coins, Copy, Database, ExternalLink, FileText, History, Layers3, Link2, LoaderCircle, LockKeyhole, Maximize2, Minimize2, Radio, Search, ShieldCheck, Sparkles, Wallet, X } from "lucide-react";
import { Chart } from "./Chart.js";
import { TypeSafeLogo } from "./TypeSafeLogo.js";
import bnbChainLogo from "./assets/bnb-chain-symbol-yellow.svg";
import { MemoryLogo, useFrontendEdition } from "./FrontendEdition.js";
import { AssessmentCard, executionLabel } from "./DecisionBreakdown.js";
import { XEvidence } from "./XEvidence.js";
import { SupportingResearch } from "./SupportingResearch.js";
import { MemoryJournal } from './MemoryJournal.js';
import { AssessmentReceiptView } from './AssessmentReceipt.js';
import { xRecoveredAt } from "./trading-view.js";
import { emptyArrivals, platformLabel, reconcileArrivals, selectLaunches, type Launch, type LaunchFeedState, type LaunchStage, type Platform } from "./launches.js";
import { monitorLabel, type MonitorState } from "./monitoring.js";
import { initialFocus, paperPerformance } from "./terminal-insights.js";
import { PAPER_POLICY as policy } from "./paper-settings.js";
import { currentActivity, decisionAction, elapsed, groupDecisions, memoryPhases, tokenForDecision, chartRecords, recentlyAssessedToken } from "./trading-view.js";
import type { Candle, Decision, Memory, TerminalState } from "./types.js";
import "./trading-terminal.css";

const dollars = (n: number | null | undefined, compact = false) => n == null || !Number.isFinite(n) ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 1 : 2 }).format(n);
const price = (n?: number | null) => n == null || n <= 0 ? "—" : n < 1 ? `$${n.toPrecision(5)}` : dollars(n);
const clock = (n: number) => new Date(n).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const stamp = (n: number) => new Date(n).toLocaleString("en-GB");
const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
const noDecisions: Decision[] = [];
const sections: { stage: LaunchStage; label: string; limit: number }[] = [{ stage: "new", label: "Just launched", limit: 2 }, { stage: "bonding", label: "Near graduation", limit: 1 }, { stage: "graduated_reported", label: "Graduated", limit: 3 }];

async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(apiPath(path), { cache: "no-store", signal });
  if (!r.ok) throw new Error(`Request unavailable (${r.status})`);
  return r.json();
}
function Logo({ launch, size = 38 }: { launch?: Launch; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [launch?.logo]);
  return <span className="tt-token" style={{ width: size, height: size }}>{launch?.logo && !failed ? <img src={launch.logo} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <Coins size={size * .53} aria-hidden="true" />}</span>;
}
function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) { return <span className={`tt-chip tt-${tone}`}>{children}</span>; }
function Money({ value }: { value: number | null | undefined }) { return <span className={value == null ? "" : value > 0 ? "tt-positive" : value < 0 ? "tt-negative" : ""}>{value != null && value > 0 ? "+" : ""}{dollars(value)}</span>; }
function BrainLogo({ size = 38 }: { size?: number }) { return <MemoryLogo size={size} className="tt-brain-logo" />; }

export function TradingTerminal({ onReplay }: { onReplay: () => void }) {
  const { edition, memoryName, architecturePath } = useFrontendEdition();
  const [state, setState] = useState<TerminalState | null>(null);
  const [feed, setFeed] = useState<LaunchFeedState | null>(null);
  const [monitor, setMonitor] = useState<MonitorState | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [selected, setSelected] = useState("");
  const [recordId, setRecordId] = useState("");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [streamFilter, setStreamFilter] = useState("all");
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [interval, setIntervalValue] = useState<"1" | "5" | "15">("1");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [chartError, setChartError] = useState("");
  const [chartLoading, setChartLoading] = useState(true);
  const [chartSource, setChartSource] = useState("GMGN");
  const [chartAt, setChartAt] = useState<number | null>(null);
  const [chartExpanded, setChartExpanded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [contextTab, setContextTab] = useState<"memory" | "assessment" | "sources" | "capture">("memory");
  const [modal, setModal] = useState<"policy" | "ledger" | "evidence" | "memory" | "live" | null>(null);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [notice, setNotice] = useState("");
  const [arming, setArming] = useState(false);
  const [arrivalIds, setArrivalIds] = useState<string[]>([]);
  const [decisionIds, setDecisionIds] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const chartPanel = useRef<HTMLElement>(null);
  const arrivals = useRef(emptyArrivals());
  const lastFeed = useRef<number | null>(null);
  const seenDecisions = useRef<Set<string> | null>(null);
  const selectedCache = useRef<Launch | undefined>(undefined);
  const rail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false, pending = false;
    const controller = new AbortController();
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const [s, f, m] = await Promise.all([read<TerminalState>("/api/state", controller.signal), read<LaunchFeedState>("/api/launches", controller.signal), read<MonitorState>("/api/monitor", controller.signal)]);
        if (disposed) return;
        if(s.edition!==edition||s.memoryProvider!==memoryName)throw new Error('Memory edition mismatch');
        setState(prev => JSON.stringify(prev) === JSON.stringify(s) ? prev : s);
        setFeed(prev => JSON.stringify(prev) === JSON.stringify(f) ? prev : f);
        setMonitor(prev => JSON.stringify(prev) === JSON.stringify(m) ? prev : m);
        setDisconnected(false);
        if (f.updatedAt !== lastFeed.current) {
          lastFeed.current = f.updatedAt;
          arrivals.current = reconcileArrivals(arrivals.current, f.launches, Date.now());
          setArrivalIds(arrivals.current.added);
          if (arrivals.current.added.length) setAnnouncement(`${arrivals.current.added.length} new launches detected by GMGN`);
        }
        const next = s.decisions.filter(d => seenDecisions.current && !seenDecisions.current.has(d.id)).map(d => d.id);
        if (next.length) setDecisionIds(next);
        seenDecisions.current = new Set(s.decisions.map(d => d.id));
        setSelected(prev => prev || recentlyAssessedToken(s.decisions, s.pools, f.launches, Date.now()) || initialFocus(f.launches, m.items, Date.now()));
      } catch { if (!disposed) setDisconnected(true); }
      finally { pending = false; }
    }
    void refresh();
    const polling = window.setInterval(() => void refresh(), 4000);
    const ticking = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { disposed = true; controller.abort(); window.clearInterval(polling); window.clearInterval(ticking); };
  }, []);
  useEffect(() => {
    if (!arrivalIds.length) return;
    const t = window.setTimeout(() => setArrivalIds([]), 12000);
    return () => window.clearTimeout(t);
  }, [arrivalIds]);
  useEffect(() => {
    if (!decisionIds.length) return;
    const t = window.setTimeout(() => setDecisionIds([]), 6000);
    return () => window.clearTimeout(t);
  }, [decisionIds]);

  const launches = feed?.launches ?? [];
  const found = launches.find(l => l.address.toLowerCase() === selected);
  if (found) selectedCache.current = found;
  const launch = found || (selectedCache.current?.address.toLowerCase() === selected ? selectedCache.current : undefined);
  const pool = state?.pools.find(p => p.token.toLowerCase() === selected);
  const chartPath = found ? `/api/launches/${selected}/candles` : pool ? `/api/candles/${pool.address}` : null;
  useEffect(() => {
    let disposed = false, busy = false;
    const controller = new AbortController();
    setCandles([]); setChartError(""); setChartAt(null); setChartLoading(!!chartPath);
    if (!chartPath) return;
    async function refresh() {
      if (busy) return;
      busy = true;
      try {
        const result = await read<{ candles: Candle[]; source?: string }>(`${chartPath}?interval=${interval}`, controller.signal);
        if (disposed) return;
        setCandles(result.candles); setChartAt(Date.now()); setChartSource(result.source || "Unknown source");
        setChartError(result.candles.length ? "" : "No candles returned for this interval.");
      } catch { if (!disposed) setChartError("Chart feed unavailable. Last received prices are retained if available."); }
      finally { busy = false; if (!disposed) setChartLoading(false); }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 45000);
    return () => { disposed = true; controller.abort(); window.clearInterval(timer); };
  }, [chartPath, interval, retry]);
  useEffect(() => {
    if (modal) dialog.current?.showModal(); else dialog.current?.close();
  }, [modal]);
  useEffect(() => {
    if (!chartExpanded) return;
    const prior = document.activeElement as HTMLElement | null;
    chartPanel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChartExpanded(false);
      if (e.key !== "Tab") return;
      const items = chartPanel.current?.querySelectorAll<HTMLElement>("button,a[href]");
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); prior?.focus(); };
  }, [chartExpanded]);
  const decisions = state?.decisions ?? noDecisions;
  const selectedDecisions = useMemo(() => decisions.filter(d => tokenForDecision(d, state?.pools ?? []) === selected), [decisions, selected, state?.pools]);
  const record = decisions.find(d => d.id === recordId) || selectedDecisions[0];
  const markers = useMemo(() => chartRecords(selectedDecisions, record?.id), [selectedDecisions, record?.id]);
  const groups = useMemo(() => groupDecisions(decisions.filter(d => streamFilter === "all" || (streamFilter === "model" ? !!d.judgment : streamFilter === "fills" ? d.status === "executed" : tokenForDecision(d, state?.pools ?? []) === selected))), [decisions, streamFilter, selected, state?.pools]);
  const filtered = useMemo(() => selectLaunches(launches, platform, "all", query), [launches, platform, query]);
  const latest = decisions.find(d => d.judgment);
  const lastFill = [...(state?.ledger.fills ?? [])].sort((a,b) => b.time - a.time)[0];
  const activity = currentActivity(state, monitor, now);
  const fresh = !!feed?.updatedAt && now >= feed.updatedAt && now - feed.updatedAt <= 90_000 && !disconnected;
  const position = state?.ledger.positions.find(p => p.token.toLowerCase() === selected);
  const item = monitor?.items.find(i => i.token.toLowerCase() === selected);
  const phases = memoryPhases(record);
  const episode = state?.memoryEpisodes?.find(e=>e.id===record?.memoryEpisodeId);
  const capturePhase = episode?.capture.status || phases.capture;
  const memoryConnection=state?.providers.find(p=>p.name===memoryName);
  const performance = state ? paperPerformance(state.ledger, launches, now) : null;
  const symbol = launch?.symbol || pool?.symbol || (record && tokenForDecision(record, state?.pools ?? []) === selected ? record.name.split(" / ")[0] : "Select a launch");
  const memoryAssessment = record?.judgment?.assessments?.find(a => a.kind === "memory") ?? record?.judgment?.assessments?.find(a => a.id === "memory_alignment");
  const contextAssessment = record?.judgment?.assessments?.find(a => a.kind === "context");
  const action = record ? decisionAction(record) : null;

  function selectToken(token: string) { setSelected(token.toLowerCase()); setRecordId(""); setContextTab("memory"); }
  function selectDecision(d: Decision) {
    setRecordId(d.id); setContextTab("memory");
    const token = tokenForDecision(d, state?.pools ?? []);
    setSelected(token || "");
  }
  async function copyContract() {
    try { await navigator.clipboard.writeText(selected); setNotice("Contract copied"); }
    catch { setNotice(`Contract: ${selected}`); }
  }
  async function arm() {
    setArming(true);
    try {
      const r = await fetch(apiPath("/api/control"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) });
      if (!r.ok) throw new Error();
      setState(await read<TerminalState>("/api/state")); setNotice("Paper session armed. No real transactions."); setModal(null);
    } catch { setNotice("Unable to arm paper session. Check that discovery and monitoring are enabled."); }
    finally { setArming(false); }
  }
  function showMemory(m: Memory) { setMemory(m); setModal("memory"); }
  function streamCard(d: Decision, nested = false) {
    const token = tokenForDecision(d, state?.pools ?? []);
    const l = launches.find(l => l.address.toLowerCase() === token);
    const a = decisionAction(d);
    const recoveredAt = xRecoveredAt(d, decisions);
    return <button key={d.id} className={`tt-stream-card ${record?.id === d.id ? "selected" : ""} ${decisionIds.includes(d.id) ? "tt-arrived" : ""} ${nested ? "tt-nested" : ""}`} onClick={() => selectDecision(d)} aria-pressed={record?.id === d.id}>
      <Logo launch={l} size={37} />
      <span className="tt-stream-body"><span className="tt-stream-time"><time title={stamp(d.time)}>{clock(d.time)}</time><span>{elapsed(d.time, now)} ago</span></span>
        <span className="tt-stream-title"><strong>{l?.symbol || d.name.split(" / ")[0]}</strong><Chip tone={a.tone}>{a.label}</Chip></span>
        <span className="tt-stream-description">{d.status === "executed" ? `${a.source} · paper fill confirmed` : d.judgment ? (d.judgment.action === "hold" ? "Waiting for a better setup" : `${executionLabel(d)} · no fill`) : d.reasons[0] || "Evaluation incomplete"}</span>
        {recoveredAt && <span className="tt-recovered">Historical skip · X recovered {clock(recoveredAt)}</span>}
        {!!d.memories.length && <span className="tt-memory-count"><BrainLogo size={14} /> {d.memories.length} recalled {d.memories.length === 1 ? "episode" : "episodes"}</span>}
      </span>
    </button>;
  }

  return <div className="tt-app">
    <header className="tt-header">
      <div className="tt-brand"><img className="tt-chain-logo" src={bnbChainLogo} alt="BNB Chain" /><span className="tt-brand-divider" aria-hidden="true" /><div className="tt-product-brand"><TypeSafeLogo size={32} /><h1>Trading Terminal</h1></div></div>
      <div className="tt-session"><span>Paper capital <strong>{dollars(state?.ledger.initialCashUsd)}</strong></span><span className="tt-status"><Circle size={8} fill="currentColor" className={state?.running && !state.halted ? "tt-positive" : "tt-muted"} /> {state?.halted ? "Safety locked" : state?.running ? "Autonomous" : "Not armed"}</span></div>
      <div className="tt-header-tools"><a className="tt-architecture-link" href={architecturePath}>Architecture <ArrowUpRight size={14}/></a><button onClick={onReplay} title="Open historical JEV replay"><History size={15} /> Replay</button><button aria-label="Paper trading policy" title="Paper trading policy" onClick={() => setModal("policy")}><ShieldCheck size={18} /></button></div>
    </header>

    <section className="tt-current" aria-label="Current agent activity">
      <span className={`tt-current-icon ${activity.active ? "tt-working" : ""}`}>{activity.active ? <LoaderCircle size={23} /> : <Radio size={23} />}</span>
      <div className="tt-current-copy"><strong>{disconnected ? "Terminal connection interrupted" : activity.title}</strong><span>{disconnected ? "Showing the last received session. Activity may be stale." : activity.detail}</span></div>
      <div className="tt-last-assessed"><Clock3 size={19} /><div><span>{latest ? `Last assessed ${elapsed(latest.time, now)} ago` : "Awaiting first assessment"}</span><small>{latest ? `${latest.name.split(" / ")[0]} · ${clock(latest.time)} · ${decisionAction(latest).label}` : "Only recorded model replies appear here"}</small></div></div>
      <button className="tt-last-fill" onClick={() => setModal("ledger")}><Wallet size={19} /><span><strong>{lastFill ? `Last fill · ${lastFill.side.toUpperCase()}` : "No paper fills yet"}</strong><small>{lastFill ? `${elapsed(lastFill.time, now)} ago · ${lastFill.name.split(" / ")[0]}` : "Watching for the first entry"}</small></span></button>
      <button className="tt-mode" onClick={() => setModal("live")}><LockKeyhole size={14} /><span>Paper trading only<small>Real trading locked</small></span></button>
    </section>

    <main className="tt-grid">
      <aside className="tt-radar" aria-label="Launch radar">
        <div className="tt-radar-top"><div className="tt-section-title"><h2>Launch radar</h2><span title={feed?.updatedAt ? `Last GMGN update ${stamp(feed.updatedAt)}` : "Connecting"}><Circle size={7} fill="currentColor" className={fresh ? "tt-positive" : "tt-muted"} /> GMGN</span></div>
          <div className="tt-platforms" role="group" aria-label="Launchpad filter">{(["all", "flap", "fourmeme"] as const).map(p => <button key={p} aria-pressed={platform === p} onClick={() => { setPlatform(p); setExpanded([]); }}>{p === "all" ? "All" : platformLabel(p)}</button>)}</div>
          <label className="tt-search"><Search size={14} /><input aria-label="Search launches" placeholder="Search token or contract" value={query} onChange={e => { setQuery(e.target.value); setExpanded([]); }} />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={13} /></button>}</label>
        </div>
        <div className="tt-radar-list" ref={rail}>
          {!feed && <div className="tt-empty"><LoaderCircle className="tt-spin" size={22} /><p>{disconnected ? "Launch feed unavailable" : "Connecting to GMGN"}</p></div>}
          {feed && sections.map(section => {
            const list = filtered.filter(l => l.stage === section.stage).sort((a,b) => section.stage === "bonding" ? (b.progress ?? 0) - (a.progress ?? 0) : section.stage === "graduated_reported" ? (b.reportedGraduatedAt ?? 0) - (a.reportedGraduatedAt ?? 0) : (b.createdAt ?? 0) - (a.createdAt ?? 0));
            const isExpanded = expanded.includes(section.stage);
            return <section className="tt-launch-group" key={section.stage}>
              <h3>{section.label}<span>{list.length}</span></h3>
              {!list.length && <p className="tt-group-empty">{query ? "No matches" : "No launches in this feed"}</p>}
              {(isExpanded ? list : list.slice(0, section.limit)).map(l => {
                const held = state?.ledger.positions.some(p => p.token.toLowerCase() === l.address.toLowerCase());
                const watched = monitor?.items.find(i => i.token === l.address && i.admission.eligible);
                return <button key={l.id} className={`tt-launch ${selected === l.address ? "selected" : ""} ${arrivalIds.includes(l.id) ? "tt-new-launch" : ""}`} onClick={() => selectToken(l.address)} aria-pressed={selected === l.address}>
                  <Logo launch={l} /><span className="tt-launch-body"><span className="tt-launch-title"><strong title={l.name}>{l.symbol}</strong><small>{arrivalIds.includes(l.id) ? <Chip tone="hold">NEW</Chip> : section.stage === "bonding" && l.progress != null ? `${Math.round(l.progress * 100)}%` : elapsed(section.stage === "graduated_reported" ? l.reportedGraduatedAt : l.createdAt, now)}</small></span>
                  <span className="tt-launch-sub"><span>{platformLabel(l.platform)}</span><span className={held || watched ? "tt-positive" : ""}>{held ? "Position active" : watched ? "JEV monitoring" : section.stage === "graduated_reported" ? "Screening" : "Observe only"}</span></span>
                  {section.stage === "bonding" && l.progress != null && <progress max="1" value={l.progress} aria-label={`${l.symbol} graduation progress`} />}
                  <span className="tt-launch-liquidity">Liquidity <b>{dollars(l.liquidityUsd, true)}</b>{l.holders != null && <span>{l.holders.toLocaleString()} holders</span>}</span></span>
                </button>;
              })}
              {list.length > section.limit && <button className="tt-show-more" onClick={() => setExpanded(e => isExpanded ? e.filter(s => s !== section.stage) : [...e, section.stage])}>{isExpanded ? "Show fewer" : `View all ${list.length}`}<ChevronDown size={12} className={isExpanded ? "tt-rotate" : ""} /></button>}
            </section>;
          })}
        </div>
        <div className="tt-radar-foot"><span>Entries after graduation.</span><small>{feed?.updatedAt ? `Feed ${elapsed(feed.updatedAt, now)} ago${fresh ? "" : " · stale"}` : "Waiting for launch feed"}</small></div>
      </aside>

      <div className="tt-center">
        <section ref={chartPanel} className={`tt-chart-panel ${chartExpanded ? "tt-chart-expanded" : ""}`} aria-label="Selected token chart" role={chartExpanded ? "dialog" : undefined} aria-modal={chartExpanded || undefined}>
          <div className="tt-token-header"><Logo launch={launch} size={43} /><div className="tt-token-name"><h2 title={symbol}>{symbol}</h2><span>{launch ? platformLabel(launch.platform) : "BSC"} {selected && <button onClick={() => void copyContract()} title={selected} aria-label="Copy token contract"><Copy size={12} /></button>}</span></div>
            <div className="tt-token-stage">{launch && <Chip tone={launch.stage === "graduated_reported" ? "buy" : "neutral"}>{launch.stage === "graduated_reported" ? "Graduated · GMGN" : launch.stage === "bonding" ? "Bonding" : "New launch"}</Chip>}</div>
            <div className="tt-price"><small>Price (USD)</small><strong>{price(launch?.priceUsd ?? pool?.priceUsd)}</strong></div><div className="tt-liquidity"><small>Liquidity</small><strong>{dollars(launch?.liquidityUsd ?? pool?.liquidityUsd, true)}</strong></div>
          </div>
          <div className="tt-chart-frame"><div className="tt-chart-tools"><div className="tt-timeframes" role="group" aria-label="Chart timeframe">{(["1", "5", "15"] as const).map(v => <button key={v} aria-pressed={interval === v} onClick={() => setIntervalValue(v)}>{v}m</button>)}</div><span><BarChart3 size={14} /> Candles + volume</span>{selected && <a href={`https://gmgn.ai/bsc/token/${selected}`} target="_blank" rel="noreferrer" aria-label="Open token on GMGN"><ExternalLink size={14} /></a>}<button onClick={() => setChartExpanded(v => !v)} aria-label={chartExpanded ? "Collapse chart" : "Expand chart"}>{chartExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button></div>
            <div className="tt-chart-area">{candles.length ? <Chart candles={candles} decisions={markers} compactMarkers interval={Number(interval)} position={position} milestone={launch?.reportedGraduatedAt ? { time: launch.reportedGraduatedAt, label: "Graduated" } : undefined} /> : <div className="tt-empty"><BarChart3 size={32} /><strong>{chartLoading ? "Loading market candles" : selected ? "Chart unavailable" : "Select a launch"}</strong><p>{chartLoading ? "Fetching the selected interval" : chartError || "Choose a token from the launch radar"}</p>{selected && !chartLoading && <button className="tt-secondary" onClick={() => setRetry(v => v + 1)}>Retry chart</button>}</div>}</div>
            <div className="tt-chart-caption"><span>{chartSource} · {chartSource === "GMGN" ? "token-wide" : "pool"} candles · UTC</span><span>{chartError && candles.length ? "Update failed · " : ""}{chartAt ? `Received ${elapsed(chartAt, now)} ago` : chartLoading ? "Loading" : "No price data"}</span></div>
          </div>
        </section>

        <section className="tt-context" aria-label="Decision context">
          <div className="tt-context-heading"><h2>Decision context</h2>{record ? <span title={stamp(record.time)}>{record.name.split(" / ")[0]}<Chip tone={action?.tone}>{action?.label}</Chip><time>{clock(record.time)}</time><small>Recorded</small></span> : <span>Awaiting an assessment</span>}</div>
          <div className="tt-pipeline" role="group" aria-label="Decision evidence stages">
            {([{ key: "memory", label: "Recall", detail: phases.recall, done: phases.recall === "retrieved" || phases.recall === "cold start" || phases.recall === "no matches", Icon: Database }, { key: "assessment", label: "Assess", detail: record?.judgment ? "Context evaluated" : "Awaiting JEV", done: phases.assessed, Icon: Sparkles }, { key: "sources", label: "Decide", detail: action ? `${action.source} · ${action.label}` : "No decision yet", done: phases.assessed || !!record?.ruleExit, Icon: Activity }, { key: "capture", label: "Capture", detail: capturePhase, done: capturePhase === "completed", Icon: FileText }] as const).map(step => <button key={step.key} aria-pressed={contextTab === step.key} onClick={() => setContextTab(step.key)}><span className={`tt-step-icon ${step.done ? "done" : ""}`}>{step.done ? <Check size={17} /> : <step.Icon size={16} />}</span><strong>{step.label}</strong><small>{step.detail}</small></button>)}
          </div>

          {contextTab === "memory" && <div className="tt-memory-coordination"><div className="tt-memory-recall"><BrainLogo size={44} /><div><div className="tt-mini-heading">{memoryName} {record?.memories.length ? <small>{record.memories.length} recalled</small> : null}</div><strong>{record?.memories[0]?.title || (phases.recall === "cold start" || phases.recall === "no matches" ? "No matching episodes yet" : (memoryConnection?.state==='missing'?`${memoryName} connection required`:memoryConnection?.state==='error'?`${memoryName} recall unavailable`:'Memory context awaits an assessment'))}</strong><p>{record?.memories[0]?.summary || (record ? record.memoryStatus || "No retrieval result was recorded." : "Relevant past episodes will appear beside JEV’s assessment.")}</p>{record?.memories[0] ? <button className="tt-evidence-button" onClick={() => showMemory(record.memories[0])}><FileText size={14} /> View episode <ArrowUpRight size={13} /></button> : <small>Retrieval is shown as recorded—not inferred learning.</small>}</div></div><div className="tt-model-assessment"><TypeSafeLogo size={34} /><div><div className="tt-mini-heading">JEV assessment</div>{record?.judgment ? <><Chip tone={memoryAssessment ? "hold" : "neutral"}>{memoryAssessment?.valueLabel || "No memory assessment"}</Chip><p>Selected <b>{action?.label}</b></p><small>{record.memories.length ? "Inspect the retrieved evidence below." : "This decision had no recalled episode."}</small><button className="tt-text-button" onClick={() => setModal("evidence")}>View evidence <ArrowUpRight size={12} /></button></> : <p>Waiting for a recorded model response.</p>}</div></div></div>}
          {contextTab === "assessment" && <div className="tt-context-body"><div className="tt-inline-brand"><TypeSafeLogo size={27} /><strong>{record?.judgment ? "Recorded JEV assessment" : "No JEV assessment yet"}</strong></div>{record?.judgment ? <><div className="tt-probabilities">{Object.entries(record.judgment.probabilities).map(([key, val]) => <div key={key}><span>{key.toUpperCase()}</span><strong>{(val * 100).toFixed(1)}%</strong><progress max="1" value={val} aria-label={`${key} probability`} /></div>)}</div><p>{contextAssessment?.valueLabel || record.reasons[0] || "Typed action probabilities returned by JEV."}</p><small>Model confidence is not a profit forecast. Source assessments are separate outputs, not a reasoning trace.</small><button className="tt-text-button" onClick={() => setModal("evidence")}>Inspect questions & source assessments <ArrowUpRight size={12} /></button></> : <p>{record?.reasons[0] || "The model response will appear when a launch qualifies."}</p>}</div>}
          {contextTab === "sources" && <div className="tt-context-body"><div className="tt-outcome"><Chip tone={action?.tone}>{record ? executionLabel(record) : "Awaiting decision"}</Chip><span>{record?.status === "executed" ? "Paper simulation only" : "No order filled"}</span></div><p>{record?.reasons.join(" · ") || (item ? item.detail : "New launches are observed until graduation and monitoring thresholds are met.")}</p><div className="tt-source-counts"><span><BarChart3 size={14} /> {record?.snapshot?.source || "Market snapshot pending"}</span><span><Link2 size={14} /> {record?.research?.sources.length ?? 0} X citations</span><span><BrainLogo size={15} /> {record?.memories.length ?? 0} memories</span></div><button className="tt-evidence-button" onClick={() => setModal("evidence")}>View sources & execution checks <ArrowUpRight size={13} /></button></div>}
          {contextTab === "capture" && <div className="tt-context-body"><div className="tt-inline-brand"><BrainLogo size={30} /><strong>Memory capture</strong><Chip>{capturePhase}</Chip></div><p>{episode ? `${episode.summary}. ${episode.capture.detail||'Saved for future contextual recall.'}` : record?.memoryCapture || 'No capture is linked to this historical decision. New meaningful HOLDs, observations and fills now create episodes.'}</p>{episode&&<p>{episode.recalledBy.length?`Recalled in ${episode.recalledBy.length} later assessments.`:'Not recalled by a later assessment yet.'}{episode.decisionId!==record?.id?' Unchanged context: linked to an earlier saved episode.':''}</p>}<small>Follow the experience ledger below for ingestion receipts and outcome checks. A captured memory is not proof of improved performance.</small></div>}
          <AssessmentReceiptView decision={record} episodes={state?.memoryEpisodes} />
          {record && <div className="tt-context-foot"><button onClick={() => setModal("evidence")}><Link2 size={12} /> {record.research?.sources.length ?? 0} cited posts · {record.memories.length} memory pages</button><span>{elapsed(record.time, now)} ago · {record.status === "executed" ? "Fill recorded" : "No fill"}</span></div>}
        </section>
        <MemoryJournal episodes={state?.memoryEpisodes??[]} token={selected} now={now} onDecision={id=>{const d=decisions.find(d=>d.id===id);if(d)selectDecision(d);else setNotice('This decision is outside the retained stream window; its episode remains in the experience ledger.');}}/>
        <SupportingResearch token={selected} decision={record} now={now} eligible={!!item?.admission.eligible} />

        <section className="tt-position-shelf" aria-label="Paper positions"><Wallet size={22} /><div><strong>{position ? `${symbol} · Paper position` : "Paper portfolio"}</strong><p>{position ? `${dollars(position.costUsd)} remaining cost · ${position.entries ?? 1} ${position.entries === 1 ? "entry" : "entries"}` : `${state?.ledger.positions.length ?? 0} open positions · ${dollars(state?.ledger.cashUsd)} available`}</p></div><div className="tt-shelf-pnl"><small>Unrealized P&L</small><b><Money value={performance?.unrealized} /></b></div><button onClick={() => setModal("ledger")} className="tt-icon-button" aria-label="Open paper portfolio"><ArrowUpRight size={18} /></button></section>
        <div className="tt-selection-status"><span><Circle size={6} fill="currentColor" /> {item ? monitorLabel(item.status) : launch?.stage === "graduated_reported" ? "Awaiting screening" : "Observing launch"}</span><button onClick={() => setModal("policy")}>View trading criteria</button></div>
      </div>

      <aside className="tt-stream" aria-label="Decision stream"><div className="tt-stream-header"><h2>Decision stream</h2><select aria-label="Filter decisions" value={streamFilter} onChange={e => setStreamFilter(e.target.value)}><option value="all">All decisions</option><option value="model">JEV only</option><option value="fills">Paper fills</option><option value="selected">Selected token</option></select></div>
        <div className="tt-stream-list">{groups.length ? groups.map(group => <div className="tt-stream-group" key={group.id}>{streamCard(group.records[0])}{group.records.length > 1 && <><button className="tt-hold-group" aria-expanded={openGroups.includes(group.id)} onClick={() => setOpenGroups(g => g.includes(group.id) ? g.filter(id => id !== group.id) : [...g, group.id])}><History size={14} /><span>{group.records.length - 1} earlier HOLD {group.records.length === 2 ? "assessment" : "assessments"}</span><ChevronDown size={13} /></button>{openGroups.includes(group.id) && group.records.slice(1).map(d => streamCard(d, true))}</>}</div>) : <div className="tt-stream-empty"><TypeSafeLogo size={43} /><strong>{streamFilter === "fills" ? "The first entry starts here" : "Watching for the next setup"}</strong><p>{streamFilter === "fills" ? "Paper fills will appear when a JEV action passes execution checks." : "Recorded assessments appear automatically as launches qualify."}</p><button className="tt-evidence-button" onClick={onReplay}><History size={14} /> Explore JEV replay</button></div>}</div>
        <div className="tt-stream-foot"><Circle size={10} fill="currentColor" className={activity.active ? "tt-positive" : "tt-muted"} /><div>{activity.active ? "Evaluation in progress" : "Waiting for the next recorded assessment"}<small>{latest ? `Last model reply ${elapsed(latest.time, now)} ago` : "No model reply recorded yet"}</small></div></div>
      </aside>
    </main>

    <footer className="tt-footer"><span><TypeSafeLogo size={17} /> JEV by TypeSafe <span className="tt-divider" /> <BrainLogo size={18} /> {memoryName} <span className="tt-divider" /> {state?.assessmentService?.state==='ready'?'BNB Agent Studio · SDK':'BNB Agent SDK'}</span><span>Live market data · Paper simulation <span className="tt-divider" /> Realized <Money value={performance?.realized} /></span></footer>
    <div className="tt-sr-only" role="status" aria-live="polite">{announcement}</div>
    {notice && <div className="tt-notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={15} /></button></div>}
    <dialog ref={dialog} className="tt-dialog" aria-label={modal ? { policy: "Paper trading policy", ledger: "Paper portfolio", evidence: "Decision evidence", memory: `${memoryName} episode`, live: "Real trading locked" }[modal] : "Terminal details"} onCancel={() => setModal(null)} onClick={e => { if (e.target === dialog.current) setModal(null); }}>
      <div className="tt-dialog-inner"><button className="tt-dialog-close" aria-label="Close dialog" onClick={() => setModal(null)}><X size={20} /></button>
        {modal === "live" && <><LockKeyhole size={27} /><h2>Paper trading, real market data.</h2><p>Real execution remains locked. This terminal does not submit on-chain trades.</p><p>Wallet signing, live limits, and the execution adapter must be verified before real trading can be enabled.</p>{state?.liveBlockers.length ? <ul>{state.liveBlockers.map((b,i) => <li key={i}>{b}</li>)}</ul> : null}</>}
        {modal === "policy" && <><ShieldCheck size={26} /><h2>Paper trading policy</h2><p>JEV decides the action. Code checks permission to execute. Current settings—not validated trading alpha.</p><div className="tt-policy-grid"><div><small>Starter / add</small><strong>{dollars(policy.orderUsd)}</strong></div><div><small>Per token / positions</small><strong>{dollars(policy.maxPositionUsd)} / {policy.maxPositions}</strong></div><div><small>Total remaining cost</small><strong>{dollars(policy.maxExposureUsd)}</strong></div><div><small>Daily realized loss limit</small><strong>{dollars(policy.dailyLossUsd)}</strong></div></div><h3>Monitoring and entry are separate</h3><p>Monitoring: graduation within 24h, liquidity ≥ $10k, ≥ 25 holders, ≥ $1k volume and 10 swaps in 5m, fresh feeds and no reported hard risk.</p><p>Entry: liquidity ≥ $20k, JEV confidence ≥ 80%, quality ≥ 2 and toxic-flow score ≤ 0.25, plus portfolio checks. Adds need +10% net return and a two-minute cooldown.</p><h3>Current exit behavior</h3><p>JEV SELL exits the remaining position. Code also enforces a −25% stop, half-trims at +50% and +100%, then a 25% trailing stop. Code exits are labelled separately in the stream.</p><p>Simulation: 0.3% fee + 0.5% slippage per side. The current loop is not a 1-second model loop.</p>{item && <details><summary>Selected launch: monitoring checks</summary><div className="tt-check-list">{item.admission.checks.map(c => <div key={c.label}><Chip tone={c.pass ? "buy" : "neutral"}>{c.pass ? "Pass" : "Waiting"}</Chip><span><strong>{c.label}</strong><p>{c.detail}</p></span></div>)}</div></details>}{state && state.access?.operator !== false && !state.running && !state.halted && <button className="tt-primary" disabled={arming || !feed?.enabled || !monitor?.enabled} onClick={() => void arm()}>{arming ? "Arming…" : "Arm autonomous paper session"}</button>}{state?.halted && <p>Safety lock is active. It has not been cleared by this redesign.</p>}</>}
        {modal === "ledger" && <><Wallet size={26} /><h2>Paper portfolio</h2><div className="tt-policy-grid"><div><small>Equity · gross marks</small><strong>{dollars(performance?.equity)}</strong></div><div><small>Available cash</small><strong>{dollars(performance?.cash)}</strong></div><div><small>Realized P&L</small><strong><Money value={performance?.realized} /></strong></div><div><small>Unrealized · before exit costs</small><strong><Money value={performance?.unrealized} /></strong></div></div><h3>Open positions</h3>{state?.ledger.positions.length ? state.ledger.positions.map(p => <button className="tt-ledger-row" key={p.token} onClick={() => { selectToken(p.token); setModal(null); }}><strong>{p.name}</strong><span>{dollars(p.costUsd)} remaining cost</span><ArrowUpRight size={15} /></button>) : <p>No open paper positions.</p>}<h3>Fills</h3>{state?.ledger.fills.length ? [...state.ledger.fills].sort((a,b) => b.time - a.time).map(f => <div className="tt-ledger-row" key={f.id}><Chip tone={f.side}>{f.side.toUpperCase()}</Chip><span><strong>{f.name}</strong><small>{stamp(f.time)} · fee {dollars(f.feeUsd)}</small></span><span>{dollars(f.quantity * f.priceUsd)}</span></div>) : <p>No fills have been recorded in this session.</p>}<small>Mark-to-market requires a fresh GMGN price for every position. Missing marks appear as unavailable, not zero.</small></>}
        {modal === "memory" && memory && <><div className="tt-inline-brand"><BrainLogo size={36} /><span>{memoryName} · retrieved episode</span></div><h2>{memory.title}</h2><div className="tt-memory-metadata"><Chip>{memory.status}</Chip><span>{memorySearchLabel(memory)}</span></div><p className="tt-memory-text">{memory.summary}</p><small>Page ID: {memory.pageId}</small><p>Captured as an input to the selected decision. No unrecorded version or subsequent update is assumed.</p>{record?.judgment?.assessments?.filter(a => a.kind === "memory" && a.referenceId === memory.pageId).map(a => <AssessmentCard key={a.id} assessment={a} />)}</>}
        {modal === "evidence" && <><div className="tt-inline-brand"><TypeSafeLogo size={30} /><h2>Decision evidence</h2></div>{record ? <><p>{record.name} · {stamp(record.time)} · {executionLabel(record)}</p><div className="tt-outcome"><Chip tone={action?.tone}>{action?.source} · {action?.label}</Chip><span>{record.status === "executed" ? "Paper fill confirmed" : "No fill"}</span></div><p>{record.reasons.join(" · ")}</p><h3 id="evidence-market">Market snapshot</h3>{record.snapshot ? <><div className="tt-policy-grid"><div><small>Price</small><strong>{price(record.snapshot.priceUsd)}</strong></div><div><small>Liquidity</small><strong>{dollars(record.snapshot.liquidityUsd, true)}</strong></div><div><small>24h volume</small><strong>{dollars(record.snapshot.volume24h, true)}</strong></div><div><small>Buy / sell count</small><strong>{record.snapshot.buyCount} / {record.snapshot.sellCount}</strong></div></div><small>{marketSources(record.snapshot).price} · trade {stamp(record.snapshot.marketAt)}</small><small>{marketSources(record.snapshot).metrics} · received {stamp(record.snapshot.metricsReceivedAt ?? record.snapshot.observedAt)}</small><GeckoAttribution snapshot={record.snapshot}/></> : <p>No market snapshot recorded.</p>}<h3>JEV source assessments</h3>{record.judgment?.assessments?.length ? record.judgment.assessments.map(a => <AssessmentCard key={a.id} assessment={a} />) : <p>No source assessments were recorded.</p>}<small>These typed assessments are independent answers, not the model’s private reasoning. They do not establish that memory improved the trade.</small><h3>{memoryName}</h3>{record.memories.map((m,i) => <div key={m.pageId} id={`evidence-M${i + 1}`}><button className="tt-ledger-row" onClick={() => showMemory(m)}><BrainLogo size={25} /><strong>{m.title}</strong><ArrowUpRight size={15} /></button></div>)}{!record.memories.length && <p>{record.memoryStatus || "No retrieved memories recorded."}</p>}<h3>X citations</h3><XEvidence research={record.research} now={now} assessments={record.judgment?.assessments} /><h3>Execution checks</h3><div className="tt-check-list">{record.checks.map((c,i) => <div key={i}><Chip tone={c.pass ? "buy" : "neutral"}>{c.pass ? "Pass" : "Not met"}</Chip><span><strong>{c.label}</strong><p>{c.detail}</p></span></div>)}</div>{!record.checks.length && <p>No execution checks recorded.</p>}<small>Decision {record.id}{record.judgment ? ` · ${record.judgment.model} · request ${record.judgment.requestId}` : ""}</small></> : <p>Select a recorded decision to inspect its sources. New launches will enter assessment when they qualify.</p>}</>}
      </div>
    </dialog>
  </div>;
}
