/**
 * flashback-logical-playlist/v1 — web lobby music.
 *
 * Menu (localStorage `fb-lobby-music-mode`):
 *   off | default | allYear | winter | SomaFM station ids
 * **default** hashes the local date. Year-round: Classical, Deep Space One,
 * Secret Agent, Illinois Street Lounge, Groove Salad, Groove Salad 2,
 * Groove Salad Classic. November–February also include Winter and Christmas Lounge.
 * An explicit choice ignores that roll until the user selects Default again.
 * Volume (localStorage `fb-lobby-volume`): 0–1, default 0.25.
 * Legacy `auto` / `fb-lobby-music-enabled` migrates to default/off.
 * Unset storage stays off (no autoplay for a first visit).
 */
;(function (global) {
  'use strict'

  var LS_MODE = 'fb-lobby-music-mode'
  var LS_VOLUME = 'fb-lobby-volume'
  var LS_ENABLED_LEGACY = 'fb-lobby-music-enabled'
  var DEFAULT_VOLUME = 0.25

  var CLASSICAL = {
    id: 'allYear',
    label: 'Classical',
    kind: 'local',
    songId: 'publicDomain',
  }
  var WINTER = {
    id: 'winter',
    label: 'Winter',
    kind: 'local',
    songId: 'winter',
    christmas: true,
  }
  var DEEP_SPACE = { id: 'deepspaceone', label: 'Deep Space One', kind: 'radio' }
  var SECRET_AGENT = { id: 'secretagent', label: 'Secret Agent', kind: 'radio' }
  var CHRISTMAS_LOUNGE = {
    id: 'christmas',
    label: 'Christmas Lounge',
    kind: 'radio',
    christmas: true,
  }
  var ILLINOIS = {
    id: 'illstreet',
    label: 'Illinois Street Lounge',
    kind: 'radio',
  }
  var GROOVE_SALAD = { id: 'groovesalad', label: 'Groove Salad', kind: 'radio' }
  var GROOVE_SALAD_2 = { id: 'groovesalad2', label: 'Groove Salad 2', kind: 'radio' }
  var GROOVE_SALAD_CLASSIC = {
    id: 'gsclassic',
    label: 'Groove Salad Classic',
    kind: 'radio',
  }

  var SOURCES = [
    CLASSICAL,
    WINTER,
    DEEP_SPACE,
    SECRET_AGENT,
    CHRISTMAS_LOUNGE,
    ILLINOIS,
    GROOVE_SALAD,
    GROOVE_SALAD_2,
    GROOVE_SALAD_CLASSIC,
  ]
  var YEAR_ROUND = [
    CLASSICAL,
    DEEP_SPACE,
    SECRET_AGENT,
    ILLINOIS,
    GROOVE_SALAD,
    GROOVE_SALAD_2,
    GROOVE_SALAD_CLASSIC,
  ]
  var CHRISTMAS_SOURCES = [WINTER, CHRISTMAS_LOUNGE]
  var MODES = ['off', 'default'].concat(
    SOURCES.map(function (s) {
      return s.id
    }),
  )

  function normalizeMode(m) {
    var s = String(m || '').trim()
    if (s === 'off' || s === '0' || s === 'false' || s === '') return 'off'
    if (
      s === 'default' ||
      s === 'auto' ||
      s === 'on' ||
      s === 'true' ||
      s === '1' ||
      s === 'somafm' ||
      s === 'soma' ||
      s === 'radio'
    ) {
      return 'default'
    }
    if (s === 'allYear' || s === 'all' || s === 'all-year' || s === 'year' || s === 'classical') {
      return 'allYear'
    }
    if (s === 'winter' || s === 'holiday' || s === 'xmas') return 'winter'
    if (s === 'deepspaceone' || s === 'deep space one') return 'deepspaceone'
    if (s === 'secretagent' || s === 'secret agent') return 'secretagent'
    if (s === 'christmas' || s === 'christmas lounge' || s === 'christmaslounge') {
      return 'christmas'
    }
    if (s === 'illstreet' || s === 'illinois' || s === 'illinois street lounge') {
      return 'illstreet'
    }
    if (s === 'groovesalad' || s === 'groove salad') return 'groovesalad'
    if (s === 'groovesalad2' || s === 'groove salad 2') return 'groovesalad2'
    if (s === 'gsclassic' || s === 'groove salad classic') return 'gsclassic'
    return 'off'
  }

  function christmasWindow(now) {
    var d = now || new Date()
    var month = d.getMonth()
    return month === 10 || month === 11 || month === 0 || month === 1
  }

  function defaultPool(now) {
    return christmasWindow(now) ? YEAR_ROUND.concat(CHRISTMAS_SOURCES) : YEAR_ROUND.slice()
  }

  function dayKey(now) {
    var d = now || new Date()
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
  }

  /** Step 17 is coprime to pool sizes 7 and 9. */
  function dayIndex(now, size) {
    if (size <= 1) return 0
    return (dayKey(now) * 17 + 3) % size
  }

  function resolve(mode, now) {
    var m = normalizeMode(mode)
    if (m === 'off') return null
    if (m === 'default') {
      var options = defaultPool(now)
      return options[dayIndex(now, options.length)]
    }
    for (var i = 0; i < SOURCES.length; i++) {
      if (SOURCES[i].id === m) return SOURCES[i]
    }
    return null
  }

  function readWebMode() {
    try {
      if (!global.localStorage) return 'off'
      var m = global.localStorage.getItem(LS_MODE)
      if (m != null && String(m).length) return normalizeMode(m)
      var legacy = global.localStorage.getItem(LS_ENABLED_LEGACY)
      if (legacy === '1' || legacy === 'true') {
        writeWebMode('default')
        return 'default'
      }
      if (legacy === '0' || legacy === 'false') {
        writeWebMode('off')
        return 'off'
      }
      return 'off'
    } catch (e) {
      return 'off'
    }
  }

  function clampVolume(v) {
    var n = Number(v)
    if (n > 1 && n <= 100) n = n / 100
    if (!(n >= 0)) return DEFAULT_VOLUME
    if (n > 1) return 1
    return n
  }

  function readWebVolume() {
    try {
      if (!global.localStorage) return DEFAULT_VOLUME
      var raw = global.localStorage.getItem(LS_VOLUME)
      if (raw == null || String(raw).length === 0) return DEFAULT_VOLUME
      return clampVolume(raw)
    } catch (e) {
      return DEFAULT_VOLUME
    }
  }

  function writeWebVolume(v) {
    try {
      if (global.localStorage) {
        var n = clampVolume(v)
        global.localStorage.setItem(LS_VOLUME, String(Math.round(n * 100) / 100))
      }
    } catch (e) {}
  }

  function writeWebMode(mode) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(LS_MODE, normalizeMode(mode))
      }
    } catch (e) {}
  }

  function cycleWebMode() {
    var cur = readWebMode()
    var idx = MODES.indexOf(cur)
    if (idx < 0) idx = 0
    var next = MODES[(idx + 1) % MODES.length]
    writeWebMode(next)
    return next
  }

  function readWebEnabled() {
    return readWebMode() !== 'off'
  }

  function writeWebEnabled(on) {
    writeWebMode(on ? 'default' : 'off')
  }

  function modeLabel(mode) {
    var m = normalizeMode(mode)
    if (m === 'off') return 'Off'
    if (m === 'default') return 'Default'
    var src = resolve(m)
    return src ? src.label : 'Off'
  }

  function tracksFor(playlist, songId) {
    var songs = (playlist && playlist.songs) || {}
    var song = songs[songId] || (songId === 'winter' ? songs.christmas : null) || {}
    var raw = song.tracks || []
    var tracks = []
    for (var i = 0; i < raw.length; i++) {
      var u = String(raw[i] || '').trim()
      if (u.indexOf('http') === 0) tracks.push(u)
    }
    return { song: song, tracks: tracks }
  }

  /**
   * @param {object} playlist
   * @param {{ mode?: string, enabled?: boolean, theater: boolean, now?: Date }} host
   */
  function evaluate(playlist, host) {
    var pl = playlist || {}
    var mode =
      host && host.mode != null
        ? normalizeMode(host.mode)
        : host && host.enabled === false
          ? 'off'
          : host && host.enabled
            ? 'default'
            : 'off'
    var now = host && host.now
    var theater = !!(host && host.theater)
    var volume = typeof pl.volume === 'number' ? pl.volume : 0.25
    var fadeInMs = typeof pl.fadeInMs === 'number' ? pl.fadeInMs : 1200
    var fadeOutMs = typeof pl.fadeOutMs === 'number' ? pl.fadeOutMs : 800
    var base = {
      volume: volume,
      fadeInMs: fadeInMs,
      fadeOutMs: fadeOutMs,
      ms: fadeOutMs,
      mode: mode,
    }
    if (mode === 'off' || theater) {
      base.action = 'fadeOut'
      return base
    }
    var source = resolve(mode, now)
    if (!source) {
      base.action = 'none'
      return base
    }
    if (source.kind === 'radio') {
      base.action = 'radio'
      base.station = source.id
      base.label = source.label
      return base
    }
    var loaded = tracksFor(pl, source.songId)
    base.action = 'play'
    base.song = source.songId
    base.tracks = loaded.tracks
    base.loop = loaded.song.loop !== false
    base.shuffle = !!loaded.song.shuffle
    base.label = source.label
    return base
  }

  function shuffleCopy(arr, seed) {
    var a = arr.slice()
    var s = typeof seed === 'number' ? seed : Date.now()
    for (var i = a.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0
      var j = s % (i + 1)
      var tmp = a[i]
      a[i] = a[j]
      a[j] = tmp
    }
    return a
  }

  global.FlashbackLobbyPlaylist = {
    LS_KEY: LS_ENABLED_LEGACY,
    LS_MODE: LS_MODE,
    LS_VOLUME: LS_VOLUME,
    DEFAULT_VOLUME: DEFAULT_VOLUME,
    MODES: MODES,
    SOURCES: SOURCES,
    normalizeMode: normalizeMode,
    modeLabel: modeLabel,
    christmasWindow: christmasWindow,
    defaultPool: defaultPool,
    dayIndex: dayIndex,
    resolve: resolve,
    readWebMode: readWebMode,
    writeWebMode: writeWebMode,
    readWebVolume: readWebVolume,
    writeWebVolume: writeWebVolume,
    clampVolume: clampVolume,
    cycleWebMode: cycleWebMode,
    readWebEnabled: readWebEnabled,
    writeWebEnabled: writeWebEnabled,
    evaluate: evaluate,
    shuffleCopy: shuffleCopy,
  }
})(typeof globalThis !== 'undefined' ? globalThis : this)
