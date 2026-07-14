#!/bin/sh
set -eu

log() {
  level="$1"
  event="$2"
  message="$3"
  printf '{"time":"%s","level":"%s","event":"%s","message":"%s"}\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$level" "$event" "$message"
}

fatal() {
  log "error" "startup.fatal" "$1"
  exit 1
}

strip_quotes() {
  value="$1"
  case "$value" in
    \"*\")
      value="${value#\"}"
      value="${value%\"}"
      ;;
    \'*\')
      value="${value#\'}"
      value="${value%\'}"
      ;;
  esac
  printf "%s" "$value"
}

retry() {
  label="$1"
  attempts="$2"
  delay="$3"
  shift 3

  count=1
  while [ "$count" -le "$attempts" ]; do
    if "$@"; then
      log "info" "startup.step" "$label succeeded"
      return 0
    fi

    if [ "$count" -eq "$attempts" ]; then
      fatal "$label failed after $attempts attempts"
    fi

    log "warn" "startup.retry" "$label failed on attempt $count; retrying in ${delay}s"
    sleep "$delay"
    count=$((count + 1))
  done
}

validate_sqlite_file() {
  path="$1"
  label="$2"

  [ -f "$path" ] || fatal "$label is not a regular file: $path"
  [ -r "$path" ] || fatal "$label is not readable: $path"
  [ -w "$path" ] || fatal "$label is not writable: $path"
  node scripts/validate-sqlite-database.mjs "$path" || fatal "$label failed SQLite integrity validation: $path. Restore a verified backup before retrying."
}

log "info" "startup.begin" "Preparing SeddleUp container"
log "info" "startup.env" "NODE_ENV=${NODE_ENV:-production}"

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="file:/app/data/seddleup.db"
else
  DATABASE_URL="$(strip_quotes "$DATABASE_URL")"
  export DATABASE_URL
fi

if [ -n "${NEXTAUTH_URL:-}" ]; then
  NEXTAUTH_URL="$(strip_quotes "$NEXTAUTH_URL")"
  export NEXTAUTH_URL
fi

if [ -n "${NEXTAUTH_SECRET:-}" ]; then
  NEXTAUTH_SECRET="$(strip_quotes "$NEXTAUTH_SECRET")"
  export NEXTAUTH_SECRET
fi

if [ -n "${TOKEN_DIGEST_SECRET:-}" ]; then
  TOKEN_DIGEST_SECRET="$(strip_quotes "$TOKEN_DIGEST_SECRET")"
  export TOKEN_DIGEST_SECRET
fi

case "$DATABASE_URL" in
  file:*)
    DB_PATH="${DATABASE_URL#file:}"
    case "$DB_PATH" in
      /*)
        ;;
      *)
        if [ "${SEDDLEUP_DOCKER:-${TRIPTALLY_DOCKER:-}}" = "1" ]; then
          DB_PATH="${SEDDLEUP_SQLITE_PATH:-${TRIPTALLY_SQLITE_PATH:-/app/data/seddleup.db}}"
          export DATABASE_URL="file:${DB_PATH}"
          log "warn" "startup.sqlite" "Rewriting relative SQLite DATABASE_URL to ${DATABASE_URL} for Docker persistence"
        else
          fatal "SQLite DATABASE_URL must use an absolute path in production containers. Use file:/app/data/seddleup.db."
        fi
        ;;
    esac
    DB_DIR="$(dirname "$DB_PATH")"
    mkdir -p "$DB_DIR" 2>/dev/null || fatal "SQLite directory cannot be created: $DB_DIR"
    touch "$DB_DIR/.write-test" 2>/dev/null || fatal "SQLite directory is not writable: $DB_DIR"
    rm -f "$DB_DIR/.write-test"
    if [ "$DB_PATH" = "/app/data/seddleup.db" ] && [ ! -e "$DB_PATH" ] && [ -e "/app/data/triptally.db" ]; then
      validate_sqlite_file "/app/data/triptally.db" "Legacy SQLite database"
      mv /app/data/triptally.db "$DB_PATH" || fatal "Legacy SQLite database could not be moved to $DB_PATH"
      log "info" "startup.sqlite" "Migrated legacy SQLite database path from /app/data/triptally.db to $DB_PATH"
    fi
    if [ -e "$DB_PATH" ]; then
      validate_sqlite_file "$DB_PATH" "SQLite database"
    fi
    log "info" "startup.sqlite" "Using SQLite database at $DB_PATH"
    ;;
esac

if [ -z "${NEXTAUTH_URL:-}" ]; then
  export NEXTAUTH_URL="http://localhost:${PORT:-3000}"
  log "warn" "startup.auth" "NEXTAUTH_URL was not set; defaulting to ${NEXTAUTH_URL}"
fi

case "${NEXTAUTH_SECRET:-}" in
  ""|"replace-with-a-long-random-secret"|"generate-a-long-random-secret-before-running-docker"|"paste-generated-secret-here")
    if [ "${SEDDLEUP_ALLOW_INSECURE_SECRET:-${TRIPTALLY_ALLOW_INSECURE_SECRET:-}}" != "1" ]; then
      fatal "NEXTAUTH_SECRET must be set to a real random value. Generate one with: openssl rand -base64 32"
    fi
    log "warn" "startup.auth" "Using insecure NEXTAUTH_SECRET because insecure secret override is enabled"
    ;;
esac

case "${TOKEN_DIGEST_SECRET:-}" in
  ""|"replace-with-a-long-random-secret"|"generate-a-long-random-secret-before-running-docker"|"paste-generated-secret-here")
    if [ "${SEDDLEUP_ALLOW_INSECURE_SECRET:-${TRIPTALLY_ALLOW_INSECURE_SECRET:-}}" != "1" ]; then
      fatal "TOKEN_DIGEST_SECRET must be set to a real random value. Generate one with: openssl rand -base64 32"
    fi
    log "warn" "startup.auth" "Using insecure TOKEN_DIGEST_SECRET because insecure secret override is enabled"
    ;;
esac

retry "Prisma Client generation" 2 2 node_modules/.bin/prisma generate
retry "Config validation" 2 2 node scripts/validate-config.mjs
retry "Prisma migrations" 5 3 node_modules/.bin/prisma migrate deploy

log "info" "startup.ready" "Starting SeddleUp"
exec "$@"
