# ESLint 10 and Node.js 26 Upgrade Plan

Status reviewed: 2026-07-15. Neither major upgrade is enabled by this plan.
SeddleUp remains on ESLint 9 and Node.js 24 LTS.

The upgrades are independent: ESLint 10 can be evaluated on Node 24, and Node
26 must not carry an unrelated lint-stack migration. Each should use its own
branch, lockfile change, validation record, and pull request.

## Current compatibility

### ESLint 10

[ESLint's version 10 migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0)
supports Node 20.19+, 22.13+, and 24+, but changes flat-config lookup, recommended
rules, JSX reference tracking, and several plugin APIs. SeddleUp already uses a
flat `eslint.config.mjs`, so legacy config removal is not a blocker.

The installed Next.js 16.2.10 lint chain is not yet a clean ESLint 10 dependency
graph. Although `eslint-config-next@16.2.10` declares `eslint >=9`, its bundled
`eslint-plugin-import@2.32.0`, `eslint-plugin-jsx-a11y@6.10.2`, and
`eslint-plugin-react@7.37.5` peer ranges stop at ESLint 9. npm would therefore
install an unsupported peer combination. No override, legacy-peer-deps install,
or weakened lint rule is acceptable.

Entry criteria:

- A stable `eslint-config-next` release and every bundled React/import/
  accessibility/TypeScript parser plugin declare ESLint 10 compatibility.
- `npm ci` completes with no peer warnings or overrides on the supported npm.
- The [ESLint 10 migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0)
  has been reviewed against this repository's config, inline directives, and
  custom scripts.
- Editor integrations used by maintainers support ESLint 10 flat configuration.

Validation branch procedure:

1. Update only ESLint and the compatible lint-chain packages; regenerate the
   lockfile with the repository's supported Node/npm pair.
2. Run `npm ci`, `npm ls eslint`, and inspect all peer ranges. Do not use
   `--force`, `--legacy-peer-deps`, or broad overrides.
3. Run lint before changing rules. Fix genuine new findings; document any rule
   semantic change. Do not disable rules solely to reproduce ESLint 9 output.
4. Run formatting, type checking, unit/integration tests, production build,
   workflow/docs checks, E2E, and security audit because lint configuration is a
   repository-wide quality gate.

### Node.js 26

[Node.js lists version 26 as Current](https://nodejs.org/en/about/previous-releases),
not LTS, as of this review. The project's
[published schedule](https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule)
places Node 26 LTS in October 2026. Production applications are advised to use an
LTS line, so SeddleUp remains on Node 24.18.0 LTS until that transition and the
ecosystem gates below are complete.

Compatibility is promising but not sufficient to claim support:

- [Next.js 16 requires Node 20.9+](https://nextjs.org/docs/app/guides/upgrading/version-16),
  but the application still needs its own Node 26 build and browser validation.
- [Prisma supports and tests LTS Node releases](https://www.prisma.io/docs/orm/reference/system-requirements);
  its current engine range permits Node 26, while its guidance does not recommend
  Current releases for production.
- `better-sqlite3@12.10.0` declares Node 26 support and its
  [release notes](https://github.com/WiseLibs/better-sqlite3/releases/tag/v12.10.0)
  include Node 26 prebuilds. Both musl and glibc native loads still require local
  verification.
- `@playwright/test@1.61.1` declares Node 18+; that is an install range, not proof
  that SeddleUp's browsers, launchers, and production server pass on Node 26.
- [`actions/setup-node`](https://github.com/actions/setup-node) can select current
  Node releases, but self-hosted and GitHub-hosted runner behavior, caches, and
  Docker Buildx must be validated explicitly.
- `@types/node` stays on major 24 until the runtime upgrade. Moving types first
  can accidentally make code depend on APIs unavailable in production.

Entry criteria:

- Node 26 is LTS and current Prisma documentation recommends/supports that LTS
  line.
- Pinned Node 26 Alpine and Debian images are available for the architectures
  SeddleUp publishes.
- The selected `better-sqlite3` version provides or cleanly builds native modules
  for Linux x64/arm64 musl and the supported development platforms.
- Next.js, Playwright, Prisma, npm, and all GitHub Actions used by the repository
  run without compatibility exceptions.
- A temporary CI matrix has passed before the production engine range,
  Dockerfile, `.nvmrc`, `.node-version`, workflows, or `@types/node` move.

## Node 26 validation window

Use an isolated branch and add a non-required temporary Node 26 matrix first.
Test both a clean host install and clean containers; never reuse Node 24 native
modules or caches.

Required evidence:

- `npm ci`, `npm ls`, and a direct `better-sqlite3` open/query/close check.
- Prisma generate/validate and fresh plus existing-database migration deploy.
- Config validation, formatting, lint, type checking, all unit/integration tests,
  security audit, and production build.
- Development and production Playwright suites, including WebKit/Mobile Safari.
- Docker multi-stage build and runtime probes on Linux/amd64 and Linux/arm64,
  covering non-root startup, health, migration, restart, legacy database adoption,
  and data preservation.
- Optional Docker profile probes and release workflow dry validation.
- GitHub-hosted and trusted self-hosted runner validation with clean caches.
- Matching `@types/node` 26 type checking only after runtime behavior passes.

Once the matrix is stable, update Node pins together: `package.json` engines,
lockfile metadata, `.nvmrc`, `.node-version`, Docker stages, GitHub Actions,
developer/deployment documentation, and `@types/node`. Re-run the entire matrix
after the final pin. Retain Node 24 as the rollback runtime only if new migrations
and dependencies remain compatible with it; otherwise state the release boundary
explicitly.

## Exit and rollback criteria

An upgrade is not complete because installation succeeds. ESLint 10 requires a
warning-free supported plugin graph and unchanged rule strength. Node 26 requires
all clean-install, native-module, Prisma, Docker, build, and E2E evidence above.

If either validation finds an upstream incompatibility, revert only that isolated
branch's dependency/pin changes, retain this status record, and wait for a stable
upstream release. Do not publish a partially supported runtime range.
