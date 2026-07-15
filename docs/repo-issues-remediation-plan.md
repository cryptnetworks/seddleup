# SeddleUp Repository Issues And Remediation Plan

## Executive Summary

This audit found that SeddleUp is generally healthy: the production Docker image
builds, Prisma migrations apply to a fresh SQLite database, lint/typecheck pass
in a containerized Node environment, Vitest passes, and the full Playwright E2E
suite passes.

The remediation sequence has now closed the highest-priority audit items: the
Discord Compose command works without `npm` in the final image, authenticator
setup no longer sends TOTP seed material through URL query parameters, obsolete
OAuth login handoff code has been removed, unsupported Postgres URLs are
rejected clearly, rate-limit production boundaries are documented, Mobile Safari
expense-entry coverage has been expanded, email branding has SeddleUp
regression coverage, and CI/dependency documentation now covers Docker-based
validation for environments without host Node/npm.

Email MFA enablement now checks delivery availability, and receipt-upload
enabled-path E2E is automated. The highest-risk remaining work is atomic
one-time credential consumption and explicit participant/account deletion
policies. Turbopack/WebKit chunk warnings reproduced only in the development HMR
client; repeated production route checks remained clean and the bounded-CI and
production-runner mitigation is documented.

Intentional TripTally compatibility names are preserved for now, including the
package name, package lock name, and test fixtures. Their ownership, migration,
rollback, and test requirements are documented in the compatibility plan.

Repository documentation now has deterministic Markdown/internal-link checks,
credential-free Docker profile probes, authoritative deployment and release
checklists, and a verified maintainability summary.

## Closeout Status

### Completed PR-Sized Remediations

1. First remediation: added this report, formatted `playwright.config.ts`, and
   changed the Compose Discord command to
   `node scripts/register-discord-commands.mjs`.
2. Authenticator setup secrecy: moved TOTP setup delivery off redirect URLs and
   added regression tests proving raw secrets and OTP URIs are not exposed in
   redirect query parameters.
3. OAuth cleanup: removed obsolete OAuth login-token handoff code after the
   callback began creating the NextAuth session server-side.
4. Database config cleanup: made SQLite `file:` URLs the only advertised and
   accepted database engine until a real Postgres migration plan exists.
5. Rate-limit safety: documented single-instance limits, added tests, and added
   a store abstraction for future shared-store implementations without changing
   runtime behavior.
6. Mobile/iOS coverage: expanded Mobile Safari coverage for decimal add/edit
   expense flows and the supported test SSO path.
7. Email branding coverage: added SeddleUp subject/body/template branding tests,
   stale legacy brand fallback coverage, and compatibility-name docs.
8. Release docs polish: removed stale screenshot placeholder language and
   clarified Docker, env, database, email, Discord, Nginx, and Cloudflare setup.
9. CI/dependency cleanup: added CI format checking, updated safe patch
   dependencies, documented Docker-based validation, and recorded major update
   deferrals.

### Issue Status Summary

| Area                         | Status         | Notes                                                                |
| ---------------------------- | -------------- | -------------------------------------------------------------------- |
| Discord final-image command  | Fixed          | Compose uses `node scripts/register-discord-commands.mjs`.           |
| Authenticator setup secrecy  | Fixed          | Setup redirects no longer carry raw TOTP seeds or OTP URIs.          |
| Legacy OAuth handoff cleanup | Fixed          | Obsolete OAuth handoff modules were removed.                         |
| SQLite/Postgres mismatch     | Fixed          | Non-`file:` database URLs fail clearly.                              |
| Rate-limit production safety | Partially done | Single-instance behavior is documented; shared store remains future. |
| Mobile/iOS expense coverage  | Fixed          | Mobile Safari add/edit decimal and mobile SSO paths pass.            |
| Email branding coverage      | Fixed          | Outbound email branding is covered with SeddleUp regressions.        |
| Release-facing docs          | Fixed          | README/wiki setup docs are aligned with current behavior.            |
| CI/dependency cleanup        | Fixed          | CI includes format check; safe patch updates applied.                |
| Email MFA without SMTP       | Open           | Needs product guardrails to avoid account lockout.                   |
| Receipt upload enabled E2E   | Fixed          | Isolated upload/review and access-control E2E now runs in CI.        |
| WebKit dev-server warnings   | Classified     | Reproduced in Turbopack HMR; bounded CI and production checks added. |

