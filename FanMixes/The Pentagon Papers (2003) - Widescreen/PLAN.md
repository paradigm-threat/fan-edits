# Editorial plan: *The Pentagon Papers* (2003) — Widescreen + citations

Companion to [README.md](README.md) and [INVESTIGATION.md](INVESTIGATION.md).

Two jobs, same folder:

1. **Visual** — sharper 16:9 from the PAL DVD. No story cuts. Runtime and dialogue stay the same.
2. **Citations** — second English SRT. Default track stays dialogue-only.

**Target:** FX / Paramount TV movie (IMDb [tt0330760](https://www.imdb.com/title/tt0330760/)).

## Why this edit exists

The disc is a **4:3 PAL** master (720×576, SAR 16:15, ~1:27:56). It was framed for standard-def television. There is **no hidden widescreen negative** on this DVD. Softness is DVD + interlaced PAL, not a missing HD tape.

That is also the investigation beat: the film **was not allowed a theatrical run**. The best they could do was this made-for-TV version, and it **never saw an HD release**. Cards for that live on **English (citations)** only.

The Linux box that ripped the disc is a **Ryzen 7 5700G** (Vega iGPU only). Hugging Face video models that need CUDA will not run there in any useful way. **AI upscale happens on Windows + NVIDIA.** Linux produces the clean 10-bit HEVC, the dual English tracks, and this project folder.

## Director defaults

| Choice | Decision | Why |
|--------|----------|-----|
| Stretch 4:3 → 16:9 | **Never** | Faces and titles go wide. |
| AI outpaint left/right | **No** | Hallucinated walls/desks, flicker, wrong for a 2003 drama. |
| How to widen | **Center crop to 16:9** after square-pixel restore | Honest. Loses ~25% of height (headroom + desk). Spot-checked: Paramount card, opening credits, Ellsberg close-ups, office mediums. Titles stay; hair and desk get tighter. |
| Soft 1.66:1 | Fallback only | If a title or two-shot feels chopped in QC, recrop that pass to 1.66 instead of 1.78. |
| Upscale | **Real-ESRGAN general, 2×** | Real film/video, not anime weights. 4× then down to 1080p is optional if VRAM allows. |
| Temporal VSR (BasicVSR++ etc.) | Optional later | Only if the NVIDIA card has **16 GB+** and a test clip does not smear film grain into plastic. |
| Cadence | Keep source **50p** | nnedi already made 50p from PAL TFF. Do not drop to 25p unless the upscaler cannot keep up. |
| Audio / story | **Copy** | No cuts. English SRT is already PAL-timed. |
| Default subs | Dialogue only | Never write `[…]` into `*.english.srt`. |
| Enhanced subs | Beat-locked citations | McNaughton / Tonkin / TV-only / no HD. ≥0.4s pad from speech. |

## Geometry

1. Restore square pixels: `720×576` → `768×576` (`scale=iw*sar:ih`).
2. AI 2×: `1536×1152` (still 4:3).
3. Center crop 16:9: `1536×864`.
4. Optional fit: `1920×1080` (lanczos) if the TV prefers even 1080p.

Crop first, then upscale, is faster but worse at the new edges. **Upscale full 4:3, then crop.**

## Source chain

1. PAL `VIDEO_TS` (European disc: image subs **da / nl / no / pt / sv** only — no English).
2. Linux encode: concat-protocol VOBs, nnedi 50p, x265 **10-bit CRF 15** → `The Pentagon Papers (2003).mkv`.
3. English default SRT from Subtitle Cat (HANDJOB, 1488 cues, retimed to PAL). OpenSubtitles `6271248` is the **wrong** 55-minute film — do not use.
4. Enhanced SRT: copy of that dialogue plus citation cards (see INVESTIGATION.md).
5. Windows: copy the dual-track MKV local, upscale, crop, remux **both** English tracks (duration unchanged).

## Hardware split

| Machine | Job |
|---------|-----|
| Linux 5700G | DVD → 10-bit HEVC, remux default + citations, this repo, NAS sync of **docs** and the 4:3 library file. |
| Windows NVIDIA | Real-ESRGAN (or Video2X) + crop + final HEVC. **8 GB VRAM** is enough for 2× tiles. |

## Citation beats (do not invent new ones in random gaps)

| Picture / line | Card |
|----------------|------|
| Opening titles | FX TV; not allowed in theaters; no HD; AU-058 crest |
| “We've got company.” hold | Under-watched; Hanyok still classified in 2003 |
| McNaughton hire | 1964 pipeline; AU-060 RAND name |
| “I reported to John McNaughton” | ISA; SecNav-designate; “never say lie” |
| Johnson Tonkin speech | Second attack did not happen as sold (Hanyok 2005) |
| “wrong side” / “hawk that killed the dove” | Wannabe antibody |
| “freak plane accident” / condolence hold | AU-059 lock; Piedmont 22; Papers seed |
| “McNaughton secretly knew” | Named transfer |
| “It's treason.” / NYT | 1971 rupture |
| “Pentagon Papers” news | Film as bridge title to 2005 SIGINT |
| Court / dismissal hold | TV ceiling; no HD; AU-058/059/060 |

## QC before calling it done

- [ ] Paramount / FX / “THE PENTAGON PAPERS” cards: no chopped wordmarks.
- [ ] Opening credit names (centered white type) fully in frame.
- [ ] Ellsberg close-ups: hairline ok; chin not clipped.
- [ ] Office two-shots: desk stack and map not essential, faces intact.
- [ ] No plastic skin / shimmer on grain (try `realesr-general-x4v3` denoise 0 if it looks waxy).
- [x] English SRT still default; citations are a second English track, not default.
- [x] `ffprobe` duration ≈ 1:27:56.
- [ ] Widescreen MKV remuxes **both** tracks after the NVIDIA pass.

## Changelog

- 2026-09-24 — Project created. Crop vs 4:3 stills reviewed. Upscale deferred to Windows NVIDIA.
- 2026-09-24 — Enhanced SRT: McNaughton / AU-058–060 / theatrical-suppression + no-HD thesis. Library 4:3 MKV remuxed with two English tracks.
