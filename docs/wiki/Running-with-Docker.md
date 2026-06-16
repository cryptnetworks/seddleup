# Running with Docker

SeddleUp is intended to run as a Docker container in production. The container starts as a non-root user, validates configuration, generates Prisma Client, applies Prisma migrations, and starts the Next.js production server.

## Pull the Image

```bash
docker pull ghcr.io/cryptnetworks/seddleup:latest
```

## Prepare Environment

```bash
cp .env.docker.example .env
openssl rand -base64 32
openssl rand -base64 32
openssl rand -base64 32
```

Use separate generated values for `NEXTAUTH_SECRET`, `TOKEN_DIGEST_SECRET`, and `AUTH_CONFIG_ENCRYPTION_KEY`.

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
```

## Run a Single Container

```bash
docker volume create seddleup_data

docker run --name seddleup \
  -p 3000:3000 \
  -v seddleup_data:/app/data \
  --env-file .env \
  ghcr.io/cryptnetworks/seddleup:latest
```

Open `http://localhost:3000`.

## Healthcheck

```bash
curl http://localhost:3000/api/health
```

The Docker image also defines a healthcheck that calls `/api/health` every 30 seconds.

## Run with Docker Compose

The included Compose file builds the local Dockerfile by default and runs SeddleUp privately on the Docker network:

```bash
docker compose up -d --build seddleup
```

Compose mounts the `seddleup_data` volume at `/app/data`.

Existing deployments that used the old `triptally_data` volume should back up
the old volume before switching names. On startup, SeddleUp migrates
`/app/data/triptally.db` to `/app/data/seddleup.db` when the old file exists in
the mounted volume and the new file is absent.

To use the GHCR image instead of building locally, override the service image:

```yaml
services:
  seddleup:
    image: ghcr.io/cryptnetworks/seddleup:latest
    build: null
```

## Data Persistence

SQLite lives at:

```text
/app/data/seddleup.db
```

Always mount `/app/data` to a persistent Docker volume.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
