import { describe, expect, it } from "vitest";
import { assessmentPlan, parseAssessments } from "./assessments.js";
import type { Memory, XResearch } from "../src/types.js";
const research: XResearch = {
  token: "0x" + "1".repeat(40), status: "ready", detail: "Fixture", model: "fixture",
  window: { from: 0, to: 1000 }, collectedAt: 1000, expiresAt: 2000, searchCalls: 1, rejectedCount: 0,
  sources: [{ url: "https://x.com/fixture/status/2103362829185974272", postId: "2103362829185974272", handle: "fixture",
    publishedAt: 900, timestampSource: "post-id", summary: "Fixture claim", identityExcerpt: "Fixture excerpt" }],
};
const memories: Memory[] = [{ pageId: "page-1", slug: "fixture", title: "Previous reversal", summary: "Fixture lesson", similarity: 0.8, status: "active" }];
describe("source-bound Jev assessments", () => {
  it("builds server-owned source references and independent typed questions", () => {
    const plan = assessmentPlan(memories, research);
    expect(plan.map(p => p.id)).toEqual(["evidence_support", "memory_alignment", "source_1", "memory_1"]);
    expect(plan.find(p => p.id === "source_1")).toMatchObject({ kind: "x", evidenceIds: ["X1"], referenceId: research.sources[0].postId });
    expect(plan.find(p => p.id === "memory_1")).toMatchObject({ kind: "memory", evidenceIds: ["M1"], referenceId: "page-1" });
    expect(plan.every(p => p.question.type === "choice")).toBe(true);
  });
  it("does not invent post or memory references for a cold start", () => {
    const plan = assessmentPlan([], { ...research, status: "no_results", sources: [] });
    expect(plan).toHaveLength(2);
    expect(plan[0].evidenceIds).toEqual(["market"]);
    expect(plan[1].evidenceIds).toEqual([]);
  });
  it("retains valid responses, labels missing responses, and ignores unrequested references", () => {
    const plan = assessmentPlan([], { ...research, sources: [] });
    const result = parseAssessments({ evidence_support: { type: "choice", choice: "insufficient", confidence: 0.9,
      probabilities: { supported: 0.05, insufficient: 0.9, conflicting: 0.05 } }, fabricated_source: {} }, plan);
    expect(result.assessments).toHaveLength(1);
    expect(result.assessments[0]).toMatchObject({ id: "evidence_support", value: "insufficient", valueLabel: "Insufficient support", evidenceIds: ["market"] });
    expect(result.assessmentIssues).toEqual(["Memory alignment: response missing or invalid."]);
  });
  it.each([
    { choice: "made_up", probabilities: { supported: 1 } },
    { choice: "supported", probabilities: { supported: 0.1, insufficient: 0.8, conflicting: 0.1 } },
    { choice: "supported", probabilities: { supported: 0.9, insufficient: 0.9, conflicting: 0.9 } },
    { choice: "supported", probabilities: { supported: 0.9, insufficient: 0.05, conflicting: 0.05, made_up: 0 } },
  ])("never fabricates an assessment from an invalid choice or distribution", fields => {
    const result = parseAssessments({ evidence_support: { type: "choice", confidence: 0.9, ...fields } }, assessmentPlan([], { ...research, sources: [] }));
    expect(result.assessments).toEqual([]);
    expect(result.assessmentIssues).toHaveLength(2);
  });
});
