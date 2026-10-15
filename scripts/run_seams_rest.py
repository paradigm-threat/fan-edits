#!/usr/bin/env python3
"""Seams.mkv for remaining FanMixes after Mummy 1/2. Generic name only."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from list_kdenlive_cuts import analyze_folder, pick_kden  # noqa: E402
from render_seams import video_clips  # noqa: E402

HDD = Path("/media/ari/HD/FanEditRender")
VIDEOS = Path("/home/ari/Videos/FanEdits/FanMixes")
NAS = "nobiserv.local:/share/Public/Videos/FanEdits/FanMixes"
GVFS = Path(
    "/run/user/1000/gvfs/smb-share:server=nobiserv.local,share=public/Videos"
)

SKIP = {
    "the big lebowski (1998) - enhanced citations",
    "the pentagon papers (2003) - widescreen",
    "the mummy (1999) - debugged",
    "the mummy returns (2001) - debugged",
}

ONE_CUT = [
    "Fear and Loathing in Las Vegas (1998) - No North Star",
    "Boogie Nights (1997) - No Lookout",
]

# Extra-OST: only append a credits tail when a replacement credits song exists.
CREDITS: dict[str, dict] = {}

# Copy these to HDD before encode — never render a long HEVC from gvfs.
NAS_STAGE = {
    "2012 (2009) - Salvation": GVFS
    / "Horror and SciFi/2012 (2009) [1080p]/2012 (2009) [2160p] [4K] [BluRay] [5.1] [YTS.MX]/2012.2009.2160p.4K.BluRay.x265.10bit.AAC5.1-[YTS.MX].mkv",
    "Alien Resurrection (1997) - UnJossed": GVFS
    / "Horror and SciFi/Alien Movie Collection/Alien Resurrection (1997) [1080p]/www.UIndex.org    -    Alien Resurrection 1997 Theatrical Cut BluRay 1080p DDP 5 1 x264-hallowed/Alien Resurrection 1997 Theatrical Cut BluRay 1080p DDP 5 1 x264-hallowed.mkv",
    "Congo (1995) - Incel": GVFS
    / "General Movies/Congo (1995)/Congo.1995.1080p.BluRay.x264.AAC5.1-[YTS.MX].mp4",
    "Final Fantasy (2001) - The Phantom Menace": GVFS
    / "Horror and SciFi/Final Fantasy/Final.Fantasy.The.Spirits.Within.2001.1080p.BluRay.HEVC.DTS-LiNUX/Final.Fantasy.The.Spirits.Within.2001.1080p.BluRay.HEVC.DTS-LiNUX.mkv",
    "Ninja Scroll (1993) - Minor Damage": GVFS
    / "Anime/Ninja Scroll (1993)/Ninja.Scroll.1993.JAPANESE.REPACK.1080p.BluRay.x264.AAC-[YTS.MX].mp4",
    "Riddick (2013) - Unjinxed": GVFS
    / "Horror and SciFi/Riddick Movies/Riddick (2013) [1080p]/Riddick.2013.1080p.BluRay.x264.YIFY.mp4",
    "Silent Hill (2006) - Nay Tomorrow": GVFS
    / "Horror and SciFi/Silent Hill (2006) [1080p]/Silent.Hill.2006.BluRay.1080p.x264.YIFY.mp4",
    "The Chronicles Of Riddick (2004) - Fry's Edition": GVFS
    / "Horror and SciFi/Riddick Movies/The.Chronicles.Of.Riddick.2004.2160p.4K.BluRay.x265.10bit.AAC5.1-[YTS.MX].mkv",
    "The Day After Tomorrow (2004) - Yuppocolypse": GVFS
    / "Horror and SciFi/The Day After Tomorrow (2004) [2160p] [4K] [WEB] [HDR] [5.1] [YTS.MX]/The.Day.After.Tomorrow.2004.2160p.4K.WEB.x265.10bit.HDR.AAC5.1-[YTS.MX].mkv",
    "War of the Worlds (1953) - No Clip": GVFS
    / "Horror and SciFi/War of the Worlds/The War Of The Worlds (1953) [1080p] [BluRay] [5.1] [YTS.MX]/The.War.Of.The.Worlds.1953.1080p.BluRay.x264.AAC5.1-[YTS.MX].mp4",
    "War of the Worlds (2005) - Family Therapy": GVFS
    / "Horror and SciFi/War of the Worlds/War.Of.The.Worlds.2005.2160p.4K.BluRay.x265.10bit.AAC5.1-[YTS.MX].mkv",
}


def rsync(src: Path | str, dest: str) -> None:
    subprocess.run(["rsync", "-aP", str(src), dest], check=True)


def stage_nas(name: str) -> Path | None:
    src = NAS_STAGE.get(name)
    if src is None or not src.exists():
        return None
    dest = HDD / name / src.name
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size == src.stat().st_size:
        print(f"NAS already staged {dest}", flush=True)
        return dest
    print(f"Staging {src} -> {dest}", flush=True)
    rsync(src, str(dest))
    return dest


def already_done(folder: Path) -> bool:
    out = HDD / folder.name / "seams.mkv"
    return out.exists() and out.stat().st_size > 1_000_000


def render(folder: Path, video: Path | None = None) -> bool:
    name = folder.name
    dest = HDD / name
    dest.mkdir(parents=True, exist_ok=True)
    out = dest / "seams.mkv"
    log = dest / "seams-render.log"
    extra: list[str] = []
    cred = CREDITS.get(name)
    if cred:
        extra += ["--credits-start", cred["start"]]
        if cred.get("melt"):
            extra += ["--melt-mlt", cred["melt"]]
    if video is not None:
        extra += ["--video", str(video)]
    cmd = [
        sys.executable,
        str(ROOT / "scripts" / "render_seams.py"),
        "--project",
        str(folder),
        "--out",
        str(out),
        *extra,
    ]
    print(f"\n######## {name} ########", flush=True)
    with log.open("a", encoding="utf-8") as fh:
        fh.write(f"\n======== SEAMS START {name} ========\n")
        fh.flush()
        proc = subprocess.run(cmd, stdout=fh, stderr=subprocess.STDOUT)
        if proc.returncode != 0:
            print(f"FAIL {name} (see {log})", flush=True)
            return False
    (VIDEOS / name).mkdir(parents=True, exist_ok=True)
    rsync(out, str(VIDEOS / name / "seams.mkv"))
    rsync(out, f"{NAS}/{name}/seams.mkv")
    print(f"Wrote {out} ({out.stat().st_size / 1e6:.1f} MB)", flush=True)
    return True


def resolve_video(folder: Path) -> Path | None:
    staged = stage_nas(folder.name)
    if staged is not None:
        return staged
    kden = pick_kden(folder)
    if not kden:
        print(f"SKIP {folder.name}: no kdenlive")
        return None
    try:
        _clips, video = video_clips(kden)
    except SystemExit as exc:
        print(f"SKIP {folder.name}: {exc}")
        return None
    if video is not None and video.exists():
        return video
    print(f"SKIP {folder.name}: missing rip {video}")
    return None


def main() -> int:
    root = ROOT / "FanMixes"
    mummy1 = root / "The Mummy (1999) - Debugged"
    if mummy1.is_dir() and "--skip-mummy1" not in sys.argv:
        if already_done(mummy1):
            print(f"SKIP already have seams: {mummy1.name}")
        else:
            print("OK Mummy 1 local 4K rip")
            render(mummy1)

    ordered: list[Path] = []
    for name in ONE_CUT:
        p = root / name
        if p.is_dir():
            ordered.append(p)
    for p in sorted(root.iterdir()):
        if not p.is_dir() or p.name.lower() in SKIP:
            continue
        if p.name in ONE_CUT:
            continue
        rec = analyze_folder(p)
        if not rec.get("kdenlive"):
            print(f"SKIP no kdenlive: {p.name}")
            continue
        if not rec.get("holes"):
            print(f"SKIP no picture holes: {p.name}")
            continue
        ordered.append(p)

    failed = 0
    for folder in ordered:
        if already_done(folder) and "--force" not in sys.argv:
            print(f"SKIP already have seams: {folder.name}")
            continue
        video = resolve_video(folder)
        if video is None:
            continue
        print(f"OK {folder.name} src={video}")
        if not render(folder, video):
            failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
