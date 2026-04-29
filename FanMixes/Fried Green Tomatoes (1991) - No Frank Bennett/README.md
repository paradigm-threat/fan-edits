# Fried Green Tomatoes (1991) — No Frank Bennett

## Description

**Strategy, phases, and replacement-asset search plan:** [PLAN.md](PLAN.md).

This cut removes **Frank Bennett** (Nick Searcy): his on-screen scenes, the **Valdosta / river-club / abuse / kidnapping / investigation / trial** thread, and **dialogue that names or explains him**, so the runtime stays continuous where possible. The automated ranges come from the bundled English `.srt` (keyword clustering + padding); **review every join in Kdenlive** — subtitles miss silent reaction shots and some establishing shots may need manual handles.

## Source media (not in git)

Place your **legally obtained** rip next to the project or pass its path to `generate-no-frank.sh`. Video files are gitignored per repo policy. The checked-in `Fried-Green-Tomatoes.en.srt` is a working copy of the sidecar used to derive cut windows.

## Generate Kdenlive (subtitle pipeline)

From the repo root (or edit paths inside the script):

```bash
bash "FanMixes/Fried Green Tomatoes (1991) - No Frank Bennett/generate-no-frank.sh" /path/to/your/rip.mp4
```

This runs `scripts/kdenlive_from_subs.py` with:

- `--keep-full-timeline` — full film pacing, not “dialog-only compression”.
- `--remove-ranges-json` — `remove-frank-bennett-ranges.json`.
- Outputs `.kdenlive`, `.kdenlive.ass`, and `.kdenlive.shifted.srt` for the edited timeline.

Optional: add `--snap` to the script invocation for keyframe-aligned cuts (slower; uses `ffprobe` on the whole file).

## Citations used to scope Frank / Ruth / trial material

These are **plot and cast references**, not timing sources (timings are from the local SRT + `ffprobe` duration).

1. **Wikipedia — *Fried Green Tomatoes*** — Ruth moves to Valdosta to marry Frank Bennett; Idgie discovers abuse; rescue; Frank’s attempt to take the child; truck in the river; trial; Sipsey / barbecue revelation. Nick Searcy listed as Frank Bennett.  
   https://en.wikipedia.org/wiki/Fried_Green_Tomatoes  

2. **IMDb — *Fried Green Tomatoes* (1991)** — title `tt0101921`; full credits list **Nick Searcy** as Frank Bennett for scene identification.  
   https://www.imdb.com/title/tt0101921/fullcredits/  

3. **Britannica — film summary** — concise overview of the dual timeline and Whistle Stop stories.  
   https://www.britannica.com/topic/Fried-Green-Tomatoes  

## How the cut list was built

1. Parse `Fried-Green-Tomatoes.en.srt`.  
2. Match cues against a regex for Frank-centric plot language (`Frank`, `Bennett`, `Valdosta`, `river club`, `Mrs. Bennett`, `murder of Frank`, `trial`, `Scroggins`, `Smoot`/`Smoote`, `barbecue Frank`, `Frank disappeared`, `kidnap`, `pickup truck` / `truck in the river`, etc.).  
3. Merge hits separated by **≤ 90 s** and pad **±8 s** (tweak in a small Python one-liner if you change subs).  
4. Export merged windows to `remove-frank-bennett-ranges.json`.

**False positives / gaps:** Any keyword hit can snag an innocent line in the same cluster; conversely, **Frank on screen without matching dialogue** is invisible to this pass — use Kdenlive’s waveform and picture to extend or trim.

## Optional filler if a removal feels abrupt

Ideas only (respect copyright / licensing):

- **Public-domain or CC0** rural US / small-town B-roll (e.g. [Prelinger Archives](https://archive.org/details/prelinger) — 1930s–50s street, trains, diners).  
- **Creative Commons** “Georgia / Alabama / South” stock (check license: commercial vs noncommercial).  
- **Map stills** (USGS historical maps, OpenStreetMap exports) with a soft Ken Burns move — bridges exposition without characters.  
- **Whistle Stop–adjacent** tone: sepia photos of cafés, cotton fields, or a **title card** (“Some time later…”) over music from the existing OST you already own on disc.  
- **Room tone** lifted from an adjacent scene (same location) under a short J-cut / L-cut to hide a hard line.

---

*Fan edit project files only; no video in this repository.*
