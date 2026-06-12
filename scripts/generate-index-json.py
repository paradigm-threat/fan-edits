#!/usr/bin/env python3
"""Regenerate index.json from git-tracked FanMixes/*/README.md and KidFriendly/*/README.md."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "index.json"


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


def git_readmes() -> list[str]:
    proc = subprocess.run(
        ["git", "ls-files", "FanMixes/*/README.md", "KidFriendly/*/README.md"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return [p for p in proc.stdout.splitlines() if p.strip()]


def main() -> None:
    projects = []
    for rel in sorted(git_readmes()):
        path = Path(rel)
        category = path.parts[0]
        folder = path.parent
        folder_rel = folder.as_posix()
        slug = slugify(folder.name)
        title = title_from_readme(ROOT / rel, folder.name)
        reel_candidates = list(folder.glob("*.reel"))
        reel = reel_candidates[0].as_posix() if len(reel_candidates) == 1 else None
        entry = {
            "slug": slug,
            "category": category,
            "path": folder_rel,
            "title": title,
        }
        if reel:
            entry["reel"] = reel
        projects.append(entry)

    doc = {"projects": projects}
    OUT.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(projects)} projects to {OUT}")


if __name__ == "__main__":
    main()
