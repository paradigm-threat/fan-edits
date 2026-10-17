/**
 * Flashback chat-edge: REST + JSON WebSocket bridge over local Ergo IRC.
 *
 * Env:
 *   CHAT_EDGE_PORT=8098
 *   CHAT_IRC_HOST=127.0.0.1
 *   CHAT_IRC_PORT=6667
 *   CHAT_LOG_ROOT=/opt/relay/chat/logs
 *   CHAT_INDEX=/opt/relay/chat/channels.json
 *   CHAT_LOGGER_NICK=FlashbackLog
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { IrcClient, normalizeChannel, channelToKey } from './irc-client.mjs';
import { theaterNick, countryFromHeaders, sanitizeNick } from './naming.mjs';

const PORT = Number(process.env.CHAT_EDGE_PORT || 8098);
const IRC_HOST = process.env.CHAT_IRC_HOST || '127.0.0.1';
const IRC_PORT = Number(process.env.CHAT_IRC_PORT || 6667);
const LOG_ROOT = process.env.CHAT_LOG_ROOT || '/opt/relay/chat/logs';
const INDEX_PATH = process.env.CHAT_INDEX || '/opt/relay/chat/channels.json';
const LOGGER_NICK = process.env.CHAT_LOGGER_NICK || 'FlashbackLog';

const SEED_CHANNELS = [
  { name: 'flashback', topic: 'Flashback lobby' },
  { name: 'page-home', topic: 'Home page' },
  { name: 'page-setup', topic: 'Setup' },
  { name: 'page-board', topic: 'Board' },
  { name: 'page-app', topic: 'App' },
  { name: 'page-legal', topic: 'Legal' },
  { name: 'page-terms', topic: 'Terms' },
  { name: 'page-motivation', topic: 'Motivation' },
  { name: 'page-submit', topic: 'Submit' },
  { name: 'page-request', topic: 'Request' },
  { name: 'page-chat', topic: 'Chat' },
];

function ensureDirs() {
  fs.mkdirSync(LOG_ROOT, { recursive: true });
  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
}

function loadIndex() {
  try {
    const j = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    if (j && Array.isArray(j.channels)) return j;
  } catch (_) {}
  return { schema: 'flashback.chat.channels.v1', channels: [] };
}

function saveIndex(idx) {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(idx, null, 2) + '\n');
}

function touchChannel(name, topic) {
  const key = channelToKey(name);
  if (!key) return;
  const idx = loadIndex();
  let row = idx.channels.find((c) => c.name === key);
  if (!row) {
    row = { name: key, topic: topic || '', updated: new Date().toISOString(), messages: 0 };
    idx.channels.push(row);
  } else {
    row.updated = new Date().toISOString();
    if (topic) row.topic = topic;
  }
  idx.channels.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  saveIndex(idx);
}

function bumpChannel(name) {
  const key = channelToKey(name);
  const idx = loadIndex();
  let row = idx.channels.find((c) => c.name === key);
  if (!row) {
    row = { name: key, topic: '', updated: new Date().toISOString(), messages: 0 };
    idx.channels.push(row);
  }
  row.messages = (row.messages || 0) + 1;
  row.updated = new Date().toISOString();
  saveIndex(idx);
}

function dayStamp(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function appendLog(channel, entry) {
  const key = channelToKey(channel);
  if (!key) return;
  const dir = path.join(LOG_ROOT, key);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${dayStamp()}.jsonl`);
  fs.appendFileSync(file, JSON.stringify(entry) + '\n');
  bumpChannel(key);
}

function readHistory(channel, limit = 50) {
  const key = channelToKey(channel);
  const dir = path.join(LOG_ROOT, key);
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .sort();
  const lines = [];
  for (let i = files.length - 1; i >= 0 && lines.length < lim * 2; i--) {
    const raw = fs.readFileSync(path.join(dir, files[i]), 'utf8');
    const parts = raw.split('\n').filter(Boolean);
    for (let j = parts.length - 1; j >= 0; j--) {
      try {
        lines.push(JSON.parse(parts[j]));
      } catch (_) {}
      if (lines.length >= lim) break;
    }
  }
  return lines.reverse().slice(-lim);
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.socket.remoteAddress || '';
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(data);
}

function parseUrl(req) {
  try {
    return new URL(req.url || '/', 'http://127.0.0.1');
  } catch (_) {
    return new URL('/', 'http://127.0.0.1');
  }
}

/** Logger bot: join known channels, append PRIVMSG to JSONL. */
let logger = null;
async function startLogger() {
  logger = new IrcClient({
    host: IRC_HOST,
    port: IRC_PORT,
    nick: LOGGER_NICK,
    user: 'fblog',
    real: 'Flashback Logger',
  });
  await logger.connect();
  const idx = loadIndex();
  const names = new Set(SEED_CHANNELS.map((c) => c.name));
  for (const c of idx.channels) names.add(c.name);
  for (const n of names) {
    touchChannel(n);
    logger.join(n);
  }
  logger.on('privmsg', ({ nick, target, text }) => {
    if (!target.startsWith('#')) return;
    if (nick === LOGGER_NICK) return;
    let kind = 'privmsg';
    let body = text;
    if (text.startsWith('\u0001ACTION ') && text.endsWith('\u0001')) {
      kind = 'action';
      body = text.slice(8, -1);
    }
    appendLog(target, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      channel: channelToKey(target),
      nick,
      kind,
      text: body,
    });
  });
  console.log('[logger] connected as', LOGGER_NICK);
}

