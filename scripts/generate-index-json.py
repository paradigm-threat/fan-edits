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


def original_title_from(display_title: str, folder_name: str) -> str:
    """Source film name without fanedit/edition suffix.

    Prefer the README/display title (often includes the year), else the folder
    name. Strip a trailing edition segment after `` - `` or `` — ``
    (e.g. ``Van Helsing (2004) — DeAnna'd`` → ``Van Helsing (2004)``;
    folder ``Van Helsing - DeAnna'd`` alone → ``Van Helsing``). Also drop a
    trailing `` [tag]`` like ``[1080p]``.
    """
    raw = (display_title or "").strip() or (folder_name or "").strip()
    # Prefer whichever candidate still has a (YYYY) year when both exist.
    folder = (folder_name or "").strip()
    year_re = re.compile(r"\(\d{4}\)")
    if folder and year_re.search(folder) and not year_re.search(raw):
        raw = folder
    # Split on space-hyphen-space or em dash edition separator (last wins if multiple).
    for sep in (" — ", " - "):
        if sep in raw:
            raw = raw.split(sep, 1)[0].strip()
            break
    # Trailing bracket tags: "Title (1971) [1080p]" → "Title (1971)"
    raw = re.sub(r"\s*\[[^\]]+\]\s*$", "", raw).strip()
    return raw or folder_name or display_title


def load_stats(folder: Path) -> dict | None:
    path = folder / "stats.json"
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


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


# Canonical poster art per FanMix: put `poster.jpg` in the project folder
# (or under `img/`). Preferred name is poster.jpg; also accepted: poster.png /
# poster.webp and cover.*. Legacy: `<folder-name>.jpg`. Path is stored on
# index.json as `image` (repo-relative) for the site carousel / now-showing.
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
    # Project-folder-named art (legacy)
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        for base in (folder, folder / "img"):
            if not base.is_dir():
                continue
            p = base / f"{folder.name}{ext}"
            if p.is_file():
                return f"{folder_rel}/{p.relative_to(folder).as_posix()}"
    return None


def media_root_poster(slug: str) -> str | None:
    """Optional shared art under media/ (only if the file still exists)."""
    mapped = {
        "sonic-2020-deschwartzed": "media/Sonic DeSchwartzed Edition Poster.png",
        "sonic-2-2022-deschwartzed": "media/Sonic DeSchwartzed Edition Poster.png",
        "sonic-3-2024-deschwartzed": "media/Sonic DeSchwartzed Edition Poster.png",
    }
    rel = mapped.get(slug)
    if rel and (ROOT / rel).is_file():
        return rel
    return None


WEB_SUFFIX = ".web-1080p.mp4"
MOBILE_SUFFIX = ".mobile-720p.mp4"
HEVC_SUFFIX = ".hevc.mp4"


def is_web_or_skip_media(name: str) -> bool:
    n = name.lower()
    if n.endswith(WEB_SUFFIX) or n.endswith(MOBILE_SUFFIX):
        return True
    return any(p in n for p in ("seam", "preview", "proxy", "edit-1080"))


def _media_rank(name: str) -> tuple[int, int, str]:
    """Prefer final MKV (embedded subs) over HEVC MP4 remux."""
    n = name.lower()
    if n.endswith(".mkv") and "clean" not in n and "seam" not in n:
        tier = 0
    elif n.endswith(HEVC_SUFFIX):
        tier = 1
    elif n.endswith(".mkv"):
        tier = 2
    elif n.endswith(".mp4") and not is_web_or_skip_media(name):
        tier = 3
    else:
        tier = 4
    bonus = 0
    if any(x in n for x in ("final", "edition", "debugged", "deanna")):
        bonus = -1
    return (tier, bonus, name)


def media_available(folder: Path, folder_rel: str, basename: str, manifest_paths: set[str]) -> bool:
    if not basename:
        return False
    logical = f"{folder_rel.rstrip('/')}/{basename}"
    if logical in manifest_paths:
        return True
    stub = ASSETS_DIR / logical
    if stub.with_suffix(stub.suffix + ".ipfs").is_file() or (ASSETS_DIR / f"{logical}.ipfs").is_file():
        return True
    local = folder / basename
    try:
        return local.is_file() and local.stat().st_size > 1_000_000
    except OSError:
        return False


def find_named_rendition(
    folder: Path, folder_rel: str, manifest_paths: set[str], suffix: str
) -> str:
    """Return basename ending with suffix if stub/file present, else ''."""
    suffix_l = suffix.lower()
    # Local files first
    if folder.is_dir():
        for p in sorted(folder.iterdir()):
            if p.name.lower().endswith(suffix_l) and media_available(
                folder, folder_rel, p.name, manifest_paths
            ):
                return p.name
    prefix = folder_rel.rstrip("/") + "/"
    for mp in sorted(manifest_paths):
        if not mp.startswith(prefix):
            continue
        rest = mp[len(prefix) :]
        if "/" in rest:
            continue
        if rest.lower().endswith(suffix_l) and media_available(
            folder, folder_rel, rest, manifest_paths
        ):
            return rest
    return ""


