# Cloudflare Tunnel Deployment

Cloudflare Tunnel publishes SeddleUp without opening inbound ports on the server. The `cloudflared` container makes an outbound connection to Cloudflare and forwards traffic to `http://seddleup:3000` on the Docker network.

## Environment

```env
COMPOSE_PROFILES=cloudflare
DOMAIN=app.example.com
PUBLIC_APP_URL=https://app.example.com
NEXTAUTH_URL=https://app.example.com
AUTH_URL=https://app.example.com
CLOUDFLARE_TUNNEL_TOKEN=your-cloudflare-tunnel-token
```

Also set real values for:

```env
NEXTAUTH_SECRET=
TOKEN_DIGEST_SECRET=
AUTH_CONFIG_ENCRYPTION_KEY=
```

## Cloudflare Setup

In Cloudflare Zero Trust:

1. Create a tunnel.
2. Add a public hostname.
3. Set the hostname to `app.example.com`.
4. Set the service to `http://seddleup:3000`.
5. Copy the tunnel token into `.env` as `CLOUDFLARE_TUNNEL_TOKEN`.

## Start

```bash
docker compose --profile cloudflare up -d --build
```

## Notes

- No public inbound ports are required.
- Do not also run the `nginx` profile unless intentionally deploying both paths.
- If the site is unavailable, confirm the Cloudflare hostname service is exactly `http://seddleup:3000`.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
