# Maintainability and Refactor Summary

This document records the repository's current maintainability boundaries and
verified deferred work. It is not a replacement for the issue tracker or the
historical [issue remediation plan](issue-remediation-plan.md).

## Current architecture boundaries

- Next.js App Router pages and route handlers live under `app/`. Server
  components are the default; interactive forms and navigation use focused
  client components.
- Domain mutations are grouped under `lib/actions/`. Validation, authorization,
  calculation, email, receipt, OAuth, audit, and persistence helpers remain in
  `lib/` rather than React components.
- Prisma and SQLite are the only supported persistence path. Docker stores the
  database and receipt uploads under `/app/data`; Postgres URLs remain rejected.
- Authentication combines NextAuth sessions with database-backed user checks.
  OAuth callbacks validate state and PKCE and create the NextAuth session cookie
  server-side. Provider access and refresh tokens are not persisted.
- Audit records and structured application logs are separate. The logger applies
  a final redaction boundary, but call sites must still avoid raw secrets,
  request bodies, receipt contents, and authentication objects.

## Completed hardening visible in the repository

- Configuration validation rejects unsupported database engines and placeholder
  production secrets.
- Container startup runs non-root, validates existing SQLite files, applies
  migrations, preserves a validated legacy database path, and stops explicitly
  on invalid, inaccessible, or failed-migration states.
- Liveness and readiness are separate, with readiness checking configuration,
  database connectivity, and the bundled migration manifest.
- Disposable Docker probes cover fresh startup, restart idempotency, data
  preservation, legacy adoption, and failure behavior.
- Development, focused CI, enabled-receipt, and production-server Playwright
  runners use disposable databases, bounded readiness, and cleanup.
- Browser coverage includes auth, trips, expenses, accessibility, mobile Safari,
  receipt authorization, SEO metadata, and production chunk-load observation.
- CI includes formatting, linting, type checking, unit/integration tests,
  production browser smoke, dependency review, CodeQL, npm audit, Trivy scans,
  multi-architecture Docker builds, and runtime probes.

## Superseded mechanisms

- OAuth callbacks now create the session server-side; browser-delivered OAuth
  login-token handoff must not be reintroduced. Credential/MFA session-login
  tokens are a separate flow and remain subject to replay-safety work.
- Public receipt files are not used. Receipt bytes stay outside `public/` and are
  served through authenticated, trip-authorized routes.
- Relative Docker SQLite paths are rewritten to the persistent absolute path;
  local Playwright launchers explicitly override Docker-only paths.
- User-facing TripTally branding is superseded by SeddleUp. The remaining names
  and their owners are governed by the
  [compatibility migration plan](wiki/Compatibility-Name-Migration-Plan.md).

## Intentional compatibility boundaries

- The private package name, legacy `TRIPTALLY_*` environment fallbacks,
  validated `triptally.db` adoption, and selected synthetic test identifiers are
  deliberate—not unfinished user-facing rebranding.
- Standard NextAuth and generic OAuth transient cookie names are not TripTally
  compatibility names and should not be renamed for branding.
- Applied Prisma migration identifiers and historical reports remain truthful history.

## Known deferred work

- [#63](https://github.com/cryptnetworks/seddleup/issues/63): shared rate
  limiting before multi-replica application support.
- [#65](https://github.com/cryptnetworks/seddleup/issues/65): Postgres design,
  migrations, backup, rollback, and CI before accepting Postgres URLs.
- [#66](https://github.com/cryptnetworks/seddleup/issues/66): isolated ESLint 10
  and Node 26 upgrade windows after upstream compatibility.
- [#70](https://github.com/cryptnetworks/seddleup/issues/70),
  [#75](https://github.com/cryptnetworks/seddleup/issues/75), and
  [#98](https://github.com/cryptnetworks/seddleup/issues/98): browser-visible
  MFA secret regression coverage, recovery/admin reset, and atomic one-time
  credential consumption.
- [#93](https://github.com/cryptnetworks/seddleup/issues/93): final real-origin
  post-deployment SEO verification remains environment-dependent.
- [#97](https://github.com/cryptnetworks/seddleup/issues/97) and
  [#102](https://github.com/cryptnetworks/seddleup/issues/102): explicit safe
  participant and account deletion policies.
- [#99](https://github.com/cryptnetworks/seddleup/issues/99),
  [#100](https://github.com/cryptnetworks/seddleup/issues/100), and
  [#101](https://github.com/cryptnetworks/seddleup/issues/101): receipt file
  lifecycle, shared money precision, and complete itemized review workflows.

## Validation expectations for future cleanup

Run the checks required by [CONTRIBUTING.md](../CONTRIBUTING.md). Changes to
Docker, deployment profiles, documentation, authentication, or receipts should
also run their focused production/browser/profile probes. A refactor must keep
behavioral tests in place, avoid mixing compatibility renames with features, and
document any unavailable check rather than treating it as passed.
