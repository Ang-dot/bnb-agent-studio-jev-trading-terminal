# JEV Trading Terminal

Private source repository for the BNB Chain paper-trading demo. The terminal follows Flap and Four.meme launches, collects supporting market and social evidence, records JEV assessments and paper results, and coordinates experience capture and recall with Living Brain.

## Current deployment status

The application runs locally. Cloud deployment is not complete. The approved target is Cloudflare Pages for the public terminal, NodeOps for the always-on backend in Singapore, TiDB for durable state, and Living Brain for semantic memory. See [the hosting plan](docs/hosting-plan.md) for migration and release gates.

The backend currently enforces localhost access and boots paused. Do not expose this development server directly to the internet. Public API filtering, operator authentication, complete durable-state migration and single-worker ownership are release requirements.

Real-money execution remains locked. No wallet signing key is required for this release.

## Local development

Requires Node.js 22.13 or newer and npm. GMGN discovery uses a separately installed and authenticated GMGN CLI; its credentials are not included in this repository.

```sh
npm ci
npm test
npm run build
npm start
```

The local terminal is served at `http://localhost:8787/`. Provider credentials belong in a local, ignored `.env.local` file or the deployment platform's protected runtime configuration. Never commit or upload that file with the source.

## Repository boundaries

- `src/`: terminal interface, charts, decision stream, supporting evidence and memory views.
- `server/`: market providers, JEV decision loop, paper execution, evidence, memory and storage.
- `docs/`: design notes, research basis and hosting requirements.
- Local `.data/` contains runtime state and must be migrated separately, not checked into Git.

Paper fills and replay results are simulated. Model outputs and social claims are not guarantees of profitable trading.