function ensureLoggerJoins(channel) {
  if (!logger || !logger.ready) return;
  const ch = normalizeChannel(channel);
  if (!ch) return;
  if (!logger.channels.has(ch.toLowerCase())) logger.join(ch);
  touchChannel(ch);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const u = parseUrl(req);
  const p = u.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'GET' && (p === '/chat/api/health' || p === '/health')) {
    const ircOk = !!(logger && logger.ready);
    return json(res, ircOk ? 200 : 503, {
      ok: ircOk,
      service: 'flashback-chat-edge',
      irc: ircOk ? 'up' : 'down',
      ts: new Date().toISOString(),
    });
  }

  if (req.method === 'GET' && p === '/chat/api/history') {
    const channel = u.searchParams.get('channel') || 'flashback';
    const limit = u.searchParams.get('limit') || '50';
    ensureLoggerJoins(channel);
    return json(res, 200, {
      channel: channelToKey(channel),
      messages: readHistory(channel, limit),
    });
  }

  if (req.method === 'GET' && p === '/chat/api/channels') {
    const q = String(u.searchParams.get('q') || '')
      .trim()
      .toLowerCase();
    const idx = loadIndex();
    let list = idx.channels.slice();
    if (q) list = list.filter((c) => String(c.name).includes(q) || String(c.topic || '').toLowerCase().includes(q));
    return json(res, 200, { channels: list });
  }

  if (req.method === 'GET' && p === '/chat/api/name') {
    const mode = u.searchParams.get('mode') || 'theater';
    const country = countryFromHeaders(req.headers);
    const nick = theaterNick({
      country,
      ip: clientIp(req),
      ua: req.headers['user-agent'] || '',
      mode,
    });
    return json(res, 200, { nick, mode, country: country || null });
  }

  json(res, 404, { error: 'not_found' });
});

const wss = new WebSocketServer({ server, path: '/chat/ws' });

