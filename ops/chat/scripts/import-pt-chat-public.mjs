#!/usr/bin/env node
/**
 * Import paradigm-threat-site chat/public markdown → chat-edge JSONL.
 *
 * Maps topic channels to mesh keys: general → pt-general, nukes → pt-nukes, …
 *
 * Usage:
 *   node import-pt-chat-public.mjs --dry-run
 *   node import-pt-chat-public.mjs --apply --chat-root=/opt/relay/chat
 *   node import-pt-chat-public.mjs --apply --repo=/path/to/paradigm-threat-site
 *
 * Env:
 *   PT_SITE_REPO   default ~/dev/pt/paradigm-threat-site
 *   CHAT_ROOT      default /opt/relay/chat (or ./tmp-chat-import for dry local)
 *   CHAT_BRANCH    default chat/public
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const args = process.argv.slice(2);
function flag(name, def = '') {
  const eq = args.find((a) => a.startsWith(name + '='));
  if (eq) return eq.slice(name.length + 1) || def;
  const i = args.indexOf(name);
  if (i < 0) return def;
  const v = args[i + 1];
  if (!v || v.startsWith('--')) return def || '1';
  return v;
}
const APPLY = args.includes('--apply');
const DRY = !APPLY || args.includes('--dry-run');
const REPO =
  flag('--repo', '') ||
  process.env.PT_SITE_REPO ||
  path.join(os.homedir(), 'dev/pt/paradigm-threat-site');
const BRANCH = flag('--branch', '') || process.env.CHAT_BRANCH || 'chat/public';
const CHAT_ROOT =
  flag('--chat-root', '') ||
  process.env.CHAT_ROOT_IMPORT ||
  (APPLY && !args.includes('--dry-run')
    ? '/opt/relay/chat'
    : path.join(os.tmpdir(), 'relay-chat-import-dry'));
const LIMIT = Number(flag('--limit', '0')) || 0;

function die(msg) {
  console.error('[import-pt]', msg);
  process.exit(1);
}

function git(argsList, opts = {}) {
  return execFileSync('git', argsList, {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
}

function slugifyChannel(raw) {
  let s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9_\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  if (!s) s = 'general';
  if (s.startsWith('pt-')) return s;
  return 'pt-' + s;
}

function sanitizeNick(raw) {
  let n = String(raw || 'guest')
    .trim()
    .replace(/[^\w\-\[\]\\`^{|}]/g, '')
    .slice(0, 24);
  if (n.length < 2) n = 'guest';
  if (/^[0-9-]/.test(n)) n = 'u' + n;
  return n;
}

function dayStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '1970-01-01';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Minimal YAML-ish frontmatter parser for paradigm.chat.v1 files. */
function parseChatMarkdown(raw) {
  const text = String(raw || '');
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end < 0) return null;
  const fmBlock = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\n/, '').trim();
  const data = {};
  for (const line of fmBlock.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
      v = v.slice(1, -1);
    }
    if (v === 'true') v = true;
    else if (v === 'false') v = false;
    data[m[1]] = v;
  }
  if (data.schema !== 'paradigm.chat.v1') return null;
  const channel = typeof data.channel === 'string' ? data.channel : '';
  const id = data.id != null ? String(data.id) : '';
  const created = typeof data.created === 'string' ? data.created : '';
  if (!channel || !id || !created) return null;
  const anonymous = data.anonymous !== false;
  const author = typeof data.author === 'string' ? data.author : undefined;
  return {
    id,
    channel,
    created,
    anonymous,
    author,
    content: body,
  };
}

function loadIndex(root) {
  const p = path.join(root, 'channels.json');
  if (!fs.existsSync(p)) return { schema: 'flashback.chat.channels.v1', channels: [] };
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { schema: 'flashback.chat.channels.v1', channels: [] };
  }
}

function saveIndex(root, idx) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'channels.json'), JSON.stringify(idx, null, 2) + '\n');
}

