#!/usr/bin/env bash
# Render FF vs Matrix moment comparison clips.
set -euo pipefail

BASE="$(cd "$(dirname "$0")" && pwd)"
CLIPS="$BASE/clips"
SMB="/run/user/1000/gvfs/smb-share:server=nobiserv.local,share=public/Videos/FanEdits"
FF_SRC="$SMB/FanMixes/Final Fantasy (2001) - The Phantom Menace/Final Fantasy (2001) - The Phantom Menace.mkv"
MX_SRC="$SMB/FanMixes/Matrix Revolutions (2003) - Unlinked/Matrix Revolutions (2003) - Unlinked Edition.mkv"
FF="$CLIPS/ff-tpm-moment.mkv"
MX="$CLIPS/matrix-rev-moment.mkv"

ENC=( -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -c:a aac -b:a 192k )

mkdir -p "$CLIPS"

# FF 01:12:12–01:12:25 (13s), Matrix 01:27:44–01:27:58 (14s)
ffmpeg -y -ss 01:12:12 -i "$FF_SRC" -t 13 -map 0:v:0 -map 0:a:0 -c copy "$FF"
ffmpeg -y -ss 01:27:44 -i "$MX_SRC" -t 14 -map 0:v:0 -map 0:a:0 -c copy "$MX"

FF_DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$FF")"
MX_DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MX")"
read -r MAX_DUR PAD_FF PAD_MX <<<"$(python3 -c "
ff, mx = float('$FF_DUR'), float('$MX_DUR')
print(max(ff, mx), max(0.0, mx - ff), max(0.0, ff - mx))
")"
SBS_TRIM=5
SBS_DUR="$(python3 -c "print(max(1.0, float('$MAX_DUR') - $SBS_TRIM))")"

echo "FF duration: ${FF_DUR}s, Matrix duration: ${MX_DUR}s, sync to: ${MAX_DUR}s (FF pad: ${PAD_FF}s, Matrix pad: ${PAD_MX}s)"
echo "Side-by-side duration: ${SBS_DUR}s (${SBS_TRIM}s shorter than sync length)"

# scale+crop to fill frame (no letterboxing)
FS1080='scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=24000/1001'
FSVERT='scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=24000/1001'
HALF_H='scale=960:1080:force_original_aspect_ratio=increase,crop=960:1080,setsar=1,fps=24000/1001'
HALF_V='scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960,setsar=1,fps=24000/1001'

# 1) Sequential desktop: FF then Matrix, full-screen 1920x1080
ffmpeg -y -i "$FF" -i "$MX" \
  -filter_complex \
  "[0:v]${FS1080}[v0];\
   [1:v]${FS1080}[v1];\
   [0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a0];\
   [1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a1];\
   [v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" "${ENC[@]}" "$CLIPS/sequential.mp4"

# 1b) Sequential portrait: full-screen 1080x1920
ffmpeg -y -i "$FF" -i "$MX" \
  -filter_complex \
  "[0:v]${FSVERT}[v0];\
   [1:v]${FSVERT}[v1];\
   [0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a0];\
   [1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a1];\
   [v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" "${ENC[@]}" "$CLIPS/sequential-portrait.mp4"

# 2) Portrait stacked: 1080x1920, panels fill top/bottom half with no gap
ffmpeg -y -i "$FF" -i "$MX" \
  -filter_complex \
  "[0:v]${HALF_V},tpad=stop_mode=clone:stop_duration=${PAD_FF}[v0];\
   [1:v]${HALF_V},tpad=stop_mode=clone:stop_duration=${PAD_MX}[v1];\
   [v0][v1]vstack=inputs=2[outv];\
   [0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur=${SBS_DUR}[a0];\
   [1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur=${SBS_DUR}[a1];\
   [a0][a1]amix=inputs=2:duration=longest:dropout_transition=0[outa]" \
  -map "[outv]" -map "[outa]" -t "$SBS_DUR" "${ENC[@]}" "$CLIPS/side-by-side-portrait.mp4"

# 3) Horizontal desktop: 1920x1080, panels fill left/right half with no gap
ffmpeg -y -i "$FF" -i "$MX" \
  -filter_complex \
  "[0:v]${HALF_H},tpad=stop_mode=clone:stop_duration=${PAD_FF}[v0];\
   [1:v]${HALF_H},tpad=stop_mode=clone:stop_duration=${PAD_MX}[v1];\
   [v0][v1]hstack=inputs=2[outv];\
   [0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur=${SBS_DUR}[a0];\
   [1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur=${SBS_DUR}[a1];\
   [a0][a1]amix=inputs=2:duration=longest:dropout_transition=0[outa]" \
  -map "[outv]" -map "[outa]" -t "$SBS_DUR" "${ENC[@]}" "$CLIPS/side-by-side-desktop.mp4"

# 4) Desktop composite: side-by-side then full-screen sequential (1920x1080)
ffmpeg -y -i "$CLIPS/side-by-side-desktop.mp4" -i "$CLIPS/sequential.mp4" \
  -filter_complex \
  "[0:v]setsar=1,fps=24000/1001[v0];\
   [1:v]setsar=1,fps=24000/1001[v1];\
   [0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a0];\
   [1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a1];\
   [v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" "${ENC[@]}" "$CLIPS/comparison-desktop.mp4"

# 5) Portrait composite: side-by-side then full-screen sequential (1080x1920)
ffmpeg -y -i "$CLIPS/side-by-side-portrait.mp4" -i "$CLIPS/sequential-portrait.mp4" \
  -filter_complex \
  "[0:v]setsar=1,fps=24000/1001[v0];\
   [1:v]setsar=1,fps=24000/1001[v1];\
   [0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a0];\
   [1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a1];\
   [v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" "${ENC[@]}" "$CLIPS/comparison-portrait.mp4"

echo "Done:"
ls -lh "$CLIPS"/*.mp4
