# Ownership and fan-edit policy

## You must own the original

Before playing any title in the Flashback Repository, you must **own a legal commercial copy** of the corresponding original film (or other lawful access that your jurisdiction treats as ownership for personal use).

This site publishes **personal fan-edit projects** — alternate cuts and mixes made from sources the editor owns. It is not a substitute for buying, renting, or otherwise obtaining the studio release.

That ownership rule is the long-standing precedent used by fanedit communities and related forums: the edit is for people who already have the movie.

## Where copyrighted media lives (and does not)

- **Git / public repos do not hold the movie files.** Catalog history, CleverScript, READMEs, cut notes, and **text-only** pointers (content hashes and paths) live in the repository.
- **Feature video is addressed on the IPFS network** by content hash — not checked into any public git remote as binary media, and **not** kept as a multi‑GB cache on Relay servers.
- **Clients download from IPFS peers** (Flashback APK embedded Kubo, or any browser/path that fetches the CID from the swarm). Availability depends on whoever still pins the CID (typically a workstation seeder), not on fleet disk cache.
- **Now showing** means titles **manually uploaded** for play on the host right now — not “hot in an IPFS cache.”

## What this site is

- A catalog of personal projects (notes, cut lists, and CID pointers for seeded masters)
- Hosted on the Relay network with a **thin IPFS catalog** for large video
- Operated as a private / personal library surface, not a commercial streaming service

## What this site is not

- Permission to distribute studio masters
- A claim that every jurisdiction treats fan edits the same way
- A promise that every CID stays pinned on every node forever
- Legal advice

If you do not own the original, do not play the edit. Confirm ownership on the disclaimer when you first visit, and again whenever that acknowledgment is cleared.

See also [Terms](/terms) and [Why we’re doing this](/motivation).
