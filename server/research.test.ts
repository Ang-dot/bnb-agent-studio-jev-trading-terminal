import { describe, expect, it, vi } from "vitest";
import { parseResearch, XResearchClient } from "./research.js";

const now = Date.parse("2026-09-25T10:00:00Z");
const token = "0x" + "2".repeat(40);
const window = { from: now - 86400000, to: now };
const postUrl = (at = now - 60000) =>
  `https://x.com/fixture/status/${(BigInt(at - 1288834974657) << 22n).toString()}`;
function response(posts = [{ url: postUrl(), summary: "A promotional claim, not verified adoption.", identityExcerpt: `BSC CA: ${token}` }]) {
  return {
    id: "test-request", model: "x-ai/grok-4.7", status: "completed", usage: { cost: 0.01 },
    output: [
      { type: "web_search_call", status: "completed", action: { type: "search", query: token } },
      { type: "message", role: "assistant", content: [{
        type: "output_text", text: JSON.stringify({ posts }),
        annotations: posts.map(p => ({ type: "url_citation", url: p.url })),
      }] },
    ],
  };
}
describe("X evidence provenance", () => {
  it("accepts a provider-cited contract match with time derived from the post ID", () => {
    const result = parseResearch(response(), token, window, now + 1000);
    expect(result.status).toBe("ready");
    expect(result.sources[0]).toMatchObject({ url: postUrl(), publishedAt: now - 60000, timestampSource: "post-id" });
    expect(result.searchCalls).toBe(1);
  });
  it("does not trust a URL written by the model without a provider annotation", () => {
    const raw = response();
    raw.output[1].content![0].annotations = [];
    expect(parseResearch(raw, token, window, now).status).toBe("unverified");
  });
  it("does not call a model's claimed empty search a completed search without a receipt", () => {
    const raw = response([]);
    raw.output.shift();
    expect(parseResearch(raw, token, window, now).status).toBe("unverified");
    expect(parseResearch(response([]), token, window, now).status).toBe("no_results");
  });
  it("rejects ticker-only matches, spoofed hosts, old/future posts, and deduplicates post IDs", () => {
    const good = response().output[1].content![0];
    const posts = JSON.parse(good.text!).posts;
    posts.push(
      { ...posts[0], url: postUrl(now - 2000), identityExcerpt: "Different token with same ticker" },
      { ...posts[0], url: postUrl().replace("x.com", "x.com.evil.invalid") },
      { ...posts[0], url: postUrl(now - 86400001) },
      { ...posts[0], url: postUrl(now + 1000) },
      { ...posts[0], url: postUrl().replace("x.com", "twitter.com") },
    );
    const result = parseResearch(response(posts), token, window, now);
    expect(result.sources).toHaveLength(1);
    expect(result.rejectedCount).toBe(4);
  });
  it("fails closed on malformed or incomplete provider output", () => {
    expect(() => parseResearch({ ...response(), status: "incomplete" }, token, window, now)).toThrow();
    const raw = response();
    raw.output[1].content![0].text = "Here is some unstructured advice";
    expect(() => parseResearch(raw, token, window, now)).toThrow();
  });
});
describe("X search transport", () => {
  it("distinguishes a timeout from malformed evidence without leaking raw errors", async () => {
    const timed = new XResearchClient({OPENROUTER_API_KEY:"fixture-only"}, vi.fn(async()=>{throw new DOMException("secret","TimeoutError");}),()=>now);
    expect(await timed.search(token)).toMatchObject({failureKind:"timeout",detail:expect.stringContaining("90 seconds")});
    const invalid=new XResearchClient({OPENROUTER_API_KEY:"fixture-only"},vi.fn(async()=>Response.json({bad:"secret"})),()=>now);
    expect(await invalid.search(token)).toMatchObject({failureKind:"validation",detail:expect.stringContaining("validation")});
  });
  it("opts in to native X search, caches per contract and coalesces concurrent calls", async () => {
    let clock = now;
    const fetchImpl = vi.fn(async () => Response.json(response()));
    const client = new XResearchClient({ OPENROUTER_API_KEY: "fixture-only" }, fetchImpl, () => clock);
    const [first, second] = await Promise.all([client.search(token), client.search(token)]);
    expect(first).toEqual(second);
    await client.search(token);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const init = (fetchImpl.mock.calls as unknown[][])[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.tools[0].parameters).toMatchObject({ engine: "native", x_search: { from_date: "2026-09-24", to_date: "2026-09-26" } });
    expect(body.max_tool_calls).toBe(3);
    clock += 300001;
    await client.search(token);
    await client.search("0x" + "3".repeat(40));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  it("sanitizes upstream failures and applies a retry cooldown without returning old evidence", async () => {
    const fetchImpl = vi.fn(async () => new Response("SECRET upstream body", { status: 401 }));
    const client = new XResearchClient({ OPENROUTER_API_KEY: "fixture-only" }, fetchImpl, () => now);
    const result = await client.search(token);
    expect(result.status).toBe("error");
    expect(result.detail).toContain("401");
    expect(JSON.stringify(result)).not.toContain("SECRET");
    await client.search(token);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
