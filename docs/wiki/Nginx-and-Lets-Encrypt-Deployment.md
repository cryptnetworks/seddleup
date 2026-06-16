# Nginx and Let's Encrypt Deployment

The `nginx` Compose profile runs a public Nginx reverse proxy and Certbot DNS-01 certificate automation.

## Services

- `seddleup`: private Next.js app on internal port `3000`
- `nginx`: public reverse proxy on ports `80` and `443`
- `certbot`: Let's Encrypt DNS-01 certificate issuance and renewal

## Environment

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

The Cloudflare API token must have:

- `Zone:DNS:Edit`
- `Zone:Zone:Read`

## DNS

Create an `A` record for your domain, for example `app.example.com`, pointing to the server public IPv4 address. Add an `AAAA` record only if the server has public IPv6.

## Issue Staging Certificates

```bash
docker compose up -d seddleup
./scripts/init-letsencrypt.sh
docker compose --profile nginx up -d
```

## Switch to Production Certificates

Set:

```env
CERTBOT_STAGING=0
```

Then rerun:

```bash
./scripts/init-letsencrypt.sh
docker compose --profile nginx up -d
```

## Renew Certificates

```bash
./scripts/renew-certs.sh
```

Example cron:

```cron
17 3,15 * * * cd /path/to/SeddleUp && ./scripts/renew-certs.sh >> /var/log/seddleup-certbot.log 2>&1
```

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