### Recommended Next Phase

Start a focused Phase 2 follow-up for email MFA safety. The next PR should block
or strongly warn before enabling email-code MFA when SMTP delivery is disabled
or unverified, preserve authenticator-app MFA behavior, and add recovery/admin
test coverage so users are not locked out by an undeliverable second factor.

## Issue Inventory

### Critical Runtime Blockers

- **Discord Compose command cannot run in the final image**
  - Files: `docker-compose.yml`, `Dockerfile`
  - What appears wrong: the `discord-commands` profile used
    `npm run discord:register`, but the runtime image removes `npm` and `npx`.
  - Why it matters: operators using the `discord` profile cannot register slash
    commands from the published image.
  - Suggested fix: run `node scripts/register-discord-commands.mjs` directly.
  - Risk level: High
  - Estimated effort: Small
  - Status: Fixed in this first remediation PR.

### Auth, Login, MFA, And SSO Issues

- **Authenticator setup secret leaks through URL query parameters**
  - Files: `lib/actions/auth.ts`, `app/account/page.tsx`
  - What appears wrong: the manual TOTP secret and OTP URI are sent through
    `/account?authenticatorSecret=...&authenticatorUri=...`.
  - Why it matters: query strings can land in browser history, reverse proxy
    logs, server logs, screenshots, and referrers.
  - Suggested fix: store pending setup server-side, or return a short-lived
    encrypted setup token that does not contain the raw secret in the URL.
  - Risk level: High
  - Estimated effort: Medium
  - Status: Fixed in the authenticator setup secrecy PR; setup redirects now use
    `/account?twoFactor=authenticator-setup`, and the pending encrypted secret
    is consumed server-side on the account page.

- **Legacy OAuth handoff path removed after server-side SSO session creation**
  - Files: `lib/auth.ts`, `lib/oauth-login.ts`, `lib/cookies.ts`,
    `app/api/auth/oauth/[provider]/callback/route.ts`
  - What appears wrong: OAuth callback now creates a NextAuth session
    server-side, while older one-time OAuth login token code still exists.
  - Why it matters: duplicate auth paths increase maintenance and security
    review surface.
  - Suggested fix: decide whether to keep the legacy handoff for compatibility.
    If not, remove it in a focused PR with tests updated.
  - Risk level: Medium
  - Estimated effort: Medium
  - Status: Fixed in the OAuth cleanup PR; the callback now creates the session
    directly and the obsolete token handoff code was removed.

- **Email MFA can be selected even if SMTP delivery is unavailable**
  - Files: `lib/two-factor.ts`, `lib/email.ts`, `app/account/page.tsx`
  - What appears wrong: email MFA challenge creation proceeds when SMTP is not
    configured; in production that can create an undeliverable login challenge.
  - Why it matters: users can lock themselves out by enabling email MFA without
    a working mail path.
  - Suggested fix: block or clearly warn before enabling email MFA when SMTP is
    disabled, and add a recovery/admin path.
  - Risk level: Medium
  - Estimated effort: Medium

### Mobile And iOS Usability Issues

- **Dedicated edit-expense Mobile Safari coverage is missing**
  - Files: `tests/e2e/mobile-ios.spec.ts`,
    `app/trips/[tripId]/expenses/[expenseId]/edit/page.tsx`
  - What appears wrong: add-expense decimal entry is covered, but edit-expense
    decimal entry is not.
  - Why it matters: the same iOS keyboard behavior can regress on edit forms.
  - Suggested fix: add a Mobile Safari edit-expense decimal regression test.
  - Risk level: Low
  - Estimated effort: Small
  - Status: Fixed in the mobile/iOS regression PR; Mobile Safari now covers
    decimal add and edit expense flows plus mobile SSO.

