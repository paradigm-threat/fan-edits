# Fan edit instructions for LLM agents

This document tells an AI assistant how to create, maintain, and render **movie fan edits** in this repository. Read it before touching any FanMix project.

Human overview: [README.md](../README.md).

---

## 1. What you are building

A **FanMix** is a personal re-cut of a film the owner already owns. Goals vary by project:

| Edit style | Typical goal |
|------------|----------------|
| **UnJossed / Unjinxed / DeSchwartzed** | Remove cringe, sexist, or tone-breaking lines and set pieces (often Whedon-style quips, gross-outs, or studio-mandated humor). |
| **Kid friendly** | Remove violence, horror, sexuality, and frightening imagery entirely. |
| **Character / plot trims** | Remove a character or subplot (e.g. Frank Bennett) while keeping the emotional spine. |
| **Pacing / exposition** | Remove redundant narration or “explaining the clues” scenes. |

You are the **director** for editorial calls, but **confirm destructive or ambiguous cuts** with the owner when the story impact is large.

---

## 2. Repository rules (non-negotiable)

1. **No copyrighted media in git** — no `.mkv`, `.mp4`, ripped discs, or download links. Only project files: `.kdenlive`, `.srt`, `.ass`, `.json`, `.md`, `.py`, `.sh`, logs if useful.
2. **Paths in `.kdenlive`** may point at the owner’s local rips (e.g. `/Horror and SciFi/...`). Use paths that match their machine layout; document the expected rip location in the FanMix `README.md`.
3. **Do not commit secrets** or credentials.
4. **Commits** — only when the user explicitly asks.
5. The owner has **legitimate copies** of every source film; do not help locate pirated content.

---

## 3. Folder layout

Create each edit under `FanMixes/`:

```text
FanMixes/
  Serenity (2005) - Unjossed/
    README.md                          # Human summary + how to build/render
    PLAN.md                            # Optional: editorial strategy, QC, filler plan
    CHANGES.md                         # Picture holes (source times) + scene labels
    poster.jpg                         # Vertical 2:3 catalog art (see docs/POSTER-STYLE.md)
    _sources/                          # gitignored — theatrical SRT + optional rip symlink
      theatrical.srt                   # Source-clock English (ONLY file for hole labels)
    Serenity (2005) - Unjossed.kdenlive
    Serenity (2005) - Unjossed.srt     # Often cut-timed or incomplete — do NOT trust for labels
    Serenity (2005) - Unjossed.kdenlive.ass
    Serenity (2005) - Unjossed.kdenlive.shifted.srt   # After cuts — output / player timeline
    subs/<stem>.english.srt            # Player: dialogue only (cut timeline)
    subs/<stem>.enhanced.srt           # Player: dialogue + [Edit:] cut cards
    remove-serenity-ranges.json        # Machine-readable cut windows (seconds)
    generate-serenity.sh               # Optional: regen kdenlive from subs + JSON
    render_final_mkv.py                # Optional: ffmpeg render from playlist2
```

**Naming:** `Title (Year) - Edition Name` — match existing projects (`Alien Resurrection (1997) - UnJossed`, `Riddick (2013) - Unjinxed`).

`_sources/` is gitignored (`FanMixes/**/_sources/`). Keep theatrical SRTs there locally; document how to extract them in the FanMix README.

---

## 4. Tools

Install on Windows (owner machine):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-fanedit-render-tools.ps1
```

Requires: **Python 3**, **ffmpeg/ffprobe**, **Kdenlive** (GUI), optionally **Handbrake** for ripping.

**Source readiness gate** — before any pipeline step, verify the rip is complete:

```bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "/path/to/movie.mkv"
```

If this fails with `EBML header parsing failed` or `Invalid data`, the file is still downloading or corrupt. **Stop and wait** until `ffprobe` returns a duration.

---

## 5. End-to-end workflow

```mermaid
flowchart TD
  locate[Locate legal rip] --> probe[ffprobe OK]
  probe --> subs[Extract or obtain English SRT]
  subs --> plan[PLAN.md + cut questions for owner]
  plan --> ranges[remove-*-ranges.json]
  ranges --> kden[Generate or edit .kdenlive]
  kden --> qc[QC every join in Kdenlive]
  qc --> localcopy[Copy source rip to local disk]
  localcopy --> render[Render MKV same resolution]
  render --> readme[Update README changelog]
