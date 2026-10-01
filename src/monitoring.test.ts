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
  it.each(['new','bonding'] as const)('admits fresh %s launches before graduation', stage=>{
    expect(screenLaunch({...launch,stage,createdAt:now-60000,reportedGraduatedAt:null},activity,now).eligible).toBe(true);
    expect(screenLaunch({...launch,stage,createdAt:null,reportedGraduatedAt:null},activity,now).eligible).toBe(false);
  });
  it("accepts older observations only with the explicit assessment window", () => {
    const older = { ...launch, observedAt: now - 100_000 };
    const oldActivity = { ...activity, observedAt: now - 100_000 };
    expect(screenLaunch(older, oldActivity, now).eligible).toBe(false);
    expect(screenLaunch(older, oldActivity, now, WATCH_POLICY.assessmentMaxAgeMs).eligible).toBe(true);
    for (const observedAt of [now - 300_001, now + 1, NaN]) {
      expect(screenLaunch({ ...older, observedAt }, oldActivity, now, WATCH_POLICY.assessmentMaxAgeMs).eligible).toBe(false);
      expect(screenLaunch(older, { ...oldActivity, observedAt }, now, WATCH_POLICY.assessmentMaxAgeMs).eligible).toBe(false);
    }
    expect(screenLaunch(older, undefined, now, WATCH_POLICY.assessmentMaxAgeMs).eligible).toBe(false);
  });
  it("keeps stale/future, missing and low-activity inputs out", () => {
    for (const change of [
      { stage: "bonding" },
      { reportedGraduatedAt: null },
      { reportedGraduatedAt: now + 1 },
      { reportedGraduatedAt: now - 86_400_001 },
      { observedAt: now - 90_001 },
      { observedAt: now + 1 },
      { liquidityUsd: null },
      { liquidityUsd: 1999 },
      { holders: 9 },
      { riskFlags: ["risk"] },
    ])
      expect(
        screenLaunch({ ...launch, ...change } as Launch, activity, now)
          .eligible,
      ).toBe(false);
    for (const change of [
      { volume5mUsd: null },
      { swaps5m: null },
      { volume5mUsd: 299 },
      { swaps5m: 4 },
      { observedAt: now - 90_001 },
      { riskFlags: ["wash trading"] },
    ])
      expect(
        screenLaunch(launch, { ...activity, ...change }, now).eligible,
      ).toBe(false);
    expect(screenLaunch(launch, undefined, now).eligible).toBe(false);
  });
});
