# Changes — American Psycho (2000) - Psychosomatic

Cut list from the Kdenlive timeline versus the original feature. A hole is a
source-time window that is not on the video playlist (`playlist4`).

## Intent

Remove **shock sex** and **on-screen murder / gore spectacle**. Keep the creepy
satire and implied horror — enough of a horror movie without watching the kills
happen.

## Timing confidence

| Claim | Confidence | Notes |
| --- | --- | --- |
| Hole **start/end times** | **Certain** | From `playlist4` in/out; matches `seams/seams.srt`. |
| **Removed dialogue** lists | **Probable** | Source-timed project SRT overlap. Same clock as `.kdenlive.ass` (**not** edit-shifted). |
| **Scene names vs shock intent** | **Best-effort** | Inferred from cues; silent gaps = **TODO**. |
| SRT ↔ Uncut picture sync | **Unverified** | Kdenlive points at YTS **UNCUT** 2160p (torrent only here). Remaster 1080p + SRT live on NAS `Videos/Christmas/…` and in `subs/` — remaster SRT clock is **~10 min offset** vs project SRT (different pad/edition); use for dialogue text, not raw times. |

## Project files

- Kdenlive / SRT / ASS: pulled from NAS FanMixes (other-computer sync)
- Remaster SRT reference: `subs/American.Psycho.2000.Remastered.1080p.srt`
- Picture holes: **6** (~13.2 min of source removed)
- Edit length: ~**88.9 min** (source ~102.1 min)

## Removals (source times)

### 1. 00:20:07.507 – 00:22:28.195 (140.7s / ~2.3 min)

- **Join:** “You’re sweating.” → “Marcus Halberstram for two…”
- **From subs:** Attendant spa (“What beautiful skin…”) + **blood-lust /
  “mask of sanity” VO**, then office Christmas (mistletoe / Snowball / Nell’s).
- **Shock read:** cuts the frenzy/horror VO. Christmas may be collateral —
  **TODO (picture/intent).**
- *Not* the opening morning-routine lotion VO (~00:05), which stays.

### 2. 00:28:26.276 – 00:28:33.367 (7.1s)

- **Join:** “London. I’ll send the ass to London.” → Paul’s answering machine.
- **No subs.** Falls right after packing / “disposing of the body” VO.
- **TODO (picture):** likely brief **body-disposal / gore** residual.

### 3. 00:37:04.838 – 00:37:25.692 (20.9s)

- **Join:** TEOTWAWKI anecdote → “That’s… Very nice, Luis.”
- **From subs:** “What her head would look like on a stick” + Luis card intro.
- **Shock read:** drops the verbal decapitation punchline.

### 4. 00:39:01.251 – 00:46:19.519 (438.3s / ~7.3 min)

Long contiguous block. Subtitle-inferred breakdown:

| Source window | From subs / shock read |
| --- | --- |
| 00:39:01 – 00:39:23 | Christie exit — “I want you” / “videotapes.” |
| 00:39:23 – 00:39:48 | **TODO (picture)** — ~25s silent. |
| 00:39:48 – 00:41:43 | Second Kimball office follow-up (Huey for detective again). *May be collateral — TODO restore?* |
| 00:41:43 – 00:42:19 | **TODO (picture)** — ~36s silent. |
| ~00:42:35 | **Uncut shock-sex / threesome** window (known Uncut vs R delta) — primary shock-sex target in this block. |
| 00:42:19 – 00:43:42 | Courtney goodbye. |
| 00:43:42 – 00:44:13 | **TODO (picture)** — ~30s silent. |
| 00:44:13 – 00:44:32 | AIDS / “catch anything” dinner rant. |
| 00:44:32 – 00:44:45 | **TODO (picture)** — ~12s silent. |
| 00:44:45 – 00:45:13 | Club bathroom coke. |
| 00:45:13 – 00:45:35 | **TODO (picture)** — ~22s silent. |
| 00:45:35 – 00:46:19 | Club talk into “murders and executions”; resumes at “where do you work out?” |

### 5. 01:13:45.796 – 01:16:16.975 (151.2s / ~2.5 min)

- **From subs:** Realtor at Allen’s apartment (“Are you my 2:00?” / no *Times* ad)
  + Jean phone (“dumb bitch,” “Just say no!”).
- **TODO (picture):** ~30s gap after “Don’t worry.” — ATM / street insert?
- Long silence before in-point — name incoming shot on picture.

### 6. 01:18:53.387 – 01:19:25.025 (31.6s)

- **Join:** Carnes “Bryce or McDermott…” → “Don’t you know who I am?”
- **From subs:** Mid-confession press including “I chopped Allen’s fucking head off.”
- **Shock read:** trims the baldest gore confession blurt; surrounding Carnes
  misunderstanding stays.

## Still in cut — conflicts with “no on-screen murders”

Confirm on picture; cut further if still graphic:

- **Allen axe murder** + Huey Lewis monologue (~00:24–00:28) — still on picture playlist.
- **Christie / Elizabeth** evening (~00:57–01:05) — still in; check sex/murder frames.
- Opening restaurant, morning routine, business cards, first Kimball, late Carnes
  comedy (minus hole 6), Smith & Wollensky Kimball *mention* (~00:54).

## TODO — picture / edit pass

1. Restore Uncut 4K source; frame-check project SRT.
2. Cut or verify **Allen murder** and **Christie/Elizabeth** vs stated intent.
3. Name hole **2** and hole **4** silent bridges.
4. Decide whether second Kimball / Christmas / Courtney were intentional or collateral.
5. Edit-shifted SRT for the render.