```

### Phase A — Source and subtitles

1. **Find the rip** (owner-provided path). Example: `N:\Videos\Horror and SciFi\Serenity (2005)  [2160p x265 10bit FS90 Joy].mkv`.
2. **Probe** video: resolution, fps, duration, audio layout (stereo vs 5.1), codec (note 10-bit HEVC vs 8-bit for render script).
3. **Subtitles** — extract English aligned to the **same rip** (source clock):
   - Probe streams: `ffprobe -show_entries stream=index,codec_type,codec_name -show_entries stream_tags=language,title -of csv=p=0 movie.mkv`
   - Prefer a full **English / English CC** text track (not Forced-only).
   - Extract into gitignored `_sources/`:  
     `ffmpeg -i movie.mkv -map 0:N -c:s srt "_sources/theatrical.srt"` (replace `N` with the English CC index).
   - Or copy a sidecar from the release’s `Subs/` folder to `_sources/theatrical.srt`.
4. Optional working copy as `Title (Year) - Edition.srt` in the FanMix folder for editing — but treat it as **suspect for hole labels** until you prove it matches theatrical duration/clock (see §12).

### Phase B — Editorial plan

1. Write **`PLAN.md`** for non-trivial edits (see [Fried Green Tomatoes PLAN.md](../FanMixes/Fried%20Green%20Tomatoes%20%281991%29%20-%20No%20Frank%20Bennett/PLAN.md)).
2. Watch or skim with subs; build:
   - **Cringe / tone** list (dialogue to cut or trim).
   - **Gore / shock** list (shorten or remove; kid-friendly = remove entirely).
   - **Reorder** notes (only when flow clearly improves).
3. Present the owner a **numbered question list** for ambiguous removals (see §8).
4. Record **director defaults** in `PLAN.md` when you cut without asking (with one-line rationale).

### Phase C — Cut list (`remove-*-ranges.json`)

Format (seconds on **source** timeline):

```json
{
  "description": "What this file removes and how it was derived",
  "ranges": [
    {"start": 414.85, "end": 424.34, "join_fade": false},
    [120.5, 145.0]
  ]
}
```

- Times are **floating-point seconds** from file start.
- Merge nearby hits (e.g. cues within **90 s**) and pad (**±5–10 s**) so lines breathe; tighten in QC.
- `"join_fade": false` — hard cut at that seam (same room / no time jump).
- Build ranges by:
  - **Keyword/regex** over SRT text (good for dialogue-driven cuts).
  - **Manual timestamps** from playback (required for silent gore or visual-only cringe).
  - **Plot references** (Wikipedia/IMDb) only for *finding* scenes, not for timing.

**Limitation:** Subtitle-only automation **misses** silent shots and **false-positives** on innocent lines in the same cue block. Always QC in Kdenlive.

### Phase D — Kdenlive timeline (scene-per-subtitle-block)

The standard pattern for rearrange/remove edits:

1. **One timeline clip per subtitle cue** (or per merged “scene” block), so deleting a block = deleting a scene.
2. In the `.kdenlive` XML, the render pipeline reads **`playlist id="playlist2"`** — sequential `<entry>` elements with `in` / `out` timecodes pointing at the source chain (`chain0` or `chain1`).
3. **Removed** ranges simply omit entries (gaps are closed on export).
4. **Reordered** scenes: drag blocks in Kdenlive or reorder `<entry>` elements and fix subtitle shift logic.
5. **Join discipline** (from [Silent Hill README](../FanMixes/Silent%20Hill%20%282006%29%20-%20Nay%20Tomorrow/README.md)):
   - Cut on the **switching frame** when possible; leave **handles** (“wings”) for crossfades.
   - Use short **blanks** or **audio/video fades** on large time jumps (see automated `--join-fade-sec` below).
   - **Room tone** or dip-to-black beats a naked hard cut across locations.

**Automated generation** (when `scripts/kdenlive_from_subs.py` is present):

```bash
bash "FanMixes/My Film (1999) - Edition/generate-myfilm.sh" "/path/to/rip.mkv"
```

Typical flags (see [Fried Green Tomatoes generate-no-frank.sh](../FanMixes/Fried%20Green%20Tomatoes%20%281991%29%20-%20No%20Frank%20Bennett/generate-no-frank.sh)):

| Flag | Purpose |
|------|---------|
| `--keep-full-timeline` | Keep full film pacing (not dialog-only compression). |
| `--remove-ranges-json` | Apply cut windows. |
| `--snap` | Expand cuts to GOP/keyframe boundaries (cleaner ffmpeg joins). |
| `--join-fade-sec 0.35` | Dip/fade on big jumps. |
| `--join-fade-min-gap 72` | Only fade if >72 s removed at seam. |

**Outputs:** `.kdenlive`, `.kdenlive.ass`, `.kdenlive.shifted.srt`.

**Manual path** (always valid): Open Kdenlive → import rip → split on subtitle boundaries → delete/disable blocks → save. Reference: [Alien Resurrection (1997) - UnJossed](../FanMixes/Alien%20Resurrection%20%281997%29%20-%20UnJossed/).

### Phase E — Quality control

Before render, check every **join**:

- [ ] No orphaned dialogue (cut mid-conversation without intent).
- [ ] No leftover **banned** visuals after a dialogue cut (extend range).
- [ ] Subtitles still readable (`shifted.srt` / ASS regenerated if timeline changed).
- [ ] Audio pops — add 1–2 frame handles or crossfade.
- [ ] Music/OST edits documented if external audio was added (licensing note in README).

### Phase F — Render

#### Step 0 — Copy source rip from NAS to local disk (required)

The owner’s rips and this repo often live on **NAS** (e.g. `N:\Videos\...`, `\\NobiServ\...`). NAS is **slow and unreliable** for long ffmpeg reads — do **not** render the final MKV directly from a network path.

1. **Copy the source video** (the rip referenced in `.kdenlive` / `README.md`) to a **local** folder before starting pass 1, e.g. `C:\Videos\FanEditRender\` or `%TEMP%\fanedit-source\`.
2. **Verify the local copy** with `ffprobe` (same duration as NAS original). If copy fails or sizes differ, re-copy before rendering.
3. **Render from the local file** — pass `--video` to `render_final_mkv.py` pointing at the local copy, or temporarily update `chain0` `resource` in Kdenlive for a GUI export.
4. **Write the output MKV locally** as well (same scratch folder or `C:\Videos\FanEditRender\out\`). Do **not** encode directly to NAS.
5. **Copy the entire project folder back to the server** after a successful render — **minus the original source rip** (see Step 1 below).

```powershell
# Example: copy rip to local scratch, then render from local path
$src = "N:\Videos\Horror and SciFi\Serenity (2005)  [2160p x265 10bit FS90 Joy].mkv"
$localDir = "C:\Videos\FanEditRender"
$local = Join-Path $localDir (Split-Path $src -Leaf)
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
Copy-Item -LiteralPath $src -Destination $local -Force

ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $local

