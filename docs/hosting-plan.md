# JEV Trading Terminal hosting plan

User-approved direction: NodeOps replaces AWS for backend hosting. Singapore is the required backend location. This document is a plan, not a deployment record.

## Components

| Component | Target |
| --- | --- |
| Public read-only terminal | Cloudflare Pages; separate from the existing proposal site |
| API and continuous GMGN/JEV/X/memory worker | NodeOps CreateOS; Singapore availability must be verified before provisioning |
| Durable ledger, decisions, evidence, monitor/replay state and worker lease | Dedicated PingCAP TiDB database |
| Semantic memory | Existing dedicated Living Brain brain |
| Operator authorization | Cloudflare Access plus backend token validation |
| Source | Private GitHub repository: https://github.com/Ang-dot/jev-trading-terminal |

## Deployment gates

- Authenticate NodeOps and verify Singapore placement and continuous execution without visitor traffic. Do not silently substitute another region or a temporary sandbox.
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
- Private GitHub repository created and verified. Initial source passes 175 tests and the production build; a staged-file scan found no configured secret values or credential patterns.
- Singapore (`sgp1`) is listed in the provider zone catalog, but the authenticated product catalog currently exposes no `vm-terminal` product. Standard app/runtime settings do not expose region selection. Neither fact establishes that this account can deploy the backend in Singapore.
- NodeOps reports no connected GitHub installations. Its dashboard requires a separate sign-in to authorize repository access.
- GitHub app connection, Singapore placement, continuous-execution verification, production adaptation, state migration and deployment remain pending.
- No AWS cloud resources were created. AWS CLI authorization is no longer the active deployment path.
