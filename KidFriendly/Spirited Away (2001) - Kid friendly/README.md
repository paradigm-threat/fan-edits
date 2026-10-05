# Spirited Away (2001) — Kid friendly

English-dub cut for a **3-year-old** viewer: removes blood, body horror, predatory eating, witch intimidation, and sustained fright beats.

## Motivation

English-dub cut for a **3-year-old** viewer: removes blood, body horror, predatory eating, witch intimidation, and sustained fright beats.

More detail on *why* each beat was cut still belongs here — fill in as you QC.

## Changes

- Parents-to-pigs arc removed entirely (jump from ghost-town food stalls to Haku helping Chihiro)
- Spirit-bridge nightmare trimmed
- Yubaba giant-head intimidation shortened
- Stink Spirit / slug purge removed
- No-Face eating, Haku dragon injury (**extended ~10.5 min**), and No-Face rampage merged into one excision; resumes at train platform
- Pig-barn grotesque shots trimmed before the parent test


## Source media (not in git)

Place the owned rip at:

`/Anime/Studio Ghibli Movies (1984-2014)/ Spirited Away~Sen to Chihiro no Kamikakushi (720p Blu-ray 8bit Dual Audio) [NoobSubs] [FAE6635D].mkv`

(Note leading space in filename.)

- **Video:** 1280×692 H.264 8-bit, 23.976 fps  
- **Audio:** English 5.1 AC3 (stream 1)  
- **Subs:** extracted from embedded Coalgirls ASS (stream 4)

## Build

```bash
bash "KidFriendly/Spirited Away (2001) - Kid friendly/generate-spirited-away.sh" "/path/to/Spirited Away~....mkv"
```

## Render

Copy source from NAS to local disk first, then:

```bash
python3 "KidFriendly/Spirited Away (2001) - Kid friendly/render_final_mkv.py" \
  --video ~/Videos/FanEditRender/Spirited\ Away\ \(2001\)\ -\ Kid\ friendly/*.mkv \
  --out ~/Videos/FanEditRender/Spirited\ Away\ \(2001\)\ -\ Kid\ friendly/Spirited\ Away\ \(2001\)\ -\ Kid\ friendly\ -\ final.mkv
```

## Changelog

- 2026-06-01 — Initial kid-friendly cut; extended Haku dragon removal (4840–5478 s).
