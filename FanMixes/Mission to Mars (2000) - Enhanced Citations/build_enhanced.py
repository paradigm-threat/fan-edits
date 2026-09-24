#!/usr/bin/env python3
"""Build Mission to Mars enhanced SRT: theatrical dialogue + AU-062 cards in gaps."""
from __future__ import annotations

import re
from pathlib import Path

PAD = 0.40  # seconds on either side of dialogue
MIN_CARD = 2.40

ROOT = Path(__file__).resolve().parent
ENGLISH = ROOT / "subs" / "Mission to Mars.english.srt"
OUT = ROOT / "subs" / "Mission to Mars.enhanced.srt"

TS = re.compile(
    r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})[,.](\d{3})"
)


def to_s(h: int, m: int, s: int, ms: int) -> float:
    return h * 3600 + m * 60 + s + ms / 1000


def parse_ts(hms: str) -> float:
    h, m, rest = hms.split(":")
    s, ms = rest.replace(",", ".").split(".")
    return to_s(int(h), int(m), int(s), int(ms))


def fmt(t: float) -> str:
    if t < 0:
        t = 0
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def parse_srt(path: Path) -> list[tuple[float, float, str]]:
    raw = path.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n")
    blocks = re.split(r"\n\s*\n", raw.strip())
    out: list[tuple[float, float, str]] = []
    for block in blocks:
        lines = [ln for ln in block.split("\n") if ln.strip() != ""]
        if len(lines) < 2:
            continue
        m = TS.search(lines[1] if not lines[0].strip().isdigit() else "\n".join(lines[:3]))
        if not m:
            joined = "\n".join(lines)
            m = TS.search(joined)
            if not m:
                continue
            text_start = joined.find(m.group(0)) + len(m.group(0))
            text = joined[text_start:].strip()
        else:
            # index line + timestamp + text
            ts_i = 0
            for i, ln in enumerate(lines):
                if TS.search(ln):
                    ts_i = i
                    break
            text = "\n".join(lines[ts_i + 1 :]).strip()
        a = to_s(int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4)))
        b = to_s(int(m.group(5)), int(m.group(6)), int(m.group(7)), int(m.group(8)))
        if text.startswith("Created and Encoded by"):
            continue
        out.append((a, b, text))
    out.sort(key=lambda x: x[0])
    return out


def gaps(cues: list[tuple[float, float, str]], film_end: float) -> list[tuple[float, float]]:
    g: list[tuple[float, float]] = []
    t = 0.0
    for a, b, _ in cues:
        if a - t > PAD * 2 + MIN_CARD:
            g.append((t + PAD, a - PAD))
        t = max(t, b)
    if film_end - t > PAD * 2 + MIN_CARD:
        g.append((t + PAD, film_end - 0.05))
    return g


def place(glist: list[tuple[float, float]], prefer: float, dur: float) -> tuple[float, float] | None:
    """Place a card of `dur` seconds starting as close as possible to `prefer` inside a gap."""
    for a, b in glist:
        if b <= prefer:
            continue
        start = max(a, prefer)
        if b - start >= min(dur, MIN_CARD):
            use = min(dur, b - start)
            if use < MIN_CARD:
                continue
            return start, start + use
    # fallback: any gap that can fit, nearest after prefer then before
    best = None
    best_d = 1e9
    for a, b in glist:
        if b - a < MIN_CARD:
            continue
        start = a if prefer < a else max(a, prefer)
        if start >= b:
            start = a
        use = min(dur, b - start)
        if use < MIN_CARD:
            continue
        d = abs(start - prefer)
        if d < best_d:
            best_d = d
            best = (start, start + use)
    return best


def consume(glist: list[tuple[float, float]], start: float, end: float) -> list[tuple[float, float]]:
    nxt: list[tuple[float, float]] = []
    for a, b in glist:
        if end <= a or start >= b:
            nxt.append((a, b))
            continue
        if start - a >= MIN_CARD:
            nxt.append((a, start))
        if b - end >= MIN_CARD:
            nxt.append((end, b))
    return nxt


