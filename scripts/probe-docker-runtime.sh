#!/usr/bin/env bash
set -Eeuo pipefail

IMAGE="${1:-seddleup:ci}"
RUN_ID="${SEDDLEUP_PROBE_RUN_ID:-$(date -u +%Y%m%d%H%M%S)-$$}"
LABEL="seddleup.runtime-probe=${RUN_ID}"
WAIT_SECONDS="${SEDDLEUP_PROBE_WAIT_SECONDS:-90}"

log() {
  printf '[docker-runtime-probe] %s\n' "$*"
}

fail() {
  printf '[docker-runtime-probe] ERROR: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  local resource

  for resource in $(docker ps -aq --filter "label=${LABEL}"); do
    docker rm -f "$resource" >/dev/null 2>&1 || true
  done
  for resource in $(docker volume ls -q --filter "label=${LABEL}"); do
    docker volume rm -f "$resource" >/dev/null 2>&1 || true
  done
}

trap cleanup EXIT INT TERM

docker image inspect "$IMAGE" >/dev/null 2>&1 || fail "Docker image not found: $IMAGE"

new_volume() {
  local suffix="$1"
  docker volume create --label "$LABEL" "seddleup-probe-${RUN_ID}-${suffix}"
}

container_name() {
  printf 'seddleup-probe-%s-%s' "$RUN_ID" "$1"
}

start_container() {
  local name="$1"
  local volume="$2"
  local database_url="${3:-file:/app/data/seddleup.db}"

  docker run --detach \
    --name "$name" \
    --label "$LABEL" \
    --volume "$volume:/app/data" \
    --env "DATABASE_URL=$database_url" \
    --env NEXTAUTH_URL=http://localhost:3000 \
    --env NEXTAUTH_SECRET=docker-probe-nextauth-secret-not-for-production \
    --env TOKEN_DIGEST_SECRET=docker-probe-token-digest-secret-not-for-production \
    --env AUTH_CONFIG_ENCRYPTION_KEY=docker-probe-encryption-key-not-for-production \
    --env SMTP_ENABLED=false \
    "$IMAGE" >/dev/null
}

wait_for_healthy() {
  local name="$1"
  local elapsed=0
  local status

  while [ "$elapsed" -lt "$WAIT_SECONDS" ]; do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$name" 2>/dev/null || true)"
    case "$status" in
      healthy)
        return 0
        ;;
      unhealthy)
        docker logs "$name" >&2 || true
        fail "$name became unhealthy"
        ;;
    esac

    if [ "$(docker inspect --format '{{.State.Running}}' "$name" 2>/dev/null || true)" = "false" ]; then
      docker logs "$name" >&2 || true
      fail "$name exited before becoming healthy"
    fi

    sleep 1
    elapsed=$((elapsed + 1))
  done

  docker logs "$name" >&2 || true
  fail "$name did not become healthy within ${WAIT_SECONDS}s"
}

stop_and_remove() {
  local name="$1"
  docker rm -f "$name" >/dev/null
}

assert_startup_success() {
  local name="$1"
  local uid

  uid="$(docker exec "$name" id -u)"
  [ "$uid" != "0" ] || fail "$name is running as root"
  docker exec "$name" test -s /app/data/seddleup.db
  docker exec "$name" node_modules/.bin/prisma migrate status >/dev/null
  docker exec "$name" wget -qO- http://127.0.0.1:3000/api/health >/dev/null
  docker logs "$name" 2>&1 | grep -F '"message":"Prisma migrations succeeded"' >/dev/null || fail "$name did not log successful migrations"
  docker logs "$name" 2>&1 | grep -F '"event":"startup.ready"' >/dev/null || fail "$name did not reach startup.ready"
}

write_sentinel() {
  local name="$1"
  local database_path="$2"

  docker exec "$name" node -e '
    const { DatabaseSync } = require("node:sqlite");
    const database = new DatabaseSync(process.argv[1]);
    database.prepare("INSERT INTO app_settings (key, value, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP").run("docker-runtime-probe", "preserved");
    database.close();
  ' "$database_path" >/dev/null
}

assert_sentinel() {
  local name="$1"
  local database_path="$2"

  docker exec "$name" node -e '
    const { DatabaseSync } = require("node:sqlite");
    const database = new DatabaseSync(process.argv[1], { readOnly: true });
    const row = database.prepare("SELECT value FROM app_settings WHERE key = ?").get("docker-runtime-probe");
    database.close();
    if (row?.value !== "preserved") process.exit(1);
  ' "$database_path" >/dev/null || fail "Sentinel data was not preserved in $name"
}

assert_volume_sentinel() {
  local volume="$1"

  docker run --rm --entrypoint node --volume "$volume:/app/data" "$IMAGE" -e '
    const { DatabaseSync } = require("node:sqlite");
    const database = new DatabaseSync("/app/data/seddleup.db", { readOnly: true });
    const row = database.prepare("SELECT value FROM app_settings WHERE key = ?").get("docker-runtime-probe");
    database.close();
    if (row?.value !== "preserved") process.exit(1);
  ' >/dev/null || fail "Sentinel data was not preserved in volume $volume"
}

prepare_invalid_database() {
  local volume="$1"
  local database_path="${2:-/app/data/seddleup.db}"

  docker run --rm --user 0 --entrypoint sh --volume "$volume:/app/data" "$IMAGE" \
    -c 'printf "invalid-sqlite-probe" > "$1" && chown nextjs:nodejs "$1"' sh "$database_path"
}

