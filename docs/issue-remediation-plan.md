# SeddleUp Issue Remediation Plan

Last audited: July 15, 2026

Source: open GitHub issues in `cryptnetworks/seddleup`, issues #59 through #81.
No GitHub issues or labels were modified during this audit.

Current batch: issues #74, #64, #79, #60, #77, and #93 are implemented on
`agent/production-e2e-readiness`. #64 reproduced twice in a full Mobile Safari
development run and was classified as Turbopack development HMR invalidation;
repeated production route checks stayed clean. A separate local-HTTP production
WebKit action timeout remains documented. The acceptance mapping and commands
are in `docs/wiki/Testing-and-Production-Readiness.md`.

Data-integrity batch: #98, #99, #100, and #102 are implemented on
`agent/data-integrity-hardening`; the acceptance mapping, migrations, rollback
boundary, and focused verification are recorded in
[`docs/data-integrity-hardening.md`](data-integrity-hardening.md). The current
financial relations for #97 are protected. The settlement integration adds the
remaining sender and recipient restrictions and coverage, completing the
participant-deletion policy without reassigning or deleting financial history.
Issue #101 builds on this merged receipt-lifecycle and money-validation base in
its own focused branch. It adds editable item assignment, cent-exact review
reconciliation, and atomic, idempotent expense synchronization.

Settlement payments add a dedicated `TripPayment` ledger, creditor-linked
confirmation permissions for non-viewer trip members, adjusted balance
calculations, authenticated history and management routes, migration coverage,
and private audit events. Viewers remain read-only, and role alone never permits
a user to confirm receipt on another participant's behalf. The ledger remains
separate from external `PaymentMethod` profiles and anonymous trip sharing.

## Label Cleanup

The repository currently uses labels such as `type:bug`, `priority:p0`,
`area:auth`, `status:ready`, and `risk:high`. New triage can add the requested
labels alongside the current set, then migrate saved views and automation later.

- Type: `bug`, `enhancement`, `feature`, `documentation`, `security`,
  `testing`, `technical-debt`, `infrastructure`, `performance`, `ui-ux`
- Priority: `priority:critical`, `priority:high`, `priority:medium`,
  `priority:low`
- Difficulty: `size:xs`, `size:s`, `size:m`, `size:l`, `size:xl`
- Status: `blocked`, `needs-design`, `needs-discussion`, `ready`,
  `in-progress`
- Area: `backend`, `frontend`, `database`, `docker`, `auth`, `api`, `mobile`,
  `discord`, `receipts`, `payments`, `ci`, `docs`

Priority mapping for existing labels:

- `priority:p0` -> `priority:critical`
- `priority:p1` -> `priority:high`
- `priority:p2` -> `priority:medium`
- `priority:p3` -> `priority:low`

## Issue Inventory

Each entry lists the current labels and the labels still missing from the
requested taxonomy.

### #59 - MFA: prevent email MFA lockout when SMTP is unavailable

- Category: Bug, Security
- Priority: Critical
- Size: M
- Current labels: `priority:p0`, `type:bug`, `type:security`, `area:auth`,
  `area:mfa`, `area:email`, `status:ready`, `risk:high`
- Missing standardized labels: `bug`, `security`, `priority:critical`,
  `size:m`, `ready`, `auth`, `backend`
- Dependencies and notes: first implementation candidate. Related to #75 but
  not blocked by it. Main risk is auth lockout or authenticator MFA regression.

### #60 - Testing: add enabled receipt upload and review E2E coverage

- Category: Testing
- Priority: High
- Size: M
- Current labels: `priority:p1`, `type:test`, `area:testing`,
  `area:deployment`, `status:ready`, `risk:medium`
- Missing standardized labels: `testing`, `priority:high`, `size:m`, `ready`,
  `receipts`, `frontend`
- Dependencies and notes: should follow core release blockers. Depends on stable
  receipt upload fixtures and test environment setup.
- Implementation status: enabled upload, parse/review, owner download,
  unauthenticated/cross-user denial, disabled-state, and temporary-file cleanup
  are covered by an isolated Chromium runner and CI step.

### #61 - CI: add Docker build and runtime migration probes

- Category: Infrastructure, Testing
- Priority: High
- Size: M
- Current labels: `priority:p1`, `type:test`, `type:chore`, `area:docker`,
  `area:ci`, `area:deployment`, `status:ready`, `risk:medium`
- Missing standardized labels: `infrastructure`, `testing`, `priority:high`,
  `size:m`, `ready`, `docker`, `ci`
