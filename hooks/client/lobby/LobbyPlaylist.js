/**
 * flashback-logical-playlist/v1 — shared evaluator (web + documentation mirror).
 * SongWalker-inspired: nested songs, host state, when rules.
 */
;(function (global) {
  'use strict'

  var LS_KEY = 'fb-lobby-music-enabled'

  function pad2(n) {
    return n < 10 ? '0' + n : String(n)
  }

  /** @returns {'christmas'|'default'} */
  function calendarSeason(now, christmas) {
    var d = now || new Date()
    var start = (christmas && christmas.start) || '11-15'
    var end = (christmas && christmas.end) || '01-02'
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
      return md >= s || md <= e ? 'christmas' : 'default'
    }
    return md >= s && md <= e ? 'christmas' : 'default'
  }

  function readWebEnabled() {
    try {
      var v = global.localStorage && global.localStorage.getItem(LS_KEY)
      return v === '1' || v === 'true'
    } catch (e) {
      return false
    }
  }

  function writeWebEnabled(on) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(LS_KEY, on ? '1' : '0')
      }
    } catch (e) {}
  }

  /**
   * Evaluate a simple when-if expression against host state.
   * Supported atoms: enabled, theater, season == christmas|…
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
   * @param {{ enabled: boolean, theater: boolean, now?: Date }} host
   * @returns {{ action: 'fadeOut'|'play'|'none', song?: string, ms?: number, volume: number, fadeInMs: number, fadeOutMs: number, tracks?: string[], loop?: boolean, shuffle?: boolean }}
   */
  function evaluate(playlist, host) {
    var pl = playlist || {}
    var christmasCfg =
      (pl.state && pl.state.season && pl.state.season.christmas) || {}
    var season =
      calendarSeason(host && host.now, christmasCfg) === 'christmas'
        ? 'christmas'
        : 'default'
    var st = {
      enabled: !!(host && host.enabled),
      theater: !!(host && host.theater),
      season: season,
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
        }
      }
      if (rule.do === 'play') {
        var songId = rule.song || pl.defaultSong || 'publicDomain'
        var song = (pl.songs && pl.songs[songId]) || {}
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
        }
      }
    }
    return {
      action: 'none',
      volume: volume,
      fadeInMs: fadeInMs,
      fadeOutMs: fadeOutMs,
      season: season,
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
    LS_KEY: LS_KEY,
    calendarSeason: calendarSeason,
    readWebEnabled: readWebEnabled,
    writeWebEnabled: writeWebEnabled,
    evaluate: evaluate,
    shuffleCopy: shuffleCopy,
    pad2: pad2,
  }
})(typeof globalThis !== 'undefined' ? globalThis : this)