prepare_inaccessible_database() {
  local volume="$1"

  docker run --rm --user 0 --entrypoint sh --volume "$volume:/app/data" "$IMAGE" \
    -c 'touch /app/data/seddleup.db && chown 0:0 /app/data/seddleup.db && chmod 0400 /app/data/seddleup.db'
}

wait_for_failure() {
  local name="$1"
  local expected="$2"
  local elapsed=0
  local running
  local exit_code
  local logs

  while [ "$elapsed" -lt "$WAIT_SECONDS" ]; do
    running="$(docker inspect --format '{{.State.Running}}' "$name" 2>/dev/null || true)"
    if [ "$running" = "false" ]; then
      exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$name")"
      logs="$(docker logs "$name" 2>&1)"
      [ "$exit_code" != "0" ] || fail "$name unexpectedly exited successfully"
      grep -F "$expected" <<<"$logs" >/dev/null || {
        printf '%s\n' "$logs" >&2
        fail "$name did not report expected failure: $expected"
      }
      if grep -F '"event":"startup.ready"' <<<"$logs" >/dev/null; then
        fail "$name reported startup.ready after a fatal database error"
      fi
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  docker logs "$name" >&2 || true
  fail "$name did not fail within ${WAIT_SECONDS}s"
}

log "Fresh database, migrations, health, restart, and preservation"
fresh_volume="$(new_volume fresh)"
fresh_name="$(container_name fresh)"
start_container "$fresh_name" "$fresh_volume"
wait_for_healthy "$fresh_name"
assert_startup_success "$fresh_name"
write_sentinel "$fresh_name" /app/data/seddleup.db
stop_and_remove "$fresh_name"

restart_name="$(container_name restart)"
start_container "$restart_name" "$fresh_volume"
wait_for_healthy "$restart_name"
assert_startup_success "$restart_name"
assert_sentinel "$restart_name" /app/data/seddleup.db
stop_and_remove "$restart_name"

log "Legacy triptally.db adoption and data preservation"
legacy_volume="$(new_volume legacy)"
legacy_seed_name="$(container_name legacy-seed)"
start_container "$legacy_seed_name" "$legacy_volume" file:/app/data/triptally.db
wait_for_healthy "$legacy_seed_name"
write_sentinel "$legacy_seed_name" /app/data/triptally.db
stop_and_remove "$legacy_seed_name"

legacy_name="$(container_name legacy)"
start_container "$legacy_name" "$legacy_volume"
wait_for_healthy "$legacy_name"
assert_startup_success "$legacy_name"
assert_sentinel "$legacy_name" /app/data/seddleup.db
docker exec "$legacy_name" test ! -e /app/data/triptally.db || fail "Legacy database path still exists after migration"
docker logs "$legacy_name" 2>&1 | grep -F 'Migrated legacy SQLite database path' >/dev/null || fail "Legacy migration was not logged"
stop_and_remove "$legacy_name"

log "Invalid database fails explicitly without startup"
invalid_volume="$(new_volume invalid)"
prepare_invalid_database "$invalid_volume"
invalid_name="$(container_name invalid)"
start_container "$invalid_name" "$invalid_volume"
wait_for_failure "$invalid_name" "failed SQLite integrity validation"
stop_and_remove "$invalid_name"

log "Invalid legacy database fails before path migration"
invalid_legacy_volume="$(new_volume invalid-legacy)"
prepare_invalid_database "$invalid_legacy_volume" /app/data/triptally.db
invalid_legacy_name="$(container_name invalid-legacy)"
start_container "$invalid_legacy_name" "$invalid_legacy_volume"
wait_for_failure "$invalid_legacy_name" "Legacy SQLite database failed SQLite integrity validation"
docker run --rm --entrypoint sh --volume "$invalid_legacy_volume:/app/data" "$IMAGE" \
  -c 'test -e /app/data/triptally.db && test ! -e /app/data/seddleup.db' || fail "Invalid legacy database was moved or replaced"
stop_and_remove "$invalid_legacy_name"

log "Inaccessible database fails explicitly without startup"
inaccessible_volume="$(new_volume inaccessible)"
prepare_inaccessible_database "$inaccessible_volume"
inaccessible_name="$(container_name inaccessible)"
start_container "$inaccessible_name" "$inaccessible_volume"
wait_for_failure "$inaccessible_name" "SQLite database is not readable"
stop_and_remove "$inaccessible_name"

log "Failed migration remains fatal and does not erase data"
migration_volume="$(new_volume migration-failure)"
migration_seed_name="$(container_name migration-seed)"
start_container "$migration_seed_name" "$migration_volume"
wait_for_healthy "$migration_seed_name"
write_sentinel "$migration_seed_name" /app/data/seddleup.db
docker exec "$migration_seed_name" node -e '
  const { DatabaseSync } = require("node:sqlite");
  const database = new DatabaseSync("/app/data/seddleup.db");
  database.prepare("INSERT INTO _prisma_migrations (id, checksum, migration_name, logs, started_at, applied_steps_count) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 0)").run("docker-runtime-probe-failed", "probe", "docker_runtime_probe_failed", "intentional probe failure");
  database.close();
' >/dev/null
stop_and_remove "$migration_seed_name"

migration_name="$(container_name migration-failure)"
start_container "$migration_name" "$migration_volume"
wait_for_failure "$migration_name" "Prisma migrations failed after 5 attempts"
assert_volume_sentinel "$migration_volume"
stop_and_remove "$migration_name"

log "All Docker runtime probes passed for $IMAGE"
