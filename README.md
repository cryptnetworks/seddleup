# SeddleUp

SeddleUp is a Docker-deployable Next.js app for tracking group trip expenses,
participants, balances, and settlement suggestions.

## Features

- Trip, participant, expense, balance, and settlement tracking
- Collaborative trip memberships with owner/admin/member/viewer permissions
- Member-created expenses with draft, submitted, disputed, approved, and settled states
- External payment profile links for settlement convenience
- Local receipt upload with parser review and itemized line item storage
- Server-side retail item lookup abstraction with mock/development provider
- Discord account linking and slash-command interaction endpoint
- Credentials login with email verification and password reset
- Admin and trip-member invitation flows for new users
- Email-code or authenticator-app MFA
- Admin portal for users, auth providers, settings, and audit logs
- OAuth login and account linking for Google, GitHub, Discord, and Facebook
- Docker healthcheck at `/api/health`

## Screenshots

Screenshots are not committed yet. Add current dashboard, trip detail, account, and admin views here when a stable release UI is captured.

## Docker Image

Current GHCR image:

```bash
docker pull ghcr.io/cryptnetworks/seddleup:latest
```

The `latest` image is published for `linux/amd64` and `linux/arm64/v8` (aarch64).

## Required Configuration

Start from the Docker env example:

```bash
cp .env.docker.example .env
openssl rand -base64 32
openssl rand -base64 32
openssl rand -base64 32
```

Use separate generated values for `NEXTAUTH_SECRET`, `TOKEN_DIGEST_SECRET`, and
`AUTH_CONFIG_ENCRYPTION_KEY`.

Minimum local Docker values:

```env
NODE_ENV=production
DATABASE_URL=file:/app/data/seddleup.db
NEXTAUTH_URL=http://localhost:3000
PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=paste-generated-secret-here
TOKEN_DIGEST_SECRET=paste-generated-secret-here
AUTH_CONFIG_ENCRYPTION_KEY=paste-generated-secret-here
SMTP_ENABLED=false
RECEIPT_UPLOAD_ENABLED=false
RECEIPT_UPLOAD_DIR=uploads/receipts
MAX_RECEIPT_UPLOAD_MB=10
ITEM_LOOKUP_ENABLED=false
ITEM_LOOKUP_PROVIDER=mock
```

For a public deployment, use the public HTTPS URL everywhere:

```env
NEXTAUTH_URL=https://app.example.com
AUTH_URL=https://app.example.com
PUBLIC_APP_URL=https://app.example.com
```

`TOKEN_DIGEST_SECRET` keys one-time token digests for invitations, password
reset, email verification, MFA session handoff, and OAuth login handoff tokens.
Changing it invalidates outstanding one-time tokens safely. `AUTH_CONFIG_ENCRYPTION_KEY`
encrypts stored OAuth provider secrets. Keep it backed up; losing it prevents
decrypting saved provider secrets.

See `.env.example` and `.env.docker.example` for the full variable list.

## Run With Docker

```bash
docker volume create seddleup_data

docker run --name seddleup \
  -p 3000:3000 \
  -v seddleup_data:/app/data \
  --env-file .env \
  ghcr.io/cryptnetworks/seddleup:latest
```

Open `http://localhost:3000`.

The container starts as a non-root user, validates configuration, generates Prisma
Client, applies Prisma migrations, and then starts the Next.js production server.
SQLite data is stored in `/app/data`, so mount a persistent volume there.

Healthcheck:

```bash
curl http://localhost:3000/api/health
```

## Run With Docker Compose

The included Compose file is production-oriented. It pulls the GHCR image and
runs SeddleUp privately on the Docker network.

```bash
docker compose pull seddleup
docker compose up -d seddleup
```

Compose mounts `seddleup_data` at `/app/data`.

Existing deployments that used the old `triptally_data` volume should back up
the old volume before switching names. On startup, SeddleUp migrates
`/app/data/triptally.db` to `/app/data/seddleup.db` when the old file exists in
the mounted volume and the new file is absent.

To use the GHCR image with Compose instead of building locally, either edit
`docker-compose.yml` or override the service image in your deployment tooling:

```yaml
services:
  seddleup:
    image: ghcr.io/cryptnetworks/seddleup:latest
    build: null
```

## Public Deployment Options

SeddleUp supports two Docker Compose deployment profiles:

- `nginx` - public Nginx reverse proxy with Certbot DNS-01 certificates.
- `cloudflare` - Cloudflare Tunnel with no public inbound ports.

Set one profile in `.env`:

```env
COMPOSE_PROFILES=cloudflare
```

or:

```env
COMPOSE_PROFILES=nginx
```

Then start the selected deployment:

```bash
docker compose up -d --build
```

## Cloudflare Tunnel

Set:

