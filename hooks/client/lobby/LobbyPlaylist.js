/**
 * flashback-logical-playlist/v1 — shared evaluator (web + documentation mirror).
 * SongWalker-inspired: nested songs, host state, when rules.
 *
 * Music mode (localStorage `fb-lobby-music-mode`):
 *   off | auto | allYear | winter
 * Volume (localStorage `fb-lobby-volume`): 0–1, default 0.25.
 * Legacy `fb-lobby-music-enabled` migrates to auto/off.
 */
;(function (global) {
  'use strict'

  var LS_MODE = 'fb-lobby-music-mode'
  var LS_VOLUME = 'fb-lobby-volume'
  var LS_ENABLED_LEGACY = 'fb-lobby-music-enabled'
  var DEFAULT_VOLUME = 0.25
  var MODES = ['off', 'auto', 'allYear', 'winter']

  function pad2(n) {
    return n < 10 ? '0' + n : String(n)
  }

  function normalizeMode(m) {
    var s = String(m || '').trim()
    if (s === 'off' || s === '0' || s === 'false') return 'off'
    if (s === 'auto' || s === 'on' || s === 'true' || s === '1') return 'auto'
    if (s === 'allYear' || s === 'all' || s === 'all-year' || s === 'year') {
      return 'allYear'
    }
    if (
      s === 'winter' ||
      s === 'christmas' ||
      s === 'holiday' ||
      s === 'xmas'
    ) {
      return 'winter'
    }
    return 'off'
  }

  /** @returns {'winter'|'default'} */
  function calendarSeason(now, winter) {
    var d = now || new Date()
    var start = (winter && winter.start) || '10-15'
    var end = (winter && winter.end) || '01-02'
    var sp = start.split('-')
    var ep = end.split('-')
    var sm = parseInt(sp[0], 10)
    var sd = parseInt(sp[1], 10)
    var em = parseInt(ep[0], 10)
    var ed = parseInt(ep[1], 10)
    var md = (d.getMonth() + 1) * 100 + d.getDate()
    var s = sm * 100 + sd
    var e = em * 100 + ed
    // Range wraps year (Nov → Jan)
    if (s > e) {
      return md >= s || md <= e ? 'winter' : 'default'
    }
    return md >= s && md <= e ? 'winter' : 'default'
  }

  function effectiveSeason(mode, calSeason) {
    mode = normalizeMode(mode)
    if (mode === 'winter') return 'winter'
    if (mode === 'allYear') return 'default'
    if (mode === 'auto') return calSeason
    return 'default'
  }

  function readWebMode() {
    try {
      if (!global.localStorage) return 'off'
      var m = global.localStorage.getItem(LS_MODE)
      if (m != null && String(m).length) return normalizeMode(m)
      var legacy = global.localStorage.getItem(LS_ENABLED_LEGACY)
      if (legacy === '1' || legacy === 'true') {
        writeWebMode('auto')
        return 'auto'
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
    writeWebMode(on ? 'auto' : 'off')
  }

  function modeLabel(mode) {
    switch (normalizeMode(mode)) {
      case 'off':
        return 'off'
      case 'auto':
        return 'auto'
      case 'allYear':
        return 'all year'
      case 'winter':
        return 'winter'
      default:
        return 'off'
    }
  }

  /**
   * Evaluate a simple when-if expression against host state.
   * Supported atoms: enabled, theater, season == winter|…
   * Prefix ! for negation; && / || for combine.
   */
  function evalIf(expr, st) {
    if (!expr || typeof expr !== 'string') return false
    var partsOr = expr.split(/\s*\|\|\s*/)
    for (var oi = 0; oi < partsOr.length; oi++) {
      var andOk = true
      var partsAnd = partsOr[oi].split(/\s*&&\s*/)
      for (var ai = 0; ai < partsAnd.length; ai++) {
        var t = partsAnd[ai].trim()
        if (!t) continue
        var neg = false
        if (t.charAt(0) === '!') {
          neg = true
          t = t.slice(1).trim()
        }
        var ok = false
        if (t === 'enabled') ok = !!st.enabled
        else if (t === 'theater') ok = !!st.theater
        else if (/^season\s*==\s*/.test(t)) {
          var want = t.replace(/^season\s*==\s*/, '').trim()
          if (want === 'christmas') want = 'winter'
          ok = st.season === want
        } else {
          ok = false
        }
        if (neg) ok = !ok
        if (!ok) {
          andOk = false
          break
        }
      }
      if (andOk) return true
    }
    return false
  }

  /**
   * @param {object} playlist
   * @param {{ mode?: string, enabled?: boolean, theater: boolean, now?: Date }} host
   */
  function evaluate(playlist, host) {
    var pl = playlist || {}
    var seasonRoot = (pl.state && pl.state.season) || {}
    var winterCfg = seasonRoot.winter || seasonRoot.christmas || {}
    var calSeason = calendarSeason(host && host.now, winterCfg)
    var mode =
      host && host.mode != null
        ? normalizeMode(host.mode)
        : host && host.enabled === false
          ? 'off'
          : host && host.enabled
            ? 'auto'
            : 'off'
    var season = effectiveSeason(mode, calSeason)
    var st = {
      enabled: mode !== 'off',
      theater: !!(host && host.theater),
      season: season,
      mode: mode,
    }
    var volume = typeof pl.volume === 'number' ? pl.volume : 0.28
    var fadeInMs = typeof pl.fadeInMs === 'number' ? pl.fadeInMs : 1200
    var fadeOutMs = typeof pl.fadeOutMs === 'number' ? pl.fadeOutMs : 800
    var when = pl.when || []
    for (var i = 0; i < when.length; i++) {
      var rule = when[i]
      if (!rule || !evalIf(rule.if, st)) continue
      if (rule.do === 'fadeOut') {
        return {
          action: 'fadeOut',
          ms: typeof rule.ms === 'number' ? rule.ms : fadeOutMs,
          volume: volume,
          fadeInMs: fadeInMs,
          fadeOutMs: fadeOutMs,
          season: season,
          mode: mode,
        }
      }
      if (rule.do === 'play') {
        var songId = rule.song || pl.defaultSong || 'publicDomain'
        if (songId === 'christmas') songId = 'winter'
        var songs = pl.songs || {}
        var song = songs[songId] || (songId === 'winter' ? songs.christmas : null) || {}
        return {
          action: 'play',
          song: songId,
          tracks: song.tracks || [],
          loop: song.loop !== false,
          shuffle: !!song.shuffle,
          volume: volume,
          fadeInMs: fadeInMs,
          fadeOutMs: fadeOutMs,
          season: season,
          mode: mode,
        }
      }
    }
    return {
      action: 'none',
      volume: volume,
      fadeInMs: fadeInMs,
      fadeOutMs: fadeOutMs,
      season: season,
      mode: mode,
    }
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
    calendarSeason: calendarSeason,
    effectiveSeason: effectiveSeason,
    normalizeMode: normalizeMode,
    modeLabel: modeLabel,
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
    pad2: pad2,
  }
})(typeof globalThis !== 'undefined' ? globalThis : this)
