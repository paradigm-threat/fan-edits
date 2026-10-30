# Editorial plan: *Boogie Nights* (1997) — The Dream

Companion to [README.md](README.md) and [remove-the-dream-ranges.json](remove-the-dream-ranges.json).

## 1. Goal

Remove the **bad-scene block** from the office whip-pan through On the Lookout **and** the donut-shop stick-up/kill. Land on the film’s own **fade to black at 2:05:19**, then the original hold and fade-up into the Rahad-planning scene. Also remove the Colonel’s jail beating (**2:20:47.798–2:21:20.646**). The timeline in the Kdenlive file is the cut. Do not regenerate it from this plan.

## 2. What the window contains (this rip)

| Approx | Content |
|--------|---------|
| 1:45:51 | Reed's last demo-tape line (*“We look like assholes right now, man.”*) |
| **1:45:56** | PTA **whip-pan** out of the gold-record office |
| 1:46:00+ | Amber/Dirk “I don't wanna do this anymore” |
| 1:47:14+ | Dirk's bank loan humiliation |
| 1:49:32+ | Explicit sex insert |
| 1:50:00+ | Amber custody hearing |
| 1:53:11–2:01:32 | Jack & Rollergirl **On the Lookout** |
| 2:01:45 | Night-drive montage (Vons / Miss Donuts / Kids Mart / Star Light) |
| 2:02:14–2:05:18 | Buck & Jessie at the donut shop → stick-up |
| **2:05:19.000** | First fully black frame (luma ≈ 1) |
| 2:05:19–2:05:24.25 | Held black |
| 2:05:24.5+ | Fade-up: Rahad Jackson planning (*“The guy's name is Rahad Jackson.”*) |

## 3. Snap decisions

| | Owner | Snapped | Why |
|--|-------|---------|-----|
| Out | 1:45:55 | **1:45:56.058** | One frame before the whip-pan. 1:45:51 would clip Reed's line. |
| In | 2:05:19 | **2:05:19.000** | First measured black frame. 2:05:18.75 still has picture from the kill. |

Removed ~19.4 min of source.

## 3b. Colonel jail beating

| | Snapped | Why |
|--|---------|-----|
| Out | **2:20:47.798** | After “Buck, honey, that was great.” |
| In | **2:21:20.646** | After the jail beating. The Spanish countdown has already started. |

Removed ~32.8 s. Hard cut. A Beach Boys song covers the scene, so the song breaks at the join. That break stays.

The timeline starts the next scene’s audio at source **2:21:15.933**, about 4.7 s under the end of Buck’s take. Picture stays on Buck until **2:21:20.646**. The encode keeps that lead, then locks sound to picture.

## 4. Seam

Office → `xfade=fadeblack` 0.50 s + `acrossfade` onto the film’s own black, then PTA’s hold and fade-up. Do **not** GOP-snap. The Colonel join is a hard cut.

## 5. Story cost (accepted)

Keep Reed’s tape argument and Little Bill’s New Year’s suicide. Skip Amber’s collapse, the loan, custody, On the Lookout, and the donut-shop stick-up. Resume at the coke-deal planning scene.

## 6. QC

- [ ] Seam preview: office fades through black; no donut robbery; next picture is the living-room planning scene.
- [ ] Shifted subs jump from Reed’s tape argument to “All right, this could be the thing.”
