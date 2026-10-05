#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIDEO="${1:-}"
if [[ -z "${VIDEO}" ]]; then
  echo "Usage: $0 /path/to/Spirited.Away.mkv" >&2
  exit 1
fi
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${DIR}/Spirited Away (2001) - Alena Edition.kdenlive"
python3 "${ROOT}/scripts/kdenlive_from_subs.py" \
  --video "${VIDEO}" \
  --subs "${DIR}/Spirited Away (2001) - Alena Edition.srt" \
  --join-fade-sec 0.35 \
  --join-fade-min-gap 45 \
  --remove-ranges-json "${DIR}/remove-spirited-away-alena-ranges.json" \
  --out "${OUT}"
echo "Wrote ${OUT}"
