# Deployment

The reference layout uses Cloudflare Pages for the browser, NodeOps for the always-on API/worker, Supabase Postgres for durable state, and a dedicated Living Brain brain. Provision your own resources. Production account IDs, operator identities, database URLs and platform bindings are intentionally not included.

## Frontend and access

Build with `npm ci && npm run build`, then publish `dist/` as a Cloudflare Pages project. `public/_worker.js` becomes the Pages advanced-mode worker. Configure server-side bindings `BACKEND_ORIGIN` and `ORIGIN_SECRET`; never put these in `VITE_` variables.

The current proxy accepts HTTPS NodeOps origins ending in `.nodeops.app`. A different host or custom domain needs an explicit, tested allowlist change.

- Public `/` and `/api/*` routes are read-only.
- Protect both `/operator` and `/operator/*` with Cloudflare Access, including API routes.
- Restrict access to the intended operator and configure `CF_ACCESS_ISSUER`, `CF_ACCESS_AUDIENCE` and `OPERATOR_EMAIL` on the backend.
- The proxy strips visitor credentials and adds a private origin secret. Only operator requests forward an Access assertion; the backend independently verifies it.
- Protect previews too. Do not publish an unprotected alternative operator hostname.

## API and worker

The Dockerfile builds an API-only Node 22 image with pinned GMGN CLI and BNB Agent SDK. Start with one replica. Supply credentials through protected runtime configuration, not build arguments.

Cloud mode needs `HOSTING_MODE=cloud`, an exact HTTPS `PUBLIC_ORIGIN`, a random `ORIGIN_SECRET` of at least 32 characters and a TLS-capable `SUPABASE_DATABASE_URL`. The origin secret must match Pages. Use a database-scoped role with privileges on `jev_private`, and restrict database network access to required backend egress where possible. The Postgres client verifies TLS certificates; set `SUPABASE_DB_CA_PATH` to Supabase’s downloaded root certificate locally, or `SUPABASE_DB_CA_BASE64` as a protected runtime binding when the container has no certificate file. Use a direct connection with IPv6, otherwise the session pooler.

Supabase Postgres persists the ledger, decisions, memory journal, research archive, launch/replay/monitor state, cooldown and ownership lease. Versioned journal compression is lossless, not encryption. Protect database backups as private records.

Keep `WORKER_ENABLED=false` during provisioning. Worker startup and paper arming are separate. Cloud ownership leases are renewed and writes are fenced; acquiring ownership or restarting pauses paper execution.

## Fresh Supabase start

This cutover starts with an empty, paused ledger. The previous TiDB journal is not imported; retain the old instance separately if historical records are needed later. Verify the new private schema, an empty evidence archive, and denied `anon`/`authenticated` schema access before enabling the worker. Enabling the worker does not arm paper execution.

## Existing local data

Skip migration for a fresh account. Otherwise:

1. Back up private state, pause and stop the local worker, and wait for in-flight work to finish.
2. Disable the cloud worker and configure its destination database.
3. Review `scripts/migrate-cloud.ts` before invoking it with an explicit source and `--apply`:

   ```sh
   WORKER_ENABLED=false node --import tsx --env-file=.env.hosting.local scripts/migrate-cloud.ts /absolute/path/to/source/.data --apply
   ```

4. Verify the receipt, ledger, decisions, memory and evidence before enabling the cloud worker. The script refuses an active endpoint at the default local port, another cloud lease or a nonempty destination journal. Stop custom-port source workers manually too.
5. Preserve the original backup privately; never commit database files or exports.

## Verification

- Public reads work; anonymous writes fail; operator routes require Access.
- Direct backend state reads fail without the origin secret; only non-sensitive health is public.
- Health reports paper mode and `liveExecution: false`.
- Exactly one worker owns the lease. After explicit operator arming, timestamps advance without an open browser.
- Public responses/assets/logs contain no credentials or private brain context.
- Check GitHub build and promotion behavior before pushing: documentation commits can trigger connected deployments too.

Do not deploy, migrate or arm trading in CI. Provider/storage failures must not generate synthetic fills. This guide is not an uptime, security or profitability guarantee.
