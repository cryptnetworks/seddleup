# Troubleshooting

## Container Exits Immediately

Check:

- `NEXTAUTH_SECRET` is set and is not a placeholder.
- `TOKEN_DIGEST_SECRET` is set and is not a placeholder.
- `AUTH_CONFIG_ENCRYPTION_KEY` is set in production and is not a placeholder.
- `DATABASE_URL` is valid.
- `/app/data` is writable.

View logs:

```bash
docker logs seddleup
```

## OAuth Redirects to localhost or 0.0.0.0

Set all public URL values to the public HTTPS URL:

```env
PUBLIC_APP_URL=https://app.example.com
NEXTAUTH_URL=https://app.example.com
AUTH_URL=https://app.example.com
```

## Cloudflare Tunnel Is Running but the Site Is Unavailable

Confirm the Cloudflare public hostname service is:

```text
http://seddleup:3000
```

Also confirm the `cloudflared` service shares the same Compose network as `seddleup`.

## Nginx Certificate Issuance Fails

Check:

- Cloudflare token has `Zone:DNS:Edit` and `Zone:Zone:Read`.
- Token is scoped to the correct zone.
- DNS has propagated.
- `DOMAIN` matches the intended hostname.

Use staging certificates first with:

```env
CERTBOT_STAGING=1
```

## SQLite Data Missing After Recreate

Confirm the same persistent volume is mounted:

```bash
docker volume ls
docker inspect seddleup
```

The app database should live at:

```text
/app/data/seddleup.db
```

## Healthcheck Fails

Check logs and database connectivity:

```bash
docker logs seddleup
curl http://localhost:3000/api/health
```

The `/api/health` endpoint checks database connectivity.

## Styling, Logo, Or Navigation Looks Broken

Compare the running app with the [Screenshots](Screenshots) gallery. If the
layout is unstyled or image assets are missing, check:

- `PUBLIC_APP_URL`, `NEXTAUTH_URL`, and `AUTH_URL` match the public address.
- The reverse proxy forwards normal app requests and static asset paths.
- Browser dev tools do not show 404s for `/_next/static/*`, icons, or images.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
