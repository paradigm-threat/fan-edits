#!/usr/bin/env python3
"""Symlink FanEditRender finals into project folders and run relay-ipfs-ingest."""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RENDER = Path("/media/ari/HD/FanEditRender")
INGEST = Path.home() / "dev/relay/relay-gateway/scripts/relay-ipfs-ingest"

WEB_GLOBS = ("*.web-1080p.mkv", "*.mobile-720p.mkv")
HEVC_GLOBS = ("*.hevc.mp4",)  # legacy; prefer .mkv
MASTER_GLOBS = ("*.mkv", "*.hevc.mp4")  # prefer final MKV with embedded subs



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
            # Prefer exact render folder name match only.
            exact = RENDER / name
            cands: list[Path] = []
            search_dirs: list[Path] = []
            if exact.is_dir():
                search_dirs.append(exact)
            # No fuzzy folder fallback — wrong-sibling matches were too common.
            for d in search_dirs:
                for pattern in MASTER_GLOBS:
                    for f in d.glob(pattern):
                        if f.stat().st_size < 80_000_000:
                            continue
                        low = f.name.lower()
                        if "seam" in low or "preview" in low or "edit-1080" in low:
                            continue
                        if "web-1080p" in low or "mobile-720p" in low:
                            continue
                        if is_source_rip(f.name):
                            continue
                        cands.append(f)
            if not cands:
                print("NO CAND", name, file=sys.stderr)
                continue
            # Prefer filenames that share the project title tokens
            def name_score(p: Path) -> tuple[int, int, int]:
                base_s, sz = score(p)
                pn = p.stem.lower()
                # Prefer final MKV (embedded subs) over HEVC MP4 remux
                if p.suffix.lower() == ".mkv" and "clean" not in p.name.lower():
                    base_s += 40
                elif p.name.lower().endswith(".hevc.mp4"):
                    base_s += 10
                elif "clean" in p.name.lower():
                    base_s += 5
                if name.lower() in pn or pn in name.lower():
                    base_s += 20
                for other in ("sonic 2", "sonic 3", "mummy returns", "revolutions", "reloaded"):
                    if other in pn and other not in name.lower():
                        base_s -= 30
                return (base_s, sz, -len(p.name))

            cands.sort(key=name_score, reverse=True)
            best = cands[0]
            if name_score(best)[0] < 8:
                print("SKIP", proj.name, "->", best.name, "score", name_score(best)[0], file=sys.stderr)
                continue
            out.append((proj, best))
    return out


def web_rendition_paths() -> list[Path]:
    """Find already-encoded web/mobile MP4s under FanMixes|KidFriendly."""
    out: list[Path] = []
    for cat in ("FanMixes", "KidFriendly"):
        base = ROOT / cat
        if not base.is_dir():
            continue
        for proj in sorted(base.iterdir()):
            if not proj.is_dir():
                continue
            for pattern in WEB_GLOBS:
                for f in sorted(proj.glob(pattern)):
                    if f.is_file() and f.stat().st_size > 1_000_000:
                        out.append(f)
    return out


def ingest_path(rel: Path, size_hint: int | None = None) -> int:
    sz = size_hint
    if sz is None:
        try:
            sz = (ROOT / rel).stat().st_size
        except OSError:
            sz = 0
    label = f"{sz / 1e9:.2f}G" if sz >= 1e9 else f"{sz / 1e6:.1f}M"
    print(f"INGEST {rel} ({label})", flush=True)
    r = subprocess.run([str(INGEST), str(rel)], cwd=ROOT)
    if r.returncode != 0:
        print("FAIL", rel, file=sys.stderr, flush=True)
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--web-renditions",
        action="store_true",
        help="Also (or only with --web-renditions-only) ingest *.web-1080p.mp4 / *.mobile-720p.mp4",
    )
    ap.add_argument(
        "--web-renditions-only",
        action="store_true",
        help="Skip master symlink/ingest; only ingest web/mobile MP4 renditions",
    )
    ap.add_argument(
        "--skip-media-root",
        action="store_true",
        help="Do not run build-ipfs-media-root.py at the end",
    )
    args = ap.parse_args()

    if not INGEST.is_file():
        print("missing", INGEST, file=sys.stderr)
        return 1

    failed = 0
    do_masters = not args.web_renditions_only
    do_web = args.web_renditions or args.web_renditions_only

    if do_masters:
        if not RENDER.is_dir():
            print("missing", RENDER, file=sys.stderr)
            return 1
        items = pairs()
        print(f"Ingesting {len(items)} titles", flush=True)
        for proj, src in items:
            dest = proj / src.name
            if dest.is_symlink():
                dest.unlink()
            if not dest.exists():
                dest.symlink_to(src)
            rel = dest.relative_to(ROOT)
            failed += ingest_path(rel, src.stat().st_size)

    if do_web:
        webs = web_rendition_paths()
        print(f"Ingesting {len(webs)} web/mobile renditions", flush=True)
        for f in webs:
            failed += ingest_path(f.relative_to(ROOT), f.stat().st_size)

    build = ROOT / "scripts" / "build-ipfs-media-root.py"
    if build.is_file() and not args.skip_media_root:
        print("Building IPFS mediaRoot DAG…", flush=True)
        cmd = [sys.executable, str(build)]
        # Partial OK while some titles still pending; re-run without --skip-missing before publish.
        if failed:
            cmd.append("--skip-missing")
        br = subprocess.run(cmd, cwd=ROOT)
        if br.returncode != 0:
            print("FAIL build-ipfs-media-root", file=sys.stderr, flush=True)
            failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
