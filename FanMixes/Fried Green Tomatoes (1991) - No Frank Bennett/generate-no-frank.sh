#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIDEO="${1:-}"
if [[ -z "${VIDEO}" ]]; then
  echo "Usage: $0 /path/to/Fried.Green.Tomatoes.EXTENDED.mp4" >&2
  exit 1
fi
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${DIR}/Fried Green Tomatoes (1991) - No Frank Bennett.kdenlive"
python3 "${ROOT}/scripts/kdenlive_from_subs.py" \
  --video "${VIDEO}" \
  --subs "${DIR}/Fried-Green-Tomatoes.en.srt" \
  --keep-full-timeline \
  --remove-ranges-json "${DIR}/remove-frank-bennett-ranges.json" \
  --out "${OUT}"
echo "Wrote ${OUT}"
