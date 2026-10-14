/**
 * Unit tests for theater nick + channel helpers.
 * Run: node --test ops/chat/chat-edge/naming.test.mjs ops/chat/chat-edge/irc-client.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { theaterNick, countryFromHeaders, sanitizeNick } from './naming.mjs'
import { normalizeChannel, channelToKey } from './irc-client.mjs'

test('sanitizeNick strips junk and enforces length', () => {
  assert.equal(sanitizeNick('Orpheum-G12'), 'Orpheum-G12')
  assert.equal(sanitizeNick('hi!@#'), 'hi')
  assert.equal(sanitizeNick('a'), '')
  assert.equal(sanitizeNick('123abc').charAt(0), 'N')
  assert.ok(sanitizeNick('x'.repeat(40)).length <= 24)
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
  assert.match(a, /^[A-Za-z][A-Za-z0-9_\-]{1,23}$/)
})

test('theaterNick cut-room mode uses edit lexicon', () => {
  const n = theaterNick({
    country: 'JP',
    ip: '198.51.100.10',
    ua: 'VLC',
    mode: 'cut-room',
  })
  assert.match(n, /(Trim|Fade|Cut|Dissolve|Wipe|Match|Ripple|Splice|Grade|Dub)$/)
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
