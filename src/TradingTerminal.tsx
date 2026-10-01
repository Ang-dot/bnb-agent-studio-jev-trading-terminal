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
import { NarrativeSummary } from "./NarrativeEvidence.js";
import { SupportingResearch } from "./SupportingResearch.js";
import { MemoryJournal } from './MemoryJournal.js';
import { MemoryRecallPanel } from './MemoryRecallPanel.js';
import { MemoryDetails, MemoryEvidenceList } from './MemoryDetails.js';
import { AssessmentReceiptView } from './AssessmentReceipt.js';
import { marketCapForToken, xRecoveredAt } from "./trading-view.js";
import { emptyArrivals, platformLabel, reconcileArrivals, selectLaunches, type Launch, type LaunchFeedState, type LaunchStage, type Platform } from "./launches.js";
import { monitorLabel, type MonitorState } from "./monitoring.js";
import { initialFocus, paperPerformance } from "./terminal-insights.js";
import { PAPER_POLICY as policy } from "./paper-settings.js";
import { currentActivity, decisionAction, elapsed, groupDecisions, memoryPhases, tokenForDecision, chartRecords, recentlyAssessedToken } from "./trading-view.js";
import type { Candle, Decision, Memory, TerminalState } from "./types.js";
import type { JournalView } from './memory.js';
import "./trading-terminal.css";

