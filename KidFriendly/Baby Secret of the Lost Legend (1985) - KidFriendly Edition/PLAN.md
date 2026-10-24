# Editorial plan: *Baby: Secret of the Lost Legend* (1985) — KidFriendly Edition

Companion to [README.md](README.md) and [remove-baby-kidfriendly-ranges.json](remove-baby-kidfriendly-ranges.json).

## Goals (age ~3)

| Goal | Success |
|------|---------|
| No death or dying talk | Cholera patients, dying chief, dead dinosaur meat, father dino moaning removed |
| No guns or soldiers fighting | Tranquilizer capture, shootouts, cave bats + rifles, final Mokele-Mobembe battle removed |
| No scary night horror | Jungle screams, Susan terror, military camp with gunfire removed |
| No adult language / intimacy | Profanity, bedroom smack, pilot crude joke, “in the mood” beat removed |
| Keep wonder and Baby | Discovery, feeding, playing with hatchling, gentle care, happy reunion |

## Toddler story spine (after cuts)

1. Scientists in Africa find a mysterious bone and head upriver.
2. Fun jungle travel and pygmy village.
3. **Wow** — live brontosaurs and a friendly baby dinosaur.
4. George and Susan take care of Baby on the trail (comedy, no wasp stings).
5. Jump to happy ending — Baby back with Mom.

## Removal blocks (source timeline, seconds)

| Block | ~Time | Content |
|-------|--------|---------|
| 1 | 0:00–0:28 | OpenSubtitles ad crawl |
| 2 | 9:28–15:45 | Cholera/deaths, bedroom, George chase (“bitch”), pilot profanity |
| 3 | 16:12–17:55 | Chief preparing to die; hunters’ dead meat; villagers sick/dead |
| 4 | 25:02–26:10 | Gross ant food / “going to die” |
| 5 | 28:35–34:35 | Spooky night screams, intimacy beat, military camp gunfire/strippers |
| 6 | 40:50–51:35 | Tranquilizer attack, mom shot, gunfight, father dying, violent capture |
| 7 | 54:55–55:35 | Wasp stings / pants ripped |
| 8 | 58:55–87:18 | Helicopter, prison, battles, cave horror, Eric’s fate — **large join** to reunion |
| 9 | 89:00–end | Trailing ad card |
| 10 | 08:05–08:48 | Human-baby banter (“Carl Yastrzemski Loomis,” etc.) |
| 11 | 26:40–27:15 | Crying native child comforted (owner: cut) |
| 12 | 36:20–36:50 | Parent brontosaur roar + “not friendly” (owner: cut) |
| 13 | 56:40–57:35 | Baby nose-kiss, dragon breath, moaning (owner: cut) |

**Joins:** Block 8 removes ~28 min; uses `join_fade` (0.35 s dip when gap > 72 s) on journey → reunion.

## Director defaults (no ask needed)

- Cut all gunfire and dinosaur harm entirely (kid-friendly = remove, not soften).
- Cut profanity even when played for comedy.
- Keep pygmy village and “near beer” party — comic, not violent.
- Keep parent dinos at discovery (brief roar) — wonder with parents nearby, cut before attack.

## Owner decisions (2026-06-06)

| # | Scene | Decision |
|---|--------|----------|
| 1 | 00:08:09 human-baby talk | **Cut** |
| 2 | 00:23:42 pygmy photo/pants | **Keep** |
| 3 | 00:26:49 crying native child | **Cut** |
| 4 | 00:36:28 parent dino roar | **Cut** |
| 5 | 00:56:50 Baby nose-kiss / dragon breath | **Cut** |
| 6 | 00:58:55–01:27:18 rescue/battle arc | **Cut all** (fade join to reunion) |

## Subtitles

Sidecar: `Baby.Secret.Of.The.Lost.Legend.1985.1080p.BluRay.x264-[YTS.AG].srt` from the same rip folder. Output timeline: `.kdenlive.shifted.srt`.

## Changelog

- 2026-06-06 — Initial cut list (9 blocks); ~36 min target from ~93 min source.
- 2026-06-06 — Owner QC: cut crying child, parent roar, nose-kiss/dragon-breath; keep pygmy scene; confirm cut-all on battle arc.
- 2026-06-06 — Cut human-baby banter (00:08:09–00:08:48).
- 2026-06-07 — Final MKV rendered from local copy (~30 min / 473 MB): `C:\Videos\FanEditRender\Baby Secret of the Lost Legend (1985) - KidFriendly Edition.mkv` and NAS project folder.