python render_final_mkv.py --video $local --out (Join-Path $localDir "Serenity (2005) - Unjossed - final.mkv")
```

For multi-hour rips, `robocopy` with `/Z` (restartable) is fine instead of `Copy-Item` if a copy was interrupted.

Kdenlive **preview/QC** may still use NAS paths; only the **final long encode** must use local media.

#### Step 1 — Sync project folder back to server (required after render)

When you copied the FanMix folder and source rip to local scratch for rendering, **push the whole project folder back to NAS** once the encode succeeds. The source rip already lives in the owner’s library (e.g. `N:\Videos\Horror and SciFi\...`) — **do not** copy that file back into the repo or re-upload it.

**Include on sync:** final `.mkv`, `.kdenlive`, shifted subs, cut JSON, scripts, logs, `README.md`, `PLAN.md`.

**Exclude:** the original source rip MKV (and any other full-length library rips you pulled down only for encoding).

```powershell
# Windows — sync local project folder back to NAS, skip source rip
$proj     = "FanMixes\Serenity (2005) - Unjossed"
$local    = "C:\Videos\FanEditRender\Serenity (2005) - Unjossed"
$nas      = "N:\Videos\FanEdits\$proj"
$srcName  = "Serenity (2005)  [2160p x265 10bit FS90 Joy].mkv"
robocopy $local $nas /E /XF $srcName /Z /J
```

```bash
# Linux — rsync project folder back to SMB/NAS, skip source rip
SRC_NAME='Serenity (2005)  [2160p x265 10bit FS90 Joy].mkv'
rsync -av --exclude="$SRC_NAME" \
  ~/FanEditRender/Serenity\ \(2005\)\ -\ Unjossed/ \
  "/mnt/nas/Videos/FanEdits/FanMixes/Serenity (2005) - Unjossed/"
