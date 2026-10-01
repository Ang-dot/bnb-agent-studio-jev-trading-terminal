# Configuration

`.env.example` contains names without usable credentials. Local commands load `.env.local`; cloud services use protected runtime variables. Keep development and production accounts/state separate. Never include secrets in issues, logs, screenshots, fixtures or frontend variables.

| Capability | Provider / settings | When unavailable |
| --- | --- | --- |
| Launches, pool lookup, token-wide charts/metrics, evidence | GMGN CLI 1.6.6; `GMGN_CLI_PATH`, CLI authentication or `GMGN_API_KEY` | No synthetic data or silent substitution of a held pool |
| Typed judgment | OpenRouter `OPENROUTER_API_KEY`; optional `JEV_MODEL` | Assessment fails visibly |
| Contract-specific X context | Same OpenRouter key; `GROK_MODEL` defaults to `x-ai/grok-4.3` with native X search | Invalid/missing context blocks new entries |
| Timestamped pool prices and memory outcome marks | Bitquery `BITQUERY_CLIENT_ID`, `BITQUERY_CLIENT_SECRET` | No fill or outcome mark without fresh matching primary price |
| KBW memory search/storage | Mem9 Space `MEM9_API_KEY`; optional `MEM9_API_URL`, `MEM9_APP_ID` | Missing key disables KBW monitoring; failed recall blocks entries; uncertain writes are reconciled |
| TOKEN2049 memory search/capture | `LIVING_BRAIN_API_KEY`, `LIVING_BRAIN_SUBJECT_ID`, `LIVING_BRAIN_ID` | Failed recall blocks entries; capture failures are retained separately |
| Optional chain inspection | NodeReal `NODEREAL_API_KEY`; optional public `AGENT_WALLET_ADDRESS`, `AGENT_ID` | Inspection unavailable; no signer needed |
| Local storage | Blank `SUPABASE_DATABASE_URL`; ignored `.data/` | Private SQLite/JSON state created on first use |
| Cloud storage | `HOSTING_MODE=cloud`, `SUPABASE_DATABASE_URL` | Invalid/unreachable storage fails startup |

Grok handles contract-specific X research and defaults to `x-ai/grok-4.3`. JEV handles typed trading judgments and replay through a separate endpoint and defaults to `typesafe/jev-1.13`; `GROK_MODEL` does not replace `JEV_MODEL`. Restart the backend after changing local environment settings. Hosted services must receive the new values in their protected runtime variables.

Model defaults are in `server/providers.ts`, `server/research.ts` and `server/replay.ts`. Provider availability, schema support and billing can change. A generic chat model is not necessarily compatible with the JEV structured endpoint or native X tools.

**Local caution:** `WORKER_ENABLED=false` gates Supabase-backed worker startup. SQLite discovery can run while paper fills are paused. Starting the app is not a credential-verification-only command. Tests and builds do not require live credentials.

## Narrative potential and observed spread

New research carries the contract-matched GMGN name, ticker, `link.description` and `link.twitter_username`, including receipt times. Missing descriptions remain unknown. Metadata is bounded, untrusted text; a provider-listed handle does not verify ownership. Existing token-info reads supply these fields. Missing or stale metadata triggers one exact-pool refresh; if unavailable, research remains CA-only.

Grok first searches the exact BSC contract, then uses the remaining searches for the broader angle and counter-evidence suggested by the metadata. The same request is limited to three search calls, four contract posts and four theme posts, all within the previous 24 hours. The output allowance is 6,000 tokens with metadata (3,000 for CA-only research); this is not a dollar cost cap. Changed branding invalidates the research cache.

X requests are demand-driven by admitted assessments, not by every market-feed refresh or code-exit check. Both editions share a cache keyed by contract and branding, and simultaneous requests share one in-flight fetch. Successful results are reused for up to five minutes from the original search window (also bounded by the metadata receipt). For new/bonding tokens with a successful empty CA search, the next assessment can refresh after 90 seconds. This is eligibility for refresh, not a polling timer. Failed or unusable research retries after 1, 2, 4 and then 5 minutes; stale results never become valid entry evidence. A repeated market minute is skipped before metadata/X requests, and prices are refreshed again after research.

The decision evidence shows whether research came from a new request, cache or shared in-flight request. Its search-call count and reported cost belong to that original request and must not be summed across reused decisions. Operator state also includes process-session counters for provider requests, accepted search receipts, reported cost, cache hits, shared requests and failures. They reset on restart, include both editions, and are not a complete billing ledger. Historical records lack delivery counters, so retained decisions alone cannot establish all past X requests or spend.

Contract posts have `X` evidence IDs; broader-theme posts have `T` IDs. Theme posts need native citations and a completed broader search, but never count toward contract-linked social support. Grok assesses metadata fit, catalyst, originality, timing, community, KOL amplification and promotion. Unsupported findings become unknown. Spread counts cover only accepted contract posts; distinct handles do not establish independent authors, organic reach or verified KOL identities. This bounded sample does not measure market-wide spread or acceleration.

