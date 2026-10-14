#!/usr/bin/env bash
# Backup /opt/relay/chat hot data to peer fleet nodes + optional local pull path.
set -euo pipefail

CHAT_ROOT="${CHAT_ROOT:-/opt/relay/chat}"
RETENTION_DAYS="${CHAT_RETENTION_DAYS:-90}"
# JSONL under logs/pt-* is PT import history — keep longer than generic retention
PT_RETENTION_DAYS="${CHAT_PT_RETENTION_DAYS:-3650}"
HOST="$(hostname -f 2>/dev/null || hostname)"
PEERS_DEFAULT="ord1.relaygateway.net hkg1.relaygateway.net"
# On non-iad1, still allow running (no-op peers if unset)
PEERS="${CHAT_BACKUP_PEERS:-}"
# Optional laptop/local mirror, e.g. CHAT_BACKUP_LOCAL=/home/ari/backups/relay-chat
LOCAL_DIR="${CHAT_BACKUP_LOCAL:-}"

if [[ -z "${PEERS}" ]]; then
  case "${HOST}" in
    iad1.*|iad1) PEERS="${PEERS_DEFAULT}" ;;
    *) PEERS="" ;;
  esac
fi

mkdir -p "${CHAT_ROOT}/backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="${CHAT_ROOT}/backups/chat-${STAMP}.tar.gz"

# Snapshot logs + index + ergo dbs (best-effort while running)
tar -C "${CHAT_ROOT}" -czf "${ARCHIVE}" \
  --exclude='backups' \
  --exclude='ergo/bin' \
  --exclude='chat-edge/node_modules' \
  logs channels.json \
  ergo/ircd.db ergo/ircd.yaml ergo/ergo_history.db 2>/dev/null || \
tar -C "${CHAT_ROOT}" -czf "${ARCHIVE}" \
  --exclude='backups' \
  --exclude='ergo/bin' \
  --exclude='chat-edge/node_modules' \
  logs channels.json ergo 2>/dev/null || true

# Prune local archives older than retention
find "${CHAT_ROOT}/backups" -type f -name 'chat-*.tar.gz' -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true

# Prune JSONL older than retention (keep pt-* import dirs much longer)
if [[ -d "${CHAT_ROOT}/logs" ]]; then
  find "${CHAT_ROOT}/logs" -type f -name '*.jsonl' -mtime "+${RETENTION_DAYS}" \
    ! -path '*/pt-*/*' -delete 2>/dev/null || true
  find "${CHAT_ROOT}/logs" -type f -name '*.jsonl' -path '*/pt-*/*' \
    -mtime "+${PT_RETENTION_DAYS}" -delete 2>/dev/null || true
fi

rsync_peer() {
  local peer="$1"
  echo "[backup] rsync → ${peer}"
  rsync -az --timeout=60 \
    "${CHAT_ROOT}/logs/" "ubuntu@${peer}:/opt/relay/chat/logs-mirror/iad1/" || echo "[backup] warn: rsync logs ${peer} failed"
  rsync -az --timeout=60 \
    "${ARCHIVE}" "ubuntu@${peer}:/opt/relay/chat/backups-mirror/" || echo "[backup] warn: rsync archive ${peer} failed"
  # Also mirror Ergo history DB when present
  if [[ -f "${CHAT_ROOT}/ergo/ergo_history.db" ]]; then
    rsync -az --timeout=60 \
      "${CHAT_ROOT}/ergo/ergo_history.db" \
      "ubuntu@${peer}:/opt/relay/chat/logs-mirror/iad1-ergo/ergo_history.db" || \
      echo "[backup] warn: rsync ergo_history ${peer} failed"
  fi
}

for peer in ${PEERS}; do
  [[ -z "${peer}" ]] && continue
  if [[ "${peer}" == "${HOST}" ]]; then
    continue
  fi
  rsync_peer "${peer}"
done

if [[ -n "${LOCAL_DIR}" ]]; then
  mkdir -p "${LOCAL_DIR}/logs" "${LOCAL_DIR}/backups" "${LOCAL_DIR}/ergo"
  echo "[backup] local → ${LOCAL_DIR}"
  rsync -az --timeout=120 "${CHAT_ROOT}/logs/" "${LOCAL_DIR}/logs/" || echo "[backup] warn: local logs failed"
  rsync -az --timeout=120 "${ARCHIVE}" "${LOCAL_DIR}/backups/" || echo "[backup] warn: local archive failed"
  if [[ -f "${CHAT_ROOT}/ergo/ergo_history.db" ]]; then
    rsync -az --timeout=60 \
      "${CHAT_ROOT}/ergo/ergo_history.db" "${LOCAL_DIR}/ergo/ergo_history.db" || \
      echo "[backup] warn: local ergo_history failed"
  fi
  if [[ -f "${CHAT_ROOT}/channels.json" ]]; then
    cp -a "${CHAT_ROOT}/channels.json" "${LOCAL_DIR}/channels.json" || true
  fi
fi

echo "[backup] done ${ARCHIVE}"
