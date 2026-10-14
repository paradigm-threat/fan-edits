/**
 * Minimal IRC client over TCP for logger + per-browser bridges.
 */
import net from 'node:net';
import { EventEmitter } from 'node:events';

export class IrcClient extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.host = opts.host || '127.0.0.1';
    this.port = opts.port || 6667;
    this.nick = opts.nick || 'Guest';
    this.user = opts.user || 'flashback';
    this.real = opts.real || 'Flashback Chat';
    this.socket = null;
    this.buf = '';
    this.ready = false;
    this.channels = new Set();
  }

  connect() {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host: this.host, port: this.port }, () => {
        this.socket = sock;
        this.raw(`NICK ${this.nick}`);
        this.raw(`USER ${this.user} 0 * :${this.real}`);
      });
      sock.setEncoding('utf8');
      sock.on('data', (chunk) => this._onData(chunk));
      sock.on('error', (err) => {
        this.emit('error', err);
        reject(err);
      });
      sock.on('close', () => {
        this.ready = false;
        this.emit('close');
      });
      this.once('registered', () => resolve());
      setTimeout(() => {
        if (!this.ready) reject(new Error('IRC register timeout'));
      }, 15000);
    });
  }

  _onData(chunk) {
    this.buf += chunk;
    let idx;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      let line = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      this._handleLine(line);
    }
  }

  _handleLine(line) {
    this.emit('raw', line);
    if (line.startsWith('PING ')) {
      this.raw('PONG ' + line.slice(5));
      return;
    }
    const m = /^:(\S+)\s+(\S+)\s+(.*)$/.exec(line);
    if (!m) return;
    const prefix = m[1];
    const cmd = m[2];
    const rest = m[3];
    const nick = prefix.split('!')[0];

    if (cmd === '001') {
      this.ready = true;
      this.emit('registered');
      return;
    }
    if (cmd === '433') {
      // nick in use — try suffix
      const next = (this.nick.replace(/_+\d*$/, '') + '_' + Math.floor(Math.random() * 90 + 10)).slice(
        0,
        24,
      );
      this.nick = next;
      this.raw(`NICK ${next}`);
      return;
    }
    if (cmd === 'PRIVMSG') {
      const sp = rest.indexOf(' :');
      const target = sp >= 0 ? rest.slice(0, sp) : rest.split(' ')[0];
      const text = sp >= 0 ? rest.slice(sp + 2) : '';
      this.emit('privmsg', { nick, target, text, prefix });
      return;
    }
    if (cmd === 'JOIN') {
      const ch = (rest.startsWith(':') ? rest.slice(1) : rest.split(' ')[0]).toLowerCase();
      this.channels.add(ch);
      this.emit('join', { nick, channel: ch });
      return;
    }
    if (cmd === 'PART' || cmd === 'QUIT') {
      this.emit('part', { nick, channel: rest.split(' ')[0].toLowerCase() });
      return;
    }
    if (cmd === '353') {
      // NAMES: <me> = #chan :n1 n2
      const sp = rest.indexOf(' :');
      if (sp < 0) return;
      const left = rest.slice(0, sp).trim().split(/\s+/);
      const chan = (left[left.length - 1] || '').toLowerCase();
      const names = rest
        .slice(sp + 2)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((n) => n.replace(/^[@+%~&]/, ''));
      this.emit('names', { channel: chan, names });
      return;
    }
    if (cmd === '332') {
      const sp = rest.indexOf(' :');
      if (sp < 0) return;
      const left = rest.slice(0, sp).trim().split(/\s+/);
      const chan = (left[left.length - 1] || '').toLowerCase();
      const topic = rest.slice(sp + 2);
      this.emit('topic', { channel: chan, topic });
      return;
    }
    if (cmd === 'NOTICE') {
      const sp = rest.indexOf(' :');
      const text = sp >= 0 ? rest.slice(sp + 2) : rest;
      this.emit('notice', { nick, text });
    }
  }

  raw(line) {
    if (!this.socket || this.socket.destroyed) return;
    this.socket.write(line + '\r\n');
  }

  join(channel) {
    const ch = normalizeChannel(channel);
    if (!ch) return;
    this.raw(`JOIN ${ch}`);
  }

  part(channel) {
    const ch = normalizeChannel(channel);
    if (!ch) return;
    this.raw(`PART ${ch}`);
    this.channels.delete(ch.toLowerCase());
  }

  privmsg(target, text) {
    const t = String(target || '');
    const msg = String(text || '').replace(/[\r\n]/g, ' ').slice(0, 400);
    if (!t || !msg) return;
    this.raw(`PRIVMSG ${t} :${msg}`);
  }

  nickChange(nick) {
    const n = String(nick || '').replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 24);
    if (n.length < 2) return;
    this.nick = n;
    this.raw(`NICK ${n}`);
  }

  action(target, text) {
    this.privmsg(target, `\u0001ACTION ${String(text || '').slice(0, 380)}\u0001`);
  }

  close() {
    try {
      this.raw('QUIT :bye');
    } catch (_) {}
    try {
      this.socket && this.socket.destroy();
    } catch (_) {}
  }
}

export function normalizeChannel(raw) {
  let c = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^#/, '');
  c = c.replace(/[^a-z0-9_\-./]/g, '').slice(0, 64);
  if (!c) return '';
  return '#' + c;
}

export function channelToKey(ch) {
  return normalizeChannel(ch).replace(/^#/, '') || '';
}
