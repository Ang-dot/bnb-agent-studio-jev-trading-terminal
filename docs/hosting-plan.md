# JEV Trading Terminal hosting

Approved: NodeOps default region replaces AWS. Cloudflare Pages serves the frontend; dedicated TiDB stores durable state. No AWS resources were created.

| Component | Location |
| --- | --- |
| Public read-only terminal | https://jev-trading-terminal.pages.dev |
| Private operator terminal | https://jev-trading-terminal.pages.dev/operator |
| API and continuous worker | https://production-jev-trading-terminal.tyzo.nodeops.app |
| Private source | https://github.com/Ang-dot/jev-trading-terminal |
| Database | TiDB jev_terminal, cluster 10365232367702429721, AWS Singapore |
| Semantic memory | Existing dedicated Living Brain brain |

## Access and operation

- Public requests cannot mutate state. Pages strips visitor authentication headers and adds a private origin secret server-side. Direct origin requests are denied except for non-sensitive health.
- Cloudflare Access protects /operator, allowing only the approved operator email, with a 24-hour session and HTTP-only path-scoped cookie. Backend JWT verification independently checks signature, issuer, audience, expiry and exact email.
- Provider credentials are NodeOps runtime configuration. Pages receives only the backend URL and proxy secret. No secrets, local databases or private research files are published to GitHub or frontend assets.
- The image contains BNB Agent SDK and pinned GMGN CLI. Read-only GMGN needs only its API key; no signing private key or wallet signing key is deployed. Real execution remains locked.
- One NodeOps replica: 500m CPU and 1024 MB. TiDB ownership leases fence writes and guard provider calls. New deployments boot paper execution paused; WORKER_ENABLED separately gates worker startup.
- GitHub pushes automatically build deployments. Production promotion is manual: do not create a duplicate deployment after pushing. Unpromoted instances without runtime configuration fail closed.
- TiDB stores the ledger, decisions, local memory journal, raw and normalized research archive, replay/monitor state, GMGN cooldown and worker lease. Versioned lossless compression keeps the journal within TiDB's 6 MB per-entry limit; legacy JSON rows remain readable.
- Shared read budgets and caches bound chart queries. Opening a page never triggers a model assessment by itself.

## Verified before cutover

- Frontend published. Public page returns 200; public writes return 403; unauthenticated operator paths redirect to Access. Operator login reaches private controls.
- Backend responds through NodeOps and Pages with hosting cloud, liveExecution false and workerActive false before migration. Direct origin state reads return 403.
- Tests cover JWT validation, redaction, proxy boundaries, read budgets, worker fencing, drainage and lossless journal round-trip.
- The original laptop JEV worker was paused and stopped after its active assessment finished. Its original databases remain intact.
- Migration script scripts/migrate-cloud.ts requires an explicit source and --apply. It refuses an active laptop endpoint, another cloud lease or overwrite of a nonempty cloud ledger. Evidence import is idempotent; the ledger, decisions and memory journal are checked for exact equality. Cloud worker remains disabled until verified migration is complete.

## Operational constraints

- TiDB permits exact observed migration and NodeOps IPv4 addresses, not a wildcard. NodeOps egress is observed, not guaranteed static; recheck connectivity after placement changes.
- TiDB monthly spend cap is currently $0. Review usage before free capacity is exhausted. Storage errors fail closed rather than reset history.
- Verify no-visitor execution by observing autonomous timestamps with the terminal closed. This does not establish an uptime SLA.
- NodeOps project a7d4ec88-7c7f-4192-8f86-793dbcd6baba; production environment c2fa75e1-49f8-4768-b4db-48149522cd19.
- Operator Access application 74f7b331-b428-4dab-9265-deff89e09aea. Previews have a separate Access policy. The existing proposal site is untouched.
