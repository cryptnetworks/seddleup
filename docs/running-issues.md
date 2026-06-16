# Running Issues Log

## Issue 1: Docker and CI npm install peer dependency failure

- Date encountered: 2026-05-28
- Error summary: `npm install` failed with `ERESOLVE` because `next-auth@4.24.14` requires optional peer `nodemailer@^7.0.7`, while the root project requested `nodemailer@^8.0.9`.
- Root cause: Nodemailer was upgraded past the peer range supported by the current NextAuth version.
- Files changed: `package.json`, `package-lock.json`, `Dockerfile`.
- Fix applied: Initially pinned Nodemailer to `^7.0.13`, regenerated the lockfile, and changed Docker dependency installation from `npm install` to `npm ci`. Nodemailer was later removed in Issue 6.
- Verification commands: `npm ci`, `npm run build`, `docker build -t seddleup:latest .`.
- Status: Fixed.

## Issue 2: Docker builds were not using the lockfile strictly

- Date encountered: 2026-05-28
- Error summary: Docker used `npm install` after copying `package.json` and `package-lock.json`.
- Root cause: `npm install` can resolve dependencies differently from CI and can surface peer resolution drift during image builds.
- Files changed: `Dockerfile`.
- Fix applied: Replaced `npm install --no-audit --no-fund --loglevel=error` with `npm ci --no-audit --no-fund --loglevel=error`.
- Verification commands: `docker build -t seddleup:latest .`, `docker compose build`.
- Status: Fixed.

## Issue 3: CodeQL default setup conflicts with advanced workflow

- Date encountered: 2026-05-28
- Error summary: GitHub rejected CodeQL SARIF with `CodeQL analyses from advanced configurations cannot be processed when the default setup is enabled`.
- Root cause: GitHub CodeQL default setup and a repo-managed advanced CodeQL workflow were both active.
- Files changed: `.github/workflows/security.yml`, `SECURITY.md`, `docs/wiki/Repository-Automation.md`, `docs/wiki/Security-Model.md`.
- Fix applied: Removed the custom CodeQL job from the security workflow and documented that CodeQL is expected to run through GitHub default setup.
- Verification commands: YAML review and workflow consistency check. Full SARIF acceptance must be verified by the next GitHub Actions run.
- Status: Fixed in repository configuration; pending hosted Actions confirmation.

## Issue 4: Trivy image scan depended on a failing Docker build

- Date encountered: 2026-05-28
- Error summary: Trivy image scan could not run because the Docker image failed to build.
- Root cause: Same Nodemailer peer dependency conflict as Issue 1.
- Files changed: `package.json`, `package-lock.json`, `Dockerfile`, `.github/workflows/security.yml`.
- Fix applied: Resolved the dependency conflict, later replaced Nodemailer with EmailJS in Issue 6, and made Docker installs reproducible with `npm ci`.
- Verification commands: `docker build -t seddleup:latest .`, `npm run security:scan`.
- Status: Fixed.

## Issue 5: CodeQL flagged one-time token digests as weak password hashing

- Date encountered: 2026-05-28
- Error summary: CodeQL reported `Use of password hash with insufficient computational effort` for OAuth login and password reset token digest storage.
- Root cause: One-time random tokens were stored as HMAC digests keyed by existing app secrets, but the helper did not use a dedicated token-digest secret and did not expose a timing-safe comparison helper for non-database comparisons.
- Files changed: `lib/token-digest.ts`, `lib/config.ts`, `scripts/validate-config.mjs`, `docker-entrypoint.sh`, `.env.example`, `.env.docker.example`, `.github/workflows/ci.yml`, security docs, and token tests.
- Fix applied: Added required `TOKEN_DIGEST_SECRET`, validate it at startup, keep raw one-time tokens out of storage, store only HMAC-SHA-256 digests, and add timing-safe digest comparison support.
- Verification commands: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Status: Fixed.

## Issue 6: Dependabot alerts for Nodemailer, uuid, PostCSS, and @hono/node-server

