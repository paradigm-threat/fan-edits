#!/usr/bin/env bash
# Re-apply chat Caddy handles if park-tls wiped them (park plugin regenerates the file).
# Retries until the park file is stable and /chat/api/health is reachable via local TLS.
set -euo pipefail

PARKED="${PARKED:-/opt/relay/state/park-tls/Caddyfile.parked}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MARKER="# flashback-chat-sidecar"
LOCK="${LOCK:-/run/flashback-chat-caddy-guard.lock}"
export HOME="${HOME:-/root}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-/root/.config}"

exec 9>"${LOCK}"
if ! flock -n 9; then
  echo "[ensure-caddy-chat] another guard running — skip"
  exit 0
fi

wait_park_ready() {
  local i size prev=""
  for i in $(seq 1 20); do
    if [[ -f "${PARKED}" ]] \
      && grep -q 'flashbackrepository.org {' "${PARKED}" \
      && grep -q 'reverse_proxy' "${PARKED}"; then
      size="$(wc -c <"${PARKED}" | tr -d ' ')"
      if [[ "${size}" == "${prev}" && "${size}" -gt 100 ]]; then
        return 0
      fi
      prev="${size}"
    else
      prev=""
    fi
    sleep 0.5
  done
  return 1
}

api_ok() {
  curl -fsS --max-time 5 -k \
    --resolve flashbackrepository.org:443:127.0.0.1 \
    https://flashbackrepository.org/chat/api/health 2>/dev/null \
    | grep -q '"ok":true'
}

if [[ -z "${CHAT_CADDY_MODE:-}" ]]; then
  if curl -fsS --max-time 1 http://127.0.0.1:8098/chat/api/health >/dev/null 2>&1; then
    export CHAT_CADDY_MODE=local
  else
    export CHAT_CADDY_MODE=remote
  fi
fi

if ! wait_park_ready; then
  echo "[ensure-caddy-chat] park file never became ready" >&2
  exit 1
fi

# Fast path: marker present and live health already good
if grep -q "${MARKER}" "${PARKED}" && grep -q 'handle /chat/api\*' "${PARKED}" && api_ok; then
  exit 0
fi

for attempt in 1 2 3 4 5; do
  echo "[ensure-caddy-chat] patch attempt ${attempt} mode=${CHAT_CADDY_MODE}"
  wait_park_ready || true
  "${SCRIPT_DIR}/patch-caddy.sh" "${PARKED}" || true
  sleep 1
  if api_ok; then
    echo "[ensure-caddy-chat] health ok"
    exit 0
  fi
  sleep 1
done

echo "[ensure-caddy-chat] FAILED — /chat/api/health still not ok" >&2
exit 1
