#!/usr/bin/env bash
# Install Flashback APK on the first non-emulator adb device and smoke-check offline options.
# Usage: scripts/adb-install-flashback-verify.sh [path/to/flashback-arm64-v8a.apk]
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
APK="${1:-$REPO/downloads/flashback-arm64-v8a.apk}"
if [[ ! -f "$APK" ]]; then
  echo "Missing APK: $APK" >&2
  exit 1
fi

SER=""
while read -r line; do
  [[ -z "$line" || "$line" == List* ]] && continue
  id="${line%%[[:space:]]*}"
  [[ "$id" == emulator-* ]] && continue
  SER="$id"
  break
done < <(adb devices)

if [[ -z "$SER" ]]; then
  echo "No physical adb device. Plug in USB debugging (File transfer / PTP) and authorize." >&2
  adb devices -l >&2
  exit 1
fi

echo "Device: $SER"
adb -s "$SER" install -r "$APK"
adb -s "$SER" shell am force-stop com.flashback.repository || true
adb -s "$SER" shell am start -n com.flashback.repository/com.relay.client.MainActivity
sleep 4
# Open a Now-showing title deep link (catalog on origin)
adb -s "$SER" shell am start -a android.intent.action.VIEW \
  -d 'https://flashbackrepository.org/the-mummy-1999-debugged' \
  -n com.flashback.repository/com.relay.client.MainActivity || true
echo "Installed. On the title page confirm: Play · Open in browser · Open in external player · Keep offline · Save offline file."
echo "Then: Save offline file (local Kubo gateway) → wait for notification → Play or Open in external player."
adb -s "$SER" shell getprop ro.product.model
adb -s "$SER" shell getprop ro.product.cpu.abi
