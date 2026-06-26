# Proposed GitHub Issue Backlog

## Status

GitHub CLI access was available, so the standardized labels were created and
the backlog issues were opened directly in GitHub. This document records the
created backlog and proposes milestones because the repository currently has no
milestones.

## Proposed Milestones

- `Release Blockers`: P0 issues and any P1 issue required before the next public
  production release.
- `Reliability Hardening`: deployment, Docker, CI, rate-limit, and production
  E2E reliability work.
- `Test Coverage`: E2E, regression, and snapshot coverage improvements.
- `Documentation Polish`: release, deployment, architecture, and compatibility
  documentation.
- `Future Enhancements`: deferred runtime, database, and compatibility
  migration plans.

## Created Issues

| Issue                                                                                                                                 | Priority | Risk   | Suggested Milestone   |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | --------------------- |
| [#59 [MFA] Prevent email MFA lockout when SMTP is unavailable](https://github.com/cryptnetworks/seddleup/issues/59)                   | P0       | High   | Release Blockers      |
| [#60 [Testing] Add enabled receipt upload and review E2E coverage](https://github.com/cryptnetworks/seddleup/issues/60)               | P1       | Medium | Test Coverage         |
| [#61 [CI] Add Docker build and runtime migration probes](https://github.com/cryptnetworks/seddleup/issues/61)                         | P1       | Medium | Reliability Hardening |
| [#62 [Docker] Add profile smoke tests for Discord, nginx, and Cloudflare](https://github.com/cryptnetworks/seddleup/issues/62)        | P2       | Medium | Reliability Hardening |
| [#63 [Security] Add shared-store rate limiting for multi-replica deployments](https://github.com/cryptnetworks/seddleup/issues/63)    | P2       | Medium | Reliability Hardening |
| [#64 [Mobile] Track WebKit Turbopack ChunkLoadError warnings](https://github.com/cryptnetworks/seddleup/issues/64)                    | P2       | Medium | Test Coverage         |
| [#65 [Database] Design Postgres support before accepting Postgres URLs](https://github.com/cryptnetworks/seddleup/issues/65)          | P3       | High   | Future Enhancements   |
| [#66 [Dependencies] Plan ESLint 10 and Node 26 upgrade windows](https://github.com/cryptnetworks/seddleup/issues/66)                  | P3       | Medium | Future Enhancements   |
| [#67 [Docs] Add production deployment checklist](https://github.com/cryptnetworks/seddleup/issues/67)                                 | P2       | Low    | Documentation Polish  |
| [#68 [Docs] Add release checklist](https://github.com/cryptnetworks/seddleup/issues/68)                                               | P2       | Low    | Documentation Polish  |
| [#69 [Branding] Plan safe migration for deferred TripTally compatibility names](https://github.com/cryptnetworks/seddleup/issues/69)  | P3       | Medium | Future Enhancements   |
| [#70 [MFA] Add browser-level regression for setup secrets not appearing in URLs](https://github.com/cryptnetworks/seddleup/issues/70) | P2       | Medium | Test Coverage         |
| [#71 [SSO] Document server-side OAuth session callback flow](https://github.com/cryptnetworks/seddleup/issues/71)                     | P2       | Medium | Documentation Polish  |
| [#72 [Email] Add template snapshot coverage for SeddleUp branding](https://github.com/cryptnetworks/seddleup/issues/72)               | P2       | Low    | Test Coverage         |
| [#73 [Refactor] Publish maintainability cleanup summary and remaining debt](https://github.com/cryptnetworks/seddleup/issues/73)      | P2       | Low    | Documentation Polish  |
| [#74 [Testing] Add production-server E2E mode](https://github.com/cryptnetworks/seddleup/issues/74)                                   | P2       | Medium | Reliability Hardening |
| [#75 [MFA] Add recovery codes or admin reset for locked MFA accounts](https://github.com/cryptnetworks/seddleup/issues/75)            | P1       | High   | Release Blockers      |
| [#76 [Backups] Add SQLite backup and restore validation runbook](https://github.com/cryptnetworks/seddleup/issues/76)                 | P1       | Medium | Reliability Hardening |
| [#77 [Security] Add log redaction regression tests for secrets and tokens](https://github.com/cryptnetworks/seddleup/issues/77)       | P2       | Medium | Test Coverage         |
| [#78 [Docs] Add markdown and link checking to documentation validation](https://github.com/cryptnetworks/seddleup/issues/78)          | P2       | Low    | Documentation Polish  |
| [#79 [Testing] Add accessibility smoke tests for auth and expense forms](https://github.com/cryptnetworks/seddleup/issues/79)         | P2       | Medium | Test Coverage         |
| [#80 [Deployment] Test restore from legacy TripTally database path](https://github.com/cryptnetworks/seddleup/issues/80)              | P2       | Medium | Reliability Hardening |
| [#81 [Observability] Add readiness diagnostics for config and database state](https://github.com/cryptnetworks/seddleup/issues/81)    | P2       | Medium | Reliability Hardening |

## Resolved Audit Items Not Reopened

The original audit issues for authenticator setup URL leakage, legacy OAuth
handoff cleanup, SQLite-only database validation, rate-limit documentation,
Mobile Safari decimal expense coverage, email branding regressions, README
screenshot placeholders, and the Node.js 24 LTS upgrade were not reopened as
bugs because the remediation plan records them as fixed. Follow-up issues were
created only where additional regression coverage, CI automation, documentation,
or future migration planning remains useful.
