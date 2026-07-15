#!/usr/bin/env bash
set -Eeuo pipefail

IMAGE="${1:-seddleup:ci}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_ID="${SEDDLEUP_PROFILE_PROBE_RUN_ID:-$(date -u +%Y%m%d%H%M%S)-$$}"
LABEL="seddleup.profile-probe=${RUN_ID}"
TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/seddleup-profile-probe.XXXXXX")"

log() {
  printf '[docker-profile-probe] %s\n' "$*"
}

fail() {
  printf '[docker-profile-probe] ERROR: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  local resource

  for resource in $(docker ps -aq --filter "label=${LABEL}"); do
    docker rm -f "$resource" >/dev/null 2>&1 || true
  done
  rm -rf "$TEMP_ROOT"
}

trap cleanup EXIT INT TERM

docker image inspect "$IMAGE" >/dev/null 2>&1 || fail "Docker image not found: $IMAGE"

log "Validating Discord, nginx, and Cloudflare Compose profiles"
cp "$ROOT_DIR/docker-compose.yml" "$TEMP_ROOT/docker-compose.yml"
cp "$ROOT_DIR/.env.docker.example" "$TEMP_ROOT/.env"

for profile in discord nginx cloudflare; do
  docker compose \
    --project-name "seddleup-profile-probe-${RUN_ID}" \
    --env-file "$TEMP_ROOT/.env" \
    -f "$TEMP_ROOT/docker-compose.yml" \
    --profile "$profile" \
    config --quiet
done

log "Verifying Discord registration is callable without npm or live credentials"
docker run --rm \
  --label "$LABEL" \
  --network none \
  --entrypoint sh \
  "$IMAGE" \
  -eu -c '! command -v npm >/dev/null 2>&1; test -f scripts/register-discord-commands.mjs'

discord_log="$TEMP_ROOT/discord.log"
if docker run --rm \
  --label "$LABEL" \
  --network none \
  --entrypoint node \
  "$IMAGE" \
  scripts/register-discord-commands.mjs >"$discord_log" 2>&1; then
  fail "Discord registration unexpectedly succeeded without credentials"
fi
grep -F "DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID are required" "$discord_log" >/dev/null ||
  fail "Discord registration did not report the expected missing-credential error"

log "Rendering and validating the nginx configuration with an isolated certificate"
domain="probe.example.invalid"
mkdir -p "$TEMP_ROOT/certs/live/$domain" "$TEMP_ROOT/nginx-conf"
docker run --rm \
  --label "$LABEL" \
  --network none \
  --user 0 \
  --entrypoint sh \
  --volume "$TEMP_ROOT/certs:/certs" \
  "$IMAGE" \
  -eu -c 'openssl req -x509 -nodes -newkey rsa:2048 -days 1 -keyout "/certs/live/$1/privkey.pem" -out "/certs/live/$1/fullchain.pem" -subj "/CN=$1" >/dev/null 2>&1' sh "$domain"

docker run --rm \
  --label "$LABEL" \
  --network none \
  --add-host seddleup:127.0.0.1 \
  --entrypoint sh \
  --env "DOMAIN=$domain" \
  --volume "$ROOT_DIR/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
  --volume "$ROOT_DIR/nginx/conf.d/seddleup.conf:/tmp/seddleup.conf.template:ro" \
  --volume "$TEMP_ROOT/nginx-conf:/etc/nginx/conf.d" \
  --volume "$TEMP_ROOT/certs:/etc/letsencrypt:ro" \
  nginx:alpine \
  -eu -c 'envsubst '\''${DOMAIN}'\'' < /tmp/seddleup.conf.template > /etc/nginx/conf.d/seddleup.conf; nginx -t'

log "Validating the Cloudflare ingress example without credentials or network access"
docker run --rm \
  --label "$LABEL" \
  --network none \
  --volume "$ROOT_DIR/cloudflare/config.yml.example:/etc/cloudflared/config.yml:ro" \
  cloudflare/cloudflared:latest \
  tunnel --config /etc/cloudflared/config.yml ingress validate

log "All Docker profile probes passed for $IMAGE"
