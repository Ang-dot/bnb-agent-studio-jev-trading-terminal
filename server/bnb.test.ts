import { describe, it, expect } from "vitest";
import { sdkInfo, LockedLiveExecutor } from "./bnb.js";
describe("BNB SDK integration", () => {
  it("generates valid draft metadata without claiming registration", () => {
    const info = sdkInfo();
    expect(info.chainId).toBe(56);
    expect(info.registration.registrations).toEqual([]);
  });
  it("cannot send a live transaction in this build", async () => {
    await expect(new LockedLiveExecutor().execute()).rejects.toThrow(
      "Live execution is unavailable",
    );
  });
});
