import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TypeSafeLogo } from "./TypeSafeLogo.js";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  ExternalLink,
  FlaskConical,
  Info,
  Layers3,
  LockKeyhole,
  Maximize2,
  Pause,
  Play,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import type { Candle, TerminalState } from "./types.js";
import { Chart } from "./Chart.js";
import { MonitoringPanel, LaunchMonitoring } from "./MonitoringPanel.js";
import type { MonitorState } from "./monitoring.js";
import {
  AssessmentCard,
  executionLabel,
  ExecutionOutcome,
} from "./DecisionBreakdown.js";
import { XEvidence } from "./XEvidence.js";
import { AgentTape, PerformanceStrip } from "./TerminalSignals.js";
import { initialFocus } from "./terminal-insights.js";
import { HuntBoard } from "./HuntBoard.js";
import { PAPER_POLICY } from "./paper-settings.js";
import { PositionBook } from "./PositionBook.js";
import "./terminal-signals.css";
import {
  emptyArrivals,
  platforms,
  platformLabel,
  reconcileArrivals,
  selectLaunches,
  stageLabel,
  type Graduation,
  type Launch,
  type LaunchFeedState,
  type LaunchStage,
  type Platform,
} from "./launches.js";

const money = (n: number | null | undefined, compact = false) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : 2,
      }).format(n);
const price = (n: number | null | undefined) =>
  n == null || n === 0 ? "—" : n >= 1 ? money(n) : `$${n.toPrecision(5)}`;
const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
const time = (n: number) =>
  new Date(n).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
const age = (n: number | null, now: number) =>
  n == null
    ? "Age unknown"
    : now - n < 60000
      ? "<1m"
      : now - n < 3600000
        ? `${Math.floor((now - n) / 60000)}m`
        : now - n < 86400000
          ? `${Math.floor((now - n) / 3600000)}h ${Math.floor(((now - n) % 3600000) / 60000)}m`
          : `${Math.floor((now - n) / 86400000)}d`;
async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
function TokenAvatar({
  launch,
  large = false,
}: {
  launch: Launch;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`token-avatar ${large ? "large" : ""}`}>
      {launch.logo && !failed ? (
        <img
          src={launch.logo}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : (
        <Layers3 size={large ? 28 : 20} />
      )}
    </span>
  );
}
function Source({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      className="source-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={12} />
    </a>
  );
}
export function animateArrival(node: HTMLElement | null) {
  if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return;
  node.animate(
    [
      { transform: "translateX(-24px)", opacity: 0 },
      { transform: "translateX(3px)", opacity: 1, offset: 0.7 },
      { transform: "translateX(0)", opacity: 1 },
    ],
    { duration: 680, easing: "cubic-bezier(.22,1,.36,1)" },
  );
  node.animate(
    [
      { backgroundColor: "#ffdc65", boxShadow: "inset 4px 0 #e8ab00" },
      {
        backgroundColor: "#fff5cb",
        boxShadow: "inset 4px 0 #e8ab00",
        offset: 0.35,
      },
      { backgroundColor: "#fff9e5", boxShadow: "inset 3px 0 #efbc19" },
    ],
    { duration: 3800, easing: "ease-out" },
  );
}

