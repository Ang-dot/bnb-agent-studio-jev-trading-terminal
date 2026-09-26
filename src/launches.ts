export const platforms = ["flap", "fourmeme"] as const;
export type Platform = (typeof platforms)[number];
export type LaunchStage = "new" | "bonding" | "graduated_reported";
export interface Launch {
  id: string;
  address: string;
  platform: Platform;
  symbol: string;
  name: string;
  stage: LaunchStage;
  createdAt: number | null;
  observedAt: number;
  firstSeenAt: number;
  reportedGraduatedAt: number | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  volume24h: number | null;
  progress: number | null;
  holders: number | null;
  top10: number | null;
  logo: string | null;
  quote: string | null;
  riskFlags: string[];
}
export interface LaunchEvent {
  id: string;
  token: string;
  symbol: string;
  time: number;
  kind: "detected" | "stage";
  detail: string;
}
export interface LaunchFeedState {
  launches: Launch[];
  events: LaunchEvent[];
  enabled: boolean;
  updatedAt: number | null;
  errors: string[];
  source: "GMGN";
  pollMs: number;
  coverage: Record<Platform, LaunchCoverage>;
}
export interface LaunchCoverage {
  status: "pending" | "observed" | "empty" | "unconfirmed" | "unavailable";
  checkedAt: number | null;
  count: number | null;
}
export const coverageLabel = (status?: LaunchCoverage["status"]) =>
  ({
    pending: "Not checked",
    observed: "Rows observed",
    empty: "No rows returned",
    unconfirmed: "Coverage unconfirmed",
    unavailable: "Feed unavailable",
  })[status ?? "pending"];
export interface Graduation {
  token: string;
  // "verified" is retained only for already-saved historical replay records.
  status: "gmgn_reported" | "verified" | "bonding" | "unverified";
  source?: "GMGN";
  poolSource?: "GeckoTerminal" | "GMGN";
  checkedAt: number;
  block?: string;
  pool?: string;
  detail: string;
}
export const platformLabel = (p: Platform) =>
  ({ flap: "Flap", fourmeme: "Four.meme" })[p];
export const stageLabel = (s: LaunchStage) =>
  ({
    new: "New launch",
    bonding: "Bonding",
    graduated_reported: "Graduation reported",
  })[s];
export function selectLaunches(
  list: Launch[],
  platform: Platform | "all",
  stage: LaunchStage | "all",
  search: string,
) {
  const q = search.trim().toLowerCase();
  return list.filter(
    (l) =>
      (platform === "all" || l.platform === platform) &&
      (stage === "all" || l.stage === stage) &&
      `${l.symbol} ${l.name} ${l.address}`.toLowerCase().includes(q),
  );
}
export interface Arrivals {
  hydrated: boolean;
  seen: Set<string>;
  highlighted: Record<string, number>;
  added: string[];
}
export const emptyArrivals = (): Arrivals => ({
  hydrated: false,
  seen: new Set(),
  highlighted: {},
  added: [],
});
export function reconcileArrivals(
  previous: Arrivals,
  launches: Launch[],
  now: number,
): Arrivals {
  const seen = new Set(previous.seen);
  const highlighted = Object.fromEntries(
    Object.entries(previous.highlighted).filter(([, until]) => until > now),
  );
  const added: string[] = [];
  for (const launch of launches) {
    if (
      previous.hydrated &&
      !seen.has(launch.id) &&
      launch.createdAt !== null &&
      launch.createdAt >= now - 10 * 60_000 &&
      launch.createdAt <= now + 30_000
    ) {
      added.push(launch.id);
      highlighted[launch.id] = now + 12_000;
    }
    seen.add(launch.id);
  }
  return { hydrated: true, seen, highlighted, added };
}