```

If you only rendered locally (project still on NAS, source copied to scratch), copy **at minimum** the final `.mkv`, updated `render_final_mkv.log`, and any changed project files — still **never** the library source rip.

**Option 1 — ffmpeg two-pass (preferred for long HEVC exports)**

Copy/adapt [render_final_mkv.py](../FanMixes/Fried%20Green%20Tomatoes%20%281991%29%20-%20No%20Frank%20Bennett/render_final_mkv.py):

- Parses **`playlist2`** `chain0` segments.
- Builds `trim` + `concat` filter graph.
- **Video:** `libx265` two-pass, target bitrate ≈ source format average minus audio overhead.
- **Audio:** AAC 5.1 @ 224 kb/s (adjust if source is stereo-only).
- **Subs:** mux `*.kdenlive.shifted.srt` as default English track.
- Match **resolution and fps** to source (`ffprobe` stream fields); use `yuv420p` or `yuv420p10le` to match source bit depth.

**Option 2 — Kdenlive GUI render**

Acceptable for shorter films or trial exports; use same resolution preset as source.

**Expectations:** Full 4K HEVC two-pass can take **many hours** on CPU. Log to `render_final_mkv.log`.

---

## 6. Kdenlive XML essentials

| Element | Role |
|---------|------|
| `chain0` / `chain1` | Source file `resource` path and clip length. |
| `playlist2` | **Master edit timeline** — list of kept `in`/`out` segments. |
| `producer` / `tractor` | Kdenlive UI tracks; don’t break IDs casually. |
| `.kdenlive.ass` | Subtitles for preview in editor. |
| `.kdenlive.shifted.srt` | Subs on **output** timeline (for final mux). |

**Path style:** Projects often use roots like `/Horror and SciFi/...` (Kdenlive media root). Match the owner’s existing projects.

---

## 7. Director guidelines

Apply consistently unless the FanMix `PLAN.md` says otherwise:

1. **Protect the emotional spine** — remove noise, not payoff.
2. **Cringe** — cut quips that undercut tension, especially after horror or before climax; prefer trimming a line over deleting a whole scene when possible.
3. **Gore / shock** — shorten beats or cut entirely; for “soft UnJossed” edits, reduce rather than eliminate unless owner wants kid-friendly.
4. **Pacing** — trim establishing repeats, redundant exposition, studio-mandated comic relief.
5. **Reorder** — rare; only when geography/time is clearer (e.g. intercut two threads). Document in README.
6. **Do not** add plot-changing fan fiction without owner approval.
7. **Replacement footage** — only PD/CC0/owned stock; track license in `PLAN.md` (see Fried Green Tomatoes §4).

---

## 8. Questions to ask the owner

Use a numbered list with **timecodes** (from SRT or hh:mm:ss) and **one-line description**. Example template:

```markdown
## Removal confirmations — Serenity (2005) Unjossed

1. **00:42:10** — Kaylee/Jayne “nethers / batteries” exchange: remove entire exchange or only Jayne’s second line?
2. **01:05:xx** — Haven aftermath (bodies on posts): remove entirely, or shorten to reaction shots only?
3. **01:18:xx** — Maidenhead bar fight: keep fight but trim gore, or cut set piece entirely?
...
```

Also ask:

- Target audience (friends / family / kids)?
- **Maximum runtime** change allowed?
- Keep **theatrical** vs extended scenes?
- Any lines/scenes **sacred** (never cut)?

---

## 9. Posters & artwork

Catalog art lives at `FanMixes/<Title>/poster.jpg` (git tip binary). For generation prompts, house style, and other aspect ratios (16:9 hero, 21:9 ultrawide, square, story), see **[POSTER-STYLE.md](POSTER-STYLE.md)**.

---

## 10. Per-project README (house style)

READMEs are the **public argument** for the cut — not a dump of hole times (that is [CHANGES.md](../FanMixes/)). Match recent FanMixes ([Brass Monkey](../FanMixes/Terminator%203%20(2003)%20-%20Brass%20Monkey/), [The Miracle](../FanMixes/Tron%20Legacy%20(2010)%20-%20The%20Miracle/), [Psychosomatic](../FanMixes/American%20Psycho%20(2000)%20-%20Psychosomatic/), [Yuppocolypse](../FanMixes/The%20Day%20After%20Tomorrow%20(2004)%20-%20Yuppocolypse/)).

### Required shape

1. **Title line** — `# Title (Year) — Edition Name`
2. **Hero blurb** — one short paragraph: what the theatrical does wrong / what this cut keeps. Optional **slogan** in bold.
3. **`## Motivation`** — owner’s thesis in plain language. Why this edition exists; what stays sacred; what gets thrown out.
4. **Inline citations** — when critics, interviews, or fan writeups **agree with the thesis**, link them in the sentence (do not invent quotes). Prefer primary reviews over aggregators.
5. **`## Changes`** — runtime removed + hole count; link to `CHANGES.md`; group bullets by theme (not raw timecode lists).
6. **`## Source media (not in git)`** — rip filename; `_sources/theatrical.srt` for labels; warn if project `*.srt` is cut-timed / unreliable (§12).
7. **Build / render / sync** — only if the project has scripts; always remind: copy rip **local** before render (§5 Phase F).
8. Footer: contribute link to `/submit`.

