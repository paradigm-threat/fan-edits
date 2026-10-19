#!/usr/bin/env bash
# Retired. The published file is one HEVC (H.265) MKV with subtitles embedded.
# Do not encode an H.264 1080p or 720p ladder.
set -euo pipefail
echo "refusing H.264 ladder: publish one HEVC MKV with embedded subtitles (scripts/remux_subtitles.py)" >&2
exit 2
