# Agent Studio assessment service

The live launch and inventory assessment path uses `@bnbagent/studio-runtime` **0.0.14** with SDK **0.6.0**. The terminal worker submits a one-use assessment ticket over authenticated loopback HTTP. Studio's real `B402Seller.handle` invokes the custom work hook and returns its serialized deliverable. No direct-provider fallback exists in the engine.

## Ownership

| Layer | Responsibility |
| --- | --- |
| Studio runtime | HTTP work serving, FREE-mode dispatch and work timeout. No payment or settlement happens. |
| Custom work hook | X research, refreshed GMGN context, same-pool GeckoTerminal trade price, archived supporting evidence, Living Brain recall, JEV typed assessment. |
| Application adapter | Loopback binding, per-boot backend credential, one-use admission tickets, response correlation/integrity, cancellation, one in-flight task and 60-attempt/hour budget. These are not stock FREE-mode security features. |
| Paper engine | Current session and admission checks, policy, sizing, deduplication and atomic ledger mutation. Code exits remain independent of Studio/JEV. |
| Memory journal | Durable recording after the execution outcome, asynchronous Living Brain ingestion, follow-up observations and later recall links. |
| SDK | Chain constants, draft ERC-8004 metadata and unsigned Intent/executor boundary. No registered identity, commerce job or live swap is claimed. |

## Custom hosting, not managed deployment

The scaffold was inspected using `bag init` with an X402-only, custom-work configuration. The repo keeps its single npm lockfile and adapts the emitted work-serving pattern under `app/agent/`. It does not retain unused model, signing, wallet or cloud deployment stubs.

NodeOps runs the existing application and private service in **one Node process/container**. The service listens on `127.0.0.1` at an OS-assigned port. Only port 8787 is exposed. There is no public `/x402` route, new cloud resource, publicly callable agent or managed AgentCore deployment. This is an embedded service boundary, not independently isolated credentials or a standalone remote-agent deployment.

The work hook is replaceable, but the present HTTP contract intentionally accepts only one-use tickets issued by this worker. External clients and a separate-process service would need a separately designed authenticated input contract.

`studio.toml` explicitly selects zero-price work. In Studio that bypasses B402; it is **not** zero-value settlement. A required address-shaped constructor argument uses the zero address only because the FREE path never uses a payout wallet. No wallet is created, loaded or unlocked. Nonzero pricing is rejected at startup. Model auto-topups and ERC-8183 commerce are not enabled.

`bag deploy`, `bag doctor` and managed deployment readiness are not the deployment gates for this custom adapter; do not represent them as passed or deploy this TOML through the stock anonymous gateway. Changing deployment or payment mode needs a new review.

## Data and safety

- Research finishes before refreshing the execution-pool market snapshot. Original timestamps, token/pool identity, optional-field availability and cold-start semantics are retained.
- A ticket carries immutable input identity and the current application admission guard. It cannot be replayed or used to submit an arbitrary prompt.
- Each stage checks cancellation/admission before making its next request. The per-request abort signal is propagated to provider HTTP calls. GMGN CLI work may finish unwinding after cancellation; it cannot authorize a late model call or fill.
- An unavailable or invalid service response records a skipped decision. There is no model-only or synthetic fallback.
- Policy is rechecked against current durable state after delivery. Stop, pause and paper-session changes still prevent fills.
- Memory/outcome capture follows the existing durable outbox after the application knows whether a paper fill occurred. Service delivery does not mean a memory page was compiled.
- Historical candle replay remains a separate operator-triggered, non-trading experiment. It is not represented as a Studio + memory assessment or captured as live experience.

## Inspectable receipt

New assessment decisions include service/runtime versions, a request ID, delivered/stopped status and measured stage durations. JEV API round-trip is distinct from full pipeline time and does not measure model-internal inference latency. The terminal shows recorded evidence, retrieved memory IDs and current linked capture status. Historical decisions and code exits receive no invented Studio receipt.

The frontend never receives the private port, per-boot credential, provider secrets or an invocation capability. Public memory redaction remains in effect. Receipts do not establish profitability or causal memory benefit.

## Verification

Run `npm test`, `npm run build` and the source hygiene check. Tests exercise the actual Studio HTTP handler with mocked market/model providers, request authorization, replay rejection, payload integrity, closed-service behavior, the full engine-to-service-to-paper path and unchanged trading rules. Production verification must additionally confirm the private endpoint is not externally reachable, one worker owns the lease and paper execution stays paused. Provider quota failures are not integration successes.