```env
COMPOSE_PROFILES=cloudflare
DOMAIN=app.example.com
PUBLIC_APP_URL=https://app.example.com
NEXTAUTH_URL=https://app.example.com
AUTH_URL=https://app.example.com
CLOUDFLARE_TUNNEL_TOKEN=your-cloudflare-tunnel-token
```

In Cloudflare Zero Trust, create a tunnel and public hostname:

- Hostname: `app.example.com`
- Service: `http://seddleup:3000`

Start:

```bash
docker compose --profile cloudflare up -d --build
```

No public inbound ports are required. The `cloudflared` container connects
outbound to Cloudflare and forwards traffic to the private `seddleup` service.

## Nginx And Let's Encrypt

Set:

```env
COMPOSE_PROFILES=nginx
DOMAIN=app.example.com
PUBLIC_APP_URL=https://app.example.com
NEXTAUTH_URL=https://app.example.com
AUTH_URL=https://app.example.com
LETSENCRYPT_EMAIL=admin@example.com
CERTBOT_STAGING=1
DNS_PROVIDER=cloudflare
CLOUDFLARE_API_TOKEN=your-cloudflare-token
```

The Cloudflare API token must have `Zone:DNS:Edit` and `Zone:Zone:Read` for the
zone that owns `DOMAIN`.

Issue staging certificates first:

```bash
docker compose up -d seddleup
./scripts/init-letsencrypt.sh
docker compose --profile nginx up -d
```

When staging works, set:

```env
CERTBOT_STAGING=0
```

Then rerun:

```bash
./scripts/init-letsencrypt.sh
docker compose --profile nginx up -d
```

Manual renewal:

```bash
./scripts/renew-certs.sh
```

## Email And MFA

SMTP is optional but recommended for production. SeddleUp uses email for account
verification, password reset links, invitations, and email two-factor codes.

```env
SMTP_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=no-reply@app.example.com
EMAIL_APP_NAME="SeddleUp"
PASSWORD_RESET_TOKEN_MINUTES=45
```

Use `SMTP_SECURE=false` for port `587` with STARTTLS. Use `SMTP_SECURE=true` only
for implicit TLS ports such as `465`.

Two-factor authentication can be disabled, set to email codes, or set to
authenticator-app TOTP from the account settings page.

## Payments, Receipts, Lookup, And Discord

Payment methods are external links or handles only. SeddleUp does not process
payments, store payment credentials, or call payment provider APIs. Settlement
cards show enabled trip-member-visible payment methods for the person receiving
money.

Receipt uploads are off by default and should be enabled explicitly with
`RECEIPT_UPLOAD_ENABLED=true` after `RECEIPT_UPLOAD_DIR` points at a persistent,
non-public filesystem path. Use a Docker-mounted path such as
`/app/data/uploads/receipts` in production. Allowed uploads are PDF, JPEG, PNG,
HEIC, and HEIF up to `MAX_RECEIPT_UPLOAD_MB`. Receipt files are served only
through authenticated download routes that check trip membership and keep file
paths inside the configured upload directory.

Receipt parsing uses a local heuristic parser by default. It extracts obvious
receipt text from text-like PDFs, attempts merchant/date/subtotal/tax/tip/total
matching, stores raw extracted text, and leaves low-confidence or image-only
receipts available for manual correction.

Retail item lookup is disabled by default. The `mock` provider is available for
development and tests. Real retailer providers are intentionally disabled until
official or affiliate API credentials and provider implementations are added.

Discord integration is off by default. Set `DISCORD_ENABLED=true` before
exposing the HTTP interactions endpoint at `/api/discord/interactions`.
Configure Discord to use that public endpoint, set `DISCORD_PUBLIC_KEY`, and run
the command registration helper when bot credentials are available:

```bash
npm run discord:register
```

The production Docker image intentionally does not include `npm`. With Docker
Compose, use the optional `discord` profile to register commands through the
image's Node runtime:

```bash
docker compose --profile discord run --rm discord-commands
```

## Admin And OAuth Providers

The first registered user becomes the bootstrap administrator. Admin pages are
available under `/admin`.

Admins can invite new users from `/admin/users`. Invitations are emailed with
SeddleUp branding, expire after seven days, and can be resent or revoked while
pending. Invitation tokens are sent only in the email link; the database stores
only keyed token digests.

OAuth provider callback URLs:

```txt
https://app.example.com/api/auth/oauth/google/callback
https://app.example.com/api/auth/oauth/github/callback
https://app.example.com/api/auth/oauth/discord/callback
https://app.example.com/api/auth/oauth/facebook/callback
```

Provider client secrets are encrypted with `AUTH_CONFIG_ENCRYPTION_KEY`.

## Collaborative Expenses

Trip owners are recorded as `owner` members when trips are created. Owners and
trip admins can manage trip settings, participants, and all expenses. Members can
view trip expenses and balances, add their own expenses, and edit or delete their
own expenses until those expenses are marked `settled`. Viewers can read trip
details without changing the ledger.

Expense statuses control visibility and balances:

