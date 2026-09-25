import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildReplayInput,
  replayCheckpoints,
  judgeReplay,
  parseReplayJudgment,
  ReplayService,
} from "./replay.js";
import type { LaunchFeed } from "./launch-feed.js";
import type { GraduationVerifier } from "./graduation.js";
const candles = Array.from({ length: 24 }, (_, i) => ({
  time: 1000 + i * 300,
  open: 10 + i,
  high: 12 + i,
  low: 9 + i,
  close: 11 + i,
  volume: 100,
}));
describe("historical replay time boundary", () => {
  it("supplies only closed candles at a checkpoint and never invents missing historical fields", () => {
    const input = buildReplayInput(candles, (1000 + 12 * 300) * 1000);
    expect(input.candles).toHaveLength(12);
    expect(input.candles.at(-1)?.close).toBe(22);
    expect(input.features.returnPct).toBeCloseTo(100);
    expect(input).not.toHaveProperty("liquidityUsd");
    expect(input.candles[0]).not.toHaveProperty("volume");
    expect(input.missing).toContain("Point-in-time Living Brain memories");
  });
  it("chooses four ordered checkpoints without open candles or pre-graduation bars", () => {
    const points = replayCheckpoints(candles, 1000_000, 8000_000);
    expect(points).toHaveLength(4);
    expect(points.map((p) => p.asOf)).toEqual(
      [...points.map((p) => p.asOf)].sort((a, b) => a - b),
    );
    for (const p of points)
      expect(
        p.candles.every(
          (c) =>
            c.time * 1000 >= 1000_000 &&
            (c.time + 300) * 1000 <= p.asOf &&
            p.asOf <= 8000_000,
        ),
      ).toBe(true);
    expect(replayCheckpoints(candles, 7500_000, 8000_000)).toEqual([]);
  });
  it("rejects invalid prices rather than producing infinite return metrics", () => {
    expect(() =>
      buildReplayInput(
        candles.map((c) => ({ ...c, close: 0 })),
        8000_000,
      ),
    ).toThrow();
  });
});
const raw = {
  model: "fixture-jev",
  id: "fixture-request",
  usage: { cost: 0.001 },
  answers: {
    stance: {
      type: "choice",
      choice: "wait",
      confidence: 0.8,
      probabilities: { consider_entry: 0.1, wait: 0.8, avoid: 0.1 },
    },
    pattern: {
      type: "choice",
      choice: "range",
      confidence: 1,
      probabilities: {
        momentum: 0,
        pullback: 0,
        range: 1,
        breakdown: 0,
        unclear: 0,
      },
    },
    evidence: {
      type: "choice",
      choice: "insufficient",
      confidence: 1,
      probabilities: {
        strength: 0,
        weakness: 0,
        volatility: 0,
        insufficient: 1,
      },
    },
  },
};
describe("real model replay boundary", () => {
  it("uses the JEV endpoint, with no present-day metrics or invented memory, and retains its receipt", async () => {
    const input = buildReplayInput(candles, 5000_000);
    const fetchImpl = vi.fn(async (url, init) => {
      expect(url).toBe("https://openrouter.ai/api/alpha/decisions");
      const payload = JSON.parse(init!.body as string);
      expect(payload.state.candles).toEqual(input.candles);
      expect(payload.state).not.toHaveProperty("token");
      expect(payload.state).not.toHaveProperty("memories");
      expect(payload.state.missing).toContain(
        "Historical liquidity and token security",
      );
      return Response.json(raw);
    }) as typeof fetch;
    expect(
      await judgeReplay(input, { OPENROUTER_API_KEY: "test-only" }, fetchImpl),
    ).toMatchObject({
      requestId: "fixture-request",
      stance: { choice: "wait" },
    });
  });
  it("does not replace an invalid response with a decision", () => {
    expect(() =>
      parseReplayJudgment({
        ...raw,
        answers: {
          ...raw.answers,
          stance: { ...raw.answers.stance, choice: "buy" },
        },
      }),
    ).toThrow();
    expect(() =>
      parseReplayJudgment({
        ...raw,
        answers: {
          ...raw.answers,
          stance: { ...raw.answers.stance, probabilities: { wait: 1 } },
        },
      }),
    ).toThrow();
  });
  it("runs at most twelve calls, single-flights duplicate starts, saves results, and resumes without new inference", async () => {
    const temp = await mkdtemp(join(tmpdir(), "jev-replay-test-"));
    try {
      const feed = {
        refresh: vi.fn(async () => {}),
        state: {
          launches: Array.from({ length: 3 }, (_, i) => ({
            address: `0x${String(i + 1).repeat(40)}`,
            symbol: `T${i}`,
            platform: i === 1 ? "fourmeme" : "flap",
            stage: "graduated_reported",
            reportedGraduatedAt: 1000_000,
          })),
        },
        candles: vi.fn(async () => candles),
      } as unknown as LaunchFeed;
      const verifier = {
        verify: vi.fn(async () => ({
          status: "gmgn_reported",
          checkedAt: Date.now(),
          token: "fixture",
          pool: "fixture",
        })),
      } as unknown as GraduationVerifier;
      const judge = vi.fn(async () => parseReplayJudgment(raw));
      const service = new ReplayService(
        feed,
        verifier,
        judge,
        join(temp, "replay.json"),
      );
      const first = service.start();
      expect(service.start().id).toBe(first.id);
      await service.finished();
      expect(service.run?.status).toBe("complete");
      expect(judge).toHaveBeenCalledTimes(12);
      const saved = JSON.parse(
        await readFile(join(temp, "replay.json"), "utf8"),
      );
      expect(saved.coins).toHaveLength(3);
      const loaded = await new ReplayService(
        feed,
        verifier,
        judge,
        join(temp, "replay.json"),
      ).init();
      expect(loaded.run?.id).toBe(first.id);
      expect(judge).toHaveBeenCalledTimes(12);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
});
