#!/usr/bin/env bash
set -euo pipefail

BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
HANDLER="$BIN_DIR/flashback-vlc-open"
DESKTOP="$APP_DIR/flashback-vlc-protocol.desktop"

if command -v xdg-desktop-menu >/dev/null 2>&1 && [[ -f "$DESKTOP" ]]; then
  xdg-desktop-menu uninstall --novendor flashback-vlc-protocol.desktop || true
fi
rm -f "$HANDLER" "$DESKTOP"
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APP_DIR" || true
fi
echo "Removed Flashback vlc:// handler."
