# Editorial plan: *Pee-wee's Big Adventure* (1985) — KidFriendly Edition

Companion to [README.md](README.md) and [remove-pee-wee-kidfriendly-ranges.json](remove-pee-wee-kidfriendly-ranges.json).

**Target audience:** ~3 years  
**Source:** 1080p H.264 / AAC, ~91 min (`5486 s`)

## Owner decisions (confirmed)

| Item | Decision |
|------|----------|
| Bike theft | **Keep** — remove clown close-ups only (manual Kdenlive QC) |
| Basement evidence board | **Remove** full scene |
| Francis pool / breakfast / basement | **Remove** (bad manners, conspiracy) |
| Francis premiere | **Keep** — bike sit / *"sit on it"* callback |
| Mickey ride | **Keep** |
| Simone diner / sunrise / Paris | **Remove** — keep bus-station goodbye only |
| Large Marge / T-rex dream / Andy / Jack train | **Remove** — wipe into full Alamo tour |
| Andy bus-station + Lloyd rodeo | **Remove** — join amnesia beat |
| Biker bar | **Trim** death-threat chants; keep Tequila dance |
| WB nightmare | **Remove** — fade to black into Kevin Morton presentation |
| Twisted Sister | **Trim** *Burn in Hell* only (~10 s); keep Santa + Godzilla |

## Goals (age ~3)

| Goal | Success |
|------|---------|
| No frightening imagery | Clown close-ups, Large Marge, Andy giant, T-rex dream, WB nightmare, hell song trimmed |
| No Francis bad manners (early) | Breakfast, pool, basement cut; premiere kept for closure |
| No paranoid basement rant | Evidence board removed |
| Keep joy | House, bike, Dottie, Mickey, Alamo, Simone bus goodbye, Tequila, studio chase, Francis premiere, happy end |

**Estimated output:** ~63 min after automated cuts + clown trim QC.

## Removal blocks (source timeline, seconds)

| Block | ~Time | Content |
|-------|--------|---------|
| 1 | 10:23–11:57 | Francis breakfast |
| 2 | 21:54–31:18 | Francis at police through turf; **0.35 s audio crossfade** to Madam Ruby |
| 3 | 41:30–52:38 | Large Marge, Simone diner, T-rex dream, Andy, Jack train; **wipeleft** into Alamo welcome |
| 4 | 59:10–61:39 | Andy bus-station + Lloyd rodeo; join *"What's your name?"* amnesia |
| 5 | 62:42–64:13 | Biker kill/hang/stomp chants (Tequila kept) |
| 6 | 66:45–68:38 | WB nightmare; **fade to black** into Kevin Morton |
| 7 | 76:19–76:29 | Twisted Sister *Burn in Hell* only (10 s) |

**Manual QC (not in JSON):** During bike theft (~18:28–19:26), delete clown close-ups and horror-marquee inserts; keep Pee-wee discovering the bike is gone and police beat.

### Join notes

| Seam | Strategy |
|------|----------|
| After Francis cut (opening) | Hard cut from bike ritual → Mario's shop |
| Police → Madam Ruby | 0.35 s audio crossfade |
| Mickey → Alamo welcome | **wipeleft** (~0.5 s) at *"Welcome to the San Antonio Department…"* |
| Biker farewell → WB lot | **fade to black** (~0.75 s) through nightmare gap |
| Other trims | Hard cut |

## Keep list

- Pee-wee house, breakfast, bike, Mario's shop, Dottie horn / drive-in
- Bike theft (no clown CU), police brush-off, Madam Ruby / Alamo clue
- **Mickey** hitchhike
- **Full Alamo tour** from welcome line through basement gag
- Simone **bus-station** goodbye; Dottie phone apology
- Amnesia / *"I remember the Alamo"*
- **Tequila** biker dance
- Warner Bros chase (Santa + Godzilla kept; hell song out)
- **Francis at premiere**; Dottie drive-in ending

## Changelog

- 2026-05-24 — Initial plan from owner brief.
- 2026-05-24 — Owner confirmed cuts; Francis removed entirely; cut JSON + generate script added.
- 2026-05-25 — Join fixes: Simone diner out, Alamo welcome in, Andy+Lloyd out, WB nightmare fade, Francis premiere restored, narrow hell trim.
