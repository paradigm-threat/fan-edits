# Serenity (2005) — Unjossed Edition

## Changes

Family/kids cut: **strict on Reaver gore**, keeps action and core plot.

| Decision | Applied |
|----------|---------|
| Kaylee/Jayne “nethers / batteries” | **Whole beat removed** |
| Haven massacre | **Shortened to Mal’s reaction** (posts/gore out) |
| Maidenhead fight | **Kept** — martial arts stay; **reaver gore only** trimmed |
| “Leaf on the wind” | **Kept** |
| Final fight | **Kept** |

See [PLAN.md](PLAN.md).

## Source media (not in git)

`N:\Videos\Horror and SciFi\Serenity (2005)  [2160p x265 10bit FS90 Joy].mkv`  
3840×1632, HEVC 10-bit, ~119 min.

## Rebuild project

```powershell
cd N:\Videos\FanEdits
python "FanMixes\Serenity (2005) - Unjossed\filter_theatrical_srt.py"
python "FanMixes\Serenity (2005) - Unjossed\build_remove_ranges.py"
python scripts\kdenlive_from_subs.py `
  --video "N:\Videos\Horror and SciFi\Serenity (2005)  [2160p x265 10bit FS90 Joy].mkv" `
  --subs "FanMixes\Serenity (2005) - Unjossed\Serenity (2005) - Unjossed.srt" `
  --keep-full-timeline --snap --join-fade-sec 0.35 --join-fade-min-gap 72 `
  --remove-ranges-json "FanMixes\Serenity (2005) - Unjossed\remove-serenity-unjossed-ranges.json" `
  --out "FanMixes\Serenity (2005) - Unjossed\Serenity (2005) - Unjossed.kdenlive"
```

Timeline uses **one clip per subtitle block** so you can delete or reorder scenes in Kdenlive. **QC every join** — Haven and Maidenhead need picture passes.

## Render

Copy source from NAS to **local disk** first ([docs/LLM-FAN-EDIT-INSTRUCTIONS.md](../../docs/LLM-FAN-EDIT-INSTRUCTIONS.md) §5 Phase F).

```powershell
$src = 'N:\Videos\Horror and SciFi\Serenity (2005)  [2160p x265 10bit FS90 Joy].mkv'
$localDir = 'C:\Videos\FanEditRender'
$local = Join-Path $localDir ([System.IO.Path]::GetFileName($src))
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
robocopy (Split-Path -LiteralPath $src -Parent) $localDir ([System.IO.Path]::GetFileName($src)) /Z /J
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $local

python "FanMixes\Serenity (2005) - Unjossed\render_final_mkv.py" `
  --video $local `
  --out "FanMixes\Serenity (2005) - Unjossed\Serenity (2005) - Unjossed Edition.mkv"
```

Two-pass HEVC 10-bit, ~source bitrate, AAC 5.1, embedded shifted subs. Expect **many hours** at 4K.

After a successful render, sync the project folder back to NAS **excluding** the source rip:

```powershell
$proj = 'FanMixes\Serenity (2005) - Unjossed'
robocopy 'C:\Videos\FanEditRender\Serenity (2005) - Unjossed' "N:\Videos\FanEdits\$proj" /E /XF 'Serenity (2005)  [2160p x265 10bit FS90 Joy].mkv' /Z /J
```

Or copy at minimum `Serenity (2005) - Unjossed Edition.mkv` into the NAS project folder (exclude the source `.mkv` rip).
