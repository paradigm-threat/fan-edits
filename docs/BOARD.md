# Public board (bugs, comments, reviews)

Flashback’s public notes live in **git**, on branch **`comments`**, not in analytics.

## What visitors do

1. Open **[/board](/board)** (nav / footer), or **Report a problem** from the theater (pre-fills path + kind=bug).
2. Fill kind (`bug` | `comment` | `review`), page **path**, optional name, and message.
3. Submit creates a markdown file via same-origin **`PUT`** with **`X-Relay-Branch: comments`**.

Files land at:

`.relay/comments/by-path/<encoded-page-path>/<UTC>-<kind>.md`

Path encoding matches Relay catalog (`encode_comment_target_path` — non-alphanumeric percent-encoded). HTTP PUT/GET double-encodes each path segment so Axum + gateway `url_decode` still leave `%2F` (etc.) in the git path. Paths never collide with `main` site content under `content/`, `FanMixes/`, etc.

## What this is not

- **Not RUM / telemetry.** Error *counts* still go to `POST /api/rum` for Fleet (see [TELEMETRY.md](TELEMETRY.md)). Readable tickets are board posts.
- **Not product analytics** (no clicks/scrolls).
- **Not the code-change branch.** Unsigned *code* drafts belong on **`dev`** (catalog `branch_features.dev`); merge/`dev`→`main` UI is later.

## Operators

- **Site:** `/board` lists recent posts from the `comments` tip.
- **Fleet:** Browse the `comments` branch on the publish node (HTTPS tree / blob) or `git log comments` — no separate Fleet health strip.
- **Publish origin:** only the catalog `publish_origin` (iad1) accepts client PUT for fan-edits.
- **Policy:** `.relay.yaml` allows unsigned commits on `comments`; `hooks/server/validation.cs` allowlists `.relay/comments/by-path/**/*.md` on that branch only (~32 KiB).

## Branch tips

Create `comments` (and stub `dev`) from a commit that already has `.relay.yaml`, then push so HTTP PUT has a parent tip. Mesh `autoPush.branches` includes `comments` so posts leave the publish origin.
