# Plan: *The Big Lebowski* enhanced SRT

Theatrical English SRT is in `subs/`. Enhanced cards are in.

## Done this pass (2026-09-24)

1. Imported dual tracks from the existing Enhanced Citations MKV.
2. Gutterballs: L1 Berkeley card; `[Edit:]` shoe-rack MoH; author Asgard/Mars card; CIA-lock contrast (*Stargate*, *2001*). ≥0.4s pad.
3. Credits conversation: *Fifth Element*, *Mission to Mars*, *Mummy Returns*, *2001*.
4. Remux with `scripts/remux_subtitles.py --subs … --subs-enhanced …` — no re-encode.

## Not in this pass

- Picture cuts.
- Invented cue times without a source SRT.