- Date encountered: 2026-05-28
- Error summary: Dependabot/npm audit reported moderate advisories for direct Nodemailer and transitive `uuid`, `postcss`, and `@hono/node-server`.
- Root cause: The app used Nodemailer directly, NextAuth depended on vulnerable `uuid`, Next bundled vulnerable PostCSS, and Prisma dev tooling depended on vulnerable `@hono/node-server`.
- Files changed: `package.json`, `package-lock.json`, `lib/email.ts`, `.github/dependabot.yml`, `README.md`, `SECURITY.md`, and wiki automation/security docs.
- Fix applied: Replaced direct Nodemailer usage with EmailJS, removed `@types/nodemailer`, added scoped npm overrides for `uuid@11.1.1`, `postcss@8.5.15`, and `@hono/node-server@1.19.13`, and improved Dependabot grouping.
- Verification commands: `npm ci`, `npm audit --json`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`, `npm run security:audit`, `npm run security:scan`, `docker build -t seddleup:latest .`, `docker compose build seddleup`.
- Status: Fixed.

## Issue 7: CVE-2026-33671 picomatch ReDoS finding

- Date encountered: 2026-05-28
- Error summary: Security scanning reported CVE-2026-33671, a high-severity ReDoS issue in vulnerable `picomatch` versions.
- Root cause: `picomatch` is transitive through lint/build/test tooling, so it is not declared directly in `package.json`.
- Files changed: `package-lock.json`.
- Fix applied: Ran `npm update picomatch` and verified the installed tree resolves to patched versions: `picomatch@2.3.2` for the micromatch branch and `picomatch@4.0.4` for Vite/Vitest branches.
- Verification commands: `npm ls picomatch --all`, `npm audit --audit-level=high`, `npm audit --json`, `npm run security:scan`, `docker build -t seddleup:latest .`.
- Status: Fixed.

## Issue 8: Remaining Dependabot major updates review

- Date encountered: 2026-05-28
- Error summary: Dependabot opened major-version PRs for ESLint 10, GitHub Actions, and Node 26 Alpine. A Nodemailer 8 PR was also referenced, but Nodemailer had already been removed from the project.
- Root cause: Dependabot grouped safe action major updates with ecosystem updates that still require compatibility confirmation. ESLint 10 is newer than peer ranges declared by the Next.js ESLint plugin chain, and Node 26 is currently a Current release rather than the production LTS runtime used by the app.
- Files changed: `.github/workflows/docker-image.yml`, `.github/workflows/release.yml`, `.github/dependabot.yml`, `README.md`, `SECURITY.md`, `docs/wiki/Repository-Automation.md`, and `docs/wiki/Contributing.md`.
- Fix applied: Accepted the GitHub Actions group update for Docker login, Docker metadata, Docker build/push, and release creation. Deferred ESLint 10 with a Dependabot major ignore because the compatibility test produced peer dependency warnings from `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, and `eslint-plugin-react`. Deferred Node 26 Alpine with a Dependabot major ignore while production remains on Node 22 Alpine LTS. Documented the stale Nodemailer PR as replaced by EmailJS.
- Verification commands: `npm install eslint@10.4.0 --package-lock-only --no-audit --no-fund`, `npm ci`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`, `docker build -t seddleup:latest .`, `docker compose build seddleup`, `npm run security:audit`, `npm run security:scan`.
- Status: Fixed in repository configuration; pending hosted Actions confirmation for updated action versions.

## Issue 9: Collaborative purchase permissions

- Date encountered: 2026-05-28
- Error summary: Trip and expense workflows were owner-only, so trip members could not collaboratively add or manage their own purchases.
- Root cause: Trips had an `ownerId` but no membership table, expenses did not track creator/updater/status, and audit logs were not trip-scoped.
- Files changed: Prisma schema and migration, trip/participant/expense server actions, trip list/detail pages, expense forms, expense cards, permission helpers, tests, and documentation.
- Fix applied: Added `TripMember`, participant user links, expense ownership/status fields, trip-scoped audit metadata, server-side permission helpers, collaborative expense filters, activity feed, and tests for permission/status behavior.
- Verification commands: `npx prisma validate`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Status: In progress on `feature/collaborative-purchases-permissions`.

## Issue 10: Payments, receipts, lookup, and Discord expansion

- Date encountered: 2026-05-28
- Error summary: The app needed settlement payment links, receipt upload/parsing, retailer-assisted item entry, and Discord account linking/commands.
- Root cause: The collaborative ledger existed, but settlement convenience, receipt evidence, item entry assistance, and chat integration had no persistent models or service boundaries.
- Files changed: Prisma schema and migration, account/trip/receipt pages, receipt/download and lookup/Discord API routes, payment/receipt/item lookup/Discord services, Docker Compose, environment examples, tests, and documentation.
- Fix applied: Added external payment methods, local receipt storage and parser review, itemized receipt split helpers, server-side item lookup with mock provider and cache, Discord signed interactions and linking tokens, and docs for configuration/security.
- Verification commands: `npx prisma validate`, `npx prisma migrate deploy`, `npm run format:check`, `npm run typecheck`, `npm test`.
- Status: In progress locally on `feature/local-major-expansion`; not pushed.

## Issue 11: CodeQL workflow and token digest findings plus picomatch Trivy finding

- Date encountered: 2026-05-28
- Error summary: CodeQL reported missing workflow permissions in CI and continued to flag one-time token HMAC digests as insufficient password hashing. Trivy also reported vulnerable `picomatch@4.0.3`.
- Root cause: The CI workflow did not declare explicit least-privilege permissions. CodeQL treats password reset/OAuth/Discord one-time token digest flows like user password hashing even though the tokens are high-entropy random lookup secrets keyed with HMAC-SHA-256. Trivy was interpreting the unresolved package range as vulnerable despite the installed tree resolving patched versions.
- Files changed: `.github/workflows/ci.yml`, `lib/token-digest.ts`, `package.json`, `package-lock.json`, and this log.
- Fix applied: Added `permissions: contents: read` to CI, documented the CodeQL false positive at the HMAC line with a query-specific suppression, and added direct `picomatch@4.0.4` so the installed root package is explicitly patched.
- Verification commands: `npm ls picomatch --all`, `npm run security:audit`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`.
- Status: Fixed locally; not pushed.

