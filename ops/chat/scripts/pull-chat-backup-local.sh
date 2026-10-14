#!/usr/bin/env bash
# Pull iad1 chat archives onto this machine (laptop cold spare).
# Usage:
#   ./pull-chat-backup-local.sh
#   CHAT_BACKUP_LOCAL=~/backups/relay-chat CHAT_BACKUP_HOST=iad1.relaygateway.net ./pull-chat-backup-local.sh
set -euo pipefail

HOST="${CHAT_BACKUP_HOST:-iad1.relaygateway.net}"
USER="${CHAT_BACKUP_USER:-ubuntu}"
SSH_KEY="${CHAT_BACKUP_SSH_KEY:-${HOME}/.ssh/id_ed25519_relay_gateway}"
LOCAL_DIR="${CHAT_BACKUP_LOCAL:-${HOME}/backups/relay-chat}"
REMOTE_ROOT="${CHAT_REMOTE_ROOT:-/opt/relay/chat}"

mkdir -p "${LOCAL_DIR}/logs" "${LOCAL_DIR}/backups" "${LOCAL_DIR}/ergo" "${LOCAL_DIR}/logs-mirror"

SSH=(ssh -o BatchMode=yes -o ConnectTimeout=30)
SCP_RSYNC_SSH="ssh -o BatchMode=yes -o ConnectTimeout=30"
if [[ -f "${SSH_KEY}" ]]; then
  SSH+=(-i "${SSH_KEY}")
  SCP_RSYNC_SSH="ssh -o BatchMode=yes -o ConnectTimeout=30 -i ${SSH_KEY}"
fi

echo "[pull] ${USER}@${HOST}:${REMOTE_ROOT} → ${LOCAL_DIR}"
rsync -az --timeout=120 -e "${SCP_RSYNC_SSH}" \
  "${USER}@${HOST}:${REMOTE_ROOT}/logs/" "${LOCAL_DIR}/logs/"
rsync -az --timeout=120 -e "${SCP_RSYNC_SSH}" \
  "${USER}@${HOST}:${REMOTE_ROOT}/backups/" "${LOCAL_DIR}/backups/" || true
rsync -az --timeout=60 -e "${SCP_RSYNC_SSH}" \
  "${USER}@${HOST}:${REMOTE_ROOT}/channels.json" "${LOCAL_DIR}/channels.json" || true
rsync -az --timeout=60 -e "${SCP_RSYNC_SSH}" \
  "${USER}@${HOST}:${REMOTE_ROOT}/ergo/ircd.db" "${LOCAL_DIR}/ergo/ircd.db" || true
rsync -az --timeout=60 -e "${SCP_RSYNC_SSH}" \
  "${USER}@${HOST}:${REMOTE_ROOT}/ergo/ergo_history.db" "${LOCAL_DIR}/ergo/ergo_history.db" || true

echo "[pull] done → ${LOCAL_DIR}"
echo "[pull] restore sketch (on a new primary):"
echo "  sudo systemctl stop flashback-chat-edge flashback-ergo"
echo "  sudo rsync -a ${LOCAL_DIR}/logs/ /opt/relay/chat/logs/"
echo "  sudo cp -a ${LOCAL_DIR}/channels.json /opt/relay/chat/channels.json"
echo "  sudo cp -a ${LOCAL_DIR}/ergo/*.db /opt/relay/chat/ergo/"
echo "  sudo systemctl start flashback-ergo flashback-chat-edge"
