#!/usr/bin/env bash
# Flashback Repository — one-step macOS vlc:// installer (no git clone).
#
# Non-techs: open Terminal, paste this, press Return:
#   curl -fsSL https://flashbackrepository.org/scripts/vlc-protocol/install-macos-online.sh | bash
#
# Downloads the handler from the site, installs ~/Applications/Flashback VLC Protocol.app,
# and registers the vlc:// scheme. Does not run a test video unless FLASHBACK_VLC_TEST=1.
set -euo pipefail

BASE_URL="${FLASHBACK_BASE_URL:-https://flashbackrepository.org}"
BASE_URL="${BASE_URL%/}"
HANDLER_URL="${BASE_URL}/scripts/vlc-protocol/flashback-vlc-open"

APP_DIR="${HOME}/Applications/Flashback VLC Protocol.app"
CONTENTS="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS/MacOS"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/flashback-vlc.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "Flashback — setting up one-click Open in VLC…"
echo

# --- VLC present? (soft check; install still proceeds) ---
if [[ ! -d /Applications/VLC.app && ! -d "$HOME/Applications/VLC.app" ]]; then
  echo "VLC is not installed yet."
  echo "  1) Download it: https://www.videolan.org/vlc/"
  echo "  2) Drag VLC into Applications"
  echo "  3) Run this command again"
  echo
  echo "Continuing to install the Flashback helper anyway…"
  echo
fi

echo "Downloading helper from Flashback…"
if ! curl -fsSL "$HANDLER_URL" -o "$TMP/flashback-vlc-open"; then
  echo "Could not download: $HANDLER_URL" >&2
  echo "Check your internet connection and try again." >&2
  exit 1
fi
chmod 0755 "$TMP/flashback-vlc-open"

# Sanity: should be a shell script, not an HTML error page
if ! head -n 1 "$TMP/flashback-vlc-open" | grep -q '^#!'; then
  echo "Download did not look like the Flashback helper (got a web page?)." >&2
  exit 1
fi

echo "Installing Flashback VLC Protocol…"
mkdir -p "$MACOS_DIR"
install -m 0755 "$TMP/flashback-vlc-open" "$MACOS_DIR/flashback-vlc-open"

cat >"$MACOS_DIR/launcher" <<'EOF'
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/flashback-vlc-open" "$@"
EOF
chmod 0755 "$MACOS_DIR/launcher"

cat >"$CONTENTS/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>CFBundleIdentifier</key>
  <string>org.flashbackrepository.vlc-protocol</string>
  <key>CFBundleName</key>
  <string>Flashback VLC Protocol</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleVersion</key>
  <string>1.1</string>
  <key>CFBundleShortVersionString</key>
  <string>1.1</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.15</string>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>VLC Protocol</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>vlc</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
EOF

# Register with Launch Services (quiet)
if [[ -d "$APP_DIR" ]]; then
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
    -f "$APP_DIR" 2>/dev/null || true
fi

echo
echo "Done. One-click Open in VLC is ready."
echo
echo "Next steps:"
echo "  1. Make sure VLC is installed (Applications folder)."
echo "  2. Open a title on Flashback and tap Open in VLC."
echo "  3. If the Mac asks which app should open the link, pick"
echo "       Flashback VLC Protocol"
echo "     and check Always Allow / Remember."
echo

if [[ "${FLASHBACK_VLC_TEST:-}" == "1" ]]; then
  echo "Running optional test (FLASHBACK_VLC_TEST=1)…"
  open 'vlc://https://www.videolan.org/vlc/video-dummy.mp4' || true
fi
