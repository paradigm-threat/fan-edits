#!/usr/bin/env python3
"""List source-time holes in a Kdenlive film playlist and the SRT cues they remove."""
from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

FD = 1001 / 24000


def tc_to_s(tc: str) -> float:
    tc = tc.strip().replace(",", ".")
    if tc.isdigit() or re.fullmatch(r"\d+\.?\d*", tc):
        # frame count (MLT sometimes stores frames)
        try:
            if ":" not in tc:
                return float(tc) * FD
        except ValueError:
            pass
    parts = tc.split(":")
    if len(parts) != 3:
        raise ValueError(tc)
    return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])


def s_to_tc(t: float) -> str:
    if t < 0:
        t = 0.0
    ms = int(round(t * 1000.0))
    h, rem = divmod(ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, msec = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{msec:03d}"


def film_producer_ids(root: ET.Element) -> set[str]:
    ids: set[str] = set()
    for chain in root.iter("chain"):
        cid = chain.get("id")
        if not cid:
            continue
        resource = ""
        original = ""
        for prop in chain.findall("property"):
            name = prop.get("name") or ""
            text = (prop.text or "").lower()
            if name == "resource":
                resource = text
            if name in ("kdenlive:original.resource", "kdenlive:originalurl"):
                original = text
        blob = original or resource
        if blob.endswith((".mkv", ".mp4", ".mov", ".m4v", ".avi", ".webm")):
            ids.add(cid)
        elif "mummy" in blob or "yts" in blob:
            ids.add(cid)
    for prod in root.iter("producer"):
        pid = prod.get("id")
        if not pid or pid.startswith("producer"):
            # still check
            pass
        resource = ""
        for prop in prod.findall("property"):
            if prop.get("name") == "resource":
                resource = (prop.text or "").lower()
        if resource.endswith((".mkv", ".mp4", ".mov", ".m4v", ".avi")):
            if pid:
                ids.add(pid)
    return ids


def parse_entry_times(ent: ET.Element) -> tuple[float, float] | None:
    raw_in, raw_out = ent.get("in"), ent.get("out")
    if raw_in is None or raw_out is None:
        return None
    try:
        a, b = tc_to_s(raw_in), tc_to_s(raw_out)
    except ValueError:
        return None
    if b <= a:
        return None
    return a, b


def video_playlist_ids(root: ET.Element) -> set[str]:
    """Timeline playlists that carry picture (not audio lanes, not the bin)."""
    ids: set[str] = set()
    for pl in root.iter("playlist"):
        pid = pl.get("id") or ""
        if pid in ("main_bin",) or pid.startswith("playlist") is False:
            continue
        if pl.find("property[@name='kdenlive:audio_track']") is not None:
            continue
        ids.add(pid)
    return ids


def primary_film_ids(root: ET.Element, folder_name: str) -> set[str]:
    """Prefer the feature matching the FanMix folder; fall back to longest mkv."""
    title = folder_name.split(" - ")[0].lower()
    tokens = [t for t in re.split(r"[^a-z0-9]+", title) if len(t) > 2 and t not in {"the", "and"}]
    scored: list[tuple[int, float, str]] = []
    for chain in list(root.iter("chain")) + list(root.iter("producer")):
        cid = chain.get("id")
        if not cid:
            continue
        resource = original = ""
        length_s = 0.0
        for prop in chain.findall("property"):
            name = prop.get("name") or ""
            text = (prop.text or "")
            if name == "resource":
                resource = text.lower()
            if name in ("kdenlive:original.resource", "kdenlive:originalurl"):
                original = text.lower()
            if name == "length":
                try:
                    length_s = float(text) * FD
                except ValueError:
                    pass
        blob = original or resource
        if not blob.endswith((".mkv", ".mp4", ".mov", ".m4v", ".avi", ".webm")):
            if "mummy" not in blob and "yts" not in blob:
                continue
        if "kdenlive/proxy" in blob:
            pass
        score = 0
        if any(t in blob for t in tokens):
            score += 10
        if any(x in blob for x in ("2160p", "1080p", "bluray", "yts", "remux")):
            score += 2
        if length_s > 3600:
            score += 3
        scored.append((score, length_s, cid))
    if not scored:
        return film_producer_ids(root)
    scored.sort(key=lambda x: (-x[0], -x[1]))
    best = scored[0][0]
    return {cid for score, _, cid in scored if score == best or score >= 10}


def film_duration_s(root: ET.Element, producers: set[str]) -> float:
    best = 0.0
    for chain in list(root.iter("chain")) + list(root.iter("producer")):
        if chain.get("id") not in producers:
            continue
        out = chain.get("out")
        if out:
            try:
                best = max(best, tc_to_s(out))
            except ValueError:
                pass
        for prop in chain.findall("property"):
            if prop.get("name") == "length" and prop.text:
                try:
                    best = max(best, float(prop.text) * FD)
                except ValueError:
                    pass
    return best


MAX_FEATURE_S = 3.5 * 3600  # ignore extra-features / garbage outs


def _collect_ranges(root: ET.Element, producers: set[str], playlist_ids: set[str] | None) -> list[tuple[float, float]]:
    ranges: list[tuple[float, float]] = []
    for pl in root.iter("playlist"):
        pid = pl.get("id") or ""
        if pid == "main_bin":
            continue
        if playlist_ids is not None and pid not in playlist_ids:
            continue
        for ent in pl.iter("entry"):
            pr = ent.get("producer")
            if producers and pr not in producers:
                continue
            times = parse_entry_times(ent)
            if not times:
                continue
            a, b = times
            if a >= MAX_FEATURE_S or b > MAX_FEATURE_S + 30:
                continue
            ranges.append((a, min(b, MAX_FEATURE_S)))
    ranges.sort()
    merged: list[list[float]] = []
    for a, b in ranges:
        if not merged or a > merged[-1][1] + 0.15:
            merged.append([a, b])
        else:
            merged[-1][1] = max(merged[-1][1], b)
    return [(a, b) for a, b in merged]


def kept_source_ranges(kden: Path, folder_name: str = "") -> tuple[list[tuple[float, float]], float]:
    root = ET.parse(kden).getroot()
    producers = primary_film_ids(root, folder_name or kden.stem)
    video_pls = video_playlist_ids(root)
    ranges = _collect_ranges(root, producers, video_pls or None)
    if not ranges:
        # Sparse scripts (Boogie / Fear / FGT / Serenity) only put film on A1/A2.
        ranges = _collect_ranges(root, producers, None)
    dur = film_duration_s(root, producers)
    if dur > MAX_FEATURE_S or dur <= 0:
        dur = ranges[-1][1] if ranges else 0.0
    return ranges, dur


def holes(
    kept: list[tuple[float, float]],
    min_gap: float = 0.8,
    film_end: float = 0.0,
) -> list[tuple[float, float]]:
    if not kept:
        return []
    out: list[tuple[float, float]] = []
    start0 = kept[0][0]
    if start0 >= min_gap:
        out.append((0.0, start0))
    for i in range(len(kept) - 1):
        a, b = kept[i][1], kept[i + 1][0]
        if b - a >= min_gap:
            out.append((a, b))
    cap = film_end if film_end > 60 else kept[-1][1]
    # Ignore junk after the feature (extra features / bad out values).
    if cap > 0:
        out = [(a, b) for a, b in out if a < cap + 2 and b <= cap + 30]
        # Drop a trailing hole that is just "rest of disc" after credits
        if out and out[-1][0] > cap - 5:
            out.pop()
    return out


def parse_srt(path: Path) -> list[tuple[float, float, str]]:
    text = path.read_text(encoding="utf-8-sig", errors="replace").replace("\r\n", "\n")
    cues: list[tuple[float, float, str]] = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = block.split("\n")
        m = None
        tline = None
        for i, line in enumerate(lines):
            m = re.search(
                r"(\d{2}:\d{2}:\d{2}[,.]\d+)\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d+)",
                line,
            )
            if m:
                tline = i
                break
        if not m:
            continue
        body = "\n".join(lines[tline + 1 :]).strip()
        if not body or body.startswith("["):
            continue
        cues.append((tc_to_s(m.group(1)), tc_to_s(m.group(2)), body))
    return cues


def cue_overlap(cue: tuple[float, float, str], hole: tuple[float, float]) -> float:
    lo, hi = max(cue[0], hole[0]), min(cue[1], hole[1])
    return max(0.0, hi - lo)


def cues_in_hole(cues, hole, min_frac: float = 0.45) -> list[str]:
    a, b = hole
    found = []
    for c in cues:
        ov = cue_overlap(c, hole)
        dur = max(0.04, c[1] - c[0])
        if ov / dur >= min_frac or (c[0] >= a - 0.05 and c[1] <= b + 0.05):
            line = re.sub(r"\s+", " ", c[2]).strip()
            if line and line not in found:
                found.append(line)
    return found


def pick_kden(folder: Path) -> Path | None:
    cands = [
        p
        for p in folder.glob("*.kdenlive")
        if "backup" not in p.name.lower()
        and "pre-" not in p.name.lower()
        and not p.name.lower().startswith("trailer")
        and "restoration" not in p.name.lower()
        and p.name != "legacy.kdenlive"
        and "(1993).kdenlive" not in p.name
    ]
    if not cands:
        return None
    # prefer the one matching folder name
    for p in cands:
        if folder.name.split(" - ")[0].split(" (")[0][:12].lower() in p.name.lower():
            return p
    return sorted(cands, key=lambda x: -x.stat().st_size)[0]


def pick_srt(folder: Path) -> Path | None:
    # source-timeline: not shifted, not enhanced, not kdenlive.srt output
    skip = ("shifted", "enhanced", "kdenlive.srt", "kdenlive.ass")
    scored: list[tuple[int, Path]] = []
    for p in folder.rglob("*.srt"):
        n = p.name.lower()
        if any(s in n for s in skip):
            continue
        if "source.txt" in n:
            continue
        score = 0
        if "source" in n:
            score += 8
        if p.parent.name == "subs" and "english" not in n and "debugged" not in n:
            score += 5  # uncut YTS
        if n.endswith(".en.srt") or n.endswith(".english.srt") and "debugged" not in n:
            score += 4
        if n.endswith(".srt") and "english" not in n and "kdenlive" not in n:
            score += 2
        if p.parent == folder:
            score += 3
        scored.append((score, p))
    if not scored:
        return None
    scored.sort(key=lambda x: (-x[0], len(x[1].name)))
    return scored[0][1]


def analyze_folder(folder: Path) -> dict:
    kden = pick_kden(folder)
    srt = pick_srt(folder)
    rec: dict = {
        "folder": folder.name,
        "kdenlive": kden.name if kden else None,
        "srt": str(srt.relative_to(folder)) if srt else None,
        "kept": [],
        "holes": [],
    }
    if not kden:
        rec["note"] = "no kdenlive (subtitle-only or not a cut edit)"
        return rec
    kept, film_end = kept_source_ranges(kden, folder.name)
    rec["kept"] = [{"in": s_to_tc(a), "out": s_to_tc(b)} for a, b in kept]
    rec["kept_span"] = (
        f"{s_to_tc(kept[0][0])}–{s_to_tc(kept[-1][1])}" if kept else None
    )
    rec["film_end"] = s_to_tc(film_end) if film_end else None
    hs = holes(kept, min_gap=2.0, film_end=film_end)
    cues = parse_srt(srt) if srt else []
    for a, b in hs:
        lines = cues_in_hole(cues, (a, b)) if cues else []
        rec["holes"].append(
            {
                "start": s_to_tc(a),
                "end": s_to_tc(b),
                "dur": round(b - a, 1),
                "lines": lines,
                "line_count": len(lines),
            }
        )
    return rec


INTENT = {
    "2012 (2009) - Open The Gates": "Removes unnecessary death scenes and russophobic beats.",
    "Alien Resurrection (1997) - UnJossed": "Removes most Joss Whedon-inspired body-horror, including the hybrid alien birth and death.",
    "American Psycho (2000) - Psychosomatic": "Trims Bateman’s longest self-mythology / body and blood-lust monologue blocks so the satire and dread do not stall on vanity essays. Business-card satire and murder-mystery ambiguity stay.",
    "Boogie Nights (1997) - No Lookout": "Removes PTA’s whip-pan out of Reed’s demo-tape office through On the Lookout, the Valley night drive, and the donut-shop stick-up/kill. Lands on the first black frame; the original black hold into the Rahad-planning scene stays.",
    "Congo (1995) - Incel": "Trims Dr. Elliot’s incel-ish dialogue, some Travis/Captain Wanta screaming, and some gore. The Bob Driscoll encounter is moved next to the campsite (not days of travel later).",
    "Fear and Loathing in Las Vegas (1998) - No North Star": "Removes the North Star Coffee Lounge (waitress, knife, lemon meringue pie). Duke’s “massive crime often slips by unrecognized” stays; next line is “It was all over now.”",
    "Final Fantasy (2001) - The Phantom Menace": "Cuts poorly acted / excessive human-behavior scenes (Baldwin, Buscemi), shortens gore, and trims predictive-programming beats that are not plot-essential. Title card moved after the intro. Japanese audio + remix replacements are additions, not removals.",
    "Fried Green Tomatoes (1991) - No Frank Bennett": "Removes Frank Bennett on screen and the Valdosta / river-club / abuse / kidnapping / investigation / trial thread, plus dialogue that names or explains him.",
    "Matrix Reloaded (2003) - Unlinked": "Removes many Link establishment sequences, the orgasm-brownie beat, the kiss sequence, and a few other early-pacing wreckers. No source SRT in the project — times only.",
    "Matrix Revolutions (2003) - Unlinked": "Removes many Link establishment sequences. No source SRT in the project — times only.",
    "Ninja Scroll (1993) - Minor Damage": "Cuts excessive Jubei/Kagero and Zakuro/Yurimaru drama, rape scenes, and reduces blood. Ninja Gaiden OST additions are not listed here.",
    "Riddick (2013) - Unjinxed": "Removes distracting/sexist dialogue, the opening vulture kill, and the Vaako block. The Necromonger flashback is reordered to the front (not a deletion). Times after ~1:59 may be disc extras on this rip.",
    "Serenity (2005) - Unjossed": "Kids/family cut: strict on Reaver gore. Kaylee/Jayne “nethers/batteries” beat removed; Haven massacre shortened to Mal’s reaction. Maidenhead fight and “leaf on the wind” stay. If the SRT is a commentary track, cue text may be production notes rather than theatrical dialogue.",
    "Silent Hill (2006) - Nay Tomorrow": "Cuts gory/sexist sequences, much of Alessa/Jodelle Ferland narration, shortens Cybil’s death, and removes Christabella’s death. SH1 music additions are not listed here.",
    "Sonic (2020) - DeSchwartzed": "Removes Ben Schwartz sardonic commentary, most Wade/Rachel scenes, sappy family beats, and predictive-programming (Rachel pushing divorce) that is not plot-required.",
    "Sonic 2 (2022) - DeSchwartzed": "Same DeSchwartzed rules as Sonic 1 (Schwartz commentary, Wade/Rachel, sappy family, PP). No source SRT in the project — times only.",
    "Sonic 3 (2024) - DeSchwartzed": "Same DeSchwartzed rules as Sonic 1 (Schwartz commentary, Wade/Rachel, sappy family, PP).",
    "Terminator 3 (2003) - Brass Monkey": "Removes as much Nick Stahl as possible, his narration, the stripper scene, Kate’s wedding-worry dialogue, the contradictory “cash only” beat, and other T3-only clutter. Brass Monkey is a music replacement, not a picture cut.",
    "The Big Lebowski (1998) - Enhanced Citations": "Not a picture cut. Theatrical film stays intact. Work is a second English subtitle track (Gutterballs / Mountain of Heaven citations).",
    "The Chronicles Of Riddick (2004) - Fry's Edition": "Trims extended-cut sleaze and poorly acted/sexist Dame Vaako and Kyra beats, aiming at a high-def theatrical-leaning cut with Carolyn Fry’s sensibility.",
    "The Day After Tomorrow (2004) - Yuppocolypse": "Removes many establishment scenes for the yuppie protagonists.",
    "The Mummy (1999) - Debugged": "Kid-friendlier cut: scarabs that kill or eat people are removed. Hom-Dai eat, camp flesh-eater lecture, Hamunaptra swarm, Cairo Burns finish, and Jonathan’s vanishing arm wound. Later user trims may appear as extra holes below.",
    "The Mummy Returns (2001) - Debugged": "Kid-friendlier match to Mummy 1. Planned removals are the pygmy eat-swarms. Extra holes below are additional Kdenlive trims (or join artifacts) to label later.",
    "The Pentagon Papers (2003) - Widescreen": "No story cuts. 4:3 PAL DVD is upscaled and center-cropped to 16:9. Enhanced SRT is citations only.",
    "Tron Legacy (2010) - DaftPunk'd": "Tighter theatrical cut: ~11 minutes of dead-air / connective tissue removed so Daft Punk’s score and Grid set pieces lead. Father/son and CLU story stay. No source-timeline SRT in the project — times only until a theatrical SRT is added.",
    "War of the Worlds (1953) - No Clip": "Short picture trims on the 1953 film. Scene labels TBD from the removed cues.",
    "War of the Worlds (2005) - Family Therapy": "Removes toxic family behavior so the film is about the invasion, not domestic abrasion. Also cuts Vincent/Julio solar-flare arguing, SpongeBob, some alien-death/lightning travel, and replaces Freeman’s intro with Richard Burton (addition/replacement, not a hole).",
}


def write_changes_md(folder: Path, rec: dict) -> Path:
    intent = INTENT.get(rec["folder"], "")
    holes = rec.get("holes") or []
    removed_s = sum(h["dur"] for h in holes)
    lines = [
        f"# Changes — {rec['folder']}",
        "",
        "Cut list from the Kdenlive timeline versus the original feature. "
        "A hole is a source-time window that is not on the video (or sparse audio) playlist. "
        "Removed dialogue is taken from the original-timeline SRT that overlaps that window. "
        "If the scene is not obvious from the cues, it is marked **TBD**.",
        "",
    ]
    if intent:
        lines += ["## Intent", "", intent, ""]
    if rec.get("note"):
        lines += [f"**Note:** {rec['note']}", ""]
    lines += [
        f"- Kdenlive: `{rec.get('kdenlive') or 'none'}`",
        f"- Source SRT: `{rec.get('srt') or 'none'}`",
        f"- Picture holes: **{len(holes)}** (~{removed_s/60:.1f} min of source removed)",
        "",
        "## Removals (source times)",
        "",
    ]
    if not holes:
        if rec.get("kdenlive"):
            lines.append("No source-time holes ≥ 2 seconds were found on the feature playlist.")
        else:
            lines.append("No Kdenlive picture edit. Nothing was removed from the original cut.")
        lines.append("")
    for i, h in enumerate(holes, 1):
        lines.append(f"### {i}. {h['start']} – {h['end']} ({h['dur']:.1f}s)")
        lines.append("")
        if h["line_count"] == 0:
            lines.append("- **Scene:** TBD (no overlapping subtitles — silent action, music, or a commentary-less stretch).")
            lines.append("")
            continue
        lines.append("- **Scene:** TBD — fill in from the removed lines if needed.")
        lines.append("- **Removed subtitles:**")
        for cue in h["lines"][:40]:
            safe = cue.replace("\n", " ").strip()
            lines.append(f"  - {safe}")
        if h["line_count"] > 40:
            lines.append(f"  - … +{h['line_count'] - 40} more cues in this window")
        lines.append("")
    path = folder / "CHANGES.md"
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    return path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, default=Path("FanMixes"))
    ap.add_argument("--json", type=Path)
    ap.add_argument("--write-md", action="store_true", help="Write CHANGES.md in each FanMix folder")
    args = ap.parse_args()
    reports = []
    for folder in sorted(p for p in args.root.iterdir() if p.is_dir()):
        rec = analyze_folder(folder)
        reports.append(rec)
        print(f"\n=== {rec['folder']} ===")
        print(f"kdenlive={rec['kdenlive']} srt={rec['srt']} holes={len(rec['holes'])}")
        for h in rec["holes"]:
            print(f"  {h['start']}-{h['end']} ({h['dur']:.1f}s)  {h['line_count']} cues")
            for line in h["lines"][:6]:
                print(f"    • {line[:110]}")
            if h["line_count"] > 6:
                print(f"    … +{h['line_count']-6} more")
        if args.write_md:
            md = write_changes_md(folder, rec)
            print(f"  wrote {md}")
    if args.json:
        args.json.write_text(json.dumps(reports, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
