# Editorial plan: *Honey, I Shrunk the Kids* (1989) — KidFriendly Edition

Companion to [README.md](README.md) and [remove-honey-kidfriendly-ranges.json](remove-honey-kidfriendly-ranges.json).

## Goals (age ~3)

| Goal | Success |
|------|---------|
| No insect/animal attacks | Ant fight, scorpion, bee chase, cat panic removed |
| No death or dying pets | Antie’s death and funeral removed entirely |
| No machine/lawn terror | Second laser blast, lawnmower vortex, Cheerios near-miss removed |
| No drowning fear | Sprinkler set piece removed |
| No neighbor violence talk | “Break his arm” / “gonna kill you” lines cut |
| Keep wonder and comedy | Tiny backyard adventure, friendly Antie ride, bee transport, happy reunion |

## Toddler story spine (after cuts)

1. Dad’s silly shrink machine and the kids accidentally get tiny.
2. Amazing backyard — grass like a jungle, giant cookie, friendly ant named Antie.
3. Fun rides and camping in a Lego house; Antie helps them travel.
4. Quark the dog brings everyone home; Dad finds the kids and fixes the machine.
5. Big family dinner — everyone safe and happy.

## Removal blocks (source timeline, seconds)

| Block | ~Time | Content |
|-------|--------|---------|
| 1 | 5:58–6:12 | Russ “break his arm” threat |
| 2 | 24:04–24:20 | Amy “gonna kill you” line |
| 3 | 26:34–28:38 | Wayne re-fires shrink ray; kids flee; garbage-bag terror |
| 4 | 35:59–39:50 | Cat chases Quark; pollen panic; bee attack and crash |
| 5 | 44:41–48:10 | Sprinkler monsoon; “Please don die” |
| 6 | 53:48–56:05 | Giant cookie ant swarm/fight (keep befriending from “Nice ant”) |
| 7 | 56:43–57:18 | Giant Quark slobber/tumble |
| 8 | 69:14–70:10 | Teen kiss; parent “I'm scared” beat |
| 9 | 72:38–83:03 | Scorpion attack; Antie death; Ron mourning; lawnmower chase — **large join** to Quark ride |
| 10 | 83:31–84:42 | Nick nearly eaten in Cheerios bowl |
| 11 | 88:28–88:42 | Dinner callback to removed scorpion beat |

## Joins (12 cut blocks — not per-subtitle)

| Seam after block | ~Gap removed | Transition | Rationale |
|------------------|--------------|------------|-----------|
| 1–8, 10–11 | seconds–2 min | **hard cut** | Same scene / trim a line |
| 9 | ~10 min | **`fade_black`** (0.75 s) | Night camp → morning Quark rescue; skip death/lawnmower entirely |

Timeline: **12 `playlist2` segments**, output ~4028 s (~67 min). Regenerate with `generate-honey.sh` (**no** `--keep-full-timeline`). Render uses `render_final_mkv.py --ranges-json` (Pee-wee seam pattern).

## Director defaults (no ask needed)

- Cut all predatory insect fights and pet death entirely (kid-friendly = remove, not soften).
- Cut lawnmower and near-death kitchen beats — too intense for toddlers even with a happy outcome.
- Keep Antie befriending, cookie discovery, and ant ride — core wonder beats.
- Keep parent B-plot worry trimmed only where dialogue is explicitly frightening to a watching toddler.

## Subtitles

Embedded English SRT (stream 0) extracted to project working copy. Output timeline: `.kdenlive.shifted.srt`.

## Changelog

- 2026-06-06 — Initial cut list (11 blocks); ~68 min target from ~94 min source.
- 2026-06-06 — Generated `.kdenlive` (1763 segments, output ~4028 s / ~67 min from 5625 s source).
- 2026-06-06 — Local two-pass render started from `C:\Videos\FanEditRender\`.
- 2026-06-07 — Regenerated timeline: **12 cut blocks** (removed `--keep-full-timeline`). Block 9 → `fade_black` transition. Render script updated for seam transitions (Pee-wee pattern).
- 2026-06-07 — Prior per-subtitle render abandoned (1763 segments, crash at ~27% pass 1). Final encode from 12-block timeline + local source.
- 2026-06-07 — Final MKV rendered (~67 min / 570 MB): `C:\Videos\FanEditRender\Honey I Shrunk the Kids (1989) - KidFriendly Edition.mkv` and NAS project folder. Join: `fade_black` at block 9.
