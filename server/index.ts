import express from "express";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import { SqliteStore, TiDBStore } from "./store.js";
import { Providers } from "./providers.js";
import { Engine, liveBlockers } from "./engine.js";
import { inspectChain, LockedLiveExecutor } from "./bnb.js";
import { LaunchFeed } from "./launch-feed.js";
import { GraduationVerifier, readGraduation } from "./graduation.js";
import { ReplayService, REPLAY_QUESTIONS, judgeReplay } from "./replay.js";
import { MonitorService } from "./monitor.js";
import { randomUUID } from "node:crypto";
import { paperControl } from "./control.js";
import { EvidenceArchive, EvidenceCollector } from "./enrichment.js";
import { MemoryLoop } from './memory-loop.js';

const port = z.coerce
  .number()
  .int()
  .min(1024)
  .max(65535)
  .parse(process.env.PORT || 8787);
const store = process.env.TIDB_DATABASE_URL
  ? await new TiDBStore(process.env.TIDB_DATABASE_URL).init()
  : new SqliteStore();
// Always boot paused; deployment/restart is never authorization to resume trading.
await store.mutate((s) => {
  s.running = false;
});
const providers = new Providers();
const evidenceArchive = new EvidenceArchive();
const evidenceCollector = new EvidenceCollector(evidenceArchive);
const learning = new MemoryLoop(store, providers);
const engine = new Engine(store, providers, (token, at) => evidenceArchive.latest(token, at), learning);
const launches = new LaunchFeed();
const graduations = new GraduationVerifier(launch =>
  readGraduation(launch, token => providers.poolForToken(token)),
);
const replays = await new ReplayService(launches, graduations, (input) =>
  providers.track("Jev", () => judgeReplay(input)),
).init();
const monitor = await new MonitorService({
  feed: () => launches.state,
  activity: () => launches.activity(),
  verify: (launch) => graduations.verify(launch, true),
  available: async () =>
    !engine.busy &&
    !(await store.read()).halted &&
    replays.run?.status !== "running",
  assess: async (launch, verification, context, active) => {
    // This callback is reached only after monitoring qualification. Fetch in the
    // background, never wait for enrichment before a decision or an exit.
    void evidenceCollector.refresh(launch.address);
    const pool = await providers.pool(verification.pool!);
    if (pool.token.toLowerCase() !== launch.address || !active())
      throw new Error("Monitoring evidence unavailable");
    if (!engine.pools.some((p) => p.address === pool.address))
      engine.pools.push(pool);
    await learning.observe(pool, context).catch(()=>{});
    // Only the background monitor may request paper execution. Manual inspection remains read-only.
    return (await engine.cycle(pool.address, { context, active, paper:true }))[0];
  },
}).init();
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use((req, res, next) => {
  // Local-only first slice. Do not expose behind a public proxy without operator authentication.
  const host = req.headers.host;
  if (![`localhost:${port}`, `127.0.0.1:${port}`].includes(host ?? ""))
    return res.status(403).json({ error: "Unrecognized host" });
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD"].includes(req.method)) {
    if (req.headers.origin !== `http://${host}` || !req.is("application/json"))
      return res
        .status(403)
        .json({ error: "Same-origin JSON request required" });
  }
  next();
});
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, mode: "paper", liveExecution: false }),
);
app.get("/api/state", async (_req, res) => res.json(await engine.state()));
app.get("/api/launches", (_req, res) => res.json(launches.state));
app.get("/api/monitor", (_req, res) => res.json(monitor.state));
app.get("/api/evidence/:token", (req, res) => {
  const token = z.string().regex(/^0x[0-9a-fA-F]{40}$/).parse(req.params.token).toLowerCase();
  // Read archived observations only: opening an unqualified launch never starts paid queries.
  res.json({ evidence: evidenceArchive.latest(token, Date.now(), 86400000) ?? null });
});
app.post("/api/monitor/control", async (req, res) => {
  const { enabled } = z
    .object({ enabled: z.boolean() })
    .strict()
    .parse(req.body);
  await monitor.setEnabled(enabled);
  if(!enabled) await store.mutate(s=>{s.running=false;});
  if (enabled) void monitor.tick();
  res.json(monitor.state);
});
app.get("/api/replays", (_req, res) =>
  res.json({ run: replays.run, questions: REPLAY_QUESTIONS }),
);
app.post("/api/replays", (req, res) => {
  z.object({}).strict().parse(req.body);
  res.status(202).json({ run: replays.start() });
});
app.post("/api/launches/control", async (req, res) => {
  launches.state.enabled = z
    .object({ enabled: z.boolean() })
    .parse(req.body).enabled;
  if(!launches.state.enabled) await store.mutate(s=>{s.running=false;});
  if (launches.state.enabled) void launches.refresh();
  res.json({ enabled: launches.state.enabled });
});
const launchFor = (token: string) =>
  launches.state.launches.find((l) => l.address === token.toLowerCase());
