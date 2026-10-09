#!/usr/bin/env bash
# Flashback Repository — one-step Linux vlc:// installer (no git clone).
#
#   curl -fsSL https://flashbackrepository.org/scripts/vlc-protocol/install-linux-online.sh | bash
#
set -euo pipefail

BASE_URL="${FLASHBACK_BASE_URL:-https://flashbackrepository.org}"
BASE_URL="${BASE_URL%/}"
HANDLER_URL="${BASE_URL}/scripts/vlc-protocol/flashback-vlc-open"

BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
HANDLER="$BIN_DIR/flashback-vlc-open"
DESKTOP="$APP_DIR/flashback-vlc-protocol.desktop"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/flashback-vlc.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "Flashback — setting up one-click Open in VLC…"
echo

echo "Downloading helper…"
curl -fsSL "$HANDLER_URL" -o "$TMP/flashback-vlc-open"
chmod 0755 "$TMP/flashback-vlc-open"
if ! head -n 1 "$TMP/flashback-vlc-open" | grep -q '^#!'; then
  echo "Download did not look like the Flashback helper." >&2
  exit 1
fi

mkdir -p "$BIN_DIR" "$APP_DIR"
install -m 0755 "$TMP/flashback-vlc-open" "$HANDLER"

cat >"$DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=Flashback VLC Protocol
Comment=Open vlc:// stream links from Flashback Repository in VLC
Exec=$HANDLER %u
Terminal=false
NoDisplay=true
MimeType=x-scheme-handler/vlc;
EOF

if command -v xdg-desktop-menu >/dev/null 2>&1; then
  xdg-desktop-menu install --novendor "$DESKTOP" || true
fi
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APP_DIR" || true
fi
if command -v xdg-mime >/dev/null 2>&1; then
  xdg-mime default flashback-vlc-protocol.desktop x-scheme-handler/vlc || true
fi

echo
echo "Done. One-click Open in VLC is ready."
echo "Open a Flashback title and use Open in VLC."
if ! command -v vlc >/dev/null 2>&1; then
  echo
  echo "Install VLC if you have not yet (e.g. sudo apt install vlc)."
fi
