# Repository Automation

SeddleUp includes GitHub automation for application and documentation validation,
Docker images, dependency updates, and security scanning.

## Self-hosted Linux x64 runner

Expensive trusted jobs prefer a repository runner with all three labels:

```text
self-hosted
linux
x64
```

The runner must be a Linux x64 host with Git, Bash, standard GNU command-line
tools, Docker Engine, the Docker Compose v2 plugin, and a GitHub Actions runner
service account. It needs outbound HTTPS access to GitHub, GHCR, npm, Playwright,
and the scanner download endpoints, plus enough disk for browser and container
builds. Node 24.18.0 and Buildx are installed or configured by the workflow
actions. The account must be able to run Docker without interactive sudo. The CI
browser step uses Playwright's supported dependency installer, so the account
must either have passwordless sudo for package installation or the documented
Playwright Linux dependencies must already be installed.

Keep the runner and Docker daemon patched, restrict access to trusted
maintainers, and do not store application secrets, production databases,
backups, or uploads on it. Register it at repository scope, or place it in an
organization runner group restricted to this repository. Because a fork can
propose changes to workflow YAML, configure GitHub to require approval for all
outside-collaborator workflow runs and inspect workflow changes before approval.
Where organization runner groups are available, restrict this runner group to
the selected SeddleUp workflows as an additional control. Only trusted
maintainers should have permission to push branches because trusted push, tag,
and scheduled workflows may use the persistent self-hosted runner.

SeddleUp is public and can receive pull requests from forks. Every pull request,
including same-repository pull requests, is routed to `ubuntu-latest`; proposed
code never executes on the self-hosted runner. Pushes, tags, and scheduled runs
use the self-hosted runner only when the repository variable
`USE_SELF_HOSTED_X64` is exactly `true`. An absent variable or any other value
selects GitHub-hosted runners. The workflows do not use
`pull_request_target` to execute pull-request code.

GitHub Actions cannot automatically fall back from an offline self-hosted
runner. If the runner is unavailable, remove the repository variable or set
`USE_SELF_HOSTED_X64=false`, cancel the queued run, and rerun it. Set the
variable back to `true` after the runner is healthy. This is also the
supported temporary return to GitHub-hosted x64 runners; no workflow edit is
required.

The checkout action resets and cleans only the repository workspace before each
run. Eligible jobs also clean generated files afterward. Docker probes already
label and remove their temporary containers, networks, and volumes; workflow
cleanup removes only the run-scoped probe or security image created by that
job. Buildx manages its job-specific builder. Do not add broad Docker prunes or
cleanup commands that could remove unrelated runner workloads. Review runner
disk usage, the Actions work directory, Docker build cache, and tool caches
regularly, and stop the runner before manual maintenance.

The following jobs remain GitHub-hosted intentionally:

- native `linux/arm64/v8` image builds use `ubuntu-24.04-arm`;
- Docker manifest publication, GitHub release creation, and wiki synchronization
  handle publishing credentials in a short-lived environment;
- dependency review and documentation validation are inexpensive and can run
  safely for public fork pull requests.

## Documentation validation

The Documentation workflow runs for Markdown, docs tooling, and documentation
workflow changes. It installs dependencies with lifecycle scripts disabled, then
runs:

```bash
npm run docs:check
```

`markdownlint-cli2` validates structure. The repository link checker validates
relative files, repository-hosted files, wiki page targets, duplicate reference
definitions, and GitHub-style heading anchors without requesting external URLs.
External-link availability is deliberately outside routine CI so transient
network failures cannot make docs changes flaky.

## CI

The CI workflow runs on pushes and pull requests. It installs dependencies,
validates configuration, validates Prisma, applies migrations, runs formatting
checks, enforces the workflow runner policy, runs lint, TypeScript, unit/integration tests, Chromium and Mobile Safari E2E
smoke/accessibility tests, an isolated enabled-receipt flow, and a focused
Chromium `next start` smoke/SEO suite. The production suite performs its own
build, migration, readiness wait, and cleanup.

Local equivalent:

```bash
npm run validate:config
npm run workflows:check
npx prisma validate
npx prisma migrate deploy
npm run docs:check
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e:ci
npm run test:e2e:receipts
npm run test:e2e:production
npm run build
```

`npm run test:e2e:ci` is the bounded development-server matrix used by the
workflow. Run `npm run test:e2e` before a browser-sensitive pull request to
exercise the complete local matrix.

The browser launchers allocate free ports and unique ignored `tmp/` directories
for SQLite and uploads. They never reuse a running development server or an
operator/Docker database. See [Testing and Production Readiness](Testing-and-Production-Readiness)
for command variants, CI coverage, and known WebKit evidence.

If host Node/npm is unavailable but Docker works, use a throwaway Node container
for the core validation path:

