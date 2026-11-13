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

function loadLib(localStorage = null) {
  const global = { localStorage }
  vm.runInNewContext(src, { globalThis: global, global, console })
  return global.FlashbackLobbyPlaylist
}

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      map.set(k, String(v))
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
}

const SAMPLE = {
  format: 'flashback-logical-playlist/v1',
  state: {
    season: {
      source: 'calendar',
      winter: { start: '10-15', end: '01-02' },
    },
    theater: { source: 'host' },
    enabled: { source: 'host' },
  },
  defaultSong: 'publicDomain',
  when: [
    { if: '!enabled || theater', do: 'fadeOut', ms: 800 },
    {
      if: 'enabled && !theater && season == winter',
      do: 'play',
      song: 'winter',
    },
    { if: 'enabled && !theater', do: 'play', song: 'publicDomain' },
  ],
  songs: {
    publicDomain: {
      loop: true,
      shuffle: true,
      tracks: ['https://example.com/a.mp3', 'https://example.com/b.mp3'],
    },
    winter: {
      loop: true,
      shuffle: true,
      tracks: ['https://example.com/winter.mp3'],
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

test('christmas window is November through February', () => {
  const L = loadLib()
  assert.equal(L.christmasWindow(d(2026, 11, 1)), true)
  assert.equal(L.christmasWindow(d(2026, 12, 25)), true)
  assert.equal(L.christmasWindow(d(2027, 1, 15)), true)
  assert.equal(L.christmasWindow(d(2027, 2, 28)), true)
  assert.equal(L.christmasWindow(d(2026, 10, 31)), false)
  assert.equal(L.christmasWindow(d(2026, 3, 1)), false)
})

test('day index matches key * 17 + 3', () => {
  const L = loadLib()
  const now = d(2026, 6, 15)
  const key = 2026 * 10000 + 6 * 100 + 15
  assert.equal(L.dayIndex(now, 7), (key * 17 + 3) % 7)
  assert.equal(L.dayIndex(now, 9), (key * 17 + 3) % 9)
})

test('evaluate: fadeOut when off or theater', () => {
  const L = loadLib()
  const off = L.evaluate(SAMPLE, { mode: 'off', theater: false, now: d(2026, 6, 1) })
  assert.equal(off.action, 'fadeOut')
  assert.equal(off.ms, 800)

  const theater = L.evaluate(SAMPLE, {
    mode: 'auto',
    theater: true,
    now: d(2026, 6, 1),
  })
  assert.equal(theater.action, 'fadeOut')
})

test('default roll is stable for a local date and skips Christmas outside Nov–Feb', () => {
  const L = loadLib()
  const morning = new Date(2026, 5, 15, 8, 0, 0)
  const evening = new Date(2026, 5, 15, 20, 0, 0)
  assert.equal(L.resolve('default', morning).id, L.resolve('default', evening).id)
  const june = L.defaultPool(morning).map((s) => s.id)
  assert.deepEqual(Array.from(june), [
    'allYear',
    'deepspaceone',
    'secretagent',
    'illstreet',
    'groovesalad',
    'groovesalad2',
    'gsclassic',
  ])
  for (let day = 1; day <= 30; day++) {
    const id = L.resolve('default', d(2026, 6, day)).id
    assert.notEqual(id, 'winter')
    assert.notEqual(id, 'christmas')
  }
  const decPool = L.defaultPool(d(2026, 12, 1)).map((s) => s.id)
  assert.deepEqual(Array.from(decPool).slice(-2), ['winter', 'christmas'])
  const seen = new Set()
  for (let day = 1; day <= 31; day++) {
    seen.add(L.resolve('default', d(2026, 12, day)).id)
  }
  assert.equal(seen.has('winter'), true)
  assert.equal(seen.has('christmas'), true)
})

test('evaluate: default plays the day source, classical stays publicDomain', () => {
  const L = loadLib()
  const now = d(2026, 6, 15)
  const source = L.resolve('default', now)
  const rolled = L.evaluate(SAMPLE, { mode: 'auto', theater: false, now })
  assert.equal(rolled.volume, 0.28)
  if (source.kind === 'radio') {
    assert.equal(rolled.action, 'radio')
    assert.equal(rolled.station, source.id)
  } else {
    assert.equal(rolled.action, 'play')
    assert.equal(rolled.song, 'publicDomain')
    assert.equal(rolled.tracks.length, 2)
    assert.equal(rolled.shuffle, true)
  }

  const classical = L.evaluate(SAMPLE, {
    mode: 'allYear',
    theater: false,
    now: d(2026, 12, 20),
  })
  assert.equal(classical.action, 'play')
  assert.equal(classical.song, 'publicDomain')
})

test('evaluate: winter and Christmas Lounge stay available in June', () => {
  const L = loadLib()
  const winter = L.evaluate(SAMPLE, {
    mode: 'winter',
    theater: false,
    now: d(2026, 6, 15),
  })
  assert.equal(winter.action, 'play')
  assert.equal(winter.song, 'winter')
  assert.deepEqual(Array.from(winter.tracks), ['https://example.com/winter.mp3'])

  const lounge = L.evaluate(SAMPLE, {
    mode: 'christmas',
    theater: false,
    now: d(2026, 6, 15),
  })
  assert.equal(lounge.action, 'radio')
  assert.equal(lounge.station, 'christmas')
})

test('cycleWebMode: off → default → Classical', () => {
  const store = memoryStorage()
  const L = loadLib(store)
  assert.equal(L.readWebMode(), 'off')
  assert.equal(L.cycleWebMode(), 'default')
  assert.equal(L.cycleWebMode(), 'allYear')
  assert.equal(L.MODES.length, 11)
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
  assert.ok(tip.songs.winter?.tracks?.length >= 1)
  assert.ok(tip.state.season.winter)
  for (const songId of Object.keys(tip.songs)) {
    for (const u of tip.songs[songId].tracks) {
      assert.match(u, /^https:\/\/flashbackrepository\.b-cdn\.net\/lobby\//)
      assert.match(u, /\.mp3$/)
    }
  }
  const L = loadLib()
  const now = d(2026, 6, 15)
  const source = L.resolve('auto', now)
  const midyear = L.evaluate(tip, { mode: 'auto', theater: false, now })
  if (source.kind === 'radio') {
    assert.equal(midyear.action, 'radio')
    assert.equal(midyear.station, source.id)
  } else {
    assert.equal(midyear.action, 'play')
    assert.equal(midyear.song, 'publicDomain')
    assert.ok(midyear.tracks.length >= 1)
  }

  const winter = L.evaluate(tip, {
    mode: 'winter',
    theater: false,
    now: d(2026, 6, 15),
  })
  assert.equal(winter.action, 'play')
  assert.equal(winter.song, 'winter')
  assert.ok(winter.tracks.length >= 1)
})

test('readWebMode migrates legacy enabled flag', () => {
  const store = memoryStorage()
  store.setItem('fb-lobby-music-enabled', '1')
  const L = loadLib(store)
  assert.equal(L.readWebMode(), 'default')
  assert.equal(store.getItem('fb-lobby-music-mode'), 'default')
})

test('readWebVolume defaults to 25% and persists', () => {
  const store = memoryStorage()
  const L = loadLib(store)
  assert.equal(L.readWebVolume(), 0.25)
  L.writeWebVolume(0.4)
  assert.equal(L.readWebVolume(), 0.4)
  L.writeWebVolume(80)
  assert.equal(L.readWebVolume(), 0.8)
})

test('LobbyAudio.host.js selects a playlist and volume instead of cycling', () => {
  const audioSrc = fs.readFileSync(
    path.join(dir, '../native/LobbyAudio.host.js'),
    'utf8',
  )
  assert.match(audioSrc, /writeWebMode/)
  assert.match(audioSrc, /readWebMode/)
  assert.match(audioSrc, /readWebVolume/)
  assert.match(audioSrc, /data-fb-lobby-playlist/)
  assert.match(audioSrc, /data-fb-lobby-volume/)
  assert.match(audioSrc, /playBlocked/)
  assert.match(audioSrc, /unlock \/ resume/)
  assert.match(audioSrc, /armGestureUnlock/)
})

test('park-host-common loads lobby host scripts', () => {
  const common = fs.readFileSync(
    path.join(dir, '../native/park-host-common.js'),
    'utf8',
  )
  assert.match(common, /ensureLobbyHostScripts/)
  assert.match(common, /LobbyPlaylist\.js/)
  assert.match(common, /LobbyAudio\.host\.js/)
  assert.match(common, /v=44/)
})

test('registry lists LobbyPlaylist + LobbyAudio', () => {
  const registry = fs.readFileSync(
    path.join(dir, '../native/registry.host.js'),
    'utf8',
  )
  assert.match(registry, /lobby\/LobbyPlaylist\.js/)
  assert.match(registry, /LobbyAudio\.host\.js/)
})
