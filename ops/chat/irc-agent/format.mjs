/**
 * Shared formatting / redaction for Relay IRC ops bus lines.
 */

const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const BEARER_RE = /\b(Bearer\s+)[A-Za-z0-9._\-]+/gi;
const TOKEN_RE = /\b([A-Za-z0-9_]*(?:token|secret|password|api[_-]?key)[=:\s]+)[^\s,;]+/gi;

export function shortNodeNick(fqdnOrHost) {
  let raw = String(fqdnOrHost || '')
    .trim()
    .toLowerCase();
  // Spot/cloud hostnames are useless for ops identity — reject unless no better source.
  if (/^prod-instance-/.test(raw) || /^ip-\d/.test(raw)) {
    raw = '';
  }
  raw = raw
    .replace(/\.relaygateway\.net$/, '')
    .replace(/[^a-z0-9_.-]/g, '');
  const nick = (raw.split('.')[0] || 'node').replace(/[^a-z0-9_-]/g, '').slice(0, 16);
  return nick.length >= 2 ? nick : 'node';
}

export function redact(text) {
  return String(text || '')
    .replace(IP_RE, '[ip]')
    .replace(BEARER_RE, '$1[redacted]')
    .replace(TOKEN_RE, '$1[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 350);
}

export function formatLine(nick, level, component, text) {
  const n = String(nick || 'node').slice(0, 16);
  const lv = String(level || 'info')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .slice(0, 12) || 'info';
  const comp = String(component || 'ops')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 32) || 'ops';
  const body = redact(text);
  return `${n} | ${lv} | ${comp} | ${body}`;
}

/** Drop noisy / empty journal lines. */
export function shouldEmitJournal(unit, message) {
  const msg = String(message || '').trim();
  if (!msg) return false;
  if (/Started |Stopped |Reloading |Deactivated successfully/i.test(msg) && msg.length < 80) {
    return false;
  }
  // Always keep warnings/errors-ish
  if (/\b(error|fail|warn|panic|denied|refused)\b/i.test(msg)) return true;
  const u = String(unit || '');
  if (u.includes('caddy') && /park|flashback-chat|chat\/api/i.test(msg)) return true;
  if (u.includes('relay-gateway') && /mesh|peer|park_tls|tip/i.test(msg)) return true;
  if (u.includes('flashback-')) return true;
  return msg.length > 40;
}

export class RateLimiter {
  constructor(maxPerMin = 30) {
    this.max = maxPerMin;
    this.times = [];
  }
  allow() {
    const now = Date.now();
    this.times = this.times.filter((t) => now - t < 60000);
    if (this.times.length >= this.max) return false;
    this.times.push(now);
    return true;
  }
}
