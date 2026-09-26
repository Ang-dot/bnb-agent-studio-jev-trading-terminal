import express from "express";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import { SqliteStore } from "./store.js";
import { Providers } from "./providers.js";
import { Engine, liveBlockers } from "./engine.js";
import { inspectChain, LockedLiveExecutor } from "./bnb.js";
import { LaunchFeed, configureGmgnRuntime } from "./launch-feed.js";
import { GraduationVerifier, readGraduation } from "./graduation.js";
import { ReplayService, REPLAY_QUESTIONS, judgeReplay } from "./replay.js";
import { MonitorService } from "./monitor.js";
import { randomUUID } from "node:crypto";
import { paperControl } from "./control.js";
import { EvidenceArchive, EvidenceCollector } from "./enrichment.js";
import { MemoryLoop } from './memory-loop.js';
import { CloudStore } from './cloud-store.js';
import { hostedSettings, cloudAccess, publicState, SharedReadCache } from './hosting.js';
import { WorkerRuntime } from './worker-runtime.js';
import { startAssessmentService } from '../app/agent/src/service.js';
import { createAssessmentWork } from '../app/agent/src/work.js';
import { assessmentFetch } from './assessment-signal.js';

const port = z.coerce
  .number()
  .int()
  .min(1024)
  .max(65535)
  .parse(process.env.PORT || 8787);
