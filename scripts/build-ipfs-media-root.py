#!/usr/bin/env python3
"""Build a UnixFS media-root DAG from assets.manifest.json (path-mirrored sync).

Reuses existing per-file CIDs via `ipfs files cp` (no re-add of multi-GB blobs).
Writes mediaRoot (+ mediaRootBuiltAt) into assets.manifest.json and IPFS_ROOT.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

MANIFEST = "assets.manifest.json"
IPFS_ROOT_FILE = "IPFS_ROOT"
MFS_STAGING = "/flashback-media-build"
CID_RE = re.compile(r"^(bafy|bafk|Qm)[a-zA-Z0-9]+$")


def run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, capture_output=True, text=True)


def require_ok(proc: subprocess.CompletedProcess[str], ctx: str) -> str:
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        sys.exit(f"{ctx}: {err or f'exit {proc.returncode}'}")
    return (proc.stdout or "").strip()


def load_manifest(root: Path) -> dict:
    path = root / MANIFEST
    if not path.is_file():
        sys.exit(f"missing {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def mfs_stat_hash(path: str) -> str:
    proc = run(["ipfs", "files", "stat", "--hash", path])
    cid = require_ok(proc, f"stat {path}")
    if not CID_RE.match(cid):
        sys.exit(f"unexpected media root hash: {cid!r}")
    # Prefer CIDv1 base32 (matches leaf ingest CIDs / site UI).
    fmt = run(["ipfs", "cid", "format", "-v", "1", "-b", "base32", cid])
    if fmt.returncode == 0 and CID_RE.match((fmt.stdout or "").strip()):
        return (fmt.stdout or "").strip()
    return cid


def save_manifest(root: Path, doc: dict) -> None:
    assets = doc.get("assets") or []
    assets.sort(key=lambda a: a.get("path", ""))
    ordered: dict = {
        "schema": doc.get("schema") or "relay.assets-manifest.v1",
    }
    if doc.get("mediaRoot"):
        ordered["mediaRoot"] = doc["mediaRoot"]
    if doc.get("mediaRootBuiltAt"):
        ordered["mediaRootBuiltAt"] = doc["mediaRootBuiltAt"]
    ordered["assets"] = assets
    (root / MANIFEST).write_text(json.dumps(ordered, indent=2) + "\n", encoding="utf-8")


def asset_entries(doc: dict) -> list[tuple[str, str, int | None]]:
    out: list[tuple[str, str, int | None]] = []
    for a in doc.get("assets") or []:
        if not isinstance(a, dict):
            continue
        path = str(a.get("path") or "").lstrip("/")
        cid = str(a.get("ipfs") or "").strip()
        if not path or not cid:
            continue
        if not CID_RE.match(cid):
            sys.exit(f"bad CID for {path}: {cid!r}")
        if ".." in path.split("/"):
            sys.exit(f"unsafe path: {path}")
        expected = a.get("bytes")
        exp_i: int | None
        try:
            exp_i = int(expected) if expected is not None else None
        except (TypeError, ValueError):
            exp_i = None
        out.append((path, cid, exp_i))
    out.sort(key=lambda t: t[0])
    return out


def cid_file_size(cid: str) -> int | None:
    proc = run(["ipfs", "files", "stat", f"/ipfs/{cid}"])
    if proc.returncode != 0:
        return None
    for line in (proc.stdout or "").splitlines():
        if line.startswith("Size:"):
            try:
                return int(line.split()[1])
            except (IndexError, ValueError):
                return None
    return None


def cid_usable(cid: str, expected_bytes: int | None) -> bool:
    """Reject missing CIDs and tiny symlink stubs mistaken for multi-GB videos."""
    size = cid_file_size(cid)
    if size is None:
        return False
    # Bad first-pass ingest pinned symlink inodes (~80–150B) while manifest.bytes is GB.
    if expected_bytes is not None and expected_bytes >= 100_000 and size < 10_000:
        return False
    return True


def mfs_rm(path: str) -> None:
    run(["ipfs", "files", "rm", "-r", "--force", path])


def mfs_mkdir_p(path: str) -> None:
    proc = run(["ipfs", "files", "mkdir", "-p", path])
    if proc.returncode != 0:
        err = (proc.stderr or "").lower()
        if "already exists" not in err and "file already exists" not in err:
            require_ok(proc, f"mkdir {path}")


def mfs_cp(cid: str, dest: str) -> None:
    run(["ipfs", "files", "rm", "--force", dest])
    parent = str(Path(dest).parent).replace("\\", "/")
    if parent and parent != "/":
        mfs_mkdir_p(parent)
    proc = run(["ipfs", "files", "cp", f"/ipfs/{cid}", dest])
    require_ok(proc, f"cp {cid} -> {dest}")


def mfs_stat_hash(path: str) -> str:
    proc = run(["ipfs", "files", "stat", "--hash", path])
    cid = require_ok(proc, f"stat {path}")
    if not CID_RE.match(cid):
        sys.exit(f"unexpected media root hash: {cid!r}")
    return cid


def git_add(root: Path, *rels: str) -> None:
    proc = run(["git", "-C", str(root), "add", "--", *rels])
    if proc.returncode != 0:
        sys.stderr.write((proc.stderr or proc.stdout or "git add failed") + "\n")


def build(
    root: Path,
    *,
    dry_run: bool,
    skip_pin: bool,
    skip_git: bool,
    skip_missing: bool,
) -> str:
    doc = load_manifest(root)
    entries = asset_entries(doc)
    if not entries:
        sys.exit("no assets in manifest")

    available: list[tuple[str, str]] = []
    missing: list[tuple[str, str]] = []
    for path, cid, expected in entries:
        if cid_usable(cid, expected):
            available.append((path, cid))
        else:
            missing.append((path, cid))

    if missing:
        for p, c in missing[:10]:
            sys.stderr.write(f"CID not usable locally: {c} ({p})\n")
        if len(missing) > 10:
            sys.stderr.write(f"... and {len(missing) - 10} more\n")
        if not skip_missing:
            sys.exit(
                f"{len(missing)}/{len(entries)} CIDs missing or tiny symlink stubs; "
                "pin/ingest first (or pass --skip-missing)"
            )
        sys.stderr.write(
            f"warning: building with {len(available)}/{len(entries)} assets "
            f"({len(missing)} skipped)\n"
        )

    if not available:
        sys.exit("no locally usable CIDs to build media root")

    if dry_run:
        print(f"would build media root from {len(available)} assets via MFS {MFS_STAGING}")
        for p, c in available[:5]:
            print(f"  {p} -> {c}")
        if len(available) > 5:
            print(f"  ... +{len(available) - 5} more")
        return ""

    print(f"Building media root ({len(available)} assets)…", flush=True)
    mfs_rm(MFS_STAGING)
    mfs_mkdir_p(MFS_STAGING)

    for i, (path, cid) in enumerate(available, 1):
        dest = f"{MFS_STAGING}/{path}"
        print(f"[{i}/{len(available)}] {path}", flush=True)
        mfs_cp(cid, dest)

    media_root = mfs_stat_hash(MFS_STAGING)
    print(f"mediaRoot={media_root}", flush=True)

    if not skip_pin:
        print("Pinning mediaRoot recursively…", flush=True)
        proc = run(["ipfs", "pin", "add", "--recursive", f"/ipfs/{media_root}"])
        require_ok(proc, "pin mediaRoot")

    built_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    doc["mediaRoot"] = media_root
    doc["mediaRootBuiltAt"] = built_at
    save_manifest(root, doc)
    (root / IPFS_ROOT_FILE).write_text(media_root + "\n", encoding="utf-8")

    if not skip_git:
        git_add(root, MANIFEST, IPFS_ROOT_FILE)

    print(f"Wrote {MANIFEST} mediaRoot + {IPFS_ROOT_FILE}", flush=True)
    return media_root


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="repo root (default: parent of scripts/)",
    )
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-pin", action="store_true", help="do not ipfs pin add mediaRoot")
    ap.add_argument("--skip-git", action="store_true", help="do not git add output files")
    ap.add_argument(
        "--skip-missing",
        action="store_true",
        help="omit assets whose CIDs are not usable locally (partial root)",
    )
    args = ap.parse_args()
    root = args.root.resolve()
    build(
        root,
        dry_run=args.dry_run,
        skip_pin=args.skip_pin,
        skip_git=args.skip_git,
        skip_missing=args.skip_missing,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
