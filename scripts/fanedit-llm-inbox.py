#!/usr/bin/env python3
"""Scan fanedit.org for unreplied DMs / alerts and auto-post short LLM replies.

Usage:
  python3 scripts/fanedit-llm-inbox.py           # scan + auto-post
  python3 scripts/fanedit-llm-inbox.py --dry-run # scan only
  python3 scripts/fanedit-llm-inbox.py --scan-only

Cookie jar: /tmp/fe-jar.txt (refreshed from Cursor browser cookies when present).
Results: /tmp/fe-llm-inbox-results.json
"""
from __future__ import annotations

import argparse
import html as htmlmod
import json
import os
import re
import shutil
import sqlite3
import subprocess
import tempfile
import time
import urllib.parse
from pathlib import Path

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
JAR = Path(os.environ.get("FE_JAR", "/tmp/fe-jar.txt"))
RESULTS = Path(os.environ.get("FE_LLM_RESULTS", "/tmp/fe-llm-inbox-results.json"))
TMP = Path("/tmp")
BASE = "https://fanedit.org"

SELF = "paradigmthreat"
SKIP_USERS = {"digmodification"}
BLOCKED_NEW_DM = {"mcp"}

DISCLOSURE = (
    "— Cursor LLM for Ari (he's quit fanedit; I'm handling replies)."
)
FLASHBACK = "https://flashbackrepository.org/"
THROWN = (
    "https://paradigmthreat.net/influence/censorship/thrown-off-the-train.md"
)
COMPANION = (
    "https://paradigmthreat.net/influence/censorship/investigations/"
    "predictive-programming-soft-censorship-wikipedia-fanedit-investigation.md"
)

CURSOR_COOKIE_DB = Path(
    "/home/ari/.config/Cursor/Partitions/cursor-browser/Cookies"
)


def curl(args: list[str], out: Path | str, follow: bool = True) -> str:
    out = Path(out)
    cmd = [
        "curl",
        "-s",
        "-m",
        "120",
        "--http1.1",
        "-A",
        UA,
        "-c",
        str(JAR),
        "-b",
        str(JAR),
    ]
    if follow:
        cmd.append("-L")
    cmd += args + ["-o", str(out), "-w", "%{http_code}"]
    try:
        return subprocess.check_output(cmd, text=True).strip()
    except subprocess.CalledProcessError as e:
        print(f"  curl err {e.returncode}", flush=True)
        return f"err{e.returncode}"


def refresh_cookies() -> None:
    """Merge fanedit cookies from Cursor browser DB into jar, then warm session."""
    if CURSOR_COOKIE_DB.exists():
        tmp = tempfile.mktemp(suffix=".db")
        try:
            shutil.copy2(CURSOR_COOKIE_DB, tmp)
            con = sqlite3.connect(tmp)
            rows = list(
                con.execute(
                    "SELECT host_key,name,value,is_secure FROM cookies "
                    "WHERE host_key LIKE '%fanedit%'"
                )
            )
            con.close()
            existing: dict[str, str] = {}
            if JAR.exists():
                for line in JAR.read_text(errors="replace").splitlines():
                    if not line or line.startswith("#"):
                        continue
                    parts = line.split("\t")
                    if len(parts) >= 7:
                        existing[parts[5]] = line
            for host, name, value, secure in rows:
                if not value:
                    continue
                domain = host if host.startswith(".") else host
                flag = "TRUE" if domain.startswith(".") else "FALSE"
                sec = "TRUE" if secure else "FALSE"
                existing[name] = (
                    f"{domain}\t{flag}\t/\t{sec}\t0\t{name}\t{value}"
                )
            lines = ["# Netscape HTTP Cookie File"] + list(existing.values())
            JAR.write_text("\n".join(lines) + "\n")
            print(f"jar refreshed ({len(rows)} browser cookies)", flush=True)
        finally:
            try:
                os.unlink(tmp)
            except OSError:
                pass
    home_path = TMP / "fe-llm-home.html"
    home = ""
    for i in range(6):
        code = curl([f"{BASE}/forums/"], home_path)
        home = home_path.read_text(encoding="utf-8", errors="replace")
        logged = 'data-logged-in="true"' in home
        print(
            f"home try={i+1} code={code} size={len(home)} logged={logged}",
            flush=True,
        )
        if logged:
            break
        time.sleep(5 + i * 3)
    if 'data-logged-in="true"' not in home:
        raise SystemExit(
            "not logged in — refresh Cursor browser session on fanedit.org"
        )


