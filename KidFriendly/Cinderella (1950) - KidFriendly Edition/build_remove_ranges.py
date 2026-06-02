#!/usr/bin/env python3
"""Build remove-cinderella-kidfriendly-ranges.json from SRT + manual scene list."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRT = ROOT / "Cinderella (1950) - KidFriendly Edition.srt"
OUT = ROOT / "remove-cinderella-kidfriendly-ranges.json"

PAD = 6.0
MERGE_GAP = 45.0
USE_KEYWORD_PASS = False

# (start_sec, end_sec, join_fade optional, note)
MANUAL: list[tuple[float, float, bool | None, str]] = [
    (148.15, 187.35, False, "Father death + cruel stepmother narration"),
    (551.99, 655.0, False, "Lucifer menace + Bruno dream chasing cats"),
    (785.0, 1127.5, False, "Breakfast chaos, cat chase, stepmother orders"),
    (1189.53, 1326.5, False, "Morning bullying + Lucifer mean at music lesson"),
    (1347.54, 1398.5, False, "Sisters fight / clumsy at lesson"),
    (2226.35, 2350.0, False, "Stepmother punishment chore list"),
    (1801.34, 1816.94, False, 'Stepmother "I said if" manipulation'),
    (2348.64, 2360.5, False, "Fake sympathy when sisters leave for ball"),
    (2437.85, 2595.0, False, "Dress ripped + despair before Fairy Godmother"),
    (3312.77, 3330.0, False, "Midnight coach chase (guards)"),
    (3688.85, 3902.0, False, "Cruel morning + locked in attic"),
    (3926.58, 4012.0, False, "Lucifer vs mice at attic door"),
]

KEYWORD_RE = re.compile(
    r"stepmother|tremaine|lucifer|lucify|bruno|dreaming again|"
    r"chasing lucifer|mean old|vicious practical|big, ugly mouse|"
    r"you little thief|let me out|lock up cinderelly|"
    r"untimely death|cold, cruel|forced to become a servant|"
    r"wake up, stupid|of all the stupid",
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
            "Kid-friendly (approx age 3): removes cruelty, Lucifer violence, dress destruction, "
            "attic imprisonment, Bruno dream line, and related beats. "
            "Manual scenes + keyword pass on YIFY-aligned English SRT; pad 6s, merge 75s."
        ),
        "ranges": norm,
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    total = sum(b - a for a, b, _ in merged)
    print(f"Wrote {len(merged)} ranges, ~{total/60:.1f} min removed -> {OUT}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
