#!/usr/bin/env python3
"""
Pentagon Papers Widescreen - Python orchestrator (Windows + NVIDIA).

Pipeline: yadif+SAR -> face crop plan -> Real-ESRGAN 2x (chunked) ->
          shot-locked 16:9 crop -> 10-bit HEVC + English SRT.

All heavy I/O under spaceless paths (realesrgan-ncnn breaks on spaces/parens).
Prints frequent progress to stdout (use python -u).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

PROJECT = Path(__file__).resolve().parent
WORK = Path(r"C:\Videos\FanEditRender\ppws\work")
RE_ROOT = Path(r"C:\Videos\FanEditRender\re_frames")
TOOLS = Path(r"C:\Videos\FanEditRender\tools")
OUT_DIR = Path(r"C:\Videos\FanEditRender\The Pentagon Papers (2003) - Widescreen")
DEFAULT_VIDEO = Path(
    r"C:\Videos\FanEditRender\The Pentagon Papers (2003)\The Pentagon Papers (2003).mkv"
)
SRT = PROJECT / "The Pentagon Papers (2003) - Widescreen.english.srt"
FINAL_NAME = "The Pentagon Papers (2003) - Widescreen.mkv"
FACE_MODEL = (
    Path.home() / ".venvs" / "fanedit-hf" / "models" / "blaze_face_short_range.tflite"
)
NAS_FINAL = Path(
    r"N:\Videos\FanEdits\FanMixes\The Pentagon Papers (2003) - Widescreen"
) / FINAL_NAME
STATUS = Path(r"C:\Videos\FanEditRender\ppws\status.txt")


def log(msg: str) -> None:
    safe = str(msg).encode("ascii", "replace").decode("ascii")
    line = "[" + time.strftime("%H:%M:%S") + "] " + safe
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"), flush=True)
    STATUS.parent.mkdir(parents=True, exist_ok=True)
    with STATUS.open("a", encoding="utf-8") as f:
        f.write(line + chr(10))


def run(cmd: list[str], *, check: bool = True, cwd: Path | None = None) -> int:
    log("+ " + " ".join(str(c) for c in cmd[:12]) + (" ..." if len(cmd) > 12 else ""))
    p = subprocess.run([str(c) for c in cmd], cwd=str(cwd) if cwd else None)
    if check and p.returncode != 0:
        raise SystemExit(f"command failed ({p.returncode}): {cmd[0]}")
    return p.returncode


def which(name: str) -> Path:
    for root in (TOOLS, PROJECT / "tools"):
        for cand in (root / f"{name}.exe", root / name):
            if cand.is_file():
                return cand
    found = shutil.which(name)
    if found:
        return Path(found)
    raise SystemExit(f"missing tool: {name}")


def ffprobe_val(ffprobe: Path, media: Path, entries: str, stream: bool = False) -> str:
    cmd = [ffprobe, "-v", "error"]
    if stream:
        cmd += ["-select_streams", "v:0", "-show_entries", f"stream={entries}"]
    else:
        cmd += ["-show_entries", f"format={entries}"]
    cmd += ["-of", "default=noprint_wrappers=1:nokey=1", str(media)]
    r = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return r.stdout.strip().splitlines()[0].strip()


def make_square(
    ffmpeg: Path, video: Path, square: Path, test_seconds: float
) -> None:
    vf = "yadif=mode=1:parity=1:deint=0,scale=iw*sar:ih:flags=lanczos,format=yuv420p"
    cmd = [ffmpeg, "-hide_banner", "-y"]
    if test_seconds > 0:
        cmd += ["-ss", "0", "-t", str(test_seconds)]
    cmd += [
        "-i",
        str(video),
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-crf",
        "12",
        "-preset",
        "veryfast",
        "-c:a",
        "copy",
        "-sn",
        str(square),
    ]
    run(cmd)


def face_plan(python: Path, square: Path, crop_json: Path, qc_dir: Path, w: int, h: int) -> None:
    script = PROJECT / "face_crop_plan.py"
    run(
        [
            python,
            str(script),
            "--video",
            str(square),
            "--out-json",
            str(crop_json),
            "--qc-dir",
            str(qc_dir),
            "--model",
            str(FACE_MODEL),
            "--assume-width",
            str(w),
            "--assume-height",
            str(h),
        ]
    )


def realesrgan_dir(
    realesr: Path,
    model_dir: Path,
    model: str,
    scale: int,
    in_dir: Path,
    out_dir: Path,
    retries: int = 3,
) -> None:
    """Upscale a folder of frames; retry whole folder on failure."""
    out_dir.mkdir(parents=True, exist_ok=True)
    err_log = RE_ROOT / "last_re.err.log"
    out_log = RE_ROOT / "last_re.out.log"
    for attempt in range(1, retries + 1):
        # Clear partial outs
        for p in out_dir.glob("*"):
            p.unlink(missing_ok=True)
        # Display-safe: leave VRAM for the TV/desktop compositor (WDDM shares the 1660).
        # Smaller tiles + fewer proc threads reduce peak VRAM and blanking/TDR.
        jopt = "2:2:2"
        tile = "192"
        cmd = [
            str(realesr),
            "-i",
            str(in_dir),
            "-o",
            str(out_dir),
            "-n",
            model,
            "-s",
            str(scale),
            "-g",
            "0",
            "-j",
            jopt,
            "-t",
            tile,
            "-f",
            "png",
            "-m",
            str(model_dir),
        ]
        log(f"realesrgan attempt {attempt}/{retries} ({len(list(in_dir.glob('*')))} frames) -j {jopt} -t {tile} (display-safe)")
        with out_log.open("w", encoding="utf-8") as fo, err_log.open(
            "w", encoding="utf-8"
        ) as fe:
            p = subprocess.run(cmd, stdout=fo, stderr=fe)
        n_out = len(list(out_dir.glob("*")))
        n_in = len(list(in_dir.glob("*")))
        if p.returncode == 0 and n_out >= n_in:
            log(f"realesrgan ok: {n_out}/{n_in} frames")
            return
        log(f"realesrgan fail exit={p.returncode} out={n_out}/{n_in}")
        if err_log.is_file():
            tail = err_log.read_text(encoding="utf-8", errors="replace").splitlines()[-15:]
            for line in tail:
                log("  | " + line)
        time.sleep(2)
    raise SystemExit("realesrgan failed after retries")


def upscale_chunked(
    ffmpeg: Path,
    ffprobe: Path,
    realesr: Path,
    model_dir: Path,
    model: str,
    scale: int,
    square: Path,
    up_path: Path,
    chunk_seconds: float,
    batch_frames: int,
    resume_chunks: bool = False,
) -> tuple[int, int]:
    dur = float(ffprobe_val(ffprobe, square, "duration"))
    fps_s = ffprobe_val(ffprobe, square, "r_frame_rate", stream=True)
    if "/" in fps_s:
        a, b = fps_s.split("/")
        fps = float(a) / float(b)
    else:
        fps = float(fps_s)

    chunks_dir = WORK / "up_chunks"
    concat_list = WORK / "up_concat.txt"
    if resume_chunks and chunks_dir.is_dir():
        log("resume: keeping existing up_chunks")
        chunks_dir.mkdir(parents=True, exist_ok=True)
    else:
        if chunks_dir.exists():
            shutil.rmtree(chunks_dir, ignore_errors=True)
        chunks_dir.mkdir(parents=True)
        concat_list.write_text("", encoding="utf-8")

    t = 0.0
    idx = 0
    while t < dur - 0.01:
        length = min(chunk_seconds, dur - t)
        chunk_sq = chunks_dir / f"sq_{idx:04d}.mkv"
        chunk_up = chunks_dir / f"up_{idx:04d}.mkv"
        if resume_chunks and chunk_up.is_file() and chunk_up.stat().st_size > 100000:
            log(f"=== chunk {idx}: SKIP done ({chunk_up.name}) ===")
            # ensure concat list has this file
            lines = concat_list.read_text(encoding="utf-8") if concat_list.is_file() else ""
            marker = chunk_up.resolve().as_posix()
            if marker not in lines:
                with concat_list.open("a", encoding="utf-8") as f:
                    f.write(f"file '{marker}'\n")
            t += length
            idx += 1
            continue
        log(f"=== chunk {idx}: t={t:.1f}s len={length:.1f}s / total {dur:.1f}s ===")
        in_dir = RE_ROOT / "in"
        out_dir = RE_ROOT / "out"
        for d in (in_dir, out_dir):
            if d.exists():
                shutil.rmtree(d, ignore_errors=True)
            d.mkdir(parents=True)

        run(
            [
                ffmpeg,
                "-hide_banner",
                "-y",
                "-ss",
                f"{t:.3f}",
                "-t",
                f"{length:.3f}",
                "-i",
                str(square),
                "-c",
                "copy",
                str(chunk_sq),
            ]
        )
        run(
            [
                ffmpeg,
                "-hide_banner",
                "-y",
                "-i",
                str(chunk_sq),
                "-q:v",
                "2",
                str(in_dir / "%08d.jpg"),
            ]
        )
        frames = sorted(in_dir.glob("*.jpg"))
        log(f"extracted {len(frames)} frames @ ~{fps:.2f} fps")

        # Batch frames so a crash loses less work
        batch_root = RE_ROOT / "batch_in"
        batch_out = RE_ROOT / "batch_out"
        final_out = RE_ROOT / "out_all"
        if final_out.exists():
            shutil.rmtree(final_out, ignore_errors=True)
        final_out.mkdir(parents=True)

        for bi in range(0, len(frames), batch_frames):
            batch = frames[bi : bi + batch_frames]
            log(f"  batch frames {bi + 1}-{bi + len(batch)} / {len(frames)}")
            for d in (batch_root, batch_out):
                if d.exists():
                    shutil.rmtree(d, ignore_errors=True)
                d.mkdir(parents=True)
            for j, src in enumerate(batch, 1):
                shutil.copy2(src, batch_root / f"{j:08d}.jpg")
            realesrgan_dir(realesr, model_dir, model, scale, batch_root, batch_out)
            time.sleep(0.75)  # let WDDM/display catch up
            outs = sorted(batch_out.glob("*"))
            if len(outs) < len(batch):
                raise SystemExit(f"batch incomplete {len(outs)}/{len(batch)}")
            for j, src in enumerate(outs):
                global_i = bi + j + 1
                dest = final_out / f"{global_i:08d}{src.suffix}"
                shutil.move(str(src), str(dest))

        first = next(final_out.glob("*"))
        ext = first.suffix
        run(
            [
                ffmpeg,
                "-hide_banner",
                "-y",
                "-framerate",
                fps_s,
                "-i",
                str(final_out / f"%08d{ext}"),
                "-i",
                str(chunk_sq),
                "-map",
                "0:v:0",
                "-map",
                "1:a",
                "-c:v",
                "libx264",
                "-crf",
                "12",
                "-preset",
                "veryfast",
                "-c:a",
                "copy",
                str(chunk_up),
            ]
        )
        with concat_list.open("a", encoding="utf-8") as f:
            # forward slashes, escaped for concat demuxer
            p = chunk_up.resolve().as_posix().replace("'", r"'\''")
            f.write(f"file '{p}'\n")

        shutil.rmtree(in_dir, ignore_errors=True)
        shutil.rmtree(out_dir, ignore_errors=True)
        shutil.rmtree(final_out, ignore_errors=True)
        chunk_sq.unlink(missing_ok=True)
        t += length
        idx += 1
        log(f"chunk {idx - 1} done; progress ~{min(100.0, 100.0 * t / dur):.1f}%")

    run(
        [
            ffmpeg,
            "-hide_banner",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
            "-c",
            "copy",
            str(up_path),
        ]
    )
    w = int(ffprobe_val(ffprobe, up_path, "width", stream=True))
    h = int(ffprobe_val(ffprobe, up_path, "height", stream=True))
    return w, h


def crop_and_mux(
    ffmpeg: Path,
    python: Path,
    up_path: Path,
    crop_json: Path,
    up_w: int,
    up_h: int,
    cropped: Path,
    final: Path,
) -> None:
    filter_script = WORK / "crop_filter.txt"
    run(
        [
            python,
            str(PROJECT / "build_crop_filter.py"),
            "--crop-json",
            str(crop_json),
            "--out-script",
            str(filter_script),
            "--up-w",
            str(up_w),
            "--up-h",
            str(up_h),
            "--out-w",
            "1920",
            "--out-h",
            "1080",
        ]
    )
    rc = run(
        [
            ffmpeg,
            "-hide_banner",
            "-y",
            "-i",
            str(up_path),
            "-filter_script:v",
            str(filter_script),
            "-map",
            "0:v:0",
            "-map",
            "0:a",
            "-c:v",
            "libx265",
            "-preset",
            "medium",
            "-crf",
            "16",
            "-pix_fmt",
            "yuv420p10le",
            "-c:a",
            "copy",
            "-sn",
            str(cropped),
        ],
        check=False,
    )
    if rc != 0:
        log("face crop filter failed - center crop fallback")
        run(
            [
                ffmpeg,
                "-hide_banner",
                "-y",
                "-i",
                str(up_path),
                "-vf",
                "crop=iw:iw*9/16,scale=1920:1080:flags=lanczos,format=yuv420p10le",
                "-c:v",
                "libx265",
                "-preset",
                "medium",
                "-crf",
                "16",
                "-pix_fmt",
                "yuv420p10le",
                "-c:a",
                "copy",
                "-sn",
                str(cropped),
            ]
        )

    mux = [
        ffmpeg,
        "-hide_banner",
        "-y",
        "-i",
        str(cropped),
        "-map",
        "0:v:0",
        "-map",
        "0:a",
        "-c",
        "copy",
        "-metadata",
        "title=The Pentagon Papers (Widescreen)",
        str(final),
    ]
    if SRT.is_file():
        mux = [
            ffmpeg,
            "-hide_banner",
            "-y",
            "-i",
            str(cropped),
            "-i",
            str(SRT),
            "-map",
            "0:v:0",
            "-map",
            "0:a",
            "-map",
            "1:0",
            "-c",
            "copy",
            "-c:s",
            "srt",
            "-metadata",
            "title=The Pentagon Papers (Widescreen)",
            "-metadata:s:s:0",
            "language=eng",
            "-metadata:s:s:0",
            "title=English",
            "-disposition:s:0",
            "default",
            str(final),
        ]
    run(mux)


def main() -> int:
    import os
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    os.environ.setdefault("PYTHONUTF8", "1")
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--video", type=Path, default=DEFAULT_VIDEO)
    ap.add_argument("--test-seconds", type=float, default=0)
    ap.add_argument("--chunk-seconds", type=float, default=12)
    ap.add_argument("--batch-frames", type=int, default=40)
    ap.add_argument("--scale", type=int, default=2, choices=(2, 4))
    ap.add_argument("--model", default="realesrgan-x4plus")
    ap.add_argument("--skip-square", action="store_true")
    ap.add_argument("--skip-face-plan", action="store_true")
    ap.add_argument("--resume-chunks", action="store_true", help="keep finished up_XXXX.mkv chunks")
    ap.add_argument("--skip-upscale", action="store_true")
    ap.add_argument("--sync-nas", action="store_true")
    args = ap.parse_args()

    if STATUS.is_file() and not (getattr(args, "skip_square", False) or getattr(args, "resume_chunks", False)):
        STATUS.write_text("", encoding="utf-8")
    log("=== Pentagon Papers Widescreen (Python) ===")
    log(f"video={args.video}")
    if not args.video.is_file():
        raise SystemExit(f"missing video: {args.video}")

    ffmpeg = which("ffmpeg")
    ffprobe = which("ffprobe")
    realesr = TOOLS / "realesrgan-ncnn-vulkan.exe"
    if not realesr.is_file():
        raise SystemExit(f"missing {realesr}")
    model_dir = TOOLS / "models"
    python = Path(sys.executable)

    WORK.mkdir(parents=True, exist_ok=True)
    RE_ROOT.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    square = WORK / "square.mkv"
    up_path = WORK / "upscaled.mkv"
    cropped = WORK / "cropped.mkv"
    crop_json = WORK / "crop-shots.json"
    qc_dir = WORK / "qc_faces"
    final = OUT_DIR / FINAL_NAME

    dur = float(ffprobe_val(ffprobe, args.video, "duration"))
    log(f"source duration={dur:.2f}s")

    if args.skip_square and square.is_file():
        log("step 1/5: skip square (reuse " + str(square) + ")")
    else:
        log("step 1/5: deinterlace + square pixels")
        make_square(ffmpeg, args.video, square, args.test_seconds)
    sq_w = int(ffprobe_val(ffprobe, square, "width", stream=True))
    sq_h = int(ffprobe_val(ffprobe, square, "height", stream=True))
    log(f"square={sq_w}x{sq_h}")

    if not args.skip_face_plan:
        log("step 2/5: face crop plan")
        face_plan(python, square, crop_json, qc_dir, sq_w, sq_h)
    elif not crop_json.is_file():
        raise SystemExit(f"missing {crop_json}")

    if not args.skip_upscale:
        log("step 3/5: Real-ESRGAN upscale")
        up_w, up_h = upscale_chunked(
            ffmpeg,
            ffprobe,
            realesr,
            model_dir,
            args.model,
            args.scale,
            square,
            up_path,
            args.chunk_seconds,
            args.batch_frames,
            resume_chunks=args.resume_chunks,
        )
    else:
        up_w = int(ffprobe_val(ffprobe, up_path, "width", stream=True))
        up_h = int(ffprobe_val(ffprobe, up_path, "height", stream=True))
    log(f"upscaled={up_w}x{up_h}")

    log("step 4/5: 16:9 crop + HEVC")
    crop_and_mux(ffmpeg, python, up_path, crop_json, up_w, up_h, cropped, final)

    log(f"step 5/5: wrote {final} ({final.stat().st_size / 1e9:.2f} GB)")
    run([ffprobe, "-hide_banner", str(final)], check=False)

    if args.sync_nas and NAS_FINAL.parent.is_dir():
        log(f"sync -> {NAS_FINAL}")
        shutil.copy2(final, NAS_FINAL)
        nas_crop = NAS_FINAL.parent / "crop-shots.json"
        if crop_json.is_file():
            shutil.copy2(crop_json, nas_crop)
        log("NAS sync done")

    log("DONE")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        log("interrupted")
        raise SystemExit(130)
