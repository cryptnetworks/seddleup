# Configuration

SeddleUp reads configuration from environment variables. Docker deployments should start from `.env.docker.example`.

## Required Values

```env
NODE_ENV=production
DATABASE_URL=file:/app/data/seddleup.db
NEXTAUTH_URL=https://app.example.com
PUBLIC_APP_URL=https://app.example.com
NEXTAUTH_SECRET=generate-a-long-random-secret
TOKEN_DIGEST_SECRET=generate-a-long-random-secret
AUTH_CONFIG_ENCRYPTION_KEY=generate-a-long-random-secret
```

`AUTH_URL` should also match the public URL when deployed behind a proxy:

```env
AUTH_URL=https://app.example.com
```

## Secrets

Generate separate values:

```bash
openssl rand -base64 32
openssl rand -base64 32
openssl rand -base64 32
```

- `NEXTAUTH_SECRET` signs NextAuth session tokens.
- `TOKEN_DIGEST_SECRET` keys stored one-time token digests.
- `AUTH_CONFIG_ENCRYPTION_KEY` encrypts saved OAuth provider client secrets.

Changing `TOKEN_DIGEST_SECRET` invalidates outstanding password reset, email verification, MFA session handoff, and OAuth handoff tokens. Back up `AUTH_CONFIG_ENCRYPTION_KEY`. Losing it prevents decrypting stored provider secrets.

## Public URL Values

For public deployments, these should all be the public HTTPS URL:

```env
NEXTAUTH_URL=https://app.example.com
AUTH_URL=https://app.example.com
PUBLIC_APP_URL=https://app.example.com
```

If OAuth redirects to `localhost`, HTTP, or `0.0.0.0`, these values are usually wrong or missing.

## Compose Profiles

```env
COMPOSE_PROFILES=cloudflare
```

or:

```env
COMPOSE_PROFILES=nginx
```

Leave `COMPOSE_PROFILES` empty only when running the private app container without a public deployment profile.

## SMTP

SMTP is optional but recommended for production:

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

Use `SMTP_SECURE=false` for port `587` with STARTTLS. Use `SMTP_SECURE=true` for implicit TLS ports such as `465`.

## Rate Limiting

The built-in limiter uses process-local memory. There is no required Redis or
shared-store dependency today, and no `RATE_LIMIT_STORE` setting is supported
yet.

This is acceptable for a single app container. For multi-replica production
deployments, add shared rate limiting at the reverse proxy, load balancer, edge,
or hosting platform layer until app-level shared store support is added.

## Receipts

```env
RECEIPT_UPLOAD_ENABLED=false
RECEIPT_UPLOAD_DIR=uploads/receipts
MAX_RECEIPT_UPLOAD_MB=10
```

Receipt uploads are disabled until `RECEIPT_UPLOAD_ENABLED=true` is set. For
Docker, prefer `RECEIPT_UPLOAD_DIR=/app/data/uploads/receipts` so uploaded files
live in the persistent app volume and are not served as static public files.

## Item Lookup

```env
ITEM_LOOKUP_ENABLED=false
ITEM_LOOKUP_PROVIDER=mock
ITEM_LOOKUP_CACHE_TTL_SECONDS=3600
AMAZON_API_KEY=
AMAZON_ASSOCIATE_TAG=
WALMART_API_KEY=
TARGET_API_KEY=
```

The mock provider is available for development and tests. Real retailer
providers should remain disabled until official API credentials and provider
implementations are configured.

## Discord

```env
APP_BASE_URL=https://app.example.com
DISCORD_ENABLED=false
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_PUBLIC_KEY=
DISCORD_GUILD_ID=
```

Set `DISCORD_ENABLED=true` only when the public key and bot credentials are
configured. Configure Discord interactions to call `/api/discord/interactions`
on the public app URL. `DISCORD_GUILD_ID` is optional and useful for development
command registration.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