## Issue 12: PR readiness hardening for expansion branch

- Date encountered: 2026-05-28
- Error summary: Local PR review of `484b5cd` found hardening gaps around receipt path containment, receipt edit authorization, Discord replay resistance, unsafe legacy payment URLs, and default exposure of new receipt/Discord surfaces.
- Root cause: The feature branch added the initial service boundaries and UI, but some new edges needed production safety checks before review.
- Files changed: `lib/receipts/storage.ts`, `app/api/receipts/[receiptId]/file/route.ts`, `lib/actions/receipts.ts`, receipt pages, Discord security/interaction route, settlement UI, config/env docs, `.gitignore`, and focused tests.
- Fix applied: Constrained receipt reads/writes to the configured upload directory, restricted receipt review/attachment to uploaders or managers, added Discord signature timestamp freshness checks, suppressed unsafe persisted payment URLs at render time, and gated receipt uploads plus Discord interactions behind explicit feature flags.
- Verification commands: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run security:audit`.
- Status: Fixed locally; not pushed.

## Issue 13: iOS Safari expense and SSO regressions

- Date encountered: 2026-05-28
- Error summary: iOS/Safari users could fail to complete add-expense and SSO flows after the major expansion.
- Root cause: Expense amount fields used `type=number`, which is brittle on iOS decimal keyboards and locale comma entry. OAuth login completed through a client-side credentials fetch after the provider callback, which is fragile on Safari after cross-site redirects.
- Files changed: Expense forms, expense parsing action, OAuth callback handling, test-only OAuth provider routes, Playwright config/tests, CI workflow, and README testing docs.
- Fix applied: Changed money entry fields to `type=text` with `inputMode=decimal`, normalized comma decimals server-side, and made OAuth callbacks establish the NextAuth JWT session server-side before redirecting to the dashboard. Added Playwright desktop/mobile browser projects and Mobile Safari regression tests.
- Verification commands: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run test:e2e:ios`, `npm run build`, `npm run security:audit`.
- Status: In progress locally.