- Dependencies and notes: enables stronger validation for #62, #74, #80, and
  #81. Main risk is CI runtime and cost.
- Implementation status: in progress on `agent/docker-runtime-probes` together
  with tightly related #80. A local/CI probe covers fresh migrations, health,
  non-root startup, restart idempotency, data preservation, and explicit corrupt,
  inaccessible, and failed-migration behavior using disposable Docker volumes.

### #62 - Docker: add profile smoke tests for Discord, nginx, and Cloudflare

- Category: Infrastructure, Testing
- Priority: Medium
- Size: M
- Current labels: `priority:p2`, `type:test`, `area:docker`, `area:ci`,
  `area:deployment`, `status:ready`, `risk:medium`
- Missing standardized labels: `infrastructure`, `testing`, `priority:medium`,
  `size:m`, `ready`, `docker`, `ci`, `discord`
- Dependencies and notes: can build on #61. External-service profiles must stay
  credential-free in CI.
- Implementation status: `test:docker:profiles` validates all Compose profiles,
  proves Discord registration is callable without npm, syntax-checks rendered
  nginx, and validates Cloudflare ingress with fake inputs and disabled external
  networking. The existing Docker workflow runs it after runtime probes.

### #63 - Security: add shared-store rate limiting for multi-replica deployments

- Category: Security, Enhancement, Infrastructure
- Priority: Medium
- Size: L
- Current labels: `priority:p2`, `type:security`, `type:enhancement`,
  `area:auth`, `area:deployment`, `status:ready`, `risk:medium`
- Missing standardized labels: `security`, `enhancement`, `infrastructure`,
  `priority:medium`, `size:l`, `ready`, `auth`, `backend`
- Dependencies and notes: split if implementation selects a new store
  dependency. Preserve the in-memory default.

### #64 - Mobile: track WebKit Turbopack ChunkLoadError warnings

- Category: Bug, Testing, UX/UI
- Priority: Medium
- Size: S
- Current labels: `priority:p2`, `type:bug`, `type:test`, `area:mobile`,
  `area:ios`, `area:testing`, `status:needs-triage`, `risk:medium`
- Missing standardized labels: `bug`, `testing`, `ui-ux`, `priority:medium`,
  `size:s`, `needs-discussion`, `mobile`
- Dependencies and notes: needs reproduction before code. Complements #74. Not
  stale, but intentionally observational.
- Implementation status: a full development matrix reproduced the non-failing
  warning twice in the Turbopack HMR client; repeated production WebKit route
  checks stayed clean. Two CI repetitions later reproduced HMR invalidation and
  stalled layout navigation. CI now uses a bounded development-server matrix;
  the full matrix remains available locally. Production checks fail on chunk
  errors, no browser errors are globally suppressed, and the development-only
  classification and narrow mitigation are documented. A distinct local-HTTP
  production action timeout remains recorded separately.

### #65 - Database: design Postgres support before accepting Postgres URLs

- Category: Feature, Enhancement, Technical Debt
- Priority: Low
- Size: XL
- Current labels: `priority:p3`, `type:enhancement`, `area:database`,
  `area:prisma`, `area:deployment`, `status:ready`, `risk:high`
- Missing standardized labels: `feature`, `enhancement`, `technical-debt`,
  `priority:low`, `size:xl`, `needs-design`, `database`
- Dependencies and notes: should be design-only first. Split design from
  implementation and migration work.

### #66 - Dependencies: plan ESLint 10 and Node 26 upgrade windows

- Category: Technical Debt, Infrastructure
- Priority: Low
- Size: M
- Current labels: `priority:p3`, `type:chore`, `area:ci`,
  `area:dependencies`, `status:blocked`, `risk:medium`
- Missing standardized labels: `technical-debt`, `infrastructure`,
  `priority:low`, `size:m`, `blocked`, `ci`
- Dependencies and notes: blocked on upstream compatibility and Node 26 LTS
  timing. Do not implement yet.

### #67 - Docs: add production deployment checklist

- Category: Documentation, Infrastructure
- Priority: Medium
- Size: S
- Current labels: `priority:p2`, `type:documentation`, `area:docs`,
  `area:deployment`, `status:ready`, `risk:low`
- Missing standardized labels: `documentation`, `infrastructure`,
  `priority:medium`, `size:s`, `ready`, `docs`
- Dependencies and notes: related to #68 and #76. Low code risk; avoid
  duplicating existing docs.
- Implementation status: the wiki owns one concise production checklist linking
  configuration, backup/restore, auth, proxy, SEO, smoke, and rollback runbooks.

### #68 - Docs: add release checklist

