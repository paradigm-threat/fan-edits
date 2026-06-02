# Cinderella (1950) — KidFriendly Edition

Toddler-safe cut (~3 years): removes meanness, scary cat-vs-mouse violence, dress destruction, attic imprisonment, and the Bruno dream line about chasing cats.

## Changes

- Cut father’s death and “cold, cruel” stepmother setup narration
- Cut Lucifer bullying mice and Bruno “dreaming/chasing Lucifer” dialogue
- Cut breakfast/morning abuse and music-lesson cruelty
- Cut “I said *if*” ball manipulation
- Cut chore-punishment rant and **entire dress-ripping / sobbing** sequence (joins to Fairy Godmother)
- Shorten midnight guard chase
- Cut attic lockup and Lucifer blocking the mice

**Kept:** opening titles, “A Dream Is a Wish Your Heart Makes,” friendly mice/birds, royal ball invitation, mice making the dress, Fairy Godmother, ball, love story, slipper ending.

## Source media (not in git)

Place your rip at:

`N:\Videos\Anime\Cinderella (1950) [2160p] [4K] [BluRay] [5.1] [YTS.MX]\Cinderella.1950.2160p.4K.BluRay.x265.10bit.AAC5.1-[YTS.MX].mkv`

Kdenlive path: `/Anime/Cinderella (1950) [2160p] [4K] [BluRay] [5.1] [YTS.MX]/Cinderella.1950.2160p.4K.BluRay.x265.10bit.AAC5.1-[YTS.MX].mkv`

## Build

```powershell
cd "N:\Videos\FanEdits\KidFriendly\Cinderella (1950) - KidFriendly Edition"
python build_remove_ranges.py
bash generate-cinderella.sh "N:\Videos\Anime\Cinderella (1950) [2160p] [4K] [BluRay] [5.1] [YTS.MX]\Cinderella.1950.2160p.4K.BluRay.x265.10bit.AAC5.1-[YTS.MX].mkv"
```

Open the `.kdenlive` in Kdenlive and spot-check joins (especially dress → Fairy Godmother and post–ball invitation).

## Render

Copy the source rip from NAS to **local disk** before encoding ([docs/LLM-FAN-EDIT-INSTRUCTIONS.md](../../docs/LLM-FAN-EDIT-INSTRUCTIONS.md) §5 Phase F).

```powershell
$nas = 'N:\Videos\Anime\Cinderella (1950) [2160p] [4K] [BluRay] [5.1] [YTS.MX]\Cinderella.1950.2160p.4K.BluRay.x265.10bit.AAC5.1-[YTS.MX].mkv'
$localDir = 'C:\Videos\FanEditRender'
$local = Join-Path $localDir ([System.IO.Path]::GetFileName($nas))
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
robocopy (Split-Path -LiteralPath $nas -Parent) $localDir ([System.IO.Path]::GetFileName($nas)) /Z /J
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $local

cd "N:\Videos\FanEdits\KidFriendly\Cinderella (1950) - KidFriendly Edition"
python render_final_mkv.py --video $local --out (Join-Path $localDir 'Cinderella (1950) - KidFriendly Edition.mkv')
```

Output: `C:\Videos\FanEditRender\Cinderella (1950) - KidFriendly Edition.mkv` (2160p HEVC 10-bit, AAC stereo, English shifted subs). Copy back to NAS after render if desired.

## Changelog

- 2026-05-24 — Initial project and automated timeline.
- 2026-05-25 — Final MKV rendered from local copy (~50 min, 2160p HEVC 10-bit, shifted English subs).
