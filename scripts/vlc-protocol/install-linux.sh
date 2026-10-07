#!/usr/bin/env bash
# Install Flashback vlc:// handler for the current Linux user (no root required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
HANDLER="$BIN_DIR/flashback-vlc-open"
DESKTOP="$APP_DIR/flashback-vlc-protocol.desktop"

mkdir -p "$BIN_DIR" "$APP_DIR"
install -m 0755 "$ROOT/flashback-vlc-open" "$HANDLER"

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

echo "Installed:"
echo "  handler: $HANDLER"
echo "  desktop: $DESKTOP"
echo
echo "Test (should launch VLC):"
echo "  xdg-open 'vlc://https://www.videolan.org/vlc/video-dummy.mp4'"
echo
echo "Then open a Flashback title and use “Open in VLC”."
if ! command -v vlc >/dev/null 2>&1; then
  echo
  echo "Note: vlc is not on PATH yet. Install it (e.g. sudo apt install vlc)."
fi