const hosting = hostedSettings(process.env);
const cloud = process.env.SUPABASE_DATABASE_URL ? await new CloudStore(process.env.SUPABASE_DATABASE_URL).init().catch(()=>{throw new Error('Cloud storage unavailable');}) : null;
const store = cloud ?? new SqliteStore();
const worker = new WorkerRuntime(cloud ? ()=>cloud.assertLease() : undefined);
const wantsWorker = !cloud || process.env.WORKER_ENABLED === 'true';
const publicReads = new SharedReadCache();
// Always boot paused; deployment/restart is never authorization to resume trading.
if (!cloud) await store.mutate((s) => {
  s.running = false;
});
const guardedFetch: typeof fetch = async (input,init) => { await worker.assertActive();return assessmentFetch(input,init); };
const providers = new Providers(process.env, guardedFetch);
const evidenceArchive = cloud ?? new EvidenceArchive();
const evidenceCollector = new EvidenceCollector(evidenceArchive);
const learning = new MemoryLoop(store, providers);
const studio = await startAssessmentService({work:createAssessmentWork({
  providers, store,
  evidence:(token,at)=>evidenceArchive.latest(token,at),
  annotate:(memories,at)=>learning.annotate(memories,at),
})});
const engine = new Engine(store, providers, studio.runner, learning);
const launches = new LaunchFeed();
const graduations = new GraduationVerifier(launch =>
  readGraduation(launch, token => providers.poolForToken(token)),
);
const replays = await new ReplayService(launches, graduations, (input) =>
  providers.track("Jev", () => judgeReplay(input, process.env, guardedFetch)), cloud?.record('replay'),
).init();
const monitor = await new MonitorService({
  feed: () => launches.state,
  activity: () => launches.activity(),
  verify: (launch) => graduations.verify(launch, true),
  available: async () =>
    worker.active &&
    !engine.busy &&
    !(await store.read()).halted &&
    replays.run?.status !== "running",
  assess: async (launch, verification, context, active) => {
    // This callback is reached only after monitoring qualification. Fetch in the
    // background, never wait for enrichment before a decision or an exit.
    void worker.run(()=>evidenceCollector.refresh(launch.address));
    const pool = await providers.pool(verification.pool!, launch.address);
    if (pool.token.toLowerCase() !== launch.address || !active())
      throw new Error("Monitoring evidence unavailable");
    if (!engine.pools.some((p) => p.address === pool.address))
      engine.pools.push(pool);
    await learning.observe(pool, context).catch(()=>{});
    // Only the background monitor may request paper execution. Manual inspection remains read-only.
    return (await engine.cycle(pool.address, { context, active, paper:true }))[0];
  },
}, cloud?.record('monitor')).init();
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
if (hosting) app.use(cloudAccess(hosting));
else app.use((req, res, next) => {
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
app.use('/api', async(req,res,next)=>{
  if (!['GET','HEAD'].includes(req.method)) {
    try {await worker.assertActive();} catch {return void res.status(503).json({error:'Worker is not active; no action was taken'});}
  }
  next();
});
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, mode: "paper", liveExecution: false, workerActive: worker.active, hosting: hosting ? 'cloud' : 'local', assessmentService:studio.info() }),
);
app.get("/api/state", async (_req, res) => {
  const state = {...await engine.state(),assessmentService:studio.info()};
  res.json(hosting && !res.locals.operator ? publicState(state) : {...state,access:{operator:true}});
});
app.get("/api/launches", (_req, res) => res.json(launches.state));
app.get("/api/monitor", (_req, res) => res.json(monitor.state));
app.get("/api/evidence/:token", async (req, res) => {
  const token = z.string().regex(/^0x[0-9a-fA-F]{40}$/).parse(req.params.token).toLowerCase();
  // Read archived observations only: opening an unqualified launch never starts paid queries.
  res.json({ evidence: await evidenceArchive.latest(token, Date.now(), 86400000) ?? null });
});
app.post("/api/monitor/control", async (req, res) => {
  const { enabled } = z
    .object({ enabled: z.boolean() })
    .strict()
    .parse(req.body);
  await monitor.setEnabled(enabled);
  if(!enabled) await store.mutate(s=>{s.running=false;});
  if (enabled) void worker.run(()=>monitor.tick());
  res.json(monitor.state);
});
app.get("/api/replays", (_req, res) =>
  res.json({ run: replays.run, questions: REPLAY_QUESTIONS, operator: !hosting || !!res.locals.operator }),
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
  if (cloud) await cloud.record('launches').write(JSON.stringify(launches.state));
  if (launches.state.enabled) void worker.run(()=>launches.refresh());
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
      candles: await publicReads.read(`gmgn:${launch.address}:${interval}`,()=>launches.candles(launch.address, interval)),
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
  res.json(await publicReads.read(`verification:${launch.address}`,()=>graduations.verify(launch)));
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
    const pool = await providers.pool(verification.pool, launch.address);
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
  const market = engine.pools.find((p) => p.address === pool);
  if (!market)
    return res.status(404).json({ error: "Pool is not in discovery" });
  const interval = z.enum(["1", "5", "15"]).parse(req.query.interval || "5");
  try {
    res.json({
      candles: await publicReads.read(`gmgn:${market.token}:${interval}`,()=>launches.tokenCandles(market.token, interval)),
      source: "GMGN",
      scope: "Token-wide; not a verified execution-pool price",
      token: market.token,
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
  if(action==="start") void worker.run(()=>monitor.tick());
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
if (hosting) app.use((_req,res)=>res.status(404).json({error:'API only'}));
else if (
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
const server = app.listen(port, hosting?.bind ?? "127.0.0.1", () =>
  console.log(`JEV terminal: http://localhost:${port} · PAPER ONLY`),
);
let closing=false, starting=false;
async function startWorker(){
  if(closing||starting||worker.active||!wantsWorker)return;
  starting=true;
  try {
    if(cloud){
      if(!await cloud.acquire())return;
      await store.mutate(s=>{s.running=false;});
      await monitor.init();await replays.init();
      const prior=await cloud.record('launches').read();
      if(prior){const saved=JSON.parse(prior);if(saved.source!=='GMGN'||!Array.isArray(saved.launches))throw new Error('Invalid saved feed');launches.state=saved;}
      await configureGmgnRuntime(cloud.record('gmgn-cooldown'),()=>worker.assertActive());
      providers.usePriceBudget(cloud.record('coingecko-usage'));
    }
    worker.enable();
    void worker.run(()=>engine.discover());
    void worker.run(async()=>{await launches.refresh();if(cloud)await cloud.record('launches').write(JSON.stringify(launches.state));await monitor.tick();});
  } catch { console.error('Worker startup unavailable; no session armed'); }
  finally {starting=false;}
}
await startWorker();
const leaseTimer=setInterval(()=>{
  if(worker.active&&cloud) void cloud.renew().catch(()=>{worker.active=false;console.error('Worker lease lost; restarting safely');process.exit(1);});
  else void startWorker();
},10000);
const launchTimer = setInterval(
  () => void worker.run(async()=>{await launches.refresh();if(cloud)await cloud.record('launches').write(JSON.stringify(launches.state));await monitor.tick();}),
  30000,
);
const timer = setInterval(() => void worker.run(async () => {
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
}), 60000);
const exitTimer = setInterval(()=>void worker.run(()=>engine.checkExits()),15000);
const memoryTimer = setInterval(()=>void worker.run(()=>learning.tick()),10000);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    closing=true;
    clearInterval(leaseTimer);
    clearInterval(timer);
    clearInterval(exitTimer);
    clearInterval(memoryTimer);
    clearInterval(launchTimer);
    // On forced termination the DB lease expires naturally; never release while work can still write.
    server.close(()=>void studio.close().then(()=>worker.drain()).then(async()=>{
      await replays.finished();
      if(cloud)await cloud.release();else (evidenceArchive as EvidenceArchive).close();
      await store.close();process.exit(0);
    }).catch(()=>process.exit(1)));
  });
