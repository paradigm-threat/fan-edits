#!/usr/bin/env bash
# Open standard IRC ports on this node (UFW when present).
set -euo pipefail
if command -v ufw >/dev/null 2>&1; then
  ufw allow 6667/tcp comment 'Flashback IRC plain' || true
  ufw allow 6697/tcp comment 'Flashback IRC TLS' || true
  echo "[open-irc-ports] ufw 6667/tcp 6697/tcp allowed"
else
  echo "[open-irc-ports] ufw not installed — ensure 6667/6697/tcp are open"
fi
