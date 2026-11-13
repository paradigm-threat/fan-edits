/**
 * Site lobby music. Playlist select + volume live in the header.
 * Local tracks come from lobby.playlist.json. SomaFM stations are public Icecast MP3s.
 * Autoplay waits for a gesture: unlock / resume.
 */
;(function (global) {
  'use strict'

  var PLAYLIST_URL = '/hooks/client/lobby/lobby.playlist.json'
  var CHANNELS_URL = 'https://somafm.com/channels.json'
  var audio = null
  var playlist = null
  var queue = []
  var queueIdx = 0
  var activeKey = ''
  var mirrors = []
  var mirrorIdx = 0
  var channels = null
  var playlistLoading = false
  var started = false

  function lib() {
    return global.FlashbackLobbyPlaylist || null
  }

  function ensureAudio() {
    if (audio) return audio
    audio = global.document.createElement('audio')
    audio.setAttribute('data-fb-lobby-audio', '1')
    audio.preload = 'none'
    audio.addEventListener('ended', function () {
      var L = lib()
      var mode = L ? L.readWebMode() : 'off'
      var source = L ? L.resolve(mode, new Date()) : null
      if (source && source.kind === 'radio') {
        playMirror(mirrorIdx, false)
      } else {
        playIndex(queueIdx + 1, false)
      }
    })
    global.document.body.appendChild(audio)
    audio.addEventListener('error', function () {
      var L = lib()
      var source = L ? L.resolve(L.readWebMode(), new Date()) : null
      if (source && source.kind === 'radio' && mirrors.length) {
        playMirror(mirrorIdx + 1, false)
      } else if (queue.length) {
        playIndex(queueIdx + 1, false)
      }
    })
    return audio
  }

  function playBlocked(err) {
    if (!err) return false
    var name = err.name || ''
    var msg = String(err.message || err)
    return name === 'NotAllowedError' || /play\(\) failed|user gesture|not allowed/i.test(msg)
  }

  /** First pointer or key unlock / resume after a blocked play(). */
  function armGestureUnlock(retry) {
    function once() {
      global.document.removeEventListener('pointerdown', once, true)
      global.document.removeEventListener('keydown', once, true)
      retry()
    }
    global.document.addEventListener('pointerdown', once, true)
    global.document.addEventListener('keydown', once, true)
  }

  function startPlayback(el) {
    var p = el.play()
    if (p && typeof p.then === 'function') {
      p.catch(function (err) {
        if (playBlocked(err)) {
          armGestureUnlock(function () {
            el.play().catch(function () {})
          })
        }
      })
    }
  }

  function setVolume() {
    var L = lib()
    if (!audio || !L) return
    audio.volume = L.readWebVolume()
  }

  function playIndex(i, fromUser) {
    if (!queue.length) return
    queueIdx = ((i % queue.length) + queue.length) % queue.length
    var el = ensureAudio()
    el.loop = false
    el.src = queue[queueIdx]
    setVolume()
    if (fromUser) el.play().catch(function () {})
    else startPlayback(el)
  }

  function playMirror(i, fromUser) {
    if (!mirrors.length) return
    mirrorIdx = ((i % mirrors.length) + mirrors.length) % mirrors.length
    var el = ensureAudio()
    el.loop = false
    el.src = mirrors[mirrorIdx]
    setVolume()
    if (fromUser) el.play().catch(function () {})
    else startPlayback(el)
  }

  function stopAudio() {
    if (!audio) return
    try {
      audio.pause()
    } catch (e) {}
    activeKey = ''
  }

  function parsePls(text) {
    var found = []
    var lines = String(text || '').split('\n')
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim()
      var eq = line.indexOf('=')
      if (eq <= 0) continue
      var key = line.slice(0, eq).trim()
      var value = line.slice(eq + 1).trim()
      if (key.toLowerCase().indexOf('file') !== 0) continue
      var n = parseInt(key.slice(4), 10)
      if (!n || value.indexOf('https://') !== 0) continue
      found.push({ n: n, url: value })
    }
    found.sort(function (a, b) {
      return a.n - b.n
    })
    return found.map(function (x) {
      return x.url
    })
  }

  function httpText(url) {
    return fetch(url, { credentials: 'omit' }).then(function (res) {
      if (!res.ok) throw new Error(String(res.status))
      return res.text()
    })
  }

  function plsFor(id) {
    if (channels) {
      for (var i = 0; i < channels.length; i++) {
        if (channels[i].id === id && channels[i].pls) return Promise.resolve(channels[i].pls)
      }
    }
    return httpText(CHANNELS_URL)
      .then(function (text) {
        var data = JSON.parse(text)
        var list = (data && data.channels) || []
        channels = []
        for (var i = 0; i < list.length; i++) {
          var c = list[i]
          var best = ''
          var rank = 99
          var pls = c.playlists || []
          for (var p = 0; p < pls.length; p++) {
            if (String(pls[p].format || '').toLowerCase() !== 'mp3') continue
            var u = String(pls[p].url || '')
            if (u.indexOf('https://') !== 0) continue
            var q = String(pls[p].quality || '').toLowerCase()
            var r = q === 'highest' ? 0 : q === 'high' ? 1 : 2
            if (r < rank) {
              rank = r
              best = u
            }
          }
          if (c.id && best) channels.push({ id: c.id, pls: best })
        }
        return plsFor(id)
      })
      .catch(function () {
        return 'https://api.somafm.com/' + id + '.pls'
      })
  }

  function loadMirrors(id) {
    return plsFor(id).then(httpText).then(parsePls)
  }

  function refreshNowPlaying(stationId) {
    var node = global.document.querySelector('[data-fb-lobby-now]')
    if (!node) return
    fetch('https://somafm.com/songs/' + stationId + '.json', { credentials: 'omit' })
      .then(function (res) {
        return res.ok ? res.json() : null
      })
      .then(function (data) {
        var song = data && data.songs && data.songs[0]
        if (!song || !song.title) return
        var L = lib()
        var current = L ? L.resolve(L.readWebMode(), new Date()) : null
        if (!current || current.kind !== 'radio' || current.id !== stationId) return
        var artist = song.artist ? String(song.artist) + ' — ' : ''
        node.textContent = artist + song.title
      })
      .catch(function () {})
  }

  function syncCaption(decision) {
    var today = global.document.querySelector('[data-fb-lobby-today]')
    var now = global.document.querySelector('[data-fb-lobby-now]')
    var L = lib()
    if (!L || !today) return
    var mode = L.readWebMode()
    var source = L.resolve(mode, new Date())
    if (mode === 'default' && source) {
      today.hidden = false
      today.textContent = 'Today: ' + source.label
    } else {
      today.hidden = true
      today.textContent = ''
    }
    if (!now) return
    if (decision && decision.action === 'radio' && decision.station) {
      now.hidden = false
      refreshNowPlaying(decision.station)
    } else {
      now.hidden = true
      now.textContent = ''
    }
  }

  function apply(fromUser) {
    var L = lib()
    if (!L || !playlist) return
    if (global.document && global.document.visibilityState === 'hidden') {
      stopAudio()
      return
    }
    var mode = L.readWebMode()
    var decision = L.evaluate(playlist, { mode: mode, theater: false, now: new Date() })
    syncCaption(decision)
    setVolume()
    if (decision.action === 'fadeOut' || decision.action === 'none') {
      stopAudio()
      return
    }
    if (decision.action === 'radio') {
      var key = 'radio:' + decision.station
      if (key === activeKey && audio && !audio.paused) return
      activeKey = key
      queue = []
      loadMirrors(decision.station).then(function (urls) {
        if (activeKey !== key) return
        mirrors = urls
        mirrorIdx = 0
        if (urls.length) playMirror(0, fromUser)
      }).catch(function () {})
      return
    }
    var keyLocal = 'song:' + decision.song
    var tracks = decision.tracks || []
    if (keyLocal === activeKey && audio && !audio.paused) return
    activeKey = keyLocal
    mirrors = []
    queue = decision.shuffle ? L.shuffleCopy(tracks) : tracks.slice()
    queueIdx = 0
    if (queue.length) playIndex(0, fromUser)
  }

  function fillSelect(select) {
    var L = lib()
    if (!L || select.options.length) return
    for (var i = 0; i < L.MODES.length; i++) {
      var id = L.MODES[i]
      var opt = global.document.createElement('option')
      opt.value = id
      opt.textContent = L.modeLabel(id)
      select.appendChild(opt)
    }
    select.value = L.readWebMode()
  }

  function mountControls() {
    var nav = global.document.querySelector('.fb-nav')
    if (!nav || !lib()) return
    if (nav.querySelector('[data-fb-lobby-playlist]')) return
    var L = lib()
    var wrap = global.document.createElement('div')
    wrap.className = 'fb-lobby-music'
    var musicLabel = global.document.createElement('label')
    musicLabel.className = 'fb-lobby-field'
    musicLabel.appendChild(global.document.createTextNode('Music'))
    var select = global.document.createElement('select')
    select.setAttribute('data-fb-lobby-playlist', '1')
    select.setAttribute('aria-label', 'Lobby playlist')
    fillSelect(select)
    select.addEventListener('change', function () {
      L.writeWebMode(select.value)
      activeKey = ''
      apply(true)
    })
    musicLabel.appendChild(select)
    var today = global.document.createElement('span')
    today.className = 'fb-lobby-today'
    today.setAttribute('data-fb-lobby-today', '1')
    today.hidden = true
    var volLabel = global.document.createElement('label')
    volLabel.className = 'fb-lobby-field'
    volLabel.appendChild(global.document.createTextNode('Volume'))
    var range = global.document.createElement('input')
    range.type = 'range'
    range.min = '0'
    range.max = '100'
    range.value = String(Math.round(L.readWebVolume() * 100))
    range.setAttribute('data-fb-lobby-volume', '1')
    range.setAttribute('aria-label', 'Lobby volume')
    range.addEventListener('input', function () {
      L.writeWebVolume(Number(range.value) / 100)
      setVolume()
    })
    volLabel.appendChild(range)
    var now = global.document.createElement('span')
    now.className = 'fb-lobby-now'
    now.setAttribute('data-fb-lobby-now', '1')
    now.hidden = true
    wrap.appendChild(musicLabel)
    wrap.appendChild(today)
    wrap.appendChild(volLabel)
    wrap.appendChild(now)
    nav.appendChild(wrap)
    ensureStyle()
  }

  function ensureStyle() {
    if (global.document.getElementById('fb-lobby-music-css')) return
    var st = global.document.createElement('style')
    st.id = 'fb-lobby-music-css'
    st.textContent = [
      '.fb-lobby-music{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-left:auto}',
      '.fb-lobby-field{display:flex;align-items:center;gap:6px;color:#c4b49a;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase}',
      '.fb-lobby-music select{background:#1a0a0c;color:#f5e6be;border:1px solid #b8860b;padding:4px 8px;font:inherit;text-transform:none;letter-spacing:0;max-width:14rem}',
      '.fb-lobby-music input[type=range]{width:7rem;accent-color:#e8c872}',
      '.fb-lobby-today,.fb-lobby-now{color:#c4b49a;font-size:.82rem;max-width:16rem}',
    ].join('')
    global.document.head.appendChild(st)
  }

  function boot() {
    if (!global.document || !lib()) return
    mountControls()
    if (playlist) {
      if (!started) {
        started = true
        apply(false)
      } else {
        var L = lib()
        syncCaption(
          L.evaluate(playlist, { mode: L.readWebMode(), theater: false, now: new Date() }),
        )
      }
      return
    }
    if (playlistLoading) return
    playlistLoading = true
    fetch(PLAYLIST_URL, { credentials: 'same-origin' })
      .then(function (res) {
        return res.ok ? res.json() : null
      })
      .then(function (json) {
        if (!json) return
        playlist = json
        started = true
        apply(false)
      })
      .catch(function () {})
  }

  function tick() {
    var L = lib()
    if (!L) return
    var source = L.resolve(L.readWebMode(), new Date())
    if (L.readWebMode() === 'default') apply(false)
    else if (source && source.kind === 'radio') refreshNowPlaying(source.id)
  }

  if (global.document) {
    var sched = global.__fbScheduleParkNativeReupgrade
    if (typeof sched === 'function') sched(boot)
    else if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', boot)
    } else {
      boot()
    }
    global.document.addEventListener('visibilitychange', function () {
      if (global.document.visibilityState === 'visible') apply(false)
      else stopAudio()
    })
    global.setInterval(tick, 45000)
  }

  global.FlashbackLobbyAudio = {
    boot: boot,
    apply: apply,
    playBlocked: playBlocked,
    armGestureUnlock: armGestureUnlock,
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
