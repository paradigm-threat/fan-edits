#!/usr/bin/env python3
"""Build an ffmpeg video filter_script for shot-locked 16:9 crops (single-pass expression)."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def build_y_expr(shots: list[dict], max_y: int) -> str:
    """Piecewise y(t) from contiguous shots; safe for ffmpeg filter expressions."""
    if not shots:
        return str(max(0, max_y // 2))
    # Work backwards so earlier shots take precedence via lt(t, end)
    parts: list[str] = []
    for sh in shots:
        y = int(round(float(sh.get("crop_y_frac", 0.5)) * max_y))
        y = max(0, min(max_y, y))
        parts.append((float(sh["end"]), y))
    # Default = last shot y
    expr = str(parts[-1][1])
    for end, y in reversed(parts[:-1]):
        # commas must be escaped as \, in filtergraph files
        expr = f"if(lt(t\\,{end:.3f})\\,{y}\\,{expr})"
    return expr


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--crop-json", type=Path, required=True)
    ap.add_argument("--out-script", type=Path, required=True)
    ap.add_argument("--up-w", type=int, required=True)
    ap.add_argument("--up-h", type=int, required=True)
    ap.add_argument("--aspect", type=float, default=16 / 9)
    ap.add_argument("--out-w", type=int, default=1920)
    ap.add_argument("--out-h", type=int, default=1080)
    args = ap.parse_args()

    data = json.loads(args.crop_json.read_text(encoding="utf-8"))
    shots = data["shots"]
    if not shots:
        raise SystemExit("no shots in crop json")

    crop_h = int(round(args.up_w / args.aspect))
    if crop_h > args.up_h:
        raise SystemExit(f"crop_h {crop_h} > up_h {args.up_h}")
    max_y = args.up_h - crop_h
    y_expr = build_y_expr(shots, max_y)

    # filter_script:v — one filter chain, no [pads]
    chain = (
        f"crop={args.up_w}:{crop_h}:0:'{y_expr}',"
        f"scale={args.out_w}:{args.out_h}:flags=lanczos,"
        f"format=yuv420p10le"
    )
    args.out_script.parent.mkdir(parents=True, exist_ok=True)
    args.out_script.write_text(chain + "\n", encoding="utf-8")
    print(
        f"Wrote filter script ({len(shots)} shots, crop {args.up_w}x{crop_h}, "
        f"max_y={max_y}) -> {args.out_script}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
