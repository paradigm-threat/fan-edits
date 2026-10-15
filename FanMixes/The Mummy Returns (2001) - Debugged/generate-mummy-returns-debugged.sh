#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIDEO="${1:-/media/ari/HD/FanEditRender/The Mummy Returns (2001)/The Mummy Returns - Action 2001 Eng Subs 1080p [H264-mp4].mp4}"
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${DIR}/The Mummy Returns (2001) - Debugged.kdenlive"
python3 "${ROOT}/scripts/kdenlive_from_subs.py" \
  --video "${VIDEO}" \
  --subs "${DIR}/The Mummy Returns (2001) - Debugged.srt" \
  --join-fade-sec 0.35 \
  --join-fade-min-gap 72 \
  --remove-ranges-json "${DIR}/remove-mummy-returns-debugged-ranges.json" \
  --out "${OUT}"
echo "Wrote ${OUT}"
