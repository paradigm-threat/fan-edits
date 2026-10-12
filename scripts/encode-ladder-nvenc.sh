#!/usr/bin/env bash
# Fast H.264 ladder beside a master using NVENC (fallback: libx264 veryfast).
# Usage: encode-ladder-nvenc.sh <master.mkv> [web|mobile|all]
set -euo pipefail
MASTER="${1:?master file}"
WHICH="${2:-all}"
[[ -f "$MASTER" ]] || { echo "missing $MASTER" >&2; exit 1; }

dir="$(dirname "$MASTER")"
base="$(basename "$MASTER")"
stem="${base%.*}"
stem="${stem%.web-1080p}"
stem="${stem%.mobile-720p}"
# Container is MKV (H.264 + AAC inside); matches Bunny Now showing ladder naming.
WEB="$dir/${stem}.web-1080p.mkv"
MOB="$dir/${stem}.mobile-720p.mkv"
LOG="${ENCODE_LOG:-/tmp/encode-ladder-$(basename "$stem").log}"

# Prefer NVENC only when CUDA loads; else libx264 veryfast.
have_nvenc=0
if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q h264_nvenc \
  && ldconfig -p 2>/dev/null | grep -q 'libcuda.so'; then
  have_nvenc=1
fi
echo "encoder=$([[ $have_nvenc == 1 ]] && echo h264_nvenc || echo libx264)" | tee -a "$LOG"

encode() {
  local out="$1" max_w="$2" cq="$3" aac="$4" label="$5"
  if [[ -f "$out" && $(stat -c%s "$out") -gt 50000000 && "${FORCE:-0}" != 1 ]]; then
    echo "SKIP $out (exists)" | tee -a "$LOG"
    return 0
  fi
  echo "[$(date -Iseconds)] ENCODE $label -> $out" | tee -a "$LOG"
  local vf="scale='min(${max_w},iw)':-2"
  if [[ "$have_nvenc" == 1 ]]; then
    ffmpeg -y -hide_banner -loglevel info -stats \
      -i "$MASTER" \
      -map 0:v:0 -map 0:a:0? \
      -vf "$vf" -pix_fmt yuv420p \
      -c:v h264_nvenc -preset p4 -cq "$cq" -rc vbr -b:v 0 \
      -c:a aac -b:a "${aac}k" -ac 2 \
      "$out" 2>&1 | tee -a "$LOG"
  else
    ffmpeg -y -hide_banner -loglevel info -stats \
      -i "$MASTER" \
      -map 0:v:0 -map 0:a:0? \
      -vf "$vf" -pix_fmt yuv420p \
      -c:v libx264 -preset veryfast -crf "$cq" \
      -c:a aac -b:a "${aac}k" -ac 2 \
      "$out" 2>&1 | tee -a "$LOG"
  fi
  ls -lh "$out" | tee -a "$LOG"
}

case "$WHICH" in
  web) encode "$WEB" 1920 20 160 web-1080p ;;
  mobile) encode "$MOB" 1280 23 128 mobile-720p ;;
  all)
    encode "$WEB" 1920 20 160 web-1080p
    encode "$MOB" 1280 23 128 mobile-720p
    ;;
  *) echo "which: web|mobile|all" >&2; exit 2 ;;
esac
echo "[$(date -Iseconds)] DONE $MASTER ($WHICH)" | tee -a "$LOG"
