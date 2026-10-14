#!/usr/bin/env node
/**
 * Per-node Relay IRC ops agent — publishes journal + emit API lines as nick=iad1|ord1|hkg1.
 *
 * Env:
 *   RELAY_IRC_HOST=127.0.0.1
 *   RELAY_IRC_PORT=6667
 *   RELAY_NODE_FQDN / RELAY_NODE_NICK / HOSTNAME
 *   RELAY_IRC_CHANNELS=#logs,#relay,#relay-stats
 *   RELAY_IRC_JOURNAL_UNITS=relay-gateway,caddy,flashback-ergo,flashback-chat-edge
 *   RELAY_IRC_EMIT_PORT=8099
 *   RELAY_IRC_HEARTBEAT_SECS=300
 *   RELAY_IRC_MAX_PER_MIN=30
 *   RELAY_IRC_LOG_CHANNEL=#logs
 *   RELAY_IRC_STATS_CHANNEL=#relay-stats
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IrcClient } from './irc-client.mjs';
import { formatLine, shortNodeNick, shouldEmitJournal, RateLimiter, redact } from './format.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IRC_HOST = process.env.RELAY_IRC_HOST || '127.0.0.1';
const IRC_PORT = Number(process.env.RELAY_IRC_PORT || 6667);
const NICK = shortNodeNick(
  process.env.RELAY_NODE_NICK || process.env.RELAY_NODE_FQDN || os.hostname(),
);
const CHANNELS = String(
  process.env.RELAY_IRC_CHANNELS ||
    '#logs,#logs-fb,#logs-ct,#logs-pt,#relay,#relay-stats',
)
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean)
  .map((c) => (c.startsWith('#') ? c : '#' + c));
const LOG_CH = process.env.RELAY_IRC_LOG_CHANNEL || '#logs';
const STATS_CH = process.env.RELAY_IRC_STATS_CHANNEL || '#relay-stats';
const UNITS = String(
  process.env.RELAY_IRC_JOURNAL_UNITS ||
    'relay-gateway,caddy,flashback-ergo,flashback-chat-edge,flashback-irc-agent',
)
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);
const EMIT_PORT = Number(process.env.RELAY_IRC_EMIT_PORT || 8099);
const HEARTBEAT_SECS = Number(process.env.RELAY_IRC_HEARTBEAT_SECS || 300);
const MAX_PER_MIN = Number(process.env.RELAY_IRC_MAX_PER_MIN || 30);
const LOG_ROOT = process.env.CHAT_LOG_ROOT || '/opt/relay/chat/logs';

const limiter = new RateLimiter(MAX_PER_MIN);
let irc = null;

function appendOpsJsonl(channel, entry) {
  try {
    const key = String(channel || 'logs').replace(/^#/, '');
    const dir = path.join(LOG_ROOT, key);
    fs.mkdirSync(dir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    fs.appendFileSync(path.join(dir, `${day}.jsonl`), JSON.stringify(entry) + '\n');
  } catch (_) {}
}

function publish(channel, level, component, text) {
  if (!irc || !irc.ready) return false;
  if (!limiter.allow()) return false;
  const line = formatLine(NICK, level, component, text);
  const ch = channel.startsWith('#') ? channel : '#' + channel;
  irc.privmsg(ch, line);
  appendOpsJsonl(ch, {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    channel: ch.replace(/^#/, ''),
    nick: NICK,
    kind: 'privmsg',
    text: line,
  });
  return true;
}

async function connectIrc() {
  for (;;) {
    try {
      irc = new IrcClient({
        host: IRC_HOST,
        port: IRC_PORT,
        nick: NICK,
        user: 'relayops',
        real: `Relay ops agent ${NICK}`,
      });
      await irc.connect();
      for (const ch of CHANNELS) irc.join(ch);
      console.log(`[irc-agent] connected as ${NICK} → ${IRC_HOST}:${IRC_PORT} ${CHANNELS.join(',')}`);
      publish(LOG_CH, 'info', 'agent', 'online');
      irc.on('close', () => {
        console.warn('[irc-agent] IRC closed — reconnecting');
        setTimeout(() => connectIrc().catch(() => {}), 3000);
      });
      irc.on('error', (e) => console.warn('[irc-agent] IRC error', e.message || e));
      return;
    } catch (e) {
      console.warn('[irc-agent] connect failed', e.message || e);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

function startJournalFollow() {
  if (!UNITS.length) return;
  const args = ['-f', '-o', 'json', '-n', '0'];
  for (const u of UNITS) {
    args.push('-u', u.endsWith('.service') ? u : `${u}.service`);
  }
  const child = spawn('journalctl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let buf = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        const unit = j.SYSLOG_IDENTIFIER || j._SYSTEMD_UNIT || j.UNIT || 'journal';
        const msg = j.MESSAGE || '';
        const shortUnit = String(unit).replace(/\.service$/, '');
        if (!shouldEmitJournal(shortUnit, msg)) continue;
        const pri = Number(j.PRIORITY);
        const level = pri <= 3 ? 'error' : pri === 4 ? 'warn' : 'info';
        publish(LOG_CH, level, shortUnit, msg);
      } catch (_) {}
    }
  });
  child.stderr.on('data', (d) => console.warn('[irc-agent] journalctl', String(d).trim()));
  child.on('exit', (code) => {
    console.warn(`[irc-agent] journalctl exited ${code} — restarting`);
    setTimeout(startJournalFollow, 4000);
  });
}

function startEmitServer() {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, nick: NICK, irc: !!(irc && irc.ready) }));
      return;
    }
    if (req.method === 'POST' && (req.url === '/emit' || req.url === '/chat/api/ops-emit')) {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 8000) req.destroy();
      });
      req.on('end', () => {
        try {
          const j = JSON.parse(body || '{}');
          const channel = j.channel || LOG_CH;
          const level = j.level || 'info';
          const component = j.component || 'gateway';
          const text = j.text || j.message || '';
          const ok = publish(channel, level, component, text);
          res.writeHead(ok ? 200 : 429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
        }
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(EMIT_PORT, '127.0.0.1', () => {
    console.log(`[irc-agent] emit http://127.0.0.1:${EMIT_PORT}/emit`);
  });
}

function startHeartbeat() {
  const tick = () => {
    try {
      const load = os.loadavg()[0];
      let disk = '?';
      try {
        const st = fs.statfsSync('/');
        const free = (st.bfree * st.bsize) / (1024 * 1024 * 1024);
        disk = `${free.toFixed(1)}Gfree`;
      } catch (_) {}
      publish(
        STATS_CH,
        'info',
        'heartbeat',
        `load=${load.toFixed(2)} disk=${disk} host=${os.hostname()}`,
      );
    } catch (_) {}
  };
  setInterval(tick, Math.max(60, HEARTBEAT_SECS) * 1000);
  setTimeout(tick, 15000);
}

await connectIrc();
startEmitServer();
startJournalFollow();
startHeartbeat();
