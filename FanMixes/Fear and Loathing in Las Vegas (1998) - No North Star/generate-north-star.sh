#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIDEO="${1:-/media/ari/HD/FanEditRender/Fear and Loathing in Las Vegas (1998)/Fear and Loathing in Las Vegas 1998 1080p BluRay x264 AAC - Ozlem.mp4}"
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${DIR}/Fear and Loathing in Las Vegas (1998) - No North Star.kdenlive"
python3 "${ROOT}/scripts/kdenlive_from_subs.py" \
  --video "${VIDEO}" \
  --subs "${DIR}/Fear and Loathing in Las Vegas (1998) - No North Star.srt" \
  --join-fade-sec 0.5 \
  --join-fade-min-gap 60 \
  --remove-ranges-json "${DIR}/remove-north-star-ranges.json" \
  --out "${OUT}"
echo "Wrote ${OUT}"
