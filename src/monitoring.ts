import type { Launch } from "./launches.js";
import type { Check } from "./types.js";

// Experimental attention thresholds, NOT execution policy or validated alpha.
export const WATCH_POLICY = Object.freeze({
  minLiquidityUsd: 10_000,
  minHolders: 25,
  minVolume5mUsd: 1_000,
  minSwaps5m: 10,
  maxGraduationAgeMs: 24 * 60 * 60_000,
  maxAgeMs: 90_000,
  reassessMs: 2 * 60_000,
  attemptsPerHour: 60,
});
export interface LaunchActivity {
  token: string;
  observedAt: number;
  volume5mUsd: number | null;
  swaps5m: number | null;
  buys5m: number | null;
  sells5m: number | null;
  riskFlags: string[];
}
export interface Admission {
  eligible: boolean;
  checks: Check[];
}
export function screenLaunch(
  l: Launch,
  activity: LaunchActivity | undefined,
  now: number,
): Admission {
  const p = WATCH_POLICY;
  const fresh = (t: number) =>
    Number.isFinite(t) && t <= now && now - t <= p.maxAgeMs;
  const atLeast = (n: number | null | undefined, floor: number) =>
    n != null && Number.isFinite(n) && n >= floor;
  const amount = (n: number | null | undefined) =>
    n == null ? "unavailable" : `$${Math.round(n).toLocaleString("en-US")}`;
  const checks: Check[] = [
    {
      label: "Graduation reported",
      pass: l.stage === "graduated_reported",
      detail:
        "We trust fresh GMGN graduation reports for Flap / Four.meme. No independent chain check.",
    },
    {
      label: "Recent graduate",
      pass:
        l.reportedGraduatedAt != null &&
        l.reportedGraduatedAt <= now &&
        now - l.reportedGraduatedAt <= p.maxGraduationAgeMs,
      detail: "Within 24 hours of provider-reported graduation.",
    },
    {
      label: "Fresh feeds",
      pass: fresh(l.observedAt) && !!activity && fresh(activity.observedAt),
      detail:
        "Launch and 5-minute activity observations must be ≤90 seconds old; absent ranking coverage is unknown, not zero.",
    },
    {
      label: "Liquidity ≥ $10k",
      pass: atLeast(l.liquidityUsd, p.minLiquidityUsd),
      detail: `${amount(l.liquidityUsd)} observed; monitoring floor only. Entry policy is separate.`,
    },
    {
      label: "Holders ≥ 25",
      pass: atLeast(l.holders, p.minHolders),
      detail: `${l.holders ?? "Unknown"} holders; holder count does not establish independent buyers.`,
    },
    {
      label: "5m volume ≥ $1k",
      pass: atLeast(activity?.volume5mUsd, p.minVolume5mUsd),
      detail: `${amount(activity?.volume5mUsd)} / 5m, GMGN token-wide activity.`,
    },
    {
      label: "5m swaps ≥ 10",
      pass: atLeast(activity?.swaps5m, p.minSwaps5m),
      detail: `${activity?.swaps5m ?? "Unknown"} swaps / 5m; trades, not unique wallets.`,
    },
    {
      label: "No reported hard risk",
      pass: !l.riskFlags.length && !!activity && !activity.riskFlags.length,
      detail:
        [...l.riskFlags, ...(activity?.riskFlags ?? [])].join(" · ") ||
        "GMGN-reported flags only; no separate token scan. Absence of flags is not a safety clearance.",
    },
  ];
  return { eligible: checks.every((c) => c.pass), checks };
}
export interface MonitorTrigger {
  kind: "auto-monitor";
  admittedAt: number;
  checkedAt: number;
  reason: string;
  activity: LaunchActivity;
  admission: Admission;
  disclaimer: string;
}
export interface MonitorItem {
  activity?: LaunchActivity;
  token: string;
  symbol: string;
  admission: Admission;
  status:
    | "screening"
    | "queued"
    | "verifying"
    | "assessing"
    | "monitoring"
    | "blocked"
    | "error";
  detail: string;
  admittedAt?: number;
  lastAttemptAt?: number;
  nextAssessmentAt?: number;
  decisionId?: string;
  lastAssessedAt?: number;
  modelAction?: "buy" | "sell" | "hold";
}
export interface MonitorState {
  enabled: boolean;
  busy: boolean;
  updatedAt: number | null;
  error: string | null;
  items: MonitorItem[];
  attemptsLastHour: number;
  policy: typeof WATCH_POLICY;
}
export const monitorLabel = (s: MonitorItem["status"]) =>
  ({
    screening: "Watching thresholds",
    queued: "Queued for JEV",
    verifying: "Resolving market data",
    assessing: "JEV + memory assessing",
    monitoring: "In JEV monitoring",
    blocked: "Evidence blocked",
    error: "Provider unavailable",
  })[s];
