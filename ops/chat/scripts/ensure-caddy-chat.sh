#!/usr/bin/env bash
# Re-apply chat Caddy handles if park-tls wiped them (park plugin regenerates the file).
set -euo pipefail

PARKED="${PARKED:-/opt/relay/state/park-tls/Caddyfile.parked}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MARKER="# flashback-chat-sidecar"

if [[ ! -f "${PARKED}" ]]; then
  echo "[ensure-caddy-chat] no park file yet" >&2
  exit 0
fi

if ! grep -q 'flashbackrepository.org' "${PARKED}"; then
  echo "[ensure-caddy-chat] flashback not parked here" >&2
  exit 0
fi

# Prefer explicit mode; else infer from local chat-edge listen
if [[ -z "${CHAT_CADDY_MODE:-}" ]]; then
  if curl -fsS --max-time 1 http://127.0.0.1:8098/chat/api/health >/dev/null 2>&1; then
    export CHAT_CADDY_MODE=local
  else
    export CHAT_CADDY_MODE=remote
  fi
fi

if grep -q "${MARKER}" "${PARKED}" && grep -q 'handle /chat/api\*' "${PARKED}"; then
  # Still ensure loaded config has the route (cheap public check via local caddy when possible)
  exit 0
fi

echo "[ensure-caddy-chat] marker missing — re-patching mode=${CHAT_CADDY_MODE}"
exec "${SCRIPT_DIR}/patch-caddy.sh" "${PARKED}"
