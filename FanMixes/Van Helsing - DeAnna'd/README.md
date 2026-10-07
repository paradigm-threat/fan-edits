# Van Helsing (2004) — DeAnna'd

Cut that removes **Anna** as much as possible without plot or context regression, and strips as many cringe beats as we can — especially with the Frankenstein monster. Select score beds are swapped for *Castlevania: Symphony of the Night* cues (`castlevania-symphony_of_the_night_ost/`, not in git).

## Stats

Machine-readable: [`stats.json`](stats.json) (ffprobe, 2026-10-07).

| | |
| --- | --- |
| **Original** | Van Helsing (2004) |
| **Type** | FanFix |
| **Film running time** | 2:11:37 |
| **Fanedit running time** | 1:23:32 |
| **Time cut** | 0:48:05 |
| **Available in** | 2160p HEVC MKV (AAC), ~2.61 GB |
| **Poster** | [`poster.jpg`](poster.jpg) |

## Motivation

First contact was a pirate rip (not a theater night). The surprise was how much **flair and color** the movie had — ideas that felt new and unique at the time, a Van Helsing who had never quite been *wanted* like this before. Comic-book and tropey, yes, and that was mostly fine. What was not fine was the **editing**: constantly chopped, obnoxious, excessive, lined with cringey statements that kill the action flow. Most productions shoot more than they keep because some takes do not fit. Here too much of the wrong material stayed in.

That flair is not an accident of “random Universal monster movie.” It is the same adventure DNA as *The Mummy* (1999) / *The Mummy Returns* (2001): **Stephen Sommers** writing/directing, **Alan Silvestri** scoring, **Bob Ducsay** producing/editing, and on-screen continuity like **Kevin J. O’Connor** (Beni → Igor). Unnoticed on first watch; obvious in hindsight. Mummy 1 and 2 did not have this editing problem. Van Helsing did — and so did *The Mummy: Tomb of the Dragon Emperor* (2008, Rob Cohen), which is a later franchise collapse rather than the same Sommers unit. Something went wrong on this Universal adventure track.

Contemporary reviews said the quiet part out loud: Sommers “dancing as fast as he can” so nobody notices the story ([Salon](https://www.salon.com/2004/05/07/van_helsing/)); no sense of pacing, conversations interrupted by noise and collapse; Kate Beckinsale stuck with a bad Transylvanian accent and tin-pot lines ([Slate](https://slate.com/culture/2004/05/van-helsing-cursed.html), [EW](https://ew.com/article/2004/05/05/van-helsing-2/)). Blame lands on the **director’s choices** — capturing bad takes and printing them — though it is also plausible the shoot produced gold and the **cut** got compromised (hamstrung schedule, effects pile-up, editorial pressure). Ducsay later called the bulk of the film “muscular and cut-y” next to the calmer black-and-white open ([SYFY retrospective](https://www.syfy.com/syfy-wire/van-helsing-stephen-sommers-retrospective-interview)). Either way: the value is real, and watching it stock means cringing through it.

This edit exists because the movie is worth saving. **DeAnna:** keep only what the story still needs from Anna; drop the rest (too many shots, establishers, intros, and bad lines delivered badly — she is not a bad actress; those takes should not have survived). **Cringe:** cut tone-breaking comedy and awkward monster beats, especially Frankenstein’s creature, when the plot can stand without them. **Flow:** restore action continuity that the theatrical cut keeps interrupting.

## Changes

- Reduce Anna to story-essential beats only (drop excess establishers, intros, and bad line-readings)
- Cut tone-breaking comedy and awkward Frankenstein-monster beats when the plot can stand without them
- TODO: list specific Anna removal windows (describe from timeline/subs)
- TODO: list specific Frankenstein / cringe removal windows (describe from timeline/subs)
- TODO: list other tone-breaker trims for action flow (describe from timeline/subs)

## Score note — Dracula's Castle ↔ Silvestri

Fans often connect Symphony of the Night’s **“Dracula's Castle”** with Alan Silvestri’s **“Journey to Transylvania”** / **“Attacking Brides.”** That link is unverified, but the four-note idea shows up about three times in the movie, and the odds of it being a coincidence are quite unlikely.

- **The progression:** Both tracks use a driving, syncopated bass line with a rising, minor-key melodic hook and sudden brass stabs.
- **The shared motif:** The four-note progression that loops in the heavy rhythm sections of the Van Helsing track heavily mirrors the iconic opening chord progression Alucard runs to when first entering the castle.

On-screen cards for this (and related score notes) live on the **English (citations)** track — see below.

## Extra audio (on timeline)

From `castlevania-symphony_of_the_night_ost/`:

- *04 Symphony of the Night*
- *06 Dracula's Castle*
- *08 Marble Corridor*
- *09 Tower of Evil Fog*
- *11 Woodcarving Palteeta*

## Subtitles

Sidecars live in `subs/` so players do not auto-load them beside the MKV.

| File | Role |
|------|------|
| `subs/Van Helsing - DeAnna'd.english.srt` | **Default** mux — dialogue only. |
| `subs/Van Helsing - DeAnna'd.enhanced.srt` | **English (citations)** — dialogue plus short beat-locked score/cast notes. |
| `Van Helsing - DeAnna'd.kdenlive.srt` | Working output-timeline dialogue (same as english). |

Citations never go on the default track.

```bash
python3 scripts/remux_subtitles.py \
  --video "/media/ari/HD/FanEditRender/Van Helsing - DeAnna'd/Van Helsing - DeAnna'd.mkv" \
  --subs "FanMixes/Van Helsing - DeAnna'd/subs/Van Helsing - DeAnna'd.english.srt" \
  --subs-enhanced "FanMixes/Van Helsing - DeAnna'd/subs/Van Helsing - DeAnna'd.enhanced.srt" \
  --title "English" \
  --title-enhanced "English (citations)" \
  --out "/media/ari/HD/FanEditRender/Van Helsing - DeAnna'd/Van Helsing - DeAnna'd.mkv"
```

## Source media (not in git / not in FanEdits)

Library rip stays in the normal movie folder — **not** under `FanEdits/FanMixes/`.

- **NAS:** `/share/Public/Videos/Horror and SciFi/Van Helsing (2004) [2160p] [4K] [BluRay] [5.1] [YTS.MX]/Van.Helsing.2004.2160p.4K.BluRay.x265.10bit.AAC5.1-[YTS.MX].mkv`
- **Local (Kdenlive):** `/home/ari/Videos/Van Helsing (2004) [2160p] [4K] [BluRay] [5.1] [YTS.MX]/Van.Helsing.2004.2160p.4K.BluRay.x265.10bit.AAC5.1-[YTS.MX].mkv`

Working scrub copy (frame-matched 1080p all-I, same packet count as the 4K):  
`/media/ari/HD/FanEditRender/Van Helsing - DeAnna'd/Van Helsing (2004) edit-1080p.mp4` — open `Van Helsing - DeAnna'd.edit.kdenlive` for that file. Final render project is `Van Helsing - DeAnna'd.kdenlive` (4K).

**Render is on another PC** (NAS project + library rip). Do not mux or re-encode the feature on this machine unless asked.
