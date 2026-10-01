import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { AssessmentBlockedError } from './assessment-signal.js';
import type { JsonPersistence } from './cloud-store.js';
import type { Launch, LaunchFeedState, Graduation } from "../src/launches.js";
import type { Decision } from "../src/types.js";
import {
  WATCH_POLICY,
  screenLaunch,
  type LaunchActivity,
  type MonitorItem,
  type MonitorState,
  type MonitorTrigger,
} from "../src/monitoring.js";
export interface MonitorAssessmentGuard {
  /** Original 90-second attention checks still govern paper execution. */
  active: () => boolean;
  /** An admitted assessment can continue with observations up to five minutes old. */
  assessmentBlocker: () => string | null;
}
interface Dependencies {
  feed: () => LaunchFeedState;
  activity: () => Promise<LaunchActivity[]>;
  verify: (launch: Launch) => Promise<Graduation>;
  assess: (
    launch: Launch,
    verification: Graduation,
    trigger: MonitorTrigger,
    guard: MonitorAssessmentGuard,
  ) => Promise<Decision | undefined>;
  available: () => Promise<boolean>;
  now?: () => number;
  memoryProvider?: string;
}
export class MonitorService {
  state: MonitorState = {
    enabled: true,
    busy: false,
    updatedAt: null,
    error: null,
    items: [],
    attemptsLastHour: 0,
    policy: WATCH_POLICY,
  };
  private pending: Promise<void> | null = null;
  private attempts: number[] = [];
  private generation = 0;
  private writes: Promise<void> = Promise.resolve();
  constructor(
    private deps: Dependencies,
    private file: string | JsonPersistence | null = resolve(".data/monitor.json"),
  ) {}
  private now() {
    return (this.deps.now ?? Date.now)();
  }
  async init() {
    if (!this.file) return this;
    try {
      const raw = typeof this.file === 'string' ? await readFile(this.file, 'utf8') : await this.file.read();
      if (raw === undefined) return this;
      const saved = z
        .object({
          version: z.literal(1),
          enabled: z.boolean(),
          attempts: z.array(z.number().finite()),
          records: z.array(
            z.object({
              token: z.string(),
              lastAttemptAt: z.number().finite(),
              admittedAt: z.number().finite().optional(),
            }),
          ),
        })
        .parse(JSON.parse(raw));
      this.state.enabled = saved.enabled;
      this.attempts = saved.attempts;
      this.state.items = saved.records.map((r) => ({
        ...r,
        symbol: "",
        admission: { eligible: false, checks: [] },
        status: "screening",
        detail: "Awaiting fresh evidence after restart.",
        nextAssessmentAt: r.lastAttemptAt + WATCH_POLICY.reassessMs,
      }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.state.enabled = false;
        this.state.error =
          "Saved monitoring state unreadable; monitoring paused. No automatic calls started.";
      }
    }
    return this;
  }
  private async save() {
    if (!this.file) return;
    const file = this.file;
    const payload = JSON.stringify({
      version: 1,
      enabled: this.state.enabled,
      attempts: this.attempts,
      records: this.state.items
        .filter((i) => i.lastAttemptAt != null)
        .map(({ token, lastAttemptAt, admittedAt }) => ({
          token,
          lastAttemptAt,
          admittedAt,
        })),
    });
    this.writes = this.writes
      .catch(() => {})
      .then(async () => {
        if (typeof file !== 'string') { await file.write(payload); return; }
        await mkdir(dirname(file), { recursive: true });
        await writeFile(`${file}.tmp`, payload, { mode: 0o600 });
        await rename(`${file}.tmp`, file);
      });
    try {
      await this.writes;
    } catch {
      this.state.enabled = false;
      this.generation++;
      this.state.error =
        "Monitoring storage unavailable; automatic assessment paused.";
      throw new Error("Monitor persistence unavailable");
    }
  }
  async setEnabled(enabled: boolean) {
    this.generation++;
    this.state.enabled = enabled;
    await this.save();
  }
  tick(): Promise<void> {
    if (this.pending) return this.pending;
    this.pending = this.run()
      .catch(() => {
        this.state.error =
          "Monitoring cycle unavailable. No execution was attempted.";
      })
      .finally(() => {
        this.state.busy = false;
        this.pending = null;
      });
    return this.pending;
  }
  private async run() {
    const now = this.now();
    this.attempts = this.attempts.filter((t) => t > now - 3600000 && t <= now);
    this.state.attemptsLastHour = this.attempts.length;
    if (!this.state.enabled || !this.deps.feed().enabled) return;
    this.state.busy = true;
    const generation = this.generation;
    const active = () =>
      this.state.enabled &&
      this.deps.feed().enabled &&
      this.generation === generation;
    let activity: LaunchActivity[];
    try {
      activity = await this.deps.activity();
    } catch {
      this.state.error =
        "GMGN five-minute activity unavailable. Automatic assessment waits; no missing values are substituted.";
      this.state.items = this.state.items.map((i) => ({
        ...i,
        status: "blocked",
        detail: this.state.error!,
        admission: {
          eligible: false,
          checks: i.admission.checks.map((c) =>
            c.label === "Fresh feeds"
              ? {
                  ...c,
                  pass: false,
                  detail:
                    "Five-minute feed unavailable; previous measurements are not current.",
                }
              : c,
          ),
        },
      }));
      return;
    }
    if (!active()) return;
    this.state.error = null;
    const lookup = new Map(activity.map((a) => [a.token, a]));
    const previous = new Map(this.state.items.map((i) => [i.token, i]));
    this.state.items = this.deps
      .feed()
      .launches.slice(0, 600)
      .map((l) => {
        const prior = previous.get(l.address),
          admission = screenLaunch(l, lookup.get(l.address), this.now());
        const item: MonitorItem = {
          ...prior,
          token: l.address,
          symbol: l.symbol,
          admission,
          activity: lookup.get(l.address),
          status: "screening",
          detail:
            admission.checks.find((c) => !c.pass)?.detail ??
            "Thresholds met; awaiting fresh GMGN stage and market data.",
        };
        if (admission.eligible) {
          if ((prior?.nextAssessmentAt ?? 0) > this.now()) {
            item.status = prior?.lastAssessedAt
              ? "monitoring"
              : prior?.status === "error"
                ? "error"
                : "blocked";
            item.detail =
              prior?.detail ?? "Cooling down before another attempt.";
          } else {
            item.status = "queued";
            item.detail =
              "Thresholds met. Queued for GMGN status, market data and JEV + memory.";
          }
        }
        return item;
      });
    this.state.updatedAt = this.now();
    if (!(await this.deps.available()) || !active()) return;
    const queue = this.state.items
      .filter(
        (i) => i.admission.eligible && (i.nextAssessmentAt ?? 0) <= this.now(),
      )
      .sort((a, b) => (a.lastAttemptAt ?? 0) - (b.lastAttemptAt ?? 0));
    if (!queue.length) return;
    // One candidate per tick, FIFO by last attempt. Persist attention cooldown before paid work. JEV calls are paced at dispatch.
    const item = queue[0],
      launch = this.deps.feed().launches.find((l) => l.address === item.token)!;
    item.lastAttemptAt = this.now();
    item.nextAssessmentAt = this.now() + WATCH_POLICY.reassessMs;
    this.attempts.push(this.now());
    this.state.attemptsLastHour = this.attempts.length;
    await this.save();
    item.status = "verifying";
    item.detail =
      "Activity gate passed. Reading GMGN launch stage and resolving market data.";
    try {
      const verification = await this.deps.verify(launch);
      const current = () =>
        this.deps.feed().launches.find((l) => l.address === item.token);
      const stillEligible = () =>
        active() &&
        !!current() &&
        screenLaunch(current()!, lookup.get(item.token), this.now()).eligible;
      if (!stillEligible()) {
        item.status = "blocked";
        item.detail =
          "Paused or evidence changed/expired before assessment. Waiting for a fresh cycle.";
        return;
      }
      if (
        !["gmgn_reported", "paper_launch"].includes(verification.status) ||
        !verification.pool ||
        verification.token !== item.token ||
        verification.checkedAt > this.now() ||
        this.now() - verification.checkedAt > WATCH_POLICY.maxAgeMs
      ) {
        item.status = "blocked";
        item.detail = verification.status === "gmgn_reported" && !verification.pool
          ? "GMGN graduation accepted; matching market pool unavailable. No JEV call yet."
          : "Fresh supported launch market required; no JEV call.";
        return;
      }
      const assessmentBlocker = (): string | null => {
        if (!this.state.enabled) return "JEV assessment cancelled: monitoring was paused.";
        if (!this.deps.feed().enabled) return "JEV assessment cancelled: launch discovery was paused.";
        if (this.generation !== generation) return "JEV assessment cancelled: monitoring settings changed during assessment.";
        const latest = current();
        if (!latest) return "JEV assessment cancelled: token is no longer in the launch feed.";
        const failure = screenLaunch(latest, lookup.get(item.token), this.now(), WATCH_POLICY.assessmentMaxAgeMs)
          .checks.find(check => !check.pass);
        if (failure?.label === "Fresh feeds")
          return "JEV assessment cancelled: launch or activity evidence exceeded the 5-minute assessment window or has an invalid timestamp.";
        if (failure) return `JEV assessment cancelled: token no longer passes the ${failure.label} check.`;
        if (!Number.isFinite(verification.checkedAt) || verification.checkedAt > this.now() ||
            this.now() - verification.checkedAt > WATCH_POLICY.assessmentMaxAgeMs)
          return "JEV assessment cancelled: market verification exceeded the 5-minute assessment window or has an invalid timestamp.";
        return null;
      };
      item.admittedAt ??= this.now();
      item.status = "assessing";
      item.detail =
        `Collecting X, fresh market data and ${this.deps.memoryProvider ?? 'Living Brain'} context for JEV. Paper entry checks run separately.`;
      const trigger: MonitorTrigger = {
        kind: "auto-monitor",
        admittedAt: item.admittedAt,
        checkedAt: this.now(),
        reason:
          "Launch crossed liquidity, holder and 5-minute activity thresholds.",
        activity: lookup.get(item.token)!,
        admission: item.admission,
        disclaimer:
          "Experimental attention gate only. Token-wide swaps are not independent buyers; volume may be manipulated. Not a trade authorization.",
      };
      const decision = await this.deps.assess(
        launch,
        verification,
        trigger,
        {
          active: () => stillEligible() && this.now() - verification.checkedAt <= WATCH_POLICY.maxAgeMs,
          assessmentBlocker,
        },
      );
      if (decision?.judgment) {
        item.status = "monitoring";
        item.decisionId = decision.id;
        item.modelAction = decision.judgment.action;
        item.lastAssessedAt = decision.time;
        item.detail =
          "JEV assessment recorded. Recheck after one minute while thresholds pass. Paper fills require an armed session and separate entry checks.";
      } else {
        item.status = "blocked";
        item.detail =
          decision?.reasons.join(" · ") ||
          "No new JEV assessment: evidence unavailable, cancelled or market snapshot already assessed.";
      }
    } catch (error) {
      item.status = error instanceof AssessmentBlockedError ? "blocked" : "error";
      item.detail = error instanceof AssessmentBlockedError ? error.message :
        "A provider or assessment failed. No fabricated decision; retry after the cooldown.";
    } finally {
      await this.save();
    }
  }
}