wss.on('connection', async (ws, req) => {
  const country = countryFromHeaders(req.headers);
  let qNick = '';
  try {
    const wu = new URL(req.url || '/', 'http://chat.local');
    qNick = sanitizeNick(wu.searchParams.get('nick') || '');
  } catch (_) {
    qNick = '';
  }
  // Prefer client session nick (?nick=); else curated lexicon pick.
  let desired =
    qNick ||
    theaterNick({
      country,
      ip: clientIp(req),
      ua: req.headers['user-agent'] || '',
    });

  const irc = new IrcClient({
    host: IRC_HOST,
    port: IRC_PORT,
    nick: desired,
    user: 'web',
    real: 'Flashback Web',
  });

  const send = (obj) => {
    try {
      if (ws.readyState === 1) ws.send(JSON.stringify(obj));
    } catch (_) {}
  };

  try {
    await irc.connect();
  } catch (err) {
    send({ type: 'error', error: 'irc_connect_failed', message: String(err && err.message) });
    ws.close();
    return;
  }

  send({ type: 'hello', nick: irc.nick, server: 'flashback' });

  irc.on('privmsg', ({ nick, target, text }) => {
    let kind = 'privmsg';
    let body = text;
    if (text.startsWith('\u0001ACTION ') && text.endsWith('\u0001')) {
      kind = 'action';
      body = text.slice(8, -1);
    }
    send({
      type: 'message',
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      channel: channelToKey(target),
      nick,
      kind,
      text: body,
    });
  });
  irc.on('join', ({ nick, channel }) => send({ type: 'join', nick, channel: channelToKey(channel) }));
  irc.on('part', ({ nick, channel }) => send({ type: 'part', nick, channel: channelToKey(channel) }));
  irc.on('names', ({ channel, names }) =>
    send({ type: 'names', channel: channelToKey(channel), names }),
  );
  irc.on('topic', ({ channel, topic }) =>
    send({ type: 'topic', channel: channelToKey(channel), topic }),
  );
  irc.on('notice', ({ nick, text }) => send({ type: 'notice', nick, text }));
  irc.on('close', () => {
    send({ type: 'disconnected' });
    try {
      ws.close();
    } catch (_) {}
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch (_) {
      return;
    }
    const t = msg && msg.type;
    if (t === 'nick') {
      const n = sanitizeNick(msg.nick);
      if (n) {
        irc.nickChange(n);
        send({ type: 'nick', nick: n });
      }
      return;
    }
    if (t === 'join') {
      const ch = normalizeChannel(msg.channel);
      if (!ch) return;
      ensureLoggerJoins(ch);
      irc.join(ch);
      return;
    }
    if (t === 'part') {
      irc.part(msg.channel);
      return;
    }
    if (t === 'privmsg') {
      const ch = normalizeChannel(msg.channel);
      const text = String(msg.text || '').slice(0, 400);
      if (!ch || !text) return;
      ensureLoggerJoins(ch);
      if (text.startsWith('/me ')) {
        irc.action(ch, text.slice(4));
        return;
      }
      if (text.startsWith('/join ')) {
        const j = normalizeChannel(text.slice(6));
        if (j) {
          ensureLoggerJoins(j);
          irc.join(j);
        }
        return;
      }
      if (text.startsWith('/part')) {
        irc.part(ch);
        return;
      }
      irc.privmsg(ch, text);
      // Optimistic echo for sender (Ergo may not echo)
      send({
        type: 'message',
        id: `${Date.now()}-local`,
        ts: new Date().toISOString(),
        channel: channelToKey(ch),
        nick: irc.nick,
        kind: 'privmsg',
        text,
        local: true,
      });
      return;
    }
    if (t === 'ping') {
      send({ type: 'pong', ts: Date.now() });
    }
  });

  ws.on('close', () => {
    try {
      irc.close();
    } catch (_) {}
  });
});

async function main() {
  ensureDirs();
  for (const c of SEED_CHANNELS) touchChannel(c.name, c.topic);

  let attempts = 0;
  while (attempts < 30) {
    try {
      await startLogger();
      break;
    } catch (err) {
      attempts += 1;
      console.error('[logger] waiting for ergo…', err.message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!logger || !logger.ready) {
    console.error('[logger] failed to connect — health will be 503 until IRC is up');
  }

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[chat-edge] http://127.0.0.1:${PORT}  irc=${IRC_HOST}:${IRC_PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