- **Transient Playwright dev-server chunk warning observed**
  - Files: `playwright.config.ts`, Next.js dev server runtime
  - What appears wrong: one Mobile Safari run logged a Turbopack
    `ChunkLoadError`, while tests continued and passed.
  - Why it matters: repeated warnings could indicate flaky dev-server behavior.
  - Suggested fix: track recurrence; consider production-server E2E if it
    becomes flaky.
  - Risk level: Low
  - Estimated effort: Small
  - Status: Classified; later full development and CI matrices reproduced the warning
    twice in Turbopack's HMR client, while three repeated production route runs
    stayed clean. Real page/server chunk errors are observed and fail; a
    distinct local-HTTP production WebKit server-action timeout remains visible.

### Docker And Deployment Issues

- **Postgres URLs are accepted by config, but migrations are SQLite-only**
  - Files: `scripts/validate-config.mjs`, `lib/config.ts`,
    `lib/prisma-adapter.ts`, `prisma/schema.prisma`,
    `prisma/migrations/migration_lock.toml`
  - What appears wrong: runtime config accepts `postgres://` and
    `postgresql://`, but the Prisma datasource and migrations are SQLite.
  - Why it matters: deployers can choose a database URL that appears valid but
    has no migration support.
  - Suggested fix: either reject Postgres URLs for now or create a real Postgres
    support plan with migrations and CI coverage.
  - Risk level: Medium
  - Estimated effort: Medium
  - Status: Fixed in the database config cleanup PR by rejecting non-`file:`
    database URLs and documenting SQLite-only support.

- **Compose is image-pull oriented, not build oriented**
  - Files: `docker-compose.yml`, `README.md`, `docs/wiki/Running-with-Docker.md`
  - What appears wrong: `docker compose build seddleup` reports no services to
    build because the service uses an image and no build context.
  - Why it matters: contributors may expect local Compose builds to validate the
    image.
  - Suggested fix: document direct `docker build -t seddleup:audit .` as the
    build validation command or add a dev override file.
  - Risk level: Low
  - Estimated effort: Small
  - Status: Fixed for documentation; local Compose builds remain intentionally
    optional unless a dev override is added later.

### Email And Branding Issues

- **Remaining TripTally names need an explicit compatibility ledger**
  - Files: `package.json`, `package-lock.json`, `lib/cookies.ts`,
    `tests/fixtures/triptally.ts`, selected tests
  - What appears wrong: old names remain in compatibility and fixture locations.
  - Why it matters: future cleanup could accidentally break compatibility or
    churn tests without a migration plan.
  - Suggested fix: keep these names for now and document them as deferred.
  - Risk level: Low
  - Estimated effort: Small
  - Status: Fixed with one authoritative compatibility migration plan covering
    owners, release boundaries, migration and rollback procedures, and tests.

- **README screenshot placeholder is stale**
  - Files: `README.md`
  - What appears wrong: screenshots are called out as not committed.
  - Why it matters: public docs look unfinished.
  - Suggested fix: add current screenshots or remove the placeholder section.
  - Risk level: Low
  - Estimated effort: Small
  - Status: Fixed in the release docs polish PR by removing the placeholder
    claim.

### Security Issues

- **In-memory rate limiting is not durable or shared**
  - Files: `lib/rate-limit.ts`
  - What appears wrong: rate limit buckets are process-local memory.
  - Why it matters: limits reset on restart and do not work across replicas.
  - Suggested fix: keep for single-container deployments, but document the
    limitation or add a durable/shared store before multi-replica deployment.
  - Risk level: Medium
  - Estimated effort: Medium
  - Status: Partially addressed in the rate-limit safety PR by documenting the
    single-instance boundary, adding tests, and introducing a store abstraction
    for future shared-store support without changing behavior.

