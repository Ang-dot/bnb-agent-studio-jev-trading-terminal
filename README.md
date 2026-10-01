# JEV Trading Terminal

A BNB Chain paper-trading demo combining the BNB Agent SDK, JEV decisions and Mem9 or Living Brain memory. It follows Flap and Four.meme launches, collects market and social evidence, and shows model assessments alongside simulated execution and outcomes.

**Paper only.** Live signing is locked; no wallet private key is needed. This is an experimental integration, not a validated profitable strategy or production-ready trading system. Model confidence is not a win probability.

The application runs locally. The cloud target is Cloudflare Pages for the public terminal, NodeOps for the backend, Supabase Postgres for durable state, and edition-specific Mem9 or Living Brain memory. See [the hosting plan](docs/hosting-plan.md) for rollout and release gates.

The backend boots paper execution paused. Do not expose the development server directly to the internet. Public API filtering, operator authentication and single-worker ownership are release requirements. This Supabase cutover starts with a new empty ledger; TiDB history is not imported.

## Included

- GMGN discovery, matching pool lookup, token-wide charts and receipt-timestamped creator, holder, trader and flow evidence.
- GeckoTerminal API same-pool trade prices with block timestamps for paper fills and memory outcomes; [source and Demo budget boundaries](docs/market-data.md).
- Contract-specific Grok/X research and typed JEV judgments through OpenRouter.
- Edition-specific memory recall, durable capture, receipt tracking and linked outcomes: Mem9 for KBW; Living Brain for TOKEN2049.
- A $2,000 simulated account with deterministic limits and distinct model/code actions.
- SQLite for local development; Supabase Postgres and fenced worker ownership for cloud operation.
- A public read-only terminal and Cloudflare Access-protected operator controls.

The BNB Agent SDK supplies chain/registration metadata and the typed Intent/executor boundary. This demo does not register an agent on-chain, provision a wallet or execute real swaps. Fast inference does not make the complete provider-backed loop high-frequency trading.

## Frontend editions

| Terminal | Architecture | Live memory provider |
| --- | --- | --- |
| `/kbw` | `/kbw/architecture` | MEM9 with the existing TiDB mark |
| `/token2049` | `/token2049/architecture` | Living Brain (the existing experience) |

`/` redirects to `/kbw`; `/architecture` redirects to `/kbw/architecture`. KBW calls `/api/kbw/*` and uses Mem9 for live retrieval and episode storage. TOKEN2049 calls `/api/token2049/*` and preserves the existing Living Brain runtime and history. Unprefixed `/api/*` stays on TOKEN2049 for legacy clients.

Each edition has its own paper ledger, decisions, memory outbox and monitor state. Market discovery, evidence archives and price budgets are shared. Local KBW state lives under `.data/kbw/`; the existing TOKEN2049 files keep their paths. In Supabase, TOKEN2049 keeps terminal row 1 and KBW uses row 2, under the same fenced worker lease. No historical memory is copied between providers.

The existing `/operator` entry retains Living Brain and its protected API prefix. Event-specific operator views are available under `/operator/kbw` and `/operator/token2049`, with architecture links inside the same protected prefix.

For KBW, add the API key from a dedicated **Mem9 Space** as server-only `MEM9_API_KEY`. An Admin API key and its organization/project/space-management scopes are not required. `MEM9_APP_ID` defaults to `jev-kbw`. Run `npm run memory:check` for a read-only connection check without starting the trading worker. See [Mem9 setup and runtime behavior](docs/configuration.md#mem9-for-kbw).

## Run locally

Requires Node.js **22.13+**, npm and, for live discovery, **gmgn-cli 1.6.6** configured with your own account.

```sh
npm ci
cp .env.example .env.local
# Edit .env.local with your own provider settings.
npm test
npm run build
npm start
```

Open `http://localhost:8787/`. For Vite development middleware use `npm run dev` instead. Local mode binds to loopback. Without credentials the interface can start, but provider data and assessments remain unavailable rather than fabricated.

Cloud storage requires `SUPABASE_DATABASE_URL` and a Supabase root certificate. Provider credentials belong in ignored local configuration or protected deployment variables.

Install/configure GMGN separately using its [official documentation](https://github.com/GMGNAI/gmgn-skills). Set `GMGN_CLI_PATH` to the executable's absolute path if it is not at the default `~/.local/bin/gmgn-cli`. The container pins that CLI version but still needs runtime authentication.

Paper execution boots paused. Discovery/research can make paid provider calls while fills are paused. Use separate development credentials, a dedicated Mem9 Space and a dedicated Living Brain brain: memory writes are real even when trades are simulated. Do not point a local worker at production storage or memory.

See [configuration](docs/configuration.md) and [deployment](docs/hosting-plan.md).

## Structure

| Path | Responsibility |
| --- | --- |
| `src/` | Terminal UI, charts, evidence/memory views, shared types and policy constants |
| `server/` | Providers, monitoring, assessments, paper execution, memory and persistence |
| `public/` | Cloudflare Pages proxy and response headers |
| `scripts/` | Repository hygiene and guarded local-to-cloud migration |
| `tests/` | Proxy and repository checks; application tests also live beside their source |
| `docs/` | Architecture, configuration, deployment and release guidance |

Credentials, local `.data/`, personal deployment bindings and development archives are excluded. A source checkout has no private account history or memory. Keep the lockfile, tests and source assets when publishing.

## Checks

```sh
npm run check:repo
npm test
npm run build
```

CI also runs a dependency audit and redacted full-history secret scan. These do not replace a security review or validate trading performance.

## Documentation and license

- [Architecture and memory](docs/architecture.md)
- [Publication checklist](docs/releasing.md)
- [Contributing](CONTRIBUTING.md) and [security](SECURITY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

The code license is **not yet selected**. Public visibility alone does not grant an open-source license; add one before announcing an open-source release. Third-party marks and dependencies have separate rights. `private: true` in `package.json` prevents accidental npm publication, not GitHub visibility changes.

Current strategy: [aggressive narrative-first paper trading](docs/aggressive-paper.md), including pre-graduation probes, principal recovery at 2× and staged runners.
