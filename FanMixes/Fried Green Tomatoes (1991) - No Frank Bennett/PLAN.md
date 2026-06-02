# Editorial plan: *Fried Green Tomatoes* (1991) — No Frank Bennett

Companion to [README.md](README.md) (technical pipeline) and [remove-frank-bennett-ranges.json](remove-frank-bennett-ranges.json) (machine cut list).

---

## 1. Goals

| Goal | Success looks like |
|------|----------------------|
| Remove **Frank Bennett** as a character and antagonist | No face, voice, or name-driven plot dependency on him in retained footage |
| Remove **references** that exist only to set up or resolve his thread | Fewer “who was that?” moments; accept some ambiguity vs. endless ADR |
| Keep **Idgie / Ruth / Ninny / Evelyn** emotional spine where possible | Whistle Stop café, friendship, present-day frame still land |
| Stay **legally clean** on replacement media | Only PD, CC-licensed (with attribution), self-shot, or licensed stock |

---

## 2. Editorial strategy (phased)

### Phase A — Verify the automated cut list

1. Open the generated `.kdenlive` and play **each join** (see `remove-frank-bennett-ranges.json`).
2. For every removal window, confirm on picture + waveform:
   - **No accidental** lopped-off dialogue that belongs to another arc.
   - **No leftover** Frank on screen after the cut (subtitles miss silent shots).
3. Adjust JSON (shrink/extend/split ranges), re-run `generate-no-frank.sh`, diff mentally against prior export.

### Phase B — Narrative repair (minimal first)

After Frank is gone, the film may still **imply** him via other characters’ lines. Strategy:

- **Tighten** adjacent scenes (L-cut / J-cut) so the eye follows Ruth or Idgie, not empty space.
- **Room tone** from the same location under a short bridge hides a hard cut better than silence.
- **Optional title cards** only where a beat is otherwise incomprehensible (“Later at the Whistle Stop Café”) — use sparingly; tone should match 1990s framing, not mock the film.

### Phase C — Optional visual filler (only where a jump hurts)

Use filler **only** after Phase B; priority order:

1. **Tone match** — same era feel (1920s–30s small-town South *look*, not necessarily the film’s exact art direction).
2. **No new story** — B-roll that does not introduce characters we never pay off.
3. **Length discipline** — short inserts (often **2–8 s**); longer only for act breaks we intentionally redesign.

### Phase D — Audio pass

- **Music**: OST / licensed stems if available from owned media; avoid dropping unrelated chart tracks.
- **Ambience**: crickets, diner murmur, train distant — either from the film’s own bed (lifted from safe scenes) or from CC0/SFX packs with clear license.
- **Dialog overlap**: check that shifted subs (`.kdenlive.shifted.srt`) still align after manual timeline edits; regenerate ASS if you re-run the script.

### Phase E — QC checklist

- [ ] Full playthrough at 1x; note timestamp list of pops/clicks/jumps.
- [ ] One pass **dialog-only** (muted video) for story coherence.
- [ ] Credits / legal line unchanged unless we add “Fan edit” card (project policy).

---

## 3. Story risks when the Frank thread is removed (design awareness)

Understanding *what* breaks helps choose filler vs. trim vs. title card.

- **Motivation for Ruth’s fear / protection** may need to stay implied through Idgie–Ruth scenes we keep, not explained by trial exposition.
- **Law / sheriff pressure** may disappear with trial removals; ensure we do not leave dangling “why is everyone tense?” without a one-line fix or cut of the reaction.
- **Late-film revelation** (Ninny / barbecue / Frank) is largely in the removal set by design; Evelyn’s arc may need **earlier emotional landing** so the ending still satisfies even if the twist is gone.

Document decisions in a short **changelog** section of this file or in commit messages when you change JSON or add inserts.

---

## 4. Strategy for finding replacement content

We need **search discipline**: every asset gets a **license trail** before it touches the timeline.

### 4.1 Asset types we are actually looking for

| Need | Examples |
|------|-----------|
| **Geographic / period texture** | Small-town street, general store, cotton field, train at crossing, river wide shot (no plot) |
| **Café / kitchen** | Coffee cups, pie case, hands passing a plate — no readable faces or logos |
| **Nature / transition** | Clouds, trees, dusk, rain on window — universal bridges |
| **Abstract** | Film grain overlay, light leak (only if license allows redistribution) |

Avoid: recognizable actors, branded signage, modern cars, **Confederate** imagery used as “generic South” (tone-dead and legally/PR risky).

### 4.2 Search channels (in priority order)

1. **Internet Archive — Prelinger Archives**  
   - URL: https://archive.org/details/prelinger  
   - **Search terms**: `Georgia 1930`, `Alabama town`, `small town street`, `general store`, `train station`, `farm family`, `diner 1950` (filter by era relevance).  
   - **License**: Many items are **public domain**; still read each item’s “Usage” / rights statement.

2. **Wikimedia Commons**  
   - URL: https://commons.wikimedia.org  
   - **Search**: `Georgia historical`, `Alabama 1920`, `Whistle Stop` (will not find film; use for **real** location stills / maps).  
   - **License**: CC-BY-SA, CC-BY, PD — **record author + license + link** in the tracking table below.

3. **Library of Congress — Prints & Photographs**  
   - URL: https://www.loc.gov/pictures/  
   - Strong for **historical stills** (maps, buildings, street scenes). Check “Rights Advisory” on each record.

4. **Creative Commons search portal** (aggregator; verify on source site)  
   - URL: https://search.creativecommons.org/  
   - Prefer **Openverse** / Flickr / Vimeo filters that allow **commercial adaptation** if you ever redistribute the edit; otherwise match your actual use.

5. **Pixabay / Pexels** (stock video)  
   - Read **license terms** (they change); many allow edit use but **not** trademark/logo prominence. Download **license snapshot** PDF or screenshot the terms page with date.

6. **Self-generated**  
   - Original phone video of **generic** Southern small-town façades (no people without release), sky, trees — you own copyright outright.

### 4.3 Search queries to rotate (copy into each site)

Combine and refine:

`small town georgia street 1930` · `rural alabama farm 1940` · `country store interior` · `train steam passing` · `river establishing aerial` (check drone clip licenses) · `southern porch rocking chair` · `church exterior small town` · `county courthouse exterior historical photo`

For **audio-only** bridges:

`room tone kitchen` · `diner ambience loop` · `cicadas night southern` — prefer **Freesound** (check each sound’s CC) or **CC0** packs.

### 4.4 Licensing checklist (before import to Kdenlive)

- [ ] What is the **exact** license string (e.g. CC BY-SA 4.0, CC0, PD)?
- [ ] Is **attribution** required in README / end credits text file?
- [ ] Is **ShareAlike** triggered if we embed the clip in a distributed video?
- [ ] Are **model / property releases** irrelevant because no identifiable people/buildings?
- [ ] Did we **save the URL + download date** for audit?

---

## 5. Tracking table (copy rows as you go)

| Timeline gap (approx) | Problem (jump / missing context) | Candidate source | License | Attribution / notes | In timeline? |
|----------------------|----------------------------------|------------------|---------|----------------------|--------------|
| *e.g. 1:12:00* | *Hard cut after trial line* | *Prelinger ID ______* | *PD* | *N/A* | ☐ |

---

## 6. Review cadence

- **Weekly** (or per session): update this table + JSON changelog.
- **Before “final” render**: re-read Phase E checklist and license table.

---

*Internal planning doc for this FanMix only.*