- Category: Documentation, Infrastructure
- Priority: Medium
- Size: S
- Current labels: `priority:p2`, `type:documentation`, `type:chore`,
  `area:ci`, `area:docs`, `area:deployment`, `status:ready`, `risk:low`
- Missing standardized labels: `documentation`, `infrastructure`,
  `priority:medium`, `size:s`, `ready`, `docs`, `ci`
- Dependencies and notes: pairs naturally with #67 but should remain a separate
  PR.
- Implementation status: the wiki owns one maintainer release checklist covering
  candidate validation, GitHub gates, multi-architecture publication,
  post-release smoke, rollback, and housekeeping.

### #69 - Branding: plan safe migration for deferred TripTally compatibility names

- Category: Documentation, Technical Debt
- Priority: Low
- Size: M
- Current labels: `priority:p3`, `type:documentation`, `type:chore`,
  `area:branding`, `area:docs`, `area:deployment`, `status:ready`,
  `risk:medium`
- Missing standardized labels: `documentation`, `technical-debt`,
  `priority:low`, `size:m`, `ready`, `docs`
- Dependencies and notes: related to #80. Planning only unless a migration
  proposal is accepted.
- Implementation status: the authoritative compatibility plan inventories
  package, Docker, database, environment, email, cookie, internal, fixture, and
  historical names with owners, release boundaries, migrations, rollback, and
  required tests. No risky compatibility rename is performed.

### #70 - MFA: add browser-level regression for setup secrets not appearing in URLs

- Category: Security, Testing
- Priority: Medium
- Size: M
- Current labels: `priority:p2`, `type:security`, `type:test`, `area:auth`,
  `area:mfa`, `area:testing`, `status:ready`, `risk:medium`
- Missing standardized labels: `security`, `testing`, `priority:medium`,
  `size:m`, `ready`, `auth`, `frontend`
- Dependencies and notes: defense-in-depth coverage for a landed fix. Related
  to #77.

### #71 - SSO: document server-side OAuth session callback flow

- Category: Documentation, Testing
- Priority: Medium
- Size: S
- Current labels: `priority:p2`, `type:documentation`, `type:test`,
  `area:auth`, `area:sso`, `area:docs`, `status:ready`, `risk:medium`
- Missing standardized labels: `documentation`, `testing`, `priority:medium`,
  `size:s`, `ready`, `auth`, `docs`
- Dependencies and notes: documentation-only unless comments or tests reveal
  drift.

### #72 - Email: add template snapshot coverage for SeddleUp branding

- Category: Testing, UX/UI
- Priority: Medium
- Size: S
- Current labels: `priority:p2`, `type:test`, `area:email`, `area:branding`,
  `area:testing`, `status:ready`, `risk:low`
- Missing standardized labels: `testing`, `ui-ux`, `priority:medium`,
  `size:s`, `ready`, `backend`
- Dependencies and notes: focus on structural assertions, not brittle snapshots.

### #73 - Refactor: publish maintainability cleanup summary and remaining debt

- Category: Documentation, Technical Debt
- Priority: Medium
- Size: XS
- Current labels: `priority:p2`, `type:documentation`, `type:refactor`,
  `area:docs`, `area:testing`, `status:ready`, `risk:low`
- Missing standardized labels: `documentation`, `technical-debt`,
  `priority:medium`, `size:xs`, `ready`, `docs`
- Dependencies and notes: low-risk docs gap. Could be a quick standalone PR.
- Implementation status: `docs/refactor-summary.md` records verified architecture
  boundaries, current hardening, superseded mechanisms, intentional
  compatibility names, open debt, and validation expectations.

### #74 - Testing: add production-server E2E mode

- Category: Testing, Infrastructure, Enhancement
- Priority: Medium
- Size: L
- Current labels: `priority:p2`, `type:enhancement`, `type:test`, `area:ci`,
  `area:testing`, `area:deployment`, `status:ready`, `risk:medium`
- Missing standardized labels: `testing`, `infrastructure`, `enhancement`,
  `priority:medium`, `size:l`, `ready`, `ci`
- Dependencies and notes: complements #64 and #61. Split local script from CI
  rollout if scope grows.
- Implementation status: an isolated `next build`/`next start` runner applies
  migrations, waits for readiness, covers the requested smoke paths, cleans up,
  and runs in CI without removing development-server E2E.

### #75 - MFA: add recovery codes or admin reset for locked MFA accounts

- Category: Security, Feature
- Priority: High
- Size: XL
- Current labels: `priority:p1`, `type:security`, `type:enhancement`,
  `area:auth`, `area:mfa`, `status:ready`, `risk:high`
