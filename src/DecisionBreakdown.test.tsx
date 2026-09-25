import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AssessmentCard, AssessmentOverview, DecisionSummary, ExecutionOutcome, executionLabel } from "./DecisionBreakdown.js";
import type { Decision, EvidenceAssessment } from "./types.js";
const decision: Decision = { id: "fixture", time: 1000, pool: "fixture", name: "Fixture", action: "hold", status: "held",
  reasons: ["Operator approval: Pool must be approved."], memories: [], memoryStatus: "Connected · cold start (no relevant memories)",
  checks: [{ label: "Operator approval", pass: false, detail: "Pool must be approved." }],
  executionContext: { inspectionOnly: true, running: false, halted: false },
  judgment: { action: "buy", confidence: 0.9, probabilities: { buy: 0.9, sell: 0, hold: 0.1 }, quality: 2.5, toxic: 0.1, model: "fixture", requestId: "fixture", costUsd: 0 },
};
const assessment: EvidenceAssessment = { id: "source_1", label: "Claim support", kind: "x", evidenceIds: ["X1"], referenceId: "post-1",
  question: "Does supplied evidence support this claim?", value: "unsupported", valueLabel: "Claim lacks support", confidence: 0.9,
  probabilities: { supported: 0.1, unsupported: 0.9 }, options: { supported: "Supported", unsupported: "Unsupported" }, criteria: { supported: "Corroborated", unsupported: "Uncorroborated" } };
describe("decision breakdown", () => {
  it("separates model intent, final outcome and actual execution restrictions", () => {
    const summary = renderToStaticMarkup(<DecisionSummary decision={decision} />);
    const outcome = renderToStaticMarkup(<ExecutionOutcome decision={decision} />);
    expect(summary).toContain("JEV selected BUY");
    expect(summary).toContain("No trade placed");
    expect(outcome).toContain("Operator approval");
    expect(outcome).toContain("Inspection only");
    expect(outcome).toContain("Paused at evaluation");
    expect(summary).not.toContain("because");
    expect(executionLabel(decision)).toBe("Inspection only");
    expect(executionLabel({ ...decision, executionContext: undefined, judgment: { ...decision.judgment!, action: "hold" } })).toBe("JEV hold");
    expect(executionLabel({ ...decision, executionContext: undefined })).toBe("Policy prevented");
  });
  it("does not invent assessments for historical decisions", () => {
    expect(renderToStaticMarkup(<AssessmentOverview judgment={decision.judgment} />)).toContain("not collected for this decision");
  });
  it("shows independent judgments, source references and exact questions, with escaped text", () => {
    const html = renderToStaticMarkup(<AssessmentCard assessment={{ ...assessment, question: "<script>untrusted</script>" }} />);
    expect(html).toContain("Claim lacks support");
    expect(html).toContain('href="#evidence-X1"');
    expect(html).toContain("Question &amp; probabilities");
    expect(html).toContain("90%");
    expect(html).not.toContain("<script>");
  });
  it("does not label a skipped inference as a model Hold", () => {
    const html = renderToStaticMarkup(<DecisionSummary decision={{ ...decision, judgment: undefined, status: "not_evaluated" }} />);
    expect(html).toContain("JEV not evaluated");
    expect(html).not.toContain("JEV selected HOLD");
  });
  it("shows partial assessment availability without inventing a complete explanation", () => {
    const html = renderToStaticMarkup(<AssessmentOverview judgment={{ ...decision.judgment!, assessmentVersion: "evidence-v1", assessments: [], assessmentIssues: ["Memory alignment: response missing or invalid."] }} />);
    expect(html).toContain("response missing or invalid");
    expect(html).toContain("not JEV’s reasoning trace");
  });
  it("distinguishes an executed paper fill from a live transaction", () => {
    const html = renderToStaticMarkup(<DecisionSummary decision={{ ...decision, status: "executed", action: "buy" }} />);
    expect(html).toContain("Paper BUY recorded");
    expect(html).not.toContain("Real trade");
  });
});
