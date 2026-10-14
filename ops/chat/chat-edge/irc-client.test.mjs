/**
 * Minimal IRC client framing tests (no live server).
 * Run: node --test ops/chat/chat-edge/irc-client.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { IrcClient, normalizeChannel } from './irc-client.mjs'

test('IrcClient parses PRIVMSG and PING', async () => {
  const irc = new IrcClient({ nick: 'TestBot' })
  // Stub socket
  const writes = []
  irc.socket = {
    destroyed: false,
    write(s) {
      writes.push(String(s))
    },
  }
  const msgs = []
  irc.on('privmsg', (m) => msgs.push(m))
  irc._handleLine('PING :xyz')
  assert.ok(writes.some((w) => w.startsWith('PONG ')))
  irc._handleLine(':Alice!a@b PRIVMSG #flashback :hello **world**')
  assert.equal(msgs.length, 1)
  assert.equal(msgs[0].nick, 'Alice')
  assert.equal(msgs[0].target, '#flashback')
  assert.equal(msgs[0].text, 'hello **world**')
})

test('IrcClient action CTCP and nickChange', () => {
  const irc = new IrcClient({ nick: 'A' })
  const writes = []
  irc.socket = {
    destroyed: false,
    write(s) {
      writes.push(String(s).trim())
    },
  }
  irc.action('#flashback', 'waves')
  assert.ok(writes.some((w) => w.includes('ACTION waves')))
  irc.nickChange('NewNick')
  assert.equal(irc.nick, 'NewNick')
  assert.ok(writes.some((w) => w === 'NICK NewNick'))
})

test('normalizeChannel rejects empty junk', () => {
  assert.equal(normalizeChannel('!!!'), '')
  assert.equal(normalizeChannel('ok_chan'), '#ok_chan')
})

// Keep EventEmitter import used for type-ish sanity in older node
assert.ok(EventEmitter)