- **TOTP setup URL leakage is the highest-priority security fix**
  - Files: `lib/actions/auth.ts`, `app/account/page.tsx`
  - What appears wrong: see the MFA issue above.
  - Why it matters: raw second-factor seed exposure is sensitive.
  - Suggested fix: move setup state off the URL.
  - Risk level: High
  - Estimated effort: Medium
  - Status: Fixed in the authenticator setup secrecy PR.

### Dependency And CI Issues

- **Prettier check failed before this PR**
  - Files: `playwright.config.ts`
  - What appears wrong: `npm run format:check` reported style issues.
  - Why it matters: CI would fail on formatting.
  - Suggested fix: run Prettier on `playwright.config.ts` only.
  - Risk level: Low
  - Estimated effort: Small
  - Status: Fixed in this first remediation PR.

- **Host Node/npm are unavailable in this shell**
  - Files: local developer environment
  - What appears wrong: `npm` and `npx` return `command not found`.
  - Why it matters: direct local validation commands cannot run on this host
    until PATH or Node installation is repaired.
  - Suggested fix: either repair host Node/npm or use Docker-based validation.
  - Risk level: Medium
  - Estimated effort: Small
  - Status: Open in this shell; Docker-based validation is documented and used.

### Test Coverage Gaps

- **No regression test for TOTP setup secret not appearing in URLs**
  - Files: `tests/integration/auth-login.test.ts`, account E2E tests
  - What appears wrong: tests cover MFA login but not setup secret transport.
  - Why it matters: the highest-priority auth fix needs regression coverage.
  - Suggested fix: add a focused test with the MFA setup PR.
  - Risk level: Medium
  - Estimated effort: Small
  - Status: Fixed by `tests/unit/authenticator-setup-actions.test.ts` and
    `tests/unit/two-factor.test.ts`.

- **No runtime probe for the Discord command container path**
  - Files: `docker-compose.yml`, `scripts/register-discord-commands.mjs`
  - What appears wrong: existing tests do not prove the final image can execute
    the Discord registration script without npm.
  - Why it matters: this was a real runtime blocker.
  - Suggested fix: keep a documented runtime probe; add CI coverage if cheap.
  - Risk level: Low
  - Estimated effort: Small
  - Status: Partially fixed; the runtime probe is documented and has passed
    locally, but it is not yet a dedicated CI step.

- **Receipt upload enabled path has limited E2E coverage**
  - Files: `tests/e2e/receipts.spec.ts`, receipt pages and actions
  - What appears wrong: current E2E verifies disabled UI; unit tests cover
    storage and parser boundaries.
  - Why it matters: upload/review flows are user-facing and security-sensitive.
  - Suggested fix: add an enabled receipt upload E2E with a small fixture.
  - Risk level: Medium
  - Estimated effort: Medium
  - Status: Fixed in the production-readiness batch with an isolated enabled
    runner, synthetic fixture, upload/parse/review assertions, owner download,
    unauthenticated and cross-user denial, disabled-state coverage, and cleanup.

### Documentation Gaps

- **This remediation plan did not exist before this PR**
  - Files: `docs/repo-issues-remediation-plan.md`
  - What appears wrong: audit results were not consolidated in one actionable
    document.
  - Why it matters: broad cleanup needs shared sequencing and evidence.
  - Suggested fix: add this report.
  - Risk level: Low
  - Estimated effort: Small
  - Status: Fixed in this first remediation PR.

- **Postgres support status is unclear**
  - Files: README, wiki configuration docs, config validation
  - What appears wrong: code accepts Postgres URLs, but schema/migrations are
    SQLite-only.
  - Why it matters: deployers may assume unsupported database behavior.
  - Suggested fix: document SQLite-only support unless Postgres is implemented.
  - Risk level: Medium
  - Estimated effort: Small
  - Status: Fixed in the database config cleanup PR.

### Cleanup And Refactor Opportunities

- **Legacy OAuth handoff cleanup completed**
  - Files: `lib/oauth-login.ts`, `lib/cookies.ts`, `lib/auth.ts`
  - What appears wrong: older OAuth token handoff code may be obsolete.
  - Why it matters: less auth code means easier security review.
  - Suggested fix: remove or explicitly keep with a compatibility note.
  - Risk level: Medium
  - Estimated effort: Medium
  - Status: Fixed in the OAuth cleanup PR.

