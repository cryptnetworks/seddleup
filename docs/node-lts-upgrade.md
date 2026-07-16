# Node LTS Upgrade

## Executive Summary

SeddleUp now targets Node.js 24.18.0 LTS and the npm 11.16.0 version bundled
with that runtime. The production Dockerfile, local version files, package
engines, GitHub Actions, and contributor documentation all use the same Node
release. The lockfile was regenerated with npm 11.16.0.

No application API, database schema, or Prisma migration changes were made for
the Node upgrade. The final production image remains npm-less after dependency
installation and pruning.

## Runtime Versions

| Runtime | Previous                               | New                                          |
| ------- | -------------------------------------- | -------------------------------------------- |
| Node.js | `v22.23.1` from `node:22-alpine`       | `v24.18.0` from `node:24.18.0-alpine`        |
| npm     | `10.9.8` bundled with `node:22-alpine` | `11.16.0` bundled with `node:24.18.0-alpine` |

npm reported that `11.17.0` is available, but the project intentionally uses the
npm version bundled with Node.js 24.18.0 LTS.

## Files Modified

- `.github/workflows/ci.yml`: CI now uses Node.js 24.18.0.
- `.github/workflows/security.yml`: security workflow now uses Node.js 24.18.0.
- `.node-version`: added local Node version metadata.
- `.nvmrc`: added local Node version metadata.
- `CONTRIBUTING.md`: updated local setup guidance.
- `Dockerfile`: updated all build/runtime stages to `node:24.18.0-alpine`.
- `README.md`: updated setup, Docker fallback, and validation guidance.
- `SECURITY.md`: updated security/dependency-maintenance runtime language.
- `docs/running-issues.md`: removed stale wording that implied Node 22 remains
  the current runtime target.
- `docs/wiki/Contributing.md`: updated contributor runtime and Docker validation
  guidance.
- `docs/wiki/Repository-Automation.md`: updated Docker-based validation and
  dependency deferral guidance.
- `package.json`: added Node/npm engine requirements and aligned `@types/node`
  with the Node 24 runtime target.
- `package-lock.json`: regenerated with npm 11.16.0 and Node 24-compatible
  type definitions.

## Dependency Changes

- `@types/node` changed from the Node 25 type line to `^24.13.2` so TypeScript
  definitions do not get ahead of the deployed Node 24 runtime.
- npm lock metadata now includes the Node/npm engines.
- Lockfile regeneration also refreshed compatible transitive patch versions
  selected by existing semver ranges.

No unrelated major application-library upgrades were made. After the Node 24
install and dedupe, `npm outdated` reports only intentional major-version
deferrals:

```text
Package      Current   Wanted  Latest
@types/node  24.13.2  24.13.2  26.0.1
eslint        9.39.4   9.39.4  10.5.0
```

The regenerated lockfile uses `@types/node@24.13.2` for the Node 24 runtime
target. ESLint 10, Node 26, and `@types/node` 26 remain intentionally deferred;
their current blockers and objective entry criteria are maintained in the
[ESLint 10 and Node.js 26 upgrade plan](runtime-upgrade-plan.md).

## Compatibility Review

- ESM/CommonJS: no code changes required.
- Built-in `fetch` and Web Streams: no code changes required.
- `crypto` and OpenSSL: existing token, password, OAuth, and MFA code paths did
  not require API changes.
- URL handling: no code changes required.
- Filesystem behavior: no code changes required.
- Native modules: Prisma and better-sqlite3 install cleanly inside the Node 24
  Alpine Docker environment. An initial mounted-volume test reused a stale
  `better-sqlite3` binary from the previous `node_modules`; a clean
  `npm ci` under Node 24 replaced it and the full Vitest suite passed.
- npm behavior: the lockfile was regenerated with npm 11.16.0 and dependency
  installation uses `npm ci` in Docker.

## Validation Results

Host `node`, `npm`, and `npx` are unavailable in this environment, so validation
was run with Docker using the target Node.js 24.18.0 image.