export function EvidenceDesk({ onReplay = () => {} }: { onReplay?: () => void }) {
  const [state, setState] = useState<TerminalState | null>(null);
  const [feed, setFeed] = useState<LaunchFeedState | null>(null);
  const [monitor, setMonitor] = useState<MonitorState | null>(null);
  const [selected, setSelected] = useState("");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [stage, setStage] = useState<LaunchStage | "all">("graduated_reported");
  const [motion, setMotion] = useState(true);
  const [recordId, setRecordId] = useState("");
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(Date.now());
  const [arrivals, setArrivals] = useState(emptyArrivals);
  const arrivalsRef = useRef(emptyArrivals());
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const seenStages = useRef(new Map<string, LaunchStage>());
  const [announcement, setAnnouncement] = useState("");
  const [newCount, setNewCount] = useState(0);
  const [preview, setPreview] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<HTMLDivElement>(null);
  const selectedCache = useRef<Launch | null>(null);
  const [notice, setNotice] = useState("");
  const [disconnected, setDisconnected] = useState(false);
  const [verification, setVerification] = useState<Graduation | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [chartError, setChartError] = useState("");
  const [chartLoading, setChartLoading] = useState(false);
  const [interval, setIntervalValue] = useState<"1" | "5" | "15">("5");
  const [tab, setTab] = useState<"history" | "positions" | "fills">("history");
  const [decisionId, setDecisionId] = useState("");
  const [modal, setModal] = useState<
    "live" | "policy" | "sources" | "arm" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [chartExpanded, setChartExpanded] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const chartPanelRef = useRef<HTMLElement>(null);
  const historyRef = useRef<HTMLElement>(null);
  const radarRef = useRef<HTMLElement>(null);
  const tapeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let disposed = false,
      loading = false;
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try {
        const [nextState, nextFeed, nextMonitor] = await Promise.all([
          api<TerminalState>("/api/state"),
          api<LaunchFeedState>("/api/launches"),
          api<MonitorState>("/api/monitor"),
        ]);
        if (disposed) return;
        setDisconnected(false);
        setState(nextState);
        setFeed(nextFeed);
        setMonitor(nextMonitor);
        if (nextFeed.updatedAt !== null) {
          const next = reconcileArrivals(
            arrivalsRef.current,
            nextFeed.launches,
            Date.now(),
          );
          arrivalsRef.current = next;
          setArrivals(next);
          if (next.added.length) {
            setAnnouncement(
              `${next.added.length} new ${next.added.length === 1 ? "launch" : "launches"} detected. Selected token unchanged.`,
            );
            setNewCount((n) => n + next.added.length);
          }
        }
        setSelected(
          (current) => current || initialFocus(nextFeed.launches, nextMonitor.items, Date.now()),
        );
      } catch {
        if (!disposed) setDisconnected(true);
      } finally {
        loading = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 4000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.clearInterval(tick);
    };
  }, []);
  useEffect(() => {
    if (!motion) return;
    for (const id of arrivals.added)
      animateArrival(rowRefs.current.get(id) || null);
  }, [arrivals, motion]);
  useEffect(() => {
    if (!feed?.updatedAt) return;
    for (const l of feed.launches) {
      const previous = seenStages.current.get(l.address);
      if (previous && previous !== l.stage && l.stage === "graduated_reported") {
        if (motion) animateArrival(rowRefs.current.get(l.id) ?? null);
        setAnnouncement(`${l.symbol}: GMGN reports graduation. Eligible for screening; not permission to buy.`);
      }
      seenStages.current.set(l.address, l.stage);
    }
  }, [feed?.updatedAt, motion]);
  useEffect(() => {
    if (!preview || !motion) return;
    animateArrival(previewRef.current);
    const timer = window.setTimeout(() => setPreview(0), 8000);
    return () => window.clearTimeout(timer);
  }, [preview, motion]);
  useEffect(() => {
    if (!selected) return;
    let disposed = false;
    const controller = new AbortController();
    setVerification(null);
    setCandles([]);
    setChartError("");
    setChartLoading(true);
    const refresh = async () => {
      const [v, c] = await Promise.allSettled([
        api<Graduation>(
          `/api/launches/${selected}/verification`,
          undefined,
          controller.signal,
        ),
        api<{ candles: Candle[] }>(
          `/api/launches/${selected}/candles?interval=${interval}`,
          undefined,
          controller.signal,
        ),
      ]);
      if (disposed) return;
      if (v.status === "fulfilled") setVerification(v.value);
      else
        setVerification({
          token: selected,
          status: "unverified",
          checkedAt: Date.now(),
          detail: "Fresh GMGN graduation status unavailable. Awaiting provider data.",
        });
      if (c.status === "fulfilled") {
        setCandles(c.value.candles);
        setChartError("");
      } else {
        setCandles([]);
        setChartError(
          "GMGN chart unavailable. No sample prices are substituted.",
        );
      }
      setChartLoading(false);
    };
    void refresh();
    const timer = window.setInterval(() => {
      if (feed?.enabled) void refresh();
    }, 45000);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [selected, interval, feed?.enabled]);
  useEffect(() => {
    if (modal) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [modal]);
  useEffect(() => {
    if (!chartExpanded) return;
    const prior = document.activeElement as HTMLElement | null;
    const panel = chartPanelRef.current;
    panel?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setChartExpanded(false);
      }
      if (event.key === "Tab") {
        const controls = panel?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),a[href]",
        );
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      prior?.focus();
    };
  }, [chartExpanded]);

  const list = feed?.launches || [];
  const currentLaunch = list.find((l) => l.address === selected);
  if (currentLaunch) selectedCache.current = currentLaunch;
  const launch =
    currentLaunch ||
    (selectedCache.current?.address === selected
      ? selectedCache.current
      : undefined);
  const visible = useMemo(
    () => selectLaunches(list, platform, stage, query),
    [list, platform, stage, query],
  );
  const selectedDecisions = useMemo(
    () =>
      state?.decisions.filter(
        (d) =>
          d.snapshot?.token.toLowerCase() === selected ||
          d.pool === verification?.pool,
      ) || [],
    [state?.decisions, selected, verification?.pool],
  );
  const decision =
    selectedDecisions.find((d) => d.id === decisionId) || selectedDecisions[0];
  const judgment = decision?.judgment;
  const record = state?.decisions.find(d => d.id === recordId) ?? decision;
  const recordJudgment = record?.judgment;
  const verificationFresh =
    verification && now - verification.checkedAt < 90000;
  const verified = verification?.status === "gmgn_reported" && verificationFresh;
  const feedStale = !launch || now - launch.observedAt > 90000;
  const entryReason = !verified
    ? verification?.status === "bonding"
      ? "Still on the bonding curve. Observe only."
      : "Awaiting a fresh GMGN graduation report."
    : !verification?.pool
      ? "GMGN graduation accepted. Matching market data is not available yet."
    : feedStale
      ? "Market observations are stale. Await a fresh feed."
      : launch?.liquidityUsd == null
        ? "Liquidity evidence is missing."
        : launch.liquidityUsd < PAPER_POLICY.minLiquidityUsd
          ? `Liquidity ${money(launch.liquidityUsd, true)} < $20k entry floor. JEV can still scout.`
          : launch.riskFlags.length
            ? launch.riskFlags.join(" · ")
            : state?.running ? "Paper session armed. A fresh JEV BUY and all entry checks are required." : "Paper session paused. Arm paper trading to allow qualified entries.";
  const monitorItem = monitor?.items.find((i) => i.token === selected);
  const nextTrigger = monitorItem?.admission.checks.find(c => !c.pass);
  const feedFresh = !!feed?.updatedAt && now - feed.updatedAt <= 90_000;
  const events = feed?.events.slice(0, 5) || [];
  async function act(path: string, body: unknown, message: string) {
    setBusy(true);
    setNotice("");
    try {
      await api(path, body);
      setState(await api<TerminalState>("/api/state"));
      setFeed(await api<LaunchFeedState>("/api/launches"));
      setMonitor(await api<MonitorState>("/api/monitor"));
      setNotice(message);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Operation unavailable");
    } finally {
      setBusy(false);
    }
  }
  function showLatest() {
    setQuery("");
    setPlatform("all");
    setStage("all");
    setNewCount(0);
    queueRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }
  function openHistory(next: "history" | "positions" | "fills") {
    setTab(next);
    historyRef.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
  }
  const gmgnUrl = launch ? `https://gmgn.ai/bsc/token/${launch.address}` : "";
  return (
    <div className={`evidence-app ${motion ? "" : "motion-off"}`}>
      <nav className="desk-rail" aria-label="Terminal navigation">
        <a className="brand-mark" href="#desk" aria-label="JEV evidence desk">
          <TypeSafeLogo size={28} />
        </a>
        <button
          className="rail-item active"
          title="Evidence desk"
          aria-label="Evidence desk"
          onClick={() => window.scrollTo({ top: 0 })}
        >
          <Layers3 />
        </button>
        <button
          className="rail-item"
          title="Paper positions"
          aria-label="Paper positions"
          onClick={() => openHistory("positions")}
        >
          <BarChart3 />
        </button>
        <button
          className="rail-item"
          title="Execution policy"
          aria-label="Execution policy"
          onClick={() => setModal("policy")}
        >
          <ShieldCheck />
        </button>
        <div className="rail-bottom">
          <button
            className="rail-item"
            aria-label="About this build"
            onClick={() => setModal("policy")}
          >
            <CircleHelp />
          </button>
          <span className="operator-avatar" title="Single operator">
            Y
          </span>
        </div>
      </nav>
      <div className="desk-shell" id="desk">
        <header className="desk-header">
          <a className="wordmark" href="#desk">
            <TypeSafeLogo size={26} /> JEV<span>.</span>
          </a>
          <span className="header-divider" />
          <h1>Launch terminal</h1>
          <span className="phase-tag">PHASE 01</span>
          <div className="header-status">
            <span className="chain-label">
              <span className="chain-diamond">◆</span> BNB Smart Chain
            </span>
            <span className="observation-state">
              <i
                className={`dot ${feed?.enabled && feedFresh && !disconnected ? "green" : ""}`}
              />
              {disconnected
                ? "Disconnected"
                : !feed ? "Connecting"
                : feed.enabled && !feedFresh ? "Feed stale"
                : feed?.enabled
                  ? "Observing"
                  : "Observation paused"}{" "}
              <span>· {state?.running ? "Paper armed" : "Paper paused"}</span>
            </span>
            <span className="header-clock">
              {new Date(now).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}{" "}
              {time(now)}
            </span>
            <span className="single-operator">Single operator</span>
          </div>
        </header>
        <section
          className="workflow-bar"
          aria-label="Launch lifecycle and observation controls"
        >
          <div className="workflow-copy">
            <div className="workflow-steps">
              <span className="step current">
                <Radio size={17} />
                Launch
              </span>
              <ArrowRight />
              <span className="step">Bonding</span>
              <ArrowRight />
              <span className="step">GMGN graduation</span>
              <ArrowRight />
              <span className="step">Entry assessment</span>
              <span className="no-buy">
                <ShieldCheck size={12} />
                No buys before graduation.
              </span>
            </div>
            <p>
              Flap + Four.meme. Find the launch. Read the evidence. Watch JEV make the call.
            </p>
          </div>
          <div className="workflow-controls">
            <div className="mode-switch">
              <span>
                <FlaskConical size={16} />
                Paper mode
              </span>
              <button onClick={() => setModal("live")}>
                <LockKeyhole size={14} />
                Live (locked)
              </button>
            </div>
            <button
              className="yellow-button"
              disabled={busy || !state}
              onClick={() =>
                state?.running ? void act("/api/control",{action:"pause"},"Paper session paused: entries and exits stopped; monitoring continues.")
                : state?.halted ? void act("/api/control",{action:"reset_stop"},"Stop reset. Paper session remains paused.")
                : setModal("arm")
              }
            >
              {state?.running ? <Pause size={16} /> : <Play size={16} />}
              <span>
                {state?.running ? "Pause paper" : state?.halted ? "Reset stop" : "Arm paper trading"}
              </span>
            </button>
            {state?.running && <button className="paper-stop" disabled={busy} onClick={()=>void act("/api/control",{action:"stop"},"Paper kill switch latched. No new entries or exits.")}>Stop all</button>}
            <button disabled={busy||!feed} onClick={()=>void act("/api/launches/control",{enabled:!feed?.enabled},feed?.enabled?"Feed and paper session paused.":"Observation resumed; arm paper separately.")}>{feed?.enabled?"Pause feed":"Resume feed"}</button>
          </div>
        </section>
        <PerformanceStrip state={state} launches={list} now={now} onPositions={() => openHistory("positions")} />
        <HuntBoard launches={list} monitor={monitor} state={state} now={now} motion={motion} onSelect={token=>{setSelected(token);setDecisionId("");chartPanelRef.current?.scrollIntoView({block:"start"});}}/>
        <nav className="desk-jumps" aria-label="Jump to terminal section"><button onClick={()=>chartPanelRef.current?.scrollIntoView({block:"start"})}>Chart</button><button onClick={()=>radarRef.current?.scrollIntoView({block:"start"})}>Launch radar</button><button onClick={()=>tapeRef.current?.scrollIntoView({block:"start"})}>Agent tape</button><button onClick={onReplay}>JEV replay</button></nav>
        {(notice || disconnected || !!feed?.errors.length || state?.exitError) && (
          <div className="desk-notice" role="status">
            <Info size={16} />
            <span>
              {disconnected
                ? "Backend disconnected. All displayed data is last observed."
                : notice || state?.exitError || feed?.errors.join(" ")}
            </span>
            {notice && (
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}
        <main className="desk-grid">
          <aside className="attention-column" ref={radarRef}>
            <section className="queue-panel panel">
              <div className="section-heading">
                <h2>
                  Launch radar{" "}
                  <span className="count">{visible.length}</span>
                </h2>
                <span className="feed-label">
                  <i
                    className={`dot ${feed?.enabled && feedFresh && !disconnected ? "green" : ""}`}
                  />
                  GMGN
                </span>
              </div>
              <div className="queue-filters">
                <div className="segmented" aria-label="Launchpad filter">
                  {(["all", ...platforms] as const).map((p) => (
                    <button
                      key={p}
                      aria-pressed={platform === p}
                      className={platform === p ? "selected" : ""}
                      onClick={() => setPlatform(p)}
                    >
                      {p === "all" ? "All" : platformLabel(p)}
                    </button>
                  ))}
                </div>
                <select
                  aria-label="Launch stage"
                  value={stage}
                  onChange={(e) =>
                    setStage(e.target.value as LaunchStage | "all")
                  }
                >
                  <option value="all">All stages</option>
                  <option value="new">New launches</option>
                  <option value="bonding">Bonding</option>
                  <option value="graduated_reported">
                    Graduates · reported
                  </option>
                </select>
              </div>
              <label className="queue-search">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search token or contract…"
                  aria-label="Search token or contract"
                />
                {query && (
                  <button
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <div className="arrival-tools">
                <button
                  className={newCount ? "new-count" : ""}
                  onClick={showLatest}
                >
                  {newCount ? (
                    <>
                      <Zap size={12} />
                      {newCount} new · Show latest
                    </>
                  ) : (
                    <>
                      <Clock3 size={12} />
                      Latest arrivals
                    </>
                  )}
                </button>
                <button
                  disabled={!motion}
                  onClick={() => {
                    setPreview(Date.now());
                    setAnnouncement(
                      "Arrival animation preview. This is not a real launch.",
                    );
                    queueRef.current?.scrollTo({ top: 0 });
                  }}
                >
                  <Sparkles size={12} />
                  Preview arrival
                </button>
              </div>
              <div className="radar-legend"><span>MC · Liquidity · Holders</span><button aria-pressed={!motion} onClick={()=>setMotion(!motion)}>{motion ? "Motion on" : "Motion off"}</button></div>
              <div className="queue-scroll" ref={queueRef}>
                {preview > 0 && (
                  <div
                    key={preview}
                    className="preview-launch new-row"
                    ref={previewRef}
                  >
                    <span className="preview-icon">
                      <Sparkles size={20} />
                    </span>
                    <div>
                      <strong>
                        New launch arrives{" "}
                        <span className="new-badge">NEW</span>
                      </strong>
                      <small>Animation preview · not market data</small>
                    </div>
                    <button
                      aria-label="Dismiss arrival preview"
                      onClick={() => setPreview(0)}
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
                {!feed?.updatedAt ? (
                  <div className="empty-state compact-empty">
                    <Radio />
                    <strong>
                      {feed?.errors.length
                        ? "Launch feed unavailable"
                        : "Connecting to launch feed"}
                    </strong>
                    <p>
                      {feed?.errors.length
                        ? "GMGN discovery is temporarily unavailable."
                        : "Querying Flap and Four.meme on BSC."}
                    </p>
                  </div>
                ) : !visible.length ? (
                  <div className="empty-state compact-empty">
                    <Search />
                    <strong>No matching launches</strong>
                    <p>Try another stage, launchpad or contract.</p>
                    <button onClick={showLatest}>Clear filters</button>
                  </div>
                ) : (
                  visible.map((l) => {
                    const fresh = (arrivals.highlighted[l.id] || 0) > now;
                    const isVerified = l.stage === "graduated_reported" && now - l.observedAt <= 90000;
                    return (
                      <button
                        key={l.id}
                        ref={(node) => {
                          if (node) rowRefs.current.set(l.id, node);
                          else rowRefs.current.delete(l.id);
                        }}
                        className={`launch-row ${l.address === selected ? "selected" : ""} ${fresh ? "new-row" : ""}`}
                        aria-pressed={l.address === selected}
                        onClick={() => {
                          setSelected(l.address);
                          setDecisionId("");
                        }}
                      >
                        <TokenAvatar launch={l} />
                        <span className="launch-identity">
                          <strong title={l.symbol}>
                            {l.symbol || "Unnamed"}{" "}
                            {fresh && <span className="new-badge">NEW</span>}
                          </strong>
                          <small>
                            {platformLabel(l.platform)}
                            <span>{age(l.createdAt, now)}</span>
                          </small>
                        </span>
                        <span className="launch-stage">
                          <b>
                            <i
                              className={`dot ${isVerified ? "green" : l.stage === "bonding" ? "blue" : ""}`}
                            />
                            {isVerified
                              ? "Graduated · GMGN"
                              : l.stage === "graduated_reported"
                                ? "Graduated · stale"
                                : stageLabel(l.stage)}
                          </b>
                          <small>
                            {l.riskFlags.length
                              ? "Risk flags present"
                              : now - l.observedAt > 90000
                                ? "Observation stale"
                                : l.stage === "graduated_reported"
                                  ? "GMGN stage accepted"
                                  : "Observation only"}
                          </small>
                        </span>
                        <span className="launch-market"><span><small>MC</small>{money(l.marketCapUsd, true)}</span><span><small>LIQ</small>{money(l.liquidityUsd, true)}</span><span><small>HOLDERS</small>{l.holders?.toLocaleString() ?? "—"}</span></span>
                        <ChevronRight size={15} />
                      </button>
                    );
                  })
                )}
              </div>
              <div className="queue-footer">
                {feed?.updatedAt
                  ? `Last poll ${time(feed.updatedAt)} · 30s cadence`
                  : "Read-only discovery"}
                <span>Not an exhaustive launch feed</span>
              </div>
            </section>
            <section className="observations-panel panel">
              <div className="section-heading">
                <h2>Recent observations</h2>
                <span className="muted">This session</span>
              </div>
              <div className="observation-list">
                {events.length ? (
                  events.map((e) => (
                    <button
                      className="observation"
                      key={e.id}
                      onClick={() => {
                        setSelected(e.token);
                        setDecisionId("");
                      }}
                    >
                      <i />
                      <time>{time(e.time)}</time>
                      <span>
                        <strong>{e.symbol}</strong>
                        <b>{e.detail}</b>
                        <small>GMGN discovery</small>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="observation quiet">
                    <i />
                    <time>{feed?.updatedAt ? time(feed.updatedAt) : "—"}</time>
                    <span>
                      <strong>
                        {feed?.updatedAt
                          ? "Observation started"
                          : "Awaiting discovery"}
                      </strong>
                      <b>
                        {feed?.updatedAt
                          ? `${list.length} launches in the initial snapshot`
                          : "Connecting to launchpads"}
                      </b>
                      <small>
                        New arrivals and lifecycle changes will appear here.
                      </small>
                    </span>
                  </div>
                )}
              </div>
              <div className="observation-note">
                <Info size={16} />
                <span>
                  Monitoring Flap and Four.meme only.
                  <small>
                    No buys before GMGN reports graduation. Real trading is locked.
                  </small>
                </span>
              </div>
            </section>
          </aside>
          <div className="evidence-column">
            {!launch ? (
              <section className="panel waiting-panel">
                <Radio size={30} />
                <h2>Your launch evidence desk</h2>
                <p>
                  Select a token once discovery connects. Prices, migration
                  checks and model assessments appear here—never fabricated
                  sample data.
                </p>
              </section>
            ) : (
              <>
                <section className="selected-panel panel">
                  <div className="token-heading">
                    <TokenAvatar key={launch.address} launch={launch} large />
                    <div className="selected-identity">
                      <h2>
                        {launch.symbol || "Unnamed token"} <span>/ BSC</span>
                        <Source href={gmgnUrl}>
                          <span className="sr-only">Open token on GMGN</span>
                        </Source>
                      </h2>
                      <div className="token-meta">
                        <button
                          className="contract-copy"
                          title="Copy contract"
                          aria-label="Copy token contract"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(launch.address)
                              .then(() => setNotice("Contract address copied."))
                              .catch(() =>
                                setNotice(
                                  "Clipboard unavailable. The contract is available through the explorer link.",
                                ),
                              )
                          }
                        >
                          {short(launch.address)}
                          <Copy size={11} />
                        </button>
                        <span className="platform-tag">
                          {platformLabel(launch.platform)}
                        </span>
                        <span
                          className={`migration-tag ${verified ? "verified" : ""}`}
                        >
                          {verified
                            ? "Graduated · GMGN"
                            : verification?.status === "bonding"
                              ? "Bonding · observation only"
                              : verification
                                ? "Awaiting GMGN report"
                                : "Reading GMGN status…"}
                        </span>
                      </div>
                    </div>
                    <div className="token-price">
                      <strong>{price(launch.priceUsd)}</strong>
                      <small>
                        {feedStale
                          ? "STALE OBSERVATION"
                          : "GMGN observed price"}
                      </small>
                    </div>
                    <div className="liquidity-stat">
                      <small>Liquidity · GMGN</small>
                      <strong>{money(launch.liquidityUsd, true)}</strong>
                    </div>
                  </div>
                  <div className="decision-band">
                    <div className="model-result">
                      <span className="result-icon">
                        <Pause size={23} />
                      </span>
                      <div>
                        <h3>
                          JEV + memory:{" "}
                          <b>
                            {judgment
                              ? judgment.action.toUpperCase()
                              : monitorItem?.status === "assessing" ? "ASSESSING" : monitorItem?.status === "error" ? "UNAVAILABLE" : "WATCHING"}
                          </b>
                        </h3>
                        <p>
                          {judgment
                            ? `Recorded ${time(decision!.time)} · confidence ${(judgment.confidence * 100).toFixed(0)}%`
                            : nextTrigger ? `Not called · waiting for ${nextTrigger.label}. ${nextTrigger.detail}` : (monitorItem?.detail ??
                              "Waiting for automatic screening and a fresh GMGN graduation report.")}
                        </p>
                      </div>
                    </div>
                    <div className="policy-result">
                      <span className="result-icon">
                        <LockKeyhole size={23} />
                      </span>
                      <div>
                        <h3>
                          Paper execution: <b>{decision?.status==="executed"?"FILL RECORDED":state?.running?"ARMED":"PAUSED"}</b>
                        </h3>
                        <p>{entryReason}</p>
                      </div>
                    </div>
                  </div>
                  <div className="selected-market-strip"><span>Market cap <b>{money(launch.marketCapUsd,true)}</b></span><span>24h volume <b>{money(launch.volume24h,true)}</b></span><span>Holders <b>{launch.holders?.toLocaleString() ?? "—"}</b></span><span>Top 10 <b>{launch.top10 == null ? "—" : `${(launch.top10*100).toFixed(1)}%`}</b></span></div>
                <section
                  ref={chartPanelRef}
                  role={chartExpanded ? "dialog" : "region"}
                  aria-modal={chartExpanded || undefined}
                  className={`chart-panel panel ${chartExpanded ? "expanded" : ""}`}
                  aria-label="Token chart"
                >
                  <div className="chart-toolbar">
                    <div className="chart-options">
                      {(["1", "5", "15"] as const).map((i) => (
                        <button
                          className={interval === i ? "active" : ""}
                          key={i}
                          aria-pressed={interval === i}
                          onClick={() => setIntervalValue(i)}
                        >
                          {i}m
                        </button>
                      ))}
                      <span className="toolbar-divider" />
                      <BarChart3 size={15} />
                      <span>Candles</span>
                    </div>
                    <div className="chart-options">
                      <span className="chart-source">
                        Price (USD) · UTC · GMGN
                      </span>
                      <button
                        aria-label={
                          chartExpanded ? "Restore chart size" : "Expand chart"
                        }
                        onClick={() => setChartExpanded(!chartExpanded)}
                      >
                        {chartExpanded ? (
                          <X size={16} />
                        ) : (
                          <Maximize2 size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="chart-area">
                    {chartLoading ? (
                      <div className="chart-empty">
                        <Activity />
                        <strong>Loading token candles…</strong>
                      </div>
                    ) : chartError || !candles.length ? (
                      <div className="chart-empty">
                        <BarChart3 />
                        <strong>
                          {chartError
                            ? "Chart unavailable"
                            : "No candles returned yet"}
                        </strong>
                        <p>
                          {chartError ||
                            "This launch may not have traded yet. Observation continues."}
                        </p>
                      </div>
                    ) : (
                      <Chart
                        position={state?.ledger.positions.find(p=>p.token.toLowerCase()===selected)}
                        candles={candles}
                        decisions={selectedDecisions}
                        interval={Number(interval)}
                        milestone={
                          launch.reportedGraduatedAt
                            ? {
                                time: launch.reportedGraduatedAt,
                                label: "Graduated",
                              }
                            : undefined
                        }
                      />
                    )}
                  </div>
                  <div className="chart-caption">
                    <span>
                      <i className="dot amber" />
                      Markers label recorded agent actions · no synthetic
                      signals
                    </span>
                    <span>Token-wide chart; not an execution quote</span>
                  </div>
                </section>
                  <details className="evidence-details"><summary><BrainCircuit size={16}/> Evidence, memory & monitoring checks</summary>
                  <LaunchMonitoring item={monitorItem} now={now} />
                  <div className="evidence-title">
                    <h2>
                      {judgment
                        ? "Evidence & decision context"
                        : "Evidence being collected"}
                    </h2>
                    <span className="auto-status">
                      <Activity size={13} />
                      {monitorItem?.status === "assessing"
                        ? "Assessing automatically…"
                        : "Automatic watch"}
                    </span>
                  </div>
                  <div className="evidence-split">
                    <div className="current-evidence">
                      <h3>
                        <BrainCircuit size={17} />
                        <span>
                          This launch <small>(current evidence)</small>
                        </span>
                      </h3>
                      <div className="evidence-row">
                        <span className="evidence-icon">
                          <BarChart3 />
                        </span>
                        <div>
                          <strong>
                            {launch.liquidityUsd == null
                              ? "Liquidity unavailable"
                              : launch.liquidityUsd < 50000
                                ? "Liquidity below entry threshold"
                                : "Market snapshot collected"}
                          </strong>
                          <small>
                            GMGN · {time(launch.observedAt)}{" "}
                            {feedStale ? "· STALE" : ""}
                          </small>
                          <p>
                            {money(launch.volume24h, true)} volume / 24h ·{" "}
                            {launch.holders ?? "—"} holders
                            {launch.top10 !== null
                              ? ` · top 10 ${(launch.top10 * 100).toFixed(1)}%`
                              : ""}
                          </p>
                        </div>
                        <Source href={gmgnUrl}>View source</Source>
                      </div>
                      <div className="evidence-row">
                        <span className="evidence-icon">
                          <ShieldCheck />
                        </span>
                        <div>
                          <strong>
                            {verified
                              ? "Graduated · GMGN"
                              : verification?.status === "bonding"
                                ? "Bonding curve active"
                                : "Awaiting fresh GMGN report"}
                          </strong>
                          <small>
                            GMGN ·{" "}
                            {verification
                              ? time(verification.checkedAt)
                              : "Checking…"}
                          </small>
                          <p>
                            {verified
                              ? verification?.detail
                              : verification?.status === "bonding"
                                ? "Continue observing. No pre-graduation entry."
                                : "GMGN graduation is required before assessment."}
                          </p>
                        </div>
                        <Source
                          href={
                            gmgnUrl
                          }
                        >
                          View GMGN
                        </Source>
                      </div>
                      <div className="evidence-row">
                        <span className="evidence-icon social-icon">𝕏</span>
                        <div>
                          <strong>
                            {decision?.research?.status === "ready"
                              ? `${decision.research.sources.length} cited X sources`
                              : decision?.research?.status === "no_results"
                                ? "No matching X sources"
                                : "Social context not assessed"}
                          </strong>
                          <small>
                            {decision?.research
                              ? `Grok / X · ${time(decision.research.collectedAt)}`
                              : "Collected when an assessment runs"}
                          </small>
                          <p>
                            {decision?.research
                              ? "Open the evidence record for citations and excerpts."
                              : "Token social links are not verified source evidence."}
                          </p>
                        </div>
                        <button
                          className="source-link"
                          onClick={() => {setRecordId("");setModal("sources");}}
                        >
                          View record
                          <ArrowUpRight size={12} />
                        </button>
                      </div>
                      {!!launch.riskFlags.length && (
                        <p className="risk-notice">
                          {launch.riskFlags.join(" · ")}. No safety clearance
                          inferred.
                        </p>
                      )}
                    </div>
                    <div className="memory-evidence">
                      <h3>
                        <BrainCircuit size={17} />
                        <span>Living Brain: comparable experience</span>
                      </h3>
                      {decision?.memories.length ? (
                        <>
                          <div className="memory-record">
                            <span>
                              <Layers3 size={15} />
                              Retrieved record
                            </span>
                            <strong>{decision.memories[0].title}</strong>
                            <p>{decision.memories[0].summary}</p>
                          </div>
                          {judgment?.assessments
                            ?.filter((a) => a.kind === "memory")
                            .slice(0, 1)
                            .map((a) => (
                              <AssessmentCard key={a.id} assessment={a} />
                            ))}
                          <button
                            className="source-link"
                            onClick={() => {setRecordId("");setModal("sources");}}
                          >
                            Open memory record
                            <ArrowRight size={13} />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="memory-record empty-memory">
                            <span>
                              <Layers3 size={15} />
                              {decision
                                ? "Memory retrieval status"
                                : "Memory context pending"}
                            </span>
                            <strong>
                              {decision?.memoryStatus.includes("cold start")
                                ? "No relevant memories found"
                                : "No memory supplied to JEV yet"}
                            </strong>
                            <p>
                              {decision?.memoryStatus ||
                                "After graduation, retrieve prior context and show exactly what was supplied to the model."}
                            </p>
                          </div>
                          <p className="memory-explanation">
                            <b>Why memory matters</b>Compare the current
                            evidence with prior observations and outcomes,
                            instead of judging a launch in isolation.
                          </p>
                        </>
                      )}
                      <small className="memory-caveat">
                        Context, not a guaranteed outcome. No invented
                        precedents on a cold start.
                      </small>
                    </div>
                  </div>
                  </details>
                </section>
              </>
            )}
            <section className="history-panel panel" ref={historyRef}>
              <div
                className="history-tabs"
                role="tablist"
                aria-label="Ledger views"
              >
                {(
                  [
                    ["history", "Decision history"],
                    ["positions", "Positions"],
                    ["fills", "Paper fills"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    role="tab"
                    aria-selected={tab === id}
                    className={tab === id ? "active" : ""}
                    key={id}
                    onClick={() => setTab(id)}
                  >
                    {label}
                    {id === "positions" && !!state?.ledger.positions.length && (
                      <span className="count">
                        {state.ledger.positions.length}
                      </span>
                    )}
                  </button>
                ))}
                <span className="history-note">
                  {tab === "history"
                    ? "Selected token"
                    : "All stored paper activity"}
                </span>
              </div>
              <div className="history-content" role="tabpanel">
                {tab === "history" ? (
                  selectedDecisions.length ? (
                    <table>
                      <thead>
                        <tr>
                          <th>TIME</th>
                          <th>EVENT</th>
                          <th>DETAILS</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDecisions.slice(0, 5).map((d) => (
                          <tr
                            key={d.id}
                            className={decision?.id === d.id ? "selected" : ""}
                          >
                            <td>{time(d.time)}</td>
                            <td>
                              <span className="history-event">
                                <i className="dot amber" />
                                {d.ruleExit ? "CODE: "+d.ruleExit.replaceAll("-"," ").toUpperCase() : d.judgment
                                  ? `JEV: ${d.judgment.action.toUpperCase()}`
                                  : "Not evaluated"}
                              </span>
                            </td>
                            <td>
                              {executionLabel(d)} · {d.reasons[0]}
                            </td>
                            <td>
                              <button
                                className="source-link"
                                aria-label={`View decision at ${time(d.time)}`}
                                onClick={() => {
                                  setDecisionId(d.id);
                                  setRecordId(d.id);
                                  setModal("sources");
                                }}
                              >
                                View
                                <ArrowRight size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="history-empty">
                      <Activity size={22} />
                      <div>
                        <strong>No JEV decision for this launch yet.</strong>
                        <p>
                          {monitorItem?.detail ??
                            "No manual step needed. JEV assesses automatically after the attention gate, GMGN graduation and matching market data are available."}
                        </p>
                      </div>
                    </div>
                  )
                ) : tab === "positions" ? (
                  state?.ledger.positions.length ? (
                    <PositionBook positions={state.ledger.positions} launches={list} now={now} running={state.running} onSelect={token=>{setSelected(token);setDecisionId("");chartPanelRef.current?.scrollIntoView({block:"start"});}}/>
                  ) : (
                    <div className="history-empty">
                      <Layers3 size={22} />
                      <div>
                        <strong>No open paper positions.</strong>
                        <p>
                          Six slots for qualified launches. Arm the paper session to let JEV enter; live money stays locked.
                        </p>
                      </div>
                    </div>
                  )
                ) : state?.ledger.fills.length ? (
                  <table>
                    <thead>
                      <tr>
                        <th>TIME</th>
                        <th>TOKEN</th>
                        <th>SIDE</th>
                        <th>PRICE</th>
                        <th>FEE</th>
                        <th>REALIZED P&amp;L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.ledger.fills.slice(0, 20).map((f) => (
                        <tr key={f.id}>
                          <td>{time(f.time)}</td>
                          <td>{f.name}</td>
                          <td>{f.side.toUpperCase()}</td>
                          <td>{price(f.priceUsd)}</td>
                          <td>{money(f.feeUsd)}</td>
                          <td>{f.side === "sell" ? money(f.realizedPnlUsd) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="history-empty">
                    <FlaskConical size={22} />
                    <div>
                      <strong>No simulated fills recorded.</strong>
                      <p>
                        Paper balance {money(state?.ledger.cashUsd)} · live
                        trading remains locked.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
          <aside className="agent-column" ref={tapeRef}>
            <AgentTape state={state} monitor={monitor} motion={motion} disconnected={disconnected} onReplay={onReplay} onRecord={(id)=>{setRecordId(id);setModal("sources");}} />
            <MonitoringPanel state={monitor} feedEnabled={!!feed?.enabled && !disconnected} halted={!!state?.halted} busy={busy} onToggle={()=>void act("/api/monitor/control",{enabled:!monitor?.enabled},monitor?.enabled ? "JEV monitoring and paper execution paused." : "JEV monitoring resumed. Arm paper execution separately.")} onSelect={(token)=>{setSelected(token);setDecisionId("");}} />
          </aside>
        </main>
        <footer className="desk-footer">
          <span>
            <LockKeyhole size={14} />
            BNB Agent SDK {state?.sdk.version || "0.6.0"}
            <i />
            Read-only discovery
            <i />
            Paper ledger preserved
            <i />
            Live locked
          </span>
          <span>
            <b>JEV + Living Brain</b>
            <i />
            Evidence desk on BNB Smart Chain
          </span>
        </footer>
      </div>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
      <dialog
        className="desk-dialog"
        aria-label={
          modal === "arm" ? "Arm paper trading" : modal === "sources"
            ? "Decision source record"
            : modal === "policy"
              ? "Execution policy"
              : "Live execution requirements"
        }
        ref={dialogRef}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal(null);
        }}
      >
        <div className="dialog-content">
          <button
            className="dialog-close"
            aria-label="Close dialog"
            onClick={() => setModal(null)}
          >
            <X size={20} />
          </button>
          {modal === "arm" ? (
            <>
              <FlaskConical className="dialog-icon"/><span className="eyebrow">SIMULATION ONLY · NO WALLET TRANSACTIONS</span>
              <h2>Let JEV hunt. Keep the sizing in code.</h2>
              <p>Autonomously simulate entries in freshly qualified Flap and Four.meme graduates. $50 starters, six slots, up to $150 per token and $600 total entry cost including fees.</p>
              <p>At +50% modeled net return, sell half; at +100%, sell half the remainder. Trail the rest by 25% from the observed peak after the first trim. A −25% stop or JEV SELL exits the remainder.</p>
              <p>Prices are sampled, not executable quotes. Tax, gas, MEV and API charges are not modeled. Stops can fill beyond their trigger. Pause stops both entries and exits; restart always boots paused.</p>
              <button className="yellow-button" disabled={busy||!monitor?.enabled||!feed?.enabled||!!state?.halted} onClick={()=>{setModal(null);void act("/api/control",{action:"start"},"Autonomous PAPER session armed. No real transactions.");}}>Start autonomous paper session</button>
              {(!monitor?.enabled||!feed?.enabled)&&<p>Resume observation and JEV monitoring before arming.</p>}
            </>
          ) : modal === "live" ? (
            <>
              <LockKeyhole className="dialog-icon" />
              <span className="eyebrow">EXECUTION BOUNDARY</span>
              <h2>Live trading is locked.</h2>
              <p>
                The terminal supports autonomous paper sessions only. Neither an arrival, graduation nor a JEV output authorizes a real transaction.
              </p>
              <ul>
                {state?.liveBlockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <button className="yellow-button" onClick={() => setModal(null)}>
                Continue observing
              </button>
            </>
          ) : modal === "policy" ? (
            <>
              <ShieldCheck className="dialog-icon" />
              <span className="eyebrow">CODE OWNS THE LIMITS</span>
              <h2>Scout early. Enter small. Manage the runner.</h2>
              <p>
                Flap and Four.meme on BSC only. We trust fresh GMGN graduation
                reports; no independent on-chain migration check. A matching
                supported market pool is still needed for price data. Graduation
                is not a safety verdict or permission to buy.
              </p>
              <div className="policy-grid">
                {[
                  ["Pre-graduation entry", "Never"],
                  ["Token scan", "Not used"],
                  ["Starting paper capital", money(state?.ledger.initialCashUsd ?? 2000)],
                  ["Scout / entry liquidity", "$10k / $20k"],
                  ["Starter / token budget", "$50 / $150 incl. fees"],
                  ["Maximum positions", "6"],
                  ["Total entry-cost budget", "$600 / 30% of starting capital"],
                  ["Take profit", "+50%: half · +100%: half again"],
                  ["Runner / stop trigger", "25% trail / −25% net return"],
                  ["Add to position", "Fresh BUY +10% net · 2m cooldown"],
                  ["Daily realized loss entry-stop", "$200 gross losses / UTC day"],
                  ["Modeled fee / adverse slippage", "0.30% / 0.50%"],
                  ["Token taxes / gas", "Not modeled"],
                  ["Live signer", "Not armed"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <p>
                Other existing entry gates remain: fresh Bitquery market data,
                cited matching X evidence, Living Brain
                availability and JEV thresholds. These simulation defaults are
                not approved live-trading limits.
              </p>
              <p>
                Paper execution requires explicit arming and always restarts paused. Rule exits check fresh prices independently of X, JEV and memory availability; the checks run every 15 seconds, subject to provider latency. Entry-only filters do not block sells. Existing positions and fills are retained.
                Paper P&amp;L excludes gas and research/model API charges. Marks are indicative prices, not guaranteed exit quotes.
              </p>
            </>
          ) : (
            <>
              <BrainCircuit className="dialog-icon" />
              <span className="eyebrow">SOURCE RECORD</span>
              <h2>{record?.name || launch?.symbol || "Launch"} · decision evidence</h2>
              <p>
                Recorded inputs and typed model outputs—not a reconstruction of
                the model’s private reasoning.
              </p>
              {verification && (!recordId || record?.snapshot?.token.toLowerCase() === selected) && (
                <section className="record-section">
                  <h3>Graduation check · {time(verification.checkedAt)}</h3>
                  <p>{verification.detail}</p><small>This is the current verification, not a historical attestation for this decision.</small>
                  {verification.block && (
                    <Source
                      href={`https://bscscan.com/block/${verification.block}`}
                    >
                      Open checked block {verification.block}
                    </Source>
                  )}
                </section>
              )}
              {record?.snapshot && (
                <section className="record-section" id="evidence-market">
                  <h3>Market input supplied to JEV</h3>
                  <p>
                    Recorded {time(record.snapshot.marketAt)} ·{" "}
                    {record.snapshot.source}
                  </p>
                  <div className="policy-grid">
                    <div>
                      <span>Price</span>
                      <strong>{price(record.snapshot.priceUsd)}</strong>
                    </div>
                    <div>
                      <span>Liquidity</span>
                      <strong>{money(record.snapshot.liquidityUsd)}</strong>
                    </div>
                    <div>
                      <span>24h volume</span>
                      <strong>{money(record.snapshot.volume24h)}</strong>
                    </div>
                    <div>
                      <span>Buy / sell count</span>
                      <strong>
                        {record.snapshot.buyCount} /{" "}
                        {record.snapshot.sellCount}
                      </strong>
                    </div>
                  </div>
                  <p>
                    These are the immutable inputs recorded for this record.
                    The main desk also displays newer observations, which did
                    not inform this earlier output.
                  </p>
                </section>
              )}
              <section className="record-section">
                <h3>JEV assessments</h3>
                {recordJudgment && <p><b>{recordJudgment.action.toUpperCase()}</b> · {(recordJudgment.confidence * 100).toFixed(0)}% model confidence · {recordJudgment.quality.toFixed(1)}/3 quality<br/><small>{recordJudgment.model} · {new Date(record!.time).toLocaleString()}<br/>Request {recordJudgment.requestId}</small></p>}
                {recordJudgment?.assessments
                  ?.filter((a) => a.kind === "context")
                  .map((a) => (
                    <AssessmentCard key={a.id} assessment={a} />
                  ))}
                {!recordJudgment && (
                  <p>
                    JEV has not returned a decision for this launch. No model
                    rationale is fabricated.
                  </p>
                )}
              </section>
              <section className="record-section">
                <h3>X evidence</h3>
                <XEvidence
                  research={record?.research}
                  now={now}
                  assessments={recordJudgment?.assessments}
                />
              </section>
              <section className="record-section">
                <h3>Living Brain records</h3>
                {record?.memories.length ? (
                  record.memories.map((m, i) => (
                    <article key={m.pageId} id={`evidence-M${i + 1}`}>
                      <strong>{m.title}</strong>
                      <p>{m.summary}</p>
                      <small>
                        Page {m.pageId} · {m.status}
                      </small>
                    </article>
                  ))
                ) : (
                  <p>
                    {record?.memoryStatus ||
                      "No retrieval has run for this launch."}
                  </p>
                )}
              </section>
              <section className="record-section">
                <h3>Execution outcome</h3>
                <ExecutionOutcome decision={record} />
              </section>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
