import {
  BrainCircuit,
  Check,
  Clock3,
  Pause,
  Play,
  ArrowRight,
} from "lucide-react";
import {
  monitorLabel,
  type MonitorItem,
  type MonitorState,
} from "./monitoring.js";
import "./monitoring.css";
import { TypeSafeLogo } from "./TypeSafeLogo.js";
export function MonitoringPanel({
  state,
  feedEnabled,
  halted,
  busy,
  onToggle,
  onSelect,
}: {
  state: MonitorState | null;
  feedEnabled: boolean;
  halted: boolean;
  busy: boolean;
  onToggle: () => void;
  onSelect: (token: string) => void;
}) {
  const enabled = state?.enabled && feedEnabled && !halted;
  const qualified = state?.items.filter((i) => i.admission.eligible) ?? [];
  const recent =
    state?.items.filter((i) => i.lastAssessedAt && !i.admission.eligible) ?? [];
  const cards = [
    ...qualified,
    ...recent.sort((a, b) => (b.lastAssessedAt ?? 0) - (a.lastAssessedAt ?? 0)),
  ].slice(0, 6);
  return (
    <section className="auto-monitor" aria-label="Automatic JEV monitoring">
      <div className="auto-monitor-heading">
        <div>
          <span className="auto-eyebrow">
            <TypeSafeLogo size={18} /> JEV + LIVING BRAIN · AUTO-WATCH
          </span>
          <h2>
            {!state
              ? "Connecting to the watch queue…"
              : enabled
                ? "Scouting the next runner."
                : "Automatic assessment is paused."}
          </h2>
          <p>
            GMGN graduation + liquidity + crowd activity → market data →
            JEV + memory. Automatic scouting; entries require an armed paper session.
          </p>
        </div>
        <button disabled={!state || busy} onClick={onToggle}>
          {state?.enabled ? <Pause size={15} /> : <Play size={15} />}{" "}
          {state?.enabled ? "Pause JEV monitoring" : "Resume JEV monitoring"}
        </button>
      </div>
      <p className="monitor-queue-summary">{state ? `${state.items.length} screened · ${qualified.length} pass attention gate` : "Loading attention screen…"}</p>
      {state?.error && <p className="auto-warning" role="status">{state.error}</p>}
      <details className="monitor-rulebook"><summary>Monitoring rules & limits</summary><div className="auto-thresholds">
        <span>Graduated ≤24h</span>
        <span>Liquidity ≥$10k</span>
        <span>≥25 holders</span>
        <span>5m volume ≥$1k</span>
        <span>≥10 swaps / 5m</span>
        <span>No reported hard-risk flags</span>
      </div>
      <div className="auto-monitor-meta">
        <span>
          {qualified.length} qualify for assessment ·{" "}
          {state?.items.filter((i) => i.lastAssessedAt).length ?? 0} assessed
          this session
        </span>
        <span>
          {state?.attemptsLastHour ?? 0} / 60 attempts per rolling hour · 2m
          recheck cooldown
        </span>
      </div>
      {halted && (
        <p className="auto-warning">
          Kill switch is latched. No automatic assessments will start.
        </p>
      )}
      {state && !feedEnabled && (
        <p className="auto-warning">
          Observation feed paused. Resume observation to allow automatic
          assessments.
        </p>
      )}
      {state?.error && (
        <p className="auto-warning" role="status">
          {state.error}
        </p>
      )}
      {cards.length ? (
        <div className="auto-watch-cards">
          {cards.map((i) => (
            <button key={i.token} onClick={() => onSelect(i.token)}>
              <div>
                <strong>{i.symbol}</strong>
                <ArrowRight size={14} />
              </div>
              <span>{monitorLabel(i.status)}</span>
              <small>
                {i.lastAssessedAt
                  ? `Last JEV: ${i.modelAction?.toUpperCase()} · ${new Date(i.lastAssessedAt).toLocaleTimeString()}`
                  : i.admission.eligible
                    ? "Attention gate passed; not a buy signal"
                    : "Below current thresholds"}
              </small>
            </button>
          ))}
        </div>
      ) : (
        <p className="auto-empty">
          {state?.updatedAt
            ? "No launches qualify right now. The screen updates every 30 seconds; select any launch to see the unmet checks."
            : "Waiting for fresh launch and five-minute activity data. No sample judgments are substituted."}
        </p>
      )}
      <small className="auto-footnote">
        {state?.updatedAt
          ? `Last screen ${new Date(state.updatedAt).toLocaleTimeString()}. `
          : ""}
        Experimental attention settings, not validated alpha. GMGN’s bounded
        launch/rank feeds can omit tokens; swaps are not unique buyers. $20k
        paper-entry floor and model/evidence checks remain separate. Pausing monitoring also pauses paper execution; an already-sent request may finish.
      </small>
      </details>
    </section>
  );
}
export function LaunchMonitoring({
  item,
  now,
}: {
  item?: MonitorItem;
  now: number;
}) {
  return (
    <section
      className="launch-monitoring"
      aria-label="Selected token monitoring eligibility"
    >
      <div className="launch-monitor-heading">
        <BrainCircuit size={17} />
        <strong>
          {item ? monitorLabel(item.status) : "Waiting for automatic screening"}
        </strong>
        {item?.nextAssessmentAt && item.nextAssessmentAt > now && (
          <span>
            Recheck in {Math.ceil((item.nextAssessmentAt - now) / 1000)}s
          </span>
        )}
      </div>
      <p>
        {item?.detail ??
          "This token will be screened when fresh activity data arrives. No button is required."}
      </p>
      {item?.admission.checks.length ? (
        <details>
          <summary>Why this token is—or is not—in JEV monitoring</summary>
          <div className="launch-monitor-checks">
            {item.admission.checks.map((c) => (
              <div
                key={c.label}
                className={c.pass ? "passed" : "pending"}
                title={c.detail}
              >
                {c.pass ? <Check size={14} /> : <Clock3 size={14} />}
                <span>
                  <strong>
                    {c.pass ? "Met · " : "Waiting · "}
                    {c.label}
                  </strong>
                  <small>{c.detail}</small>
                </span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
