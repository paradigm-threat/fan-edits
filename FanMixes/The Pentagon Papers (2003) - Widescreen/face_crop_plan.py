#!/usr/bin/env python3
"""
Shot-locked face-aware 16:9 crop plan for The Pentagon Papers Widescreen.

Detects scene cuts (ffmpeg), samples faces per shot (MediaPipe FaceDetector),
writes crop-shots.json with per-shot Y offsets for a 16:9 window on 4:3 frames.

Rules (see PLAN.md):
  - 1 face  → crop window centered on face (slight upward bias)
  - 2+ faces → union bbox if it fits in 16:9 height, else center
  - no face / titles → center
"""
from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent
DEFAULT_MODEL = (
    Path.home() / ".venvs" / "fanedit-hf" / "models" / "blaze_face_short_range.tflite"
)


def assert_local_video_path(path: Path) -> None:
    s = str(path)
    lowered = s.lower()
    if (
        "gvfs/smb-share" in lowered
        or "/gvfs/" in lowered
        or s.startswith("//")
        or s.startswith("\\\\")
        or (len(s) >= 3 and s[1:3] == ":\\" and s[0].upper() == "N")
    ):
        raise SystemExit(
            f"Refusing network/NAS video path: {path}\n"
            "Copy the rip to local disk first."
        )


def probe_duration(video: Path) -> float:
    r = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(r.stdout.strip())


def probe_size(video: Path) -> tuple[int, int]:
    r = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0",
            str(video),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    w, h = r.stdout.strip().split(",")
    return int(w), int(h)


def detect_cuts(video: Path, threshold: float, start: float | None, end: float | None) -> list[float]:
    vf_parts: list[str] = []
    if start is not None or end is not None:
        a = start if start is not None else 0.0
        if end is not None:
            vf_parts.append(f"trim=start={a}:end={end},setpts=PTS-STARTPTS")
        else:
            vf_parts.append(f"trim=start={a},setpts=PTS-STARTPTS")
    vf_parts.append(f"select='gt(scene,{threshold})',showinfo")
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-i",
        str(video),
        "-an",
        "-vf",
        ",".join(vf_parts),
        "-f",
        "null",
        "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    offset = start or 0.0
    times: list[float] = []
    for m in re.finditer(r"pts_time:([0-9.]+)", proc.stderr or ""):
        t = float(m.group(1)) + offset
        if not times or t - times[-1] > 0.05:
            times.append(t)
    return times


def cuts_to_scenes(
    cuts: list[float],
    duration: float,
    *,
    start: float | None,
    end: float | None,
    min_len: float,
) -> list[dict]:
    t0 = start if start is not None else 0.0
    t1 = end if end is not None else duration
    bounds = [t0] + [c for c in cuts if t0 < c < t1] + [t1]
    scenes: list[dict] = []
    idx = 1
    for a, b in zip(bounds, bounds[1:]):
        if b - a < min_len:
            continue
        scenes.append(
            {
                "index": idx,
                "start": round(a, 3),
                "end": round(b, 3),
                "mid": round((a + b) / 2.0, 3),
            }
        )
        idx += 1
    return scenes


