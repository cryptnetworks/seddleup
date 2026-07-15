# Contributing

## Setup

Use Node.js 24.18.0 LTS. The bundled npm 11.16.0 version is supported; do not
pin a newer npm unless the reason is documented.

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open `http://localhost:3000`.

## Branch Naming

Use short, descriptive branch names:

```text
feature/oauth-provider-cleanup
fix/mfa-login-regression
docs/docker-deployment
security/session-validation
```

## Coding Standards

- Keep server actions grouped by domain under `lib/actions/`.
- Keep calculation and business logic in `lib/`, not React components.
- Prefer server components unless interactivity requires a client component.
- Use Zod schemas from `lib/validation.ts` for incoming form data.
- Validate authorization server-side for protected and admin workflows.
- Do not log passwords, tokens, reset links, MFA secrets, recovery codes, raw request bodies, or full session cookies.
- Keep comments focused on non-obvious behavior.

## Required Checks

Run these before opening a pull request:

```bash
npm run format:check
npm run docs:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run security:audit
```

The E2E launcher uses a free port plus disposable SQLite and upload paths; it
does not inherit Docker paths or reuse a developer server. Run the focused
CI development matrix, production build/server smoke, and enabled receipt paths
with:

```bash
npm run test:e2e:ci
npm run test:e2e:production
npm run test:e2e:receipts
```

See [Testing and Production Readiness](docs/wiki/Testing-and-Production-Readiness.md)
for the browser matrix, temporary-storage rules, WebKit investigation commands,
and SEO QA procedure.

CI, amd64 Docker builds and probes, and compatible security scans use the
repository's trusted Linux x64 self-hosted runner. Public fork pull requests are
routed to GitHub-hosted runners. Runner prerequisites, cleanup rules, and the
`USE_SELF_HOSTED_X64=false` outage fallback are documented in
[Repository Automation](docs/wiki/Repository-Automation.md).

For Docker-impacting changes:

```bash
docker build -t seddleup:ci .
npm run test:docker
npm run test:docker:profiles
```

`test:docker` uses only temporary labeled volumes and containers. It must never
be pointed at an operator or production volume. The probe image is local and is
not published. `test:docker:profiles` uses only fake configuration, isolated
certificates, and disabled container networking for external-service commands.

## Prisma Changes

For schema changes:

1. Update `prisma/schema.prisma`.
2. Add a migration under `prisma/migrations`.
3. Run `npm run prisma:generate`.
4. Add or update tests that cover the behavior.

## Pull Request Checklist

- Tests and type checks pass.
- Security implications were considered.
- New environment variables are documented in `.env.example`, `.env.docker.example`, README, and wiki docs as needed.
- Migrations are included when schema changes require them.
- Docker deployment impact is documented when relevant.

## Commit Messages

Use short imperative commit messages:

```text
Add password reset token cleanup
Fix Docker startup validation
Refactor trip server actions
```

Mention migrations, environment variables, and deployment changes in the commit body when they affect operators.
