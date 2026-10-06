# Fried Green Tomatoes (1991) — No Frank Bennett

This cut removes **Frank Bennett** (Nick Searcy): his on-screen scenes, the **Valdosta / river-club / abuse / kidnapping / investigation / trial** thread, and **dialogue that names or explains him**, so the runtime stays continuous where possible. The automated ranges come from the bundled English `.srt` (keyword clustering + padding); **review every join in Kdenlive** — subtitles miss silent reaction shots and some establishing shots may need manual handles.

**Strategy, phases, and replacement-asset search plan:** [PLAN.md](PLAN.md).

## Motivation

Frank Bennett’s antagonist thread (abuse, kidnapping, river dump, trial, barbecue revelation) dominates long stretches that pull focus from the Idgie / Ruth / Ninny / Evelyn emotional spine. Removing him as a face, voice, and name-driven plot dependency keeps Whistle Stop and the friendship arc — accepting some ambiguity instead of endless ADR.

## Changes

- Removes Frank Bennett on-screen scenes and the Valdosta / river-club / abuse / kidnapping / investigation / trial thread.
- Removes dialogue that names or explains Frank (SRT keyword clustering: Frank, Bennett, Valdosta, river club, trial, Scroggins, barbecue Frank, etc.).
- Manual removal: Ninny “murdered that man” gossip (~414.85s–424.34s; hard cut, no join fade). · [play 414.85–424.34](?t=414.85&end=424.34)
- TODO: removal ~435.3s–454.3s (describe from timeline/subs) · [play 435.3–454.3](?t=435.3&end=454.3)
- TODO: removal ~1375.5s–1480.3s (describe from timeline/subs) · [play 1375.5–1480.3](?t=1375.5&end=1480.3)
- TODO: removal ~1607.6s–1625.8s (describe from timeline/subs) · [play 1607.6–1625.8](?t=1607.6&end=1625.8)
- TODO: removal ~1776.6s–1795.2s (describe from timeline/subs) · [play 1776.6–1795.2](?t=1776.6&end=1795.2)
- TODO: removal ~2323.4s–2343.8s (describe from timeline/subs) · [play 2323.4–2343.8](?t=2323.4&end=2343.8)
- TODO: removal ~2575.4s–2625.3s (describe from timeline/subs) · [play 2575.4–2625.3](?t=2575.4&end=2625.3)
- TODO: removal ~3022.5s–3041.4s (describe from timeline/subs) · [play 3022.5–3041.4](?t=3022.5&end=3041.4)
- TODO: removal ~3931.8s–3999.7s (describe from timeline/subs) · [play 3931.8–3999.7](?t=3931.8&end=3999.7)
- TODO: removal ~4183.7s–4253.0s (describe from timeline/subs) · [play 4183.7–4253](?t=4183.7&end=4253)
- TODO: removal ~4375.4s–4394.6s (describe from timeline/subs) · [play 4375.4–4394.6](?t=4375.4&end=4394.6)
- TODO: removal ~4482.1s–4562.0s (describe from timeline/subs) · [play 4482.1–4562](?t=4482.1&end=4562)
- TODO: removal ~4667.7s–4834.9s (describe from timeline/subs) · [play 4667.7–4834.9](?t=4667.7&end=4834.9)
- TODO: 8 further Frank-plot removals — describe from timeline/subs; see [remove-frank-bennett-ranges.json](remove-frank-bennett-ranges.json)

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

`generate-no-frank.sh` passes **`--snap`**: removal windows are expanded to **GOP-safe** cuts — each range starts at the **last keyframe ≤** the JSON start time and ends at the **first keyframe ≥** the JSON end time (see `snap_removal_edges_to_keyframes_meta` in `scripts/kdenlive_from_subs.py`). This is slower (one `ffprobe` keyframe pass on the whole file).

It also passes **`--join-fade-sec 0.35`** and **`--join-fade-min-gap 72`**: at seams where **more than 72 seconds** of source were removed (likely a location/time jump), a short **dip-to-black / audio fade** is written on the playlist entries. Ranges with **`"join_fade": false`** in `remove-frank-bennett-ranges.json` never get that treatment at their seams (used for the Ninny gossip cut in the same room).

## Render final MKV (ffmpeg, two-pass HEVC, embedded subs)

`render_final_mkv.py` reads **`playlist2`** trim points from the `.kdenlive`, builds an ffmpeg `trim`/`concat` graph from your rip, runs **libx265 two-pass** targeting ~**source-format bitrate** (video ≈ format average minus AAC 224 kb/s), re-encodes **5.1 AAC**, then muxes **`*.kdenlive.shifted.srt`** as a default English subtitle track.

```bash
python3 "FanMixes/Fried Green Tomatoes (1991) - No Frank Bennett/render_final_mkv.py" \
  --out "/path/to/Fried Green Tomatoes (1991) - No Frank Bennett - final.mkv"
```

Paths default to the FanMix folder; override with `--kdenlive`, `--video`, `--subs`, `--passlog`. Expect **many hours** on CPU (full pass over ~1.9 h of output). Logs: `render_final_mkv.log`. Intermediate files: `/tmp/fgt_no_frank_filter.txt`, `/tmp/x265_fgt_pass.log*`, `/tmp/fgt_no_frank_nosubs.mkv` (deleted after mux).

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
