# Backups and Updates

## SQLite Backup

```bash
mkdir -p backups
docker run --rm \
  -v seddleup_data:/data \
  -v "$PWD/backups:/backup" \
  alpine sh -c 'cp /data/seddleup.db /backup/seddleup-$(date +%Y%m%d-%H%M%S).db'
```

## SQLite Restore

Stop SeddleUp before restoring:

```bash
docker stop seddleup
docker run --rm \
  -v seddleup_data:/data \
  -v "$PWD/backups:/backup" \
  alpine sh -c 'cp /backup/seddleup.db /data/seddleup.db'
docker start seddleup
```

Startup validates an existing database before applying Prisma migrations. If
validation or migration fails, leave the container stopped, preserve the failed
file for investigation, and restore a verified backup. SeddleUp does not replace
an invalid existing database with a new empty one.

## Rehearse Current and Legacy Paths Safely

The repository includes a disposable Docker rehearsal that never uses
`seddleup_data` or any supplied operator volume:

```bash
docker build -t seddleup:ci .
npm run test:docker
```

It proves data survives a normal restart and the one-time rename from
`triptally.db` to `seddleup.db`. It also verifies that corrupt, inaccessible, and
failed-migration databases stop startup explicitly. This is a regression probe,
not a replacement for creating and testing backups of the real deployment.

## Update a Single Docker Container

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

## Update Compose Deployment

Back up existing data before switching from the old `triptally_data` volume name
to `seddleup_data`. The startup entrypoint migrates `/app/data/triptally.db` to
`/app/data/seddleup.db` only when that old file is present, valid, and writable
in the mounted volume and the current file is absent. If both files exist, the
current `seddleup.db` remains authoritative and the legacy file is not moved.

```bash
docker compose pull
docker compose up -d --build
```

If your Compose deployment builds locally, `--build` rebuilds the app image from the checked-out source.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
