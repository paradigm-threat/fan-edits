# Honey, I Shrunk the Kids (1989) — KidFriendly Edition

Toddler-safe cut (~3 years): keeps the backyard adventure, friendly Antie, and family reunion; removes insect attacks, Antie’s death, lawnmower terror, sprinkler drowning, and near-miss kitchen scares.

## Changes

- Cut neighbor violence threats (“break his arm,” “gonna kill you”)
- Cut second shrink-ray blast and garbage-bag panic
- Cut cat/pollen panic and bee attack
- Cut sprinkler drowning sequence
- Cut ant swarm fight on the cookie (befriending Antie kept)
- Cut giant Quark slobber scare
- Cut scorpion attack, Antie’s death, funeral, and entire lawnmower chase (fade join to Quark rescue)
- Cut Nick nearly swallowed in Cheerios
- Cut dinner line referencing the scorpion

**Kept:** Shrink discovery, backyard journey, giant cookie wonder, befriending and riding Antie, bee ride, Lego camp, Quark ride into the house, machine repair, family reunion, happy ending.

## Source media (not in git)

`N:\Videos\Kids Movies\Honey I Shrunk the Kids (1989)\Honey.I.Shrunk.the.Kids.1989.720p.BluRay.X264.850MB-Mkvking.mkv`

Kdenlive path: `/Kids Movies/Honey I Shrunk the Kids (1989)/Honey.I.Shrunk.the.Kids.1989.720p.BluRay.X264.850MB-Mkvking.mkv`

## Build

```powershell
cd "N:\Videos\FanEdits\KidFriendly\Honey I Shrunk the Kids (1989) - KidFriendly Edition"
bash generate-honey.sh "N:\Videos\Kids Movies\Honey I Shrunk the Kids (1989)\Honey.I.Shrunk.the.Kids.1989.720p.BluRay.X264.850MB-Mkvking.mkv"
```

Timeline is **12 kept blocks** (cuts only at removal boundaries — not every subtitle). Open `.kdenlive` in Kdenlive and spot-check joins, especially the **fade-to-black** at Lego camp → Quark rescue (block 9).

## Render

Copy the source rip from NAS to **local disk** before encoding ([docs/LLM-FAN-EDIT-INSTRUCTIONS.md](../../docs/LLM-FAN-EDIT-INSTRUCTIONS.md) §5 Phase F).

```powershell
$nas = 'N:\Videos\Kids Movies\Honey I Shrunk the Kids (1989)\Honey.I.Shrunk.the.Kids.1989.720p.BluRay.X264.850MB-Mkvking.mkv'
$localDir = 'C:\Videos\FanEditRender'
$local = Join-Path $localDir ([System.IO.Path]::GetFileName($nas))
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
Copy-Item -LiteralPath $nas -Destination $local -Force
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $local

cd "N:\Videos\FanEdits\KidFriendly\Honey I Shrunk the Kids (1989) - KidFriendly Edition"
python render_final_mkv.py --video $local --ranges-json (Join-Path $PWD 'remove-honey-kidfriendly-ranges.json') --out (Join-Path $localDir 'Honey I Shrunk the Kids (1989) - KidFriendly Edition.mkv')
```

Output: 720p HEVC (8-bit), AAC stereo, English shifted subs.

## Changelog

- 2026-06-06 — Initial project and cut list.
- 2026-06-07 — 12 cut-block timeline; `fade_black` on block 9; transition-aware render script.
- 2026-06-07 — Final MKV rendered from local copy (~67 min, 720p HEVC, shifted English subs).
