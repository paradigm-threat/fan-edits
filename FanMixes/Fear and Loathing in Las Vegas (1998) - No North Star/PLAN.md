# Editorial plan: *Fear and Loathing in Las Vegas* (1998) — No North Star

Companion to [README.md](README.md) and [remove-north-star-ranges.json](remove-north-star-ranges.json).

## 1. Goal

Remove the **North Star Coffee Lounge** scene (Gonzo terrorizes the waitress with the knife; Duke narrates) without a mid-shot jump. Keep Duke's preceding narration and the Red Shark run to the airport.

## 2. Source times (this rip)

Owner window: **1:41:44–1:47:02**.

| | Owner | Snapped shot cut | Picture |
|--|-------|------------------|---------|
| Out | 1:41:44 | **1:41:44.098** (one frame before the detected cut at 1:41:44.140) | Last knife/cigar frame; next source frame is diner neon |
| In | 1:47:02 | **1:47:03.208** | First frame of Duke driving the convertible. Waitress sobbing stays in the removal. Next cue is “It was all over now.” |

Audio: ~2.9 s of near-silence ending at **1:47:02.14**, then the car scene. Join sits on that quiet + shot change.

## 3. Why the narration still works

Kept line: *“…a really massive crime often slips by unrecognized.”*

Resume: *“It was all over now. We'd abused every rule that Vegas lived by…”*

The diner is the crime the first line names; skipping the depiction leaves the reflection intact.

## 4. Seam

- Picture: **hard cut** on the detected shot transitions (knife/cigar → Red Shark). No dissolve.
- Sound: **0.5 s fade-out** on the knife room, **0.5 s fade-in** on the Red Shark (no overlapping acrossfade, so the picture in/out points stay put).
- Do **not** GOP-snap (`--snap`) — we re-encode, and GOP expansion would pull diner neon back in.

## 5. QC

- [ ] Seam preview: last knife/cigar frame cuts to the Red Shark; no waitress, no neon BURGERS.
- [ ] No leftover knife payoff expected (Chekhov leftover is acceptable; the diner was the payoff).
- [ ] Shifted subs: last kept cue before join is the “unrecognized” line; first after is “It was all over now.”
