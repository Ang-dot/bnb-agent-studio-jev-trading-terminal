import { describe, expect, it } from "vitest";
import {
  screenLaunch,
  WATCH_POLICY,
  type LaunchActivity,
} from "./monitoring.js";
import type { Launch } from "./launches.js";
const now = 1_790_000_000_000;
const launch = {
  platform: "flap",
  stage: "graduated_reported",
  reportedGraduatedAt: now - 60_000,
  observedAt: now,
  liquidityUsd: 20_000,
  holders: 50,
  riskFlags: [],
} as unknown as Launch;
const activity: LaunchActivity = {
  token: "fixture",
  observedAt: now,
  volume5mUsd: 2000,
  swaps5m: 20,
  buys5m: 9,
  sells5m: 11,
  riskFlags: [],
};
describe("automatic attention gate", () => {
  it("scouts earlier without treating scouting as buy permission",()=>{
    expect(screenLaunch({...launch,liquidityUsd:10000,holders:25},{...activity,volume5mUsd:1000,swaps5m:10},now).eligible).toBe(true);
  });
  it("admits a liquid, active graduate without demanding positive price or buy dominance", () => {
    expect(screenLaunch(launch, activity, now).eligible).toBe(true);
    expect(WATCH_POLICY.minLiquidityUsd).toBeLessThan(50000);
  });
  it("keeps pre-graduation, stale/future, missing and low-activity inputs out", () => {
    for (const change of [
      { stage: "bonding" },
      { reportedGraduatedAt: null },
      { reportedGraduatedAt: now + 1 },
      { reportedGraduatedAt: now - 86_400_001 },
      { observedAt: now - 90_001 },
      { observedAt: now + 1 },
      { liquidityUsd: null },
      { liquidityUsd: 9999 },
      { holders: 24 },
      { riskFlags: ["risk"] },
    ])
      expect(
        screenLaunch({ ...launch, ...change } as Launch, activity, now)
          .eligible,
      ).toBe(false);
    for (const change of [
      { volume5mUsd: null },
      { swaps5m: null },
      { volume5mUsd: 999 },
      { swaps5m: 9 },
      { observedAt: now - 90_001 },
      { riskFlags: ["wash trading"] },
    ])
      expect(
        screenLaunch(launch, { ...activity, ...change }, now).eligible,
      ).toBe(false);
    expect(screenLaunch(launch, undefined, now).eligible).toBe(false);
  });
});
