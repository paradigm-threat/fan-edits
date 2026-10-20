#!/usr/bin/env python3
"""Build enhanced / citations SRT for No North Star: dialogue + Acosta history cards in silence."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
STEM = HERE.name
SUBS = HERE / "subs"
ENG = SUBS / f"{STEM}.english.srt"
ENH = SUBS / f"{STEM}.enhanced.srt"
TS = re.compile(
    r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})[,.](\d{3})"
)


def to_s(h: int, m: int, s: int, ms: int) -> float:
    return h * 3600 + m * 60 + s + ms / 1000.0


def fmt(t: float) -> str:
    if t < 0:
        t = 0.0
    h = int(t // 3600)
    t -= h * 3600
    m = int(t // 60)
    t -= m * 60
    s = int(t)
    ms = int(round((t - s) * 1000))
    if ms >= 1000:
        ms = 0
        s += 1
        if s >= 60:
            s = 0
            m += 1
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def parse_srt(path: Path) -> list[tuple[float, float, str]]:
    raw = path.read_text(encoding="utf-8-sig", errors="replace").replace("\r\n", "\n")
    raw = raw.replace("\ufeff", "")
    cues: list[tuple[float, float, str]] = []
    for block in re.split(r"\n\s*\n", raw.strip()):
        lines = [ln for ln in block.split("\n") if ln.strip()]
        if len(lines) < 2:
            continue
        joined = "\n".join(lines)
        m = TS.search(joined)
        if not m:
            continue
        text = joined[joined.find(m.group(0)) + len(m.group(0)) :].strip()
        if not text:
            continue
        if "OpenSubtitles" in text or "Advertise your product" in text:
            continue
        if re.fullmatch(r"\d+", text.strip()):
            continue
        a = to_s(*map(int, m.groups()[:4]))
        b = to_s(*map(int, m.groups()[4:]))
        if b <= a:
            continue
        cues.append((a, b, text))
    cues.sort(key=lambda c: c[0])
    return cues


def write_srt(path: Path, cues: list[tuple[float, float, str]]) -> None:
    cues = sorted(cues, key=lambda c: (c[0], c[1]))
    parts: list[str] = []
    for i, (a, b, text) in enumerate(cues, 1):
        parts.append(f"{i}\n{fmt(a)} --> {fmt(b)}\n{text}\n")
    path.write_text("\n".join(parts) + "\n", encoding="utf-8")


def occupied(cues: list[tuple[float, float, str]]) -> list[tuple[float, float]]:
    return [(a, b) for a, b, _ in cues]


def free_in(windows: list[tuple[float, float]], a: float, b: float) -> bool:
    for x, y in windows:
        if a < y and b > x:
            return False
    return True


def place_cards(
    dialogue: list[tuple[float, float, str]],
    cards: list[tuple[float, float, str]],
) -> list[tuple[float, float, str]]:
    """Place (preferred_start, duration, text) cards into silence; shift forward if needed."""
    occ = occupied(dialogue)
    # build silence map
    dur_end = max(b for _, b, _ in dialogue) + 60.0
    gaps: list[tuple[float, float]] = []
    prev = 0.0
    for a, b, _ in sorted(dialogue):
        if a - prev >= 3.2:
            gaps.append((prev, a))
        prev = max(prev, b)
    if dur_end - prev >= 3.2:
        gaps.append((prev, dur_end))

    placed: list[tuple[float, float, str]] = []
    used = list(occ)

    for pref, dur, text in cards:
        # find a gap that can hold dur starting at or after pref, or containing pref
        best: tuple[float, float] | None = None
        for g0, g1 in gaps:
            if g1 <= pref:
                continue
            start = max(g0 + 0.35, pref)
            end = start + dur
            if end <= g1 - 0.25 and free_in(used, start, end):
                best = (start, end)
                break
            # try from gap start if pref is before gap
            if g0 >= pref - 1.0:
                start = g0 + 0.35
                end = start + dur
                if end <= g1 - 0.25 and free_in(used, start, end):
                    best = (start, end)
                    break
        if best is None:
            # last resort: any later gap long enough
            for g0, g1 in gaps:
                if g1 - g0 < dur + 0.8:
                    continue
                if g0 + 0.35 < pref:
                    continue
                start = g0 + 0.35
                end = start + dur
                if end <= g1 - 0.25 and free_in(used, start, end):
                    best = (start, end)
                    break
        if best is None:
            print(f"WARN unplaced: {text[:60]!r} @ {pref}", file=sys.stderr)
            continue
        placed.append((best[0], best[1], text))
        used.append(best)
        used.sort()
    return placed


# (preferred_start_sec, duration, text) — land in no-dialogue gaps near the beat
CITATIONS: list[tuple[float, float, str]] = [
    (
        0.4,
        5.8,
        "[Oscar Zeta Acosta — not Dr. Gonzo. Chicano lawyer. The Brown Buffalo.]",
    ),
    (
        6.5,
        5.8,
        "[Default English is dialogue only. This track cites the history the movie demotes.]",
    ),
    (
        13.0,
        6.2,
        "[The books/movies erased Acosta’s soul, but that scene went too far.]",
    ),
    (
        20.0,
        6.0,
        "[Brown Buffalo (1972): quits poverty-law respectability, walks into East L.A. politics.]",
    ),
    (
        71.2,
        6.0,
        "[Cockroach People (1973): St. Basil, Salazar, sheriff run — war with California courts.]",
    ),
    (
        651.2,
        6.0,
        "[“I think he’s probably Samoan.” Acosta’s race joke, frozen as his only public face.]",
    ),
    (
        657.5,
        5.8,
        "[Deliberate demotion: keep Chicano counsel and anarchist revolt off the mass stage.]",
    ),
    (
        1116.2,
        6.2,
        "[Buffalo Zeta Brown: defends militants, runs for L.A. County sheriff on an anarchist platform.]",
    ),
    (
        1123.0,
        6.0,
        "[Chicano Liberation Front era. Firebomb climate. Acosta wrote himself inside that orbit.]",
    ),
    (
        1333.0,
        6.0,
        "[Threatened suit over Fear and Loathing. Settlement: photo + caption + Straight Arrow novels.]",
    ),
    (
        1339.5,
        3.5,
        "[Not co-credit. Not ethnicity restored. Not the Brown Buffalo on the cover.]",
    ),
    (
        1884.5,
        6.2,
        "[Debbie Reynolds / Sgt. Pepper. Gonzo: “toss a fucking bomb in that place.”]",
    ),
    (
        2003.0,
        6.4,
        "[That bomb line is a wink at Acosta’s firebomb past — laundered as a lounge gag.]",
    ),
    (
        2010.0,
        6.4,
        "[Cockroach People: Tooner Flats firebombing charges; Hall of Justice; CLF on the march banners.]",
    ),
    (
        2017.0,
        6.0,
        "[You cannot safely “call him out” as bomber in a youth hit. So they made him carnival.]",
    ),
    (
        2045.0,
        6.0,
        "[Acosta later called Hunter a Benedict Arnold for helping halt the revolt climate.]",
    ),
    (
        2759.5,
        6.0,
        "[Acosta to Rinzler: Hunter stole his soul, took his best lines, wrung him dry for material.]",
    ),
    (
        2998.5,
        6.0,
        "[“Soul” = the ambitions and history that never lead the poster. Material harvested into Hunter’s byline.]",
    ),
    (
        3013.5,
        6.0,
        "[Banshee defense: Samoan to “shield” him from L.A. cops. Erasure sold as care.]",
    ),
    (
        3276.0,
        6.2,
        "[Where the Buffalo Roam is closer even as “Carl Lazlo”: a lawyer who quits. Gilliam keeps Vegas comedy.]",
    ),
    (
        4506.0,
        5.8,
        "[Another “cruel Samoan” beat. Latino casting and Chicano posters do not fix the script.]",
    ),
    (
        5061.5,
        6.0,
        "[Rolling Stone / Straight Arrow, Random House counsel, California legal/police — many hands in the room.]",
    ),
    (
        5701.5,
        6.0,
        "[Hunter’s path of least resistance: wring Vegas dry for comedy, cut the radioactive associate.]",
    ),
    (
        6089.5,
        5.8,
        "[Edit: North Star Coffee Lounge — waitress, knife, “lemon meringue pie.”]",
    ),
    (
        6159.5,
        6.0,
        "[Cut: inaccurate cruelty piled on a dishonest Acosta. Excess, not honesty about a dangerous man.]",
    ),
    (
        6186.5,
        6.2,
        "[Disappeared Mazatlán 1974. FBI/Coast Guard murk. Banshee is requiem and brand management.]",
    ),
    (
        6193.5,
        6.2,
        "[Vintage reprints still open with Thompson’s intro — attack voice bound onto Acosta’s own books.]",
    ),
    (
        6229.5,
        6.0,
        "[Read Acosta first: Brown Buffalo, Cockroach People, Uncollected Works.]",
    ),
    (
        6278.5,
        6.2,
        "[The mass product will not name the revolt. It will let the attorney joke about bombing Debbie Reynolds.]",
    ),
    (
        6459.0,
        6.2,
        "[No North Star: refuse the meanest leftover of the comedy demotion. Keep the “massive crime” line.]",
    ),
    (
        6466.0,
        6.2,
        "[Acosta’s soul was the ambitions. The movie sold appetite. This cut stops one cruelty too far.]",
    ),
    (
        6555.0,
        6.2,
        "[Working notes: ~/dev/wget/acosta — Brown Buffalo, Cockroach, Uncollected, Banshee.]",
    ),
    (
        6562.0,
        6.2,
        "[New Yorker: “What Fear and Loathing in Las Vegas Owes to Oscar Acosta.” Start there too.]",
    ),
]


def main() -> int:
    dialogue = parse_srt(ENG)
    if not dialogue:
        raise SystemExit(f"no dialogue in {ENG}")

    # rewrite clean english (drop BOM junk + OpenSubtitles ad)
    write_srt(ENG, dialogue)
    print(f"cleaned {ENG.name}: {len(dialogue)} cues", file=sys.stderr)

    cards = place_cards(dialogue, CITATIONS)
    print(f"placed {len(cards)}/{len(CITATIONS)} citation cards", file=sys.stderr)

    merged = dialogue + cards
    write_srt(ENH, merged)
    print(f"wrote {ENH} ({len(merged)} cues)", file=sys.stderr)

    # sibling VTT for both
    vtt = Path("/home/ari/dev/fan-edits/scripts/srt_to_vtt.py")
    subprocess.run([sys.executable, str(vtt), str(SUBS)], check=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
