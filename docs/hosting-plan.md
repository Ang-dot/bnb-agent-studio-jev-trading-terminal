# JEV Trading Terminal hosting plan

User-approved direction: NodeOps replaces AWS for backend hosting. On September 26, the user approved NodeOps's default region instead of requiring Singapore. This document is a plan, not a deployment record.

## Components

| Component | Target |
| --- | --- |
| Public read-only terminal | Cloudflare Pages; separate from the existing proposal site |
| API and continuous GMGN/JEV/X/memory worker | NodeOps CreateOS; provider default region |
| Durable ledger, decisions, evidence, monitor/replay state and worker lease | Dedicated PingCAP TiDB database |
| Semantic memory | Existing dedicated Living Brain brain |
| Operator authorization | Cloudflare Access plus backend token validation |
| Source | Private GitHub repository: https://github.com/Ang-dot/jev-trading-terminal |

## Deployment gates

- Authenticate NodeOps and verify continuous execution without visitor traffic. Default managed-app placement is approved; a temporary sandbox is not a substitute.
- Connect the NodeOps GitHub application only to the JEV repository. Confirm the actual permissions at installation; do not grant access to unrelated repositories.
- Review NodeOps runtime secret protection and outbound connectivity to the existing providers and TiDB before transmitting credentials.
- Keep all secrets, local databases, runtime observations, GMGN authentication material and private research outputs out of GitHub, container images and frontend bundles.
- Migrate all remaining local SQLite and JSON state, preserving the paper ledger and decision history.
- Require a database-backed single-worker lease across restarts and deployment overlap.
- Add public read-only API projections, bounded provider-backed reads and authenticated operator-only mutations.
- Verify the cloud service while paused before transferring operation from the laptop. Never run two active workers against the same agent session.
- Keep real execution locked. No wallet signing keys are needed for this paper-only release.

## Current status

- NodeOps CreateOS CLI v0.0.29 authenticated successfully; account is currently on the free plan.
- Private GitHub repository created and initial source published. The source passes 175 tests and the production build; a staged-file scan found no configured secret values or credential patterns. Local runtime data and private research outputs were not uploaded.
- Singapore (`sgp1`) is listed in the provider zone catalog, but the authenticated product catalog currently exposes no `vm-terminal` product. Standard app/runtime settings do not expose region selection. Neither fact establishes that this account can deploy the backend in Singapore.
- NodeOps dashboard and CLI authentication are complete. Its GitHub installation is connected; following explicit user approval, access was restricted to `Ang-dot/jev-trading-terminal`. A fresh NodeOps repository query returned exactly that one repository.
- The authenticated Node.js deployment form exposes no region selector. The user approved default-region deployment; Singapore is no longer a blocker.
- NodeOps project `a7d4ec88-7c7f-4192-8f86-793dbcd6baba` and production environment `c2fa75e1-49f8-4768-b4db-48149522cd19` were created in the default placement. Automatic environment promotion is disabled.
- A secret-free health probe (commit `29ea583`) is deployed and its HTTPS `/api/health` returns 200. It explicitly reports `agentRunning: false` and `phase: hosting-preflight`; it is not the terminal. No provider credentials or paper history have been uploaded. A duplicate probe triggered by the GitHub push was put to sleep; it can be awakened through NodeOps.
- Dedicated TiDB Starter cluster `10365232367702429721`, database `jev_terminal`, was provisioned in AWS Singapore. Its network allowlist includes only the migration operator's observed IPv4 and NodeOps's observed egress `49.12.122.157`, not a wildcard. The latter is observed, not guaranteed static: re-verify it after deployment changes. Monthly spend cap is currently $0; capacity/spend must be reviewed before ongoing use.
- A database-scoped SSL-required SQL user is configured. Live TiDB integration checks verified TLS, exclusive lease ownership, stale-writer rejection and durable records without changing the paper ledger. The new database does not yet contain the local ledger/history.
- Production adaptation is in progress: Access JWT validation, origin protection, shared read budgets, public-state projection and fenced TiDB storage have unit coverage. These modules are not yet wired into `server/index.ts`; the current Dockerfile runs only the safe health probe. Existing tests and TypeScript checks pass (181 tests).
- Cloudflare dashboard sign-in is complete. Zero Trust Free activation is blocked at checkout: the UI requires billing details, terms acceptance and authorization for overage charges. The user must complete or explicitly direct this step. Nothing was submitted.
- Remaining work: finish runtime wiring and durable state migration; set up operator Access; securely inject runtime provider configuration; deploy paused and verify no-visitor execution; publish the Cloudflare Pages terminal; then transfer the paper session from the laptop. The original local runtime is healthy and remains untouched.
- No AWS cloud resources were created. AWS CLI authorization is no longer the active deployment path.
