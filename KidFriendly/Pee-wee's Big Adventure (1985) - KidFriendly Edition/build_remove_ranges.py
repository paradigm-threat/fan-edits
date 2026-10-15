#!/usr/bin/env python3
"""Build remove-pee-wee-kidfriendly-ranges.json from manual scene list + SRT."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "remove-pee-wee-kidfriendly-ranges.json"

PAD = 5.0
MERGE_GAP = 45.0

# (start_sec, end_sec, join_fade, transition, note)
# join_fade: False = hard cut; None = allow audio crossfade on large jumps
# transition: wipeleft | fade_black on exit seam (render_final_mkv.py)
MANUAL: list[tuple[float, float, bool | None, str | None, str]] = [
    (623.05, 711.59, False, None, "Francis breakfast scene"),
    (1319.10, 1872.97, None, None, "Francis at police through turf; crossfade to Madam Ruby"),
    (2494.75, 3153.35, False, "wipeleft", "Large Marge through train; join Alamo welcome"),
    (3555.437, 3694.321, False, None, "Andy bus-station + Lloyd rodeo; join amnesia What's your name"),
    (3767.12, 3847.77, False, None, "Biker bar death-threat chants (keep Tequila dance)"),
    (4009.54, 4112.64, False, "fade_black", "WB nightmare after biker; join Kevin Morton"),
    (4584.00, 4584.00, False, None, "Twisted Sister Burn in Hell only (76:19-76:29 source)"),
]


def merge_ranges(
    ranges: list[tuple[float, float, bool | None, str | None]],
) -> list[tuple[float, float, bool | None, str | None]]:
    if not ranges:
        return []
    ranges = sorted(ranges, key=lambda r: r[0])
    out = [ranges[0]]
    for a, b, jf, tr in ranges[1:]:
        la, lb, lj, lt = out[-1]
        if a <= lb + MERGE_GAP:
            out[-1] = (
                la,
                max(lb, b),
                lj if lj is False or jf is False else jf,
                tr or lt,
            )
        else:
            out.append((a, b, jf, tr))
    return out


def main() -> int:
    ranges: list[tuple[float, float, bool | None, str | None]] = []
    for a, b, jf, tr, _ in MANUAL:
        ranges.append((max(0, a - PAD), b + PAD, jf, tr))

    merged = merge_ranges(ranges)
    norm: list = []
    for a, b, jf, tr in merged:
        if jf is False or tr:
            item: dict = {"start": round(a, 3), "end": round(b, 3)}
            if jf is False:
                item["join_fade"] = False
            if tr:
                item["transition"] = tr
            norm.append(item)
        else:
            norm.append([round(a, 3), round(b, 3)])

    payload = {
        "description": (
            "KidFriendly (~3): Francis breakfast/pool/basement out; Francis premiere kept; "
            "Large Marge+Simone+train out (wipe to Alamo); Andy+Lloyd rodeo out; biker threats; "
            "WB nightmare (fade to black); Burn in Hell 10s only. Clown closeups manual QC. "
            "Pad 5s, merge 45s."
        ),
        "ranges": norm,
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    total = sum(b - a for a, b, _, _ in merged)
    print(f"Wrote {len(merged)} ranges, ~{total / 60:.1f} min removed -> {OUT}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
