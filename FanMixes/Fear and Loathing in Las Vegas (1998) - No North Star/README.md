# Fear and Loathing in Las Vegas (1998) — No North Star

A single-scene cut that removes the North Star Coffee Lounge waitress/knife sequence and hard-cuts back to the Red Shark run to the airport.

## Motivation

Duke and Gonzo terrorizing the waitress (knife, “lemon meringue pie”) is a mean beat that doesn’t need depiction — the preceding narration already names the crime. Skipping the diner leaves the reflection intact and resumes cleanly on the convertible.

## Changes

- Removes the North Star Coffee Lounge scene (waitress, knife, “lemon meringue pie”) between the shot transition at **1:41:44** and the cut back to the Red Shark at **1:47:03**.
- Keeps Duke’s “massive crime often slips by unrecognized” line; next line is “It was all over now.”
- Picture hard-cut on the transition frames; 0.5 s audio fade-out/fade-in at the join (no overlapping acrossfade).
- North Star Coffee Lounge: neon establish through Gonzo terrorizing the waitress with a knife; resume at 'It was all over now' / convertible. Picture hard-cut; kdenlive volume fade 0.5 s.


## Source media (not in git)

NAS (owner rip):

`/share/Public/Videos/General Movies/Fear and Loathing in Las Vegas 1998/Fear and Loathing in Las Vegas 1998 1080p BluRay x264 AAC - Ozlem.mp4`

Stage a local copy before any ffmpeg work (HDD scratch, not NAS, not the system SSD):

`/media/ari/HD/FanEditRender/Fear and Loathing in Las Vegas (1998)/`

## Build

```bash
bash "FanMixes/Fear and Loathing in Las Vegas (1998) - No North Star/generate-north-star.sh" \
  "/media/ari/HD/FanEditRender/Fear and Loathing in Las Vegas (1998)/Fear and Loathing in Las Vegas 1998 1080p BluRay x264 AAC - Ozlem.mp4"
```

Sparse kept-runs (two playlist entries). No `--snap` — cuts are on detected scene frames; the final encode is frame-accurate.

## Seam preview (do this before a full encode)

```bash
python3 "FanMixes/Fear and Loathing in Las Vegas (1998) - No North Star/render_final_mkv.py" \
  --video "/media/ari/HD/FanEditRender/Fear and Loathing in Las Vegas (1998)/Fear and Loathing in Las Vegas 1998 1080p BluRay x264 AAC - Ozlem.mp4" \
  --preview-only
```

Writes `seam-01-preview.mp4` (hard picture cut + 0.5 s audio fade).

## Render

```bash
python3 "FanMixes/Fear and Loathing in Las Vegas (1998) - No North Star/render_final_mkv.py" \
  --video "/media/ari/HD/FanEditRender/Fear and Loathing in Las Vegas (1998)/Fear and Loathing in Las Vegas 1998 1080p BluRay x264 AAC - Ozlem.mp4" \
  --out "/media/ari/HD/FanEditRender/Fear and Loathing in Las Vegas (1998) - No North Star/Fear and Loathing in Las Vegas (1998) - No North Star - final.mkv"
```

libx265 CRF 23, stereo AAC, English shifted SRT muxed default. Picture is a hard cut; audio fades 0.5 s out/in at the join.

## Sync back to server

Copy the **project folder** to `Videos/FanEdits/FanMixes/…` — **exclude** the original Ozlem rip. Then:

```bash
bash scripts/ensure-public-permissions.sh "FanMixes/Fear and Loathing in Las Vegas (1998) - No North Star"
```

## Changelog

- 2026-09-06 — Initial cut: 6104.140–6423.208 s, scene-snapped, 0.40 s fade join.
- 2026-09-07 — Re-encoded **libx265 CRF 23** (was libx264 CRF 18); replaced local + NAS finals.
- 2026-09-12 — Hard cut on the transition frames (no picture dissolve / audio crossfade).
- 2026-09-12 — 0.5 s audio fade-out/fade-in at the join; picture stays a hard cut.