CARDS: list[tuple[float, float, str]] = [
    # prefer_start, duration, text
    (
        parse_ts("00:00:16,000"),
        10.0,
        "[AU-062 / NSA 1996–2000 window. ID4 (1996) → Fifth Element (1997) → Lebowski (1998) → Mummy open (1999) → this film (2000). Kinship lecture, not a silent Mountain of Heaven glitch.]",
    ),
    (
        parse_ts("00:00:27,000"),
        9.0,
        "[Tagline: “Let There Be Life.” / “We’ve been looking on the wrong planet.” Same long NSA push as 9/11, Mars RV stamp 2000-08-08, Pentagon Papers 2003.]",
    ),
    (
        parse_ts("01:16:06,400"),
        5.5,
        "[L1: “That’s the face. It’s real. Somebody put that thing there, and it’s not us.” Spoken Face. Cydonia is never named.]",
    ),
    (
        parse_ts("01:18:46,500"),
        8.0,
        "[DNA “looks human” / missing last pair — a test “to prove that we’re human,” not a god-lock. Opposite of Stargate / Prometheus occupier-Ra.]",
    ),
    (
        parse_ts("01:29:42,000"),
        12.0,
        "[Planetarium. Martians stay silent. The hologram is picture. Crew will name the kinship. This dossier once said “wrecked” — that word is ours, not theirs.]",
    ),
    (
        parse_ts("01:29:55,000"),
        14.0,
        "[What the picture is doing: water-world Mars, a strike, then empty. Wikipedia/critics call it an asteroid. Nobody in this room says asteroid. Nobody says wrecked.]",
    ),
    (
        parse_ts("01:30:10,000"),
        16.0,
        "[Saturnian join — two wrecks, one cartoon. 3147 BCE: stack breaks, first great deluge, Atlantis falls, first continental split. That is the civilization collapse. Clock A.]",
    ),
    (
        parse_ts("01:30:27,000"),
        16.0,
        "[686 BCE: Priori-Mars loses its outer iron shell. That shell becomes the asteroid belt. Hollywood inverts it — a leftover rock hits Mars. The debris is what Mars shed.]",
    ),
    (
        parse_ts("01:30:44,000"),
        14.0,
        "[Earlier Luke used “meteor impacts” as generic Face-weathering over “hundreds of millions of years.” Surface costume. Not the hologram cause.]",
    ),
    (
        parse_ts("01:31:00,000"),
        14.0,
        "[NSA kinship, not occupier myth. They will say they’re us. Stargate uses the same ancient-aliens pin to say they are in charge. This film does the opposite.]",
    ),
    (
        parse_ts("01:31:16,000"),
        12.0,
        "[Form is a lecture. Lebowski / Mummy 1999 hide the mountain as a visual effect of something else. Here they explain the monument. Payload still NSA.]",
    ),
    (
        parse_ts("01:31:44,000"),
        14.0,
        "[“Yeah. It’s Mars.” Water-world picture. Same description class as the 1984 RV before-catastrophe Mars — habitable wet surface, then the wreck. Crew never says ocean.]",
    ),
    (
        parse_ts("01:32:00,000"),
        16.0,
        "[Collision cartoon continues. Do not mash dates. 3147 = society / stack / deluge. 686 = body shrinks, shell gone, “asteroids” appear. One picture covers both.]",
    ),
    (
        parse_ts("01:32:18,000"),
        16.0,
        "[Ships leaving is Hollywood cover. Corpus: Earth was already in the stack. “One stayed behind. Earth” = Earth stayed; Mars civilization became the breakaway.]",
    ),
    (
        parse_ts("01:32:36,000"),
        16.0,
        "[Mars as offshoot of Earth material in the Golden Age. Planets violently break away at 3147. “One stayed behind. Earth” is almost literal physics.]",
    ),
    (
        parse_ts("01:32:54,000"),
        16.0,
        "[1984 MARS EXPLORATION. MON: “go back to the time before the geologic problem.” Dirt mountains vanish. Megalithic flats. Aqueducts / basin. Not the word ocean. Same before-cut as this water-world. Stamp 2000-08-08.]",
    ),
    (
        parse_ts("01:33:21,000"),
        3.8,
        "[“That’s where they went.” Flight named. Mechanism still unspoken.]",
    ),
    (
        parse_ts("01:33:29,200"),
        22.0,
        "[“One stayed behind.” Author: Earth is what remained when the Golden Age ended. Mars became breakaway. Not a late alien seed of an empty planet.]",
    ),
    (
        parse_ts("01:33:56,200"),
        11.0,
        "[“Before the continents separated.” Clock A. First great deluge = first continental split = Atlantis fall = 3147. Hollow Earth grows when the water hits. Not Wegener. Not Cambrian.]",
    ),
    (
        parse_ts("01:34:25,000"),
        14.0,
        "[Clock B starts: “Hundreds of millions of years… sudden explosion of life.” Cambrian classroom mask. Famous mystery used as seed evidence. It did not collapse Mars.]",
    ),
    (
        parse_ts("01:34:40,000"),
        14.0,
        "[Two clocks do not even match in mainstream geology. Cambrian ~541 Ma. Pangea breakup ~175–200 Ma. They attached continents to the flight, millions of years to the fossil lecture.]",
    ),
    (
        parse_ts("01:34:55,000"),
        16.0,
        "[Saturnian compression: 4077–3147 BCE (~930 years), or a few thousand from Cook’s 10,900 first-creation. Golem → organs through the Golden Age. Deep time is the L1 mask.]",
    ),
    (
        parse_ts("01:35:12,000"),
        16.0,
        "[Charge-growth in the Golden Age (planets too large, stack fails) is the prior engine. Deluge-water growth is the split engine. Do not collapse those two growths.]",
    ),
    (
        parse_ts("01:35:32,400"),
        5.4,
        "[“They seeded Earth.” L1 mask of one species already on both worlds.]",
    ),
    (
        parse_ts("01:35:43,600"),
        18.0,
        "[Lock line. “They’re us. We’re them.” NSA kinship. Same people. Invitation home, not priesthood. Opposite of 2001: opaque, nothing unifying, 100% CIA.]",
    ),
    (
        parse_ts("01:36:02,000"),
        8.0,
        "[Do not collapse this with Plato’s insolent Atlantic host. Stay-behind / first split is 3147. Viking / Asgard raid-memory is later.]",
    ),
    (
        parse_ts("01:37:50,400"),
        8.0,
        "[“Invitation to follow them home.” Home, not a priesthood. Maggie: life reaches out for life.]",
    ),
    (
        parse_ts("01:45:47,000"),
        8.0,
        "[Credits. Default English is the theatrical YIFY dialogue. This track is the AU-062 citation / conclusion conversation.]",
    ),
    (
        parse_ts("01:45:56,000"),
        10.0,
        "[Window: ID4 (1996) WTC-shadow / unity → Fifth Element (1997) paradise / pin → Lebowski (1998) shoe-rack MoH → Mummy open (1999) sun-on-peak → this film (2000).]",
    ),
    (
        parse_ts("01:46:07,000"),
        10.0,
        "[Same-year siblings, other lanes: Arrival 1996 geoengineering; Red Corner 1997; Rush Hour 1998; Matrix 1999 passport 9/11. Crouching Tiger 2000 is CIA — do not swallow.]",
    ),
    (
        parse_ts("01:46:18,000"),
        10.0,
        "[Fifth Element: intersecting religions, never divisive, everyone to paradise. Ancient aliens = pin, not contradiction. 2001: same pin, nothing unifying.]",
    ),
    (
        parse_ts("01:46:29,000"),
        10.0,
        "[Mummy Returns (2001): “commanders of the 12 tribes of the Medjai.” Religious unity. No bad Arabs. Unlike Mummy 1 hangman. Unity hangover into the 9/11 year.]",
    ),
    (
        parse_ts("01:46:40,000"),
        10.0,
        "[9/11 is an NSA-aligned plan that opens the 2001–2005 declassification flood. ID4 / Matrix / T2 are the calm-seed lane. This film is kinship, not WTC PP.]",
    ),
    (
        parse_ts("01:46:51,000"),
        10.0,
        "[Mars RV 1984. Before-catastrophe Mars = this water-world. Approved For Release 2000-08-08. Theatrical 10 Mar 2000. Same-year rhyme. Living-Mars discourse has agency provenance.]",
    ),
    (
        parse_ts("01:47:02,000"),
        10.0,
        "[Pentagon Papers (2003, FX) is the cultural crest of that offensive. Hanyok / Tonkin SIGINT public 2005–06. ~2006 antibody lane bunkers ahead of Obama / CIA-reign.]",
    ),
    (
        parse_ts("01:47:13,000"),
        10.0,
        "[Clock A again: before the continents separated = 3147 first deluge / Atlantis fall / first split. Hollow body expands when the water hits. Continents literally drift.]",
    ),
    (
        parse_ts("01:47:24,000"),
        10.0,
        "[Clock B again: Cambrian burst did not wreck them. Film picture = strike. Crew never names it. 686 outer shell becomes the asteroid belt. Hollywood inverts the rock.]",
    ),
    (
        parse_ts("01:47:35,000"),
        10.0,
        "[Earth stayed. Mars broke away. They’re us. We’re them. One species, shared sky, then splinter. That is the NSA sentence. End AU-062o / AU-062q / AU-062p.]",
    ),
]


