# Spirited Away (2001) — Alena Edition

English-dub cut for Alena. Same scary-beat removals as the Kid friendly edition, except **No-Face**: gold, eating the frog, the rampage, and the “calm down” / dumpling confrontation are out. The join lands on **him spitting the frog back out**.

## Motivation

English-dub cut for Alena. Same scary-beat removals as the Kid friendly edition, except **No-Face**: gold, eating the frog, the rampage, and the “calm down” / dumpling confrontation are out. The join lands on **him spitting the frog back out**.

Alena Edition removals for Spirited Away (2001). Source seconds on the NoobSubs 720p rip. No-Face gold / frog-eat / havoc / calm-down is one window that lands on him spitting the frog back out.

## Changes

- Parents-to-pigs arc removed (food stalls → Haku helping Chihiro)
- Spirit-bridge nightmare trimmed
- Yubaba giant-head intimidation shortened
- Stink Spirit / slug purge removed
- No-Face gold / frog-eat / havoc / calm-down removed; **frog spit-out stays**
- Pig-barn grotesque shots trimmed before the parent test
- Parents gorging at food stalls through pig transformation, until Haku finds Chihiro
- Spirit bridge crossing — faceless ghosts, hold breath
- Yubaba giant-head witch office intimidation through death threats
- Stink Spirit arrival, slug/toxin purge, grotesque bath
- No-Face offers gold (01:08:39), eats the frog, morning gold-feast/havoc, Haku injury intercut, rampage, lonely 'I want Sen' / dumpling calm-down. Resume on the silent vomit (01:35:16) so the frog coming back out stays.
- Turn parents into bacon or ham
- Pig barn grotesque close-ups before parent test


## Source media (not in git)

`/Anime/Studio Ghibli Movies (1984-2014)/ Spirited Away~Sen to Chihiro no Kamikakushi (720p Blu-ray 8bit Dual Audio) [NoobSubs] [FAE6635D].mkv`

(Note leading space in the rip filename.)

- **Video:** 1280×692 H.264 8-bit, 23.976 fps
- **Audio:** English 5.1 AC3 (stream 1)
- **Subs:** Coalgirls English from the rip (`Spirited Away (2001) - Alena Edition.srt`)

## Build

```bash
bash "KidFriendly/Spirited Away (2001) - Alena Edition/generate-spirited-away-alena.sh" \
  "/Anime/Studio Ghibli Movies (1984-2014)/ Spirited Away~Sen to Chihiro no Kamikakushi (720p Blu-ray 8bit Dual Audio) [NoobSubs] [FAE6635D].mkv"
```

```bash
python3 scripts/check_kdenlive_sync.py \
  --project "KidFriendly/Spirited Away (2001) - Alena Edition"
```

## Render (other PC — copy rip to local disk first)

```bash
python3 "KidFriendly/Spirited Away (2001) - Alena Edition/render_final_mkv.py" \
  --video "/path/to/local/Spirited Away rip.mkv" \
  --out "/path/to/local/Spirited Away (2001) - Alena Edition.mkv"
```

Muxes `Spirited Away (2001) - Alena Edition.kdenlive.shifted.srt` as default English.

## Changelog

- 2026-09-26 — Project created. No-Face gold/eat/havoc/calm-down cut; resume on frog spit-out.
