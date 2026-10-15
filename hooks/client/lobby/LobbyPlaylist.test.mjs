/**
 * Logical playlist evaluator + tip playlist shape.
 * Run: node --test hooks/client/lobby/LobbyPlaylist.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const dir = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(dir, 'LobbyPlaylist.js'), 'utf8')
const tip = JSON.parse(
  fs.readFileSync(path.join(dir, 'lobby.playlist.json'), 'utf8'),
)

function loadLib() {
  const global = { localStorage: null }
  vm.runInNewContext(src, { globalThis: global, global, console })
  return global.FlashbackLobbyPlaylist
}

const SAMPLE = {
  format: 'flashback-logical-playlist/v1',
  state: {
    season: {
      source: 'calendar',
      christmas: { start: '11-15', end: '01-02' },
    },
    theater: { source: 'host' },
    enabled: { source: 'host' },
  },
  defaultSong: 'publicDomain',
  when: [
    { if: '!enabled || theater', do: 'fadeOut', ms: 800 },
    {
      if: 'enabled && !theater && season == christmas',
      do: 'play',
      song: 'christmas',
    },
    { if: 'enabled && !theater', do: 'play', song: 'publicDomain' },
  ],
  songs: {
    publicDomain: {
      loop: true,
      shuffle: true,
      tracks: ['https://example.com/a.mp3', 'https://example.com/b.mp3'],
    },
    christmas: {
      loop: true,
      shuffle: true,
      tracks: ['https://example.com/xmas.mp3'],
    },
  },
  volume: 0.28,
  fadeInMs: 1200,
  fadeOutMs: 800,
}

function d(y, m, day) {
  // local Date — month is 0-based
  return new Date(y, m - 1, day, 12, 0, 0)
}

test('calendarSeason: christmas wraps Nov 15 – Jan 2', () => {
  const L = loadLib()
  const cfg = { start: '11-15', end: '01-02' }
  assert.equal(L.calendarSeason(d(2026, 11, 15), cfg), 'christmas')
  assert.equal(L.calendarSeason(d(2026, 12, 25), cfg), 'christmas')
  assert.equal(L.calendarSeason(d(2027, 1, 2), cfg), 'christmas')
  assert.equal(L.calendarSeason(d(2026, 11, 14), cfg), 'default')
  assert.equal(L.calendarSeason(d(2027, 1, 3), cfg), 'default')
  assert.equal(L.calendarSeason(d(2026, 10, 15), cfg), 'default')
})

test('evaluate: fadeOut when disabled or theater', () => {
  const L = loadLib()
  const off = L.evaluate(SAMPLE, { enabled: false, theater: false, now: d(2026, 6, 1) })
  assert.equal(off.action, 'fadeOut')
  assert.equal(off.ms, 800)

  const theater = L.evaluate(SAMPLE, {
    enabled: true,
    theater: true,
    now: d(2026, 6, 1),
  })
  assert.equal(theater.action, 'fadeOut')
})

test('evaluate: publicDomain outside christmas window', () => {
  const L = loadLib()
  const dec = L.evaluate(SAMPLE, {
    enabled: true,
    theater: false,
    now: d(2026, 10, 15),
  })
  assert.equal(dec.action, 'play')
  assert.equal(dec.song, 'publicDomain')
  assert.equal(dec.season, 'default')
  assert.equal(dec.tracks.length, 2)
  assert.equal(dec.shuffle, true)
  assert.equal(dec.volume, 0.28)
})

test('evaluate: christmas song in season', () => {
  const L = loadLib()
  const dec = L.evaluate(SAMPLE, {
    enabled: true,
    theater: false,
    now: d(2026, 12, 20),
  })
  assert.equal(dec.action, 'play')
  assert.equal(dec.song, 'christmas')
  assert.equal(dec.season, 'christmas')
  assert.deepEqual(dec.tracks, ['https://example.com/xmas.mp3'])
})

test('shuffleCopy is deterministic for a seed and preserves membership', () => {
  const L = loadLib()
  const tracks = ['a', 'b', 'c', 'd', 'e']
  const a = L.shuffleCopy(tracks, 42)
  const b = L.shuffleCopy(tracks, 42)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a, tracks)
  assert.deepEqual([...a].sort(), [...tracks].sort())
})

test('tip lobby.playlist.json is valid flashback-logical-playlist/v1', () => {
  assert.equal(tip.format, 'flashback-logical-playlist/v1')
  assert.equal(tip.defaultSong, 'publicDomain')
  assert.ok(Array.isArray(tip.when) && tip.when.length >= 3)
  assert.ok(tip.songs.publicDomain?.tracks?.length >= 1)
  assert.ok(tip.songs.christmas?.tracks?.length >= 1)
  for (const songId of Object.keys(tip.songs)) {
    for (const u of tip.songs[songId].tracks) {
      assert.match(u, /^https:\/\/flashbackrepository\.b-cdn\.net\/lobby\//)
      assert.match(u, /\.mp3$/)
    }
  }
  const L = loadLib()
  const midyear = L.evaluate(tip, {
    enabled: true,
    theater: false,
    now: d(2026, 6, 15),
  })
  assert.equal(midyear.action, 'play')
  assert.equal(midyear.song, 'publicDomain')
  assert.ok(midyear.tracks.length >= 1)

  const xmas = L.evaluate(tip, {
    enabled: true,
    theater: false,
    now: d(2026, 12, 1),
  })
  assert.equal(xmas.action, 'play')
  assert.equal(xmas.song, 'christmas')
})

test('park-host-common loads lobby host scripts', () => {
  const common = fs.readFileSync(
    path.join(dir, '../native/park-host-common.js'),
    'utf8',
  )
  assert.match(common, /ensureLobbyHostScripts/)
  assert.match(common, /LobbyPlaylist\.js/)
  assert.match(common, /LobbyAudio\.host\.js/)
})

test('registry lists LobbyPlaylist + LobbyAudio', () => {
  const registry = fs.readFileSync(
    path.join(dir, '../native/registry.host.js'),
    'utf8',
  )
  assert.match(registry, /lobby\/LobbyPlaylist\.js/)
  assert.match(registry, /LobbyAudio\.host\.js/)
})
