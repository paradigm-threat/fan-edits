# Bambi (1942) — KidFriendly Edition

Toddler-safe cut (~3 years): removes hunting scares, mother's death, Ronno fight, forest fire, and wounded climax; keeps friends, meadow joy, winter play, romance, and twin-fawns ending.

## Changes

- Cut first meadow stampede and "Man was in the forest" (join to snow)
- Cut winter hunger, thicket hunt, and mother's death (join to spring song)
- Cut Ronno antler fight (join to love song)
- Cut second Man, dogs, fire, and wounded recovery (join to twin fawns ending)
- **Kept:** birth, Thumper/Flower, bird wordplay, April shower, meadow, ice play, twitterpated, Faline, love song, ending reprise

## Source media (not in git)

Place your rip at:

`N:\Videos\Kids Movies\Bambi (1942)\Bambi.1942.720p.BRrip.x264.GAZ.YIFY.mp4`

Kdenlive path: `/Kids Movies/Bambi (1942)/Bambi.1942.720p.BRrip.x264.GAZ.YIFY.mp4`

## Build

```powershell
cd "N:\Videos\FanEdits\KidFriendly\Bambi (1942) - KidFriendly Edition"
python build_remove_ranges.py
bash generate-bambi.sh "N:\Videos\Kids Movies\Bambi (1942)\Bambi.1942.720p.BRrip.x264.GAZ.YIFY.mp4"
```

Open the `.kdenlive` in Kdenlive and spot-check joins (meadow→snow, winter→spring, Ronno→song, love song→twins).

## Render

Copy source to `C:\Videos\FanEditRender\` then:

```powershell
python render_final_mkv.py --video C:\Videos\FanEditRender\Bambi.1942.720p.BRrip.x264.GAZ.YIFY.mp4 --out "C:\Videos\FanEditRender\Bambi (1942) - KidFriendly Edition\Bambi (1942) - KidFriendly Edition.mkv"
```

If subs drift after a re-cut, regenerate from **playlist2** (not removal math alone):

```powershell
python ..\..\scripts\regenerate_shifted_from_kdenlive.py --kdenlive "Bambi (1942) - KidFriendly Edition.kdenlive"
python ..\..\scripts\remux_subtitles.py --video "Bambi (1942) - KidFriendly Edition.mkv" --subs "Bambi (1942) - KidFriendly Edition.kdenlive.shifted.srt" --out "Bambi (1942) - KidFriendly Edition.mkv"
```

Output: 720p HEVC, AAC stereo, English shifted subs (must match `.kdenlive` playlist2).

## Changelog

- 2026-05-24 — Initial project and automated timeline.
- 2026-05-25 — Fixed subtitle sync (playlist2-based shift); remuxed MKV. Source SRT must be UTF-8.
