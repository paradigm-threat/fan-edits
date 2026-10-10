#!/usr/bin/env bash
# Pin / audit catalog CIDs from assets.manifest.json against local Kubo.
# Usage:
#   scripts/ipfs-pin-catalog-local.sh           # pin missing + report
#   scripts/ipfs-pin-catalog-local.sh --report  # report only (no pin add)
#   scripts/ipfs-pin-catalog-local.sh --dry-run
set -euo pipefail

REPORT_ONLY=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --report) REPORT_ONLY=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      sed -n '2,7p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="${FAN_EDITS_MANIFEST:-$REPO_ROOT/assets.manifest.json}"
IPFS_BIN="${IPFS_BIN:-ipfs}"
export IPFS_PATH="${IPFS_PATH:-$HOME/.ipfs}"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing manifest: $MANIFEST" >&2
  exit 1
fi

if ! command -v "$IPFS_BIN" >/dev/null 2>&1; then
  echo "ipfs not on PATH" >&2
  exit 1
fi

if ! "$IPFS_BIN" id >/dev/null 2>&1; then
  echo "Kubo API unreachable (IPFS_PATH=$IPFS_PATH). Is ipfs.service running?" >&2
  exit 1
fi

# Assets first (playback CIDs), mediaRoot last (directory DAG — can be slow).
# shellcheck disable=SC2016
mapfile -t ROWS < <(python3 - "$MANIFEST" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
rows = []
for a in data.get("assets") or []:
    cid = a.get("ipfs") or ""
    if not cid:
        continue
    p = a.get("path") or a.get("id") or cid
    rows.append((p, cid))
root = data.get("mediaRoot") or ""
if root:
    rows.append(("mediaRoot", root))
for p, cid in rows:
    # path may contain tabs; use RS
    print(p.replace("\n", " ") + "\x1e" + cid)
PY
)

if [[ ${#ROWS[@]} -eq 0 ]]; then
  echo "No CIDs in $MANIFEST"
  exit 0
fi

pinned_ok=0
pinned_missing=0
block_ok=0
block_missing=0
pin_failed=0

printf '%-8s %-8s %-8s  %s\n' "PINNED" "BLOCKS" "ACTION" "PATH / CID"
printf '%s\n' "-------- -------- --------  ----------------------------------------"

for row in "${ROWS[@]}"; do
  path="${row%%$'\x1e'*}"
  cid="${row#*$'\x1e'}"
  is_pinned=0
  has_block=0
  action="ok"

  # Per-CID pin probe (avoid dumping the full pin set — slow on large repos).
  if "$IPFS_BIN" pin ls --type=recursive "/ipfs/$cid" >/dev/null 2>&1; then
    is_pinned=1
  fi

  if "$IPFS_BIN" block stat "/ipfs/$cid" >/dev/null 2>&1; then
    has_block=1
  fi

  if [[ $is_pinned -eq 0 ]]; then
    if [[ $REPORT_ONLY -eq 1 ]]; then
      action="need-pin"
    elif [[ $DRY_RUN -eq 1 ]]; then
      action="would-pin"
    else
      action="pinning"
      if "$IPFS_BIN" pin add --recursive "/ipfs/$cid" >/dev/null 2>&1; then
        is_pinned=1
        action="pinned"
        if "$IPFS_BIN" block stat "/ipfs/$cid" >/dev/null 2>&1; then
          has_block=1
        fi
      else
        action="pin-fail"
        pin_failed=$((pin_failed + 1))
      fi
    fi
  fi

  if [[ $is_pinned -eq 1 ]]; then
    pinned_ok=$((pinned_ok + 1))
  else
    pinned_missing=$((pinned_missing + 1))
  fi
  if [[ $has_block -eq 1 ]]; then
    block_ok=$((block_ok + 1))
  else
    block_missing=$((block_missing + 1))
  fi

  printf '%-8s %-8s %-8s  %s\n' \
    "$([[ $is_pinned -eq 1 ]] && echo yes || echo no)" \
    "$([[ $has_block -eq 1 ]] && echo yes || echo no)" \
    "$action" \
    "$path"
  printf '%-8s %-8s %-8s  %s\n' "" "" "" "$cid"
done

echo
echo "Summary: pinned=$pinned_ok missing_pin=$pinned_missing blocks=$block_ok missing_blocks=$block_missing pin_fail=$pin_failed"
echo "Manifest: $MANIFEST"
echo "IPFS_PATH: $IPFS_PATH"

if [[ $pin_failed -gt 0 ]]; then
  exit 1
fi
if [[ $REPORT_ONLY -eq 1 && $pinned_missing -gt 0 ]]; then
  exit 1
fi
if [[ $REPORT_ONLY -eq 0 && $pinned_missing -gt 0 ]]; then
  exit 1
fi
exit 0
