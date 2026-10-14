#!/usr/bin/env bash
# Install Flashback chat sidecar (Ergo + chat-edge) on a fleet node.
# Usage:
#   sudo ./install.sh              # primary (iad1): ergo + edge + local caddy
#   sudo ./install.sh --edge-only  # ord1/hkg1: caddy remote proxy + mirror dirs
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
EDGE_ONLY=0
for a in "$@"; do
  case "$a" in
    --edge-only) EDGE_ONLY=1 ;;
    -h|--help)
      echo "Usage: sudo $0 [--edge-only]"
      exit 0
      ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root" >&2
  exit 1
fi

CHAT_ROOT=/opt/relay/chat
ERGO_VER="${ERGO_VER:-2.19.1}"
ERGO_URL="https://github.com/ergochat/ergo/releases/download/v${ERGO_VER}/ergo-${ERGO_VER}-linux-x86_64.tar.gz"

id relay-chat >/dev/null 2>&1 || useradd --system --home "${CHAT_ROOT}" --shell /usr/sbin/nologin relay-chat

mkdir -p "${CHAT_ROOT}"/{ergo/bin,chat-edge,logs,scripts,backups,logs-mirror,backups-mirror}
chown -R relay-chat:relay-chat "${CHAT_ROOT}"

install -m 0755 "${ROOT}/scripts/backup.sh" "${CHAT_ROOT}/scripts/backup.sh"
install -m 0755 "${ROOT}/scripts/patch-caddy.sh" "${CHAT_ROOT}/scripts/patch-caddy.sh"
install -m 0755 "${ROOT}/scripts/ensure-caddy-chat.sh" "${CHAT_ROOT}/scripts/ensure-caddy-chat.sh"

mkdir -p "${CHAT_ROOT}/caddy"
if [[ "${EDGE_ONLY}" -eq 1 ]]; then
  install -m 0644 "${ROOT}/caddy/Caddyfile.flashback-remote" "${CHAT_ROOT}/caddy/Caddyfile.flashback"
else
  install -m 0644 "${ROOT}/caddy/Caddyfile.flashback-local" "${CHAT_ROOT}/caddy/Caddyfile.flashback"
fi
# Prefer park-tls patch when flashback is already a parked site (avoids ambiguous Caddy site).
# Only import the snippet when the park file has no flashbackrepository.org block.
if grep -q 'flashbackrepository.org' /opt/relay/state/park-tls/Caddyfile.parked 2>/dev/null; then
  :
else
  if ! grep -q 'Caddyfile.flashback' /etc/caddy/Caddyfile 2>/dev/null; then
    printf '\n# Flashback live chat sidecar\nimport /opt/relay/chat/caddy/Caddyfile.flashback\n' >> /etc/caddy/Caddyfile
  fi
fi

install_caddy_guard() {
  install -m 0644 "${ROOT}/systemd/flashback-chat-caddy-guard.service" /etc/systemd/system/flashback-chat-caddy-guard.service
  install -m 0644 "${ROOT}/systemd/flashback-chat-caddy-guard.path" /etc/systemd/system/flashback-chat-caddy-guard.path
  install -m 0644 "${ROOT}/systemd/flashback-chat-caddy-guard.timer" /etc/systemd/system/flashback-chat-caddy-guard.timer
  systemctl daemon-reload
  systemctl enable --now flashback-chat-caddy-guard.path flashback-chat-caddy-guard.timer
}

install_irc_proxy() {
  if ! command -v socat >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y -qq socat || true
  fi
  install -m 0644 "${ROOT}/systemd/flashback-irc-proxy@.service" /etc/systemd/system/flashback-irc-proxy@.service
  install -m 0755 "${ROOT}/scripts/open-irc-ports.sh" "${CHAT_ROOT}/scripts/open-irc-ports.sh"
  systemctl daemon-reload
  "${CHAT_ROOT}/scripts/open-irc-ports.sh" || true
  systemctl enable --now flashback-irc-proxy@6667.service flashback-irc-proxy@6697.service
}

