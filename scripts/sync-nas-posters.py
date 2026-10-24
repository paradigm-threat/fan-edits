#!/usr/bin/env python3
"""Sync FanMixes posters to the NAS library for Nova / VLC Android autodetection.

For each title folder under the NAS FanMixes tree:
  - Resolve best source: repo poster.jpg → HD FanEditRender poster.jpg → large local cover image
  - Write:
      poster.jpg              (Flashback / Kodi-style)
      folder.jpg              (Nova / many Android browsers)
      <primary-mkv-stem>.jpg  (VLC Android media-library match)

Also copies a missing repo poster.jpg when a source exists (does not invent art).

Usage:
  python3 scripts/sync-nas-posters.py
  python3 scripts/sync-nas-posters.py --dry-run
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
REPO_FM = REPO / "FanMixes"
HD = Path("/media/ari/HD/FanEditRender")
NAS_FM = Path("/mnt/nobiserv-public/Videos/FanEdits/FanMixes")

# Repo folder name → NAS folder name when titles diverge
NAS_ALIASES = {}

SKIP_MKV_SUBSTR = ("seam", "source", "trailer", "preview", "sample")


def primary_mkv(folder: Path) -> Path | None:
    mkvs = [
        p
        for p in folder.glob("*.mkv")
        if p.is_file()
        and not any(s in p.name.lower() for s in SKIP_MKV_SUBSTR)
    ]
    if not mkvs:
        return None
    mkvs.sort(key=lambda p: (-("edition" in p.name.lower()), -p.stat().st_size))
    return mkvs[0]


def large_covers(folder: Path) -> list[Path]:
    out = []
    if not folder.is_dir():
        return out
    for p in folder.iterdir():
        if not p.is_file():
            continue
        if p.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        if p.stat().st_size < 20_000:
            continue
        name = p.name.lower()
        if name in ("poster.jpg", "folder.jpg"):
            continue
        out.append(p)
    # Prefer names that look like covers / match folder
    out.sort(
        key=lambda p: (
            -("poster" in p.name.lower() or p.stem.lower() in folder.name.lower()[:20]),
            -p.stat().st_size,
        )
    )
    return out


def resolve_source(repo_title: str, nas_title: str) -> Path | None:
    candidates = [
        REPO_FM / repo_title / "poster.jpg",
        HD / repo_title / "poster.jpg",
        HD / "FanMixes" / repo_title / "poster.jpg",
        NAS_FM / nas_title / "poster.jpg",
        NAS_FM / nas_title / "img" / "poster.jpg",
    ]
    for c in candidates:
        if c.is_file() and c.stat().st_size > 10_000:
            return c
    covers = large_covers(NAS_FM / nas_title) + large_covers(HD / repo_title)
    return covers[0] if covers else None


def ensure_jpeg(src: Path, dest: Path, dry: bool) -> None:
    """Copy or convert src → dest as JPEG."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if src.resolve() == dest.resolve():
        return
    if src.suffix.lower() in (".jpg", ".jpeg") and not dry:
        shutil.copy2(src, dest)
        return
    if dry:
        print(f"  would convert {src.name} → {dest.name}")
        return
    # ffmpeg is available in this environment for ladder work
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(src),
        "-q:v",
        "2",
        str(dest),
    ]
    try:
        subprocess.check_call(cmd)
    except (subprocess.CalledProcessError, FileNotFoundError):
        # fallback: copy bytes even if png named .jpg (players often still load)
        shutil.copy2(src, dest)


def sync_title(nas_dir: Path, dry: bool) -> dict:
    nas_title = nas_dir.name
    # reverse alias
    repo_title = nas_title
    for r, n in NAS_ALIASES.items():
        if n == nas_title:
            repo_title = r
            break
    if (REPO_FM / nas_title).is_dir():
        repo_title = nas_title

    src = resolve_source(repo_title, nas_title)
    result = {
        "nas": nas_title,
        "repo": repo_title,
        "source": str(src) if src else None,
        "actions": [],
    }
    if not src:
        result["status"] = "no_source"
        return result

    targets = [nas_dir / "poster.jpg", nas_dir / "folder.jpg"]
    mkv = primary_mkv(nas_dir)
    if mkv:
        targets.append(nas_dir / f"{mkv.stem}.jpg")

    for dest in targets:
        if dest.is_file() and dest.stat().st_size > 10_000:
            # refresh if source newer / larger and dest is tiny stub — skip if ok
            result["actions"].append(f"keep {dest.name}")
            continue
        result["actions"].append(f"{'would write' if dry else 'write'} {dest.name}")
        if not dry:
            ensure_jpeg(src, dest, dry=False)

    # Fill missing repo poster
    repo_poster = REPO_FM / repo_title / "poster.jpg"
    if (REPO_FM / repo_title).is_dir() and not repo_poster.is_file():
        result["actions"].append(
            f"{'would write' if dry else 'write'} repo poster.jpg"
        )
        if not dry:
            ensure_jpeg(src, repo_poster, dry=False)

    result["status"] = "ok"
    return result


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not NAS_FM.is_dir():
        print(f"NAS FanMixes not mounted: {NAS_FM}", file=sys.stderr)
        return 1

    results = []
    for nas_dir in sorted(p for p in NAS_FM.iterdir() if p.is_dir()):
        r = sync_title(nas_dir, args.dry_run)
        results.append(r)
        print(f"{r['status']:9} {r['nas']}")
        if r.get("source"):
            print(f"          src={r['source']}")
        for a in r.get("actions") or []:
            print(f"          {a}")

    ok = sum(1 for r in results if r["status"] == "ok")
    missing = sum(1 for r in results if r["status"] == "no_source")
    print(f"\nok={ok} no_source={missing} total={len(results)}")
    if missing:
        print("Still missing art (need generate/download):")
        for r in results:
            if r["status"] == "no_source":
                print(f"  - {r['nas']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
