# Repository Hygiene Audit

This document records the deletion-focused audit performed from
`origin/main` at `8f97493e4fd0b6c87928ce5095543e77557829a1` on 2026-07-15. The audit
favored retention whenever runtime ownership, compatibility, or external use
could not be disproved.

## Method

Candidates were classified only after checking multiple forms of evidence:

- repository-wide import, path, script, and configuration references;
- framework conventions, browser/PWA endpoints, Prisma migrations, Docker
  startup behavior, and public URL compatibility;
- clean-install dependency provenance with `npm explain`;
- TypeScript unused-symbol analysis after generating Prisma Client;
- file hashes, image dimensions, tracked/ignored state, executable modes, and
  empty-file checks;
- git history and active issue/remediation documents; and
- overlap with open PRs #104 and #105 and planned work in open issues,
  especially #65 and #69.

No untracked build output, database, upload, screenshot, coverage, empty file,
or ignored artifact was found in the clean audit worktree. `node_modules/` was
created only by the audit's clean install and remains ignored.

## Removal Ledger

| Candidate                                                         | Classification              | Evidence                                                                                                                                                                                                                                                  | Required validation                                                                        |
| ----------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `lib/api-response.ts`                                             | Remove                      | No importer or symbol reference in application code, tests, scripts, or history after its introduction; the current API routes use their own response handling.                                                                                           | Lint, typecheck, unit/integration tests, production build, E2E.                            |
| Unused `DisabledProvider.provider` field and constructor argument | Remove                      | Prisma-generated `tsc --noUnusedLocals --noUnusedParameters` reports the private field as the only unused symbol; disabled providers return no result and do not expose a provider label.                                                                 | Focused item-lookup tests, lint, typecheck, build.                                         |
| `@prisma/adapter-pg`, `pg`, and `@types/pg`                       | Remove                      | No import or configuration reference; `npm explain` shows only root declarations and the adapter's own dependency chain. Runtime validation, Prisma schema/migrations, architecture docs, and issue #65 all define PostgreSQL as unsupported future work. | Clean install, Prisma validation/migrations, unit/integration tests, build, Docker probes. |
| `@babel/parser`                                                   | Remove                      | No repository import or tool configuration reference. `npm explain` shows the direct v8 package is root-only while ESLint's required v7 parsers remain independently installed in its dependency tree.                                                    | Clean install, lint, typecheck, tests, build, security audit.                              |
| `autoprefixer`                                                    | Remove                      | No PostCSS configuration or source reference. Tailwind v4's supported PostCSS path uses `@tailwindcss/postcss`, `tailwindcss`, and `postcss`; vendor prefixing is built in.                                                                               | Clean install, formatting, build, responsive/browser E2E.                                  |
| `package.json#prisma.seed`                                        | Replace with current config | Prisma v7 reads custom seeds from `prisma.config.ts` under `migrations.seed`; the duplicate package field is a legacy configuration path. The existing `npm run seed` command remains available.                                                          | `prisma validate`, disposable migration and `prisma db seed`, integration tests, build.    |
| Redundant `type-check` package script                             | Remove                      | It only invokes the canonical `typecheck` script, has no repository caller, and contributor/CI documentation consistently uses `npm run typecheck`.                                                                                                       | Clean install, `npm run typecheck`, CI-equivalent checks.                                  |

The dependency lockfile is regenerated from `package.json`; no transitive entry
is removed by hand.

## Retention Ledger