- **Compatibility names should be changed only with a migration plan**
  - Files: package metadata, cookies, fixtures, tests
  - What appears wrong: TripTally names remain intentionally.
  - Why it matters: renaming them casually could break users or test fixtures.
  - Suggested fix: defer until a compatibility window is planned.
  - Risk level: Low
  - Estimated effort: Medium
  - Status: Planned in `docs/wiki/Compatibility-Name-Migration-Plan.md`; no
    compatibility rename is included in this documentation hardening batch.

## Command Results

### Baseline Audit Results

- `npm run format:check`
  - Host result: failed before running because `npm` was unavailable.
  - Exact output: `zsh:1: command not found: npm`
  - Container result before this PR: failed on `playwright.config.ts`.
  - Exact important output:

```text
[warn] playwright.config.ts
[warn] Code style issues found in the above file. Run Prettier with --write to fix.
```

- `npm run lint`
  - Host result: failed before running because `npm` was unavailable.
  - Exact output: `zsh:1: command not found: npm`
  - Container result: passed.

- `npx prisma validate`
  - Host result: failed before running because `npx` was unavailable.
  - Exact output: `zsh:1: command not found: npx`
  - Container result: passed.
  - Exact important output: `The schema at prisma/schema.prisma is valid`

- `npm run typecheck`
  - Container result: passed after `prisma generate`.

- `npm test`
  - Container result: passed.
  - Exact summary: `21 passed (21)` files, `77 passed (77)` tests.

- `docker compose config --quiet`
  - Result: passed.

- `docker compose --profile nginx --profile cloudflare --profile discord config --quiet`
  - Result: passed.

- `docker compose build seddleup`
  - Result: no build was run because Compose uses an image.
  - Exact output: `No services to build`

- `docker build -t seddleup:audit .`
  - Result: passed.
  - Important steps confirmed: `npm ci`, `npx prisma generate`,
    `npm run build`, and final image export.

- Runtime entrypoint probe with `seddleup:audit`
  - Result: passed.
  - Important output: config validation succeeded, all seven migrations applied,
    and the probe printed `entrypoint-ok`.

- `docker run --rm --entrypoint npm seddleup:audit -v`
  - Result: failed as expected.
  - Exact important output:

```text
exec: "npm": executable file not found in $PATH
```

- Chromium plus Mobile Safari Playwright E2E in Docker
  - Result: passed.
  - Exact summary: `31 passed`, `1 skipped`.
  - Warning observed: one non-failing dev-server `ChunkLoadError` log.

- `npm audit --audit-level=high` in Docker
  - Result: passed.
  - Exact output: `found 0 vulnerabilities`

- `npm ls picomatch --all` in Docker
  - Result: passed.
  - Important resolved versions: `picomatch@2.3.2` and `picomatch@4.0.4`.

### First Remediation PR Validation

The following results were recorded for this PR after changing only
`playwright.config.ts`, `docker-compose.yml`, and this report.

- `npm run format:check`
  - Host result: failed before running because `npm` was unavailable.
  - Exact output: `zsh:1: command not found: npm`
  - Docker result: passed.
  - Exact important output:

```text
All matched files use Prettier code style!
```

- Final post-report Docker attempt initially failed because this new Markdown
  report needed formatting.
- Exact important output:

```text
[warn] docs/repo-issues-remediation-plan.md
[warn] Code style issues found in the above file. Run Prettier with --write to fix.
```

- Correction: formatted `docs/repo-issues-remediation-plan.md`, then reran the
  full Docker-backed validation.

- `npm run lint`
  - Host result: failed before running because `npm` was unavailable.
  - Exact output: `zsh:1: command not found: npm`
  - Docker result: passed.

- `npm run typecheck`
  - Host result: failed before running because `npm` was unavailable.
  - Exact output: `zsh:1: command not found: npm`
  - Docker result: passed after `prisma generate`.

