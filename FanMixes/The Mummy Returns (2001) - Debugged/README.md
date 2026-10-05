# The Mummy Returns (2001) — Debugged

Kid-friendlier cut to match *The Mummy (1999) - Debugged*. This film has no SRT-named scarab dump; v1 removes the **pygmy swarm** that kills the expedition (same “little creatures eating people” beat). Confirm in [PLAN.md](PLAN.md).

## Motivation

Match the 1999 Debugged rule: no little creatures eating people on screen. The 1999 flesh-eating beetle dump is not repeated as a set piece here; the closest analogue is the **pygmy swarm** that overruns the expedition. Izzy later jokes about “mummies, pygmies, big bugs.” Scorpion King prologue, Anubis warriors, and the finale stay for v1.

## Changes

- First pygmy overrun after “Where’s the boy?” through snarling/screaming camp attack (resume “The black book!”)
- Later pygmy eat/chase beat (yelling/snarling/gunfire) before “Let’s go / Thank God for that”
- Credits / extra music beds use metal covers of *Zombies Ate My Neighbors* cues (see Extra audio)

## Extra audio

Metal covers by **Larme Genie**, from *[Zombies Ate My Neighbors (The Metal Album)](https://music.youtube.com/playlist?list=OLAK5uy_mBWB5DWMPQXWO_uNHUJW4C47nFHuD97j00)* (2023). Original SNES score is Konami / *Zombies Ate My Neighbors*.

Cues in `music/` (on the timeline):

- *Pyramid of Fear (Metal Version)*
- *Zombie Panic (Metal Version)*
- *Evening of the Undead (Metal Version)*

## Source media (not in git)

Local rip (Kdenlive):

`/home/ari/Videos/The Mummy Returns (2001) [2160p] [4K] [BluRay] [5.1] [YTS.MX]/The.Mummy.Returns.2001.2160p.4K.BluRay.x265.10bit.AAC5.1-[YTS.MX].mkv`

English text subs (source times): `The Mummy Returns Debugged.srt` — yts-subs **490472**. Output-timeline dialogue: `The Mummy Returns Debugged.kdenlive.srt`.

**Two muxed tracks (2026-09-23):**

- Default: `The Mummy Returns Debugged.english.srt` — dialogue only (Silvestri / Avengers cards removed).
- Enhanced: `The Mummy Returns Debugged.enhanced.srt` — dialogue plus score/citations; second Avengers card ends before `Let go!`.

```bash
python3 scripts/remux_subtitles.py \
  --video "FanMixes/The Mummy Returns (2001) - Debugged/The Mummy Returns Debugged.mkv" \
  --subs "FanMixes/The Mummy Returns (2001) - Debugged/The Mummy Returns Debugged.english.srt" \
  --subs-enhanced "FanMixes/The Mummy Returns (2001) - Debugged/The Mummy Returns Debugged.enhanced.srt" \
  --out "FanMixes/The Mummy Returns (2001) - Debugged/The Mummy Returns Debugged.mkv"
```

## Blank project

Cloned from [The Mummy Debugged.kdenlive](../The%20Mummy%20%281999%29%20-%20Debugged/The%20Mummy%20Debugged.kdenlive) via `scripts/clone_kdenlive_blank.py` (do not hand-author `.kdenlive` XML).

```bash
python3 scripts/clone_kdenlive_blank.py \
  --video "/home/ari/Videos/The Mummy Returns (2001) [2160p] [4K] [BluRay] [5.1] [YTS.MX]/The.Mummy.Returns.2001.2160p.4K.BluRay.x265.10bit.AAC5.1-[YTS.MX].mkv" \
  --out "FanMixes/The Mummy Returns (2001) - Debugged/The Mummy Returns Debugged.kdenlive" \
  --srt "FanMixes/The Mummy Returns (2001) - Debugged/The Mummy Returns Debugged.srt"
```

## Build (after cuts)

```bash
bash "FanMixes/The Mummy Returns (2001) - Debugged/generate-mummy-returns-debugged.sh"
```

No `--snap`. QC silent kills and any beetle inserts the SRT missed.

```bash
python3 scripts/check_kdenlive_sync.py \
  --project "FanMixes/The Mummy Returns (2001) - Debugged"
```

## Render

Copy the rip to local disk first, then:

```bash
python3 "FanMixes/The Mummy Returns (2001) - Debugged/render_final_mkv.py" \
  --video "/media/ari/HD/FanEditRender/The Mummy Returns (2001)/The.Mummy.Returns.2001.2160p.4K.BluRay.x265.10bit.AAC5.1-[YTS.MX].mkv" \
  --out "/media/ari/HD/FanEditRender/The Mummy Returns (2001) - Debugged/The Mummy Returns (2001) - Debugged - final.mkv"
```

## Sync back to server

```bash
bash scripts/ensure-public-permissions.sh "FanMixes/The Mummy Returns (2001) - Debugged"
```

## Changelog

- 2026-09-27 — `seams.mkv` rebuilt from the finished NAS render (output join times + credits from 01:53), not the 4K rip.
- 2026-09-26 — QC reel is `seams.mkv` (joins + credits from 01:53). Not the feature.
- 2026-09-26 — Credited Larme Genie metal ZAMN covers in `music/`.
- 2026-09-25 — Proxy was +1 frame vs the 4K HEVC (same as Mummy 1). See PLAN.md.
- 2026-09-23 — Dual English tracks; Silvestri/Avengers off default.
- 2026-09-19 — Replaced wrong SRT (yify-116022, ~2s early) with 490472 matched to embedded eng softsub.
- 2026-09-19 — Blank cloned from Mummy Debugged; 4K YTS path + embedded SRT.
- 2026-09-19 — Project created; pygmy-swarm cut list from SRT.