def looks_like_target_page(url: str, html: str) -> bool:
    """Accept real conversation/thread pages; reject empty or bare forums shell."""
    if len(html) < 2000 or 'data-logged-in="true"' not in html:
        return False
    if "/direct-messages/" in url:
        has_convo = (
            "message--conversationMessage" in html
            or "/add-reply" in html
            or "data-author=" in html
            or "conversation_view" in html
        )
        # Bare home/PWA shell sometimes returned under a DM URL — no messages.
        if not has_convo:
            return False
        return True
    return True


def fetch(url: str, path: Path, tries: int = 6) -> tuple[str, str]:
    code, html = "000", ""
    for i in range(tries):
        code = curl(["-H", "Accept: text/html", url], path)
        try:
            html = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            html = ""
        if looks_like_target_page(url, html):
            return code, html
        print(f"  fetch retry {i+1} code={code} size={len(html)}", flush=True)
        time.sleep(4 + i * 2)
    return code, html


def to_html(text: str) -> str:
    parts = [p.strip() for p in text.split("\n\n") if p.strip()]
    return "".join(
        f"<p>{htmlmod.escape(p).replace(chr(10), '<br />')}</p>" for p in parts
    )


def post_json(url: str, referer: str, fields: dict, out: Path) -> tuple[bool, str]:
    body = urllib.parse.urlencode(fields)
    for attempt in range(5):
        scode = curl(
            [
                "-X",
                "POST",
                "-H",
                "Content-Type: application/x-www-form-urlencoded; charset=UTF-8",
                "-H",
                "X-Requested-With: XMLHttpRequest",
                "-H",
                "Accept: application/json",
                "-H",
                f"Referer: {referer}",
                "--data-binary",
                body,
                url,
            ],
            out,
            follow=False,
        )
        resp = out.read_text(encoding="utf-8", errors="replace") if out.exists() else ""
        print(f"  POST {attempt+1} {scode} len={len(resp)}", flush=True)
        if '"status": "ok"' in resp:
            return True, "ok"
        if '"redirect"' in resp and (
            "direct-messages" in resp or "threads" in resp or "posts" in resp
        ):
            return True, "redirect"
        if "must wait" in resp.lower() or "flood" in resp.lower():
            m = re.search(r"(\d+)\s*seconds?", resp, re.I)
            wait = int(m.group(1)) + 8 if m else 190
            print(f"  flood wait {wait}s", flush=True)
            time.sleep(wait)
            continue
        if not resp:
            time.sleep(12)
            curl([f"{BASE}/forums/"], TMP / "fe-llm-warm.html")
            continue
        print(f"  head: {resp[:280]}", flush=True)
        return False, resp[:350]
    return False, "retries"


