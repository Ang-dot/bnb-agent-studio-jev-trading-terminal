import { apiPath } from "./api-path.js";
import { useFrontendEdition } from "./FrontendEdition.js";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Chart } from "./Chart.js";
import { TypeSafeLogo } from "./TypeSafeLogo.js";
import { TradingTerminal } from "./TradingTerminal.js";
import { platformLabel } from "./launches.js";
import { stanceLabel, type ReplayRun, type ReplayStance } from "./replay.js";
import type { Decision } from "./types.js";
import { forwardObservation } from "./terminal-insights.js";
import "./replay.css";
const noDecisions: Decision[] = [];
const utc = (ms: number) =>
  new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC";
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const stanceColor = (s?: string) =>
  s === "consider_entry" ? "#159b73" : s === "avoid" ? "#cd4d51" : "#af8100";

export function TerminalApp() {
  const { label, memoryName } = useFrontendEdition();
  useEffect(() => {
    document.title = `${label} | JEV Trading Terminal`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', `BNB Chain | ${label} JEV Trading Terminal — BSC launch discovery, agent decisions and ${memoryName} memory with paper trading.`);
  }, [label, memoryName]);
  const [view, setView] = useState<"replay" | "live">("live");
  return (
    <div className={view === "live" ? "experience-live" : "experience-replay"}>
      {view === "replay" && <nav className="experience-tabs" aria-label="Terminal experience">
        <button
          aria-pressed={view === "replay"}
          onClick={() => setView("replay")}
        >
          <TypeSafeLogo size={18} /> JEV replay
        </button>
        <button aria-pressed={false} onClick={() => setView("live")}>
          Live terminal <ArrowRight size={15} />
        </button>
        <span>Flap + Four.meme · BNB Chain</span>
      </nav>}
      {view === "replay" ? (
        <ReplayDesk onLive={() => setView("live")} />
      ) : (
        <TradingTerminal onReplay={() => setView("replay")} />
      )}
    </div>
  );
}
export function ReplayDesk({ onLive }: { onLive: () => void }) {
  const { memoryName } = useFrontendEdition();
  const [run, setRun] = useState<ReplayRun | null>(null);
  const [questions, setQuestions] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [coinIndex, setCoinIndex] = useState(0);
  const [pointIndex, setPointIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [operator, setOperator] = useState(false);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => setRevealed(false), [coinIndex, pointIndex]);
  useEffect(() => {
    let disposed = false,
      busy = false;
    async function refresh() {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch(apiPath("/api/replays"), { cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!disposed) {
          setRun((prior) =>
            JSON.stringify(prior) === JSON.stringify(data.run)
              ? prior
              : data.run,
          );
          setQuestions(data.questions);
          setOperator(data.operator === true);
          setError("");
        }
      } catch {
        if (!disposed)
          setError(
            "Replay service unavailable. Saved results are retained; no sample decisions are substituted.",
          );
      } finally {
        busy = false;
        if (!disposed) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);
  const coin =
    run?.coins[Math.min(coinIndex, Math.max(0, run.coins.length - 1))];
  const point =
    coin?.points[Math.min(pointIndex, Math.max(0, coin.points.length - 1))];
  useEffect(() => {
    if (!playing || !coin) return;
    const timer = window.setInterval(
      () =>
        setPointIndex((i) => {
          if (i >= coin.points.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      2200,
    );
    return () => window.clearInterval(timer);
  }, [playing, coin?.token, coin?.points.length]);
  const bars = useMemo(
    () =>
      coin?.candles.filter(
        (c) => (c.time + 300) * 1000 <= (point?.input.asOf ?? 0),
      ) ?? [],
    [coin, point],
  );
  const notes = useMemo(
    () =>
      coin?.points
        .slice(0, pointIndex + 1)
        .filter((p) => p.judgment)
        .map((p, i) => ({
          time: p.input.asOf,
          label: `${i + 1} · ${stanceLabel(p.judgment!.stance.choice)}`,
          color: stanceColor(p.judgment!.stance.choice),
        })) ?? [],
    [coin, pointIndex],
  );
  const count =
    run?.coins.reduce(
      (n, c) => n + c.points.filter((p) => p.judgment).length,
      0,
    ) ?? 0;
  const judgment = point?.judgment;
  const outcome = coin && point ? forwardObservation(coin.candles, point.input.asOf) : null;
  async function start() {
    setStarting(true);
    setPlaying(false);
    setError("");
    try {
      const response = await fetch(apiPath("/api/replays"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setRun(data.run);
      setCoinIndex(0);
      setPointIndex(0);
    } catch {
      setError("Could not start a replay. No trade was attempted.");
    } finally {
      setStarting(false);
    }
  }
  return (
    <main className="replay-desk">
      <header className="replay-header">
        <div>
          <span className="replay-eyebrow">
            JEV + {memoryName.toUpperCase()} / EVIDENCE DESK
          </span>
          <h1>Watch JEV read the market.</h1>
          <p>
            Real historical candles. Real model responses. Step through the
            evidence behind each assessment.
          </p>
        </div>
        {operator && <button
          className="yellow-button"
          disabled={loading || starting || run?.status === "running"}
          onClick={() => void start()}
        >
          <RefreshCw size={16} />
          {starting || run?.status === "running"
            ? "Running JEV…"
            : run
              ? "Run a fresh replay"
              : "Run 3-coin replay"}
        </button>}
      </header>
      <div className="replay-disclosure">
        <ShieldCheck size={20} />
        <div>
          <strong>
            Historical decision replay — not a full strategy backtest.
          </strong>
          <p>
            Price-only screening. Historical X, security, liquidity and {memoryName}
            {" "}context are unavailable. No buys, simulated fills, P&amp;L or
            live orders.
          </p>
        </div>
        <span>{count} real JEV responses</span>
      </div>
      <p className="replay-run-meta">
        {run
          ? `Run ${run.status} · requested ${utc(run.startedAt)} · ${run.coins.length} coins`
          : "A replay uses up to 12 JEV calls across 3 eligible coins. Viewing saved results makes no model calls."}{" "}
        · 5-minute candles · Flap / Four.meme
      </p>
      {error && (
        <p className="replay-error" role="alert">
          {error}
        </p>
      )}
      {run?.status === "running" && (
        <p className="replay-progress" role="status">
          Collecting closed candles and recording JEV responses. Results appear
          below as they complete.
        </p>
      )}
      {run && (
        <div className="replay-coins" aria-label="Replay coins">
          {run.coins.map((c, i) => (
            <button
              key={c.token}
              aria-pressed={coinIndex === i}
              onClick={() => {
                setCoinIndex(i);
                setPointIndex(0);
                setPlaying(false);
              }}
            >
              <strong>{c.symbol}</strong>
              <span>
                {platformLabel(c.platform)} ·{" "}
                {c.points.filter((p) => p.judgment).length} assessments
              </span>
              <small>
                {c.token.slice(0, 8)}…{c.token.slice(-6)}
              </small>
            </button>
          ))}
        </div>
      )}
      {coin && point ? (
        <div className="replay-grid">
          <section className="replay-chart panel">
            <div className="replay-chart-heading">
              <div>
                <h2>
                  {coin.symbol} <small>/ historical USD price</small>
                </h2>
                <span>
                  As of {utc(point.input.asOf)} · later candles hidden
                </span>
              </div>
              <a href={coin.sourceUrl} target="_blank" rel="noreferrer">
                GMGN <ExternalLink size={13} />
              </a>
            </div>
            <Chart
              candles={bars}
              decisions={noDecisions}
              interval={5}
              annotations={notes}
            />
            <div className="replay-playbar">
              <button
                disabled={pointIndex === 0}
                onClick={() => {
                  setPlaying(false);
                  setPointIndex((i) => i - 1);
                }}
                aria-label="Previous checkpoint"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => {
                  if (pointIndex >= coin.points.length - 1) setPointIndex(0);
                  setPlaying(!playing);
                }}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
                {playing ? "Pause playback" : "Play recorded decisions"}
              </button>
              <button
                disabled={pointIndex >= coin.points.length - 1}
                onClick={() => {
                  setPlaying(false);
                  setPointIndex((i) => i + 1);
                }}
                aria-label="Next checkpoint"
              >
                <ChevronRight size={18} />
              </button>
              <small>Playback uses saved outputs, not new calls.</small>
            </div>
            <div
              className="replay-checkpoints"
              aria-label="Decision checkpoints"
            >
              {coin.points.map((p, i) => (
                <button
                  key={p.id}
                  aria-pressed={pointIndex === i}
                  onClick={() => {
                    setPlaying(false);
                    setPointIndex(i);
                  }}
                >
                  <span>Checkpoint {i + 1}</span>
                  <strong
                    style={{ color: stanceColor(p.judgment?.stance.choice) }}
                  >
                    {p.judgment
                      ? stanceLabel(p.judgment.stance.choice)
                      : p.error
                        ? "Call failed"
                        : "Assessing…"}
                  </strong>
                  <small>
                    {new Date(p.input.asOf).toISOString().slice(11, 16)} UTC
                  </small>
                </button>
              ))}
            </div>
            <p className="replay-chart-caption">
              Markers are JEV screening outputs, not trades. Candle volume units
              are unverified and excluded from the assessment.
            </p>
          </section>
          <aside
            className="replay-assessment panel checkpoint-reveal"
            key={point.id}
            aria-label="Recorded JEV assessment"
          >
            <span className="replay-eyebrow">
              <TypeSafeLogo size={18} /> REAL JEV OUTPUT · CHECKPOINT{" "}
              {pointIndex + 1}
            </span>
            <h2 style={{ color: stanceColor(judgment?.stance.choice) }}>
              {judgment
                ? stanceLabel(judgment.stance.choice)
                : point.error
                  ? "No valid response"
                  : "JEV is assessing…"}
            </h2>
            {judgment ? (
              <>
                <p>
                  {judgment.stance.choice === "consider_entry"
                    ? "JEV sees a price-only hypothesis worth investigating. This does not pass entry policy."
                    : judgment.stance.choice === "avoid"
                      ? "JEV’s chart screening does not support investigating a fresh long entry here."
                      : "JEV selected abstention or further confirmation at this checkpoint."}
                </p>
                <div className="replay-confidence">
                  <strong>
                    {(judgment.stance.confidence * 100).toFixed(1)}%
                  </strong>
                  <span>
                    Model choice confidence
                    <br />
                    Not a win probability
                  </span>
                </div>
                <div className="replay-distribution">
                  {Object.entries(judgment.stance.probabilities).map(
                    ([k, v]) => (
                      <div key={k}>
                        <span>{stanceLabel(k as ReplayStance)}</span>
                        <i>
                          <b
                            style={{
                              width: `${v * 100}%`,
                              background: stanceColor(k),
                            }}
                          />
                        </i>
                        <small>{(v * 100).toFixed(1)}%</small>
                      </div>
                    ),
                  )}
                </div>
                <dl>
                  <div>
                    <dt>Price pattern</dt>
                    <dd>{judgment.pattern.choice}</dd>
                  </div>
                  <div>
                    <dt>Evidence emphasis</dt>
                    <dd>{judgment.evidence.choice}</dd>
                  </div>
                  <div>
                    <dt>Model</dt>
                    <dd>{judgment.model}</dd>
                  </div>
                </dl>
              </>
            ) : (
              point.error && <p className="replay-error">{point.error}</p>
            )}
            <div className="replay-policy">
              <ShieldCheck size={17} />
              <div>
                <strong>Code policy · NO ENTRY AUTHORIZED</strong>
                <p>
                  Historical graduation and the full evidence gates have not
                  been reconstructed. Replay has no connection to the trade
                  executor.
                </p>
              </div>
            </div>
            <div className="outcome-reveal">
              <strong>What happened next?</strong>
              <p>Compare this call with the next 15 minutes of recorded price action.</p>
              {revealed ? <div role="status"><b className={outcome && outcome.returnPct >= 0 ? "signal-up" : "signal-down"}>{outcome ? pct(outcome.returnPct) : "Unavailable"}</b><span>{outcome ? "Close-to-close move · +15 minutes" : "The exact +15m closed candle is not in this saved window."}</span><small>Retrospective market move, not a trade return or P&amp;L. Not supplied to JEV at this checkpoint; excludes costs and fill feasibility.</small></div> : <button onClick={()=>{setPlaying(false);setRevealed(true);}}>Reveal +15m market move <ArrowRight size={14}/></button>}
            </div>
          </aside>
          <section className="replay-evidence panel">
            <h2>
              <Database size={18} /> What JEV could see
            </h2>
            <div className="replay-facts">
              <div>
                <span>Closed candles supplied</span>
                <strong>{point.input.features.bars}</strong>
              </div>
              <div>
                <span>First-to-last close change</span>
                <strong>{pct(point.input.features.returnPct)}</strong>
              </div>
              <div>
                <span>High–low range / first close</span>
                <strong>{point.input.features.rangePct.toFixed(2)}%</strong>
              </div>
              <div>
                <span>Observation span</span>
                <strong>{point.input.features.elapsedMinutes} min</strong>
              </div>
            </div>
            <p>
              Source evidence C1–C{point.input.candles.length}: closed GMGN
              candles ending no later than the checkpoint. The labels above are
              typed assessments, not the model’s private reasoning.
            </p>
            <div className="replay-memory">
              <BrainCircuit size={18} />
              <div>
                <strong>{memoryName} · historical context unavailable</strong>
                <p>
                  Present-day memories are deliberately withheld to avoid future
                  information. This replay does not measure the benefit of JEV +
                  memory; the live design still requires both.
                </p>
              </div>
            </div>
            <details>
              <summary>
                Inspect supplied candles, model questions and response receipt
              </summary>
              <p>
                Request made {utc(point.calledAt)}. Candles retrieved{" "}
                {utc(coin.fetchedAt)}. Graduation status at replay collection:{" "}
                {utc(coin.currentVerification.checkedAt)} — not a historical
                attestation.
              </p>
              <code className="replay-request-id">
                Request ID: {judgment?.requestId ?? "No successful response"}
              </code>
              <pre>
                {JSON.stringify(
                  { input: point.input, questions, judgment },
                  null,
                  2,
                )}
              </pre>
            </details>
          </section>
        </div>
      ) : (
        <section className="replay-empty panel">
          <BrainCircuit size={36} />
          <h2>
            {loading
              ? "Loading recorded decisions…"
              : run?.status === "running"
                ? "Selecting historical windows…"
                : "No replay results yet"}
          </h2>
          <p>
            Only real provider data and successful JEV responses appear here.
          </p>
        </section>
      )}
      {run && (
        <details className="replay-method">
          <summary>Scope, sample selection and limitations</summary>
          <ul>
            {run.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </details>
      )}
      <footer className="replay-footer">
        <span>
          BNB Agent SDK execution boundary unchanged · live signer locked
        </span>
        <button onClick={onLive}>
          Return to live observation <ArrowRight size={15} />
        </button>
      </footer>
    </main>
  );
}
