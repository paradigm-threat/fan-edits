#!/usr/bin/env bash
# Install Flashback vlc:// handler as a per-user macOS .app (no admin required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${HOME}/Applications/Flashback VLC Protocol.app"
CONTENTS="$APP_DIR/Contents"
MACOS="$CONTENTS/MacOS"
RES="$CONTENTS/Resources"

mkdir -p "$MACOS" "$RES"
install -m 0755 "$ROOT/flashback-vlc-open" "$MACOS/flashback-vlc-open"

# Thin launcher so LaunchServices can exec the handler with %u
cat >"$MACOS/launcher" <<'EOF'
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/flashback-vlc-open" "$@"
EOF
chmod 0755 "$MACOS/launcher"

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
  <string>1.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
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

# Register with Launch Services
if command -v open >/dev/null 2>&1; then
  open "$APP_DIR" || true
fi
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f "$APP_DIR" 2>/dev/null || true

echo "Installed: $APP_DIR"
echo
echo "If Safari/Chrome ask which app should open vlc:// links, choose"
echo "  Flashback VLC Protocol"
echo
echo "Test:"
echo "  open 'vlc://https://www.videolan.org/vlc/video-dummy.mp4'"
echo
if [[ ! -d /Applications/VLC.app && ! -d "$HOME/Applications/VLC.app" ]]; then
  echo "Note: Install VLC from https://www.videolan.org/vlc/ first."
fi