app.get("/api/launches/:token/candles", async (req, res) => {
  const launch = launchFor(req.params.token);
  if (!launch)
    return res.status(404).json({ error: "Token is not in launch discovery" });
  const interval = z.enum(["1", "5", "15"]).parse(req.query.interval || "5");
  try {
    res.json({
      candles: await launches.candles(launch.address, interval),
      source: "GMGN",
      scope: "Token-wide; not a verified execution-pool price",
    });
  } catch {
    res.status(503).json({
      error: "GMGN chart unavailable. No generated candles are substituted.",
    });
  }
});
app.get("/api/launches/:token/verification", async (req, res) => {
  const launch = launchFor(req.params.token);
  if (!launch)
    return res.status(404).json({ error: "Token is not in launch discovery" });
  res.json(await graduations.verify(launch));
});
app.post("/api/launches/:token/inspect", async (req, res) => {
  const launch = launchFor(req.params.token);
  if (!launch)
    return res.status(404).json({ error: "Token is not in launch discovery" });
  const verification = await graduations.verify(launch, true);
  if (verification.status !== "gmgn_reported" || !verification.pool)
    return res.status(409).json({
      error: "Fresh GMGN graduation and a matching market pool are required before assessment.",
    });
  try {
    const pool = await providers.pool(verification.pool);
    if (pool.token.toLowerCase() !== launch.address)
      return res.status(409).json({
        error:
          "Market provider token identity did not match the GMGN launch.",
      });
    if (!engine.pools.some((p) => p.address === pool.address))
      engine.pools.push(pool);
    // Manual inspection is an existing, non-executing engine path. No automatic approval.
    await engine.cycle(pool.address);
    res.json({ ok: true, inspectionOnly: true });
  } catch {
    res.status(503).json({
      error: "Assessment unavailable or already busy. No trade was placed.",
    });
  }
});
app.get("/api/candles/:pool", async (req, res) => {
  const pool = z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .parse(req.params.pool)
    .toLowerCase();
  if (!engine.pools.some((p) => p.address === pool))
    return res.status(404).json({ error: "Pool is not in discovery" });
  const interval = z.enum(["1", "5", "15"]).parse(req.query.interval || "5");
  try {
    res.json({
      candles: await providers.candles(pool, interval),
      source: "GeckoTerminal",
      pool,
      interval,
    });
  } catch {
    res.status(503).json({
      error:
        "Chart provider unavailable. No generated candles are substituted.",
    });
  }
});
app.post("/api/approve", async (req, res) => {
  const { pool, approved } = z
    .object({
      pool: z.string().regex(/^0x[0-9a-f]{40}$/),
      approved: z.boolean(),
    })
    .parse(req.body);
  if (!engine.pools.some((p) => p.address === pool))
    return res.status(404).json({ error: "Unknown pool" });
  await store.mutate((s) => {
    if (s.running)
      throw new Error("Pause the paper loop before changing its watchlist");
    if (!approved && s.ledger.positions.some((p) => p.pool === pool))
      throw new Error("Cannot remove a pool with an open position");
    if (approved && !s.approvedPools.includes(pool)) {
      if (s.approvedPools.length >= 5)
        throw new Error("Maximum five approved pools");
      s.approvedPools.push(pool);
    }
    if (!approved) s.approvedPools = s.approvedPools.filter((p) => p !== pool);
  });
  res.json({ ok: true });
});
app.post("/api/control", async (req, res) => {
  const { action } = z
    .object({ action: z.enum(["start", "pause", "stop", "reset_stop"]) })
    .parse(req.body);
  await store.mutate(s=>paperControl(s,action,monitor.state.enabled&&launches.state.enabled,randomUUID()));
  if(action==="start") void monitor.tick();
  res.json({ ok: true });
});
app.post("/api/evaluate", async (req, res) => {
  const { pool } = z
    .object({ pool: z.string().regex(/^0x[0-9a-f]{40}$/) })
    .parse(req.body);
  await engine.cycle(pool);
  res.json({ ok: true });
});
app.post("/api/mode", async (req, res) => {
  z.object({ mode: z.enum(["paper", "live"]) }).parse(req.body);
  if (req.body.mode === "live") {
    try {
      await new LockedLiveExecutor().execute();
    } catch {
      return res.status(409).json({
        error: "Live mode is locked in this first slice.",
        blockers: liveBlockers,
      });
    }
  }
  res.json({ mode: "paper" });
});
app.post("/api/chain-check", async (_req, res) => {
  try {
    res.json(await providers.track("NodeReal", inspectChain));
  } catch {
    res
      .status(503)
      .json({ error: "NodeReal read-only check failed or is not configured" });
  }
});
app.post("/api/connections/check", async (_req, res) => {
  // Explicit connection check only. No brain captures, orders, approvals, or start/resume.
  await engine.discover();
  const pool = engine.pools[0];
  await Promise.allSettled([
    providers.verifyJevAccess(),
    providers.track("NodeReal", inspectChain),
    ...(pool
      ? [
          providers.snapshot(pool),
          providers.memories(pool),
          providers.research(pool),
        ]
      : []),
  ]);
  res.json({ providers: [...providers.statuses.values()] });
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Unknown API route" }),
);
if (
  process.env.NODE_ENV !== "development" &&
  existsSync(resolve("dist/index.html"))
) {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof z.ZodError)
      return res
        .status(400)
        .json({ error: "Invalid request or provider response" });
    const safe = [
      "Pause the paper loop before changing its watchlist",
      "Cannot remove a pool with an open position",
      "Maximum five approved pools",
      "Reset the stop latch first",
      "Approve at least one paper pool",
      "Configure and verify required providers first",
      "A decision cycle is already running",
      "Select a pool before evaluating",
      "Kill switch is latched",
      "Resume launch observation and JEV monitoring first",
    ];
    const message = error instanceof Error ? error.message : "";
    res.status(409).json({
      error: safe.includes(message)
        ? message
        : "Operation failed safely; no real transaction was sent.",
    });
  },
);
const server = app.listen(port, "127.0.0.1", () =>
  console.log(`JEV terminal: http://localhost:${port} · PAPER ONLY`),
);
void engine.discover();
void launches.refresh().then(() => monitor.tick());
const launchTimer = setInterval(
  () => void launches.refresh().then(() => monitor.tick()),
  30000,
);
const timer = setInterval(async () => {
  try {
    await engine.discover();
    const state = await store.read();
    // Entries come ONLY from fresh launch admission; existing inventory gets separate JEV review.
    if (state.running && !state.halted && !engine.busy && state.ledger.positions.length) await engine.cycle(undefined,undefined,true);
  } catch {
    await store.mutate((s) => {
      s.running = false;
    });
  }
}, 60000);
const exitTimer = setInterval(()=>void engine.checkExits(),15000);
const memoryTimer = setInterval(()=>void learning.tick().catch(()=>{}),10000);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    clearInterval(timer);
    clearInterval(exitTimer);
    clearInterval(memoryTimer);
    clearInterval(launchTimer);
    server.close(() => {
      evidenceArchive.close();
      void store.close();
      process.exit(0);
    });
  });