- Missing standardized labels: `security`, `feature`, `priority:high`,
  `size:xl`, `needs-design`, `auth`, `backend`, `frontend`
- Dependencies and notes: related to #59. Should be split into recovery codes
  and admin reset unless a narrow design is chosen.

### #76 - Backups: add SQLite backup and restore validation runbook

- Category: Documentation, Infrastructure, Testing
- Priority: High
- Size: S
- Current labels: `priority:p1`, `type:documentation`, `type:test`,
  `area:database`, `area:docs`, `area:deployment`, `status:ready`,
  `risk:medium`
- Missing standardized labels: `documentation`, `infrastructure`, `testing`,
  `priority:high`, `size:s`, `ready`, `database`, `docs`
- Dependencies and notes: related to #80 and #69. Avoid destructive commands
  without explicit backup warnings.
- Implementation status: in progress on `docs/sqlite-restore-runbook`. The
  runbook adds pre-restore integrity validation, rollback preservation,
  migration and health verification, local deployment guidance, and accurate
  legacy `triptally.db` behavior.

### #77 - Security: add log redaction regression tests for secrets and tokens

- Category: Security, Testing
- Priority: Medium
- Size: M
- Current labels: `priority:p2`, `type:security`, `type:test`, `area:auth`,
  `area:mfa`, `area:testing`, `area:deployment`, `status:ready`, `risk:medium`
- Missing standardized labels: `security`, `testing`, `priority:medium`,
  `size:m`, `ready`, `auth`, `backend`
- Dependencies and notes: related to #70. Avoid overbroad denylists that make
  tests noisy.
- Implementation status: a recursive final logging boundary and regression
  suite cover structured and rendered passwords, token/secret families, OAuth,
  MFA/TOTP/recovery, SMTP/Discord, receipt paths, database URLs, bearer values,
  query values, and emails while preserving operational IDs and timestamps.

### #78 - Docs: add markdown and link checking to documentation validation

- Category: Documentation, Testing, Infrastructure
- Priority: Medium
- Size: M
- Current labels: `priority:p2`, `type:documentation`, `type:chore`,
  `area:ci`, `area:docs`, `area:testing`, `status:ready`, `risk:low`
- Missing standardized labels: `documentation`, `testing`, `infrastructure`,
  `priority:medium`, `size:m`, `ready`, `docs`, `ci`
- Dependencies and notes: consider splitting markdown lint and external link
  checking if noisy. Avoid unnecessary dependencies.
- Implementation status: `docs:check` combines `markdownlint-cli2` with an
  offline repository link/heading validator and a docs-only workflow. External
  URL availability remains deliberately outside routine CI.

### #79 - Testing: add accessibility smoke tests for auth and expense forms

- Category: Testing, UX/UI
- Priority: Medium
- Size: M
- Current labels: `priority:p2`, `type:test`, `area:auth`, `area:testing`,
  `status:ready`, `risk:medium`
- Missing standardized labels: `testing`, `ui-ux`, `priority:medium`,
  `size:m`, `ready`, `auth`, `frontend`
- Dependencies and notes: new dependency should be justified. Start with
  Playwright role/focus assertions if possible.
- Implementation status: Chromium and Mobile Safari smoke tests cover auth,
  registration validation, trip creation, expense create/edit, keyboard/focus,
  labels, and mobile overflow without adding an accessibility dependency.

### #80 - Deployment: test restore from legacy TripTally database path

- Category: Documentation, Testing, Infrastructure
- Priority: Medium
- Size: M
- Current labels: `priority:p2`, `type:documentation`, `type:test`,
  `area:database`, `area:docs`, `area:deployment`, `status:ready`,
  `risk:medium`
- Missing standardized labels: `documentation`, `testing`, `infrastructure`,
  `priority:medium`, `size:m`, `ready`, `database`, `docs`
- Dependencies and notes: related to #69 and #76. Needs only a temporary
  volume or fixture.
- Implementation status: in progress on `agent/docker-runtime-probes` together
  with #61. The probe creates an isolated migrated `triptally.db`, verifies its
  sentinel data, starts the normal current-path container, and confirms the file
  is validated, moved to `seddleup.db`, migrated, healthy, and data-preserving.

### #81 - Observability: add readiness diagnostics for config and database state

- Category: Enhancement, Infrastructure
- Priority: Medium
- Size: M
- Current labels: `priority:p2`, `type:enhancement`, `area:ci`,
  `area:database`, `area:deployment`, `status:ready`, `risk:medium`
