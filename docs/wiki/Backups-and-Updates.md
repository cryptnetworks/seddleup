# Backups and Updates

SeddleUp stores its production ledger in SQLite and private receipt files under
the configured receipt upload directory. Back up both before every image update
or migration, keep the backup outside the application volume, and rehearse these
restore steps before relying on them in production.

## Before You Begin

- These commands assume the container is named `seddleup`, the named volume is
  `seddleup_data`, and backups are written to `./backups` on the Docker host.
- Set `SEDDLEUP_IMAGE` to the exact image tag or digest used by the deployment.
  Avoid `latest` during a restore so the validation runtime cannot change midway.
- Stop the application before copying SQLite files. Copying a database while it
  is being written can produce an inconsistent backup.
- Keep the current database as a rollback copy until the restored application has
  passed its checks. The restore commands below intentionally overwrite
  `/app/data/seddleup.db`; review every path before running them.

```bash
export SEDDLEUP_IMAGE=ghcr.io/cryptnetworks/seddleup:latest
mkdir -p backups
```

For a production runbook, replace `latest` with the deployed version tag or image
digest and record that value beside the backup.

## Back Up a Docker Volume

Stop the application, copy the database to the host, and restart it promptly:

```bash
docker stop seddleup
export BACKUP_FILE="seddleup-$(date -u +%Y%m%dT%H%M%SZ).db"
docker run --rm \
  -v seddleup_data:/data:ro \
  -v "$PWD/backups:/backup" \
  -e BACKUP_FILE \
  alpine:3.23 \
  sh -eu -c 'test -s /data/seddleup.db; cp /data/seddleup.db "/backup/$BACKUP_FILE"; test -s "/backup/$BACKUP_FILE"'
sha256sum "backups/$BACKUP_FILE"
docker start seddleup
```

Record the checksum, SeddleUp image tag or digest, and backup timestamp together.
Store another copy outside the Docker host according to the deployment's
retention policy.

If receipt uploads are enabled, also archive `/app/data/receipts` while the
application is stopped. Restore the database and receipt directory from the same
backup point so rows do not reference missing files and removed receipts are not
unexpectedly reintroduced. Treat original receipt filenames and contents as
private data; encrypt and retain receipt backups under the same policy as the
database.

## Validate a Backup Before Restore

The production image already contains the same SQLite library used by SeddleUp.
Use it to open the backup read-only and run SQLite's integrity check without
installing extra host tools:

```bash
test -n "${BACKUP_FILE:-}"
test -s "backups/$BACKUP_FILE"
docker run --rm \
  --entrypoint node \
  -v "$PWD/backups:/backup:ro" \
  "$SEDDLEUP_IMAGE" \
  -e 'const Database = require("better-sqlite3"); const db = new Database(process.argv[1], { readonly: true, fileMustExist: true }); const result = db.pragma("integrity_check", { simple: true }); db.close(); if (result !== "ok") { throw new Error(`SQLite integrity check failed: ${result}`); } console.log("SQLite integrity check: ok");' \
  "/backup/$BACKUP_FILE"
```

Do not continue if the file is empty, the checksum differs from the recorded
value, or the integrity check fails.

## Restore a Docker Volume

Choose the backup explicitly, validate it, stop the application, and preserve the
current database as a timestamped rollback copy inside the volume:

```bash
export BACKUP_FILE=seddleup-YYYYMMDDTHHMMSSZ.db
test -s "backups/$BACKUP_FILE"
# Run the validation command from the previous section before continuing.

docker stop seddleup
export ROLLBACK_FILE="seddleup-before-restore-$(date -u +%Y%m%dT%H%M%SZ).db"
docker run --rm \
  -v seddleup_data:/data \
  -v "$PWD/backups:/backup:ro" \
  -e BACKUP_FILE \
  -e ROLLBACK_FILE \
  alpine:3.23 \
  sh -eu -c 'test -s "/backup/$BACKUP_FILE"; if test -e /data/seddleup.db; then cp /data/seddleup.db "/data/$ROLLBACK_FILE"; fi; cp "/backup/$BACKUP_FILE" /data/seddleup.db; test -s /data/seddleup.db'
docker start seddleup
```

Startup applies pending Prisma migrations automatically. Verify the migration
step, wait for readiness, and then exercise a read-only application path before
allowing writes:

