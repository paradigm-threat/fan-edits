# Editorial plan: *Riddick* (2013) — Unjinxed

Companion to [README.md](README.md) and [remove-riddick-unjinxed-ranges.json](remove-riddick-unjinxed-ranges.json).

## Goals

| Goal | Success |
|------|---------|
| Linear exposition | Viewer knows **why** Riddick is on the planet **before** desert survival, without mid-film flashbacks |
| Keep Unjinxed tone | Existing dialogue trims stay; Vaako conspiracy block (`00:13:25–00:15:50`) stays **out** |
| Remove opening predator beat | No vulture/pterosaur hand attack + kill (~`00:00:30–00:02:00`) |
| Preserve epilogue | Necromonger capital-ship coda (`~01:41:17+`) remains **after** climax |

## Locked decisions

| Topic | Choice |
|-------|--------|
| Vaako block | **Cut** — `00:13:25` → `00:15:50` |
| Main start after prologue | Source **`00:01:13`** — “crossed off the list” VO |
| Opening predator | **Removed** — vulture/pterosaur kill |
| Epilogue | **End of film** — not in prologue |

---

## Output timeline (playback order)

Source times = Blu-ray rip `Riddick.2013.1080p.BluRay.x264.mp4`.

| # | Label | Source in → out | Notes |
|---|--------|-----------------|--------|
| 1 | Prologue A | `00:10:54.487` → `00:13:25.067` | “Legendary bad days” → betrayal setup |
| 2 | *(gap)* | `00:13:25` → `00:15:50` | Vaako block — **omitted** |
| 3 | Prologue B | `00:15:50.717` → `00:22:51.536` | Wrong planet, Krone, stranded VO |
| 4 | Bridge | — | **0.35 s dip to black** (prologue → main) |
| 5 | Main — survival | `00:01:13.573` → `00:10:54.487` | Wounded Riddick; **no** in-body flashback |
| 6 | Main — savanna | `00:22:51.536` → `00:24:03.733` | Visual bridge to jackal beat |
| 7 | Main — beacon / mercs | `00:24:03.733` → `00:40:50.342` | Through bounty setup; existing fade at out |
| 8+ | Act 2–climax | `00:44:11+` … | Unchanged Unjinxed gaps/fades in `playlist2` |
| 9 | Epilogue | `01:41:38.497` → `02:06:47.631` | Vaako “Both” / Transcendence |

**Runtime:** ~same as pre-reorder export (~1 h 47 m) ± fades; prologue front-loads ~12 min, body flashback removed.

---

## Removal / reorder (source seconds)

| Block | start | end | How |
|-------|------:|----:|-----|
| Vulture open | 30 | 120 | Trim from main; QC refine in Kdenlive |
| Vaako (keep cut) | 805 | 950 | Hard jump prologue A → B |
| In-body flashback | 654 | 1371 | **Moved** to prologue; must not repeat in main |
| Reorder | — | — | Prologue segments precede `00:01:13` main |

---

## Flashback cue reference (source)

| Time | Cue |
|------|-----|
| `10:54` | “Legendary bad days” |
| `12:29` | “You are the Lord Marshal now” |
| `16:11` | Furya campaign story |
| `17:16` | “Get the fuck off our ship…” |
| `18:18` | “Not Furya” |
| `20:12` | “You keep what you kill” |
| `20:47` | “Zero the clock” |
| `22:37` | “Water, grass and life” (prologue out) |

**Not flashback:** merc radio `<i>` after `33:08`; epilogue Vaako `1:41+`.

---

## Join discipline

| Seam | Treatment |
|------|-----------|
| Prologue A → B (Vaako gap) | Hard cut (existing Unjinxed) |
| Prologue B → main | **Dip to black ~0.35 s** |
| Main internal | Keep existing Unjinxed fades (`filter6`–`filter11`) |
| Vulture → VO | Start main at `01:13`; no orphan gore frame |

---

## QC checklist (before render)

- [ ] Prologue complete; no mid-film Necromonger flashback repeat
- [ ] Vaako block still absent; jump at `13:25` acceptable
- [ ] Vulture kill gone; `01:13` VO lands clean
- [ ] Savanna bridge (`22:51–24:03`) flows once
- [ ] All legacy Unjinxed dialogue cuts still present
- [ ] `.kdenlive.shifted.srt` / `.ass` match `playlist2`
- [ ] `ffprobe` OK on source; **render from local copy** ([LLM-FAN-EDIT-INSTRUCTIONS.md](../../docs/LLM-FAN-EDIT-INSTRUCTIONS.md) §5 Phase F)

---

## Changelog

- 2026-05-25 — Flashback prologue reorder; vulture open removed; `remove-riddick-unjinxed-ranges.json`; shifted subs regen; README build notes.
- 2026-05-25 — `render_final_mkv.py`, `render-riddick.ps1`; kdenlive paths → `YIFY.mp4`; render from `C:\Videos\FanEditRender\`.