- Missing standardized labels: `enhancement`, `infrastructure`,
  `priority:medium`, `size:m`, `ready`, `backend`, `database`, `ci`
- Dependencies and notes: complements #61. Split public liveness from
  authenticated/admin diagnostics if details grow.
- Implementation status: addressed by the readiness diagnostics PR with a
  dependency-free liveness endpoint, safe public readiness states for config,
  SQLite, and bundled Prisma migrations, focused unit/E2E coverage, and stable
  Docker healthcheck behavior. No authenticated detail endpoint was needed.

### #93 - SEO: complete production browser QA and investigate local SQLite path

- Category: Testing, Bug, UX/UI
- Priority: Medium
- Size: M
- Dependencies and notes: follows the production SEO implementation and Docker
  runtime probes.
- Implementation status: production Chromium checks cover common viewports,
  overflow, canonical/social metadata, JSON-LD, sitemap, robots, manifest,
  semantics, private-page robots, and response headers with an HTTPS public
  origin. The local warning root cause was Playwright inheriting Docker paths
  and silently reusing a server; supported launchers now force disposable local
  paths and free ports. Docker validation and existing-file failure behavior are
  unchanged. The in-app visual backend was unavailable during this batch.

## Suggested Implementation Order

1. #59: prevent new email-MFA lockouts when SMTP cannot deliver.
2. #75: design and implement MFA recovery, preferably split into recovery codes
   and admin reset.
3. #61: add Docker runtime migration/health probes in CI.
4. #76: add SQLite backup and restore runbook.
5. #60: add enabled receipt upload/review E2E coverage.
6. #77 and #70: add secret/log and browser URL regression coverage.
7. #81, #62, and #74: harden readiness, Compose profile smoke checks, and
   production-server E2E.
8. #79 and #72: expand accessibility and email-template regression coverage.
9. #67, #68, #71, #73, #78: documentation and documentation validation polish.
10. #63: shared-store rate limiting after deployment requirements are clearer.
11. #64: reproduce and classify WebKit/Turbopack warnings; pair with #74 if
    production-server mode changes the signal.
12. #69, #65, #66: future compatibility, Postgres, and major runtime/tooling
    planning.

## Dependencies

- #59 and #75 are related but separable. #59 should block new unsafe email MFA
  enablement now; #75 should provide durable recovery.
- #61 improves confidence for #62, #74, #80, and #81 but does not strictly block
  any one of them.
- #76, #80, and #69 all touch database/compatibility operations. Keep them in
  separate PRs to avoid mixing operator runbooks with migration planning.
- #64 can use #74 to determine whether warnings are dev-server-only.
- #70 and #77 both protect secret handling and should share terminology, but
  browser URL regression and log redaction should remain separate changes.
- #65 should not proceed past design until Prisma, migration, backup, and CI
  strategy are accepted.
- #66 is blocked on upstream compatibility and should not be started now.

## Risks

- Auth and MFA changes can lock users out; #59 and #75 require focused
  regression tests and clear recovery documentation.
- Docker/CI probes can become slow or flaky if they depend on external services;
  keep probes local and credential-free.
- Documentation validation can become noisy if external links are checked
  without an allowlist or retry policy.
- Database backup/restore docs must avoid ambiguous destructive commands.
- Future Postgres support is an XL design problem, not a validation toggle.
- Compatibility-name cleanup can break cookies, database files, Docker volumes,
  or fixtures if renamed without migration aliases.

## Duplicate, Stale, And Split Review

- Duplicates: no exact duplicate open issues found.
- Stale issues: none by age; all open issues were created or updated on
  2026-06-26. #66 is intentionally blocked, and #64 is intentionally
  needs-triage.
- Split candidates:
  - #75 should likely split into user recovery codes and admin MFA reset.
  - #65 should split design, schema/migration implementation, CI coverage, and
    operator docs.
  - #63 should split shared-store abstraction/provider selection from any
    production deployment documentation.
  - #74 can split local production-server E2E command from CI enablement.
  - #78 can split markdown formatting/lint from external link validation.
  - #81 can split public readiness behavior from authenticated/admin diagnostics.

## Selected First Issue

The first remediation should be #59 because it is the only Critical/P0 open
issue and is marked ready. The first PR should use:

- Branch: `bugfix/issue-59-prevent-email-mfa-lockout`
- Commit style: `fix(auth): prevent email mfa enablement without smtp`
- Expected docs: account/MFA or configuration docs if behavior changes.
- Expected tests: unit coverage for the SMTP capability guard and existing
  authenticator MFA behavior.
