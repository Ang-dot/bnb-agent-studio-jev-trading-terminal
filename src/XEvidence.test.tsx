import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { XEvidence } from "./XEvidence.js";
import type { XResearch } from "./types.js";
const now = Date.parse("2026-09-25T10:00:00Z");
const evidence: XResearch = {
  token: "0x" + "2".repeat(40), status: "no_results", detail: "No matching posts returned.",
  model: "fixture", window: { from: now - 86400000, to: now }, collectedAt: now,
  expiresAt: now + 300000, searchCalls: 1, rejectedCount: 0, sources: [],
};
describe("X evidence display", () => {
  it("distinguishes missing research, empty results and failed requests", () => {
    expect(renderToStaticMarkup(<XEvidence now={now} />)).toContain("No X research captured");
    expect(renderToStaticMarkup(<XEvidence now={now} research={evidence} />)).toContain("No matching posts");
    expect(renderToStaticMarkup(<XEvidence now={now} research={{ ...evidence, status: "error" }} />)).toContain("Search unavailable");
  });
  it("renders cited links, attribution and escaped untrusted text", () => {
    const html = renderToStaticMarkup(<XEvidence now={now} research={{ ...evidence, status: "ready", sources: [{
      url: "https://x.com/fixture/status/2103362829185974272", postId: "2103362829185974272", handle: "fixture",
      publishedAt: now - 1000, timestampSource: "post-id", summary: "<script>untrusted</script>", identityExcerpt: evidence.token,
    }] }} />);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Grok-reported contract excerpt");
    expect(html).toContain("time derived from post ID");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("labels historical snapshots without replacing their original evidence", () => {
    expect(renderToStaticMarkup(<XEvidence now={now + 300001} research={evidence} />)).toContain("Historical evidence");
  });
  it("attaches an assessment only to its stored source ID", () => {
    const source = { url: "https://x.com/fixture/status/2103362829185974272", postId: "2103362829185974272", handle: "fixture", publishedAt: now - 1000,
      timestampSource: "post-id" as const, summary: "Fixture summary", identityExcerpt: evidence.token };
    const assessment = { id: "source_1", label: "Claim support", kind: "x" as const, referenceId: source.postId, evidenceIds: ["X1"], question: "Fixture question",
      value: "unsupported", valueLabel: "Claim lacks support", confidence: 1, probabilities: { unsupported: 1 }, options: { unsupported: "Unsupported" }, criteria: { unsupported: "Not corroborated" } };
    const html = renderToStaticMarkup(<XEvidence now={now} research={{ ...evidence, status: "ready", sources: [source] }} assessments={[assessment, { ...assessment, id: "wrong_source", referenceId: "different-post", valueLabel: "Wrong source assessment" }]} />);
    expect(html).toContain('id="evidence-X1"');
    expect(html).toContain("Claim lacks support");
    expect(html).not.toContain("Wrong source assessment");
    expect(html).toContain("not independently verified raw post text");
  });
});
