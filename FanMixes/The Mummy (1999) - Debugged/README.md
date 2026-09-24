# The Mummy (1999) — Debugged

Kid-friendlier cut: **scarabs that kill or eat people** are removed. Adventure, Imhotep, and the later plagues stay. Not a full wipe of every gunfight.

**Why cuts:** usually **violence**. Sometimes **unrealism** — Jonathan’s scarab/arm beat is out because a dirty-knife wound vanishes in the next shot. Details: [PLAN.md](PLAN.md), [INVESTIGATION.md](INVESTIGATION.md).

**Canonical Kdenlive blank:** `The Mummy Debugged.kdenlive` is the known-good full-timeline project format for new FanMixes. Clone it with `scripts/clone_kdenlive_blank.py` — do not invent `.kdenlive` XML from scratch (those files often fail to open).

## Changes

- Hom-Dai: no live beetles eating Imhotep
- No camp “ate him alive” / Hom-Dai / 10-plagues lecture (cut 2026-09-23)
- No Hamunaptra scarab swarm / corridor chase
- No Cairo scene of Imhotep finishing Burns with scarabs
- No Jonathan arm-reset (scarab + knife, then uninjured)

## Subtitles (two English tracks)

Sidecars live in `subs/` so players do not auto-load them beside the MKV.

| File | Role |
|------|------|
| `The Mummy Debugged.kdenlive.srt` | Output-timeline dialogue (Kdenlive). Same text as default. |
| `subs/The Mummy Debugged.english.srt` | **Default** mux — dialogue only. |
| `subs/The Mummy Debugged.enhanced.srt` | **English (citations)** — dialogue plus beat-locked notes; conclusions overflow into the credits. |
| `subs/The Mummy Debugged.srt` | Uncut YTS 119140 (source times). Do not mux. |

Citations never go on the default track. Same rule on *The Mummy Returns*: Silvestri / Avengers lines are enhanced-only.

Paradigm Threat cross-link: [AU-062 Mountain of Heaven](https://paradigmthreat.net/influence/hollywood/investigations/occult-icons-mountain-of-heaven-glitch-investigation.md) (opening sun-on-peak).

After a new encode (or to swap subs only):

```bash
python3 scripts/remux_subtitles.py \
  --video "FanMixes/The Mummy (1999) - Debugged/The Mummy Debugged.mkv" \
  --subs "FanMixes/The Mummy (1999) - Debugged/subs/The Mummy Debugged.english.srt" \
  --subs-enhanced "FanMixes/The Mummy (1999) - Debugged/subs/The Mummy Debugged.enhanced.srt" \
  --out "FanMixes/The Mummy (1999) - Debugged/The Mummy Debugged.mkv"
```

Current `The Mummy Debugged.mkv` is the **2026-09-23** kdenlive render (`01:55:29`, tractor1). Dual English tracks remuxed after encode. The 2026-09-19 file was ~60s longer (flesh-eater lecture still in).

## Source media (not in git)

Local rip (Kdenlive):

`/home/ari/Videos/The Mummy (1999) [2160p] [4K] [BluRay] [5.1] [YTS.MX]/The.Mummy.1999.2160p.4K.BluRay.x265.10bit.AAC5.1-[YTS.MX].mkv`

Import from `subs/` via Project → Subtitles when editing.

## Build

```bash
bash "FanMixes/The Mummy (1999) - Debugged/generate-mummy-debugged.sh"
```

Sparse kept-runs. No `--snap`. QC every join in Kdenlive (silent beetle shots). Video master is **playlist4**, not playlist2 (audio split).

## Render

Copy the rip to local disk first, then:

```bash
python3 "FanMixes/The Mummy (1999) - Debugged/render_final_mkv.py" \
  --video "/media/ari/HD/FanEditRender/The Mummy (1999)/The.Mummy.1999.2160p.4K.BluRay.x265.10bit.AAC5.1-[YTS.MX].mkv" \
  --out "/media/ari/HD/FanEditRender/The Mummy (1999) - Debugged/The Mummy (1999) - Debugged - final.mkv"
```

Muxes `subs/The Mummy Debugged.english.srt` (default) and `subs/The Mummy Debugged.enhanced.srt` (citations) when present.

## Sync back to server

Copy the **project folder** to `Videos/FanEdits/FanMixes/…` — **exclude** the library rip. Then:

```bash
bash scripts/ensure-public-permissions.sh "FanMixes/The Mummy (1999) - Debugged"
```

## Changelog

- 2026-09-24 — Credits: Returns NSA lock / hangman contrast; Fifth Element vs 2001 pin.
- 2026-09-23 — Re-render 01:55:29 (flesh-eater + Jonathan in); dual English remuxed; NAS sync.
- 2026-09-23 — Dual English tracks written; flesh-eater lecture + Jonathan arm cuts; INVESTIGATION.md.
- 2026-09-19 — Documented as canonical blank for `clone_kdenlive_blank.py`.
- 2026-09-19 — Project created; scarab cut list from SRT.
