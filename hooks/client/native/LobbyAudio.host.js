/**
 * Lobby OST — background playlist while browsing; fades when theater is active.
 * Web: off until user taps Lobby music (autoplay gesture unlock); choice in localStorage.
 * Playlist: /hooks/client/lobby/lobby.playlist.json + LobbyPlaylist.js
 */
;(function (global) {
  'use strict'

  // Singleton — park-host-common + gateway inject may both load this file.
  if (global.__fbLobbyAudioBooted) return
  global.__fbLobbyAudioBooted = true

  var PLAYLIST_URL = '/hooks/client/lobby/lobby.playlist.json'
  var playlist = null
  var audio = null
  var queue = []
  var queueIdx = 0
  var activeSong = ''
  var theater = false
  var fadeTimer = null
  var targetVol = 0.28
  var applying = false
  var btn = null
  var unlockArmed = false
  var playBlocked = false

  function LP() {
    return global.FlashbackLobbyPlaylist
  }

  function ensureAudio() {
    if (audio) return audio
    audio = global.document.createElement('audio')
    audio.setAttribute('playsinline', 'playsinline')
    audio.preload = 'metadata'
    audio.style.display = 'none'
    audio.addEventListener('ended', function () {
      advance(1)
    })
    audio.addEventListener('error', function () {
      advance(1)
    })
    try {
      global.document.body.appendChild(audio)
    } catch (e) {}
    return audio
  }

  function clearFade() {
    if (fadeTimer) {
      global.clearInterval(fadeTimer)
      fadeTimer = null
    }
  }

  function fadeTo(vol, ms, onDone) {
    var a = ensureAudio()
    clearFade()
    var start = a.volume
    var end = Math.max(0, Math.min(1, vol))
    var dur = Math.max(16, ms || 800)
    var t0 = Date.now()
    if (Math.abs(start - end) < 0.01) {
      a.volume = end
      if (end <= 0.001) {
        try {
          a.pause()
        } catch (e) {}
      }
      if (onDone) onDone()
      return
    }
    fadeTimer = global.setInterval(function () {
      var u = Math.min(1, (Date.now() - t0) / dur)
      a.volume = start + (end - start) * u
      if (u >= 1) {
        clearFade()
        a.volume = end
        if (end <= 0.001) {
          try {
            a.pause()
          } catch (e2) {}
        }
        if (onDone) onDone()
      }
    }, 32)
  }

  function advance(delta) {
    if (!queue.length) return
    queueIdx = (queueIdx + delta + queue.length) % queue.length
    playIndex(queueIdx, false)
  }

  function armGestureUnlock() {
    if (unlockArmed) return
    unlockArmed = true
    var once = function () {
      global.document.removeEventListener('pointerdown', once, true)
      global.document.removeEventListener('keydown', once, true)
      unlockArmed = false
      var lib = LP()
      if (!lib || !lib.readWebEnabled()) return
      retryPlayFromGesture()
    }
    global.document.addEventListener('pointerdown', once, true)
    global.document.addEventListener('keydown', once, true)
  }

  function playIndex(i, fadeIn) {
    if (!queue.length) return
    queueIdx = ((i % queue.length) + queue.length) % queue.length
    var url = queue[queueIdx]
    var a = ensureAudio()
    if (a.src !== url) {
      a.src = url
      try {
        a.load()
      } catch (e) {}
    }
    try {
      var next = queue[(queueIdx + 1) % queue.length]
      if (next && next !== url) {
        var link = global.document.createElement('link')
        link.rel = 'prefetch'
        link.as = 'audio'
        link.href = next
        global.document.head.appendChild(link)
      }
    } catch (e3) {}
    var startVol = fadeIn ? 0 : targetVol
    a.volume = startVol
    var p = a.play()
    if (p && typeof p.then === 'function') {
      p.then(function () {
        playBlocked = false
        if (fadeIn) fadeTo(targetVol, (playlist && playlist.fadeInMs) || 1200)
      }).catch(function () {
        playBlocked = true
        armGestureUnlock()
      })
    } else if (fadeIn) {
      fadeTo(targetVol, (playlist && playlist.fadeInMs) || 1200)
    }
  }

  function applyDecision() {
    var lib = LP()
    if (!lib || !playlist || applying) return
    applying = true
    try {
      var enabled = lib.readWebEnabled()
      var dec = lib.evaluate(playlist, {
        enabled: enabled,
        theater: theater,
      })
      targetVol = dec.volume
      updateButton(enabled)
      if (dec.action === 'fadeOut') {
        fadeTo(0, dec.ms || dec.fadeOutMs)
        return
      }
      if (dec.action === 'play') {
        var tracks = dec.tracks || []
        if (!tracks.length) {
          fadeTo(0, dec.fadeOutMs)
          return
        }
        var needRebuild =
          dec.song !== activeSong || queue.length !== tracks.length
        if (needRebuild) {
          activeSong = dec.song || ''
          queue = dec.shuffle
            ? lib.shuffleCopy(tracks)
            : tracks.slice()
          queueIdx = 0
          playIndex(0, true)
        } else {
          var a = ensureAudio()
          if (a.paused || playBlocked) {
            playIndex(queueIdx, true)
          } else if (a.volume < targetVol * 0.9) {
            fadeTo(targetVol, dec.fadeInMs)
          }
        }
      }
    } finally {
      applying = false
    }
  }

  function updateButton(enabled) {
    var nodes = global.document.querySelectorAll('[data-fb-lobby-music]')
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      el.setAttribute('aria-pressed', enabled ? 'true' : 'false')
      el.textContent = enabled
        ? playBlocked
          ? 'Lobby music: on (tap)'
          : 'Lobby music: on'
        : 'Lobby music'
      if (enabled) el.classList.add('fb-lobby-on')
      else el.classList.remove('fb-lobby-on')
    }
    btn = nodes.length ? nodes[0] : null
  }

  function setEnabled(on) {
    var lib = LP()
    if (!lib) return
    lib.writeWebEnabled(!!on)
    playBlocked = false
    applyDecision()
  }

  function toggle() {
    var lib = LP()
    if (!lib) return
    var next = !lib.readWebEnabled()
    setEnabled(next)
    if (next) {
      // Explicit gesture unlock
      playBlocked = false
      ensureAudio()
      applyDecision()
    }
  }

  function setTheater(on) {
    theater = !!on
    applyDecision()
  }

  function loadPlaylist() {
    if (!global.fetch) return
    global
      .fetch(PLAYLIST_URL, { credentials: 'omit', cache: 'no-store' })
      .then(function (r) {
        return r && r.ok ? r.json() : null
      })
      .then(function (j) {
        if (!j) return
        playlist = j
        applyDecision()
      })
      .catch(function () {})
  }

  function retryPlayFromGesture() {
    playBlocked = false
    ensureAudio()
    applyDecision()
  }

  function wireButton() {
    var nodes = global.document.querySelectorAll('[data-fb-lobby-music]')
    if (!nodes.length) return
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      if (el.getAttribute('data-fb-lobby-wired') === '1') continue
      el.setAttribute('data-fb-lobby-wired', '1')
      el.addEventListener('click', function (ev) {
        ev.preventDefault()
        var lib = LP()
        if (!lib) return
        // Enabled + not audibly playing → this click is the unlock / resume
        // gesture (document pointerdown may already have cleared playBlocked).
        if (lib.readWebEnabled()) {
          var a = audio
          if (playBlocked || !a || a.paused) {
            retryPlayFromGesture()
            return
          }
          setEnabled(false)
          return
        }
        setEnabled(true)
      })
    }
    var lib = LP()
    updateButton(lib ? lib.readWebEnabled() : false)
  }

  function syncUi() {
    wireButton()
    var lib = LP()
    if (lib) updateButton(lib.readWebEnabled())
  }

  function onNavigate() {
    try {
      var path = (global.location && global.location.pathname) || '/'
      if (path === '/') setTheater(false)
    } catch (e) {}
  }

  function boot() {
    syncUi()
    loadPlaylist()
    onNavigate()
    // Persisted "on" still needs a user gesture after reload (autoplay policy).
    try {
      var lib = LP()
      if (lib && lib.readWebEnabled()) {
        playBlocked = true
        armGestureUnlock()
        updateButton(true)
      }
    } catch (e) {}
    global.addEventListener('fb-lobby-theater', function (ev) {
      var d = (ev && ev.detail) || {}
      setTheater(!!d.theater)
    })
    global.addEventListener('popstate', onNavigate)
    global.setInterval(function () {
      applyDecision()
    }, 60 * 60 * 1000)
    var sched = global.__fbScheduleParkNativeReupgrade
    if (typeof sched === 'function') {
      sched(syncUi)
    }
  }

  if (global.document && global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot)
  } else {
    global.setTimeout(boot, 0)
  }

  global.FlashbackLobbyAudio = {
    setTheater: setTheater,
    setEnabled: setEnabled,
    toggle: toggle,
    apply: applyDecision,
    syncUi: syncUi,
    isEnabled: function () {
      var lib = LP()
      return !!(lib && lib.readWebEnabled())
    },
  }
})(typeof globalThis !== 'undefined' ? globalThis : this)
