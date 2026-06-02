#!/usr/bin/env python3
"""Rebuild .kdenlive.shifted.srt / .ass from playlist2 (matches rendered video)."""
from __future__ import annotations

import argparse
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from kdenlive_from_subs import build_ass, build_shifted_srt, parse_srt


def timecode_to_seconds(tc: str) -> float:
    tc = tc.strip().replace(",", ".")
    parts = tc.split(":")
    if len(parts) != 3:
        raise ValueError(f"bad timecode: {tc!r}")
    h, m = int(parts[0]), int(parts[1])
    s = float(parts[2])
    return h * 3600 + m * 60 + s


def parse_playlist2(kdenlive: Path) -> list[tuple[float, float]]:
    pl = ET.parse(kdenlive).find(".//playlist[@id='playlist2']")
    if pl is None:
        raise SystemExit("playlist2 not found")
    segs: list[tuple[float, float]] = []
    for ent in pl.findall("entry"):
        if ent.get("producer") != "chain0":
            continue
        a = timecode_to_seconds(ent.get("in", "0"))
        b = timecode_to_seconds(ent.get("out", "0"))
        if b > a:
            segs.append((a, b))
    if not segs:
        raise SystemExit("no chain0 entries in playlist2")
    return segs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kdenlive", type=Path, required=True)
    ap.add_argument("--subs", type=Path, help="source SRT (default: sibling .srt)")
    args = ap.parse_args()

    kden = args.kdenlive.resolve()
    subs = args.subs or Path(str(kden).replace(".kdenlive", ".srt"))
    if not subs.exists():
        raise SystemExit(f"missing source subs: {subs}")

    kept = parse_playlist2(kden)
    cues = parse_srt(subs)
    shifted = build_shifted_srt(cues, kept)
    shifted_path = kden.with_suffix(kden.suffix + ".shifted.srt")
    ass_path = kden.with_suffix(kden.suffix + ".ass")
    shifted_path.write_text(shifted, encoding="utf-8")
    ass_path.write_text(build_ass(cues, kept), encoding="utf-8")
    out_dur = sum(b - a for a, b in kept)
    print(
        f"Wrote {shifted_path} ({len(shifted)} bytes, {shifted.count(chr(10))} lines)\n"
        f"Wrote {ass_path}\n"
        f"segments={len(kept)} output_duration~{out_dur:.1f}s",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
