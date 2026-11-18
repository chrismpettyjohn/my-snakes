#!/bin/sh
set -eu

API_URL="${1:-${API_URL:-}}"
TOKEN="${2:-${BRIDGE_TOKEN:-}}"

fail() { echo "$*" >&2; exit 1; }
[ -n "$API_URL" ] && [ -n "$TOKEN" ] || fail "Usage: install.sh <api-url> <bridge-token>  (copy the full command from Settings → Bridge)"
API_URL="${API_URL%/}"
command -v docker >/dev/null 2>&1 || fail "Docker is required: https://docs.docker.com/get-docker/"
docker info >/dev/null 2>&1 || fail "Docker isn't running (or needs sudo). Start it and run this again."

NET=""
SUBNETS="${SCAN_SUBNETS:-}"
case "$(uname -s)" in
  Linux) NET="--network host" ;;
  Darwin)
    if [ -z "$SUBNETS" ]; then
      IF=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
      IP=$(ipconfig getifaddr "$IF" 2>/dev/null || true)
      MASK=$(ipconfig getoption "$IF" subnet_mask 2>/dev/null || true)
      [ -n "$IP" ] && SUBNETS="$IP/${MASK:-24}"
    fi
    ;;
esac

ALIAS=""
case "$API_URL" in
  http://localhost[:/]* | http://localhost | http://127.0.0.1*) [ -z "$NET" ] && ALIAS=host.docker.internal ;;
esac

LOCAL=""
case "$0" in
  *install.sh) LOCAL="$(cd "$(dirname "$0")/.." && pwd)" && [ -f "$LOCAL/src/agent.ts" ] || LOCAL="" ;;
esac
NAME=snake-bridge${LOCAL:+-local}

echo "Building $NAME image${LOCAL:+ from $LOCAL}…"
if [ -n "$LOCAL" ]; then
  printf 'FROM oven/bun:1-alpine\nCOPY src/agent.ts /app/agent.ts\nCMD ["bun", "/app/agent.ts"]\n' |
    docker build --pull -q -t "$NAME" -f - "$LOCAL" >/dev/null
else
  printf 'FROM oven/bun:1-alpine\nADD --chmod=644 %s/bridge/agent.ts /app/agent.ts\nCMD ["bun", "/app/agent.ts"]\n' "$API_URL" |
    docker build --pull --no-cache -q -t "$NAME" - >/dev/null
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true
# shellcheck disable=SC2086
docker run -d --name "$NAME" --restart unless-stopped $NET \
  -e API_URL="$API_URL" \
  -e BRIDGE_TOKEN="$TOKEN" \
  -e SCAN_SUBNETS="$SUBNETS" \
  -e HERPSTAT_HOSTS="${HERPSTAT_HOSTS:-}" \
  -e BRIDGE_HOSTNAME="$(hostname)" \
  -e LOCALHOST_ALIAS="$ALIAS" \
  "$NAME" >/dev/null

echo "Snake bridge is running${SUBNETS:+ and scanning $SUBNETS}."
echo "  Logs:      docker logs -f $NAME"
echo "  Uninstall: docker rm -f $NAME"
case "$(uname -s)" in
  Darwin) echo "It restarts with Docker. Turn on Docker Desktop → Settings → General → Start Docker Desktop when you sign in." ;;
  Linux) command -v systemctl >/dev/null 2>&1 && ! systemctl is-enabled docker >/dev/null 2>&1 && echo "Run 'sudo systemctl enable docker' so the bridge starts on boot." || true ;;
esac