- `npm test`
  - Host result: failed before running because `npm` was unavailable.
  - Exact output: `zsh:1: command not found: npm`
  - First Docker attempt: failed because the fresh container database had not
    been migrated before running tests.
  - Exact important failure:

```text
The table `main.users` does not exist in the current database.
Test Files 4 failed | 17 passed (21)
Tests 26 failed | 51 passed (77)
```

- Corrected Docker result: passed after running
  `npx prisma migrate deploy`, matching CI setup.
- Exact summary: `21 passed (21)` files, `77 passed (77)` tests.

- `docker build -t seddleup:audit .`
  - Result: passed.
  - Important steps confirmed: `npm ci`, `npx prisma generate`,
    `npm run build`, `npm prune --omit=dev`, and final image export.

- Runtime entrypoint probe
  - Command:

```text
docker run --rm -e NODE_ENV=production -e DATABASE_URL=file:/app/data/audit-pr.db -e NEXTAUTH_URL=http://localhost:3000 -e NEXTAUTH_SECRET=audit-nextauth-secret-that-is-long-enough -e TOKEN_DIGEST_SECRET=audit-token-digest-secret-that-is-long-enough -e AUTH_CONFIG_ENCRYPTION_KEY=audit-auth-config-key-that-is-long-enough -e SMTP_ENABLED=false seddleup:audit node -e "console.log('entrypoint-ok')"
```

- Result: passed.
- Important output: Prisma Client generation succeeded, config validation
  succeeded, all seven migrations applied, and `entrypoint-ok` printed.

- Discord command runtime probe
  - Command:

```text
docker run --rm -e NODE_ENV=production -e DATABASE_URL=file:/app/data/discord-probe.db -e NEXTAUTH_URL=http://localhost:3000 -e NEXTAUTH_SECRET=audit-nextauth-secret-that-is-long-enough -e TOKEN_DIGEST_SECRET=audit-token-digest-secret-that-is-long-enough -e AUTH_CONFIG_ENCRYPTION_KEY=audit-auth-config-key-that-is-long-enough -e SMTP_ENABLED=false seddleup:audit node scripts/register-discord-commands.mjs
```

- Result: reached `node scripts/register-discord-commands.mjs` through the
  normal entrypoint, then failed as expected because real Discord credentials
  were not provided.
- Exact expected error:

```text
Error: DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID are required.
```

- Final-image npm absence probe
  - Command:

```text
docker run --rm --entrypoint npm seddleup:audit -v
```

- Result: failed as expected, confirming the final image has no `npm`.
- Exact important output:

```text
exec: "npm": executable file not found in $PATH
```

### Final Closeout Validation

These checks were run after the remediation sequence and report closeout audit.
Host `npm` remains unavailable, so npm validations were executed in clean Docker
build environments.

- `npm run format:check`
  - Host result: failed before running because `npm` was unavailable.
  - Exact output: `zsh:1: command not found: npm`
  - Docker result: passed.
  - Exact important output: `All matched files use Prettier code style!`

- `npm run lint`
  - Host result: failed before running because `npm` was unavailable.
  - Exact output: `zsh:1: command not found: npm`
  - Docker result: passed.

- `npm run typecheck`
  - Host result: failed before running because `npm` was unavailable.
  - Exact output: `zsh:1: command not found: npm`
  - Docker result: passed after Prisma Client generation.

- `npm test`
  - Host result: failed before running because `npm` was unavailable.
  - Exact output: `zsh:1: command not found: npm`
  - Docker result: passed.
  - Exact summary: `25 passed (25)` files, `86 passed (86)` tests.

- `npx prisma validate`
  - Docker result: passed.
  - Exact important output: `The schema at prisma/schema.prisma is valid`.

- `npx prisma migrate deploy`
  - Docker result: passed against a fresh SQLite database.
  - Exact important output: `8 migrations found in prisma/migrations` and
    `All migrations have been successfully applied.`

