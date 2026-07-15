# Running with Docker

SeddleUp is intended to run as a Docker container in production. The container starts as a non-root user, validates configuration, generates Prisma Client, applies Prisma migrations, and starts the Next.js production server.

## Pull the Image

```bash
docker pull ghcr.io/cryptnetworks/seddleup:latest
```

The `latest` image is published for `linux/amd64` and `linux/arm64/v8` (aarch64).

The Compose deployment uses that image by default. Set `SEDDLEUP_IMAGE` in the
shell or Compose interpolation environment to deploy an exact tag, digest, or
alternate registry without editing `docker-compose.yml`. The application and
one-shot Discord command service always use the same configured image.

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

SeddleUp currently supports SQLite only. `DATABASE_URL` must use a `file:` URL.
Postgres URLs are rejected until a future schema and migration plan explicitly
adds Postgres support.

Local browser tests intentionally do not use this container path. Their
disposable paths and production-server test mode are documented in
[Testing and Production Readiness](Testing-and-Production-Readiness).

For a separate deployment environment file, export both Compose variables
before starting the profiles that need them:

```bash
export SEDDLEUP_IMAGE=ghcr.io/cryptnetworks/seddleup:2.0.0
export SEDDLEUP_ENV_FILE=.env.docker
docker compose up -d
```

Alternatively, place both variables in `.env.docker` and run
`docker compose --env-file .env.docker up -d`. A service-level `env_file` does
not provide values for Compose interpolation, so merely setting
`SEDDLEUP_ENV_FILE` inside that file is not sufficient unless the file is also
passed with `--env-file`.

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

After creating the first account and trip, a healthy install should render the
application shell, dashboard cards, trip summaries, and settlement queue like
this:

![SeddleUp dashboard after a successful install](https://raw.githubusercontent.com/cryptnetworks/seddleup/main/docs/assets/screenshots/seddleup-dashboard.png)

If the page loads without styling, logos, or navigation, check the public URL
values in [Configuration](Configuration) and confirm the reverse proxy is
forwarding static asset requests.

## Liveness And Readiness

```bash
curl http://localhost:3000/api/health/live
curl http://localhost:3000/api/health
```

`/api/health/live` is a dependency-free liveness check. A successful response
only proves that the Next.js process can answer HTTP requests.

`/api/health` is the readiness check. It returns HTTP 200 only when runtime
configuration is valid, SQLite accepts a query, the bundled Prisma migration
manifest is available, every bundled migration is applied, and no unfinished
Prisma migration is recorded. The response identifies checks only as `ready`,
`unavailable`, or `not_checked`; it never returns configuration values, secrets,
private URLs, database contents, migration names, or filesystem paths.

The Docker image and Compose configuration continue to call `/api/health` every
30 seconds, so a container is healthy only when it is ready to serve application
traffic. Reverse proxies and orchestrators may use `/api/health/live` solely to
decide whether the HTTP process needs restarting.

## Run with Docker Compose

The included Compose file pulls the GHCR image and runs SeddleUp privately on the Docker network:

```bash
docker compose pull seddleup
docker compose up -d seddleup
```

Compose mounts the `seddleup_data` volume at `/app/data`.

Existing deployments that used the old `triptally_data` volume should back up
the old volume before switching names. On startup, SeddleUp migrates
`/app/data/triptally.db` to `/app/data/seddleup.db` when the old file exists in
the mounted volume and the new file is absent. The legacy file must be a
readable, writable, valid SQLite database. Validation runs before the file is
moved, so a corrupt legacy file remains at its original path and startup fails
with recovery guidance.

To build locally instead of using GHCR, add a local override:

```yaml
services:
  seddleup:
    build:
      context: .
    image: seddleup:latest
```

## Data Persistence

SQLite lives at:

```text
/app/data/seddleup.db
```

Always mount `/app/data` to a persistent Docker volume.

Receipt uploads use `RECEIPT_UPLOAD_DIR`, which defaults to
`/app/data/receipts` in the production image. Keeping that directory inside the
same persistent volume makes database rows and private receipt files available
after a container recreate. Receipt files are not public assets and must not be
mounted into a web server's static directory.

Failed uploads remove the directory created for that upload. Deleting an
individual receipt or its parent trip removes the matching receipt directory
after the database change commits. Deleting an expense keeps its attached
receipt as a trip record and detaches it from the expense. Account deletion
removes receipt rows owned by that uploader and then performs the same scoped
filesystem cleanup. Cleanup never recursively removes a directory until the
receipt ID and stored file both resolve to that exact directory inside the
configured upload root.

SQLite and the filesystem do not share a transaction. If a committed deletion
is followed by a filesystem error, SeddleUp emits the redacted
`receipt.storage.cleanup_failed` operator event with the operation and receipt
ID, but never the stored path or filename. Resolve the storage permission or
mount problem, compare the affected ID with a verified backup, and remove only
the confirmed orphan directory. Do not recursively clear the upload root.

On every startup, the entrypoint checks that the data directory is writable and
validates any existing current or legacy SQLite file before Prisma migrations
run. A missing database on an empty volume is expected and Prisma creates it.
An existing invalid or inaccessible file is never replaced with a new empty
database.

## Run the Automated Runtime Probe

Developers can rehearse the production entrypoint without touching an existing
volume:

```bash
docker build -t seddleup:ci .
npm run test:docker
```

The probe uses disposable labeled volumes for fresh startup, restart and data
preservation, legacy-path migration, invalid and inaccessible files, and a
recorded failed Prisma migration. Success ends with `All Docker runtime probes
passed`. A failure prints the affected temporary container logs, exits nonzero,
and still removes probe resources.

The enabled receipt browser probe uses its own temporary SQLite database and
upload directory. It verifies individual-receipt and parent-trip cleanup and
removes that temporary storage after success or failure:

```bash
npm run test:e2e:receipts
```

## Validate Optional Profiles

Before deploying Discord, nginx, or Cloudflare, validate the Compose, image, and
template paths without real credentials:

```bash
docker build -t seddleup:ci .
npm run test:docker:profiles
```

The probe expects Discord registration to stop on missing fake credentials,
checks nginx with a temporary self-signed certificate, and validates the
Cloudflare ingress example offline. External-service commands run with container
networking disabled, so the probe never contacts Discord, Cloudflare, DNS, or a
certificate authority.

Use the [Production Deployment Checklist](Production-Deployment-Checklist)
before the first public rollout.

## Rate Limiting

The built-in limiter uses process-local memory. It provides basic throttling for
a single SeddleUp container, but it resets on restart and is not shared across
replicas. Multi-replica production deployments should add shared rate limiting
at the reverse proxy, load balancer, edge, or platform layer until app-level
shared store support is added.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
