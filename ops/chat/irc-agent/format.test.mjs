import assert from 'node:assert/strict';
import test from 'node:test';
import { formatLine, redact, shortNodeNick, shouldEmitJournal, RateLimiter } from './format.mjs';

test('shortNodeNick from fqdn', () => {
  assert.equal(shortNodeNick('iad1.relaygateway.net'), 'iad1');
  assert.equal(shortNodeNick('ord1'), 'ord1');
  assert.equal(shortNodeNick('prod-instance-17901615903190413'), 'node');
});

test('redact strips IPs and secrets', () => {
  assert.match(redact('from 1.2.3.4'), /\[ip\]/);
  assert.match(redact('Authorization: Bearer abc.def'), /\[redacted\]/);
  assert.match(redact('password=hunter2'), /\[redacted\]/);
});

test('formatLine shape', () => {
  const line = formatLine('iad1', 'warn', 'caddy', 'park rewrite');
  assert.equal(line, 'iad1 | warn | caddy | park rewrite');
});

test('shouldEmitJournal filters chatter', () => {
  assert.equal(shouldEmitJournal('caddy.service', 'Started caddy.service'), false);
  assert.equal(shouldEmitJournal('relay-gateway.service', 'mesh peer notify delivered'), true);
  assert.equal(shouldEmitJournal('caddy.service', 'error: something'), true);
});

test('RateLimiter caps', () => {
  const r = new RateLimiter(2);
  assert.equal(r.allow(), true);
  assert.equal(r.allow(), true);
  assert.equal(r.allow(), false);
});
