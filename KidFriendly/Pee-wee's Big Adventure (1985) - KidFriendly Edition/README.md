# Pee-wee's Big Adventure (1985) — KidFriendly Edition

Toddler-safe cut (~3 years): Francis breakfast/pool/basement removed; **Francis premiere kept**. No clown close-ups, Large Marge, Simone diner, T-rex dream, Andy, train, Lloyd rodeo, basement conspiracy, biker death threats, WB nightmare, or Twisted Sister hell song. Keeps Mickey, full Alamo tour, Simone bus goodbye, Tequila dance, Santa/Godzilla gags, and the happy ending.

## Motivation

Age ~3: no frightening imagery (clown close-ups, Large Marge, Andy giant, T-rex dream, WB nightmare, hell song), no early Francis bad manners or paranoid basement rant. Bike theft stays (clown CUs trimmed manually). Joy stays — house, bike, Dottie, Mickey, Alamo, Simone bus goodbye, Tequila, studio chase, Francis premiere, happy end.

## Changes

- **Francis:** breakfast, pool, and basement removed; **premiere confrontation kept**
- **Bike theft:** kept; clown close-ups trimmed manually in Kdenlive
- **Large Marge** through **Jack train** removed; **wipe** into Alamo welcome
- **Simone diner / sunrise / Paris** removed; **bus-station goodbye kept**
- **Andy bus-station + Lloyd rodeo** removed; amnesia beat kept
- **Biker bar:** death-threat chants trimmed; Tequila dance kept
- **WB nightmare** removed with **fade to black** into Kevin Morton presentation
- **Studio chase:** only *Burn in Hell* (~10 s) trimmed; Santa + Godzilla kept
- **Mickey** hitchhiker ride kept

## Source media (not in git)

`N:\Videos\Kids Movies\Pee-Wees Big Adventure (1985) 1080p\Pee-wee's.Big.Adventure.1985.1080p.BluRay.x264-[YTS.AG].mp4`

Subtitles: copy Blu-ray `.srt` from the same folder into this project before building.

Kdenlive path: `/Kids Movies/Pee-Wees Big Adventure (1985) 1080p/Pee-wee's.Big.Adventure.1985.1080p.BluRay.x264-[YTS.AG].mp4`

## Build

```powershell
cd "N:\Videos\FanEdits\KidFriendly\Pee-wee's Big Adventure (1985) - KidFriendly Edition"
python build_remove_ranges.py
bash generate-pee-wee.sh "N:\Videos\Kids Movies\Pee-Wees Big Adventure (1985) 1080p\Pee-wee's.Big.Adventure.1985.1080p.BluRay.x264-[YTS.AG].mp4"
```

Open the `.kdenlive` in Kdenlive. **QC:** trim clown close-ups in the theft scene (~18:28–19:26); spot-check Alamo wipe, biker→WB fade, and hell-song trim.

## Render

```powershell
python render_final_mkv.py
```

Output: render locally to `C:\Videos\FanEditRender\`, then place final file here:

**`N:\Videos\FanEdits\KidFriendly\Pee-wee's Big Adventure (1985) - KidFriendly Edition\Pee-wee's Big Adventure (1985) - KidFriendly Edition.mkv`**

(1080p HEVC, AAC stereo, English subs in MKV + sidecar `.srt`)

## Changelog

- 2026-05-24 — Plan confirmed; cut list and build pipeline added.
- 2026-05-25 — Join/transition fixes; Francis premiere restored; re-rendered MKV.