function existingIds(file) {
  const set = new Set();
  if (!fs.existsSync(file)) return set;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      const o = JSON.parse(line);
      if (o && o.id) set.add(String(o.id));
    } catch {
      /* skip */
    }
  }
  return set;
}

function ensureChannel(idx, key, topic) {
  let row = idx.channels.find((c) => c.name === key);
  if (!row) {
    row = { name: key, topic: topic || '', updated: new Date().toISOString(), messages: 0 };
    idx.channels.push(row);
  }
  return row;
}

function main() {
  if (!fs.existsSync(path.join(REPO, '.git'))) {
    die(`not a git repo: ${REPO}`);
  }
  try {
    git(['rev-parse', '--verify', BRANCH]);
  } catch {
    die(`branch not found: ${BRANCH} in ${REPO}`);
  }

  console.log(`[import-pt] repo=${REPO} branch=${BRANCH}`);
  console.log(`[import-pt] chat-root=${CHAT_ROOT} apply=${APPLY && !args.includes('--dry-run')}`);

  const paths = git(['ls-tree', '-r', '--name-only', `${BRANCH}:.relay/chat/channels/`])
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.endsWith('.md'));

  console.log(`[import-pt] found ${paths.length} markdown messages`);

  const writeRoot = APPLY && !args.includes('--dry-run') ? CHAT_ROOT : CHAT_ROOT;
  if (DRY && !APPLY) {
    console.log('[import-pt] dry-run (pass --apply to write)');
  }
  fs.mkdirSync(path.join(writeRoot, 'logs'), { recursive: true });

  const idx = loadIndex(writeRoot);
  let written = 0;
  let skipped = 0;
  let parsed = 0;
  const byChannel = new Map();

  const list = LIMIT > 0 ? paths.slice(0, LIMIT) : paths;
  for (const rel of list) {
    const blob = `${BRANCH}:.relay/chat/channels/${rel}`;
    let raw;
    try {
      raw = git(['show', blob]);
    } catch {
      skipped++;
      continue;
    }
    const msg = parseChatMarkdown(raw);
    if (!msg) {
      skipped++;
      continue;
    }
    parsed++;
    const key = slugifyChannel(msg.channel);
    const nick = sanitizeNick(msg.anonymous ? 'anonymous' : msg.author || 'guest');
    const text = String(msg.content || '').slice(0, 1024);
    const id = `pt-import-${msg.id}`;
    const day = dayStamp(msg.created);
    const dir = path.join(writeRoot, 'logs', key);
    const file = path.join(dir, `${day}.jsonl`);
    const entry = {
      id,
      ts: msg.created,
      channel: key,
      nick,
      kind: 'privmsg',
      text,
      source: 'pt-chat-public-import',
    };

    byChannel.set(key, (byChannel.get(key) || 0) + 1);

    if (!APPLY || args.includes('--dry-run')) {
      written++;
      continue;
    }

    fs.mkdirSync(dir, { recursive: true });
    const seen = existingIds(file);
    if (seen.has(id)) {
      skipped++;
      continue;
    }
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
    const row = ensureChannel(idx, key, msg.channel);
    row.messages = (row.messages || 0) + 1;
    row.updated = msg.created;
    written++;
  }

  if (APPLY && !args.includes('--dry-run')) {
    idx.channels.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    saveIndex(writeRoot, idx);
  }

  console.log(`[import-pt] parsed=${parsed} written=${written} skipped=${skipped}`);
  const top = [...byChannel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  for (const [ch, n] of top) {
    console.log(`  ${ch}: ${n}`);
  }
  if (!APPLY || args.includes('--dry-run')) {
    console.log('[import-pt] dry-run complete — re-run with --apply to write JSONL');
  } else {
    console.log(`[import-pt] wrote under ${writeRoot}/logs/pt-*/`);
  }
}

main();
