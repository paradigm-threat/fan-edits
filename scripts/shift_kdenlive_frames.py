#!/usr/bin/env python3
"""Shift every playlist <entry> in/out (and child filter in/out) by N frames.

Use after a proxy/original 1-frame slip. Dry-run first. Does not change
tractor/playlist output lengths or <blank> pads.

    python3 scripts/shift_kdenlive_frames.py \\
      --kdenlive "FanMixes/The Mummy (1999) - Debugged/The Mummy Debugged.kdenlive" \\
      --frames 1 --dry-run
"""
from __future__ import annotations

import argparse
import re
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

FPS_N, FPS_D = 24000, 1001


def tc_to_s(tc: str) -> float:
    tc = tc.strip().replace(",", ".")
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
        for prop in chain.findall("property"):
            name = prop.get("name") or ""
            text = prop.text or ""
            if name in ("kdenlive:original.resource", "kdenlive:originalurl") and (
                "Mummy" in text or text.endswith(".mkv")
            ):
                ids.add(cid)
    return ids


def shift_tree(root: ET.Element, delta_s: float, producers: set[str] | None) -> int:
    n = 0
    for ent in root.iter("entry"):
        if producers is not None and ent.get("producer") not in producers:
            continue
        for attr in ("in", "out"):
            raw = ent.get(attr)
            if not raw:
                continue
            ent.set(attr, s_to_tc(tc_to_s(raw) + delta_s))
            n += 1
        for flt in ent.findall("filter"):
            for attr in ("in", "out"):
                raw = flt.get(attr)
                if not raw:
                    continue
                flt.set(attr, s_to_tc(tc_to_s(raw) + delta_s))
                n += 1
    return n


def producer_max_out(root: ET.Element, producers: set[str]) -> float:
    best = 0.0
    for chain in root.iter("chain"):
        if chain.get("id") not in producers:
            continue
        raw = chain.get("out")
        if raw:
            try:
                best = max(best, tc_to_s(raw))
            except ValueError:
                pass
    return best


def shift_text(
    xml: str,
    delta_s: float,
    producers: set[str] | None,
    max_out: float = 0.0,
) -> tuple[str, int]:
    """Rewrite in/out on film <entry> / child <filter> lines without reformatting the file."""
    n = 0
    out_lines: list[str] = []
    in_film_entry = False
    playlist = ""
    for line in xml.splitlines(keepends=True):
        stripped = line.lstrip()
        pm = re.search(r'<playlist id="([^"]+)"', stripped)
        if pm:
            playlist = pm.group(1)
        if stripped.startswith("<entry "):
            m = re.search(r'producer="([^"]+)"', line)
            in_film_entry = bool(
                playlist != "main_bin"
                and m
                and (producers is None or m.group(1) in producers)
            )
        elif stripped.startswith("</entry>"):
            in_film_entry = False
        if in_film_entry and re.search(r'\b(?:in|out)="', line):

            def repl(mm: re.Match[str]) -> str:
                nonlocal n
                t = tc_to_s(mm.group(2)) + delta_s
                if t < 0:
                    t = 0.0
                if max_out > 0 and t > max_out:
                    t = max_out
                n += 1
                return f'{mm.group(1)}="{s_to_tc(t)}"'

            line = re.sub(r'\b(in|out)="([0-9:.]+)"', repl, line)
        if in_film_entry and "/>" in stripped:
            in_film_entry = False
        out_lines.append(line)
    return "".join(out_lines), n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kdenlive", type=Path, required=True)
    ap.add_argument(
        "--frames",
        type=int,
        required=True,
        help="Positive = later on the source (skip 1 extra HEVC frame). Negative = earlier.",
    )
    ap.add_argument("--fps-num", type=int, default=FPS_N)
    ap.add_argument("--fps-den", type=int, default=FPS_D)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--backup-suffix",
        default="pre-frame-shift",
        help="Written as <file>.<suffix> if that backup does not already exist.",
    )
    args = ap.parse_args()
    if not args.kdenlive.exists():
        raise SystemExit(f"missing {args.kdenlive}")
    delta = args.frames * (args.fps_den / float(args.fps_num))
    raw = args.kdenlive.read_text(encoding="utf-8")
    root = ET.fromstring(raw)
    producers = film_producer_ids(root)
    if not producers:
        raise SystemExit("no film producers found (no kdenlive:original.resource .mkv)")
    max_out = producer_max_out(root, producers)
    new_xml, n = shift_text(raw, delta, producers, max_out=max_out)
    print(
        f"{args.kdenlive.name}: {n} in/out attrs on {sorted(producers)}, "
        f"{args.frames} frame(s) ({delta:+.6f}s) clamp_out={max_out:.3f}s "
        f"dry_run={args.dry_run}"
    )
    if args.dry_run:
        return 0
    bak = args.kdenlive.with_name(args.kdenlive.name + "." + args.backup_suffix)
    if not bak.exists():
        shutil.copy2(args.kdenlive, bak)
        print(f"backup {bak.name}")
    args.kdenlive.write_text(new_xml, encoding="utf-8")
    print(f"wrote {args.kdenlive}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
