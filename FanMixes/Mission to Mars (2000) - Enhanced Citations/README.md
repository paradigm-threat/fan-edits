# Mission to Mars (2000) — Enhanced Citations

Paradigm Threat [AU-062](https://paradigmthreat.net/influence/hollywood/investigations/occult-icons-mountain-of-heaven-glitch-investigation.md) §8.1a / §7.1.

**Not a picture cut.** Theatrical film stays intact. Work is a second English subtitle track.

Source (nobiserv): `Videos/Horror and SciFi/Mission to Mars (2000) {1080p]/` — YIFY 1080p. Remuxed **MP4 → MKV**. Sidecar `.srt` stays in `subs/` so players do not auto-load it beside the MKV.

## Tracks

| File | Role |
|------|------|
| `subs/Mission to Mars.english.srt` | **Default** — theatrical YIFY dialogue only (encoder bumper stripped on the enhanced pass) |
| `subs/Mission to Mars.enhanced.srt` | **English (citations)** — dialogue plus verbose AU-062 cards in gaps; credits conversation |

## Hologram (AU-062)

Crew never says “asteroid” or “wrecked.” They say *“It’s Mars.”* / *“That’s where they went.”* / *“One stayed behind. Earth, before the continents separated.”* / *“They seeded Earth.”* / *“They’re us. We’re them.”*

**Water-world:** hologram **before** = 1984 RV **before-catastrophe** (MON: *“go back to the time before the geologic problem”*). Same description class. Transcript does not say ocean.

**Clock A:** continents line = 3147 first deluge / Atlantis fall / first split. Earth stayed; Mars became breakaway.

**Clock B:** Cambrian / millions of years = seed mask. Did not collapse them.

**Picture:** collision cartoon. 686 BCE outer shell **becomes** the asteroid belt — Hollywood inverts the rock.

**Window:** *ID4* (1996) → *Fifth Element* (1997) → *Lebowski* (1998) → *Mummy* open (1999) → this film (10 Mar 2000) → Mars RV stamp **2000-08-08**.

Cards sit in gaps only. ≥0.4s pad from dialogue. Rebuild: `python3 build_enhanced.py`.

## Mux

```bash
python3 scripts/remux_subtitles.py \
  --video "/run/user/1000/gvfs/smb-share:server=nobiserv.local,share=public/Videos/Horror and SciFi/Mission to Mars (2000) {1080p]/Mission.To.Mars.2000.1080p.BrRip.x264.YIFY.mp4" \
  --subs "FanMixes/Mission to Mars (2000) - Enhanced Citations/subs/Mission to Mars.english.srt" \
  --subs-enhanced "FanMixes/Mission to Mars (2000) - Enhanced Citations/subs/Mission to Mars.enhanced.srt" \
  --title-default "English" \
  --title-enhanced "English (citations)" \
  --out "/media/ari/HD/FanEditRender/Mission to Mars (2000)/Mission to Mars (2000) - Enhanced Citations.mkv"
```

Then copy that MKV onto nobiserv and delete the MP4.

## Changelog

- 2026-09-24 — YIFY English imported; 38 AU-062 cards (hologram + credits); MP4 remuxed to dual-track MKV.