```bash
docker logs seddleup --since 5m
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error http://localhost:3000/api/health; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo "SeddleUp did not become healthy after restore" >&2
    exit 1
  fi
  sleep 2
done
```

Confirm that the logs show successful configuration validation and Prisma
migrations without printing secrets. Sign in, open an existing trip, and verify
expected participants and expenses before resuming normal operation.

## Roll Back a Failed Restore

If startup, migration, health, or data checks fail, stop the application and put
the preserved database back. Use the exact rollback filename created during the
restore:

```bash
export ROLLBACK_FILE=seddleup-before-restore-YYYYMMDDTHHMMSSZ.db
docker stop seddleup
docker run --rm \
  -v seddleup_data:/data \
  -e ROLLBACK_FILE \
  alpine:3.23 \
  sh -eu -c 'test -s "/data/$ROLLBACK_FILE"; mv /data/seddleup.db /data/seddleup-failed-restore.db; cp "/data/$ROLLBACK_FILE" /data/seddleup.db'
docker start seddleup
```

Keep the failed restored database for investigation. Do not delete either copy
until the rollback has passed the same log, health, sign-in, and trip checks.

## Local Non-Docker Backup and Restore

Stop the local SeddleUp process first. Resolve the path from the `file:`
`DATABASE_URL`; the repository's default development path is `./dev.db`.

```bash
export DB_PATH=./dev.db
export BACKUP_FILE="seddleup-local-$(date -u +%Y%m%dT%H%M%SZ).db"
test -s "$DB_PATH"
mkdir -p backups
cp "$DB_PATH" "backups/$BACKUP_FILE"
sha256sum "backups/$BACKUP_FILE"
```

To restore locally, validate the selected backup with a local SQLite integrity
check or the Docker validation command above, preserve the current database, and
then copy the backup into place:

```bash
export BACKUP_FILE=seddleup-local-YYYYMMDDTHHMMSSZ.db
test -s "backups/$BACKUP_FILE"
cp "$DB_PATH" "$DB_PATH.before-restore"
cp "backups/$BACKUP_FILE" "$DB_PATH"
npx prisma migrate deploy
npm run dev
```

Verify `http://localhost:3000/api/health` and inspect existing trip data before
removing `$DB_PATH.before-restore`.

## Legacy TripTally Database Backups

The long-term ownership and removal policy for legacy identifiers is in the
[Compatibility Name Migration Plan](Compatibility-Name-Migration-Plan).

The SQLite file contents are compatible regardless of the backup filename. For
a normal restore, copy an older `triptally.db` backup to the current
`/app/data/seddleup.db` destination using the runbook above.

For an existing volume that contains `/app/data/triptally.db` but no
`/app/data/seddleup.db`, the container entrypoint moves the legacy file to the
current path before migrations run. Back up the volume before relying on this
one-time compatibility behavior. If both files exist, startup leaves the legacy
file untouched and uses `seddleup.db`; it never overwrites the current database
with the legacy file.
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

1. Complete and validate a backup.
2. Record the currently deployed image tag or digest for rollback.
3. Pull the intended new version.
4. Recreate the container with the existing data volume.
5. Verify startup migrations, `/api/health`, sign-in, and an existing trip.

```bash
docker pull ghcr.io/cryptnetworks/seddleup:latest
docker rm -f seddleup
docker run --name seddleup \
  -p 3000:3000 \
  -v seddleup_data:/app/data \
  --env-file .env \
  ghcr.io/cryptnetworks/seddleup:latest
```

If validation fails, recreate the container with the recorded previous image and
follow the rollback procedure if the database must also be restored.

## Update a Compose Deployment

Back up existing data before switching from the old `triptally_data` volume name
to `seddleup_data`. Confirm which named volume Compose actually mounts before
restoring into it. The startup entrypoint migrates `/app/data/triptally.db` to
`/app/data/seddleup.db` only when that old file is present, valid, and writable
in the mounted volume and the current file is absent. If both files exist, the
current `seddleup.db` remains authoritative and the legacy file is not moved.

```bash
docker compose config
docker compose pull
docker compose up -d
docker compose logs --since 5m seddleup
curl --fail --silent --show-error http://localhost:3000/api/health
```

If the Compose deployment builds locally, use `docker compose up -d --build`
after the backup instead.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
