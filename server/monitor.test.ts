import { describe, it, expect, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MonitorService } from "./monitor.js";
import type { LaunchFeedState, Launch, Graduation } from "../src/launches.js";
import type { Decision } from "../src/types.js";
import type { LaunchActivity } from "../src/monitoring.js";
const epoch = 1_790_000_000_000;
const token = `0x${"a".repeat(40)}`;
const launch = {
  address: token,
  symbol: "TEST",
  platform: "flap",
  stage: "graduated_reported",
  reportedGraduatedAt: epoch - 1000,
  observedAt: epoch,
  liquidityUsd: 20000,
  holders: 50,
  riskFlags: [],
} as unknown as Launch;
function setup() {
  let now = epoch;
  const feed = { enabled: true, launches: [launch] } as LaunchFeedState;
  const activity = vi.fn(
    async () =>
      [
        {
          token,
          observedAt: now,
          volume5mUsd: 2000,
          swaps5m: 20,
          buys5m: 10,
          sells5m: 10,
          riskFlags: [],
        },
      ] as LaunchActivity[],
  );
  const verify = vi.fn(async (_launch?: Launch): Promise<Graduation> => ({
    token,
    status: "gmgn_reported" as const,
    pool: `0x${"b".repeat(40)}`,
    checkedAt: now,
    detail: "test",
  }));
  const assess = vi.fn(
    async () =>
      ({
        id: "decision",
        time: now,
        judgment: { action: "hold" },
        reasons: [],
      }) as unknown as Decision,
  );
  const service = new MonitorService(
    {
      feed: () => feed,
      activity,
      verify,
      assess,
      available: async () => true,
      now: () => now,
    },
    null,
  );
  return {
    service,
    feed,
    activity,
    verify,
    assess,
    advance: (ms: number) => {
      now += ms;
      feed.launches = [{ ...launch, observedAt: now }];
    },
  };
}
describe("automatic non-executing monitor", () => {
  it('assesses a new launch before graduation when an indicative paper market is available',async()=>{
    const x=setup();x.feed.launches=[{...launch,stage:'new',createdAt:epoch-1000,reportedGraduatedAt:null}];
    x.verify.mockResolvedValue({token,status:'paper_launch',pool:`launch:${token}`,checkedAt:epoch,detail:'Indicative'});
    await x.service.tick();expect(x.assess).toHaveBeenCalledOnce();expect(x.service.state.items[0].status).toBe('monitoring');
  });
  it("persists pause and attempt cooldown across restart", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jev-monitor-test-"));
    try {
      const x = setup();
      const deps = {
        feed: () => x.feed,
        activity: x.activity,
        verify: x.verify,
        assess: x.assess,
        available: async () => true,
        now: () => epoch,
      };
      const file = join(dir, "state.json"),
        first = await new MonitorService(deps, file).init();
      await first.tick();
      await first.setEnabled(false);
      const loaded = await new MonitorService(deps, file).init();
      expect(loaded.state.enabled).toBe(false);
      await loaded.tick();
      expect(x.assess).toHaveBeenCalledOnce();
      await loaded.setEnabled(true);
      await loaded.tick();
      expect(x.assess).toHaveBeenCalledOnce();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("keeps scheduling beyond sixty hourly attempts; actual model calls have their own pacer", async () => {
    const x = setup();
    x.feed.launches = Array.from({ length: 61 }, (_, i) => ({
      ...launch,
      address: `0x${i.toString(16).padStart(40, "0")}`,
    }));
    x.activity.mockResolvedValue(
      x.feed.launches.map((l) => ({
        token: l.address,
        observedAt: epoch,
        volume5mUsd: 2000,
        swaps5m: 20,
        buys5m: 10,
        sells5m: 10,
        riskFlags: [],
      })),
    );
    x.verify.mockImplementation(async (l?: Launch) => ({
      token: l!.address,
      status: "gmgn_reported" as const,
      pool: `0x${"b".repeat(40)}`,
      checkedAt: epoch,
      detail: "test",
    }));
    for (let i = 0; i < 61; i++) await x.service.tick();
    expect(x.assess).toHaveBeenCalledTimes(61);
    expect(x.service.state.error).toBeNull();
  });
  it("calls assessment after thresholds and independent graduation, then cools down", async () => {
    const { service, assess, advance } = setup();
    await service.tick();
    expect(assess).toHaveBeenCalledOnce();
    expect(service.state.items[0]).toMatchObject({
      status: "monitoring",
      decisionId: "decision",
      modelAction: "hold",
    });
    await service.tick();
    expect(assess).toHaveBeenCalledOnce();
    advance(300000);
    await service.tick();
    expect(assess).toHaveBeenCalledTimes(2);
  });
  it("does not assess unverified graduation or missing activity", async () => {
    const x = setup();
    x.verify.mockResolvedValue({
      ...(await x.verify()),
      status: "unverified" as any,
    });
    await x.service.tick();
    expect(x.assess).not.toHaveBeenCalled();
    const y = setup();
    y.activity.mockResolvedValue([]);
    await y.service.tick();
    expect(y.verify).not.toHaveBeenCalled();
  });
  it("single-flights ticks and pause cancels an in-flight admission before assessment", async () => {
    const x = setup();
    let finish!: () => void;
    x.verify.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return {
        token,
        status: "gmgn_reported",
        pool: `0x${"b".repeat(40)}`,
        checkedAt: epoch,
        detail: "test",
      };
    });
    const pending = x.service.tick();
    await vi.waitFor(() => expect(x.verify).toHaveBeenCalledOnce());
    const duplicate = x.service.tick();
    await x.service.setEnabled(false);
    finish();
    await Promise.all([pending, duplicate]);
    expect(x.assess).not.toHaveBeenCalled();
    expect(x.service.state.enabled).toBe(false);
  });
  it("backs off provider failure and never labels it as a JEV decision", async () => {
    const x = setup();
    x.assess.mockRejectedValue(new Error("private provider error"));
    await x.service.tick();
    await x.service.tick();
    expect(x.assess).toHaveBeenCalledOnce();
    expect(x.service.state.items[0]).toMatchObject({ status: "error" });
    expect(JSON.stringify(x.service.state)).not.toContain(
      "private provider error",
    );
  });
});
