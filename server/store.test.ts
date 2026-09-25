import { describe, it, expect } from "vitest";
import { SqliteStore } from "./store.js";
describe("durable state transitions", () => {
  it("keeps a kill switch latched through later updates", async () => {
    const store = new SqliteStore(":memory:");
    await store.mutate((s) => {
      s.halted = true;
      s.running = false;
    });
    await store.mutate((s) => {
      s.lastCycleAt = 123;
    });
    expect((await store.read()).halted).toBe(true);
    store.close();
  });
  it("rolls back a failed transition", async () => {
    const store = new SqliteStore(":memory:");
    await expect(
      store.mutate((s) => {
        s.ledger.cashUsd = 0;
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect((await store.read()).ledger.cashUsd).toBe(2000);
    store.close();
  });
});