- `draft` is visible only to the creator and trip managers and is excluded from
  balances.
- `submitted`, `approved`, `disputed`, and `settled` are visible to trip members
  and included in balances.
- `settled` expenses are locked from normal edits and deletes.

Participant records can link to app users by matching email. Linked users become
trip members automatically when a manager adds or updates the participant.
When a trip manager adds a participant email that does not belong to an app user,
SeddleUp creates one pending invitation for that email and trip. Accepting the
invite creates or links the account and adds the user to the trip as a member.
Expense, participant, and trip changes are written to the audit log with trip
context.

## Local Development

Use Node.js 22. The Docker image remains pinned to the Node 22 Alpine LTS line
until Node 26 leaves Current status and the Next.js/Prisma/native-module stack
has clean support for it.

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open `http://localhost:3000`.

## Testing And Quality Checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run security:audit
docker build -t seddleup:ci .
```

End-to-end tests use Playwright:

```bash
npx playwright install chromium firefox webkit
npm run test:e2e
npm run test:e2e:ios
npm run test:e2e:headed
```

Playwright starts a local dev server against `file:./playwright.db` unless
`PLAYWRIGHT_BASE_URL` is set. The test server sets local `NEXTAUTH_URL`,
`PUBLIC_APP_URL`, `NEXTAUTH_SECRET`, `TOKEN_DIGEST_SECRET`, and
`AUTH_CONFIG_ENCRYPTION_KEY` values automatically. It also enables the
test-only OAuth provider with `TEST_OAUTH_PROVIDER_ENABLED=true`; that provider
is ignored in production and exists only for SSO redirect/callback regression
tests.

The browser matrix includes desktop Chromium, Firefox, WebKit, Mobile Chrome,
and a Mobile Safari project using Playwright's iPhone WebKit profile. The iOS
regression test covers decimal amount entry and submit behavior for the add
expense flow.

## Repository Automation

GitHub Actions provide CI, Docker image publishing, dependency review, security scanning, and release creation. Dependabot checks npm packages, GitHub Actions, and Docker base images weekly.

The security workflow runs high-severity npm audit, Trivy filesystem scanning, and Trivy Docker image scanning. CodeQL is expected to run through GitHub default setup in repository settings.

Current dependency remediation replaces Nodemailer with EmailJS for direct SMTP sending and uses scoped npm overrides for vulnerable transitive packages that upstream dependencies have not yet bumped.
Major ESLint and Docker Node runtime updates are intentionally deferred until
their peer dependency/runtime support is clean; minor and patch dependency
updates remain grouped for routine review.

## Backups

Back up SQLite:

```bash
mkdir -p backups
docker run --rm \
  -v seddleup_data:/data \
  -v "$PWD/backups:/backup" \
  alpine sh -c 'cp /data/seddleup.db /backup/seddleup-$(date +%Y%m%d-%H%M%S).db'
```

Restore SQLite:

```bash
docker stop seddleup
docker run --rm \
  -v seddleup_data:/data \
  -v "$PWD/backups:/backup" \
  alpine sh -c 'cp /backup/seddleup.db /data/seddleup.db'
docker start seddleup
```

## Updates

Pull the new image, recreate the container, and keep the same volume:

```bash
docker pull ghcr.io/cryptnetworks/seddleup:latest
docker rm -f seddleup
docker run --name seddleup \
  -p 3000:3000 \
  -v seddleup_data:/app/data \
  --env-file .env \
  ghcr.io/cryptnetworks/seddleup:latest
```

The startup entrypoint applies database migrations automatically.

## Troubleshooting

- If the container exits immediately, check `NEXTAUTH_SECRET`,
  `TOKEN_DIGEST_SECRET`, `AUTH_CONFIG_ENCRYPTION_KEY`, and `DATABASE_URL`.
- If OAuth redirects to localhost or `0.0.0.0`, set `PUBLIC_APP_URL`,
  `NEXTAUTH_URL`, and `AUTH_URL` to the public HTTPS URL.
- If Cloudflare Tunnel starts but the site is unavailable, confirm the public
  hostname service is exactly `http://seddleup:3000`.
- If Nginx certificate issuance fails, verify the Cloudflare token permissions and
  DNS propagation.
- If SQLite is missing after recreation, confirm `/app/data` is mounted to the
  same persistent Docker volume.

## Security Notes

- Sessions use NextAuth JWT cookies.
- Production cookies are secure and HTTP-only where applicable.
- State-changing requests include same-origin CSRF checks.
- OAuth app-login handoff tokens are short-lived, single-use, and stored in an
  HTTP-only cookie.
- Receipt files are stored outside the public asset tree and require trip
  membership for download.
- Payment methods store only external handles or links, never credentials.
- Retail lookup provider calls run server-side and must not expose API keys to
  the browser.
- Security headers are configured in `next.config.mjs`.
- Report vulnerabilities privately. See `SECURITY.md`.
