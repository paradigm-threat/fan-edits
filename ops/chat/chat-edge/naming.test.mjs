/**
 * Unit tests for curated nick + channel helpers.
 * Run: node --test ops/chat/chat-edge/naming.test.mjs ops/chat/chat-edge/irc-client.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  theaterNick,
  countryFromHeaders,
  sanitizeNick,
  PT_NICKS,
  CUT_ROOM_NICKS,
} from './naming.mjs'
import { normalizeChannel, channelToKey } from './irc-client.mjs'

test('sanitizeNick strips junk and enforces length', () => {
  assert.equal(sanitizeNick('MrSaturn'), 'MrSaturn')
  assert.equal(sanitizeNick('NSA-Ally'), 'NSA-Ally')
  assert.equal(sanitizeNick('hi!@#'), 'hi')
  assert.equal(sanitizeNick('a'), '')
  assert.equal(sanitizeNick('123abc').charAt(0), 'N')
  assert.ok(sanitizeNick('x'.repeat(40)).length <= 24)
})

test('PT_NICKS includes requested flavor names', () => {
  assert.ok(PT_NICKS.includes('MrSaturn'))
  assert.ok(PT_NICKS.includes('Marvin'))
  assert.ok(PT_NICKS.includes('Juergens'))
  assert.ok(PT_NICKS.includes('Thornhill'))
  assert.ok(PT_NICKS.includes('Insider911'))
  assert.ok(PT_NICKS.includes('NSA-Ally'))
  assert.ok(PT_NICKS.length >= 40)
  for (const n of PT_NICKS) {
    const s = sanitizeNick(n)
    assert.equal(s, n, `nick must be IRC-safe as listed: ${n}`)
  }
})

test('theaterNick is stable for same seed and never embeds raw IP', () => {
  const a = theaterNick({
    country: 'US',
    ip: '203.0.113.44',
    ua: 'Mozilla/5.0 Test',
    mode: 'theater',
  })
  const b = theaterNick({
    country: 'US',
    ip: '203.0.113.99',
    ua: 'Mozilla/5.0 Test',
    mode: 'theater',
  })
  assert.equal(a, b)
  assert.ok(!a.includes('203'))
  assert.ok(!a.includes('113'))
  assert.ok(PT_NICKS.includes(a))
  assert.match(a, /^[A-Za-z][A-Za-z0-9_\-]{1,23}$/)
})

test('theaterNick cut-room mode uses cut-room lexicon', () => {
  const n = theaterNick({
    country: 'JP',
    ip: '198.51.100.10',
    ua: 'VLC',
    mode: 'cut-room',
  })
  assert.ok(CUT_ROOM_NICKS.includes(n))
})

test('countryFromHeaders reads common CDN headers', () => {
  assert.equal(countryFromHeaders({ 'cf-ipcountry': 'de' }), 'DE')
  assert.equal(countryFromHeaders({ 'x-geo-country': 'JP' }), 'JP')
  assert.equal(countryFromHeaders({ 'cf-ipcountry': 'XX' }), '')
  assert.equal(countryFromHeaders({}), '')
})

test('normalizeChannel and channelToKey', () => {
  assert.equal(normalizeChannel('movie-sonic'), '#movie-sonic')
  assert.equal(normalizeChannel('#Flashback'), '#flashback')
  assert.equal(normalizeChannel('Bad Nick!!'), '#badnick')
  assert.equal(channelToKey('#page-setup'), 'page-setup')
  assert.equal(normalizeChannel(''), '')
})