| Command                                                                                  | Result                                                                                                     |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `docker run --rm node:24.18.0-alpine node -v`                                            | Passed: `v24.18.0`.                                                                                        |
| `docker run --rm node:24.18.0-alpine npm -v`                                             | Passed: `11.16.0`.                                                                                         |
| `docker run --rm node:22-alpine node -v`                                                 | Passed: previous image reports `v22.23.1`.                                                                 |
| `docker run --rm node:22-alpine npm -v`                                                  | Passed: previous image reports `10.9.8`.                                                                   |
| `npm install --no-audit --no-fund --loglevel=error` in `node:24.18.0-alpine`             | Passed; regenerated dependencies with bundled npm 11.16.0.                                                 |
| `npm dedupe --no-audit --no-fund --loglevel=error` in `node:24.18.0-alpine`              | Passed: already up to date after dedupe.                                                                   |
| `npm ci --no-audit --no-fund --loglevel=error` in `node:24.18.0-alpine`                  | Passed: 576 packages installed cleanly.                                                                    |
| `npm audit --audit-level=high` in `node:24.18.0-alpine`                                  | Passed: `found 0 vulnerabilities`.                                                                         |
| `npm outdated` in `node:24.18.0-alpine`                                                  | Completed with exit code 1 for intentional major updates only; see dependency table above.                 |
| `npm run validate:config` in `node:24.18.0-alpine`                                       | Passed.                                                                                                    |
| `npx prisma validate` in `node:24.18.0-alpine`                                           | Passed: schema is valid.                                                                                   |
| `npx prisma migrate deploy` in `node:24.18.0-alpine`                                     | Passed: all 8 migrations applied.                                                                          |
| `npm run format:check` in `node:24.18.0-alpine`                                          | Passed: all matched files use Prettier style.                                                              |
| `npm run lint` in `node:24.18.0-alpine`                                                  | Passed.                                                                                                    |
| `npm run typecheck` in `node:24.18.0-alpine`                                             | Passed after Prisma Client generation.                                                                     |
| `npm test` in `node:24.18.0-alpine` with a migrated SQLite database                      | Passed: 25 test files, 86 tests.                                                                           |
| `npm run build` in `node:24.18.0-alpine`                                                 | Passed: Next.js 16.2.9 production build completed.                                                         |
| `docker build --no-cache -t seddleup:node24 .`                                           | Passed: fresh production image built from `node:24.18.0-alpine`; final stage removes npm and npx.          |
| Production runtime container from `seddleup:node24`                                      | Passed: Node `v24.18.0`, npm absent, config validation, Prisma Client generation, all 8 migrations, start. |
| `/api/health` against the production runtime container                                   | Passed: returned `{"ok":true,"data":{"service":"seddleup"}}`.                                              |
| Playwright E2E in custom `node:24.18.0-bookworm` browser image, Chromium + Mobile Safari | Passed: 32 passed, 2 skipped.                                                                              |
| Mobile Safari E2E                                                                        | Passed: decimal add/edit expense and test SSO login coverage completed.                                    |

Validation warnings:

- The first mounted-volume `npm test` attempt failed because stale
  `node_modules` contained an incompatible native `better-sqlite3` binary. A
  clean Node 24 `npm ci` resolved the native module mismatch.
- A follow-up `npm test` attempt failed because migrations had been applied to
  a container-local `/tmp` database that disappeared between containers. Using a
  mounted temporary SQLite database fixed the validation setup and the suite
  passed.
- Mobile Safari E2E emitted one Turbopack dev-server `ChunkLoadError`
  unhandled-rejection warning for an HMR chunk. The affected test continued and
  the full Chromium + Mobile Safari run passed.

## Remaining Follow-Up Items

- Revisit Node 26 only after it becomes LTS and the Next.js, Prisma,
  better-sqlite3, and Playwright stack advertises clean support.
- Revisit ESLint 10 in a separate PR after `eslint-config-next` and its plugin
  chain publish compatible peer ranges.
- Consider routine patch/minor dependency refreshes after the runtime upgrade is
  merged and validated.
- Host development machines should install Node.js 24.18.0; Docker remains the
  documented fallback when host Node/npm is unavailable.
