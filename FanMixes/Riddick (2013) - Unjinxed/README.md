# Riddick (2013) — Unjinxed

## Changes

- Removes distracting, sexist, and exaggerated dialogue throughout (legacy Unjinxed trims in `playlist2`).
- **Flashback prologue:** Necromonger / wrong-planet backstory (`~10:54–22:51` on source) plays **before** the desert survival plot so exposition is linear.
- **Vaako block** (`13:25–15:50` on source) stays **cut**.
- **Opening vulture/pterosaur kill** removed; main desert story starts at **`00:01:13`** VO (no `00:00:30–00:02:00` predator beat).
- Necromonger epilogue (`~1:41+`) remains at the **end**.

Editorial detail: [PLAN.md](PLAN.md). Cut list: [remove-riddick-unjinxed-ranges.json](remove-riddick-unjinxed-ranges.json).

## Source media (not in git)

Place the rip at:

`N:\Videos\Horror and SciFi\Riddick Movies\Riddick (2013) [1080p]\Riddick.2013.1080p.BluRay.x264.YIFY.mp4`

Kdenlive project root: `/Horror and SciFi/Riddick Movies/Riddick (2013) [1080p]/`

Verify before editing or render:

```powershell
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "N:\Videos\Horror and SciFi\Riddick Movies\Riddick (2013) [1080p]\Riddick.2013.1080p.BluRay.x264.mp4"
```

## Build

1. Open `Riddick (2013) - Unjinxed.kdenlive` in Kdenlive (check media path resolves).
2. **QC every join** — especially prologue → main dip (`filter12`/`filter13`), Vaako gap inside prologue, savanna bridge, and existing Unjinxed fades.
3. Re-apply timeline after manual tweaks:

```powershell
python "N:\Videos\FanEdits\FanMixes\Riddick (2013) - Unjinxed\apply_riddick_reorder.py"
```

(Regenerates `playlist2` head + `.kdenlive.shifted.srt` / `.ass` from `Riddick (2013) - Unjinxed.srt`.)

## Render

Copy the source rip to local disk first (NAS is too slow for long encodes). See [docs/LLM-FAN-EDIT-INSTRUCTIONS.md](../../docs/LLM-FAN-EDIT-INSTRUCTIONS.md) §5 Phase F.

```powershell
$src = "N:\Videos\Horror and SciFi\Riddick Movies\Riddick (2013) [1080p]\Riddick.2013.1080p.BluRay.x264.mp4"
$localDir = "C:\Videos\FanEditRender"
$local = Join-Path $localDir (Split-Path $src -Leaf)
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
Copy-Item -LiteralPath $src -Destination $local -Force
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $local
```

**Automated render** (local copy + two-pass HEVC):

```powershell
powershell -ExecutionPolicy Bypass -File "N:\Videos\FanEdits\FanMixes\Riddick (2013) - Unjinxed\render-riddick.ps1"
```

Or manually:

```powershell
python "N:\Videos\FanEdits\FanMixes\Riddick (2013) - Unjinxed\render_final_mkv.py" `
  --video "C:\Videos\FanEditRender\Riddick.2013.1080p.BluRay.x264.YIFY.mp4" `
  --out "C:\Videos\FanEditRender\Riddick (2013) - Unjinxed.mkv"
```

Output: `C:\Videos\FanEditRender\Riddick (2013) - Unjinxed.mkv` with muxed `Riddick (2013) - Unjinxed.kdenlive.shifted.srt`. Log: `C:\Videos\FanEditRender\riddick_unjinxed_render.log`. Expect **1–3+ hours** CPU encode for ~106 min @ 1080p HEVC.

## Changelog

- **2026-05-25** — Flashback prologue reorder; vulture open removed; `PLAN.md`, `remove-riddick-unjinxed-ranges.json`, `apply_riddick_reorder.py`; regen shifted subs/ASS (~1:45:40 output timeline).
