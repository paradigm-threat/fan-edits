#!/usr/bin/env python3
"""Encode progressive HEVC (H.265) MKV web/mobile renditions beside a master.

Outputs (next to the source file):
  <stem>.web-1080p.mkv   — max 1920w, libx265 CRF 22, AAC ~160k
  <stem>.mobile-720p.mkv — max 1280w, libx265 CRF 26, AAC ~128k

Also converts subs/*.srt → .vtt when a project subs/ directory is present.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Suffixes used by generate-index-json / player ladder
WEB_SUFFIX = ".web-1080p.mkv"
MOBILE_SUFFIX = ".mobile-720p.mkv"

SKIP_NAME_PARTS = (
    "seam",
    "preview",
    "proxy",
    "edit-1080",
    "web-1080p",
    "mobile-720p",
)


def which_ffmpeg() -> str:
    path = shutil.which("ffmpeg")
    if not path:
        raise SystemExit("ffmpeg not found on PATH")
    return path


def is_web_rendition(name: str) -> bool:
    n = name.lower()
    return n.endswith(WEB_SUFFIX) or n.endswith(MOBILE_SUFFIX) or any(
        p in n for p in SKIP_NAME_PARTS
    )


def find_master(folder: Path) -> Path | None:
    """Pick archival master (prefer .mkv over legacy .hevc.mp4; skip web/mobile/proxy)."""
    cands: list[Path] = []
    if not folder.is_dir():
        return None
    for p in sorted(folder.iterdir()):
        if not p.is_file() and not p.is_symlink():
            continue
        if p.suffix.lower() not in (".mkv", ".mp4", ".webm"):
            continue
        if is_web_rendition(p.name):
            continue
        try:
            if p.stat().st_size < 50_000_000:
                continue
        except OSError:
            continue
        cands.append(p)
    if not cands:
        return None
    for c in cands:
        cl = c.name.lower()
        if c.suffix.lower() == ".mkv" and (
            "final" in cl or "edition" in cl or "debugged" in cl or "deanna" in cl
        ):
            return c
    mkvs = [c for c in cands if c.suffix.lower() == ".mkv"]
    if mkvs:
        return mkvs[0]
    hevcs = [c for c in cands if c.name.lower().endswith(".hevc.mp4")]
    if hevcs:
        return hevcs[0]
    return cands[0]


def out_paths(master: Path) -> tuple[Path, Path]:
    stem = master.name
    for suf in (".mkv", ".mp4", ".webm", ".MKV", ".MP4", ".WEBM"):
        if stem.endswith(suf):
            stem = stem[: -len(suf)]
            break
    for junk in (".web-1080p", ".mobile-720p", ".hevc"):
        if stem.endswith(junk):
            stem = stem[: -len(junk)]
    return (
        master.parent / f"{stem}{WEB_SUFFIX}",
        master.parent / f"{stem}{MOBILE_SUFFIX}",
    )


def should_skip(out: Path, master: Path, *, force: bool) -> bool:
    if force or not out.is_file():
        return False
    try:
        return out.stat().st_mtime >= master.stat().st_mtime and out.stat().st_size > 1_000_000
    except OSError:
        return False


def encode_one(
    ffmpeg: str,
    master: Path,
    out: Path,
    *,
    max_w: int,
    crf: int,
    aac_k: int,
    preset: str,
    force: bool,
    dry_run: bool,
) -> bool:
    if should_skip(out, master, force=force):
        print(f"SKIP {out.relative_to(ROOT)} (up to date)", flush=True)
        return True
    vf = f"scale='min({max_w},iw)':-2"
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(master),
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx265",
        "-preset",
        preset,
        "-crf",
        str(crf),
        "-pix_fmt",
        "yuv420p",
        "-tag:v",
        "hvc1",
        "-vf",
        vf,
        "-c:a",
        "aac",
        "-b:a",
        f"{aac_k}k",
        "-ac",
        "2",
        str(out),
    ]
    print(f"ENCODE {' '.join(cmd[3:])}", flush=True)
    if dry_run:
        return True
    r = subprocess.run(cmd)
    if r.returncode != 0:
        print(f"FAIL encode {out}", file=sys.stderr, flush=True)
        return False
    print(f"OK {out.relative_to(ROOT)} ({out.stat().st_size / 1e6:.1f} MB)", flush=True)
    return True


def convert_subs(folder: Path, *, force: bool) -> None:
    subs = folder / "subs"
    if not subs.is_dir():
        return
    helper = ROOT / "scripts" / "srt_to_vtt.py"
    if not helper.is_file():
        return
    cmd = [sys.executable, str(helper), str(subs)]
    if force:
        cmd.append("--force")
    subprocess.run(cmd, cwd=ROOT, check=False)


def encode_master(
    master: Path, *, force: bool, dry_run: bool, which: str, preset: str
) -> int:
    ffmpeg = which_ffmpeg()
    web, mobile = out_paths(master)
    ok = True
    if which in ("all", "web"):
        ok = (
            encode_one(
                ffmpeg,
                master,
                web,
                max_w=1920,
                crf=22,
                aac_k=160,
                preset=preset,
                force=force,
                dry_run=dry_run,
            )
            and ok
        )
    if which in ("all", "mobile"):
        ok = (
            encode_one(
                ffmpeg,
                master,
                mobile,
                max_w=1280,
                crf=26,
                aac_k=128,
                preset=preset,
                force=force,
                dry_run=dry_run,
            )
            and ok
        )
    if not dry_run:
        convert_subs(master.parent, force=force)
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "targets",
        nargs="*",
        help="Master file, project folder, or slug/path under FanMixes|KidFriendly",
    )
    ap.add_argument("--force", action="store_true", help="Re-encode even if outputs exist")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--which",
        choices=("all", "web", "mobile"),
        default="all",
        help="Which rung(s) to encode",
    )
    ap.add_argument(
        "--preset",
        default="medium",
        help="libx265 preset (use faster/veryfast for quicker pilots)",
    )
    args = ap.parse_args()
    targets = args.targets
    if not targets:
        print(
            "usage: encode-web-renditions.py <project-folder|master.mkv> [...]",
            file=sys.stderr,
        )
        return 2

    failed = 0
    for t in targets:
        path = Path(t)
        if not path.is_absolute():
            path = (ROOT / path).resolve()
        if path.is_dir():
            master = find_master(path)
            if not master:
                print(f"NO MASTER {path}", file=sys.stderr)
                failed += 1
                continue
        elif path.is_file() or path.is_symlink():
            master = path
        else:
            print(f"MISSING {path}", file=sys.stderr)
            failed += 1
            continue
        failed += encode_master(
            master,
            force=args.force,
            dry_run=args.dry_run,
            which=args.which,
            preset=args.preset,
        )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
