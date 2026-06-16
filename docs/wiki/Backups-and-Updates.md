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

## Update a Single Docker Container

```bash
docker pull ghcr.io/cryptnetworks/seddleup:sha-292a632@sha256:9a2387e29e29bf862a056619192a3cf3256b74a5d4fc67e97467321c43957207
docker rm -f seddleup
docker run --name seddleup \
  -p 3000:3000 \
  -v seddleup_data:/app/data \
  --env-file .env \
  ghcr.io/cryptnetworks/seddleup:sha-292a632@sha256:9a2387e29e29bf862a056619192a3cf3256b74a5d4fc67e97467321c43957207
```

The startup entrypoint applies database migrations automatically.

## Update Compose Deployment

Back up existing data before switching from the old `triptally_data` volume name
to `seddleup_data`. The startup entrypoint migrates `/app/data/triptally.db` to
`/app/data/seddleup.db` only when that old file is present in the mounted volume.

```bash
docker compose pull
docker compose up -d --build
```

If your Compose deployment builds locally, `--build` rebuilds the app image from the checked-out source.

---

[Wiki Home](Home) | [Running with Docker](Running-with-Docker) | [Configuration](Configuration) | [Troubleshooting](Troubleshooting)
