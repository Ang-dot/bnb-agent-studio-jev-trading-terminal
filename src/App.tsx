import { marketSources } from "./market-provenance";
import { apiPath } from "./api-path.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  Clock3,
  Database,
  ExternalLink,
  FlaskConical,
  Layers3,
  LockKeyhole,
  Network,
  Pause,
  Play,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Square,
  Star,
  Terminal,
  Unplug,
  X,
} from "lucide-react";
import type { Candle, Decision, TerminalState } from "./types.js";
import { Chart } from "./Chart.js";
import { XEvidence } from "./XEvidence.js";
import { AssessmentCard, AssessmentOverview, DecisionSummary, ExecutionOutcome, executionLabel } from "./DecisionBreakdown.js";
const usd = (n: number, d = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: d,
  }).format(n);
const compact = (n: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
const price = (n: number) => (n >= 1 ? usd(n, 4) : `$${n.toPrecision(5)}`);
const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
const time = (n: number) =>
  new Date(n).toLocaleTimeString("en-GB", { hour12: false });
async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(apiPath(url), {
    headers: body ? { "Content-Type": "application/json" } : undefined,
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
const Icon = ({ kind }: { kind: string }) =>
  kind === "Jev" ? (
    <Activity size={17} />
  ) : kind === "Living Brain" ? (
    <BrainCircuit size={17} />
  ) : kind === "NodeReal" ? (
    <Network size={17} />
  ) : kind === "Grok / X" ? (
    <Search size={17} />
  ) : (
    <Database size={17} />
  );

export function App() {
  const [state, setState] = useState<TerminalState | null>(null),
    [selected, setSelected] = useState(""),
    [interval, setIntervalValue] = useState("5");
  const [candles, setCandles] = useState<Candle[]>([]),
    [chartError, setChartError] = useState(""),
    [chartLoading, setChartLoading] = useState(true);
  const [tab, setTab] = useState("Decisions"),
    [search, setSearch] = useState(""),
    [decisionId, setDecisionId] = useState("");
  const [modal, setModal] = useState<"providers" | "live" | "policy" | null>(
      null,
    ),
    [pendingActions, setPendingActions] = useState(0),
    [notice, setNotice] = useState(""),
    [clock, setClock] = useState(Date.now());
  const busy = pendingActions > 0;
  const refresh = useCallback(async () => {
    try {
      const next = await api<TerminalState>("/api/state");
      setState(next);
      setNotice(current => current === "Backend disconnected. No new decisions can be confirmed." ? "" : current);
      setSelected(
        (current) =>
          current ||
          next.pools.find((p) => /broccoli|banana|wkc/i.test(p.symbol))
            ?.address ||
          next.pools[0]?.address ||
          "",
      );
    } catch {
      setNotice("Backend disconnected. No new decisions can be confirmed.");
    }
  }, []);
  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), 4000);
    const tick = window.setInterval(() => setClock(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [refresh]);
  useEffect(() => {
    let active = true;
    setCandles([]);
    setChartError("");
    setChartLoading(true);
    const load = async () => {
      if (!selected) return;
      try {
        const r = await api<{ candles: Candle[] }>(
          `/api/candles/${selected}?interval=${interval}`,
        );
        if (active) {
          setCandles(r.candles);
          setChartError(
            r.candles.length ? "" : "No candles returned for this pool.",
          );
        }
      } catch (e) {
        if (active) setChartError((e as Error).message);
      } finally {
        if (active) setChartLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 45000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selected, interval]);
  async function act(url: string, body: unknown, message?: string) {
    setPendingActions(n => n + 1);
    setNotice("");
    try {
      await api(url, body);
      if (message) setNotice(message);
      await refresh();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setPendingActions(n => n - 1);
    }
  }
  const pool = state?.pools.find((p) => p.address === selected);
  const decisions = useMemo(
    () => state?.decisions.filter((d) => d.pool === selected) ?? [],
    [state?.revision, selected],
  );
  const decision =
    state?.decisions.find((d) => d.id === decisionId) ?? decisions[0];
  const available =
    state?.providers.filter((p) => p.state === "ready").length ?? 0;
  const estimatedEquity = state
    ? state.ledger.cashUsd +
      state.ledger.positions.reduce(
        (sum, p) =>
          sum +
          p.quantity *
            (state.pools.find((x) => x.address === p.pool)?.priceUsd ??
              p.costUsd / p.quantity),
        0,
      )
    : 2000;
  const freshness = pool
    ? Math.max(0, Math.floor((clock - pool.discoveredAt) / 1000))
    : 0;
  const ready = state?.providers
    .filter((p) =>
      ["Jev", "Living Brain", "Bitquery", "GeckoTerminal", "Grok / X"].includes(p.name),
    )
    .every((p) => p.state === "ready" || p.state === "configured");
  return (
    <div className="app">
      <aside className="rail">
        <a className="brand-mark" href="/" aria-label="Jev terminal">
          <span>◆</span>
        </a>
        <button className="rail-active" aria-label="Trading terminal">
          <Layers3 size={21} />
        </button>
        <button onClick={() => setModal("providers")} aria-label="Connections">
          <Network size={21} />
        </button>
        <button onClick={() => setModal("policy")} aria-label="Risk policy">
          <ShieldCheck size={21} />
        </button>
        <div className="rail-bottom">
          <button onClick={() => setModal("providers")} aria-label="Setup">
            <Settings2 size={21} />
          </button>
          <span className="avatar">Y</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="product">
            <span>
              JEV<span className="product-dot">.</span>
            </span>
            <i />
            <span className="muted">Trading terminal</span>
            <span className="version">PHASE 01</span>
          </div>
          <div className="header-right">
            <span className="chain">
              <span className="bnb-diamond">◆</span> BNB Smart Chain
            </span>
            <button
              className="text-button"
              onClick={() => setModal("providers")}
            >
              <span className={`status-dot ${available ? "green" : ""}`} />
              {available}/{state?.providers.length ?? 7} connected
              <ChevronRight size={14} />
            </button>
            <span className="operator">Single operator</span>
          </div>
        </header>
        <div className="titlebar">
          <div>
            <div className="eyebrow">JEV + LIVING BRAIN</div>
            <h1>Observe. Decide. Remember.</h1>
            <p>One agent. An approved universe. Every decision in context.</p>
          </div>
          <div className="agent-control">
            <div className="mode-switch">
              <button className="active">
                <FlaskConical size={14} />
                Paper
              </button>
              <button onClick={() => setModal("live")}>
                <LockKeyhole size={13} />
                Live
              </button>
            </div>
            <button
              className="primary"
              disabled={!state || (!state.running && (busy || state.busy))}
              onClick={() =>
                void act("/api/control", {
                  action: state?.running ? "pause" : "start",
                })
              }
            >
              {state?.running ? <Pause size={15} /> : <Play size={15} />}{" "}
              {state?.running ? "Pause agent" : "Start agent"}
            </button>
            <button
              className={`stop-button ${state?.halted ? "latched" : ""}`}
              disabled={!state || (state.halted && (busy || state.busy))}
              onClick={() =>
                void act(
                  "/api/control",
                  { action: state?.halted ? "reset_stop" : "stop" },
                  state?.halted
                    ? "Stop reset. Agent remains paused."
                    : "Stop latched. New execution is blocked; positions are not liquidated.",
                )
              }
              aria-label={state?.halted ? "Reset stop" : "Stop agent"}
            >
              <Square size={13} />
            </button>
          </div>
        </div>
        <div className="status-strip">
          <span className={`pill ${state?.running ? "success" : "neutral"}`}>
            <span className="status-dot" />
            {state?.halted
              ? "STOP LATCHED"
              : state?.running
                ? "AGENT RUNNING"
                : "AGENT PAUSED"}
          </span>
          <span>
            <FlaskConical size={14} /> Live market data · simulated execution
          </span>
          <span className="strip-separator" />
          <span>
            {available === state?.providers.length
              ? "Provider requests verified · live execution locked"
              : ready
              ? "Provider keys configured · validation required"
              : "Provider attention needed · review connections"}
          </span>
          <button onClick={() => setModal("providers")}>
            View setup <ArrowUpRight size={14} />
          </button>
        </div>
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
              <X size={14} />
            </button>
          </div>
        )}
        {state?.discoveryError && (
          <div className="notice" role="status">
            {state.discoveryError}
          </div>
        )}
        <section className="metrics">
          <Metric
            label="Paper equity"
            value={usd(estimatedEquity)}
            sub="Indicative · not executable quotes"
          />
          <Metric
            label="Available cash"
            value={usd(state?.ledger.cashUsd ?? 2000)}
            sub="Simulation balance"
          />
          <Metric
            label="Realized P&L"
            value={usd(state?.ledger.realizedPnlUsd ?? 0)}
            sub="After modeled fees & slippage"
          />
          <Metric
            label="Open positions"
            value={`${state?.ledger.positions.length ?? 0} / 3`}
            sub="Spot only · no leverage"
          />
          <Metric
            label="Approved universe"
            value={`${state?.approvedPools.length ?? 0} / 5`}
            sub="PancakeSwap pools on BSC"
          />
          <Metric
            label="Agent decisions"
            value={`${state?.decisions.filter((d) => d.judgment).length ?? 0}`}
            sub={
              state?.lastCycleAt
                ? `Last cycle ${time(state.lastCycleAt)}`
                : "Awaiting first model evaluation"
            }
          />
        </section>
        <main className="terminal-grid">
          <section className="universe panel">
            <div className="panel-title">
              <h2>Market universe</h2>
              <span className="count">{state?.pools.length ?? 0}</span>
              <button
                title="Discovery is sorted by 24h volume, not Jev conviction."
                onClick={() =>
                  setNotice(
                    "Discovery is sorted by 24h trading volume. These are unvetted BSC candidates—not recommendations or an agent ranking.",
                  )
                }
              >
                <ChevronsUpDown size={14} />
              </button>
            </div>
            <div className="search">
              <Search size={14} />
              <input
                aria-label="Search pools"
                placeholder="Search token or contract"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="list-caption">
              <span>POOL / 24H VOLUME</span>
              <span>PRICE / 24H</span>
            </div>
            <div className="pool-list">
              {!state?.pools.length && (
                <div className="empty small">
                  <Radio size={25} />
                  <strong>
                    {state?.discoveryError
                      ? "Feed unavailable"
                      : "Loading BSC pools"}
                  </strong>
                  <p>
                    {state?.discoveryError ||
                      "Fetching public on-chain market data…"}
                  </p>
                </div>
              )}
              {state?.pools
                .filter((p) =>
                  `${p.name}${p.token}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((p, index) => (
                  <button
                    key={p.address}
                    className={`pool-row ${selected === p.address ? "selected" : ""}`}
                    onClick={() => {
                      setSelected(p.address);
                      setDecisionId("");
                    }}
                  >
                    <span
                      className="token-icon"
                      style={{
                        background: [
                          "#eff5db",
                          "#fcf1d0",
                          "#e5eefe",
                          "#f1e9fa",
                        ][index % 4],
                      }}
                    >
                      {p.symbol.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="pool-name">
                      <strong>
                        {p.symbol}
                        <span className="approved-star">
                          {state.approvedPools.includes(p.address) && (
                            <Star size={10} fill="currentColor" />
                          )}
                        </span>
                      </strong>
                      <small>${compact(p.volume24h)} vol</small>
                    </span>
                    <span className="pool-price">
                      <strong>{price(p.priceUsd)}</strong>
                      <small className={p.change24h >= 0 ? "up" : "down"}>
                        {p.change24h > 0 ? "+" : ""}
                        {p.change24h.toFixed(2)}%
                      </small>
                    </span>
                  </button>
                ))}
            </div>
            <div className="universe-footer">
              <ShieldCheck size={15} />
              <p>
                Discovery ≠ approval.
                <br />
                <span>
                  Review a pool before adding it to the paper watchlist.
                </span>
              </p>
            </div>
          </section>
          <section className="market panel">
            <div className="market-head">
              <div className="pair-title">
                <span className="token-large">
                  {pool?.symbol.slice(0, 1) || "◆"}
                </span>
                <div>
                  <h2>
                    {pool?.symbol || "Select a pool"}{" "}
                    <span>/ {pool?.name.split(" / ")[1] || "BSC"}</span>
                  </h2>
                  <a href={pool?.url} target="_blank" rel="noreferrer">
                    {pool ? short(pool.token) : "Token contract"}{" "}
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
              <div className="market-price">
                <strong>{pool ? price(pool.priceUsd) : "—"}</strong>
                <span className={(pool?.change1h ?? 0) >= 0 ? "up" : "down"}>
                  {pool
                    ? `${pool.change1h > 0 ? "+" : ""}${pool.change1h.toFixed(2)}%`
                    : "—"}{" "}
                  <small>1h</small>
                </span>
              </div>
              <button
                className={`approve-button ${state?.approvedPools.includes(selected) ? "approved" : ""}`}
                disabled={!pool || busy || state?.running}
                onClick={() =>
                  void act("/api/approve", {
                    pool: selected,
                    approved: !state?.approvedPools.includes(selected),
                  })
                }
              >
                {state?.approvedPools.includes(selected) ? (
                  <Check size={14} />
                ) : (
                  <Star size={14} />
                )}{" "}
                {state?.approvedPools.includes(selected)
                  ? "Paper-approved"
                  : "Approve for paper"}
              </button>
            </div>
            <div className="chart-toolbar">
              <div className="intervals">
                {["1", "5", "15"].map((i) => (
                  <button
                    key={i}
                    className={interval === i ? "active" : ""}
                    onClick={() => setIntervalValue(i)}
                  >
                    {i}m
                  </button>
                ))}
                <i />
                <span>Candles</span>
              </div>
              <span className={`chart-source ${freshness > 90 ? "down" : ""}`}>
                <span className="status-dot green" />
                GMGN · token-wide candles
              </span>
            </div>
            <div className="chart-area">
              {candles.length ? (
                <Chart
                  candles={candles}
                  decisions={decisions}
                  interval={Number(interval)}
                />
              ) : (
                <div className="empty chart-empty">
                  <Activity size={36} />
                  <strong>
                    {chartLoading
                      ? "Loading on-chain candles…"
                      : "Chart unavailable"}
                  </strong>
                  <p>
                    {chartError ||
                      "The chart uses the exact selected pool—not an aggregated coin price."}
                  </p>
                </div>
              )}
              {chartError && candles.length > 0 && (
                <div className="chart-error">{chartError}</div>
              )}
            </div>
            <div className="chart-legend">
              <span>
                <i className="legend-up" /> Paper buy
              </span>
              <span>
                <i className="legend-down" /> Paper sell
              </span>
              <span>
                <i className="legend-hold" /> Hold / skipped
              </span>
              <a
                href="https://www.tradingview.com/"
                target="_blank"
                rel="noreferrer"
              >
                Charts by TradingView
              </a>
            </div>
            <div className="pool-details">
              <div>
                <small>POOL LIQUIDITY</small>
                <strong>{pool ? usd(pool.liquidityUsd, 0) : "—"}</strong>
              </div>
              <div>
                <small>24H VOLUME</small>
                <strong>{pool ? usd(pool.volume24h, 0) : "—"}</strong>
              </div>
              <div>
                <small>1H BUYS / SELLS</small>
                <strong>
                  <span className="up">{pool?.buys ?? "—"}</span> /{" "}
                  <span className="down">{pool?.sells ?? "—"}</span>
                </strong>
              </div>
              <div>
                <small>POOL ADDRESS</small>
                <a
                  href={
                    pool
                      ? `https://bscscan.com/address/${pool.address}`
                      : undefined
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {pool ? short(pool.address) : "—"} <ExternalLink size={11} />
                </a>
              </div>
            </div>
          </section>
          <section className="inspector panel">
            <div className="panel-title">
              <h2>
                <BrainCircuit size={17} /> Decision breakdown
              </h2>
              <span className="live-dot">●</span>
            </div>
            <div className="inspector-body" tabIndex={0} aria-label="Decision evidence and assessments">
            <div className="inspector-heading">
              <span className="eyebrow">JEV + MEMORY · ALWAYS TOGETHER</span>
              <h3>
                {decision
                  ? decision.status === "not_evaluated"
                    ? "Not evaluated"
                    : `JEV: ${(decision.judgment?.action ?? decision.action).toUpperCase()} · ${decision.name.split(" / ")[0]}`
                  : "Evidence before action."}
              </h3>
              <DecisionSummary decision={decision} />
            </div>
            <div className="context-step">
              <span className="step-number">01</span>
              <div>
                <h4>
                  Market observation <span>CODE</span>
                </h4>
                <p id="evidence-market">
                  {decision?.snapshot
                    ? `${price(decision.snapshot.priceUsd)} · ${marketSources(decision.snapshot).price} · ${time(decision.snapshot.marketAt)}`
                    : pool
                      ? `${pool.name} · exact pool selected`
                      : "Choose a pool to inspect."}
                </p>
                <small>Arithmetic and timestamps stay in code.</small>
                {decision?.snapshot && <details className="assessment-question">
                  <summary>Market inputs at this decision</summary>
                  <p>Price: {price(decision.snapshot.priceUsd)} · {marketSources(decision.snapshot).price}</p>
                  <p>Liquidity: {usd(decision.snapshot.liquidityUsd, 0)} · 24h volume: {usd(decision.snapshot.volume24h, 0)}</p>
                  <p>1h change: {decision.snapshot.change1h.toFixed(2)}% · buys / sells: {decision.snapshot.buyCount} / {decision.snapshot.sellCount}</p>
                  <p>Market time: {new Date(decision.snapshot.marketAt).toISOString()}</p>
                  <p>{marketSources(decision.snapshot).metrics} · received {new Date(decision.snapshot.metricsReceivedAt ?? decision.snapshot.observedAt).toISOString()}</p>
                  <p>Stored input snapshot, not the chart’s current values.</p>
                </details>}
              </div>
            </div>
            <div className="context-step">
              <span className="step-number">02</span>
              <div>
                <h4>X research <span>GROK</span></h4>
                <XEvidence research={decision?.research} now={clock} assessments={decision?.judgment?.assessments} />
              </div>
            </div>
            <div className="context-step">
              <span className="step-number">03</span>
              <div>
                <h4>
                  Relevant experience <span>MEMORY</span>
                </h4>
                <p>
                  {decision?.memoryStatus ||
                    "Waiting for Living Brain connection"}
                </p>
                {decision?.memories.map((m, i) => (
                  <details key={m.pageId} className="memory-card">
                    <summary><span className="evidence-id">M{i + 1}</span> {m.title}</summary>
                    <p id={`evidence-M${i + 1}`}><b>Living Brain summary:</b> {m.summary}</p>
                    <small>
                      Page {short(m.pageId)} · relevance{" "}
                      {m.similarity.toFixed(2)}
                    </small>
                    {decision.judgment?.assessments?.filter(a => a.kind === "memory" && a.referenceId === m.pageId).map(a => <AssessmentCard key={a.id} assessment={a} />)}
                  </details>
                ))}
                <small>Past context is evidence, not an instruction.</small>
              </div>
            </div>
            <div className="context-step">
              <span className="step-number">04</span>
              <div>
                <h4>
                  JEV assessments <span>MODEL</span>
                </h4>
                {decision?.judgment ? (
                  <>
                    <div className="probability">
                      {Object.entries(decision.judgment.probabilities).map(
                        ([key, value]) => (
                          <div key={key}>
                            <span>{key}</span>
                            <div>
                              <i style={{ width: `${value * 100}%` }} />
                            </div>
                            <b>{(value * 100).toFixed(0)}%</b>
                          </div>
                        ),
                      )}
                    </div>
                    <small>
                      Confidence {decision.judgment.confidence.toFixed(2)} ·
                      quality {decision.judgment.quality.toFixed(1)}/3
                    </small>
                    <small className="model-metric">Toxic-context probability {(decision.judgment.toxic * 100).toFixed(0)}%. Quality and toxicity feed the existing entry policy.</small>
                    <AssessmentOverview judgment={decision.judgment} />
                    <details className="assessment-question">
                      <summary>Model request record</summary>
                      <p>{decision.judgment.model}</p>
                      <p>Request: {decision.judgment.requestId}</p>
                      <p>{new Date(decision.time).toISOString()} · provider-reported cost ${decision.judgment.costUsd.toFixed(6)}</p>
                    </details>
                  </>
                ) : (
                  <p>
                    No model output yet. Nothing is inferred or simulated here.
                  </p>
                )}
              </div>
            </div>
            <div className="context-step">
              <span className="step-number">05</span>
              <div>
                <h4>
                  Execution outcome <span>CODE</span>
                </h4>
                <ExecutionOutcome decision={decision} />
                {decision?.checks.length ? (
                  <details className="checks">
                    <summary>
                      {decision.checks.filter((c) => c.pass).length}/
                      {decision.checks.length} checks passed
                    </summary>
                    {decision.checks.map((c) => (
                      <div key={c.label} className={c.pass ? "up" : "down"}>
                        {c.pass ? <Check size={12} /> : <X size={12} />}
                        <span>
                          {c.label}
                          <small>{c.detail}</small>
                        </span>
                      </div>
                    ))}
                  </details>
                ) : (
                  <small>
                    Approval, freshness, liquidity, security & limits.
                  </small>
                )}
              </div>
            </div>
            </div>
            <div className="inspector-bottom">
              <button
                className="outline full"
                disabled={!pool || busy || state?.busy || state?.halted}
                onClick={() => void act("/api/evaluate", { pool: selected })}
              >
                <Activity size={15} />
                {busy || state?.busy ? "Researching & evaluating…" : "Inspect decision"}
              </button>
              <span>Inspection never trades. X research uses OpenRouter credits; cached for five minutes.</span>
            </div>
          </section>
          <section className="activity panel">
            <div className="activity-tabs">
              {["Decisions", "Positions", "Paper fills"].map((t) => (
                <button
                  className={tab === t ? "active" : ""}
                  key={t}
                  onClick={() => setTab(t)}
                >
                  {t}
                  <span>
                    {t === "Decisions"
                      ? (state?.decisions.length ?? 0)
                      : t === "Positions"
                        ? (state?.ledger.positions.length ?? 0)
                        : (state?.ledger.fills.length ?? 0)}
                  </span>
                </button>
              ))}
              <span className="activity-note">
                <Clock3 size={12} /> Persistent audit trail
              </span>
            </div>
            {tab === "Decisions" &&
              (state?.decisions.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>TIME</th>
                        <th>POOL</th>
                        <th>JUDGMENT</th>
                        <th>RESULT</th>
                        <th>EVIDENCE</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {state.decisions.slice(0, 30).map((d) => (
                        <tr
                          key={d.id}
                          tabIndex={0}
                          role="button"
                          aria-label={`Inspect ${d.name} at ${time(d.time)}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setDecisionId(d.id);
                              setSelected(d.pool);
                            }
                          }}
                          className={decisionId === d.id ? "selected" : ""}
                          onClick={() => {
                            setDecisionId(d.id);
                            setSelected(d.pool);
                          }}
                        >
                          <td>{time(d.time)}</td>
                          <td>{d.name}</td>
                          <td>
                            <span
                              className={`action ${d.judgment ? d.judgment.action : "skip"}`}
                            >
                              {d.judgment ? d.judgment.action : "NOT EVALUATED"}
                            </span>
                          </td>
                          <td>
                            {executionLabel(d)}
                          </td>
                          <td className="reason-cell">{d.reasons[0]}</td>
                          <td>
                            <ChevronRight size={14} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty horizontal">
                  <Terminal size={28} />
                  <div>
                    <strong>Your decision trail starts here.</strong>
                    <p>
                      Choose a pool and inspect a decision. Source data,
                      memories and checks will appear together.
                    </p>
                  </div>
                </div>
              ))}
            {tab === "Positions" &&
              (state?.ledger.positions.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>POOL</th>
                        <th>QUANTITY</th>
                        <th>COST BASIS</th>
                        <th>INDICATIVE VALUE</th>
                        <th>OPENED</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.ledger.positions.map((p) => (
                        <tr key={p.pool}>
                          <td>{p.name}</td>
                          <td>{p.quantity.toFixed(4)}</td>
                          <td>{usd(p.costUsd)}</td>
                          <td>
                            {usd(
                              p.quantity *
                                (state.pools.find((x) => x.address === p.pool)
                                  ?.priceUsd ?? p.costUsd / p.quantity),
                            )}
                          </td>
                          <td>{time(p.openedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty horizontal">
                  <Layers3 size={28} />
                  <div>
                    <strong>No open paper positions.</strong>
                    <p>
                      Positions appear only after a qualified, autonomous paper
                      decision.
                    </p>
                  </div>
                </div>
              ))}
            {tab === "Paper fills" &&
              (state?.ledger.fills.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>TIME</th>
                        <th>POOL</th>
                        <th>SIDE</th>
                        <th>FILL PRICE</th>
                        <th>FEE</th>
                        <th>REALIZED P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.ledger.fills.map((f) => (
                        <tr key={f.id}>
                          <td>{time(f.time)}</td>
                          <td>{f.name}</td>
                          <td className={f.side === "buy" ? "up" : "down"}>
                            {f.side}
                          </td>
                          <td>{price(f.priceUsd)}</td>
                          <td>{usd(f.feeUsd)}</td>
                          <td>{usd(f.realizedPnlUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty horizontal">
                  <ArrowDownLeft size={28} />
                  <div>
                    <strong>No simulated fills yet.</strong>
                    <p>
                      Paper fills model 0.30% fees and 0.50% adverse slippage.
                      They are not real executions.
                    </p>
                  </div>
                </div>
              ))}
          </section>
        </main>
        <footer className="footer">
          <span>
            <span className="status-dot green" /> BNB Agent SDK v
            {state?.sdk.version || "0.6.0"}
            <i />
            Chain 56
            <i />
            {state?.database || "Connecting to ledger"}
          </span>
          <span>
            Research terminal · experimental paper policy{" "}
            <button
              aria-label="About paper policy"
              onClick={() => setModal("policy")}
            >
              <CircleHelp size={13} />
            </button>
          </span>
        </footer>
      </div>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "live"
                ? "Live execution requirements"
                : modal === "providers"
                  ? "Provider connections"
                  : "Paper policy"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setModal(null)}
              aria-label="Close dialog"
            >
              <X size={19} />
            </button>
            {modal === "providers" ? (
              <>
                <div className="modal-icon">
                  <Network />
                </div>
                <span className="eyebrow">CONNECTIONS</span>
                <h2>Real inputs. Clear provenance.</h2>
                <p>
                  Credentials stay on the backend, outside Git and the browser.
                  Verification checks each configured connection without
                  placing trades or writing memories. X search uses OpenRouter
                  credits and reuses recent results for five minutes.
                </p>
                <div className="provider-list">
                  {state?.providers.map((p) => (
                    <div key={p.name}>
                      <Icon kind={p.name} />
                      <div>
                        <strong>{p.name}</strong>
                        <small>{p.detail}</small>
                      </div>
                      <span className={`provider-state ${p.state}`}>
                        {p.state === "missing"
                          ? "Needs setup"
                          : p.state === "ready"
                            ? "Connected"
                            : p.state === "error"
                              ? "Unavailable"
                              : "Unverified"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="modal-note">
                  <Database size={16} />
                  <span>
                    Ledger: {state?.database}. Cloud storage requires its SQL connection.
                    Grok/X uses the same OpenRouter key as Jev. Live signing
                    remains locked.
                  </span>
                </div>
                <button
                  className="outline full"
                  disabled={busy || state?.busy}
                  onClick={() =>
                    void act(
                      "/api/connections/check",
                      {},
                      "Connection checks finished. See each provider’s result.",
                    )
                  }
                >
                  {busy ? "Checking connections…" : "Verify connections"}
                </button>
              </>
            ) : modal === "live" ? (
              <>
                <div className="modal-icon">
                  <LockKeyhole />
                </div>
                <span className="eyebrow">REAL EXECUTION</span>
                <h2>Live mode is not armed.</h2>
                <p>
                  This switch will control real execution once the live adapter
                  is complete and you have approved its limits. It cannot move
                  funds in this build.
                </p>
                <ul className="blocker-list">
                  {state?.liveBlockers.map((b) => (
                    <li key={b}>
                      <LockKeyhole size={15} />
                      {b}
                    </li>
                  ))}
                </ul>
                <button className="primary full" onClick={() => setModal(null)}>
                  Continue in paper mode
                </button>
              </>
            ) : (
              <>
                <div className="modal-icon">
                  <ShieldCheck />
                </div>
                <span className="eyebrow">DETERMINISTIC GUARDRAILS</span>
                <h2>The model judges. Code controls.</h2>
                <p>
                  These are experimental simulation defaults, not calibrated
                  trading parameters or approved live limits.
                </p>
                <div className="policy-grid">
                  {[
                    ["Starting paper cash", "$2,000"],
                    ["Order size", "$100"],
                    ["Maximum per position", "$300"],
                    ["Maximum positions", "3"],
                    ["Daily realized loss cap", "$200"],
                    ["Minimum pool liquidity", "$50,000"],
                    ["Maximum evidence age", "90 seconds"],
                    ["Modeled costs", "0.30% fee + 0.50% slippage"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <span>{k}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
                <p className="modal-note">
                  No leverage, no shorts, no Kelly sizing from model confidence.
                  Restart always pauses the agent. The kill switch blocks new
                  fills; it does not liquidate positions.
                </p>
                <div className="modal-note">
                  <BrainCircuit size={18} />
                  <span>
                    Living Brain preserves prior context. It does not retrain
                    Jev or automatically rewrite execution policy.
                  </span>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}
