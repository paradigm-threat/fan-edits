# Boogie Nights (1997) — No Lookout

## Changes

Removes from PTA’s **whip-pan** out of Reed’s demo-tape office (**1:45:56**) through On the Lookout, the Valley night drive, and the **donut-shop stick-up/kill**, landing on the first fully **black** frame at **2:05:19**. The original black hold and fade-up into the Rahad-planning scene stay.

Strategy and QC: [PLAN.md](PLAN.md).

## Source media (not in git)

NAS (owner rip):

`/share/Public/Videos/General Movies/Boogie Nights (1997)/Boogie Nights 1997 1080p BluRay x264 AAC - Ozlem.mkv`

Stage locally:

`/media/ari/HD/FanEditRender/Boogie Nights (1997)/`

## Build

```bash
bash "FanMixes/Boogie Nights (1997) - No Lookout/generate-lookout.sh" \
  "/media/ari/HD/FanEditRender/Boogie Nights (1997)/Boogie Nights 1997 1080p BluRay x264 AAC - Ozlem.mkv"
```

Sparse kept-runs. No `--snap`.

## Seam preview (do this before a full encode)

```bash
python3 "FanMixes/Boogie Nights (1997) - No Lookout/render_final_mkv.py" \
  --video "/media/ari/HD/FanEditRender/Boogie Nights (1997)/Boogie Nights 1997 1080p BluRay x264 AAC - Ozlem.mkv" \
  --preview-only
```

Writes `seam-01-preview.mp4` (fadeblack 0.50 s + audio crossfade).

## Render

```bash
python3 "FanMixes/Boogie Nights (1997) - No Lookout/render_final_mkv.py" \
  --video "/media/ari/HD/FanEditRender/Boogie Nights (1997)/Boogie Nights 1997 1080p BluRay x264 AAC - Ozlem.mkv" \
  --out "/media/ari/HD/FanEditRender/Boogie Nights (1997) - No Lookout/Boogie Nights (1997) - No Lookout - final.mkv"
```

libx265 CRF 23, stereo AAC, English shifted SRT muxed default.

## Sync back to server

Copy the **project folder** to NAS FanEdits — **exclude** the original Ozlem rip. Then:

```bash
bash scripts/ensure-public-permissions.sh "FanMixes/Boogie Nights (1997) - No Lookout"
```

## Changelog

- 2026-09-06 — Extended in-point to **2:05:19.000** (first black frame) so the donut-shop stick-up/kill is gone; resume on original black hold.
- 2026-09-06 — Initial cut: 6356.100–7328.154 s, scene-snapped, 0.50 s fadeblack join.
- 2026-09-07 — Re-encoded **libx265 CRF 23** (was libx264 CRF 18); replaced local + NAS finals.
