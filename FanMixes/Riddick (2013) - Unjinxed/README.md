# Riddick (2013) — Unjinxed

A dialogue-trimmed *Riddick* that keeps the Unjinxed tone, front-loads the Necromonger “wrong planet” flashback as a linear prologue, and drops the opening predator beat so the desert survival story starts clean.

## Motivation

Theatrical *Riddick* dumps you into desert survival and only later explains why he’s stranded. This cut wants that exposition up front, without mid-film flashbacks, while keeping the existing Unjinxed dialogue trims (including the Vaako conspiracy block) and the Necromonger epilogue at the end.

## Changes

- Removes distracting, sexist, and exaggerated dialogue throughout (legacy Unjinxed trims in `playlist2`).
- Opening vulture/pterosaur kill removed (~30s–120s on source); main desert story starts at **00:01:13** VO.
- Vaako / Furya-bait conspiracy block stays cut (`00:13:25`–`00:15:50` / ~805s–950s).
- Necromonger / wrong-planet flashback (`~10:54`–`22:51` on source) plays **before** the desert survival plot (prologue A + B; in-body flashback omitted from main).
- Savanna bridge (`00:22:51`–`00:24:03`) kept once after main survival; Necromonger epilogue (`~1:41+`) remains at the **end**.
- vulture/pterosaur kill — QC refine in Kdenlive
- Vaako / Furya-bait conspiracy — keep removed
- flashback block A — plays in prologue only
- flashback block B — plays in prologue only; main omits 654-1371 except savanna 1371-1443


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
