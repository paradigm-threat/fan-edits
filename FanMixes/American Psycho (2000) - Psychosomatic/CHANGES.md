# Changes — American Psycho (2000) - Psychosomatic

## Method (read this)

| File | Use? |
| --- | --- |
| `playlist4` in current `.kdenlive` | **Yes** — hole times (certain) |
| `subs/American.Psycho.2000.Remastered.1080p.srt` | **Yes** — scene labels (matches wired Remaster picture) |
| `*.kdenlive.srt` / `*.srt` / `*.ass` | **No for labels** — they **skip the homeless-murder dialogue** and drift after ~00:20:07 vs Remaster |

Earlier CHANGES drafts labeled holes from the project/`kdenlive.srt` clock. That is why hole 1 looked like “spa + Christmas” instead of the **homeless murder**. Remaster SRT at the same source times shows Al in the alley.

## Intent

Remove **shock sex** and **on-screen murder / gore**. Keep creepy implication.

## Stats

- Picture holes: **6** (~13.2 min removed)
- Edit length: ~**88.9 min** (source ~102.1 min)

## Removals (source times × Remaster SRT)

### 1. 00:20:07.507 – 00:22:28.195 (140.7s / ~2.3 min)

- **Join:** business-card “You’re sweating.” → **spa skin** “What beautiful skin you have, Mr. Bateman.” (~00:22:33).
- **Removed (Remaster SRT):** **Homeless Al murder** — “Hello. Pat Bateman.” / money-food / “Get a goddamn job, Al.” / “You reek of shit” / “fucking loser…” through the kill.
- Spa facial + blood-lust VO resume *after* the hole (kept). Morning-routine lotion (~00:05) is unrelated and stays earlier.
- Project/`kdenlive.srt` falsely put spa/Christmas *inside* this window — ignore those labels.

### 2. 00:28:26.276 – 00:28:33.367 (7.1s)

- **Join:** mid–Huey “Hip To Be Square” axe rant → (next kept dialogue much later is Luis / overnight bag).
- **Removed:** extended **axe-striking** on Allen — Remaster cues “you fuckin’ stupid bastard!” / “You fucking bastard!” over the hits.
- **Intent:** excessive violence trim; surrounding Huey monologue stays.

### 3. 00:37:04.838 – 00:37:25.692 (20.9s)

- **Join:** end of first Kimball visit (“Bye-bye”) → street/Christie pickup (~00:38:01).
- **Removed:** Bateman **working out** while a **chainsaw-murder movie** screams on the TV — no dialogue cues in Remaster SRT (screams/undertone only).
- **Intent:** excessive tension trim.

### 4. 00:39:01.251 – 00:46:19.519 (438.3s / ~7.3 min)

- **Join:** after Christie is in the limo and agrees to the arrangement → **00:46:19.519** lobby/bar scene discussing girl personalities (“If they have a good personality…”).
- **Removed:** entire **prostitute arrival, sex, and murder** block — Sabrina arrives, Phil Collins / “Sussudio” / camera threesome, and the kill(s).
- **Intent:** strip **all nudity, crude language, sex, and violence** in this stretch in one long razor.

### 5. 01:13:45.796 – 01:16:16.975 (151.2s / ~2.5 min)

- **Join:** after flirting with the prostitutes and the **Whitney Houston** talk (“beautifully stated on the album”) → **next day** dinner with Evelyn (fiancé), where he draws a reenactment of the murder (“I want a firm commitment” / homicidal-behavior beat).
- **Removed:** entire **sex and murder** sequence with Christie/Elizabeth (Remaster only sparsely cues the violence — “Not the face!” / “You bitch, not the fucking face…”).
- **Intent:** same deshock pattern as hole 4 — no on-screen sex/gore; implication via the dinner drawing after.

### 6. 01:18:53.387 – 01:19:25.025 (31.6s)

- **Join:** Evelyn “I have to return some videotapes.” → police chase (“Drop the weapon!”).
- **Removed:** **“Feed me a stray cat”** ATM beat and the **witness murder** (Remaster cues “Here, kitty, kitty.” / “Oh, my God. What are you doing?” / “Stop that.”).
- **Intent:** that stretch is widely read as **in his head** (an ATM cannot say that), so cutting it leaves a **dream-like** chase that starts for unclear reasons. Unspoken: he already knows he’s guilty of various murders — a just-now kill is not what he’s running from.

## Still in cut (Remaster landmarks outside holes)

Confirm on picture if still too graphic:

- Spa facial + blood-lust VO (~00:22:33+) — **kept** after hole 1
- Office Christmas — **kept** (not in hole 1 on Remaster clock)
- Most of Allen Huey monologue — **kept**; only the ~7s extended axe-striking in hole 2 out
- First Kimball visit — **kept**
- Whitney / flirting setup with Christie & Elizabeth — **kept**; sex/murder in hole 5 out; Evelyn dinner drawing stays after
- Evelyn breakup through “videotapes” — **kept**; ATM cat / witness kill in hole 6 out; chase stays after

## TODO

1. **Retarget the subtitle filter** to `subs/American.Psycho.2000.Remastered.1080p.srt` (or regenerate `kdenlive.srt` from it) if not already. Project SRT mislabels after ~20:07.
2. Picture-check spa skin / Christmas still-in-cut vs intent (spa resumes right after hole 1; not cut here).
