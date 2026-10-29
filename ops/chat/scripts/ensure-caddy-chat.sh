#!/usr/bin/env bash
# Re-apply chat Caddy handles if park-tls wiped them (park plugin regenerates the file).
# Patches every parked apex (not only Flashback) so PT / Clevertree /chat health stays up.
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

# Probe a parked host's chat health via local TLS (SNI).
host_chat_ok() {
  local host="$1"
  curl -fsS --max-time 5 -k \
    --resolve "${host}:443:127.0.0.1" \
    "https://${host}/chat/api/health" 2>/dev/null \
    | grep -q '"ok":true'
}

api_ok() {
  # Prefer Flashback; also require PT when that cert/site exists.
  local ok=0
  if host_chat_ok flashbackrepository.org; then
    ok=1
  fi
  if grep -q '^paradigmthreat.net {' "${PARKED}" 2>/dev/null; then
    if host_chat_ok paradigmthreat.net; then
      ok=1
    else
      return 1
    fi
  fi
  [[ "${ok}" -eq 1 ]]
}

if [[ -z "${CHAT_CADDY_MODE:-}" ]]; then
  if curl -fsS --max-time 1 http://127.0.0.1:8098/chat/api/health >/dev/null 2>&1 \
    || curl -fsS --max-time 1 http://127.0.0.1:8098/api/health >/dev/null 2>&1; then
    export CHAT_CADDY_MODE=local
  else
    export CHAT_CADDY_MODE=remote
  fi
fi

if ! wait_park_ready; then
  echo "[ensure-caddy-chat] park file never became ready" >&2
  exit 1
fi

# Fast path: every apex that reverse_proxies already has the marker, and live health is good.
apex_missing_chat=0
while read -r host; do
  [[ -z "${host}" || "${host}" == www.* ]] && continue
  block="$(awk -v h="${host}" '
    $0 ~ "^"h" \\{" {p=1}
    p {print}
    p && /^}/ {exit}
  ' "${PARKED}")"
  echo "${block}" | grep -q 'reverse_proxy' || continue
  if ! echo "${block}" | grep -q "${MARKER}"; then
    apex_missing_chat=1
    break
  fi
done < <(grep -E '^[a-z0-9.-]+ \{' "${PARKED}" | sed 's/ {$//')

if [[ "${apex_missing_chat}" -eq 0 ]] && grep -q 'handle /chat/api\*' "${PARKED}" && api_ok; then
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
