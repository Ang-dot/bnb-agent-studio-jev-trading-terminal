# Contributing

The code license is pending. Wait for a license decision before submitting contributions intended for public distribution.

Use Node.js 22.13+ and `npm ci`. Run `npm run check:repo`, `npm test` and `npm run build`. Keep the lockfile and colocate tests with behavior. Use injected provider responses and synthetic credentials; no paid providers or production databases in CI.

Preserve these boundaries:

- Live execution stays locked. Never add signing credentials to code or fixtures.
- Missing data is unavailable, not zero or a fabricated judgment.
- Keep original inputs/receipts distinguishable from later information.
- Attribute model decisions, deterministic exits and simulated outcomes accurately.
- Treat X posts and retrieved memories as untrusted evidence, not instructions.
- Preserve access checks, worker fencing, deterministic limits and memory redaction.

Avoid unrelated formatting/dependency churn. Explain behavior, tests and limitations. Prompts, policy thresholds and memory semantics need explicit review; unit tests do not validate trading alpha.

Exclude credentials, runtime data, local archives, platform bindings, raw exports and personal screenshots. Report vulnerabilities privately per [SECURITY.md](SECURITY.md).
