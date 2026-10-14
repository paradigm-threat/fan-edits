#!/usr/bin/env bash
# Run on each Relay fleet node to drop fan-edits IPFS disk cache and confirm skip-pin.
# Does not touch other repos' cache trees.
set -euo pipefail

CACHE_ROOT="${RELAY_IPFS_CACHE_ROOT:-/opt/relay/ipfs-cache}"
REPO_SLUG="${1:-fan-edits}"
DRY_RUN="${DRY_RUN:-0}"

echo "RELAY_IPFS_CACHE_ROOT=$CACHE_ROOT"
echo "repo slug=$REPO_SLUG"

if [[ ! -d "$CACHE_ROOT" ]]; then
  echo "cache root missing (nothing to wipe): $CACHE_ROOT"
else
  # Path-keyed tree: `{cache}/{repo}/files/{rel}` (see relay-gateway asset_store).
  cand="$CACHE_ROOT/$REPO_SLUG"
  if [[ -e "$cand" ]]; then
    du -sh "$cand" 2>/dev/null || true
    if [[ "$DRY_RUN" == "1" ]]; then
      echo "DRY_RUN would rm -rf $cand"
    else
      rm -rf "$cand"
      echo "removed $cand"
    fi
  else
    echo "no path-keyed tree at $cand"
  fi
  if [[ -d "$CACHE_ROOT" ]]; then
    echo "remaining top-level under cache (first 30):"
    ls -la "$CACHE_ROOT" | head -30
  fi
fi

echo "--- pin skip env (process / unit) ---"
echo "RELAY_IPFS_SKIP_PIN_REPOS=${RELAY_IPFS_SKIP_PIN_REPOS:-<unset>}"
echo "RELAY_IPFS_FLEET_PIN=${RELAY_IPFS_FLEET_PIN:-<unset>}"

if [[ "${RELAY_IPFS_SKIP_PIN_REPOS:-}" != *"$REPO_SLUG"* ]]; then
  echo "NOTE: ensure fleet unit Environment includes RELAY_IPFS_SKIP_PIN_REPOS=$REPO_SLUG"
  echo "  (catalog limits.fleet_pin_ipfs=false / max_ipfs_bytes=0 also skip after gateway deploy)"
fi

echo "done"
