import { describe, it, expect, vi } from "vitest";
import {
  parseJudgment,
  BitqueryTokens,
  parsePools,
  parseCandles,
  Providers,
} from "./providers.js";
import type { Snapshot, XResearch } from "../src/types.js";
import { normalizeEvidence } from './enrichment.js';
import { researchInput } from './research-input.js';
describe("provider boundary", () => {
  it('writes an idempotent episode and polls only its source ids without leaking auth into payloads',async()=>{
    const calls:{url:string;init?:RequestInit}[]=[];
    const provider=new Providers({LIVING_BRAIN_API_KEY:'fixture-secret',LIVING_BRAIN_SUBJECT_ID:'subject',LIVING_BRAIN_ID:'brain'},async(url,init)=>{
      calls.push({url:String(url),init});return Response.json(String(url).includes('/sources?')?{items:[{id:'s',status:'completed',affectedPageIds:['page'],compiledAt:'2026-09-25T10:00:00.000Z'},{id:'other',status:'completed',affectedPageIds:[]}]}:{id:'s',status:'pending',affectedPageIds:[]});
    });
    await provider.captureEpisode({id:'e',kind:'decision',name:'TEST',token:'t',createdAt:1,content:{summary:'HOLD, no fill'}} as any);
    const body=JSON.parse(calls[0].init!.body as string);expect(body.originRef).toBe('jev-memory-v1:e');expect(body.content).not.toContain('fixture-secret');
    expect(await provider.captureStatuses(['s'])).toHaveLength(1);expect(calls[1].url).toContain('ids=s');
  });
  it("excludes unvalidated shadow evidence from memory capture and future model recall", async () => {
    let payload:any;
    const providers=new Providers({LIVING_BRAIN_API_KEY:"fixture",LIVING_BRAIN_SUBJECT_ID:"fixture",LIVING_BRAIN_ID:"fixture"},async (_url,init)=>{
      payload=JSON.parse(init!.body as string);return Response.json({id:"capture",status:"pending"});
    });
    await providers.capture({id:"d",name:"fixture",supportingEvidence:{mode:"shadow",creator:"unvalidated"},supportingEvidenceAt:1} as any);
    expect(JSON.parse(payload.content).decision).not.toHaveProperty("supportingEvidence");
    expect(JSON.parse(payload.content).decision).not.toHaveProperty("supportingEvidenceAt");
  });
  it("resolves a matching liquid PancakeSwap pool without applying the $50k buy gate", async () => {
    const token = "0x" + "a".repeat(40);
    const row = (pool: string, base: string, liquidity: number) => ({
      attributes: { address: pool, name: "Fixture / WBNB", base_token_price_usd: "0.01", reserve_in_usd: String(liquidity),
        volume_usd: { h24: "1000" }, price_change_percentage: { h1: "1", h24: "2" }, transactions: { h1: { buys: 1, sells: 1 } } },
      relationships: { base_token: { data: { id: `bsc_${base}` } }, dex: { data: { id: "pancakeswap-v3-bsc" } } },
    });
    const fetchImpl = vi.fn(async (_url: unknown) => Response.json({ data: [
      row("0x" + "1".repeat(40), "0x" + "c".repeat(40), 100000),
      row("0x" + "2".repeat(40), token, 10000), row("0x" + "3".repeat(40), token, 20000),
    ] }));
    const providers = new Providers({}, fetchImpl);
    expect(await providers.poolForToken(token)).toMatchObject({ address: "0x" + "3".repeat(40), token, liquidityUsd: 20000 });
    expect(String(fetchImpl.mock.calls[0][0])).toContain(`/networks/bsc/tokens/${token}/pools`);
    const missing = new Providers({}, async () => Response.json({ data: [row("0x" + "1".repeat(40), "0x" + "c".repeat(40), 100000)] }));
    await expect(missing.poolForToken(token)).rejects.toThrow("Matching PancakeSwap market unavailable");
  });
  it("sends typed source assessments with explicit evidence IDs and preserves the returned judgments", async () => {
    const snapshot: Snapshot = { pool: "0x" + "1".repeat(40), token: "0x" + "2".repeat(40), name: "Fixture",
      priceUsd: 1, liquidityUsd: 100000, volume24h: 200000, change1h: 1, buyCount: 1, sellCount: 1,
      observedAt: 1000, marketAt: 1000, source: "bitquery", candleId: "fixture" };
    const research: XResearch = { token: snapshot.token, status: "ready", detail: "Fixture", model: "fixture", window: { from: 0, to: 1000 },
      collectedAt: 1000, expiresAt: 2000, searchCalls: 1, rejectedCount: 0,
      sources: [{ postId: "source-post", url: "https://x.com/fixture/status/2103362829185974272", handle: "fixture", publishedAt: 900,
        timestampSource: "post-id", summary: "Fixture claim", identityExcerpt: snapshot.token }] };
    let payload: any;
    const providers = new Providers({ OPENROUTER_API_KEY: "fixture-only" }, async (_url, init) => {
      payload = JSON.parse(init!.body as string);
      const extras = Object.fromEntries(Object.entries(payload.questions).filter(([key]) => !["action", "quality", "toxic"].includes(key)).map(([key, q]: [string, any]) => {
        const options = Object.keys(q.criteria);
        return [key, { type: "choice", choice: options[0], confidence: 1, probabilities: Object.fromEntries(options.map((o, i) => [o, i === 0 ? 1 : 0])) }];
      }));
      return Response.json({ model: "fixture", id: "fixture", usage: { cost: 0 }, answers: { ...extras,
        action: { type: "choice", choice: "hold", confidence: 1, probabilities: { buy: 0, sell: 0, hold: 1 } },
        quality: { type: "score", score: 0 }, toxic: { type: "noul", noul: 0.2 } } });
    });
    const supporting=researchInput(normalizeEvidence(snapshot.token,[{key:'info',requestedAt:900,receivedAt:1000,raw:{address:snapshot.token,price:{buy_volume_1m:100,sell_volume_1m:50}}}],1000),snapshot.token,snapshot.pool,1000)!;
    const judgment = await providers.judge(snapshot, [], research,supporting);
    expect(payload.state.supporting_research).toEqual(supporting);
    expect(payload.questions.Rflow.type).toBe('choice');
    expect(judgment.assessments?.find(a=>a.id==='Rflow')?.kind).toBe('research');
    expect(payload.state.x_research.sources[0].evidenceId).toBe("X1");
    expect(payload.questions.source_1.type).toBe("choice");
    expect(judgment.assessments?.find(a => a.id === "source_1")).toMatchObject({ referenceId: "source-post", evidenceIds: ["X1"] });
    expect(judgment.assessmentIssues).toEqual([]);
    expect(judgment.action).toBe("hold");
  });
  it("reports rejected authentication without exposing upstream contents", async () => {
    const providers = new Providers({OPENROUTER_API_KEY:"fixture-key"}, async () => new Response('sensitive upstream body', {status:401}));
    await expect(providers.verifyJevAccess()).rejects.toThrow('HTTP 401');
    expect(providers.statuses.get('Jev')).toMatchObject({state:'error',detail:'Authentication rejected (HTTP 401); check the provider/key pairing.'});
  });
  it("does not register GoPlus or expose a token scanner even if old credentials exist", () => {
    const fetchImpl = vi.fn();
    const providers = new Providers({GOPLUS_APP_KEY:"fixture",GOPLUS_APP_SECRET:"fixture"}, fetchImpl);
    expect(providers.statuses.has("GoPlus")).toBe(false);
    expect("security" in providers).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("rejects missing confidence instead of inventing a default", () => {
    expect(() =>
      parseJudgment({ answers: { action: { type: "choice", choice: "buy" } } }),
    ).toThrow();
  });
  it("rejects invalid probability distributions", () => {
    expect(() =>
      parseJudgment({
        model: "jev",
        id: "id",
        usage: { cost: 0 },
        answers: {
          action: {
            type: "choice",
            choice: "buy",
            confidence: 0.9,
            probabilities: { buy: 1, sell: 1, hold: 1 },
          },
          quality: { type: "score", score: 2 },
          toxic: { type: "noul", noul: 0 },
        },
      }),
    ).toThrow();
  });
  it("shares token renewal and renews from expires_in before expiry", async () => {
    let now = 0;
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ access_token: "fixture-token", expires_in: 120 }),
          { status: 200 },
        ),
    );
    const tokens = new BitqueryTokens(
      "fixture-id",
      "fixture-secret",
      fetchImpl,
      () => now,
    );
    await Promise.all([tokens.get(), tokens.get()]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    now = 61000;
    await tokens.get();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("does not coerce absent market data to zero", () => {
    expect(
      parsePools(
        { data: [{ attributes: { address: "0x" + "1".repeat(40) } }] },
        0,
      ),
    ).toEqual([]);
    expect(() =>
      parseCandles({
        data: { attributes: { ohlcv_list: [[1, 1, 2, 0, 1, null]] } },
      }),
    ).toThrow();
  });
});
