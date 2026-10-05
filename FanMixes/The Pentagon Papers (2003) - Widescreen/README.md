# The Pentagon Papers (2003) — Widescreen

Sharper **16:9** presentation of the FX / Paramount TV movie. No story cuts. The 4:3 PAL DVD is AI-upscaled, then center-cropped — not stretched, not outpainted.

A second English track cites the McNaughton / AU-058 investigation and the fact that this film **was not allowed in theaters** — FX TV only, and it never saw an HD release. See [INVESTIGATION.md](INVESTIGATION.md) and [PLAN.md](PLAN.md).

## Motivation

The disc is a **4:3 PAL** master framed for standard-def television. There is no hidden widescreen negative on this DVD — softness is DVD + interlaced PAL, not a missing HD tape. That is also the investigation beat: the film **was not allowed a theatrical run**. The best they could do was this made-for-TV version, and it **never saw an HD release**. Cards for that live on **English (citations)** only. AI upscale happens on Windows + NVIDIA; Linux produces the clean 10-bit HEVC, the dual English tracks, and this project folder.

## Changes

- Restore square pixels, then **2× Real-ESRGAN** (general / real-world weights)
- **Center crop to 16:9** (`1536×864`, optional scale to `1920×1080`)
- Default **English** SRT (PAL-timed, dialogue only). DVD had no English image track
- Optional **English (citations)** — McNaughton, Tonkin/Hanyok, TV-only / no HD. Never on the default track

## Tracks (4:3 library MKV, now)

- **Default:** `subs/The Pentagon Papers (2003).english.srt`
- **Enhanced:** `subs/The Pentagon Papers (2003).enhanced.srt`

```bash
python3 scripts/remux_subtitles.py \
  --video "/media/ari/HD/FanEditRender/The Pentagon Papers (2003)/The Pentagon Papers (2003).mkv" \
  --subs "FanMixes/The Pentagon Papers (2003) - Widescreen/subs/The Pentagon Papers (2003).english.srt" \
  --subs-enhanced "FanMixes/The Pentagon Papers (2003) - Widescreen/subs/The Pentagon Papers (2003).enhanced.srt" \
  --title "English" \
  --title-enhanced "English (citations)" \
  --out "/media/ari/HD/FanEditRender/The Pentagon Papers (2003)/The Pentagon Papers (2003).mkv"
```

Park sidecars in `subs/` so players do not auto-load the citations file beside the MKV.

## Source media (not in git)

PAL DVD (copied beside this FanMix on NAS; never commit):

`/share/Public/Videos/FanEdits/FanMixes/The Pentagon Papers (2003) - Widescreen/The Pentagon Papers (2003) DVD-5/`

Windows: `\\nobiserv\Public\Videos\FanEdits\FanMixes\The Pentagon Papers (2003) - Widescreen\The Pentagon Papers (2003) DVD-5\`

Library rip (after the Linux HEVC encode finishes):

`/share/Public/Videos/General Movies/The Pentagon Papers (2003)/The Pentagon Papers (2003).mkv`

Windows UNC:

`\\nobiserv\Public\Videos\General Movies\The Pentagon Papers (2003)\The Pentagon Papers (2003).mkv`

Stage locally before any long read:

- Linux: `/media/ari/HD/FanEditRender/The Pentagon Papers (2003)/The Pentagon Papers (2003).mkv`
- Windows: `C:\Videos\FanEditRender\The Pentagon Papers (2003)\The Pentagon Papers (2003).mkv`

Do **not** upscale from the old XviD `…nikolas.avi`.

## Build

No Kdenlive timeline. This edit is ffmpeg + an NVIDIA upscaler.

1. Wait until `ffprobe` on the library MKV returns ~`5276` seconds.
2. Copy that file to the **Windows** scratch folder (NAS is too slow for AI).
3. Run a 10-second test, then the full pass:

```powershell
cd "C:\Videos\FanEdits\FanMixes\The Pentagon Papers (2003) - Widescreen"
.\upscale_widescreen.ps1 -TestSeconds 12
.\upscale_widescreen.ps1
```

Needs: `ffmpeg`, `ffprobe`, and either [Video2X](https://github.com/k4yt3x/video2x) or `realesrgan-ncnn-vulkan` on `PATH` (or under `.\tools\`).

Crop-only preview (no AI) on either machine:

```bash
python3 "FanMixes/The Pentagon Papers (2003) - Widescreen/widen_preview.py" \
  --video "/media/ari/HD/FanEditRender/The Pentagon Papers (2003)/The Pentagon Papers (2003).mkv" \
  --out "/media/ari/HD/FanEditRender/The Pentagon Papers (2003) - Widescreen/widen-preview.mkv"
```

## Render

Copy the source rip **off NAS** first ([docs/LLM-FAN-EDIT-INSTRUCTIONS.md](../../docs/LLM-FAN-EDIT-INSTRUCTIONS.md) §5 Phase F).

Final name:

`The Pentagon Papers (2003) - Widescreen.mkv`

- Video: 16:9, 10-bit HEVC, CRF 16, 50 fps
- Audio: copy from source (English default + Russian extras)
- Subs: mux `subs/The Pentagon Papers (2003).english.srt` as default English, and `subs/The Pentagon Papers (2003).enhanced.srt` as **English (citations)** (not default)

## Sync back to server

Copy the **project folder** to `Videos/FanEdits/FanMixes/The Pentagon Papers (2003) - Widescreen/` — **exclude** the 4:3 library rip.

```bash
rsync -aP --exclude='The Pentagon Papers (2003).mkv' \
  "FanMixes/The Pentagon Papers (2003) - Widescreen/" \
  "nobiserv.local:/share/Public/Videos/FanEdits/FanMixes/The Pentagon Papers (2003) - Widescreen/"
```

## Changelog

- 2026-09-24 — FanMix created; PLAN + Windows upscale script; English SRT parked; docs synced to NAS. Final 16:9 MKV not rendered yet.
- 2026-09-24 — Enhanced citations SRT (McNaughton / AU-058–060 / not allowed in theaters / no HD). Dual-track remux on the 4:3 library file.
