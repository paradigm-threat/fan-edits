#!/usr/bin/env python3
"""Regenerate index.json from git-tracked FanMixes/*/README.md and KidFriendly/*/README.md."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "index.json"
MANIFEST = ROOT / "assets.manifest.json"
ASSETS_DIR = ROOT / ".relay" / "assets"


def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def title_from_readme(readme: Path, fallback: str) -> str:
    try:
        for line in readme.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if line.startswith("# "):
                return line[2:].strip()
    except OSError:
        pass
    return fallback


def blurb_from_readme(readme: Path) -> str:
    """First description paragraph after H1 (skip Motivation/Changes heads)."""
    try:
        text = readme.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""
    lines = text.splitlines()
    past_title = False
    buf: list[str] = []
    for line in lines:
        s = line.strip()
        if s.startswith("# "):
            past_title = True
            continue
        if not past_title:
            continue
        if s.startswith("#"):
            # Stop at Motivation / Changes / other sections
            break
        if not s:
            if buf:
                break
            continue
        if s.startswith("```") or s.startswith("|") or s.startswith("!["):
            continue
        if s.startswith("- ") or s.startswith("* "):
            continue
        buf.append(s)
        if len(" ".join(buf)) > 220:
            break
    return " ".join(buf)[:280]


def git_readmes() -> list[str]:
    proc = subprocess.run(
        ["git", "ls-files", "FanMixes/*/README.md", "KidFriendly/*/README.md"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return [p for p in proc.stdout.splitlines() if p.strip()]


def load_manifest_paths() -> set[str]:
    paths: set[str] = set()
    if MANIFEST.is_file():
        try:
            data = json.loads(MANIFEST.read_text(encoding="utf-8"))
            assets = data.get("assets") or []
            if isinstance(assets, dict):
                for key, val in assets.items():
                    if isinstance(val, dict) and val.get("path"):
                        paths.add(str(val["path"]).lstrip("/"))
                    else:
                        paths.add(str(key).lstrip("/"))
            elif isinstance(assets, list):
                for val in assets:
                    if isinstance(val, dict) and val.get("path"):
                        paths.add(str(val["path"]).lstrip("/"))
        except (OSError, json.JSONDecodeError):
            pass
    if ASSETS_DIR.is_dir():
        for p in ASSETS_DIR.rglob("*.ipfs"):
            rel = p.relative_to(ASSETS_DIR).as_posix()
            if rel.endswith(".ipfs"):
                paths.add(rel[: -len(".ipfs")])
    return paths


POSTER_BASENAMES = (
    "poster.jpg",
    "poster.jpeg",
    "poster.png",
    "poster.webp",
    "cover.jpg",
    "cover.jpeg",
    "cover.png",
    "cover.webp",
)


def find_poster(folder: Path, folder_rel: str) -> str | None:
    """Pick a poster/cover image under the project folder when present."""
    if not folder.is_dir():
        return None
    for base in (folder, folder / "img"):
        if not base.is_dir():
            continue
        for name in POSTER_BASENAMES:
            p = base / name
            if p.is_file():
                return f"{folder_rel}/{p.relative_to(folder).as_posix()}"
    # Project-folder-named art (common for these mixes)
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        for base in (folder, folder / "img"):
            if not base.is_dir():
                continue
            p = base / f"{folder.name}{ext}"
            if p.is_file():
                return f"{folder_rel}/{p.relative_to(folder).as_posix()}"
    return None


def media_root_poster(slug: str) -> str | None:
    mapped = {
        "sonic-2020-deschwartzed": "media/Sonic DeSchwartzed Edition Poster.png",
        "sonic-2-2022-deschwartzed": "media/Sonic DeSchwartzed Edition Poster.png",
    }
    rel = mapped.get(slug)
    if rel and (ROOT / rel).is_file():
        return rel
    return None


def find_media(folder: Path, folder_rel: str, manifest_paths: set[str]) -> str | None:
    """Return media basename relative to project folder if stub/manifest exists or local file present."""
    candidates: list[str] = []
    # Prefer conventional names
    for p in sorted(folder.iterdir()) if folder.is_dir() else []:
        if p.suffix.lower() in (".mkv", ".mp4", ".webm") and p.is_file():
            # skip seams / preview
            name = p.name.lower()
            if "seam" in name or "preview" in name or "proxy" in name or "edit-1080" in name:
                continue
            candidates.append(p.name)
    # Also check manifest for paths under this project
    prefix = folder_rel.rstrip("/") + "/"
    for mp in manifest_paths:
        if mp.startswith(prefix):
            rest = mp[len(prefix) :]
            if "/" not in rest and rest.lower().endswith((".mkv", ".mp4", ".webm")):
                if rest not in candidates:
                    candidates.insert(0, rest)
    if not candidates:
        return None
    # Prefer non-final naming quirks: *Edition*, *Debugged*, exact folder-ish
    for c in candidates:
        cl = c.lower()
        if "final" in cl or "edition" in cl or "debugged" in cl or "deanna" in cl:
            return c
    return candidates[0]


def find_subtitles(folder: Path, folder_rel: str) -> list[dict]:
    subs_dir = folder / "subs"
    out: list[dict] = []
    if not subs_dir.is_dir():
        return out
    for p in sorted(subs_dir.glob("*.srt")):
        label = "English"
        default = False
        name = p.name.lower()
        if "enhanced" in name or "citation" in name:
            label = "Citations"
        elif "english" in name:
            label = "English"
            default = True
        entry = {
            "src": f"{folder_rel}/subs/{p.name}",
            "label": label,
            "lang": "en",
        }
        if default:
            entry["default"] = True
        out.append(entry)
    if out and not any(t.get("default") for t in out):
        out[0]["default"] = True
    return out


def status_for(folder: Path, media: str | None, readme: Path) -> str:
    if media:
        # stub or local file present
        stub = ASSETS_DIR / folder.relative_to(ROOT).as_posix() / f"{media}.ipfs"
        local = folder / media
        if stub.is_file() or (local.is_file() and local.stat().st_size > 50_000_000):
            return "ready"
        return "needs-seed"
    try:
        text = readme.read_text(encoding="utf-8", errors="replace").lower()
    except OSError:
        text = ""
    if "not rendered" in text or "wip" in text or "work in progress" in text:
        return "wip"
    return "wip"


def main() -> None:
    manifest_paths = load_manifest_paths()
    projects = []
    for rel in sorted(git_readmes()):
        path = Path(rel)
        category = path.parts[0]
        folder = ROOT / path.parent
        folder_rel = path.parent.as_posix()
        slug = slugify(path.parent.name)
        title = title_from_readme(ROOT / rel, path.parent.name)
        blurb = blurb_from_readme(ROOT / rel)
        reel_candidates = list(folder.glob("*.reel")) if folder.is_dir() else []
        reel = reel_candidates[0].as_posix() if len(reel_candidates) == 1 else None
        media = find_media(folder, folder_rel, manifest_paths)
        poster = find_poster(folder, folder_rel)
        if not poster:
            poster = media_root_poster(slug)
        subs = find_subtitles(folder, folder_rel)
        status = status_for(folder, media, ROOT / rel)
        entry: dict = {
            "slug": slug,
            "category": category,
            "path": folder_rel,
            "title": title,
            "status": status,
        }
        if blurb:
            entry["blurb"] = blurb
        else:
            entry["blurb"] = ""
        if reel:
            entry["reel"] = reel
        if media:
            entry["media"] = media
        else:
            entry["media"] = ""
        # Always include image so CleverScript property access never throws
        entry["image"] = poster if poster else ""
        if subs:
            entry["subtitles"] = subs
        projects.append(entry)

    doc = {"projects": projects}
    OUT.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(projects)} projects to {OUT}")


if __name__ == "__main__":
    main()