Optional: poster image under the title; trailer embed; `## TODO` for open picture QC.

### Motivation rules

- Write like a director’s note, not a changelog.
- **Plain writing** — no purple marketing; no invented lore. Investigation angles (e.g. Brass Monkey needle-drop) need a clear claim + linked evidence.
- Citations support *agreement*, not decoration. Bad fit → omit.
- Do **not** paste Scene TBD skeletons into the README; summarize labeled CHANGES only.
- Keep CHANGES as the machine/human cut list; README stays readable on the catalog page.

### Template

```markdown
# Title (Year) — Edition Name

![Poster](poster.jpg)

One-paragraph thesis. Slogan: **Short punch line.**

## Motivation

Why this cut exists. What the theatrical wastes time on. What you keep.
Optional: critics who already said the same thing with [inline links](https://example.com).

## Changes

**~N min removed across M picture holes.** Full list: [CHANGES.md](CHANGES.md).

### Theme A
- Bullet…

### Theme B
- Bullet…

## Source media (not in git)

- Rip: `Exact.Filename.mkv`
- Theatrical SRT for hole labels: `_sources/theatrical.srt`
- Do **not** label holes from `Title - Edition.srt` if it is cut-timed / wrong clock

## Build / label

    python3 scripts/list_kdenlive_cuts.py

## Render

Copy source rip from NAS to local disk first (see docs/LLM-FAN-EDIT-INSTRUCTIONS.md §5 Phase F).

---

Want to contribute a cut or fix notes? See [Submit](/submit).
```

---


## 11. Reference projects

| Project | Learn this |
|---------|------------|
| [Alien Resurrection (1997) - UnJossed](../FanMixes/Alien%20Resurrection%20%281997%29%20-%20UnJossed/) | UnJossed tone; `.kdenlive` + `.srt` + `.ass`; gross-out removal. |
| [Riddick (2013) - Unjinxed](../FanMixes/Riddick%20%282013%29%20-%20Unjinxed/) | Dialog-focused cringe removal. |
| [Fried Green Tomatoes (1991) - No Frank Bennett](../FanMixes/Fried%20Green%20Tomatoes%20%281991%29%20-%20No%20Frank%20Bennett/) | `remove-*-ranges.json`, `generate-*.sh`, `render_final_mkv.py`, `PLAN.md`. |
| [Silent Hill (2006) - Nay Tomorrow](../FanMixes/Silent%20Hill%20%282006%29%20-%20Nay%20Tomorrow/) | Gore + exposition; join discipline; external OST notes. |
| [Terminator 3 (2003) - Brass Monkey](../FanMixes/Terminator%203%20(2003)%20-%20Brass%20Monkey/) | `_sources/theatrical.srt` for labels; cut-timed project SRT; CHANGES timing caveat. |
| [The Day After Tomorrow (2004) - Yuppocolypse](../FanMixes/The%20Day%20After%20Tomorrow%20(2004)%20-%20Yuppocolypse/) | Wrong-SRT labeling failure mode; relabel from theatrical. |
| [Thor Ragnarok (2017) - Kid friendly](../FanMixes/Thor%20Ragnarok%20%282017%29%20-%20Kid%20friendly/) | Kid-friendly severity. |

---

## 12. CHANGES.md — accurate cut analysis (timing & which SRT)

