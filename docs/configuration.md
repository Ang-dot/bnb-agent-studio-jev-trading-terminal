# Configuration

`.env.example` contains names without usable credentials. Local commands load `.env.local`; cloud services use protected runtime variables. Keep development and production accounts/state separate. Never include secrets in issues, logs, screenshots, fixtures or frontend variables.

| Capability | Provider / settings | When unavailable |
| --- | --- | --- |
| Launches, pool lookup, token-wide charts/metrics, evidence | GMGN CLI 1.6.6; `GMGN_CLI_PATH`, CLI authentication or `GMGN_API_KEY` | No synthetic data or silent substitution of a held pool |
| Typed judgment | OpenRouter `OPENROUTER_API_KEY`; optional `JEV_MODEL` | Assessment fails visibly |
| Contract-specific X context | Same OpenRouter key; optional `GROK_MODEL` supporting native X search | Invalid/missing context blocks new entries |
| Timestamped pool prices and memory outcome marks | Bitquery `BITQUERY_CLIENT_ID`, `BITQUERY_CLIENT_SECRET` | No fill or outcome mark without fresh matching primary price |
| KBW memory search/storage | Mem9 Space `MEM9_API_KEY`; optional `MEM9_API_URL`, `MEM9_APP_ID` | Missing key disables KBW monitoring; failed recall blocks entries; uncertain writes are reconciled |
| TOKEN2049 memory search/capture | `LIVING_BRAIN_API_KEY`, `LIVING_BRAIN_SUBJECT_ID`, `LIVING_BRAIN_ID` | Failed recall blocks entries; capture failures are retained separately |
| Optional chain inspection | NodeReal `NODEREAL_API_KEY`; optional public `AGENT_WALLET_ADDRESS`, `AGENT_ID` | Inspection unavailable; no signer needed |
| Local storage | Blank `SUPABASE_DATABASE_URL`; ignored `.data/` | Private SQLite/JSON state created on first use |
| Cloud storage | `HOSTING_MODE=cloud`, `SUPABASE_DATABASE_URL` | Invalid/unreachable storage fails startup |

Model defaults are in `server/providers.ts`, `server/research.ts` and `server/replay.ts`. Provider availability, schema support and billing can change. A generic chat model is not necessarily compatible with the JEV structured endpoint or native X tools.

**Local caution:** `WORKER_ENABLED=false` gates Supabase-backed worker startup. SQLite discovery can run while paper fills are paused. Starting the app is not a credential-verification-only command. Tests and builds do not require live credentials.

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

The durable outbox records a stable episode reference before dispatch. A timeout or restart with an unknown write result triggers lookups for that reference, without blindly resending the write. After 30 successful reconciliation checks with no confirmed record, the episode requires inspection; it remains saved locally. Do not manually requeue an unconfirmed episode until the remote reference has been checked.

No Living Brain history, local session files or other archives are imported. KBW starts with its own journal and memory scope. The [Mem9 skill](https://mem9.ai/SKILL.md) describes OpenClaw onboarding; this application uses the documented direct [memory API](https://github.com/mem9-ai/mem9/blob/main/docs/api/openapi.json) and does not install an OpenClaw plugin.

No GoPlus integration or independent migration gate is required for the active launch workflow. GMGN-reported graduation and absent risk flags are not safety guarantees.

GeckoTerminal is no longer a runtime dependency. Historical records retain its provenance. Bitquery remains required: observed GMGN token/pool responses do not provide a price-as-of timestamp. See [market-data boundaries](market-data.md).