JEV separately assesses **Narrative potential** and **Observed token spread**. A strong angle requires supported fit, catalyst and timing; it can coexist with no CA-linked posts. The aggressive paper profile allows a $25 narrative-first probe when this angle has cited support, fresh metadata, positive fresh five-minute buying and a qualifying entry location. A failed search or ticker alone cannot qualify; token spread is still reported separately. Older records remain unchanged and show that narrative research was not collected.

The exact metadata, findings and citations are stored with the decision and its memory episode, linked to the existing 5- and 30-minute follow-up observations. Those observations support later evaluation; they do not establish a trading edge or causal benefit.

`WORKER_EDITIONS` selects background runtimes independently of paper arming. Use `WORKER_ENABLED=true` and `WORKER_EDITIONS=kbw` to run only KBW discovery, assessments and Mem9 capture in cloud mode. TOKEN2049 keeps its recorded history, but its monitor, memory outbox, inventory/exit loops and mutation endpoints remain inactive. Shared market discovery remains visible in both frontends. Omission preserves both editions; invalid or empty lists fail startup. Each edition's health/state reports its own `workerActive` value.

Cloud additionally needs `PUBLIC_ORIGIN`, `ORIGIN_SECRET` and Access settings. Pages needs only `BACKEND_ORIGIN` and `ORIGIN_SECRET`; all model/database/GMGN credentials belong on the backend. See [deployment](hosting-plan.md).

## Mem9 for KBW

Create or select a dedicated Space in the Mem9 console and use that Space's memory API key. The console's **Admin API keys** manage organizations/projects/spaces; those scopes are not the application's read/write credential. Put the Space key in `.env.local` for local use or protected backend variables for hosting. Do not place it in Pages bindings or any `VITE_*` variable.

```dotenv
MEM9_API_KEY=<your-space-api-key>
MEM9_API_URL=https://api.mem9.ai
MEM9_APP_ID=jev-kbw
```

`npm run memory:check` checks read access without starting discovery, making assessments or writing memories. Restart the backend after changing its environment. A frontend-only preview does not run the memory worker.

The direct integration uses Mem9's `X-API-Key` API at `/v1alpha2/mem9s/memories`, scoped by `appId`, agent `jev-kbw`, active pinned memories and the `jev-paper` tag. It stores exact bounded episodes synchronously and validates returned IDs and content hashes. The journal distinguishes local save, confirmed Mem9 storage, unconfirmed writes and later recall. Mem9 search scores are displayed as raw provider scores rather than Living Brain similarity percentages.

KBW recall runs a keyword lookup for the exact token contract and a separate semantic search for comparable paper episodes. It selects at most four distinct results, reserving room for exact-token decisions and measured follow-ups. Stored episodes remain unchanged; a structured, bounded projection of the observation, model assessment, outcome and limits is sent to JEV and shown in the terminal. The UI identifies records JEV marked unrelated and treats retrieval as evidence access, not a performance claim.

The durable outbox records a stable episode reference before dispatch. A timeout or restart with an unknown write result triggers lookups for that reference, without blindly resending the write. After 30 successful reconciliation checks with no confirmed record, the episode requires inspection; it remains saved locally. Do not manually requeue an unconfirmed episode until the remote reference has been checked.

No Living Brain history, local session files or other archives are imported. KBW starts with its own journal and memory scope. The [Mem9 skill](https://mem9.ai/SKILL.md) describes OpenClaw onboarding; this application uses the documented direct [memory API](https://github.com/mem9-ai/mem9/blob/main/docs/api/openapi.json) and does not install an OpenClaw plugin.

No GoPlus integration or independent migration gate is required for the active launch workflow. GMGN-reported graduation and absent risk flags are not safety guarantees.

DEX paper prices use the selected CoinGecko/GeckoTerminal trade adapter or Bitquery. Launch paper simulations use explicitly indicative GMGN token marks and do not require a DEX price connection. GMGN receipts are not provider price-as-of timestamps. See [the aggressive paper profile](aggressive-paper.md) for the current rules and price boundary.

The default paper profile now admits new/bonding launches before graduation and uses the principal-recovery ladder from [the strategy reference and implementation notes](aggressive-paper.md). Restart the backend to load the changes; deployment and arming remain separate actions.

### Release-scoped paper activation
`PAPER_ARM_RELEASE_KBW` (or `_TOKEN2049`) is an explicit operator opt-in. A new identifier arms that edition once after the worker lease is acquired, only with monitoring and discovery enabled and no stop latch. The armed state survives worker restarts with a new session identity. Manual pause/stop persists for the same release. Without the variable, startup remains paused. Disabled editions cannot arm. No live execution is enabled.
