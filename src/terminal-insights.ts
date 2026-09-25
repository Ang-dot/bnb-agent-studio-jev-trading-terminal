import type { Launch } from "./launches.js";
import type { MonitorItem } from "./monitoring.js";
import type { Candle, Decision, Ledger } from "./types.js";

export function paperPerformance(ledger: Ledger, launches: Launch[], now: number) {
  let markedValue = 0, basis = 0, unmarked = 0;
  for (const p of ledger.positions) {
    const l = launches.find(l => l.address.toLowerCase() === p.token.toLowerCase());
    if (!l || now < l.observedAt || now - l.observedAt > 90_000 || l.priceUsd == null || !Number.isFinite(l.priceUsd) || l.priceUsd <= 0) { unmarked++; continue; }
    markedValue += p.quantity * l.priceUsd;
    basis += p.costUsd;
  }
  const exits = ledger.fills.filter(f => f.side === "sell");
  return {
    equity: unmarked ? null : ledger.cashUsd + markedValue,
    unrealized: unmarked ? null : markedValue - basis,
    realized: ledger.realizedPnlUsd,
    cash: ledger.cashUsd,
    fees: ledger.fills.reduce((n, f) => n + f.feeUsd, 0),
    exits: exits.length,
    winRate: exits.length ? exits.filter(f => f.realizedPnlUsd > 0).length / exits.length * 100 : null,
    unmarked,
  };
}
export function initialFocus(launches: Launch[], items: MonitorItem[], now: number) {
  const fresh = launches.filter(l => l.observedAt <= now && now - l.observedAt <= 90_000);
  return fresh.find(l => items.some(i => i.token === l.address && i.admission.eligible))?.address
    ?? [...fresh].filter(l => l.stage === "graduated_reported").sort((a, b) => (b.reportedGraduatedAt ?? 0) - (a.reportedGraduatedAt ?? 0))[0]?.address
    ?? fresh[0]?.address ?? launches[0]?.address ?? "";
}
export function decisionMarker(d: Decision) {
  const action = d.judgment?.action;
  return {
    text: d.ruleExit ? `Paper ${d.ruleExit.replaceAll("-"," ")}` : d.status === "executed" ? `Paper ${d.action.toUpperCase()}` : action ? `JEV ${action.toUpperCase()} · no fill` : "Not evaluated",
    action: d.status === "executed" ? d.action : action ?? "hold",
  };
}
// Retrospective close-to-close observation. Never added to a model input or ledger.
export function forwardObservation(candles: Candle[], asOf: number) {
  const from = candles.find(c => (c.time + 300) * 1000 === asOf);
  const to = candles.find(c => (c.time + 300) * 1000 === asOf + 15 * 60_000);
  if (!from || !to || !Number.isFinite(from.close) || !Number.isFinite(to.close) || from.close <= 0 || to.close <= 0) return null;
  return { returnPct: (to.close / from.close - 1) * 100, from: asOf, to: asOf + 15 * 60_000 };
}
