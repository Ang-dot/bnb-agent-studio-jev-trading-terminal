import { describe, it, expect, vi } from "vitest";
import { Engine } from "./engine.js";
import { Providers } from "./providers.js";
import { SqliteStore } from "./store.js";
import type { Pool, Snapshot, Judgment, XResearch } from "../src/types.js";
const pool: Pool = {
  address: "0x" + "1".repeat(40),
  token: "0x" + "2".repeat(40),
  name: "FIXTURE / WBNB",
  symbol: "FIXTURE",
  dex: "pancakeswap_v2",
  priceUsd: 1,
  liquidityUsd: 200000,
  volume24h: 900000,
  change1h: 5,
  change24h: 6,
  buys: 100,
  sells: 20,
  discoveredAt: Date.now(),
  url: "https://example.invalid",
};
const judgment: Judgment = {
  action: "buy",
  confidence: 0.9,
  quality: 2.8,
  toxic: 0.05,
  probabilities: { buy: 0.9, sell: 0.05, hold: 0.05 },
  model: "fixture",
  requestId: "fixture",
  costUsd: 0,
};
function setup() {
  const store = new SqliteStore(":memory:");
  const providers = new Providers({});
  for (const name of ["Jev", "Living Brain", "Bitquery", "Grok / X"])
    providers.statuses.set(name, {
      name,
      state: "ready",
      detail: "Test double",
    });
  const snapshot: Snapshot = {
    pool: pool.address,
    token: pool.token,
    name: pool.name,
    priceUsd: 1,
    liquidityUsd: pool.liquidityUsd,
    volume24h: pool.volume24h,
    change1h: pool.change1h,
    buyCount: 100,
    sellCount: 20,
    observedAt: Date.now(),
    marketAt: Date.now() - 1000,
    source: "bitquery",
    candleId: "fixture-candle",
  };
  vi.spyOn(providers, "pool").mockResolvedValue(pool);
  const research: XResearch = {
    token: pool.token,
    status: "ready",
    detail: "Fixture",
    model: "fixture",
    window: { from: Date.now() - 86400000, to: Date.now() },
    collectedAt: Date.now(),
    expiresAt: Date.now() + 300000,
    searchCalls: 1,
    rejectedCount: 0,
    sources: [
      {
        url: "https://x.com/fixture/status/2103362829185974272",
        postId: "2103362829185974272",
        handle: "fixture",
        publishedAt: Date.now() - 1000,
        timestampSource: "post-id",
        summary: "Fixture claim, unverified",
        identityExcerpt: pool.token,
      },
    ],
  };
  vi.spyOn(providers, "research").mockResolvedValue(research);
  vi.spyOn(providers, "snapshot").mockResolvedValue(snapshot);
  vi.spyOn(providers, "memories").mockResolvedValue([]);
  const retiredSecurity = vi.fn(async () => { throw new Error("Retired scanner must never run"); });
  Object.assign(providers, { security: retiredSecurity });
  vi.spyOn(providers, "judge").mockResolvedValue(judgment);
  vi.spyOn(providers, "capture").mockResolvedValue("pending · fixture");
  const engine = new Engine(store, providers);
  engine.pools = [pool];
  return { engine, store, providers, research, retiredSecurity };
}
describe("autonomous paper loop with mocked providers", () => {
  it('restores held pool/token identities from the ledger after restart without trending discovery', async () => {
    const {engine,store,providers}=setup(); engine.pools=[];
    await store.mutate(s=>{s.ledger.positions=[{pool:pool.address,token:pool.token,name:pool.name,quantity:1,costUsd:1} as any];});
    await engine.discover();
    expect(providers.pool).toHaveBeenCalledWith(pool.address,pool.token);
    expect(engine.pools).toEqual([pool]); store.close();
  });
  it("preserves an X provider failure even when the slow search also expired monitoring", async () => {
    const {engine,store,providers,research}=setup(); let active=true;
    vi.mocked(providers.research).mockImplementation(async()=>{active=false;return {...research,status:"error",detail:"X search response failed evidence validation."};});
    await engine.cycle(pool.address,{context:{kind:"auto-monitor"} as any,active:()=>active,paper:true});
    expect((await store.read()).decisions[0].reasons[0]).toContain("X search response failed");
    expect(providers.judge).not.toHaveBeenCalled();
    store.close();
  });
  it("pins available shadow evidence without exposing it to the trading model", async () => {
    const {store,providers}=setup();
    const evidence = {token:pool.token,mode:"shadow",startedAt:Date.now()-1000,completedAt:Date.now()-500} as any;
    const engine = new Engine(store,providers,()=>evidence); engine.pools=[pool];
    await engine.cycle(pool.address);
    const d=(await store.read()).decisions[0];
    expect(d.supportingEvidence).toEqual(evidence);
    expect(providers.judge).toHaveBeenCalledWith(expect.not.objectContaining({supportingEvidence:expect.anything()}),[],expect.anything());
    expect(providers.judge).toHaveBeenCalledTimes(1);
    expect((await store.read()).ledger.fills).toHaveLength(0);
    store.close();
  });
  it("does not attach future observations to a past decision", async () => {
    const {store,providers}=setup();
    const engine=new Engine(store,providers,()=>({token:pool.token,startedAt:Date.now(),completedAt:Date.now()+60000}) as any); engine.pools=[pool];
    await engine.cycle(pool.address);
    expect((await store.read()).decisions[0].supportingEvidence).toBeUndefined();
    store.close();
  });
  it("executes a qualified launch only with explicit paper authorization", async()=>{
    const {engine,store}=setup();
    await store.mutate(s=>{s.running=true;});
    await engine.cycle(pool.address,{context:{kind:"auto-monitor"} as any,active:()=>true,paper:true});
    expect((await store.read()).ledger.fills).toHaveLength(1);
    expect((await store.read()).approvedPools).toEqual([]);
    store.close();
  });
  it("runs a rule-based stop without JEV, X or memory and labels it honestly",async()=>{
    const {engine,store,providers}=setup();
    await store.mutate(s=>{s.running=true;s.ledger.positions=[{pool:pool.address,token:pool.token,name:pool.name,quantity:100,costUsd:150,openedAt:1}];});
    providers.statuses.set("Jev",{name:"Jev",state:"missing",detail:"Offline"});
    await engine.checkExits();
    expect(providers.judge).not.toHaveBeenCalled();
    expect(providers.research).not.toHaveBeenCalled();
    const s=await store.read();
    expect(s.ledger.positions).toHaveLength(0);
    expect(s.decisions[0]).toMatchObject({ruleExit:"stop-loss",status:"executed",action:"sell"});
    expect(s.decisions[0].judgment).toBeUndefined();
    store.close();
  });
  it("names a failed provider without exposing its raw error",async()=>{
    const {engine,store,providers}=setup();
    vi.mocked(providers.memories).mockRejectedValue(new Error("secret credential failure"));
    await engine.cycle(pool.address);
    expect((await store.read()).decisions[0].reasons[0]).toContain("Living Brain");
    expect((await store.read()).decisions[0].reasons[0]).not.toContain("secret");
    store.close();
  });
  it("cannot execute when attention expires while JEV is running",async()=>{
    const {engine,store,providers}=setup();let active=true;
    await store.mutate(s=>{s.running=true;});
    vi.mocked(providers.judge).mockImplementation(async()=>{active=false;return judgment;});
    await engine.cycle(pool.address,{context:{kind:"auto-monitor"} as any,active:()=>active,paper:true});
    expect((await store.read()).ledger.fills).toHaveLength(0);store.close();
  });
  it("a pause/rearm during inference invalidates the older session",async()=>{
    const {engine,store,providers}=setup();
    await store.mutate(s=>{s.running=true;s.paperSession="old";});
    vi.mocked(providers.judge).mockImplementation(async()=>{await store.mutate(s=>{s.paperSession="new";});return judgment;});
    await engine.cycle(pool.address,{context:{kind:"auto-monitor"} as any,active:()=>true,paper:true});
    expect((await store.read()).ledger.fills).toHaveLength(0);store.close();
  });
  it("a stop during the exit-price request prevents a simulated sell",async()=>{
    const {engine,store,providers}=setup();
    await store.mutate(s=>{s.running=true;s.ledger.positions=[{pool:pool.address,token:pool.token,name:pool.name,quantity:100,costUsd:150,openedAt:1}];});
    const original=await providers.snapshot(pool);
    vi.mocked(providers.snapshot).mockImplementation(async()=>{await store.mutate(s=>{s.halted=true;s.running=false;});return original;});
    await engine.checkExits();expect((await store.read()).ledger.fills).toHaveLength(0);store.close();
  });
  it("automatic monitoring records its trigger and never trades or captures memory", async () => {
    const { engine, store, providers } = setup();
    await store.mutate((s) => {
      s.running = true;
      s.approvedPools = [pool.address];
    });
    const context = {
      kind: "auto-monitor",
      reason: "Activity threshold crossed",
    } as any;
    const results = await engine.cycle(pool.address, {
      context,
      active: () => true,
    });
    expect(results[0]?.snapshot?.monitoring).toEqual(context);
    expect(providers.judge).toHaveBeenCalledWith(
      expect.objectContaining({ monitoring: context }),
      [],
      expect.anything(),
    );
    expect((await store.read()).ledger.fills).toHaveLength(0);
    expect(providers.capture).not.toHaveBeenCalled();
    store.close();
  });
  it("a monitoring pause during research prevents the next model call", async () => {
    const { engine, store, providers, research } = setup();
    let active = true;
    vi.mocked(providers.research).mockImplementation(async () => {
      active = false;
      return research;
    });
    await engine.cycle(pool.address, {
      context: { kind: "auto-monitor" } as any,
      active: () => active,
    });
    expect(providers.judge).not.toHaveBeenCalled();
    expect((await store.read()).ledger.fills).toHaveLength(0);
    store.close();
  });
  it.each(["missing", "error"] as const)("GoPlus %s no longer blocks JEV or invokes a token scan", async state => {
    const { engine, store, providers, retiredSecurity } = setup();
    providers.statuses.set("GoPlus", { name: "GoPlus", state, detail: "Legacy status" });
    await engine.cycle(pool.address, {
      context: { kind: "auto-monitor" } as any,
      active: () => true,
    });
    expect(providers.judge).toHaveBeenCalledTimes(1);
    expect(retiredSecurity).not.toHaveBeenCalled();
    expect((await store.read()).decisions[0].checks.some(c => c.label === "Token security")).toBe(false);
    expect((await store.read()).ledger.fills).toHaveLength(0);
    store.close();
  });
  it("refreshes the market after X research and stores exactly the research supplied to Jev", async () => {
    const { engine, store, providers, research } = setup();
    await engine.cycle(pool.address);
    expect(providers.research).toHaveBeenCalledWith(pool);
    expect(
      vi.mocked(providers.research).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(providers.snapshot).mock.invocationCallOrder[0]);
    expect(providers.judge).toHaveBeenCalledWith(
      expect.objectContaining({ token: pool.token }),
      [],
      research,
    );
    expect((await store.read()).decisions[0].research).toEqual(research);
    expect((await store.read()).decisions[0].executionContext).toEqual({
      inspectionOnly: true,
      running: false,
      halted: false,
    });
    store.close();
  });
  it("persists source assessments without turning informational answers into execution rules", async () => {
    const { engine, store, providers } = setup();
    const assessed: Judgment = {
      ...judgment,
      assessmentVersion: "evidence-v1",
      assessmentIssues: [],
      assessments: [
        {
          id: "evidence_support",
          label: "Entry evidence",
          kind: "context",
          evidenceIds: ["market", "X1"],
          question: "Fixture question",
          value: "insufficient",
          valueLabel: "Insufficient support",
          confidence: 1,
          probabilities: { insufficient: 1 },
          options: { insufficient: "Insufficient support" },
          criteria: { insufficient: "Fixture" },
        },
      ],
    };
    vi.mocked(providers.judge).mockResolvedValue(assessed);
    await store.mutate((s) => {
      s.running = true;
      s.approvedPools = [pool.address];
    });
    await engine.cycle();
    const state = await store.read();
    expect(state.decisions[0].judgment).toEqual(assessed);
    expect(state.decisions[0].executionContext).toEqual({
      inspectionOnly: false,
      running: true,
      halted: false,
    });
    expect(state.ledger.fills).toHaveLength(1);
    expect(providers.capture).toHaveBeenCalledWith(
      expect.objectContaining({ judgment: assessed }),
    );
    store.close();
  });
  it("records failed X evidence without inference or execution", async () => {
    const { engine, store, providers, research } = setup();
    vi.mocked(providers.research).mockResolvedValue({
      ...research,
      status: "error",
      sources: [],
      detail: "Offline",
    });
    await engine.cycle(pool.address);
    expect(providers.judge).not.toHaveBeenCalled();
    expect((await store.read()).decisions[0].research?.status).toBe("error");
    expect((await store.read()).ledger.fills).toHaveLength(0);
    store.close();
  });
  it("a pause during X research prevents any paper fill", async () => {
    const { engine, store, providers, research } = setup();
    await store.mutate((s) => {
      s.running = true;
      s.approvedPools = [pool.address];
    });
    vi.mocked(providers.research).mockImplementation(async () => {
      await store.mutate((s) => {
        s.running = false;
      });
      return research;
    });
    await engine.cycle();
    expect((await store.read()).ledger.fills).toHaveLength(0);
    expect((await store.read()).running).toBe(false);
    store.close();
  });
  it("cannot buy from an empty X search even if Jev suggests buy", async () => {
    const { engine, store, providers, research } = setup();
    vi.mocked(providers.research).mockResolvedValue({
      ...research,
      status: "no_results",
      sources: [],
    });
    await store.mutate((s) => {
      s.running = true;
      s.approvedPools = [pool.address];
    });
    await engine.cycle();
    expect((await store.read()).decisions[0].action).toBe("hold");
    expect((await store.read()).ledger.fills).toHaveLength(0);
    store.close();
  });
  it("persists exactly one paper fill for the same candle", async () => {
    const { engine, store } = setup();
    await store.mutate((s) => {
      s.approvedPools = [pool.address];
      s.running = true;
    });
    await engine.cycle();
    await engine.cycle();
    const s = await store.read();
    expect(s.ledger.fills).toHaveLength(1);
    expect(s.decisions[0].judgment?.model).toBe("fixture");
    store.close();
  });
  it("inspection cannot trade even while the loop is enabled", async () => {
    const { engine, store } = setup();
    await store.mutate((s) => {
      s.approvedPools = [pool.address];
      s.running = true;
    });
    await engine.cycle(pool.address);
    expect((await store.read()).ledger.fills).toHaveLength(0);
    store.close();
  });
  it("a kill switch activated during model inference prevents the fill", async () => {
    const { engine, store, providers } = setup();
    await store.mutate((s) => {
      s.approvedPools = [pool.address];
      s.running = true;
    });
    vi.mocked(providers.judge).mockImplementation(async () => {
      await store.mutate((s) => {
        s.halted = true;
        s.running = false;
      });
      return judgment;
    });
    await engine.cycle();
    const s = await store.read();
    expect(s.halted).toBe(true);
    expect(s.ledger.fills).toHaveLength(0);
    store.close();
  });
  it("does not call a model when required credentials are missing", async () => {
    const { engine, store, providers } = setup();
    providers.statuses.set("Jev", {
      name: "Jev",
      state: "missing",
      detail: "Not configured",
    });
    await engine.cycle(pool.address);
    expect(providers.judge).not.toHaveBeenCalled();
    expect((await store.read()).decisions[0].status).toBe("not_evaluated");
    store.close();
  });
  it("keeps the committed ledger if memory capture fails", async () => {
    const { engine, store, providers } = setup();
    await store.mutate((s) => {
      s.approvedPools = [pool.address];
      s.running = true;
    });
    vi.mocked(providers.capture).mockRejectedValue(new Error("offline"));
    await engine.cycle();
    const s = await store.read();
    expect(s.ledger.fills).toHaveLength(1);
    expect(s.decisions[0].memoryCapture).toContain("failed");
    store.close();
  });
});