def main() -> int:
    cues = parse_srt(ENGLISH)
    film_end = parse_ts("01:53:39,000")
    glist = gaps(cues, film_end)
    cards: list[tuple[float, float, str]] = []
    for prefer, dur, text in CARDS:
        slot = place(glist, prefer, dur)
        if slot is None:
            raise SystemExit(f"no gap for card near {fmt(prefer)}: {text[:60]}")
        a, b = slot
        cards.append((a, b, text))
        glist = consume(glist, a, b)

    merged = cues + cards
    merged.sort(key=lambda x: (x[0], x[1]))

    # overlap check (inclusive edges with 0.05 slop)
    for i in range(len(merged) - 1):
        a1, b1, t1 = merged[i]
        a2, b2, t2 = merged[i + 1]
        if b1 > a2 + 0.01:
            raise SystemExit(
                f"OVERLAP {fmt(a1)}-{fmt(b1)} vs {fmt(a2)}-{fmt(b2)}\n{t1}\n---\n{t2}"
            )

    lines = []
    for i, (a, b, text) in enumerate(merged, 1):
        lines.append(f"{i}\n{fmt(a)} --> {fmt(b)}\n{text}\n")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    n_cards = len(cards)
    print(f"Wrote {OUT}  cues={len(merged)} cards={n_cards}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
