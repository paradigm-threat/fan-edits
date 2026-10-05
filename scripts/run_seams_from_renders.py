#!/usr/bin/env python3
"""Rebuild every FanMix seams reel from the finished NAS render.

Writes seams/seam-NN.kdenlive against that MKV (output times) and
seams/seams.json with the original source span of each cut. Then encodes
seams.mkv, muxes a cuts subtitle, and copies the reel to Videos and the NAS.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from list_kdenlive_cuts import analyze_folder, pick_kden  # noqa: E402
from render_seams import FADE, parse_tc_arg, s_to_tc, video_clips, windows_from_clips  # noqa: E402

HDD = Path("/media/ari/HD/FanEditRender")
VIDEOS = Path("/home/ari/Videos/FanEdits/FanMixes")
NAS_HOST = "nobiserv.local"
NAS = "/share/Public/Videos/FanEdits/FanMixes"
SKIP = {
    "the pentagon papers (2003) - widescreen",
    "the big lebowski (1998) - enhanced citations",
}
CREDITS = {
    "The Mummy Returns (2001) - Debugged": "01:53:00",
}


def sh(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True, stderr=subprocess.STDOUT)


def nas_listing() -> dict[str, list[str]]:
    raw = sh(
        [
            "ssh", "-o", "BatchMode=yes", NAS_HOST,
            'for d in /share/Public/Videos/FanEdits/FanMixes/*/; do '
            'echo "DIR $(basename "$d")"; ls -1t "$d"; done',
        ]
    )
    out: dict[str, list[str]] = {}
    cur = ""
    for line in raw.splitlines():
        if line.startswith("DIR "):
            cur = line[4:].strip()
            out[cur] = []
        elif cur and line.strip():
            out[cur].append(line.strip())
    return out


def feature_candidates(names: list[str]) -> list[str]:
    out: list[str] = []
    for name in names:
        low = name.lower()
        if not low.endswith((".mkv", ".mp4")):
            continue
        if low == "seams.mkv" or low.startswith("seam-"):
            continue
        if any(x in low for x in ("trailer", "preview", "wipe-seam")):
            continue
        out.append(name)
    return out


def pick_project_kden(folder: Path) -> Path | None:
    kden = pick_kden(folder)
    if kden and "v2" not in kden.name.lower():
        return kden
    cands = [
        p for p in folder.glob("*.kdenlive")
        if "v2" not in p.name.lower() and "seam" not in p.name.lower() and "backup" not in p.name.lower()
    ]
    return cands[0] if cands else kden


def stage(name: str, filename: str) -> Path:
    dest = HDD / name / filename
    dest.parent.mkdir(parents=True, exist_ok=True)
    remote = f"{NAS_HOST}:{NAS}/{name}/{filename}"
    print(f"stage {remote}", flush=True)
    subprocess.run(["rsync", "-a", remote, str(dest)], check=True)
    return dest


def write_srt(path: Path, clips: list[dict], credits: float | None) -> None:
    seams, windows = windows_from_clips(clips, credits)
    durs = [hi - lo for lo, hi in windows]
    if credits is not None and clips[-1]["out_out"] > credits + 1:
        durs.append(clips[-1]["out_out"] - credits)
    blocks: list[str] = []
    acc = 0.0
    n = 0
    for i, (lo, hi) in enumerate(windows):
        piece_start = acc
        piece_end = acc + durs[i]
        inside = [sm for sm in seams if lo - 0.05 <= sm["out_join"] <= hi + 0.05]
        if not inside:
            inside = [{"out_join": (lo + hi) / 2, "gap": 0, "left": {"src_out": lo}, "right": {"src_in": hi}}]
        for j, sm in enumerate(inside):
            n += 1
            if len(inside) == 1:
                a, b = piece_start + 0.2, piece_end - 0.3
            else:
                a = piece_start + 0.2 if j == 0 else (inside[j - 1]["out_join"] + sm["out_join"]) / 2 - lo + piece_start
                b = piece_end - 0.3 if j == len(inside) - 1 else (sm["out_join"] + inside[j + 1]["out_join"]) / 2 - lo + piece_start
            src_a = s_to_tc(sm["left"]["src_out"]).replace(".", ",")
            src_b = s_to_tc(sm["right"]["src_in"]).replace(".", ",")
            text = f"Cut {n} of {len(seams)}\nRemoved {sm['gap']:.0f}s\nSource {src_a} – {src_b}"
            def tc(t: float) -> str:
                ms = int(round(max(0.0, t) * 1000))
                h, rem = divmod(ms, 3_600_000)
                m, rem = divmod(rem, 60_000)
                s, msec = divmod(rem, 1000)
                return f"{h:02d}:{m:02d}:{s:02d},{msec:03d}"
            if b > a + 0.4:
                blocks.append(f"{n}\n{tc(a)} --> {tc(b)}\n{text}\n")
        acc = piece_end - (FADE if i < len(durs) - 1 else 0)
    if credits is not None and len(durs) > len(windows):
        n += 1
        a = acc + 0.2
        b = min(acc + 12.0, acc + durs[-1] - 0.3)
        def tc(t: float) -> str:
            ms = int(round(max(0.0, t) * 1000))
            h, rem = divmod(ms, 3_600_000)
            m, rem = divmod(rem, 60_000)
            s, msec = divmod(rem, 1000)
            return f"{h:02d}:{m:02d}:{s:02d},{msec:03d}"
        blocks.append(f"{len(blocks)+1}\n{tc(a)} --> {tc(b)}\nCredits tail\nFrom {s_to_tc(credits)} of the finished edit\n")
    path.write_text("\n".join(blocks) + "\n", encoding="utf-8")


def remux(video: Path, srt: Path) -> None:
    subprocess.run(
        [
            sys.executable, str(ROOT / "scripts" / "remux_subtitles.py"),
            "--video", str(video), "--subs", str(srt), "--out", str(video),
            "--title", "English (cuts)",
        ],
        check=True,
    )


def sync(name: str, mkv: Path, srt: Path, seams_dir: Path) -> None:
    (VIDEOS / name).mkdir(parents=True, exist_ok=True)
    subprocess.run(["rsync", "-a", str(mkv), str(VIDEOS / name / "seams.mkv")], check=True)
    subprocess.run(["rsync", "-a", str(srt), str(VIDEOS / name / "seams.srt")], check=True)
    subprocess.run(["rsync", "-a", "--exclude", "*.mkv", str(seams_dir) + "/", str(VIDEOS / name / "seams") + "/"], check=True)
    subprocess.run(["rsync", "-a", str(mkv), f"{NAS_HOST}:{NAS}/{name}/seams.mkv"], check=True)
    subprocess.run(["rsync", "-a", str(srt), f"{NAS_HOST}:{NAS}/{name}/seams.srt"], check=True)
    subprocess.run(["ssh", "-o", "BatchMode=yes", NAS_HOST, f"mkdir -p '{NAS}/{name}/seams'"], check=True)
    subprocess.run(
        ["rsync", "-a", "--exclude", "*.mkv", str(seams_dir) + "/", f"{NAS_HOST}:{NAS}/{name}/seams/"],
        check=True,
    )


def main() -> int:
    listing = nas_listing()
    root = ROOT / "FanMixes"
    failed: list[str] = []
    done: list[str] = []
    for folder in sorted(p for p in root.iterdir() if p.is_dir()):
        if folder.name.lower() in SKIP:
            print(f"SKIP {folder.name}", flush=True)
            continue
        rec = analyze_folder(folder)
        if not rec.get("kdenlive") or not rec.get("holes"):
            print(f"SKIP no cuts {folder.name}", flush=True)
            continue
        candidates = feature_candidates(listing.get(folder.name, []))
        if not candidates:
            print(f"SKIP no finished render on NAS: {folder.name}", flush=True)
            failed.append(folder.name + " (no render)")
            continue
        print(f"\n######## {folder.name} ########", flush=True)
        try:
            video = None
            for feature in candidates:
                staged = stage(folder.name, feature)
                probe = subprocess.run(
                    ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                     "-of", "default=noprint_wrappers=1:nokey=1", str(staged)],
                    capture_output=True, text=True,
                )
                err = (probe.stderr or "") + (probe.stdout or "")
                raw = (probe.stdout or "").strip()
                if "ended prematurely" in err.lower() or not raw or raw == "N/A":
                    print(f"skip unreadable {feature}", flush=True)
                    continue
                video = staged
                print(f"using {feature} duration={raw}", flush=True)
                break
            if video is None:
                raise SystemExit("no readable finished render")
            kden = pick_project_kden(folder)
            subprocess.run(
                [
                    sys.executable, str(ROOT / "scripts" / "make_seams_kdenlive.py"),
                    "--project", str(folder), "--from-render", "--video", str(video),
                    *(["--kdenlive", str(kden)] if kden else []),
                ],
                check=True,
            )
            out = HDD / folder.name / "seams.mkv"
            work = HDD / folder.name / "seams-work-final"
            cmd = [
                sys.executable, str(ROOT / "scripts" / "render_seams.py"),
                "--project", str(folder), "--from-render", "--video", str(video),
                "--work", str(work), "--out", str(out),
                *(["--kdenlive", str(kden)] if kden else []),
            ]
            credits = CREDITS.get(folder.name)
            if credits:
                cmd += ["--credits-start", credits]
            subprocess.run(cmd, check=True)
            clips, _ = video_clips(kden)
            srt = folder / "seams" / "seams.srt"
            write_srt(srt, clips, parse_tc_arg(credits) if credits else None)
            srt_hdd = HDD / folder.name / "seams.srt"
            srt_hdd.write_text(srt.read_text(encoding="utf-8"), encoding="utf-8")
            remux(out, srt_hdd)
            sync(folder.name, out, srt_hdd, folder / "seams")
            done.append(folder.name)
            print(f"DONE {folder.name}", flush=True)
        except (subprocess.CalledProcessError, SystemExit) as exc:
            print(f"FAIL {folder.name}: {exc}", flush=True)
            failed.append(folder.name)
    print("\n==== finished ====", flush=True)
    for name in done:
        print(f"  ok {name}", flush=True)
    for name in failed:
        print(f"  fail {name}", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
