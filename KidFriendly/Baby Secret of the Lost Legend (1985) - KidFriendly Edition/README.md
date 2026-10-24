# Baby: Secret of the Lost Legend (1985) — KidFriendly Edition

Toddler-safe cut (~3 years): keeps the dinosaur wonder and Baby’s playful scenes; removes illness/death, guns, capture, dying parents, battles, and adult cringe.

## Changes

- Cut cholera/death exposition and dying-village beats
- Cut profanity, marital bedroom scene, and crude pilot dialogue
- Cut spooky jungle night screams and military camp (gunfire, dancers)
- Cut tranquilizer capture, mother shot, father dying, and gunfights
- Cut wasp-sting pain beat
- Cut helicopter/prison/cave/battle climax (large fade join to reunion)
- Cut trailing OpenSubtitles card

**Kept:** Africa opening, bone mystery, river journey, pygmy fun, brontosaur discovery, befriending Baby, gentle care on the trail, mother–baby reunion, happy farewell.

## Source media (not in git)

`N:\Videos\Kids Movies\Baby Secret Of The Lost Legend (1985)\Baby.Secret.Of.The.Lost.Legend.1985.1080p.BluRay.x264-[YTS.AG].mp4`

Kdenlive path: `/Kids Movies/Baby Secret Of The Lost Legend (1985)/Baby.Secret.Of.The.Lost.Legend.1985.1080p.BluRay.x264-[YTS.AG].mp4`

## Build

```powershell
cd "N:\Videos\FanEdits\KidFriendly\Baby Secret of the Lost Legend (1985) - KidFriendly Edition"
bash generate-baby.sh "N:\Videos\Kids Movies\Baby Secret Of The Lost Legend (1985)\Baby.Secret.Of.The.Lost.Legend.1985.1080p.BluRay.x264-[YTS.AG].mp4"
```

Open the `.kdenlive` in Kdenlive and spot-check joins (especially journey → reunion and post-discovery → care-for-Baby).

## Render

Copy the source rip from NAS to **local disk** before encoding ([docs/LLM-FAN-EDIT-INSTRUCTIONS.md](../../docs/LLM-FAN-EDIT-INSTRUCTIONS.md) §5 Phase F).

```powershell
$nas = 'N:\Videos\Kids Movies\Baby Secret Of The Lost Legend (1985)\Baby.Secret.Of.The.Lost.Legend.1985.1080p.BluRay.x264-[YTS.AG].mp4'
$localDir = 'C:\Videos\FanEditRender'
$local = Join-Path $localDir ([System.IO.Path]::GetFileName($nas))
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
Copy-Item -LiteralPath $nas -Destination $local -Force
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $local

cd "N:\Videos\FanEdits\KidFriendly\Baby Secret of the Lost Legend (1985) - KidFriendly Edition"
python render_final_mkv.py --video $local --out (Join-Path $localDir 'Baby Secret of the Lost Legend (1985) - KidFriendly Edition.mkv')
```

Output: 1080p HEVC (8-bit), AAC stereo, English shifted subs.

## Changelog

- 2026-06-06 — Initial project and cut list.
- 2026-06-07 — Final MKV rendered from local copy (~30 min, 1280×544 HEVC, AAC stereo, shifted English subs).