def find_media(folder: Path, folder_rel: str, manifest_paths: set[str]) -> str | None:
    """Return archival master basename (HEVC MP4 preferred; not web/mobile encodes)."""
    candidates: list[str] = []
    if folder.is_dir():
        for p in sorted(folder.iterdir()):
            if p.suffix.lower() in (".mkv", ".mp4", ".webm") and (p.is_file() or p.is_symlink()):
                if is_web_or_skip_media(p.name):
                    continue
                candidates.append(p.name)
    prefix = folder_rel.rstrip("/") + "/"
    for mp in manifest_paths:
        if mp.startswith(prefix):
            rest = mp[len(prefix) :]
            if "/" not in rest and rest.lower().endswith((".mkv", ".mp4", ".webm")):
                if is_web_or_skip_media(rest):
                    continue
                if rest not in candidates:
                    candidates.append(rest)
    if not candidates:
        return None
    candidates.sort(key=_media_rank)
    return candidates[0]


def _subtitle_label(name: str) -> tuple[str, bool]:
    n = name.lower()
    if "enhanced" in n or "citation" in n:
        return "Enhanced / Citations", False
    if "english" in n or "default" in n:
        return "English (default)", True
    return "English", False


def _is_build_artifact_subtitle(name: str) -> bool:
    """Skip Kdenlive export dumps and other non-player sidecars."""
    return "kdenlive" in name.lower()


def _is_named_player_subtitle(name: str) -> bool:
    """Dialogue / citations tracks (not unlabeled duplicates of the same cut)."""
    n = name.lower()
    return (
        "enhanced" in n
        or "citation" in n
        or "english" in n
        or "default" in n
    )


def ensure_vtt_for_srts(folder: Path) -> None:
    """Generate sibling .vtt files for any .srt under folder/subs."""
    subs_dir = folder / "subs"
    if not subs_dir.is_dir():
        return
    helper = ROOT / "scripts" / "srt_to_vtt.py"
    if not helper.is_file():
        return
    import subprocess
    import sys

    subprocess.run([sys.executable, str(helper), str(subs_dir)], cwd=ROOT, check=False)


def find_subtitles(folder: Path, folder_rel: str) -> list[dict]:
    """Prefer WebVTT sidecars for HTML5 <track>; convert SRT → VTT when needed.

    When a project has named player tracks (english / enhanced), expose only those —
    e.g. Mummy Debugged: English (default) + Enhanced / Citations — not kdenlive or
    unlabeled duplicate stems.
    """
    ensure_vtt_for_srts(folder)
    subs_dir = folder / "subs"
    out: list[dict] = []
    if not subs_dir.is_dir():
        return out
    # Prefer .vtt; fall back to listing .srt only if no vtt for that stem
    vtt_files = sorted(subs_dir.glob("*.vtt"))
    seen_stems: set[str] = set()
    for p in vtt_files:
        if _is_build_artifact_subtitle(p.name):
            continue
        label, default = _subtitle_label(p.name)
        entry = {
            "src": f"{folder_rel}/subs/{p.name}",
            "label": label,
            "lang": "en",
        }
        if default:
            entry["default"] = True
        out.append(entry)
        seen_stems.add(p.stem.lower())
    for p in sorted(subs_dir.glob("*.srt")):
        if _is_build_artifact_subtitle(p.name):
            continue
        if p.stem.lower() in seen_stems:
            continue
        # VTT missing (conversion failed) — still list SRT for catalog completeness
        label, default = _subtitle_label(p.name)
        entry = {
            "src": f"{folder_rel}/subs/{p.name}",
            "label": label,
            "lang": "en",
        }
        if default:
            entry["default"] = True
        out.append(entry)
    named = [
        t
        for t in out
        if _is_named_player_subtitle(Path(t["src"]).name)
    ]
    if named:
        out = named
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


# Edit now-showing.json to change the marquee / carousel rotation.
# Entries may be slug strings or objects:
#   { "slug": "…", "streamHttps": "https://….b-cdn.net/now-showing/<slug>/master.mkv",
#     "streamHttpsWeb": "…", "streamHttpsMobile": "…" }
# generate-index-json maps those slugs → status=showing, copies slug list into
# index.json.nowShowing, and stamps streamHttps* onto matching projects.
NOW_SHOWING_FILE = ROOT / "now-showing.json"

STREAM_HTTPS_KEYS = ("streamHttps", "streamHttpsWeb", "streamHttpsMobile")


