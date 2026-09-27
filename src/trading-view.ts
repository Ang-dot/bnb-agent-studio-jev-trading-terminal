import type { MonitorState } from "./monitoring.js";
import type { Decision, TerminalState } from "./types.js";
import type { Launch } from "./launches.js";

export function tokenForDecision(d: Decision, pools: TerminalState["pools"]) {
  return (d.snapshot?.token || d.research?.token || pools.find(p => p.address.toLowerCase() === d.pool.toLowerCase())?.token)?.toLowerCase() ?? null;
}
export function decisionAction(d: Decision): { label: string; tone: string; source: string } {
  if (d.ruleExit) return { label: d.fill?.fraction && d.fill.fraction < 1 ? `TRIM ${Math.round(d.fill.fraction * 100)}%` : "EXIT", tone: "sell", source: "Code exit" };
  if (!d.judgment) return { label: "SKIPPED", tone: "neutral", source: "Evaluation" };
  const action = d.judgment.action;
  return { label: action === "buy" ? (d.snapshot?.position ? "ADD" : "ENTER") : action === "sell" ? "EXIT" : "HOLD", tone: action, source: "JEV" };
}
export function currentActivity(state: TerminalState | null, monitor: MonitorState | null, now: number) {
  if (!state) return { title: "Connecting to terminal", detail: "Loading the current paper session", active: false };
  if (state.halted) return { title: "Safety lock active", detail: "Execution is disabled", active: false };
  if (state.workerActive === false) return { title: "Worker inactive for this edition", detail: "Recorded history remains available", active: false };
  if (!state.running) return { title: "Paper session not armed", detail: "Launch discovery remains available", active: false };
  const working = monitor?.items.find(i => i.status === "assessing" || i.status === "verifying");
  if (state.busy || monitor?.busy) return { title: working ? `Assessing ${working.symbol}` : "Assessing market context", detail: working?.detail || "An evaluation is in progress", active: true };
  const d = state.decisions.find(d => d.judgment);
  if (d && now >= d.time && now - d.time < 30_000) return { title: `JEV selected ${decisionAction(d).label}`, detail: `${d.name} · ${d.status === "executed" ? "Paper fill recorded" : "No fill"}`, active: false };
  return { title: "Watching graduates", detail: "Waiting for the next qualifying assessment", active: false };
}
export function memoryPhases(d?: Decision) {
  const recall = !d ? "not reached" : d.memories.length ? "retrieved" : /cold start/i.test(d.memoryStatus) ? "cold start" : /fail|unavailable|error/i.test(d.memoryStatus) ? "unavailable" : d.judgment ? "no matches" : "not reached";
  const raw = d?.memoryCapture?.toLowerCase() || "";
  const capture = /fail|error/.test(raw) ? "failed" : /completed/.test(raw) ? "completed" : /compiling/.test(raw) ? "compiling" : raw ? "queued" : d?.status === "executed" ? "not recorded" : d ? "no fill to capture" : "not reached";
  return { recall, capture, assessed: !!d?.judgment };
}
function holdSignature(d: Decision) {
  if (d.judgment?.action !== "hold" || d.status === "executed" || d.ruleExit) return null;
  return JSON.stringify([d.pool, d.status, d.reasons, d.memoryStatus, d.memoryCapture, d.memories.map(m => [m.pageId, m.status]), d.judgment.assessments?.map(a => [a.id, a.value, a.referenceId]), d.checks.filter(c => !c.pass).map(c => c.label)]);
}
export function groupDecisions(decisions: Decision[]) {
  const groups: { id: string; records: Decision[] }[] = [];
  for (const d of [...decisions].sort((a,b) => b.time - a.time)) {
    const last = groups.at(-1), signature = holdSignature(d);
    if (last && signature && holdSignature(last.records[0]) === signature) last.records.push(d);
    else groups.push({ id: d.id, records: [d] });
  }
  return groups;
}
export function elapsed(at: number | null | undefined, now: number) {
  if (at == null || !Number.isFinite(at)) return "—";
  const s = Math.max(0, Math.floor((now - at) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`;
}
// Every assessment remains in the stream; the chart highlights fills plus one focal record.
export function chartRecords(decisions: Decision[], selectedId?: string) {
  const latest = [...decisions].sort((a,b) => b.time - a.time).find(d => d.judgment);
  const focalId = selectedId || latest?.id;
  return decisions.filter(d => d.status === "executed" || d.id === focalId);
}
export function recentlyAssessedToken(decisions: Decision[], pools: TerminalState["pools"], launches: Launch[], now: number) {
  for (const d of [...decisions].sort((a,b) => b.time - a.time)) {
    if (!d.judgment || now < d.time || now - d.time > 3_600_000) continue;
    const token = tokenForDecision(d, pools);
    if (token && launches.some(l => l.address.toLowerCase() === token && now >= l.observedAt && now - l.observedAt <= 90_000)) return token;
  }
  return null;
}
export function xRecoveredAt(d: Decision, decisions: Decision[]): number | null {
  if (d.status !== "not_evaluated" || !d.reasons.some(r => /X search|Grok \/ X|X evidence/.test(r))) return null;
  const later = decisions.filter(next => next.pool === d.pool && next.time > d.time &&
    next.research && ["ready", "no_results"].includes(next.research.status) && next.research.collectedAt > d.time &&
    (!d.research || next.research.token === d.research.token)).sort((a,b) => a.time - b.time);
  return later[0]?.research?.collectedAt ?? null;
}
