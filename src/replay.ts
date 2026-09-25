import type { Candle } from "./types.js";
import type { Graduation, Platform } from "./launches.js";

export type ReplayStance = "consider_entry" | "wait" | "avoid";
export interface ReplayInput {
  asOf: number;
  intervalMinutes: 5;
  candles: (Omit<Candle, "volume"> & { evidenceId: string })[];
  features: {
    returnPct: number;
    rangePct: number;
    bars: number;
    elapsedMinutes: number;
  };
  missing: string[];
}
export interface ReplayChoice {
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}
export interface ReplayJudgment {
  stance: ReplayChoice & { choice: ReplayStance };
  pattern: ReplayChoice;
  evidence: ReplayChoice;
  model: string;
  requestId: string;
  costUsd: number;
}
export interface ReplayPoint {
  id: string;
  input: ReplayInput;
  calledAt: number;
  judgment?: ReplayJudgment;
  error?: string;
}
export interface ReplayCoin {
  token: string;
  symbol: string;
  platform: Platform;
  reportedGraduatedAt: number;
  currentVerification: Graduation;
  sourceUrl: string;
  fetchedAt: number;
  candles: Candle[];
  points: ReplayPoint[];
}
export interface ReplayRun {
  version: "replay-v1";
  id: string;
  status: "running" | "complete" | "partial" | "error";
  startedAt: number;
  finishedAt?: number;
  coins: ReplayCoin[];
  notes: string[];
}
export const stanceLabel = (s: ReplayStance) =>
  ({
    consider_entry: "Consider entry",
    wait: "Wait",
    avoid: "Avoid",
  })[s];