`CHANGES.md` is the authoritative cut list for humans and for enhanced-subtitle cards. Getting the **clock** wrong produces confident-looking garbage (TBD scenes, or worse: dialogue from the wrong scene pasted under a hole).

### Two clocks

| Clock | What it is | Used for |
|-------|------------|----------|
| **Source** | Timecode on the original rip / theatrical feature | Kdenlive `in`/`out`, hole windows in CHANGES, `remove-*-ranges.json` |
| **Cut** | Timecode on the finished edit (`cut ≈ source − Σ holes before t`) | Player `subs/*.english.srt`, `*.shifted.srt`, theater playback, enhanced `[Edit:]` placement |

Hole header times in CHANGES are always **source** times:

```text
cut_t = source_t − sum(durations of holes that end at or before source_t)
```

### Which SRT for what

| File | Clock | Use for hole labels? | Use for player / enhanced? |
|------|-------|----------------------|----------------------------|
| `_sources/theatrical.srt` | Source (matches rip) | **Yes — preferred** | No (too long; includes removed dialogue) |
| `*.kdenlive.shifted.srt` / `subs/*.english.srt` | Cut | No | **Yes** |
| Project `Title - Edition.srt` or `*.kdenlive.ass` | **Unknown until proven** | No, unless README/CHANGES explicitly says source-timed and duration ≈ rip | Only if proven cut-timed |
| Remaster / alternate-rip SRT | Source *for that rip* | Only if it is the same picture the `.kdenlive` was cut from | No |

**Hard rule:** Never label CHANGES holes by overlapping project/cut SRTs against source hole times. That is how *Day After Tomorrow — Yuppocolypse* got wrong “Removed subtitles” (e.g. disaster dialogue under soft-establishment holes) while every scene stayed TBD.

### Prove an SRT’s clock before trusting it

1. `ffprobe` rip duration (e.g. ~124 min).
2. Last cue end on the SRT. If the SRT ends ~30+ min early and you removed ~30 min of picture, it may be **cut-timed** (or truncated) — still not safe for labeling unless you verified it.
3. Spot-check: pick a famous early line; does its SRT time match the rip when you scrub the source MKV?
4. Prefer extracting fresh from the rip into `_sources/theatrical.srt` (English CC text track, not Forced-only).

### How to generate hole times

```bash
# Lists source-time gaps on the feature playlist; prefers _sources/theatrical.srt when present
python3 scripts/list_kdenlive_cuts.py
# Optional: python3 scripts/list_kdenlive_cuts.py --write-md   # skeleton CHANGES (Scene TBD)
```

- Hole **starts/ends** come from Kdenlive kept ranges (picture truth).
- Overlapping cues for “Removed subtitles” must come from **theatrical / source** SRT only.
- `list_kdenlive_cuts.py` scores `_sources/theatrical.srt` highest; do not defeat that by deleting theatrical and regenerating against a project SRT.

### Labeling holes (Brass Monkey / Tron / Yuppocolypse style)

1. Keep auto-generated times; replace `Scene: TBD` with a short **bold title** + one-line blurb.
2. Prefer scene/intent language over dumping every removed cue into the title.
3. Mark silent pads honestly: `confirm on picture` / `no overlapping theatrical dialogue` — do not invent plot.
4. Put a **Timing caveat** at the top of CHANGES when the project `*.srt` is cut-timed or unreliable (see Brass Monkey, Yuppocolypse).
5. Picture check wins over SRT when they disagree (misaligned remaster, commentary track, forced subs).
6. Do **not** call CHANGES “done” while most holes are still Scene TBD — and do **not** run the enhanced-card builder on TBD-only lists.

### `_sources/` checklist (local, gitignored)

- [ ] `_sources/theatrical.srt` extracted from the **same** rip the `.kdenlive` uses.
- [ ] Optional symlink to the rip under `_sources/` for picture QC (never commit `.mkv`).
- [ ] README documents rip filename + how to re-extract theatrical.
- [ ] CHANGES points at theatrical for labels and warns against the project SRT if needed.

Reference: [Terminator 3 — Brass Monkey CHANGES](../FanMixes/Terminator%203%20(2003)%20-%20Brass%20Monkey/CHANGES.md), [Day After Tomorrow — Yuppocolypse CHANGES](../FanMixes/The%20Day%20After%20Tomorrow%20(2004)%20-%20Yuppocolypse/CHANGES.md).

