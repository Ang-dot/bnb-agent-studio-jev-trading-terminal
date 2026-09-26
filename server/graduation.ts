import type { Graduation, Launch } from "../src/launches.js";
type PoolResolver = (token: string) => Promise<{ address: string; token: string }>;

// GMGN is the operator-selected authority for launch stage. Resolving a price
// pool is a separate market-data concern, not independent migration proof.
export async function readGraduation(
  launch: Launch,
  resolvePool?: PoolResolver,
  now = Date.now,
): Promise<Graduation> {
  const base = { token: launch.address, checkedAt: launch.observedAt, source: "GMGN" as const };
  const fresh = () => Number.isFinite(launch.observedAt) && launch.observedAt <= now() && now() - launch.observedAt <= 90_000;
  if (launch.platform !== "flap" && launch.platform !== "fourmeme")
    return { ...base, status: "unverified", detail: "Unsupported launchpad. Flap and Four.meme only." };
  if (!fresh())
    return { ...base, status: "unverified", detail: "GMGN observation is stale or unavailable. Await a fresh report." };
  if (launch.stage !== "graduated_reported")
    return { ...base, status: launch.stage === "bonding" ? "bonding" : "unverified", detail: "GMGN has not reported graduation. Observe only; no pre-graduation entry." };
  let pool: string | undefined;
  try {
    const candidate = await resolvePool?.(launch.address);
    if (candidate && candidate.token.toLowerCase() === launch.address.toLowerCase() &&
      /^0x[0-9a-fA-F]{40}$/.test(candidate.address) &&
      !/^0x0{40}$/i.test(candidate.address) &&
      candidate.address.toLowerCase() !== launch.address.toLowerCase()) pool = candidate.address.toLowerCase();
  } catch { /* Missing market data must not revoke or embellish GMGN's report. */ }
  if (!fresh())
    return { ...base, status: "unverified", detail: "GMGN observation expired while resolving market data. Await a fresh report." };
  return { ...base, status: "gmgn_reported", pool, poolSource: pool ? "GMGN" : undefined,
    detail: pool
      ? "GMGN reports graduation and supplies a matching market pool; no independent on-chain migration check. Not a safety verdict or permission to buy."
      : "GMGN reports graduation; matching market pool unavailable. Graduation is accepted, but assessment still needs market data." };
}
export class GraduationVerifier {
  private cache = new Map<string, Graduation>();
  private pending = new Map<string, Promise<Graduation>>();
  constructor(private read: (launch: Launch) => Promise<Graduation> = readGraduation) {}
  async verify(launch: Launch, force = false) {
    const key = `${launch.id}:${launch.stage}:${launch.observedAt}`;
    const prior = this.cache.get(key);
    if (!force && prior && Date.now() - prior.checkedAt < 30000) return prior;
    const pending = this.pending.get(key);
    if (pending) return pending;
    const task = this.read(launch).then(result => {
      if (this.cache.size >= 600) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, result);
      return result;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, task);
    return task;
  }
}
