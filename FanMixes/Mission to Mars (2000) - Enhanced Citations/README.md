# Mission to Mars (2000) — Enhanced Citations

Paradigm Threat [AU-062](https://paradigmthreat.net/influence/cayman/investigations/occult-icons-mountain-of-heaven-glitch-investigation.md) §8.1a / §7.1.

**Not a picture cut.** Theatrical film stays intact. Work is a second English subtitle track.

Source (nobiserv): `Videos/Horror and SciFi/Mission to Mars (2000) {1080p}/` — YIFY 1080p. Remuxed **MP4 → MKV**. Sidecar `.srt` stays in `subs/` so players do not auto-load it beside the MKV.

## Motivation

The theatrical dialogue never says “asteroid” or “wrecked.” The crew says *“It’s Mars.”* / *“That’s where they went.”* / *“One stayed behind. Earth, before the continents separated.”* / *“They seeded Earth.”* / *“They’re us. We’re them.”* Enhanced citations surface the AU-062 reading of that hologram and the film’s place in the late-90s / early-2000s window — without touching the picture.

## Changes

- Second English track: dialogue plus verbose AU-062 cards in gaps (≥0.4s pad); credits conversation
- Default track stays theatrical YIFY dialogue only (encoder bumper stripped on the enhanced pass)
- Hologram cards: water-world / 1984 RV before-catastrophe class; Clock A continents = 3147 first deluge; Clock B Cambrian seed mask; 686 BCE shell → asteroid-belt invert on the collision cartoon
- Credits cards: *ID4* → *Fifth Element* → *Lebowski* → *Mummy* open → this film (10 Mar 2000) → Mars RV stamp **2000-08-08**
- Rebuild: `python3 build_enhanced.py`

## Tracks

| File | Role |
|------|------|
| `subs/Mission to Mars.english.srt` | **Default** — theatrical YIFY dialogue only (encoder bumper stripped on the enhanced pass) |
| `subs/Mission to Mars.enhanced.srt` | **English (citations)** — dialogue plus verbose AU-062 cards in gaps; credits conversation |

## Mux

```bash
python3 scripts/remux_subtitles.py \
  --video "/run/user/1000/gvfs/smb-share:server=nobiserv.local,share=public/Videos/Horror and SciFi/Mission to Mars (2000) {1080p}/Mission.To.Mars.2000.1080p.BrRip.x264.YIFY.mp4" \
  --subs "FanMixes/Mission to Mars (2000) - Enhanced Citations/subs/Mission to Mars.english.srt" \
  --subs-enhanced "FanMixes/Mission to Mars (2000) - Enhanced Citations/subs/Mission to Mars.enhanced.srt" \
  --title-default "English" \
  --title-enhanced "English (citations)" \
  --out "/media/ari/HD/FanEditRender/Mission to Mars (2000)/Mission to Mars (2000) - Enhanced Citations.mkv"
```

Then copy that MKV onto nobiserv and delete the MP4.

## Changelog

- 2026-09-24 — YIFY English imported; 38 AU-062 cards (hologram + credits); MP4 remuxed to dual-track MKV.