const dollars = (n: number | null | undefined, compact = false) => n == null || !Number.isFinite(n) ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 1 : 2 }).format(n);
const price = (n?: number | null) => n == null || n <= 0 ? "—" : n < 1 ? `$${n.toPrecision(5)}` : dollars(n);
const clock = (n: number) => new Date(n).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const stamp = (n: number) => new Date(n).toLocaleString("en-GB");
const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
const noDecisions: Decision[] = [];
const sections: { stage: LaunchStage; label: string; limit: number }[] = [{ stage: "new", label: "Just launched", limit: 2 }, { stage: "bonding", label: "Bonding · paper eligible", limit: 1 }, { stage: "graduated_reported", label: "Graduated", limit: 3 }];

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
  const stateEtag=useRef<string|null>(null);
  const [journal, setJournal] = useState<JournalView | null>(null);
  const [feed, setFeed] = useState<LaunchFeedState | null>(null);
  const [monitor, setMonitor] = useState<MonitorState | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [selected, setSelected] = useState("");
  const [recordId, setRecordId] = useState("");
  const linkedEpisodeId=state?.decisions.find(d=>d.id===recordId)?.memoryEpisodeId;
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
      if (pending || document.hidden) return;
      pending = true;
      try {
        const stateRequest=(async()=>{
          const headers:HeadersInit=stateEtag.current?{'If-None-Match':stateEtag.current}:{};
          const response=await fetch(apiPath('/api/state'),{cache:'no-store',headers,signal:controller.signal});
          if(response.status===304)return null;
          if(!response.ok)throw new Error(`Request unavailable (${response.status})`);
          stateEtag.current=response.headers.get('etag');
          return response.json() as Promise<TerminalState>;
        })();
        const [s, f, m] = await Promise.all([stateRequest, read<LaunchFeedState>("/api/launches", controller.signal), read<MonitorState>("/api/monitor", controller.signal)]);
        if (disposed) return;
        if(s){
          if(s.edition!==edition||s.memoryProvider!==memoryName)throw new Error('Memory edition mismatch');
          setState(s);
        }
        setFeed(prev => JSON.stringify(prev) === JSON.stringify(f) ? prev : f);
        setMonitor(prev => JSON.stringify(prev) === JSON.stringify(m) ? prev : m);
        setDisconnected(false);
        if (f.updatedAt !== lastFeed.current) {
          lastFeed.current = f.updatedAt;
          arrivals.current = reconcileArrivals(arrivals.current, f.launches, Date.now());
          setArrivalIds(arrivals.current.added);
          if (arrivals.current.added.length) setAnnouncement(`${arrivals.current.added.length} new launches detected by GMGN`);
        }
        if(s){
          const next = s.decisions.filter(d => seenDecisions.current && !seenDecisions.current.has(d.id)).map(d => d.id);
          if (next.length) setDecisionIds(next);
          seenDecisions.current = new Set(s.decisions.map(d => d.id));
          setSelected(prev => prev || recentlyAssessedToken(s.decisions, s.pools, f.launches, Date.now()) || initialFocus(f.launches, m.items, Date.now()));
        }
      } catch { if (!disposed) setDisconnected(true); }
      finally { pending = false; }
    }
    void refresh();
    const polling = window.setInterval(() => void refresh(), 4000);
    document.addEventListener('visibilitychange',refresh);
    const ticking = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { disposed = true; controller.abort(); window.clearInterval(polling); window.clearInterval(ticking); document.removeEventListener('visibilitychange',refresh); };
  }, []);
  useEffect(()=>{
    let disposed=false;
    const controller=new AbortController();
    const refresh=async()=>{
      if(document.hidden)return;
      const params=new URLSearchParams();
      if(/^0x[0-9a-f]{40}$/i.test(selected))params.set('token',selected.toLowerCase());
      if(linkedEpisodeId)params.set('linkedId',linkedEpisodeId);
      try {const next=await read<JournalView>(`/api/journal?${params}`,controller.signal);if(!disposed)setJournal(next);}catch{/* Last confirmed journal remains visible. */}
    };
    setJournal(null);
    void refresh();
    const timer=window.setInterval(()=>void refresh(),60000);
    document.addEventListener('visibilitychange',refresh);
    return()=>{disposed=true;controller.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[selected,linkedEpisodeId,state?.decisions[0]?.id]);
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
  const episode = journal?.linked?.id===record?.memoryEpisodeId?journal?.linked:undefined;
  const capturePhase = episode?.capture.status || phases.capture;
  const memoryConnection=state?.providers.find(p=>p.name===memoryName);
  const performance = state ? paperPerformance(state.ledger, launches, now) : null;
  const symbol = launch?.symbol || pool?.symbol || (record && tokenForDecision(record, state?.pools ?? []) === selected ? record.name.split(" / ")[0] : "Select a launch");
  const marketCap = marketCapForToken(selected, launch, selectedDecisions[0]);
  const marketCapLabel = marketCap.recorded ? "Assessed mcap" : marketCap.observedAt != null && now-marketCap.observedAt>90_000 ? "Mcap · last seen" : "Mcap";
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
                  <span className="tt-launch-sub"><span>{platformLabel(l.platform)}</span><span className={held || watched ? "tt-positive" : ""}>{held ? "Position active" : watched ? "JEV monitoring" : "Screening"}</span></span>
                  {section.stage === "bonding" && l.progress != null && <progress max="1" value={l.progress} aria-label={`${l.symbol} graduation progress`} />}
                  <span className="tt-launch-liquidity tt-launch-mcap" title="GMGN-reported token market capitalization in USD">Mcap <b>{dollars(l.marketCapUsd, true)}</b></span>
                  <span className="tt-launch-liquidity">Liquidity <b>{dollars(l.liquidityUsd, true)}</b>{l.holders != null && <span>{l.holders.toLocaleString()} holders</span>}</span></span>
                </button>;
              })}
              {list.length > section.limit && <button className="tt-show-more" onClick={() => setExpanded(e => isExpanded ? e.filter(s => s !== section.stage) : [...e, section.stage])}>{isExpanded ? "Show fewer" : `View all ${list.length}`}<ChevronDown size={12} className={isExpanded ? "tt-rotate" : ""} /></button>}
            </section>;
          })}
        </div>
        <div className="tt-radar-foot"><span>Aggressive paper · entries before graduation.</span><small>{feed?.updatedAt ? `Feed ${elapsed(feed.updatedAt, now)} ago${fresh ? "" : " · stale"}` : "Waiting for launch feed"}</small></div>
      </aside>

      <div className="tt-center">
        <section ref={chartPanel} className={`tt-chart-panel ${chartExpanded ? "tt-chart-expanded" : ""}`} aria-label="Selected token chart" role={chartExpanded ? "dialog" : undefined} aria-modal={chartExpanded || undefined}>
          <div className="tt-token-header"><Logo launch={launch} size={43} /><div className="tt-token-name"><h2 title={symbol}>{symbol}</h2><span>{launch ? platformLabel(launch.platform) : "BSC"} {selected && <button onClick={() => void copyContract()} title={selected} aria-label="Copy token contract"><Copy size={12} /></button>}</span></div>
            <div className="tt-token-stage">{launch && <Chip tone={launch.stage === "graduated_reported" ? "buy" : "neutral"}>{launch.stage === "graduated_reported" ? "Graduated · GMGN" : launch.stage === "bonding" ? "Bonding" : "New launch"}</Chip>}</div>
            <div className="tt-token-metrics"><div className="tt-price"><small>Price (USD)</small><strong>{price(launch?.priceUsd ?? pool?.priceUsd)}</strong></div><div className="tt-liquidity tt-market-cap" title={marketCap.value == null ? "Market capitalization unavailable" : `GMGN-reported market capitalization in USD · ${marketCap.recorded ? "assessment" : "feed"} receipt ${stamp(marketCap.observedAt!)}`}><small>{marketCapLabel}</small><strong>{dollars(marketCap.value, true)}</strong></div><div className="tt-liquidity"><small>Liquidity</small><strong>{dollars(launch?.liquidityUsd ?? pool?.liquidityUsd, true)}</strong></div></div>
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

          {contextTab === "memory" && <MemoryRecallPanel memoryName={memoryName} record={record} emptyTitle={phases.recall === "cold start" || phases.recall === "no matches" ? "No matching episodes yet" : memoryConnection?.state === "missing" ? `${memoryName} connection required` : memoryConnection?.state === "error" ? `${memoryName} recall unavailable` : "Memory context awaits an assessment"} onMemory={showMemory} onEvidence={() => setModal("evidence")} />}
          {contextTab === "assessment" && <div className="tt-context-body"><div className="tt-inline-brand"><TypeSafeLogo size={27} /><strong>{record?.judgment ? "Recorded JEV assessment" : "No JEV assessment yet"}</strong></div>{record?.judgment ? <><div className="tt-probabilities">{Object.entries(record.judgment.probabilities).map(([key, val]) => <div key={key}><span>{key.toUpperCase()}</span><strong>{(val * 100).toFixed(1)}%</strong><progress max="1" value={val} aria-label={`${key} probability`} /></div>)}</div><p>{contextAssessment?.valueLabel || record.reasons[0] || "Typed action probabilities returned by JEV."}</p><small>Model confidence is not a profit forecast. Source assessments are separate outputs, not a reasoning trace.</small><button className="tt-text-button" onClick={() => setModal("evidence")}>Inspect questions & source assessments <ArrowUpRight size={12} /></button></> : <p>{record?.reasons[0] || "The model response will appear when a launch qualifies."}</p>}</div>}
          {contextTab === "sources" && <div className="tt-context-body"><div className="tt-outcome"><Chip tone={action?.tone}>{record ? executionLabel(record) : "Awaiting decision"}</Chip><span>{record?.status === "executed" ? "Paper simulation only" : "No order filled"}</span></div><p>{record?.reasons.join(" · ") || (item ? item.detail : "New and bonding launches qualify when fresh narrative, entry location and activity support a paper probe.")}</p><NarrativeSummary research={record?.research} assessments={record?.judgment?.assessments}/><div className="tt-source-counts"><span><BarChart3 size={14} /> {record?.snapshot?.source || "Market snapshot pending"}</span><span><Link2 size={14} /> {record?.research?.sources.length ?? 0} X citations</span><span><BrainLogo size={15} /> {record?.memories.length ?? 0} memories</span></div><button className="tt-evidence-button" onClick={() => setModal("evidence")}>View sources & execution checks <ArrowUpRight size={13} /></button></div>}
          {contextTab === "capture" && <div className="tt-context-body"><div className="tt-inline-brand"><BrainLogo size={30} /><strong>Memory capture</strong><Chip>{capturePhase}</Chip></div><p>{episode ? `${episode.summary}. ${episode.capture.detail||'Saved for future contextual recall.'}` : record?.memoryCapture || 'No capture is linked to this historical decision. New meaningful HOLDs, observations and fills now create episodes.'}</p>{episode&&<p>{episode.recalledBy.length?`Recalled in ${episode.recalledBy.length} later assessments.`:'Not recalled by a later assessment yet.'}{episode.decisionId!==record?.id?' Unchanged context: linked to an earlier saved episode.':''}</p>}<small>Follow the experience ledger below for ingestion receipts and outcome checks. A captured memory is not proof of improved performance.</small></div>}
          <AssessmentReceiptView decision={record} episodes={episode?[episode]:[]} />
          {record && <div className="tt-context-foot"><button onClick={() => setModal("evidence")}><Link2 size={12} /> {record.research?.sources.length ?? 0} cited posts · {record.memories.length} memory pages</button><span>{elapsed(record.time, now)} ago · {record.status === "executed" ? "Fill recorded" : "No fill"}</span></div>}
        </section>
        <MemoryJournal view={journal} now={now} onDecision={id=>{const d=decisions.find(d=>d.id===id);if(d)selectDecision(d);else setNotice('This decision is outside the retained stream window; its episode remains in the experience ledger.');}}/>
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
        {modal === "policy" && <><ShieldCheck size={26} /><h2>Aggressive paper policy</h2><p>JEV decides the action. Code checks permission to execute. Current settings—not validated trading alpha.</p><div className="tt-policy-grid"><div><small>Starter / add</small><strong>{dollars(policy.orderUsd)}</strong></div><div><small>Per token / positions</small><strong>{dollars(policy.maxPositionUsd)} / {policy.maxPositions}</strong></div><div><small>Total remaining cost</small><strong>{dollars(policy.maxExposureUsd)}</strong></div><div><small>Daily realized loss limit</small><strong>{dollars(policy.dailyLossUsd)}</strong></div></div><h3>Narrative first, early entry</h3><p>New, bonding and graduated launches can qualify. Scout: $2k reported liquidity, 10 holders, $300 volume and 5 swaps in 5m. Entries need a recent low (within 25%) or roughly $15k–$25k market cap; a measured chase above 100% is blocked.</p><p>$25 launch or narrative-only probes; $50 DEX starters. Launch token cap $75; DEX cap $150. Strong cited fit, catalyst, timing and fresh buying can qualify before CA posts appear. Same-ticker rivalry alone permits a $25 probe. Cited token differentiation can support normal sizing; cited copycat conflicts block buys.</p><p>JEV confidence ≥ 65%, quality ≥ 1.5, toxic score ≤ 0.40. Adds need +5% modeled net strength and 60s cooldown; no averaging down.</p><h3>Recover principal, then hold the runner</h3><p>At +100% modeled net return (2×), sell enough to recover invested principal after modeled costs. At +200% and +300%, sell 15% of the original tokens each time. Remaining tokens trail by 25%; JEV can exit a broken thesis earlier.</p><p>−20% stop; after 15m, rotate a losing position if selling outweighs buying. No time exit for a healthy winner.</p><p>DEX costs: 0.3% fee + 0.5% slippage per side. Launch paper: 1% fee + 3% slippage per side on an indicative GMGN token mark; no executable curve quote or verified price time. Taxes, gas and API costs excluded. Eligible launches can be reassessed after one minute. Model calls are paced per minute, with capacity reserved for held positions; no hourly lockout.</p>{item && <details><summary>Selected launch: monitoring checks</summary><div className="tt-check-list">{item.admission.checks.map(c => <div key={c.label}><Chip tone={c.pass ? "buy" : "neutral"}>{c.pass ? "Pass" : "Waiting"}</Chip><span><strong>{c.label}</strong><p>{c.detail}</p></span></div>)}</div></details>}{state && state.access?.operator !== false && !state.running && !state.halted && <button className="tt-primary" disabled={arming || !feed?.enabled || !monitor?.enabled} onClick={() => void arm()}>{arming ? "Arming…" : "Arm autonomous paper session"}</button>}{state?.halted && <p>Safety lock is active. It has not been cleared by this redesign.</p>}</>}
        {modal === "ledger" && <><Wallet size={26} /><h2>Paper portfolio</h2><div className="tt-policy-grid"><div><small>Equity · gross marks</small><strong>{dollars(performance?.equity)}</strong></div><div><small>Available cash</small><strong>{dollars(performance?.cash)}</strong></div><div><small>Realized P&L</small><strong><Money value={performance?.realized} /></strong></div><div><small>Unrealized · before exit costs</small><strong><Money value={performance?.unrealized} /></strong></div></div><h3>Open positions</h3>{state?.ledger.positions.length ? state.ledger.positions.map(p => <button className="tt-ledger-row" key={p.token} onClick={() => { selectToken(p.token); setModal(null); }}><strong>{p.name}</strong><span>{dollars(p.costUsd)} remaining cost</span><ArrowUpRight size={15} /></button>) : <p>No open paper positions.</p>}<h3>Fills</h3>{state?.ledger.fills.length ? [...state.ledger.fills].sort((a,b) => b.time - a.time).map(f => <div className="tt-ledger-row" key={f.id}><Chip tone={f.side}>{f.side.toUpperCase()}</Chip><span><strong>{f.name}</strong><small>{stamp(f.time)} · fee {dollars(f.feeUsd)}</small></span><span>{dollars(f.quantity * f.priceUsd)}</span></div>) : <p>No fills have been recorded in this session.</p>}<small>Mark-to-market requires a fresh GMGN price for every position. Missing marks appear as unavailable, not zero.</small></>}
        {modal === "memory" && memory && <MemoryDetails memory={memory} memoryName={memoryName} record={record}/>}
        {modal === "evidence" && <><div className="tt-inline-brand"><TypeSafeLogo size={30} /><h2>Decision evidence</h2></div>{record ? <><p>{record.name} · {stamp(record.time)} · {executionLabel(record)}</p><div className="tt-outcome"><Chip tone={action?.tone}>{action?.source} · {action?.label}</Chip><span>{record.status === "executed" ? "Paper fill confirmed" : "No fill"}</span></div><p>{record.reasons.join(" · ")}</p><h3 id="evidence-market">Market snapshot</h3>{record.snapshot ? <><div className="tt-policy-grid"><div><small>Price</small><strong>{price(record.snapshot.priceUsd)}</strong></div><div><small>Market cap at assessment</small><strong>{dollars(record.snapshot.entrySetup?.marketCapUsd, true)}</strong></div><div><small>Liquidity</small><strong>{dollars(record.snapshot.liquidityUsd, true)}</strong></div><div><small>24h volume</small><strong>{dollars(record.snapshot.volume24h, true)}</strong></div><div><small>Buy / sell count</small><strong>{record.snapshot.buyCount} / {record.snapshot.sellCount}</strong></div></div><small>{marketSources(record.snapshot).price} · {record.snapshot.source === "gmgn-paper" ? `receipt ${stamp(record.snapshot.observedAt)} · simulated` : `trade ${stamp(record.snapshot.marketAt)}`}</small><small>{marketSources(record.snapshot).metrics} · received {stamp(record.snapshot.metricsReceivedAt ?? record.snapshot.observedAt)}</small><GeckoAttribution snapshot={record.snapshot}/></> : <p>No market snapshot recorded.</p>}{record.snapshot?.entrySetup && <p>Entry location: market cap {record.snapshot.entrySetup.marketCapUsd == null ? "unknown" : dollars(record.snapshot.entrySetup.marketCapUsd, true)} · {record.snapshot.entrySetup.distanceFromLowPct == null ? "recent low unavailable" : `${record.snapshot.entrySetup.distanceFromLowPct.toFixed(1)}% above recent 30m low`}. {record.snapshot.entrySetup.competingTickers ?? "Unknown"} fresh same-ticker rivals in the feed. Observed range, not a confirmed bottom.</p>}<h3>JEV source assessments</h3>{record.judgment?.assessments?.length ? record.judgment.assessments.map(a => <AssessmentCard key={a.id} assessment={a} />) : <p>No source assessments were recorded.</p>}<small>These typed assessments are independent answers, not the model’s private reasoning. They do not establish that memory improved the trade.</small><MemoryEvidenceList record={record} memoryName={memoryName} onMemory={showMemory}/><h3>X citations</h3><XEvidence research={record.research} now={now} assessments={record.judgment?.assessments} /><h3>Execution checks</h3><div className="tt-check-list">{record.checks.map((c,i) => <div key={i}><Chip tone={c.pass ? "buy" : "neutral"}>{c.pass ? "Pass" : "Not met"}</Chip><span><strong>{c.label}</strong><p>{c.detail}</p></span></div>)}</div>{!record.checks.length && <p>No execution checks recorded.</p>}<small>Decision {record.id}{record.judgment ? ` · ${record.judgment.model} · request ${record.judgment.requestId}` : ""}</small></> : <p>Select a recorded decision to inspect its sources. New launches will enter assessment when they qualify.</p>}</>}
      </div>
    </dialog>
  </div>;
}
