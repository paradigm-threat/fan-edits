#!/usr/bin/env python3
"""Write FanMixes/*/files.json listing downloadable project files (not feature MKVs)."""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_SUFFIXES = (
    ".mkv",
    ".mp4",
    ".webm",
    ".mov",
    ".avi",
    ".ipfs",
    ".bak",
    ".log",
    ".pyc",
)
SKIP_NAME_PARTS = ("_backup", ".bak-", "~")
SKIP_DIR_NAMES = {".git", "node_modules", "seams", "__pycache__", ".relay"}
KIND_RULES = (
    (".kdenlive", "kdenlive"),
    (".srt", "srt"),
    (".vtt", "vtt"),
    ("stats.json", "stats"),
    ("poster.jpg", "poster"),
    ("poster.jpeg", "poster"),
    ("poster.png", "poster"),
    ("plan.md", "plan"),
    ("readme.md", "readme"),
    ("files.json", "manifest"),
)


def kind_for(rel: str) -> str:
    lower = rel.lower()
    base = Path(lower).name
    for suffix, kind in KIND_RULES:
        if base == suffix or lower.endswith(suffix):
            return kind
    if (
        "/music/" in lower
        or lower.startswith("music/")
        or "_ost/" in lower
        or lower.endswith((".mp3", ".flac", ".ogg", ".wav", ".m4a"))
    ):
        return "music"
    if "/subs/" in lower or lower.startswith("subs/"):
        return "subtitle"
    return "other"


def should_skip(rel: str) -> bool:
    lower = rel.lower()
    name = Path(lower).name
    if name in (".ds_store", "thumbs.db"):
        return True
    if name == "files.json":
        return True
    for part in SKIP_NAME_PARTS:
        if part in name:
            return True
    for suf in SKIP_SUFFIXES:
        if lower.endswith(suf):
            return True
    return False


def scan_project(project_dir: Path) -> list[dict]:
    files: list[dict] = []
    if not project_dir.is_dir():
        return files
    for dirpath, dirnames, filenames in os.walk(project_dir):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIR_NAMES]
        for name in filenames:
            full = Path(dirpath) / name
            try:
                if full.is_symlink() or not full.is_file():
                    # Feature MKVs are often symlinks; skip non-regular files.
                    continue
            except OSError:
                continue
            rel = full.relative_to(project_dir).as_posix()
            if should_skip(rel):
                continue
            try:
                size = full.stat().st_size
            except OSError:
                continue
            # Tiny poster placeholders are not useful downloads (real art is IPFS).
            if kind_for(rel) == "poster" and size < 4096:
                continue
            files.append(
                {
                    "path": rel,
                    "kind": kind_for(rel),
                    "bytes": size,
                }
            )
    files.sort(key=lambda f: (f["kind"], f["path"].lower()))
    return files


def main() -> None:
    idx = json.loads((ROOT / "index.json").read_text())
    projects = idx.get("projects") or []
    wrote = 0
    for p in projects:
        rel = (p.get("path") or "").strip().strip("/")
        if not rel:
            continue
        project_dir = ROOT / rel
        files = scan_project(project_dir)
        out = {
            "schema": "flashback.project-files.v1",
            "path": rel,
            "files": files,
        }
        out_path = project_dir / "files.json"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(out, indent=2) + "\n")
        wrote += 1
        print(f"{rel}: {len(files)} files")
    print(f"wrote {wrote} files.json")


if __name__ == "__main__":
    main()
