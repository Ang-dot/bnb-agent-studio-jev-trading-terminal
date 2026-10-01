# Architecture and limits

## Decision flow

1. **Observe:** GMGN snapshots populate Flap/Four.meme discovery and charts. Fresh new, bonding and graduated launches enter an attention screen, not automatic entry permission.
2. **Collect:** A market preflight skips already-assessed minutes before X research. After research, refresh the market again so a slow search cannot turn an old quote into a fill. Qualified tokens receive contract-bound X research, matching-pool observations and bounded creator/holder/trader/flow/depth evidence. Preserve identity, receipt times and missing fields.
3. **Recall:** Mem9 retrieves earlier context for KBW; Living Brain does so for TOKEN2049. No relevant memory is a valid cold start; a failed provider response is not.
4. **Assess:** JEV returns typed actions and evidence/memory classifications. The UI shows recorded inputs and citations, not private chain-of-thought or proof of source claims.
5. **Gate and simulate:** Deterministic code checks session, data, capital and inventory before a paper fill. The SDK Intent remains unsigned; live execution is locked.
6. **Capture and revisit:** Durable episodes, linked outcomes and compilation receipts make future recall inspectable. This is not model retraining.

## Model and code responsibilities

JEV combines contextual evidence and recalled observations into a judgment. Code owns arithmetic, permission, freshness, sizing and side effects. Supporting context can alter the model's action; individual evidence classifications are not new hard trading rules.

Each edition's monitor attempts one candidate per 30-second tick, with a 60-second token cooldown. The editions can assess independently. There is no 60-per-hour lockout: a shared pacer permits 30 actual JEV starts per rolling minute, reserving ten for held positions. It charges immediately before inference, so duplicate minutes and failed X research do not consume model capacity. Private Studio request envelopes are independently bounded to 60 per minute per edition, with one in flight. Code exits remain outside these assessment limits. Provider latency, missing evidence and cooldowns reduce activity. This is not sub-second end-to-end trading, regardless of inference speed.

Attention thresholds live in `src/monitoring.ts`; execution constants in `src/paper-settings.ts`, enforced by `server/policy.ts` and `server/exits.ts`. Defaults: $2,000 capital, $25 launch/narrative probes or $50 DEX starters, ten positions, $75 launch / $150 DEX remaining cost per token, aggregate cost capped at the smaller of $1,000 or 50% of initial capital. These are experimental simulation settings.

JEV SELL can close inventory. Separate code exits implement stop-loss, staged profit-taking and trailing rules and must not be presented as model judgments. The active monitor uses GMGN launch stages, without a separate on-chain migration test. Early positions follow a separate indicative paper path; see [aggressive-paper.md](aggressive-paper.md) for principal recovery, entry location, costs and graduation continuity.

## Memory writes and recall

`server/memory-loop.ts` records admitted observations, assessments, no-fill decisions, fills and linked outcomes through a durable outbox. Unchanged observations are deduplicated; retries use stable identifiers. Capture failure cannot undo a committed paper fill.

Five-/thirty-minute follow-ups retain actual elapsed time and available same-pool marks. Missing/stale marks stay unavailable. Quoted price changes are not realized profit or executable counterfactual returns. Descriptive reviews preserve sampling caveats and do not modify policy.

GMGN resolves matching pools and supplies token-wide chart/flow context plus pool liquidity. Bitquery supplies timestamped same-pool trade prices for paper fills and memory outcomes. API receipt time is not trade time. GeckoTerminal has been removed from runtime requests; historical records keep their original labels. [Provider boundaries and comparison](market-data.md).

Living Brain ingestion is asynchronous. Accepted, compiling, compiled and recalled are distinct states. Recall attribution requires a linked compiled page in a later recorded retrieval; it does not establish causal improvement. Reviewed bounded evidence, not complete raw archives, enters JEV/memory. Historical replay is excluded from live capture.

KBW uses the direct Mem9 API in `server/mem9.ts`. Exact pinned episodes are stored under the dedicated application/agent scope and receive a memory ID. A durable pre-dispatch reference makes uncertain writes reconcilable after restarts. Confirmed storage requires a matching content hash, and later recall attribution requires both that hash and memory ID. Mem9's retrieval score has its own scale; no Living Brain similarity threshold is applied. A missing key or failed search is never substituted with Living Brain results.

`server/edition-runtime.ts` wires separate providers, assessment services, engines, memory journals and monitor records for each edition. Existing TOKEN2049 state is retained. KBW starts in `.data/kbw/` locally or terminal row 2 in Supabase. Both use the same worker lease, market feed, X research cache, evidence archive and price budget; no historical memory migration occurs.

## Supporting evidence

| Input | Intended use | Unsupported inference |
| --- | --- | --- |
| Creator | Timestamped counts and bounded prior-launch examples | Win probability or targets from lifetime ATHs |
| Holder/trader | Tagged samples and matched-wallet share changes | Unique humans, or sales inferred from transfers |
| Flow | Buy/sell USD and rates within each window | Organic capital; overlapping windows cannot be added |
| Depth | Matching pool identity and model-specific illustration | Executable V3 depth from total TVL; guaranteed fills |
| X | Cited contract-matching context in a bounded window | Verified claims, endorsement or manipulation resistance |
| Memory | Prior episodes/outcomes with provenance | Alpha or causal value merely because recall succeeded |

## Storage and SDK

Local mode uses ignored SQLite/JSON state and loopback binding. Cloud uses Supabase Postgres, renewable leases and fenced writes. Pages serves public reads; operator writes require Access and backend verification. Secrets, raw exports and private brain context are not public source assets.

BNB Agent SDK 0.6.0 supplies chain constants, draft ERC-8004 metadata and Intent/executor types. A draft is not an on-chain registration. There is no authorized signer, verified live quote adapter or receipt reconciliation.

## Validation boundary

Tests verify parsing, chronology, identity, null semantics, persistence, policy and access controls. Candle-only replay is not a complete strategy backtest. Neither tests nor selected live receipts establish an edge or causal memory benefit.

Fixed paper fee/slippage assumptions do not fully model gas, taxes, MEV, depth, impact or failed fills. Stops cannot guarantee prices. Validate proposed thresholds on point-in-time held-out cohorts including failures and missing fields. Never backfill historical inputs using current creator, wallet or ATH data.