def grab_frame_bgr(video: Path, t: float) -> np.ndarray | None:
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{t:.3f}",
        "-i",
        str(video),
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-pix_fmt",
        "bgr24",
        "-vcodec",
        "rawvideo",
        "-",
    ]
    # Need width/height — use OpenCV for reliability
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        return None
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, int(t * fps)))
    ok, frame = cap.read()
    cap.release()
    if not ok or frame is None:
        # fallback: ffmpeg pipe needs known size — use temporary via imdecode
        proc = subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-ss",
                f"{t:.3f}",
                "-i",
                str(video),
                "-frames:v",
                "1",
                "-f",
                "image2pipe",
                "-vcodec",
                "mjpeg",
                "-",
            ],
            capture_output=True,
        )
        if proc.returncode != 0 or not proc.stdout:
            return None
        arr = np.frombuffer(proc.stdout, dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return frame


def make_detector(model_path: Path):
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    if not model_path.is_file():
        raise SystemExit(f"Face model missing: {model_path}")
    base = mp_python.BaseOptions(model_asset_path=str(model_path))
    opts = vision.FaceDetectorOptions(
        base_options=base,
        min_detection_confidence=0.45,
    )
    return vision.FaceDetector.create_from_options(opts)


def detect_faces(detector, frame_bgr: np.ndarray) -> list[tuple[float, float, float, float]]:
    """Return list of (cx, cy, w, h) in normalized 0..1 coords."""
    import mediapipe as mp

    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = detector.detect(mp_image)
    out: list[tuple[float, float, float, float]] = []
    h, w = frame_bgr.shape[:2]
    for det in result.detections or []:
        bb = det.bounding_box
        # MediaPipe tasks bounding_box is in pixels
        cx = (bb.origin_x + bb.width / 2.0) / w
        cy = (bb.origin_y + bb.height / 2.0) / h
        nw = bb.width / w
        nh = bb.height / h
        out.append((cx, cy, nw, nh))
    return out


def crop_y_for_faces(
    faces: list[tuple[float, float, float, float]],
    *,
    src_h: int,
    crop_h: int,
    eye_bias: float = 0.12,
) -> tuple[int, str]:
    """
    Compute top Y (pixels) for crop of height crop_h inside src_h.
    Returns (y, reason).
    """
    max_y = max(0, src_h - crop_h)
    center_y = max_y // 2

    if not faces:
        return center_y, "center_noface"

    if len(faces) == 1:
        _cx, cy, _nw, nh = faces[0]
        # Bias crop upward so hairline stays in frame (eyes above geometric center)
        face_cy = cy - eye_bias * nh
        ideal_center = face_cy * src_h
        y = int(round(ideal_center - crop_h / 2.0))
        y = max(0, min(max_y, y))
        return y, "single_face"

    # Multi-face: union vertical extent
    tops = [(cy - nh / 2.0) for (_cx, cy, _nw, nh) in faces]
    bots = [(cy + nh / 2.0) for (_cx, cy, _nw, nh) in faces]
    union_top = min(tops) * src_h
    union_bot = max(bots) * src_h
    union_h = union_bot - union_top
    if union_h <= crop_h * 0.92:
        ideal_center = (union_top + union_bot) / 2.0
        y = int(round(ideal_center - crop_h / 2.0))
        y = max(0, min(max_y, y))
        return y, "union_faces"
    return center_y, "center_crowded"


def sample_times(start: float, end: float, n: int = 5) -> list[float]:
    if end <= start:
        return [start]
    if n <= 1:
        return [(start + end) / 2.0]
    # Skip very first/last 5% of shot (transition frames)
    a = start + (end - start) * 0.08
    b = end - (end - start) * 0.08
    if b <= a:
        return [(start + end) / 2.0]
    return [a + (b - a) * i / (n - 1) for i in range(n)]


def median_or_none(vals: list[float]) -> float | None:
    if not vals:
        return None
    vals = sorted(vals)
    return vals[len(vals) // 2]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--video", required=True, type=Path, help="Local square-pixel or source video")
    ap.add_argument("--out-json", type=Path, default=ROOT / "crop-shots.json")
    ap.add_argument("--qc-dir", type=Path, default=None, help="Write QC stills for risky shots")
    ap.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    ap.add_argument("--threshold", type=float, default=0.32)
    ap.add_argument("--min-scene-sec", type=float, default=0.7)
    ap.add_argument("--start-sec", type=float, default=None)
    ap.add_argument("--end-sec", type=float, default=None)
    ap.add_argument("--aspect", type=float, default=16 / 9, help="Target aspect (width/height)")
    ap.add_argument("--samples-per-shot", type=int, default=5)
    ap.add_argument("--assume-width", type=int, default=None)
    ap.add_argument("--assume-height", type=int, default=None)
    args = ap.parse_args()

    assert_local_video_path(args.video)
    if not args.video.is_file():
        raise SystemExit(f"missing video: {args.video}")

    duration = probe_duration(args.video)
    pw, ph = probe_size(args.video)
    # After SAR restore we expect ~768x576; detection may run on pre-square source.
    src_w = args.assume_width or pw
    src_h = args.assume_height or ph
    crop_h = int(round(src_w / args.aspect))
    if crop_h > src_h:
        raise SystemExit(f"crop height {crop_h} > source height {src_h} (not taller-than-wide?)")
    max_y = src_h - crop_h

    print(
        f"duration={duration:.1f}s probe={pw}x{ph} plan_frame={src_w}x{src_h} "
        f"crop={src_w}x{crop_h} max_y={max_y}",
        flush=True,
    )

    cuts = detect_cuts(args.video, args.threshold, args.start_sec, args.end_sec)
    scenes = cuts_to_scenes(
        cuts,
        duration,
        start=args.start_sec,
        end=args.end_sec,
        min_len=args.min_scene_sec,
    )
    print(f"scenes={len(scenes)} cuts={len(cuts)}", flush=True)

    detector = make_detector(args.model)
    qc_dir = args.qc_dir
    if qc_dir:
        qc_dir.mkdir(parents=True, exist_ok=True)

    shots_out: list[dict] = []
    for i, sc in enumerate(scenes, 1):
        times = sample_times(sc["start"], sc["end"], args.samples_per_shot)
        all_faces: list[tuple[float, float, float, float]] = []
        face_counts: list[int] = []
        mid_frame = None
        for t in times:
            fr = grab_frame_bgr(args.video, t)
            if fr is None:
                continue
            # Scale-normalize: detection uses this frame's pixels; coords are normalized
            faces = detect_faces(detector, fr)
            face_counts.append(len(faces))
            all_faces.extend(faces)
            if mid_frame is None or abs(t - sc["mid"]) < 0.01:
                mid_frame = fr

        # Prefer median face count sample: take faces from the sample with median count
        med_count = int(median_or_none([float(c) for c in face_counts]) or 0)
        if med_count <= 0:
            faces_use: list[tuple[float, float, float, float]] = []
        elif med_count == 1:
            # median cy of single-face detections
            singles = [f for f in all_faces]
            # If mixed, keep only likely singles by clustering — use all and let union/single logic handle
            if len(singles) >= 1:
                cys = [f[1] for f in singles]
                med_cy = median_or_none(cys) or 0.5
                # pick face closest to median cy
                faces_use = [min(singles, key=lambda f: abs(f[1] - med_cy))]
            else:
                faces_use = []
        else:
            # Use faces from the mid sample closest to med_count
            faces_use = []
            for t in times:
                fr = grab_frame_bgr(args.video, t)
                if fr is None:
                    continue
                faces = detect_faces(detector, fr)
                if len(faces) == med_count:
                    faces_use = faces
                    mid_frame = fr
                    break
            if not faces_use and all_faces:
                faces_use = all_faces[:med_count]

        y, reason = crop_y_for_faces(faces_use, src_h=src_h, crop_h=crop_h)
        # Normalize y as fraction of max_y for resolution-independent apply
        y_frac = 0.0 if max_y == 0 else y / max_y

        shot = {
            "index": sc["index"],
            "start": sc["start"],
            "end": sc["end"],
            "mid": sc["mid"],
            "face_count": med_count,
            "crop_y": y,
            "crop_y_frac": round(y_frac, 6),
            "reason": reason,
            "src_w": src_w,
            "src_h": src_h,
            "crop_h": crop_h,
        }
        shots_out.append(shot)

        risky = reason in ("center_crowded", "center_noface") or med_count >= 3
        if qc_dir and mid_frame is not None and (risky or i <= 3 or i % 40 == 0):
            vis = mid_frame.copy()
            # Draw crop window scaled to this frame
            fh, fw = vis.shape[:2]
            scale_y = fh / src_h
            scale_x = fw / src_w
            ch = int(crop_h * scale_y)
            cy0 = int(y * scale_y)
            cv2.rectangle(vis, (0, cy0), (fw - 1, cy0 + ch - 1), (0, 255, 0), 2)
            label = f"#{sc['index']} {reason} faces={med_count} y={y}"
            cv2.putText(vis, label, (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            out_p = qc_dir / f"shot_{sc['index']:04d}_{reason}.jpg"
            cv2.imwrite(str(out_p), vis, [int(cv2.IMWRITE_JPEG_QUALITY), 85])

        if i % 25 == 0 or i == len(scenes):
            print(f"  planned {i}/{len(scenes)}", flush=True)

    payload = {
        "video": str(args.video),
        "duration": duration,
        "aspect": args.aspect,
        "src_w": src_w,
        "src_h": src_h,
        "crop_h": crop_h,
        "max_y": max_y,
        "threshold": args.threshold,
        "shots": shots_out,
    }
    args.out_json.parent.mkdir(parents=True, exist_ok=True)
    args.out_json.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(shots_out)} shots -> {args.out_json}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