---

## 13. Enhanced cut-commentary subtitles

When `CHANGES.md` has **labeled** picture holes (not Scene TBD / confirm-on-picture-only), generate dual player tracks under `subs/`:

| File | Contents |
|------|----------|
| `subs/<stem>.english.srt` (+ `.vtt`) | Dialogue only — no edit cards |
| `subs/<stem>.enhanced.srt` (+ `.vtt`) | Dialogue + `[Edit: …]` join notices and short follow-up cards |

```bash
python3 scripts/build_edit_enhanced_srt.py --project "FanMixes/<Title> - <Edition>"
# or the labeled-CHANGES batch:
python3 scripts/build_edit_enhanced_srt.py --all-ready
python3 scripts/build_edit_enhanced_srt.py --project "…" --dry-run   # preview card times
```

Hole times in CHANGES are **source** times; the script maps them to the **cut** timeline (§12) and places cards in dialogue gaps (0.4s pad, ~2.4s minimum). Follow-up cards use CHANGES/README motivation only when there is room. Do **not** invent an enhanced track while CHANGES is still TBD-only. Citation-only projects (Mission Mars, Lebowski, Pentagon) keep their investigation cards — do not invent fake picture-cut notices.

Dialogue input must be **cut-timed** (`*.shifted.srt` / existing `subs/*.english.srt`). If only a source-timed `*.kdenlive.srt` exists, the builder shifts it through the hole list; prefer a real shifted/english track when available.

After writing `subs/*.enhanced.srt`, regenerate the catalog: `python3 scripts/generate-index-json.py` (labels enhanced as **Enhanced / Citations**).

---

## 14. Checklist before marking a FanMix “done”

- [ ] `ffprobe` passes on source rip.
- [ ] `README.md` complete (changes, source path, build, render).
- [ ] Cut list JSON + rationale documented.
- [ ] `_sources/theatrical.srt` present locally; CHANGES holes labeled from it (not TBD-only).
- [ ] `.kdenlive` opens with correct media path.
- [ ] All joins QC’d; shifted subs match output.
- [ ] Source rip **copied to local disk**; final render read from local copy (not NAS).
- [ ] Final `.mkv` at **same resolution** as source, HEVC (H.265), embedded English subs. No H.264 1080p or 720p ladder.
- [ ] If CHANGES holes are labeled: `subs/*.english.srt` + `subs/*.enhanced.srt` via `build_edit_enhanced_srt.py`; regen `index.json`.
- [ ] `poster.jpg` in house style ([POSTER-STYLE.md](POSTER-STYLE.md)); optional wide/square crops if needed.
- [ ] Project folder **synced back to server** (final MKV, project files, logs) — **excluding** the original source rip.
- [ ] Root [README.md](../README.md) Fan Edit list updated (if owner wants release).

---

## 15. Common failures

| Symptom | Fix |
|---------|-----|
| `EBML header parsing failed` | Rip incomplete, bad NAS read, or incomplete local copy — wait/re-copy; confirm size and `ffprobe` duration match NAS original. |
| `playlist2 not found` | Wrong kdenlive structure; regenerate or fix XML. |
| `missing shifted subs` | Re-run `kdenlive_from_subs.py` or export subs after edit. |
| Audio glitch at cut | Extend handles; keyframe snap; short crossfade. |
| Subtitle drift | Regenerate shifted SRT/ASS from source SRT + kept segments. |
| Render stalls, I/O errors, corrupt output | Source or output on NAS — **copy rip locally**, re-render; verify with `ffprobe` before and after. |
| CHANGES “Removed subtitles” name the wrong scene | Project/cut SRT was used against **source** hole times — extract `_sources/theatrical.srt` from the rip and relabel (Yuppocolypse lesson). |
| Every hole is Scene TBD | Skeleton from `list_kdenlive_cuts.py --write-md` only — label from theatrical cues + picture; do not ship enhanced cards yet. |
| Project SRT ends far before rip duration | Likely cut-timed or truncated — fine for playback if shifted correctly; **never** for hole labels. |
| Enhanced cards on wrong clock | Confirm CHANGES times are source; dialogue SRT is cut-timed (`*.shifted.srt` / `*.english.srt`) or source (`*.kdenlive.srt` without shifted, then builder maps). |

---

*Internal doc for LLM agents working in the FanEdits repository.*