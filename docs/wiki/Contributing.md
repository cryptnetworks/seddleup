# Contributing

## Local Development

Use Node.js 22. The production Dockerfile also uses the Node 22 Alpine LTS line.

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open `http://localhost:3000`.

## Validation Commands

Run the same checks as CI:

```bash
npm run validate:config
npx prisma validate
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run security:audit
npm run build
docker build -t seddleup:ci .
```

The Playwright configuration forces local `NEXTAUTH_URL` and `PUBLIC_APP_URL` values when it starts its own dev server. This keeps local e2e runs from inheriting production callback URLs from `.env`.

## Prisma Changes

For schema changes:

1. Update `prisma/schema.prisma`.
2. Add a Prisma migration.
3. Regenerate Prisma Client.
4. Add or update tests for behavior that depends on the schema.

## Code Style

- Keep server actions grouped by domain under `lib/actions/`.
- Keep calculation and business logic in `lib/`, not React components.
- Prefer server components unless interactivity requires a client component.
- Use Zod schemas from `lib/validation.ts` for incoming form data.
- Do not log passwords, tokens, reset links, raw request bodies, MFA secrets, recovery codes, or full session tokens.

## Tests

- Unit tests live under `tests/unit`.
- Integration tests live under `tests/integration`.
- Playwright tests live under `tests/e2e`.
- Security regression tests should be added for auth, session, CSRF, XSS, redirects, and header changes.

Useful commands:

```bash
npm run test:unit
npm run test:integration
npm test
npm run test:e2e
```

## Commit Guidance

Use short imperative commit messages:

```text
Add password reset token cleanup
Fix Docker startup validation
Refactor trip server actions
```

Mention migrations, environment variables, and deployment changes in the commit body when they affect operators.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
