#!/usr/bin/env bash
# Backup /opt/relay/chat hot data to peer fleet nodes + local retention prune.
set -euo pipefail

CHAT_ROOT="${CHAT_ROOT:-/opt/relay/chat}"
RETENTION_DAYS="${CHAT_RETENTION_DAYS:-90}"
HOST="$(hostname -f 2>/dev/null || hostname)"
PEERS_DEFAULT="ord1.relaygateway.net hkg1.relaygateway.net"
# On non-iad1, still allow running (no-op peers if unset)
PEERS="${CHAT_BACKUP_PEERS:-}"

if [[ -z "${PEERS}" ]]; then
  case "${HOST}" in
    iad1.*|iad1) PEERS="${PEERS_DEFAULT}" ;;
    *) PEERS="" ;;
  esac
fi

mkdir -p "${CHAT_ROOT}/backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="${CHAT_ROOT}/backups/chat-${STAMP}.tar.gz"

# Snapshot logs + index + ergo db (best-effort while running)
tar -C "${CHAT_ROOT}" -czf "${ARCHIVE}" \
  --exclude='backups' \
  --exclude='ergo/bin' \
  --exclude='chat-edge/node_modules' \
  logs channels.json ergo/ircd.db ergo/ircd.yaml 2>/dev/null || \
tar -C "${CHAT_ROOT}" -czf "${ARCHIVE}" \
  --exclude='backups' \
  --exclude='ergo/bin' \
  --exclude='chat-edge/node_modules' \
  logs channels.json ergo 2>/dev/null || true

# Prune local archives older than retention
find "${CHAT_ROOT}/backups" -type f -name 'chat-*.tar.gz' -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true

# Prune JSONL older than retention
if [[ -d "${CHAT_ROOT}/logs" ]]; then
  find "${CHAT_ROOT}/logs" -type f -name '*.jsonl' -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true
fi

for peer in ${PEERS}; do
  [[ -z "${peer}" ]] && continue
  if [[ "${peer}" == "${HOST}" ]]; then
    continue
  fi
  echo "[backup] rsync → ${peer}"
  rsync -az --timeout=60 \
    "${CHAT_ROOT}/logs/" "ubuntu@${peer}:/opt/relay/chat/logs-mirror/iad1/" || echo "[backup] warn: rsync logs ${peer} failed"
  rsync -az --timeout=60 \
    "${ARCHIVE}" "ubuntu@${peer}:/opt/relay/chat/backups-mirror/" || echo "[backup] warn: rsync archive ${peer} failed"
done

echo "[backup] done ${ARCHIVE}"
