import { describe, it, expect, vi } from "vitest";
import { readGraduation, GraduationVerifier } from "./graduation.js";
import type { Launch } from "../src/launches.js";
const token = `0x${"a".repeat(40)}`;
const pool = `0x${"b".repeat(40)}`;
const now = 1_790_000_000_000;
const launch = { id: "flap:" + token, address: token, platform: "flap", stage: "graduated_reported", observedAt: now } as Launch;
describe("GMGN graduation trust boundary", () => {
  it.each(["flap", "fourmeme"] as const)("trusts fresh %s graduation without RPC proof", async platform => {
    const resolvePool = vi.fn(async () => ({ address: pool, token }));
    const result = await readGraduation({ ...launch, platform }, resolvePool, () => now);
    expect(result).toMatchObject({ status: "gmgn_reported", source: "GMGN", poolSource: "GMGN", pool, checkedAt: now });
    expect(result.block).toBeUndefined();
    expect(resolvePool).toHaveBeenCalledWith(token);
  });
  it.each([
    { platform: "grafun" }, { stage: "new" }, { stage: "bonding" },
    { observedAt: now - 90001 }, { observedAt: now + 1 }, { observedAt: NaN },
  ])("does not accept unsupported, pre-graduation or stale reports: %j", async patch => {
    const resolvePool = vi.fn();
    const result = await readGraduation({ ...launch, ...patch } as Launch, resolvePool, () => now);
    expect(result.status).not.toBe("gmgn_reported");
    expect(result.pool).toBeUndefined();
    expect(resolvePool).not.toHaveBeenCalled();
  });
  it("keeps graduation separate from missing market-pool data", async () => {
    const result = await readGraduation(launch, async () => { throw new Error("private upstream"); }, () => now);
    expect(result.status).toBe("gmgn_reported");
    expect(result.pool).toBeUndefined();
    expect(result.detail).toContain("market pool unavailable");
    expect(result.detail).not.toContain("private upstream");
  });
  it("never maps another token or the token contract itself as its market pool", async () => {
    for (const candidate of [{ address: pool, token: pool }, { address: token, token }]) {
      const result = await readGraduation(launch, async () => candidate, () => now);
      expect(result.status).toBe("gmgn_reported");
      expect(result.pool).toBeUndefined();
    }
  });
  it("rejects a report that expires while resolving the market", async () => {
    let clock = now;
    const result = await readGraduation(launch, async () => { clock += 90001; return { address: pool, token }; }, () => clock);
    expect(result.status).toBe("unverified");
    expect(result.pool).toBeUndefined();
  });
  it("does not reuse bonding status after a new graduation observation", async () => {
    const read = vi.fn(async (l: Launch) => ({ token, status: l.stage === "bonding" ? "bonding" as const : "gmgn_reported" as const, checkedAt: Date.now(), detail: "fixture" }));
    const service = new GraduationVerifier(read);
    await service.verify({ ...launch, stage: "bonding" });
    expect((await service.verify(launch)).status).toBe("gmgn_reported");
    expect(read).toHaveBeenCalledTimes(2);
  });
});
