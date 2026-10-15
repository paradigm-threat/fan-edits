#!/usr/bin/env python3
"""Find videos without sidecar English SRT and download best-matched subs."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

from babelfish import Language
from subliminal import scan_video, refine
from subliminal.core import ProviderPool
from subliminal.score import compute_score
from subliminal.video import Episode, Movie


def has_sidecar_srt(video: Path) -> bool:
    base = video.with_suffix("")
    for ext in (".srt", ".en.srt", ".eng.srt"):
        if Path(str(base) + ext).exists():
            return True
    return False


def has_embedded_english(video: Path) -> bool:
    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "s",
                "-show_entries",
                "stream=index:stream_tags=language",
                "-of",
                "json",
                str(video),
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=60,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return False
    import json

    data = json.loads(proc.stdout or "{}")
    for stream in data.get("streams", []):
        lang = (stream.get("tags") or {}).get("language", "").lower()
        if lang in ("eng", "en", "english"):
            return True
    return False


def is_tv_episode(path: Path) -> bool:
    name = path.name
    if re.search(r"[Ss]\d{1,2}[Ee]\d{1,2}", name):
        return True
    parent = path.parent.name.lower()
    if "bluey" in parent or "today's special" in parent or "todays-special" in parent:
        return True
    return False


def is_skipped(path: Path) -> bool:
    parent = path.parent.name.lower()
    if "mrsrachel" in parent:
        return True
    if parent == "cover" or "\\cover\\" in str(path).lower():
        return True
    return False


def scan_for_subtitles(video: Path):
    """Return a Movie/Episode guess suitable for subliminal providers."""
    candidates = [
        video.parent.name,
        f"{video.parent.name} {video.stem}",
        video.name,
    ]
    seen: set[str] = set()
    for name in candidates:
        if name in seen:
            continue
        seen.add(name)
        v = scan_video(str(video), name=name)
        if isinstance(v, (Movie, Episode)):
            refine(v)
            return v
    return None


def first_cue_start(content: bytes) -> float | None:
    m = re.search(rb"(\d\d):(\d\d):(\d\d),(\d{3})", content)
    if not m:
        return None
    h, mn, s, ms = (int(x) for x in m.groups())
    return h * 3600 + mn * 60 + s + ms / 1000.0


def release_preference_score(sub, video: Path) -> int:
    """Boost subs whose release name matches the rip family."""
    name = video.name.lower()
    rel = (getattr(sub, "movie_release_name", None) or "").lower()
    bonus = 0
    patterns = []
    if "yts" in name or "yify" in name:
        patterns.extend(["yify", "yts", "pfa", "rarbg"])
    if "galaxy" in name:
        patterns.append("galaxy")
    if "webrip" in name or "web-dl" in name:
        patterns.extend(["webrip", "web-dl", "webdl"])
    if "bluray" in name or "brrip" in name:
        patterns.extend(["bluray", "bdrip", "brrip"])
    for p in patterns:
        if p in rel:
            bonus += 15
    if pfa := re.search(r"\.(yts|yify|pfa|galaxy)", name):
        if pfa.group(1) in rel:
            bonus += 25
    # Penalize watermarked / generic wrong sync
    if sub.content and b"do not re-post" in sub.content[:500].lower():
        bonus -= 200
    t0 = first_cue_start(sub.content) if sub.content else None
    if t0 is not None and t0 < 5 and b"subtitle" in sub.content[:400].lower():
        bonus -= 100
    return bonus


def pick_best_subtitle(subs, video: Path):
    scored = []
    for s in subs:
        base = compute_score(s, video)
        scored.append((base + release_preference_score(s, video), base, s))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored


def process_video(video: Path, dry_run: bool) -> str:
    if is_skipped(video):
        return "skip_excluded"
    if has_sidecar_srt(video):
        return "skip_has_sidecar"
    if has_embedded_english(video):
        return "skip_embedded_en"

    v = scan_for_subtitles(video)
    if v is None:
        return "skip_unidentified"
    langs = {Language.fromietf("en")}

    with ProviderPool() as pool:
        subs = pool.list_subtitles(v, langs)
        if not subs:
            return "no_candidates"
        ranked = pick_best_subtitle(subs, v)
        best_total, best_base, chosen = ranked[0]
        if best_total < 50:
            return f"low_score_{best_total}"

        if dry_run:
            rel = getattr(chosen, "movie_release_name", "") or ""
            return f"would_download score={best_total} rel={rel[:60]}"

        if not pool.download_subtitle(chosen):
            return "download_failed"

        out = video.with_suffix(".srt")
        text = chosen.content.decode(chosen.encoding or "utf-8", errors="replace")
        # Strip simple HTML font tags from opensubtitles
        text = re.sub(r"</?font[^>]*>", "", text, flags=re.I)
        out.write_text(text, encoding="utf-8")
        rel = getattr(chosen, "movie_release_name", "") or ""
        return f"ok score={best_total} rel={rel[:50]}"


def collect_videos(root: Path, movies_only: bool) -> list[Path]:
    exts = {".mp4", ".mkv", ".avi", ".m4v"}
    out = []
    for p in sorted(root.rglob("*")):
        if not p.is_file() or p.suffix.lower() not in exts:
            continue
        if is_skipped(p):
            continue
        if movies_only and is_tv_episode(p):
            continue
        out.append(p)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("root", type=Path, help="Root folder to scan")
    ap.add_argument("--movies-only", action="store_true", help="Skip TV episode files")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    root = args.root.resolve()
    videos = collect_videos(root, args.movies_only)
    missing = [v for v in videos if not has_sidecar_srt(v)]
    if args.limit:
        missing = missing[: args.limit]

    print(f"root={root}", file=sys.stderr)
    print(f"videos={len(videos)} missing_sidecar={len(missing)}", file=sys.stderr)

    stats: dict[str, int] = {}
    for i, video in enumerate(missing, 1):
        try:
            result = process_video(video, args.dry_run)
        except Exception as e:
            result = f"error:{e}"
        stats[result.split()[0]] = stats.get(result.split()[0], 0) + 1
        line = f"[{i}/{len(missing)}] {result}\t{video.parent.name} / {video.name}"
        print(line.encode("utf-8", errors="replace").decode("utf-8"))
        sys.stdout.flush()

    print("\n--- summary ---", file=sys.stderr)
    for k, v in sorted(stats.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
