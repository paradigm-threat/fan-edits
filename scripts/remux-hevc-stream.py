#!/usr/bin/env python3
"""Remux archival Matroska finals to a single progressive/fragmented HEVC MP4.

Replaces the published final container (MKV → MP4) without re-encoding video/audio:

  ffmpeg -map 0:v:0 -map 0:a:0? -c copy -movflags +frag_keyframe+empty_moov+default_base_moof

Output basename: <stem>.hevc.mp4 (strips a trailing .mkv / .mp4 from the source name).

Optional:
  --replace-source  delete the source .mkv after a successful remux (NAS/local policy)
  --extract-subs    if project has a sibling or ./subs dir empty of english tracks,
                    try extracting text subs from the MKV into subs/

Web/mobile H.264 ladders stay separate (encode-web-renditions.py).
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

HEVC_SUFFIX = ".hevc.mp4"
SKIP_PARTS = (
    "seam",
    "preview",
    "proxy",
    "edit-1080",
    "web-1080p",
    "mobile-720p",
    ".hevc.mp4",
)


def which_ffmpeg() -> str:
    path = shutil.which("ffmpeg")
    if not path:
        raise SystemExit("ffmpeg not found on PATH")
    return path


def is_skip_media(name: str) -> bool:
    n = name.lower()
    return any(p in n for p in SKIP_PARTS)


def find_masters(folder: Path) -> list[Path]:
    cands: list[Path] = []
    if not folder.is_dir():
        return cands
    for p in sorted(folder.iterdir()):
        if not p.is_file() and not p.is_symlink():
            continue
        if p.suffix.lower() != ".mkv":
            continue
        if is_skip_media(p.name):
            continue
        try:
            if p.stat().st_size < 50_000_000:
                continue
        except OSError:
            continue
        cands.append(p)
    # Prefer *final* / edition names
    preferred = [
        c
        for c in cands
        if any(x in c.name.lower() for x in ("final", "edition", "debugged", "deanna"))
    ]
    return preferred or cands


def hevc_out_path(master: Path) -> Path:
    stem = master.name
    for suf in (".mkv", ".MKV", ".mp4", ".MP4"):
        if stem.endswith(suf):
            stem = stem[: -len(suf)]
            break
    if stem.lower().endswith(".hevc"):
        stem = stem[: -len(".hevc")]
    return master.parent / f"{stem}{HEVC_SUFFIX}"


def should_skip(out: Path, master: Path, *, force: bool) -> bool:
    if force or not out.is_file():
        return False
    try:
        return out.stat().st_mtime >= master.stat().st_mtime and out.stat().st_size > 1_000_000
    except OSError:
        return False


def remux_one(
    ffmpeg: str,
    master: Path,
    out: Path,
    *,
    force: bool,
    dry_run: bool,
) -> bool:
    if should_skip(out, master, force=force):
        print(f"SKIP {out} (up to date)", flush=True)
        return True
    cmd = [
        ffmpeg,
        "-hide_banner",
        "-y",
        "-i",
        str(master),
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c",
        "copy",
        "-movflags",
        "+frag_keyframe+empty_moov+default_base_moof",
        str(out),
    ]
    print("REMUX", master.name, "->", out.name, flush=True)
    if dry_run:
        print(" ", " ".join(cmd), flush=True)
        return True
    r = subprocess.run(cmd)
    if r.returncode != 0:
        print("FAIL remux", master, file=sys.stderr, flush=True)
        if out.is_file():
            try:
                out.unlink()
            except OSError:
                pass
        return False
    try:
        if out.stat().st_size < 1_000_000:
            print("FAIL tiny output", out, file=sys.stderr, flush=True)
            out.unlink(missing_ok=True)
            return False
    except OSError as e:
        print("FAIL", e, file=sys.stderr, flush=True)
        return False
    return True


def extract_subs_if_needed(ffmpeg: str, master: Path, folder: Path, *, dry_run: bool) -> None:
    """Best-effort: pull first subtitle stream into subs/ if no english/enhanced VTT yet."""
    subs_dir = folder / "subs"
    subs_dir.mkdir(parents=True, exist_ok=True)
    existing = list(subs_dir.glob("*.vtt")) + list(subs_dir.glob("*.srt"))
    if any("english" in p.name.lower() or "enhanced" in p.name.lower() for p in existing):
        return
    stem = folder.name
    out_srt = subs_dir / f"{stem}.english.srt"
    cmd = [
        ffmpeg,
        "-hide_banner",
        "-y",
        "-i",
        str(master),
        "-map",
        "0:s:0?",
        "-c:s",
        "srt",
        str(out_srt),
    ]
    print("EXTRACT-SUBS", out_srt.name, flush=True)
    if dry_run:
        print(" ", " ".join(cmd), flush=True)
        return
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0 or not out_srt.is_file() or out_srt.stat().st_size < 8:
        out_srt.unlink(missing_ok=True)
        return
    # Convert to VTT when helper present
    helper = ROOT / "scripts" / "srt_to_vtt.py"
    if helper.is_file():
        subprocess.run([sys.executable, str(helper), str(subs_dir)], cwd=ROOT, check=False)


def process_folder(
    folder: Path,
    *,
    force: bool,
    dry_run: bool,
    replace_source: bool,
    extract_subs: bool,
) -> int:
    ffmpeg = which_ffmpeg()
    masters = find_masters(folder)
    if not masters:
        # Already remuxed?
        hevcs = [
            p
            for p in folder.iterdir()
            if p.is_file() and p.name.lower().endswith(HEVC_SUFFIX)
        ] if folder.is_dir() else []
        if hevcs:
            print(f"OK {folder}: already has {hevcs[0].name}", flush=True)
            return 0
        print(f"NO-MASTER {folder}", file=sys.stderr, flush=True)
        return 1
    failed = 0
    for master in masters:
        out = hevc_out_path(master)
        if extract_subs:
            extract_subs_if_needed(ffmpeg, master, folder, dry_run=dry_run)
        ok = remux_one(ffmpeg, master, out, force=force, dry_run=dry_run)
        if not ok:
            failed += 1
            continue
        if replace_source and not dry_run:
            print("REMOVE", master, flush=True)
            try:
                if master.is_symlink():
                    master.unlink()
                else:
                    master.unlink()
            except OSError as e:
                print("WARN could not remove", master, e, file=sys.stderr, flush=True)
    return 1 if failed else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "paths",
        nargs="+",
        type=Path,
        help="Project folder(s) or a single .mkv master",
    )
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--replace-source",
        action="store_true",
        help="Delete source .mkv after successful remux",
    )
    ap.add_argument(
        "--extract-subs",
        action="store_true",
        help="Extract first subtitle stream into subs/ when english/enhanced missing",
    )
    args = ap.parse_args()
    rc = 0
    for raw in args.paths:
        p = raw if raw.is_absolute() else (ROOT / raw)
        p = p.resolve()
        if p.is_file() and p.suffix.lower() == ".mkv":
            folder = p.parent
            # Temporarily only remux this file by wrapping find
            ffmpeg = which_ffmpeg()
            out = hevc_out_path(p)
            if args.extract_subs:
                extract_subs_if_needed(ffmpeg, p, folder, dry_run=args.dry_run)
            ok = remux_one(ffmpeg, p, out, force=args.force, dry_run=args.dry_run)
            if ok and args.replace_source and not args.dry_run:
                print("REMOVE", p, flush=True)
                p.unlink(missing_ok=True)
            elif not ok:
                rc = 1
        elif p.is_dir():
            if process_folder(
                p,
                force=args.force,
                dry_run=args.dry_run,
                replace_source=args.replace_source,
                extract_subs=args.extract_subs,
            ):
                rc = 1
        else:
            print("missing", p, file=sys.stderr)
            rc = 1
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
