#!/usr/bin/env python3
"""Build remove-serenity-unjossed-ranges.json from Serenity.en.srt + owner decisions."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from kdenlive_from_subs import parse_srt  # noqa: E402

from filter_theatrical_srt import is_commentary_block

MERGE_GAP = 45.0

# Owner decisions (2026-05-24):
# 1 whole Kaylee/Jayne beat | 2 Haven -> Mal reaction only | 3 keep fight, reaver gore only
# 4 keep leaf on wind | 5 keep final fight | 6 family/kids strict on gore

SRT_RULES: list[tuple[str, float, float, str, bool | None]] = [
    (r"nothing twixt my nethers", 18, 28, "Whole Kaylee/Jayne batteries beat", False),
    (r"weren't run\s+on batteries|on batteries", 6, 22, "batteries beat (cont.)", False),
    (r"stand to hear a little more", 6, 14, "Jayne cringe follow-up", False),
    (r"Oh, God!\s*I can't know that", 4, 10, "batteries beat (cont.)", False),
    (r"preacher.*don't.*whore|talk to a whore.*preacher", 10, 14, "Book/Inara gag", None),
    (r"rape\s+and\s+eat|raped?\s+to\s+death|they'll rape", 12, 20, "Reaver TV gore dialog", None),
    (r"pinned.*(bodies|corpses)|on posts|everybody they killed", 8, 18, "Haven massacre (visual/dialog)", None),
    (r"want you to scream|scream for me", 6, 12, "Reaver shock dialog (non-fight)", None),
    (r"cut her open|opened her up|cut open", 10, 18, "Autopsy / reaver gore talk", None),
    (r"federate.*barb|barbed.*wire|hook.*gut", 8, 14, "Reaver corpse details", None),
]

# Silent / visual reaver gore (seconds) — strict family/kids; refine in Kdenlive
MANUAL: list[tuple[float, float, str, bool | None]] = [
    (95.0, 185.0, "Opening: Reaver attack on screen (gore only)", None),
    (3055.0, 3185.0, "Haven: bodies on posts — trim to Mal reaction (~2:05)", None),
    (3185.0, 3320.0, "Haven: extend trim if posts still visible", None),
    (3780.0, 3865.0, "Maidenhead: reaver-gore inserts only (keep martial arts)", None),
    (5280.0, 5385.0, "Lab: reaver specimen / gore visuals", None),
    (5580.0, 5680.0, "Mr. Universe reaver horror (reduce)", None),
    (5850.0, 5920.0, "Reaver fleet / corpse shock beats", None),
]


def merge_ranges(ranges: list[tuple[float, float, str, bool | None]]) -> list[dict]:
    if not ranges:
        return []
    ranges = sorted(ranges, key=lambda x: x[0])
    merged: list[tuple[float, float, str, bool | None]] = [ranges[0]]
    for s, e, note, jf in ranges[1:]:
        ps, pe, pn, pj = merged[-1]
        if s <= pe + MERGE_GAP:
            merged[-1] = (ps, max(pe, e), f"{pn}; {note}", pj if pj is False else jf)
        else:
            merged.append((s, e, note, jf))
    out: list[dict] = []
    for s, e, note, jf in merged:
        item: dict = {"start": round(s, 2), "end": round(e, 2), "note": note}
        if jf is False:
            item["join_fade"] = False
        out.append(item)
    return out


def main() -> None:
    here = Path(__file__).resolve().parent
    srt = here / "Serenity (2005) - Unjossed.srt"
    if not srt.exists():
        raise SystemExit(f"missing {srt}")
    cues = parse_srt(srt)
    hits: list[tuple[float, float, str, bool | None]] = []
    for cue in cues:
        if is_commentary_block(cue.text):
            continue
        for pat, pb, pa, note, jf in SRT_RULES:
            if re.search(pat, cue.text, re.I | re.S):
                hits.append((max(0, cue.start - pb), cue.end + pa, note, jf))
    hits.extend(MANUAL)
    doc = {
        "description": (
            "Serenity Unjossed — family/kids, strict reaver gore. "
            "Whole batteries beat; Haven shortened to Mal reaction; "
            "Maidenhead fight kept; leaf on wind + final fight kept."
        ),
        "ranges": merge_ranges(hits),
    }
    out = here / "remove-serenity-unjossed-ranges.json"
    out.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out} ({len(doc['ranges'])} ranges)")


if __name__ == "__main__":
    main()
