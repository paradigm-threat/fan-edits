#!/usr/bin/env python3
"""Symlink FanEditRender finals into project folders and run relay-ipfs-ingest."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RENDER = Path("/media/ari/HD/FanEditRender")
INGEST = Path.home() / "dev/relay/relay-gateway/scripts/relay-ipfs-ingest"


def is_source_rip(name: str) -> bool:
    n = name.lower()
    for bad in ("yts", "bluray", "web-dl", "webrip", "[", "x265.10bit", "hevc.dts", "2160p.4k"):
        if bad in n:
            return True
    return False


def score(p: Path) -> tuple[int, int]:
    n = p.name.lower()
    s = 0
    for good in (
        "edition",
        "final",
        "debugged",
        "deanna",
        "unjossed",
        "unlinked",
        "unjinxed",
        "deschwartzed",
        "incel",
        "salvation",
        "lookout",
        "north star",
        "nay tomorrow",
        "phantom menace",
        "psychosomatic",
        "minor damage",
        "family therapy",
        "brass",
        "widescreen",
    ):
        if good in n:
            s += 10
    if is_source_rip(p.name):
        s -= 50
    sz = p.stat().st_size
    if 200_000_000 < sz < 6_000_000_000:
        s += 3
    return (s, sz)


def pairs() -> list[tuple[Path, Path]]:
    out: list[tuple[Path, Path]] = []
    for cat in ("FanMixes", "KidFriendly"):
        base = ROOT / cat
        if not base.is_dir():
            continue
        for proj in sorted(base.iterdir()):
            if not proj.is_dir():
                continue
            name = proj.name
            cands: list[Path] = []
            for d in RENDER.iterdir():
                if not d.is_dir():
                    continue
                if d.name != name and name not in d.name and d.name not in name:
                    a = set(name.lower().replace("(", " ").replace(")", " ").split())
                    b = set(d.name.lower().replace("(", " ").replace(")", " ").split())
                    if len(a & b) < 3:
                        continue
                for f in d.glob("*.mkv"):
                    if f.stat().st_size < 80_000_000:
                        continue
                    if "seam" in f.name.lower() or "preview" in f.name.lower():
                        continue
                    cands.append(f)
            if not cands:
                continue
            cands.sort(key=score, reverse=True)
            best = cands[0]
            if score(best)[0] < 5:
                print("SKIP", proj.name, "->", best.name, file=sys.stderr)
                continue
            out.append((proj, best))
    return out


def main() -> int:
    if not INGEST.is_file():
        print("missing", INGEST, file=sys.stderr)
        return 1
    if not RENDER.is_dir():
        print("missing", RENDER, file=sys.stderr)
        return 1
    items = pairs()
    print(f"Ingesting {len(items)} titles", flush=True)
    failed = 0
    for proj, src in items:
        dest = proj / src.name
        if dest.is_symlink():
            dest.unlink()
        if not dest.exists():
            dest.symlink_to(src)
        rel = dest.relative_to(ROOT)
        print(f"INGEST {rel} ({src.stat().st_size / 1e9:.2f}G)", flush=True)
        r = subprocess.run([str(INGEST), str(rel)], cwd=ROOT)
        if r.returncode != 0:
            failed += 1
            print("FAIL", rel, file=sys.stderr, flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