- Full Playwright E2E suite
  - Command executed in the Playwright Docker image: `npm run test:e2e`
  - Result: passed.
  - Exact summary: `77 passed`, `8 skipped`.
  - Important warning: recurring non-failing Turbopack/WebKit
    `ChunkLoadError` messages appeared during dev-server E2E.

- `npm run build`
  - Docker result: passed.
  - Important output: Next.js production build compiled successfully and
    generated all app routes.

- `npm audit --audit-level=high`
  - Docker result: passed.
  - Exact output: `found 0 vulnerabilities`.

- `docker build -t seddleup:closeout .`
  - Result: passed.
  - Important steps confirmed: final image builds, prunes dev dependencies, and
    removes `npm`/`npx` from the runtime image.

- Runtime migration probe
  - Command:

```text
docker run --rm -e NODE_ENV=production -e DATABASE_URL=file:/app/data/closeout-runtime.db -e NEXTAUTH_URL=http://localhost:3000 -e NEXTAUTH_SECRET=closeout-nextauth-secret-that-is-long-enough -e TOKEN_DIGEST_SECRET=closeout-token-digest-secret-that-is-long-enough -e AUTH_CONFIG_ENCRYPTION_KEY=closeout-auth-config-key-that-is-long-enough -e SMTP_ENABLED=false seddleup:closeout node -e "console.log('runtime-migration-ok')"
```

- Result: passed.
- Important output: Prisma Client generation succeeded, config validation
  succeeded, all 8 migrations applied, and `runtime-migration-ok` printed.

## Prioritized Remediation Roadmap

### Phase 0: Safety, Backups, And Branching

- Specific tasks:
  - Start from a clean branch.
  - Preserve intentional TripTally compatibility names.
  - Check `git status --short` before and after each PR.
- Files likely involved:
  - Git metadata only.
- Validation commands:
  - `git status --short`
- Rollback considerations:
  - Revert only the PR commit.
- Expected outcome:
  - Small, reviewable PRs with clear boundaries.

### Phase 1: Critical Blockers

- Specific tasks:
  - Fix the Discord Compose command to avoid `npm` in the final image.
  - Keep `docker-compose.yml` otherwise unchanged.
- Files likely involved:
  - `docker-compose.yml`
- Validation commands:
  - `docker build -t seddleup:audit .`
  - Runtime entrypoint probe
  - Discord command runtime probe
- Rollback considerations:
  - Restore the previous Compose command if needed.
- Expected outcome:
  - Discord command registration can run from the final Docker image.

### Phase 2: Auth And Account Access

- Specific tasks:
  - Completed: remove TOTP seed material from URLs.
  - Completed: add regression coverage for authenticator setup secret handling.
  - Keep the direct OAuth callback session flow covered by SSO tests.
  - Prevent email MFA enablement without a working SMTP path.
- Files likely involved:
  - `lib/actions/auth.ts`
  - `app/account/page.tsx`
  - Auth tests
- Validation commands:
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - SSO and auth E2E tests
- Rollback considerations:
  - Keep old MFA login behavior until the new setup flow is verified.
- Expected outcome:
  - Account access is safer and easier to reason about.

### Phase 3: Mobile And iOS Functionality

- Specific tasks:
  - Completed: add edit-expense Mobile Safari decimal coverage.
  - Watch for repeated dev-server chunk warnings.
- Files likely involved:
  - `tests/e2e/mobile-ios.spec.ts`
  - Expense form pages
- Validation commands:
  - `npm run test:e2e -- --project='Mobile Safari'`
- Rollback considerations:
  - Tests can be reverted independently from app behavior.
- Expected outcome:
  - iOS decimal entry remains protected for create and edit flows.

### Phase 4: Docker And Deployment

- Specific tasks:
  - Completed: resolve SQLite-only versus accepted Postgres URL mismatch.
  - Keep Postgres documented as future work until schema, migrations, and CI
    support it.
  - Document direct Docker build validation.
  - Consider a dev Compose override if local Compose builds are desired.
- Files likely involved:
  - `scripts/validate-config.mjs`
  - `lib/config.ts`
  - Deployment docs