| Area retained                                                                                                                                  | Why it remains                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All Prisma migration directories and migration lock data                                                                                       | They are immutable upgrade history and are validated by readiness and Docker migration probes. A migration that appears superseded is still required for existing databases.                                     |
| `lib/login-token.ts` and `TwoFactorChallenge`-backed login handoff                                                                             | Current credentials login imports it and tests exercise it. It is distinct from the deleted legacy OAuth login-token table and remains security-sensitive runtime code.                                          |
| TripTally package name, `triptally.db` adoption, legacy environment aliases, and `tests/fixtures/triptally.ts`                                 | These are intentional compatibility surfaces governed by issue #69 and the rebrand plan. Removing them could break databases, deployments, or fixtures.                                                          |
| `@emnapi/core` and `@emnapi/runtime`                                                                                                           | They were added deliberately to satisfy the Tailwind Oxide WASI fallback's peer requirements after a CI lockfile failure. Host-only provenance is not enough to disprove cross-platform build use.               |
| Direct `picomatch` and scoped npm overrides                                                                                                    | The security incident record documents them as scanner-visible remediation for patched transitive dependency versions.                                                                                           |
| `postcss`, `@tailwindcss/postcss`, and `tailwindcss`                                                                                           | They are the supported Tailwind v4 PostCSS build chain and are referenced by PostCSS/CSS configuration.                                                                                                          |
| Duplicate `.nvmrc` and `.node-version` contents                                                                                                | Different Node version managers consume these conventional files. Both align with Docker, CI, and `engines`.                                                                                                     |
| Root and `public/branding/` logo/favicon duplicates                                                                                            | Some are externally addressable compatibility URLs; others are browser, email, SEO, PWA, maskable-icon, or source-brand-kit variants. Exact byte duplication does not make the URL endpoints interchangeable.    |
| Unreferenced icon sizes and SVG/PNG brand variants                                                                                             | They form the recently added browser/PWA/brand export set. External consumers cannot be audited from repository imports, and the total size is small relative to the compatibility risk.                         |
| Service worker, offline route, manifest icons, and metadata assets                                                                             | They are framework/browser entry points referenced through runtime URLs and covered by SEO/mobile tests rather than TypeScript imports.                                                                          |
| GitHub workflows, Docker/Compose files, entrypoint, TLS scripts, Docker probes, and Discord registration script                                | Every operational file has a package, workflow, Compose, Docker, or documented operator caller. Open PR #104 also extends profile and documentation validation around these surfaces.                            |
| Receipt PDF and TripTally test fixtures                                                                                                        | Both have live automated-test consumers; the TripTally fixture name is additionally compatibility-sensitive.                                                                                                     |
| Rebrand, branch-refactor, Node upgrade, incident, proposed-issue, and remediation documents                                                    | These are historical decisions, security rationale, or active planning records. Open PR #104 is adding navigation/validation and maintainability documentation, so consolidation here would overlap active work. |
| Open-issue foundations for receipts, monetary precision, auth tokens, participant deletion, account deletion, Postgres, MFA, and rate limiting | Existing code and schema that support open #63, #65, #75, and #97-#102 were not treated as dead merely because a workflow is incomplete.                                                                         |

## Baseline

Before deletion, a clean `npm ci` installed 571 packages. Configuration
validation, Prisma validation, formatting, lint, typecheck, the focused
item-lookup tests, and the production build passed. `npm audit` reported zero
vulnerabilities. The first sandboxed build attempt failed because Turbopack
could not bind an internal loopback port; the identical command passed outside
that sandbox, confirming an environmental rather than repository failure.

After cleanup, a second `npm ci` installed 547 packages. The five removed
packages are absent from the root dependency tree, while ESLint's own supported
transitive Babel parser remains. The lockfile removed 291 lines of package
metadata without a manual lockfile edit.

## Verification Notes

- All 130 unit and integration tests passed against a disposable migrated
  SQLite database.
- The full development Playwright matrix passed 91 tests with 44 intentional
  project-specific skips. Mobile Safari covered accessibility, auth, expenses,
  invitations, responsive layout, payment methods, receipts-disabled behavior,
  item lookup, health, SSO, and trip creation.
- Production E2E applied all nine migrations and passed its smoke and SEO
  checks. One initial smoke attempt timed out during navigation; its configured
  retry passed, and a focused clean rerun passed without retry.
- Enabled receipt upload/review/access-control E2E passed using disposable
  storage.
- The production Docker image built, and every fresh/restart/preservation,
  legacy-path, health, non-root, corrupt/inaccessible database, and failed
  migration runtime probe passed.
- Compose syntax passed for Discord, nginx, and Cloudflare profiles. Their
  network-isolated runtime checks also passed with fake inputs. Current nginx
  emits a deprecation warning for `listen ... http2`; open PR #104 already
  replaces it with `http2 on`, so this audit does not duplicate that active
  fix.
- Prisma schema, direct fresh migrations and status, Prisma v7 seed discovery,
  formatting, lint, typecheck, production build, internal documentation links,
  and the high-severity npm audit all passed.

## Scope Boundary

This audit does not delete remote branches, tags, releases, wiki history,
issues, PRs, database files, uploads, Docker volumes, or user-owned working-tree
changes. It does not rename compatibility identifiers, rewrite migrations, add
new product behavior, or absorb the deployment/documentation work in PR #104
or the settlement-payment work in PR #105.
