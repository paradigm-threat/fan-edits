#!/usr/bin/env python3
"""Build remove-bambi-kidfriendly-ranges.json from SRT + manual scene list."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRT = ROOT / "Bambi (1942) - KidFriendly Edition.srt"
OUT = ROOT / "remove-bambi-kidfriendly-ranges.json"

PAD = 6.0
MERGE_GAP = 45.0
USE_KEYWORD_PASS = False

# (start_sec, end_sec, join_fade optional, note)
MANUAL: list[tuple[float, float, bool | None, str]] = [
    (1830.0, 1953.0, False, "Meadow stampede + Man was in the forest (extend earlier in QC)"),
    (2419.0, 2600.0, False, "Winter hunger + thicket + mother death"),
    (3233.0, 3340.0, False, "Ronno antler fight"),
    (3523.0, 4044.0, False, "Second Man, dogs, fire, wounded Bambi"),
]

KEYWORD_RE = re.compile(
    r"man was in the forest|it is man\.|the thicket\.|"
    r"your mother can't be|don't look back\. keep running|"
    r"he is here again\.|there are many this time",
    re.I,
)


def parse_srt(path: Path) -> list[tuple[float, float, str]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    tc = re.compile(
        r"(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*"
        r"(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})"
    )

    def to_sec(h, m, s, ms):
        return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0

    cues = []
    for block in re.split(r"\n\s*\n", text.strip()):
        m = tc.search(block)
        if not m:
            continue
        st = to_sec(m.group(1), m.group(2), m.group(3), m.group(4))
        en = to_sec(m.group(5), m.group(6), m.group(7), m.group(8))
        body = tc.sub("", block, count=1)
        body = re.sub(r"^\d+\s*\n", "", body.strip(), count=1)
        cues.append((st, en, body))
    return cues


def merge_ranges(ranges: list[tuple[float, float, bool | None]]) -> list[tuple[float, float, bool | None]]:
    if not ranges:
        return []
    ranges = sorted(ranges, key=lambda r: r[0])
    out = [ranges[0]]
    for a, b, jf in ranges[1:]:
        la, lb, lj = out[-1]
        if a <= lb + MERGE_GAP:
            out[-1] = (la, max(lb, b), lj if lj is False or jf is False else jf)
        else:
            out.append((a, b, jf))
    return out


def main() -> int:
    if not SRT.exists():
        print(f"Missing SRT: {SRT}", file=sys.stderr)
        return 1
    cues = parse_srt(SRT)
    ranges: list[tuple[float, float, bool | None]] = []

    for a, b, jf, _ in MANUAL:
        ranges.append((max(0, a - PAD), b + PAD, jf))

    if USE_KEYWORD_PASS:
        for st, en, text in cues:
            if KEYWORD_RE.search(text):
                ranges.append((max(0, st - PAD), en + PAD, None))

    merged = merge_ranges(ranges)
    norm: list = []
    for a, b, jf in merged:
        if jf is False:
            norm.append({"start": round(a, 2), "end": round(b, 2), "join_fade": False})
        else:
            norm.append([round(a, 2), round(b, 2)])
    payload = {
        "description": (
            "Kid-friendly (approx age 3): no Man scares, mother death, Ronno fight, "
            "or forest-fire climax. Manual scenes from YIFY SRT; pad 6s, merge 45s."
        ),
        "ranges": norm,
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    total = sum(b - a for a, b, _ in merged)
    print(f"Wrote {len(merged)} ranges, ~{total/60:.1f} min removed -> {OUT}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
