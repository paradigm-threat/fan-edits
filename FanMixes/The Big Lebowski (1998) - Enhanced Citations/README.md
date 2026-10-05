# The Big Lebowski (1998) — Enhanced Citations

Follow-up to [The Mummy (1999) - Debugged](../The%20Mummy%20%281999%29%20-%20Debugged/) and Paradigm Threat [AU-062](https://paradigmthreat.net/influence/eugene/investigations/occult-icons-mountain-of-heaven-glitch-investigation.md).

**Not a picture cut.** Theatrical film stays intact. Work is a second English subtitle track.

## Motivation

Gutterballs locks the same public Mountain of Heaven silhouette as the Mummy 1999 sun-on-peak. Official Coen cover (dream mash / Busby Berkeley homage) is not the payload; the enhanced track carries the AU-062 author reading — shared history including the Asgard–Viking lock — plus later sibling locks in the credits. NSA hide (no lecture).

## Changes

- Second English track: dialogue plus beat-locked notes; AU-062 overflow in the credits
- Default track stays theatrical dialogue only
- Gutterballs (shoe-rack-to-moon / Valkyrie): L1 Berkeley homage card; author / L3 Mountain of Heaven + Asgard–Viking cards; CIA-lock contrast (*Stargate*, *2001*)
- Credits conversation: *Fifth Element* (NSA / paradise), *Mission to Mars* (they’re us), *Mummy Returns* (twelve tribes / no bad Arabs), *2001* (CIA / nothing unifying)

## Tracks

Sidecars live in `subs/` so players do not auto-load them beside the MKV.

| File | Role |
|------|------|
| `subs/The Big Lebowski.english.srt` | **Default** — theatrical dialogue only |
| `subs/The Big Lebowski.enhanced.srt` | **English (citations)** — dialogue plus beat-locked notes; AU-062 overflow in the credits |

## Mux

```bash
python3 scripts/remux_subtitles.py \
  --video "/media/ari/HD/FanEditRender/The Big Lebowski (1998)/The Big Lebowski (1998) - Enhanced Citations.mkv" \
  --subs "FanMixes/The Big Lebowski (1998) - Enhanced Citations/subs/The Big Lebowski.english.srt" \
  --subs-enhanced "FanMixes/The Big Lebowski (1998) - Enhanced Citations/subs/The Big Lebowski.enhanced.srt" \
  --title-default "English" \
  --out "/media/ari/HD/FanEditRender/The Big Lebowski (1998)/The Big Lebowski (1998) - Enhanced Citations.mkv"
```

## Changelog

- 2026-09-24 — Theatrical English + enhanced tracks imported from the existing dual-track MKV; AU-062 author cards on Gutterballs + credits.
- 2026-09-23 — Folder created after the Mummy Debugged dual-track pass.