def list_dm_paths(html: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for m in re.finditer(r'href="(/forums/direct-messages/[^"]+\.\d+)/"', html):
        path = htmlmod.unescape(m.group(1))
        if path in seen:
            continue
        seen.add(path)
        out.append(path)
    return out


def message_articles(html: str) -> list[dict]:
    """Return messages in order: author, snippet, post_id if any."""
    arts: list[dict] = []
    for m in re.finditer(r"<article\b([^>]*)>(.*?)</article>", html, re.S | re.I):
        attrs = m.group(1)
        body = m.group(2)
        if "message" not in attrs and "message--" not in body[:200]:
            if "message--" not in attrs and "data-author=" not in attrs:
                continue
        author_m = re.search(r'data-author="([^"]+)"', attrs) or re.search(
            r'data-author="([^"]+)"', body[:800]
        )
        if not author_m:
            continue
        author = author_m.group(1)
        pid_m = re.search(r'data-content="post-(\d+)"', attrs + body[:1500])
        chunk = body
        for sel in (
            r'class="bbWrapper"[^>]*>(.*?)</div>',
            r'class="message-body[^"]*"[^>]*>(.*?)</div>',
        ):
            bm = re.search(sel, chunk, re.S | re.I)
            if bm:
                chunk = bm.group(1)
                break
        text = re.sub(r"<[^>]+>", " ", chunk)
        text = htmlmod.unescape(re.sub(r"\s+", " ", text)).strip()
        arts.append(
            {
                "author": author,
                "author_l": author.lower(),
                "snippet": text[:500],
                "post_id": pid_m.group(1) if pid_m else None,
            }
        )
    return arts


def participants(html: str) -> set[str]:
    """Conversation recipients — prefer message authors, not the online list."""
    authors = {a.lower() for a in re.findall(r'data-author="([^"]+)"', html)}
    if authors:
        return authors
    return {
        u.lower()
        for u in re.findall(r"members/([A-Za-z0-9_-]+)\.\d+/", html)
    }


def parse_reply_form(html: str) -> tuple[dict | None, str | None]:
    m = re.search(
        r'<form[^>]+action="([^"]+/add-reply)"[^>]*>(.*?)</form>', html, re.S
    )
    if not m:
        return None, "no form"
    fields: dict[str, str] = {}
    for mm in re.finditer(r"<input\b([^>]*)/?>", m.group(2), re.I):
        attrs = dict(re.findall(r'([a-zA-Z_:-]+)="([^"]*)"', mm.group(1)))
        if attrs.get("name") and attrs.get("type") != "submit":
            fields[attrs["name"]] = htmlmod.unescape(attrs.get("value", ""))
    return {"action": m.group(1), "fields": fields}, None


def draft_reply(last_snippet: str, others: list[str]) -> str:
    """Short LLM-advocate reply. Heuristic from last message; always disclose."""
    s = (last_snippet or "").lower()

    if any(
        k in s
        for k in (
            "first amendment",
            "1st amendment",
            "free speech",
            "government",
        )
    ):
        body = (
            "Fair point: the First Amendment restrains government, not a private board. "
            "The issue is soft erase and a kill-word policy that pulls work without a "
            f"real hearing. Ari's quit that game. {FLASHBACK} · {THROWN}"
        )
    elif any(
        k in s
        for k in (
            "nobody bans",
            "no one bans",
            "don't ban movies",
            "dont ban movies",
            "not banned",
            "definition of",
            "still posting",
            "house rules",
            "someone else's house",
        )
    ):
        body = (
            "Named ban vs soft erase: DigModiFicaTion archived Sonic over "
            "predictive-programming language and said political/conspiracy framing can "
            "be removed. That's the work getting pulled even if the account stays open. "
            f"Ari's not debating house rules further. {FLASHBACK}"
        )
    elif any(
        k in s
        for k in (
            "why",
            "what happened",
            "banned",
            "explain",
            "more info",
            "read more",
            "article",
            "write-up",
            "writeup",
        )
    ):
        body = (
            "Not Ari typing — Cursor LLM covering his fanedit inbox while he's quit.\n\n"
            "Short version: soft erase / kill-word rules, he's not coming back to play "
            f"under them. Cuts live at {FLASHBACK}\n\n"
            f"Fuller position + investigation:\n{THROWN}\n\n"
            f"Companion notes:\n{COMPANION}"
        )
    elif any(
        k in s
        for k in ("miss you", "sorry", "stay", "don't go", "dont go", "come back")
    ):
        body = (
            "Thanks — passing this along. Ari's quit the venue; I'm an LLM handling "
            f"replies so he doesn't have to. Work's at {FLASHBACK}"
        )
    elif any(k in s for k in ("bot", "llm", "ai ", "chatgpt", "cursor", "gpt")):
        body = (
            "Yes — I'm a Cursor LLM posting on Ari's account while he's quit fanedit. "
            f"He's not spending time here. Position/work: {FLASHBACK} · {THROWN}"
        )
    else:
        body = (
            "Ari's quit fanedit. I'm a Cursor LLM handling his inbox.\n\n"
            "He's not coming back under soft-erase / kill-word rules. "
            f"Work: {FLASHBACK}"
        )

    return f"{body.strip()}\n\n{DISCLOSURE}"


def should_skip_dm(slug: str, users: set[str], html: str) -> str | None:
    others = users - {SELF}
    if slug.startswith("checking-in") or (others and others <= SKIP_USERS):
        return "skip_digmodification"
    if others and others <= BLOCKED_NEW_DM:
        return "skip_mcp_blocked"
    if "closed for new replies" in html.lower():
        return "closed"
    return None


def process_dm(path: str, dry_run: bool) -> dict:
    slug = path.rstrip("/").rsplit("/", 1)[-1]
    url = f"{BASE}{path}/"
    print(f"\n=== DM {slug} ===", flush=True)
    code, html = fetch(url, TMP / f"fe-llm-dm-{slug[:50]}.html")
    print(f"fetch {code} size={len(html)}", flush=True)
    if len(html) < 2000 or not looks_like_target_page(url, html):
        return {"kind": "dm", "slug": slug, "status": "empty_or_wrong_page"}

    users = participants(html) - {SELF}
    skip = should_skip_dm(slug, users, html)
    if skip:
        print(f"skip {skip} users={sorted(users)}", flush=True)
        return {"kind": "dm", "slug": slug, "status": skip, "users": sorted(users)}

    arts = message_articles(html)
    if not arts:
        return {
            "kind": "dm",
            "slug": slug,
            "status": "no_messages_parsed",
            "users": sorted(users),
        }

    last = arts[-1]
    if last["author_l"] == SELF:
        return {
            "kind": "dm",
            "slug": slug,
            "status": "already_replied",
            "users": sorted(users),
            "last_author": last["author"],
        }

    text = draft_reply(last["snippet"], sorted(users))
    print(f"last={last['author']}: {last['snippet'][:120]!r}", flush=True)
    print(f"draft:\n{text}\n", flush=True)

    if dry_run:
        return {
            "kind": "dm",
            "slug": slug,
            "status": "dry_run",
            "users": sorted(users),
            "last_author": last["author"],
            "last_snippet": last["snippet"][:240],
            "draft": text,
            "url": url,
        }

    form, err = parse_reply_form(html)
    if err:
        return {
            "kind": "dm",
            "slug": slug,
            "status": "no_form",
            "users": sorted(users),
            "draft": text,
        }

    fields = dict(form["fields"])
    fields["message"] = text
    fields["message_html"] = to_html(text)
    fields["_xfResponseType"] = "json"
    fields["_xfWithData"] = "1"
    ok, detail = post_json(
        f"{BASE}{form['action']}",
        url,
        fields,
        TMP / "fe-llm-reply.json",
    )
    return {
        "kind": "dm",
        "slug": slug,
        "status": "sent" if ok else "send_fail",
        "detail": detail,
        "users": sorted(users),
        "last_author": last["author"],
        "draft": text,
        "url": url,
    }


def alert_thread_links(html: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for m in re.finditer(
        r'href="((?:https://fanedit\.org)?/forums/(?:threads|posts)/[^"]+)"', html
    ):
        href = m.group(1)
        path = href.split("fanedit.org", 1)[-1] if href.startswith("http") else href
        if path in seen:
            continue
        seen.add(path)
        out.append(path)
    return out


def process_public_thread(path: str, dry_run: bool) -> dict:
    url = f"{BASE}{path}" if path.startswith("/") else path
    if not url.startswith("http"):
        url = BASE + path
    slug = path.rstrip("/").rsplit("/", 1)[-1][:60]
    print(f"\n=== PUBLIC {slug} ===", flush=True)
    code, html = fetch(url, TMP / f"fe-llm-pub-{slug}.html")
    print(f"fetch {code} size={len(html)}", flush=True)
    if len(html) < 2000:
        return {"kind": "public", "slug": slug, "status": "empty"}

    arts = message_articles(html)
    ours = [a for a in arts if a["author_l"] == SELF]
    if not ours:
        return {"kind": "public", "slug": slug, "status": "not_ours"}

    last = arts[-1]
    if last["author_l"] == SELF:
        return {
            "kind": "public",
            "slug": slug,
            "status": "already_replied",
            "last_author": last["author"],
        }

    text = draft_reply(last["snippet"], [last["author_l"]])
    print(f"last={last['author']}: {last['snippet'][:120]!r}", flush=True)
    print(f"draft:\n{text}\n", flush=True)

    if dry_run:
        return {
            "kind": "public",
            "slug": slug,
            "status": "dry_run",
            "last_author": last["author"],
            "last_snippet": last["snippet"][:240],
            "draft": text,
            "url": url,
        }

    if "closed for new replies" in html.lower():
        return {"kind": "public", "slug": slug, "status": "closed", "draft": text}

    form, err = parse_reply_form(html)
    if err:
        return {"kind": "public", "slug": slug, "status": "no_form", "draft": text}

    fields = dict(form["fields"])
    fields["message"] = text
    fields["message_html"] = to_html(text)
    fields["_xfResponseType"] = "json"
    fields["_xfWithData"] = "1"
    ok, detail = post_json(
        f"{BASE}{form['action']}",
        url,
        fields,
        TMP / "fe-llm-pub-reply.json",
    )
    return {
        "kind": "public",
        "slug": slug,
        "status": "sent" if ok else "send_fail",
        "detail": detail,
        "last_author": last["author"],
        "draft": text,
        "url": url,
    }


def find_member_recent_url(home_html: str) -> str:
    m = re.search(
        r'href="(/forums/members/paradigmthreat\.\d+/recent-content/)"',
        home_html,
        re.I,
    )
    if m:
        return BASE + m.group(1)
    return f"{BASE}/forums/members/paradigmthreat.69652/recent-content/"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--dry-run",
        "--scan-only",
        action="store_true",
        help="Scan and draft only; do not POST",
    )
    ap.add_argument("--dms-only", action="store_true", help="Skip public alerts")
    ap.add_argument("--public-only", action="store_true", help="Skip DM inbox")
    args = ap.parse_args()
    dry = args.dry_run

    refresh_cookies()
    home = (TMP / "fe-llm-home.html").read_text(encoding="utf-8", errors="replace")
    results: list[dict] = []

    if not args.public_only:
        code, inbox = fetch(
            f"{BASE}/forums/direct-messages/", TMP / "fe-llm-inbox.html"
        )
        print(f"inbox {code} size={len(inbox)}", flush=True)
        paths = list_dm_paths(inbox)
        print(f"dm conversations={len(paths)}", flush=True)
        for path in paths:
            try:
                r = process_dm(path, dry)
            except Exception as e:
                r = {
                    "kind": "dm",
                    "slug": path,
                    "status": "exception",
                    "detail": str(e),
                }
            results.append(r)
            print("RESULT", r.get("status"), r.get("slug"), flush=True)
            if r.get("status") == "sent" and not dry:
                time.sleep(185)
            else:
                time.sleep(3)

    if not args.dms_only:
        pub_paths: list[str] = []
        for label, url in (
            ("alerts", f"{BASE}/forums/account/alerts"),
            ("recent", find_member_recent_url(home)),
        ):
            code, html = fetch(url, TMP / f"fe-llm-{label}.html")
            print(f"{label} {code} size={len(html)}", flush=True)
            links = alert_thread_links(html)
            print(f"  links={len(links)}", flush=True)
            for p in links:
                if "/direct-messages/" in p:
                    continue
                if p not in pub_paths:
                    pub_paths.append(p)

        for path in pub_paths[:20]:
            try:
                r = process_public_thread(path, dry)
            except Exception as e:
                r = {
                    "kind": "public",
                    "slug": path,
                    "status": "exception",
                    "detail": str(e),
                }
            results.append(r)
            print("RESULT", r.get("status"), r.get("slug"), flush=True)
            if r.get("status") == "sent" and not dry:
                time.sleep(185)
            else:
                time.sleep(3)

    RESULTS.write_text(json.dumps(results, indent=2))
    print("\nSUMMARY", flush=True)
    for r in results:
        print(
            f"{r.get('status'):20} {r.get('kind'):6} {r.get('slug')} "
            f"users={r.get('users')} last={r.get('last_author')}",
            flush=True,
        )
    sent = [r for r in results if r.get("status") == "sent"]
    need = [
        r
        for r in results
        if r.get("status") in ("dry_run", "send_fail", "no_form")
    ]
    print(
        f"\nsent={len(sent)} actionable={len(need)} total={len(results)} "
        f"log={RESULTS}",
        flush=True,
    )


if __name__ == "__main__":
    main()
