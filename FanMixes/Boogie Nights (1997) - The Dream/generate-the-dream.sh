#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIDEO="${1:-/media/ari/HD/FanEditRender/Boogie Nights (1997)/Boogie Nights 1997 1080p BluRay x264 AAC - Ozlem.mkv}"
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${DIR}/Boogie Nights (1997) - The Dream.kdenlive"
python3 "${ROOT}/scripts/kdenlive_from_subs.py" \
  --video "${VIDEO}" \
  --subs "${DIR}/Boogie Nights (1997) - The Dream.srt" \
  --join-fade-sec 0.50 \
  --join-fade-min-gap 60 \
  --remove-ranges-json "${DIR}/remove-the-dream-ranges.json" \
  --out "${OUT}"
echo "Wrote ${OUT}"
