# The Big Lebowski (1998) — Enhanced Citations

Follow-up to [The Mummy (1999) - Debugged](../The%20Mummy%20%281999%29%20-%20Debugged/) and Paradigm Threat [AU-062](https://paradigmthreat.net/influence/hollywood/investigations/occult-icons-mountain-of-heaven-glitch-investigation.md).

**Not a picture cut.** Theatrical film stays intact. Work is a second English subtitle track.

## Tracks

Sidecars live in `subs/` so players do not auto-load them beside the MKV.

| File | Role |
|------|------|
| `subs/The Big Lebowski.english.srt` | **Default** — theatrical dialogue only |
| `subs/The Big Lebowski.enhanced.srt` | **English (citations)** — dialogue plus beat-locked notes; AU-062 overflow in the credits |

## Gutterballs

Picture-locked cards on the shoe-rack-to-moon / Valkyrie number.

**L1 (official Coen cover):** dreams mash leftovers; homage to 1930s Busby Berkeley.

**Author / L3:** neither is the payload. Same public Mountain of Heaven silhouette as the Mummy 1999 sun-on-peak. Shared history, including the Asgard–Viking lock — universal, not a phallic gag. NSA hide (no lecture). CIA titles (*Stargate*, *2001*) use the same silhouette as a lock you are not meant to share.

Credits also carry the later AU-062 locks: *Fifth Element* (NSA / paradise), *Mission to Mars* (they’re us), *Mummy Returns* (twelve tribes / no bad Arabs), *2001* (CIA / nothing unifying).

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
