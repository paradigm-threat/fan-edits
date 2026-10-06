# Serenity (2005) — Unjossed Edition

A family/kids cut of *Serenity*: strict on Reaver gore, keeps the action and core plot, and leaves favorite Whedon beats (including “leaf on the wind” and the final fight) alone unless they break tone after horror.

## Motivation

Built for an audience that wants the Firefly movie without Reaver shock cuts. Director notes: don’t trim liked one-liners unless they break tone after horror (the batteries beat is the main dialog cut); no reorder — linear theatrical flow. Haven and Maidenhead need picture/waveform QC because subs miss silent gore.

## Changes

- Opening: Reaver attack on screen (gore only) (~95s–185s). · [play 95–185](?t=95&end=185)
- Whole Kaylee/Jayne “nethers / batteries” beat removed (~1870s–1919s). · [play 1870–1919](?t=1870&end=1919)
- Haven massacre shortened to Mal’s reaction — bodies on posts / gore out (~3055s–3320s). · [play 3055–3320](?t=3055&end=3320)
- Maidenhead: reaver-gore inserts only; martial arts fight kept (~3780s–3865s). · [play 3780–3865](?t=3780&end=3865)
- Lab: reaver specimen / gore visuals trimmed (~5280s–5385s). · [play 5280–5385](?t=5280&end=5385)
- Mr. Universe reaver horror reduced (~5580s–5680s). · [play 5580–5680](?t=5580&end=5680)
- Reaver fleet / corpse shock beats trimmed (~5850s–5920s). · [play 5850–5920](?t=5850&end=5920)
- “Leaf on the wind” and final Operative / Serenity fight **kept**.
- Opening: Reaver attack on screen (gore only)
- Whole Kaylee/Jayne batteries beat; batteries beat (cont.); batteries beat (cont.)
- Haven: bodies on posts — trim to Mal reaction (~2:05); Haven: extend trim if posts still visible
- Maidenhead: reaver-gore inserts only (keep martial arts)
- Lab: reaver specimen / gore visuals
- Mr. Universe reaver horror (reduce)
- Reaver fleet / corpse shock beats


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
