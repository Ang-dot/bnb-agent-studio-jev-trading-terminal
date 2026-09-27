# Public-release checklist

Working-tree cleanup does not change visibility, erase history or grant an open-source license. Complete these gates before publication:

- [ ] Select the code license and add `LICENSE` plus matching package metadata. Retain `private: true` unless npm publication is separately intended.
- [ ] Review bundled logo redistribution/trademark rights and dependency notices.
- [ ] Decide whether to retain Git history. Earlier commits include deployment-specific identifiers/hostnames even though current docs are generic. If these must remain private, explicitly approve a clean public history or rewrite, then re-scan every ref. Ignore rules do not remove history.
- [ ] Rotate credentials previously shared outside protected secret storage.
- [ ] Run `npm run check:repo`, `npm test`, `npm run build`, `npm audit` and redacted Gitleaks scans of all refs and intended release files.
- [ ] Review branches, tags, releases, CI artifacts/logs, issues, PRs and LFS objects. Local scans do not cover all GitHub metadata or old archives.
- [ ] Enable secret scanning/push protection where available, private vulnerability reporting and branch protection. Verify CI on the intended release commit.
- [ ] Review GitHub app scopes/collaborators and automatic build triggers before pushing or changing visibility; documentation changes can trigger backend builds.
- [ ] Verify public assets/API responses contain no secrets or private memory and confirm production/preview Access boundaries.
- [ ] Review the exact source tree and publish only after remaining gates are approved.

## Kept local

Environment files, `.data/`, `.local-notes/`, raw research exports, personal tooling, dependencies and generated builds are excluded from source deliverables. Preserve operational backups privately. Never upload an unfiltered repository-folder ZIP; use a reviewed source export or commit archive.

CI runs with read-only permissions, no provider credentials, tests/build/audit and a checksum-pinned Gitleaks history scan. It never runs migration, provider research, deployment or paper arming. Review failures privately and redact sensitive details.
