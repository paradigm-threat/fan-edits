# Editorial plan: *The Mummy Returns* (2001) — Debugged

Companion to [README.md](README.md) and [remove-mummy-returns-debugged-ranges.json](remove-mummy-returns-debugged-ranges.json).

**Target:** kid-friendlier adventure cut, matching *The Mummy (1999) - Debugged*.

**Source:** `The Mummy Returns - Action 2001 Eng Subs 1080p [H264-mp4].mp4` + sidecar `.srt`.

This rip’s English SRT has **no “scarab” cue**. The 1999 flesh-eating beetle dump is not repeated as a set piece. The closest analogue is the **pygmy swarm** that overruns the expedition (little creatures killing/eating people). Izzy later jokes about “mummies, pygmies, big bugs.”

## Director defaults (cut without asking)

| Beat | Time | Why |
|------|------|-----|
| First pygmy overrun | **01:27:18–01:28:37** | After “Where’s the boy?” through snarling/screaming camp attack. Resume “The black book!” |
| Swarm continue | **01:30:26–01:31:42** | More eat/chase gunfire. Resume “Let’s go / Thank God for that.” |

Keep Alex/bracelet/family lines around those windows. Tighten in Kdenlive — SRT misses silent kills.

## Keep

- Scorpion King prologue (war, not beetles — see questions)
- O’Connell family / bracelet / Imhotep plot
- “What were those creepy little pygmy things?” (plays as a scare that already ended)
- Finale vs Scorpion King

## Removal confirmations

1. **Pygmies** — Treat as the scarab-equivalent and cut the eat-swarm (default)? Or leave because they are not scarabs?
2. **Opening Scorpion King campaign** — Mass combat, not bugs. Keep for v1?
3. **Anubis warriors / scorpion transformation** — Creature violence. v1 keep, or expand?
4. **Any scarab insert** this rip’s subs missed — flag during QC if beetles eat someone on screen.

## QC (after local rip + generate)

- [ ] No pygmy eating/close-up swarm; bracelet/Alex plot still lands
- [ ] Spot-check for scarabs (silent) the SRT did not name
- [ ] Joins: hard cuts; no `--snap`

## Changelog

- 2026-09-19 — Project created; pygmy-swarm windows from SRT (not yet scene-snapped).
