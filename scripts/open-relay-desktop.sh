#!/usr/bin/env bash
# Open fan-edits in relay-client-desktop (builds not included).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RELAY_WS="${RELAY_WS:-$HOME/dev/relay}"
BIN="${RELAY_CLIENT_DESKTOP_BIN:-$RELAY_WS/target/debug/relay-client-desktop}"
GATEWAY="${RELAY_GATEWAY_BIN:-$RELAY_WS/relay-gateway/target/debug/relay-gateway}"

if [[ ! -f "$GATEWAY" ]]; then
  echo "Build relay-gateway: cd $RELAY_WS/relay-gateway && cargo build --bin relay-gateway" >&2
  exit 1
fi
if [[ ! -x "$BIN" && ! -f "$BIN" ]]; then
  echo "Build client: cd $RELAY_WS && cargo build -p relay-client-desktop" >&2
  exit 1
fi

export RELAY_GATEWAY_BIN="$GATEWAY"
VERIFY=0
ARGS=()
for a in "$@"; do
  if [[ "$a" == "--verify" ]]; then
    VERIFY=1
  else
    ARGS+=("$a")
  fi
done

if [[ "$VERIFY" == "1" ]]; then
  MANIFEST="$ROOT/render-manifest.json"
  exec "$BIN" --verify --repo "$ROOT" --manifest "$MANIFEST" "${ARGS[@]}"
fi

exec "$BIN" --repo "$ROOT" "${ARGS[@]}"
