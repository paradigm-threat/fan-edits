#!/usr/bin/env python3
"""Render web/mobile H.264 ladders from a Kdenlive/MLT timeline (source, not master).

Uses melt with ATSC 1080p/720p profiles so MLT scales from the project profile
(usually 4K) while applying the full cut + overlays. Outputs match
encode-web-renditions.py naming:

  <stem>.web-1080p.mp4   — atsc_1080p_2398, CRF 20, AAC 160k
  <stem>.mobile-720p.mp4 — atsc_720p_2398, CRF 23, AAC 128k

Also remaps Windows N:/ paths and swaps kdenlive proxy resources for originals.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

WEB_SUFFIX = ".web-1080p.mkv"
MOBILE_SUFFIX = ".mobile-720p.mkv"

PROXY_CACHE_RE = re.compile(r".*/\.cache/kdenlive/proxy/")
N_VIDEOS_RE = re.compile(r"N:/Videos/", re.I)


def which_melt() -> str:
    for name in ("melt-7", "melt"):
        path = shutil.which(name)
        if path:
            return path
    raise SystemExit("melt not found on PATH")


def resolve_linux_media(path: str) -> str:
    """Pick an existing local path for a remapped Windows media path."""
    if not path or path in ("black", "-"):
        return path
    speed = ""
    body = path
    if body.startswith("0.5:"):
        speed = "0.5:"
        body = body[4:]
    candidates = [body]
    if "/Horror and SciFi/" in body:
        candidates.append(body.replace("/Horror and SciFi/", "/", 1))
    for cand in candidates:
        if Path(cand).exists():
            return f"{speed}{cand}"
    return path  # leave as-is; melt will error clearly


def remap_path(text: str) -> str:
    """Map N:/Videos/... → /home/ari/Videos/... (incl. JSON blobs / attributes)."""
    if not text or "N:/" not in text and "n:/" not in text.lower():
        return text
    # Normalize slashes then rewrite drive root
    out = text.replace("\\", "/")
    out = N_VIDEOS_RE.sub("/home/ari/Videos/", out)
    # If this looks like a single media path, prefer an existing file
    if out.endswith((".mkv", ".mp4", ".mov", ".mp3", ".wav", ".flac", ".m4a")) or out.startswith(
        "0.5:"
    ):
        return resolve_linux_media(out)
    # JSON / multi-path blobs: also try Horror-and-SciFi strip when file missing
    if "/Horror and SciFi/" in out:

        def _fix_abs(m: re.Match[str]) -> str:
            return resolve_linux_media(m.group(0))

        out = re.sub(r"/home/ari/Videos/[^\"']+\.(?:mkv|mp4|mov|mp3)", _fix_abs, out)
    return out


def prepare_mlt(src: Path, dest: Path) -> None:
    """Copy project XML with proxies disabled and paths remapped for Linux melt."""
    tree = ET.parse(src)
    root = tree.getroot()

    # Remap root= and other attributes that embed Windows paths
    for key, val in list(root.attrib.items()):
        root.set(key, remap_path(val))

    # Prefer original media over proxy clips
    for chain in list(root.iter()):
        if chain.tag not in ("chain", "producer"):
            continue
        res = chain.find("./property[@name='resource']")
        orig = chain.find("./property[@name='kdenlive:original.resource']")
        proxy = chain.find("./property[@name='kdenlive:proxy']")
        if res is not None and res.text and PROXY_CACHE_RE.search(res.text):
            if orig is not None and orig.text and not PROXY_CACHE_RE.search(orig.text):
                res.text = orig.text
            elif proxy is not None and proxy.text and proxy.text not in ("-", "") and not PROXY_CACHE_RE.search(
                proxy.text
            ):
                res.text = proxy.text

    for prop in root.findall(".//property"):
        name = prop.get("name") or ""
        if prop.text:
            prop.text = remap_path(prop.text)
        if name in (
            "kdenlive:docproperties.enableproxy",
            "kdenlive:docproperties.generateproxy",
            "kdenlive:docproperties.generateimageproxy",
            "kdenlive:docproperties.enableexternalproxy",
        ):
            prop.text = "0"

    # Softsubs ship as VTT sidecars — drop burned-in subtitle filters/tracks
    for parent in root.iter():
        for child in list(parent):
            if child.tag != "filter":
                continue
            svc = child.find("./property[@name='mlt_service']")
            if svc is not None and svc.text and "subtitle" in svc.text.lower():
                parent.remove(child)

    dest.parent.mkdir(parents=True, exist_ok=True)
    tree.write(dest, encoding="utf-8", xml_declaration=True)


def out_paths(out_dir: Path, stem: str) -> tuple[Path, Path]:
    return out_dir / f"{stem}{WEB_SUFFIX}", out_dir / f"{stem}{MOBILE_SUFFIX}"


def render_one(
    melt: str,
    project: Path,
    out: Path,
    *,
    profile: str,
    crf: int,
    aac_k: int,
    preset: str,
    force: bool,
    dry_run: bool,
) -> bool:
    if out.is_file() and out.stat().st_size > 1_000_000 and not force:
        print(f"SKIP {out} (exists)", flush=True)
        return True

    out.parent.mkdir(parents=True, exist_ok=True)
    partial = out.with_suffix(out.suffix + ".partial")
    if partial.exists():
        partial.unlink()

    cmd = [
        melt,
        "-progress",
        "-profile",
        profile,
        str(project),
        "-consumer",
        f"avformat:{partial}",
        f"vcodec=libx264",
        f"preset={preset}",
        f"crf={crf}",
        "pix_fmt=yuv420p",
        "acodec=aac",
        f"ab={aac_k}k",
        "channels=2",
        "f=mp4",
        "movflags=+faststart",
        "real_time=-1",
    ]
    print(f"MELT profile={profile} → {out.name}", flush=True)
    print("+", " ".join(cmd[:8]), "...", flush=True)
    if dry_run:
        return True

    env = os.environ.copy()
    env.setdefault("QT_QPA_PLATFORM", "offscreen")
    # Relative audio/music paths resolve against project directory
    r = subprocess.run(cmd, cwd=str(project.parent), env=env)
    # Feature-length 1080p/720p H.264 should be hundreds of MB; reject truncated races.
    min_bytes = 200_000_000 if "1080" in profile or "web" in out.name else 80_000_000
    if r.returncode != 0 or not partial.is_file() or partial.stat().st_size < min_bytes:
        print(
            f"FAIL melt {out} (rc={r.returncode} size="
            f"{partial.stat().st_size if partial.exists() else 0})",
            file=sys.stderr,
            flush=True,
        )
        if partial.exists():
            partial.unlink(missing_ok=True)
        return False
    partial.replace(out)
    print(f"OK {out} ({out.stat().st_size / 1e6:.1f} MB)", flush=True)
    return True


def convert_subs(folder: Path) -> None:
    subs = folder / "subs"
    helper = ROOT / "scripts" / "srt_to_vtt.py"
    if subs.is_dir() and helper.is_file():
        subprocess.run([sys.executable, str(helper), str(subs)], cwd=ROOT, check=False)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--project", type=Path, required=True, help="`.kdenlive` or `.mlt` timeline")
    ap.add_argument(
        "--out-dir",
        type=Path,
        required=True,
        help="Directory for *.web-1080p.mp4 / *.mobile-720p.mp4",
    )
    ap.add_argument(
        "--stem",
        required=True,
        help="Output basename stem (e.g. 'Van Helsing - DeAnna\\'d')",
    )
    ap.add_argument("--which", choices=("all", "web", "mobile"), default="all")
    ap.add_argument("--preset", default="veryfast")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--subs-dir",
        type=Path,
        help="Optional FanMixes project folder whose subs/ should be converted to VTT",
    )
    args = ap.parse_args()

    project = args.project.expanduser().resolve()
    if not project.is_file():
        raise SystemExit(f"missing project: {project}")

    melt = which_melt()
    web, mobile = out_paths(args.out_dir.expanduser().resolve(), args.stem)

    with tempfile.TemporaryDirectory(prefix="kden-web-") as tmp:
        prepared = Path(tmp) / project.name
        # Keep sidecar relative assets: write prepared XML next to original via symlink tree
        work = Path(tmp) / "work"
        work.mkdir()
        # Symlink everything from project dir so relative music/ost paths resolve,
        # then overwrite the project file with the prepared XML.
        for item in project.parent.iterdir():
            dest = work / item.name
            if item.resolve() == project.resolve():
                continue
            try:
                dest.symlink_to(item)
            except OSError:
                pass
        prepare_mlt(project, prepared)
        # Also place prepared project inside work under original filename
        work_project = work / project.name
        shutil.copy2(prepared, work_project)

        ok = True
        if args.which in ("all", "web"):
            ok = (
                render_one(
                    melt,
                    work_project,
                    web,
                    profile="atsc_1080p_2398",
                    crf=20,
                    aac_k=160,
                    preset=args.preset,
                    force=args.force,
                    dry_run=args.dry_run,
                )
                and ok
            )
        if args.which in ("all", "mobile"):
            ok = (
                render_one(
                    melt,
                    work_project,
                    mobile,
                    profile="atsc_720p_2398",
                    crf=23,
                    aac_k=128,
                    preset=args.preset,
                    force=args.force,
                    dry_run=args.dry_run,
                )
                and ok
            )

    if ok and not args.dry_run and args.subs_dir:
        convert_subs(args.subs_dir.expanduser().resolve())
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
