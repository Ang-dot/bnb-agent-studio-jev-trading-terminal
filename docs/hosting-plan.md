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
- Continuous-execution verification, production adaptation, state migration and deployment remain pending. No provider credentials have been uploaded to NodeOps and no compute resources have been provisioned.
- No AWS cloud resources were created. AWS CLI authorization is no longer the active deployment path.
