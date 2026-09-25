import { describe, expect, it } from "vitest";
import {
  reconcileArrivals,
  emptyArrivals,
  selectLaunches,
  platformLabel,
} from "./launches.js";
import type { Launch } from "./launches.js";
const now = 1_790_000_000_000;
const token = (address: string, createdAt = now): Launch => ({
  id: `56:${address}`,
  address,
  platform: "flap",
  symbol: "TEST",
  name: "Test",
  stage: "new",
  createdAt,
  observedAt: now,
  firstSeenAt: now,
  reportedGraduatedAt: null,
  priceUsd: null,
  liquidityUsd: null,
  marketCapUsd: null,
  volume24h: null,
  progress: null,
  holders: null,
  top10: null,
  logo: null,
  quote: null,
  riskFlags: [],
});
describe("launch arrival identity", () => {
  it("labels and filters Four.meme independently and animates a fresh arrival once", () => {
    const launch = { ...token("0xc"), platform: "fourmeme" as const };
    expect(platformLabel(launch.platform)).toBe("Four.meme");
    expect(selectLaunches([token("0xa"), launch], "fourmeme", "all", ""))
      .toEqual([launch]);
    const initial = reconcileArrivals(emptyArrivals(), [token("0xa")], now);
    const next = reconcileArrivals(initial, [token("0xa"), launch], now + 1000);
    expect(next.added).toEqual([launch.id]);
    expect(reconcileArrivals(next, [launch], now + 2000).added).toEqual([]);
  });
  it("hydrates without animating the initial population", () => {
    const state = reconcileArrivals(emptyArrivals(), [token("0xa")], now);
    expect(state.added).toEqual([]);
    expect(state.seen.has("56:0xa")).toBe(true);
  });
  it("announces a new launch once, not an overlapping page, stage change or refresh", () => {
    const first = reconcileArrivals(emptyArrivals(), [token("0xa")], now);
    const next = reconcileArrivals(
      first,
      [token("0xa"), token("0xb"), token("0xb")],
      now + 1000,
    );
    expect(next.added).toEqual(["56:0xb"]);
    const repeat = reconcileArrivals(
      next,
      [{ ...token("0xb"), stage: "graduated_reported" }, token("0xa")],
      now + 2000,
    );
    expect(repeat.added).toEqual([]);
    expect(repeat.highlighted["56:0xb"]).toBe(now + 13000);
  });
  it("does not call backfilled old launches new and expires highlights", () => {
    const first = reconcileArrivals(emptyArrivals(), [], now);
    const next = reconcileArrivals(
      first,
      [token("0xa", now - 60 * 60_000), token("0xb")],
      now + 1000,
    );
    expect(next.added).toEqual(["56:0xb"]);
    expect(reconcileArrivals(next, [], now + 14000).highlighted).toEqual({});
    expect(reconcileArrivals(next, [token("0xb")], now + 15000).added).toEqual(
      [],
    );
  });
  it("filters without changing token identity or arrival state", () => {
    const list = [
      token("0xa"),
      { ...token("0xb"), platform: "fourmeme" as const },
    ];
    expect(
      selectLaunches(list, "fourmeme", "all", "0xb").map((l) => l.id),
    ).toEqual(["56:0xb"]);
  });
});