def load_now_showing() -> tuple[list[str], dict[str, dict]]:
    """Ordered slugs + per-slug Bunny HTTPS fields from now-showing.json."""
    if not NOW_SHOWING_FILE.is_file():
        return [], {}
    try:
        data = json.loads(NOW_SHOWING_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return [], {}
    if not isinstance(data, list):
        return [], {}
    out: list[str] = []
    meta: dict[str, dict] = {}
    seen: set[str] = set()
    for item in data:
        fields: dict = {}
        if isinstance(item, str):
            slug = item.strip()
        elif isinstance(item, dict):
            slug = str(item.get("slug") or "").strip()
            for key in STREAM_HTTPS_KEYS:
                val = item.get(key)
                if isinstance(val, str) and val.strip():
                    fields[key] = val.strip()
        else:
            continue
        if not slug or slug in seen:
            continue
        seen.add(slug)
        out.append(slug)
        if fields:
            meta[slug] = fields
    return out, meta


def load_now_showing_slugs() -> list[str]:
    """Ordered slug list from now-showing.json (single source of truth)."""
    slugs, _meta = load_now_showing()
    return slugs


def publish_status(slug: str, raw: str, now_showing: set[str]) -> str:
    """Map seed readiness to showing | coming_soon | wip | needs-seed."""
    if slug in now_showing and raw in ("ready", "showing"):
        return "showing"
    if raw == "ready":
        return "coming_soon"
    return raw


def main() -> None:
    manifest_paths = load_manifest_paths()
    now_showing, now_showing_meta = load_now_showing()
    now_showing_set = set(now_showing)
    projects = []
    for rel in sorted(git_readmes()):
        path = Path(rel)
        category = path.parts[0]
        folder = ROOT / path.parent
        folder_rel = path.parent.as_posix()
        slug = slugify(path.parent.name)
        title = title_from_readme(ROOT / rel, path.parent.name)
        original_title = original_title_from(title, path.parent.name)
        blurb = blurb_from_readme(ROOT / rel)
        reel_candidates = list(folder.glob("*.reel")) if folder.is_dir() else []
        reel = reel_candidates[0].as_posix() if len(reel_candidates) == 1 else None
        media = find_media(folder, folder_rel, manifest_paths)
        media_web = find_named_rendition(folder, folder_rel, manifest_paths, WEB_SUFFIX)
        media_mobile = find_named_rendition(folder, folder_rel, manifest_paths, MOBILE_SUFFIX)
        poster = find_poster(folder, folder_rel)
        if not poster:
            poster = media_root_poster(slug)
        subs = find_subtitles(folder, folder_rel)
        status = publish_status(slug, status_for(folder, media, ROOT / rel), now_showing_set)
        # CleverScript SSR cannot reliably walk nested object arrays; ship a ready JSON string.
        tracks_for_player = []
        for t in subs:
            src = t.get("src") or ""
            if src and not src.startswith("/"):
                src = "/" + src
            track = {
                "src": src,
                "label": t.get("label") or "Subtitles",
                "lang": t.get("lang") or "en",
            }
            if t.get("default") is True:
                track["default"] = True
            tracks_for_player.append(track)
        entry: dict = {
            "slug": slug,
            "category": category,
            "path": folder_rel,
            "title": title,
            # Always set so CleverScript property access never throws
            "originalTitle": original_title,
            "status": status,
            "media": media if media else "",
            "mediaWeb": media_web,
            "mediaMobile": media_mobile,
            "image": poster if poster else "",
            "subtitles": subs,
            "subtitlesJson": json.dumps(tracks_for_player, separators=(",", ":")),
        }
        # Bunny Now showing HTTPS (optional). Keep mediaWeb/mediaMobile basenames for
        # catalog UI (disabled until streamHttpsWeb/Mobile exist). Live ladder URLs
        # only when those Bunny fields are set.
        bunny = now_showing_meta.get(slug) or {}
        for key in STREAM_HTTPS_KEYS:
            if key in bunny:
                entry[key] = bunny[key]
        if status == "showing" and bunny.get("streamHttps"):
            # Ladder UI only when Bunny streamHttpsWeb/Mobile exist (no tip MP4 phantoms).
            entry["qualityWebEnabled"] = bool(bunny.get("streamHttpsWeb"))
            entry["qualityMobileEnabled"] = bool(bunny.get("streamHttpsMobile"))
        else:
            entry["qualityWebEnabled"] = bool(media_web)
            entry["qualityMobileEnabled"] = bool(media_mobile)
        if blurb:
            entry["blurb"] = blurb
        else:
            entry["blurb"] = ""
        if reel:
            entry["reel"] = reel
        stats = load_stats(folder)
        if stats:
            for key in (
                "filmRuntime",
                "faneditRuntime",
                "timeCut",
                "filmRuntimeSeconds",
                "faneditRuntimeSeconds",
                "timeCutSeconds",
                "availableIn",
                "type",
                "sizeBytes",
                "sizeGB",
                "width",
                "height",
                "videoCodec",
                "poster",
            ):
                if key in stats and stats[key] is not None:
                    entry[key] = stats[key]
        # Always expose poster basename when image is the canonical poster.* path
        if poster and "poster" not in entry:
            entry["poster"] = Path(poster).name
        projects.append(entry)

    # Keep only slugs that still exist in the catalog (typos / retired titles drop out).
    known = {p["slug"] for p in projects}
    now_showing_live = [s for s in now_showing if s in known]
    doc = {"nowShowing": now_showing_live, "projects": projects}
    OUT.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(projects)} projects ({len(now_showing_live)} now showing) to {OUT}")


if __name__ == "__main__":
    main()
