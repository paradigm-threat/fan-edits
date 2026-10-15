#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIDEO="${1:-/home/ari/Videos/The Mummy (1999) [2160p] [4K] [BluRay] [5.1] [YTS.MX]/The.Mummy.1999.2160p.4K.BluRay.x265.10bit.AAC5.1-[YTS.MX].mkv}"
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${DIR}/The Mummy Debugged.kdenlive"
python3 "${ROOT}/scripts/kdenlive_from_subs.py" \
  --video "${VIDEO}" \
  --subs "${DIR}/The Mummy Debugged.srt" \
  --join-fade-sec 0.35 \
  --join-fade-min-gap 72 \
  --remove-ranges-json "${DIR}/remove-mummy-debugged-ranges.json" \
  --out "${OUT}"
echo "Wrote ${OUT}"
