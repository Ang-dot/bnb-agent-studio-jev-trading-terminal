# Security

This is an experimental paper-trading demo, not audited production financial software. Live execution is locked. Public UI access does not make operator APIs, provider accounts or stored memory public.

## Reporting

Use GitHub private vulnerability reporting if enabled. Otherwise contact the repository maintainer privately to arrange disclosure. Do not open public issues containing secrets, private memory, account identifiers or exploits against a running deployment. Enable private reporting before publication; no response SLA is promised.

## Operation

- Use least-privilege provider accounts and a dedicated demo brain. Store secrets in ignored local configuration or protected runtime bindings.
- Rotate credentials previously shared in chat, logs, screenshots or other documents. Ignoring/removing files does not revoke keys or erase history.
- Never expose local mode publicly. Hosted operation requires the proxy/origin boundary, Access and backend verification documented in `docs/hosting-plan.md`.
- Protect state/backups: receipts and memory can contain private context even when token addresses are public.
- Never provide production secrets to untrusted fork workflows. CI needs no application credentials and does not deploy or arm trading.
- Pause execution during migration and verify single-worker ownership before resuming.

Secret scans and dependency audits reduce accidental exposure; they do not prove absence of vulnerabilities or authorize live trading. Security and rights review remain release gates.
