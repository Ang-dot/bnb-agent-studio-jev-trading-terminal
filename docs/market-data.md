# Market-data boundaries

GMGN is the primary discovery, market-context and chart provider. GeckoTerminal requests and its runtime status entry have been removed. Bitquery retains one narrow role: **same-pool trade prices with actual block timestamps**, used for paper fills, exits and memory outcome marks.

## What each input means

| Input | Source | Scope and limits |
| --- | --- | --- |
| Flap/Four.meme stage | GMGN trenches | Provider-reported graduation, not independent migration proof |
| Token-to-pool mapping, liquidity | GMGN token info | Exact `pool.pool_address`, matching `base_address` and biggest-pool identity; Pancake V2/V3 only |
| Display price, rolling volume/change/counts | GMGN token info | Token-wide context; not an executable pool quote |
| Candles, including held tokens no longer in the launch feed | GMGN kline | Token-wide; never substituted for a pool trade price |
| Paper-fill and outcome price | Bitquery latest matching trade | Exact BSC pool/token, block time; freshness checked before use |
| Creator, holder/trader and flow research | GMGN evidence collector | Existing bounded evidence and caveats unchanged |

The info response uses `pool.address` for the token and `pool.pool_address` for the pool. They are not interchangeable. A held position or memory episode keeps its original pool. If GMGN changes its biggest pool, the original-pool read fails visibly; it is never silently redirected.

GMGN requests use the existing serialized read lane, cooldown and worker guard. Market reads are single-flight per token and cached for 30 seconds from request start. Cache hits retain original request/receipt timestamps. Missing required metrics, inconsistent identities, unsupported exchanges and overly delayed receipts fail closed; no zero/default or stale fallback is supplied to execution.

GMGN `creation_timestamp`, `open_timestamp` and `migrated_timestamp` are lifecycle times, not price-as-of times. Observed info/pool responses have no verified price-as-of field, so this remains `null`. `Snapshot.observedAt` uses the GMGN request start conservatively; `metricsReceivedAt` records receipt. `Snapshot.marketAt` remains the Bitquery trade block time. UI and JEV inputs distinguish token-wide metrics from pool-specific price/liquidity. Historical snapshots keep their original provenance.

Memory outcome marks also require a real same-pool trade at or after the due horizon, within the existing sampling window, and within the 90-second freshness bound. Missing marks stay unavailable. Observations with only a GMGN display price have `baseline.marketAt = null` and do not manufacture a trade timestamp.

## Bounded live comparison

Read-only checks on 2026-09-25 at approximately 21:11–21:14 UTC used the local adapter without starting a worker, executing trades, or writing memory.

| Sample | Launchpad | GMGN / GeckoTerminal pool identity | Bitquery pool+token match | Bitquery trade age at receipt |
| --- | --- | --- | --- | --- |
| GME · `0x38d58d65e280a3451634a09b2515015153bc7777` | Flap | Same | Yes | 30 seconds |
| PLANT · `0xde352cb981d2ab40bc4eeb09917950aa38d5ffff` | Four.meme | Same | Yes | 26 seconds |
| BRF · `0x2c5b84d4ab2256d987a6fc094e1e764d9e9b7777` | Flap | Same | Yes | 67 seconds |

PLANT also returned 27 five-minute GMGN candles. GMGN info and pool responses lacked a price-as-of timestamp. The initial Bitquery check used a local file without credentials; the successful check used only existing hosting Bitquery credentials, without accessing production storage.

This is a schema/identity smoke test, not a synchronous quote-parity test, coverage guarantee or strategy backtest. Sequential prices differed and cannot establish executable-price equivalence. Bitquery cannot be removed from this implementation until a verified alternative supplies both exact-pool identity and actual price time. No trading thresholds, capital, sizing or ledger contents were changed.

References: [GMGN Agent API](https://docs.gmgn.ai/index/gmgn-agent-api), [GMGN token skill](https://github.com/GMGNAI/gmgn-skills/blob/main/skills/gmgn-token/SKILL.md), [GMGN market skill](https://github.com/GMGNAI/gmgn-skills/blob/main/skills/gmgn-market/SKILL.md). Runtime fields were checked against CLI 1.6.6 responses; documentation and responses can differ.