- Validation commands:
  - `docker compose config --quiet`
  - `docker build -t seddleup:audit .`
  - Runtime entrypoint probe
- Rollback considerations:
  - If config validation is tightened, document migration notes clearly.
- Expected outcome:
  - Deployment options match actual database support.

### Phase 5: Branding And Email Cleanup

- Specific tasks:
  - Completed: keep intentional compatibility names.
  - Completed: add or update a compatibility-name ledger in docs.
  - Completed: remove the stale README screenshot placeholder.
- Files likely involved:
  - README and wiki docs
- Validation commands:
  - `npm run format:check`
  - Email unit tests
- Rollback considerations:
  - Docs-only rollback is safe.
- Expected outcome:
  - Public docs look complete without breaking compatibility.

### Phase 6: Dependency And CI Cleanup

- Specific tasks:
  - Completed: keep Prettier, lint, typecheck, test, build, and audit green.
  - Completed: document Docker-based validation if host Node is unavailable.
  - Continue deferring major updates that lack clean support.
- Files likely involved:
  - `package.json`
  - GitHub workflows
  - docs
- Validation commands:
  - `npm run format:check`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run security:audit`
- Rollback considerations:
  - Keep dependency bumps in isolated PRs.
- Expected outcome:
  - CI remains reproducible and understandable.

### Phase 7: Test Suite Expansion

- Specific tasks:
  - Completed: add TOTP setup leakage regression.
  - Add receipt upload enabled E2E.
  - Add Discord command final-image probe if practical in CI.
- Files likely involved:
  - Unit, integration, and E2E tests
- Validation commands:
  - `npm test`
  - Targeted Playwright projects
- Rollback considerations:
  - Revert tests independently if they are flaky.
- Expected outcome:
  - Security-sensitive flows have explicit coverage.

### Phase 8: Documentation And Polish

- Specific tasks:
  - Keep this report current as remediation PRs land.
  - Move resolved items into a changelog or running issues log.
  - Remove stale placeholders from public docs.
- Files likely involved:
  - `docs/repo-issues-remediation-plan.md`
  - README
  - wiki docs
- Validation commands:
  - `npm run format:check`
- Rollback considerations:
  - Docs-only rollback is safe.
- Expected outcome:
  - Future contributors can see what remains and why.

## Historical Recommended First PR

Completed. The first remediation PR included only:

- This report.
- Prettier formatting for `playwright.config.ts`.
- The `discord-commands` Compose command fix.

It did not change MFA/auth implementation, TripTally compatibility names, or
unrelated code.

## Current Top 5 Follow-Ups

1. Prevent email MFA lockout when SMTP is unavailable or unverified.
2. Add enabled receipt upload/review E2E coverage with a small fixture.
3. Decide whether to add the Discord final-image command probe to CI.
4. Track recurring WebKit/Mobile Safari Turbopack `ChunkLoadError` warnings and
   consider production-server E2E if they become flaky.
5. Keep major dependency updates phased: ESLint 10, Node 26, and `@types/node`
   26 should each land only with focused validation.

## Recommended Next Implementation Prompt

```text
Implement the next remediation PR: prevent users from enabling email-code MFA when SMTP delivery is disabled, unconfigured, or unverified. Preserve authenticator-app MFA behavior and existing login behavior. Add focused tests for the account settings guard, login behavior for existing email-MFA users, and an admin/recovery path if one is needed. Run npm run format:check, npm run lint, npm run typecheck, npm test, and relevant auth/account E2E checks. Document commands and results.
```

## Risks And Unknowns

- Host `npm`, `npx`, and `node` are not available in this shell, so npm-based
  validation must run through Docker until the host environment is repaired.
- Hosted GitHub Actions confirmation is still needed for workflows that depend
  on GitHub infrastructure, Trivy, browser installs, or registry credentials.
- Postgres support is not real until schema, migrations, and CI say so.

## Follow-Up Questions

No follow-up question blocks the next recommended phase. The only product
decision to confirm during implementation is whether email-code MFA should be
fully blocked until SMTP is verified, or allowed only with an explicit
administrator override.
