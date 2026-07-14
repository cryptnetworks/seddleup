# Repository Automation

SeddleUp includes GitHub automation for validation, Docker images, dependency updates, and security scanning.

## CI

The CI workflow runs on pushes and pull requests. It installs dependencies,
validates configuration, validates Prisma, applies migrations, runs formatting
checks, lint, TypeScript, unit/integration tests, Chromium and Mobile Safari E2E
smoke tests, and a production build.

Local equivalent:

```bash
npm run validate:config
npx prisma validate
npx prisma migrate deploy
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

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

Docker-relevant changes also run an amd64 runtime-probe job. The job builds a
local `seddleup:ci` image without publishing it, then runs:

```bash
npm run test:docker
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

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
