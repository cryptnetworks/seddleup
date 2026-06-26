# Contributing

## Local Development

Use Node.js 24.18.0 LTS with its bundled npm 11.16.0. The production Dockerfile
uses the matching `node:24.18.0-alpine` image.

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
npx prisma migrate deploy
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run security:audit
npm run build
docker build -t seddleup:ci .
```

If host Node/npm is unavailable but Docker works, run the core validation in a
throwaway Node container:

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