```bash
docker build -t seddleup:local-check -f - . <<'EOF'
FROM node:24.18.0-alpine
WORKDIR /app
ENV NODE_ENV=test
ENV DATABASE_URL=file:/tmp/seddleup-local-check.db
ENV NEXTAUTH_URL=http://localhost:3000
ENV PUBLIC_APP_URL=http://localhost:3000
ENV NEXTAUTH_SECRET=local-nextauth-secret-that-is-long-enough
ENV TOKEN_DIGEST_SECRET=local-token-digest-secret-that-is-long-enough
ENV AUTH_CONFIG_ENCRYPTION_KEY=local-auth-config-key-that-is-long-enough
ENV SMTP_ENABLED=false
ENV PASSWORD_RESET_TOKEN_MINUTES=45
ENV TEST_OAUTH_PROVIDER_ENABLED=true
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --loglevel=error
COPY . .
RUN npm run validate:config
RUN npx prisma validate
RUN npx prisma migrate deploy
RUN npm run format:check
RUN npm run lint
RUN npm run typecheck
RUN npm test
RUN npm run build
EOF
```

## Docker Image Publishing

The Docker workflow builds the app image on Docker-relevant pull requests and
publishes to GitHub Container Registry from `main` and tags. Images are tagged
by branch, SHA, and `latest` where applicable.

Manifest publication waits for both runtime/migration probes and a dedicated
high/critical dependency and image scan. Package-write permission is limited to
the build and manifest jobs. Pull-request workflows are checked by
`npm run workflows:check`, which requires every self-hosted runner selection to
exclude `pull_request` events and rejects `pull_request_target`; proposed
pull-request code must remain GitHub-hosted.

Docker-relevant changes also run an amd64 runtime-probe job. The job builds a
local `seddleup:ci` image without publishing it, then runs:

```bash
npm run test:docker
npm run test:docker:profiles
```

The probe verifies:

- an empty persistent volume is migrated and becomes healthy;
- the container remains non-root and the built-in health check succeeds;
- restarting against an already migrated volume is idempotent;
- an existing sentinel record survives startup and migration;
- a volume containing only `triptally.db` is adopted as `seddleup.db` without
  losing the sentinel;
- corrupt, unreadable, and Prisma-failed databases stop startup with actionable
  errors instead of reaching `startup.ready` or silently creating a new
  database.

Every probe resource has a run-specific Docker label. Cleanup runs on success,
failure, and interruption, so the workflow never uses or deletes a named
deployment volume. Expected failure logs contain paths and error categories but
not database rows, secrets, tokens, or cookies.

The optional-profile probe validates all three Compose profiles, invokes the
Discord registration script without npm and without credentials, renders and
syntax-checks nginx with an isolated certificate, and runs Cloudflare ingress
validation with container networking disabled. It creates no Compose network,
uses only run-labeled disposable containers, and cleans temporary files on every exit.

## Security Workflow

The security workflow runs:

- `npm run security:audit` for high and critical npm advisories.
- Trivy filesystem scan.
- Trivy Docker image scan.

CodeQL is expected to run through GitHub default setup in repository settings. The repo does not define an advanced CodeQL workflow because GitHub rejects advanced CodeQL SARIF uploads while default setup is enabled.

Current npm audit output is expected to be clean. Vulnerable transitive dependencies may be pinned with scoped npm overrides when upstream packages lag patched versions. Do not run `npm audit fix --force` without reviewing breaking changes.

## Dependency Review

Pull requests run GitHub dependency review and fail on vulnerable dependency changes at the configured threshold.

## Dependabot

Dependabot checks:

- npm packages
- GitHub Actions
- Docker base images

Minor and patch updates are grouped where practical. Security updates should be reviewed promptly and tested through CI before merge.

Current major-version deferrals and update plan:

- ESLint 10 is ignored until `eslint-config-next` and its bundled
  React/import/accessibility plugins publish compatible peer ranges. Test this
  in its own PR with lint, typecheck, unit tests, E2E smoke, and production
  build.
- Node 26 Docker image updates are ignored while Node 26 is a Current release.
  Production Docker images stay on Node 24.18.0 Alpine LTS until the Next.js,
  Prisma, better-sqlite3, and Playwright stack has clean support. Test runtime
  image startup, migrations, Discord command registration, and E2E separately.
- `@types/node` 26 should wait until the runtime target moves beyond Node 24, so
  type definitions do not get ahead of deployed APIs.

SeddleUp sends SMTP mail through EmailJS. Do not reintroduce a direct Nodemailer dependency unless NextAuth and the app email layer are reviewed together for peer compatibility.

## Release Workflow

Version tags matching `v*.*.*` create a GitHub release with generated notes. Docker image publishing is handled by the Docker workflow for tag pushes.

---

[Wiki Home](Home) | [Testing and Production Readiness](Testing-and-Production-Readiness) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