if [[ "${EDGE_ONLY}" -eq 1 ]]; then
  echo "[install] edge-only: Caddy remote proxy + IRC proxy + guard"
  CHAT_CADDY_MODE=remote "${CHAT_ROOT}/scripts/patch-caddy.sh"
  install_caddy_guard
  install_irc_proxy
  echo "[install] edge-only done"
  exit 0
fi

# --- Ergo binary ---
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT
curl -fsSL -o "${TMP}/ergo.tgz" "${ERGO_URL}"
tar -xzf "${TMP}/ergo.tgz" -C "${TMP}"
ERGO_DIR="$(find "${TMP}" -maxdepth 1 -type d -name 'ergo-*' | head -1)"
install -m 0755 "${ERGO_DIR}/ergo" "${CHAT_ROOT}/ergo/bin/ergo"
# Prefer repo ircd.yaml (already patched listeners); fall back to shipping default
if [[ -f "${ROOT}/ergo/ircd.yaml" ]]; then
  install -m 0644 "${ROOT}/ergo/ircd.yaml" "${CHAT_ROOT}/ergo/ircd.yaml"
else
  install -m 0644 "${ERGO_DIR}/default.yaml" "${CHAT_ROOT}/ergo/ircd.yaml"
fi
# motd + languages (Ergo requires languages/ relative to WorkingDirectory)
[[ -f "${ERGO_DIR}/ergo.motd" ]] && install -m 0644 "${ERGO_DIR}/ergo.motd" "${CHAT_ROOT}/ergo/ergo.motd" || true
if [[ -d "${ERGO_DIR}/languages" ]]; then
  rsync -a "${ERGO_DIR}/languages/" "${CHAT_ROOT}/ergo/languages/"
fi

# --- chat-edge ---
rsync -a --delete \
  --exclude node_modules \
  "${ROOT}/chat-edge/" "${CHAT_ROOT}/chat-edge/"
# Prefer vendored node_modules from this checkout when npm is unavailable on the host
if [[ -d "${ROOT}/chat-edge/node_modules" ]]; then
  rsync -a --delete "${ROOT}/chat-edge/node_modules/" "${CHAT_ROOT}/chat-edge/node_modules/"
fi
chown -R relay-chat:relay-chat "${CHAT_ROOT}/chat-edge"
if command -v npm >/dev/null 2>&1; then
  sudo -u relay-chat bash -lc "cd ${CHAT_ROOT}/chat-edge && npm install --omit=dev"
elif [[ ! -d "${CHAT_ROOT}/chat-edge/node_modules/ws" ]]; then
  echo "npm missing and node_modules/ws not vendored" >&2
  exit 1
fi

# --- systemd ---
install -m 0644 "${ROOT}/systemd/flashback-ergo.service" /etc/systemd/system/flashback-ergo.service
install -m 0644 "${ROOT}/systemd/flashback-chat-edge.service" /etc/systemd/system/flashback-chat-edge.service
install -m 0644 "${ROOT}/systemd/flashback-chat-backup.service" /etc/systemd/system/flashback-chat-backup.service
install -m 0644 "${ROOT}/systemd/flashback-chat-backup.timer" /etc/systemd/system/flashback-chat-backup.timer

systemctl daemon-reload
systemctl enable --now flashback-ergo.service
sleep 2
systemctl enable --now flashback-chat-edge.service
systemctl enable --now flashback-chat-backup.timer

CHAT_CADDY_MODE=local "${CHAT_ROOT}/scripts/patch-caddy.sh"
install_caddy_guard
install -m 0755 "${ROOT}/scripts/open-irc-ports.sh" "${CHAT_ROOT}/scripts/open-irc-ports.sh"
"${CHAT_ROOT}/scripts/open-irc-ports.sh" || true
# Primary hosts Ergo publicly — do not enable the edge TCP proxy here.
systemctl disable --now flashback-irc-proxy@6667.service flashback-irc-proxy@6697.service 2>/dev/null || true

echo "[install] health:"
curl -fsS "http://127.0.0.1:8098/chat/api/health" || true
echo
ss -lntp | grep -E ':6667|:6697' || true
echo "[install] primary complete"
