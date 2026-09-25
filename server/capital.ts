import type { AgentState } from "../src/types.js";

// Operator-only maintenance, never invoked by model output or server startup.
export function setEmptyPaperCapital(state: AgentState, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid paper capital");
  const l = state.ledger;
  if (state.running || l.fills.length || l.positions.length || l.consumedDecisions.length ||
    l.cashUsd !== l.initialCashUsd || l.realizedPnlUsd !== 0 || Object.keys(l.dailyLoss).length)
    throw new Error("Capital adjustment requires a paused, empty paper ledger; existing history is never reset");
  l.cashUsd = amount;
  l.initialCashUsd = amount;
}
