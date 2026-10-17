/**
 * Lobby OST — background playlist while browsing; fades when theater is active.
 * Web modes (localStorage `fb-lobby-music-mode`): off → auto → all year → winter.
 * Cross-tab: Web Locks (`flashback-lobby-audio`) — only one tab is the audio leader;
 * followers silence locally. Playlist: lobby.playlist.json.
 */
;(function (global) {
  'use strict'

  // Singleton — park-host-common + gateway inject may both load this file.
  if (global.__fbLobbyAudioBooted) return
  global.__fbLobbyAudioBooted = true

  var PLAYLIST_URL = '/hooks/client/lobby/lobby.playlist.json'
  var LOCK_NAME = 'flashback-lobby-audio'
  var BC_NAME = 'flashback-lobby-audio'
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
  /** Exclusive Web Lock holder — only this tab may actually play audio. */
  var isAudioLeader = !!(global.navigator && !global.navigator.locks)
  var lockHoldResolve = null
  var lockClaimed = false
  var otherTabPlaying = false
  var bc = null

  function LP() {
    return global.FlashbackLobbyPlaylist
  }

  function hasLocks() {
    return !!(global.navigator && global.navigator.locks && typeof global.navigator.locks.request === 'function')
  }

  function pauseLocalAudio() {
    clearFade()
    if (!audio) return
    try {
      audio.pause()
    } catch (e) {}
    try {
      audio.volume = 0
    } catch (e2) {}
  }

  function broadcast(msg) {
    try {
      if (bc) bc.postMessage(msg)
    } catch (e) {}
  }

  function releaseLeadership() {
    if (lockHoldResolve) {
      var r = lockHoldResolve
      lockHoldResolve = null
      try {
        r()
      } catch (e) {}
    }
  }

  /**
   * Claim exclusive lock so only one tab plays. Waiters become leader when the
   * previous holder closes / releases. No SharedWorker — HTMLAudio needs the page.
   */
  function claimLeadership() {
    if (!hasLocks()) {
      isAudioLeader = true
      return
    }
    if (lockClaimed) return
    lockClaimed = true
    global.navigator.locks
      .request(LOCK_NAME, function () {
        isAudioLeader = true
        otherTabPlaying = false
        broadcast({ type: 'leader', playing: true })
        applyDecision()
        var lib = LP()
        if (lib) updateButton(lib.readWebMode())
        // Hold until pagehide / explicit release — then another tab may take over.
        return new Promise(function (resolve) {
          lockHoldResolve = resolve
        })
      })
      .then(function () {
        isAudioLeader = false
        lockClaimed = false
        lockHoldResolve = null
        pauseLocalAudio()
        broadcast({ type: 'leader', playing: false })
        var lib = LP()
        if (lib) updateButton(lib.readWebMode())
        // Re-queue if this tab is still open (e.g. brief steal) and music still on.
        if (lib && lib.readWebEnabled() && !(global.document && global.document.hidden)) {
          global.setTimeout(claimLeadership, 50)
        }
      })
      .catch(function () {
        isAudioLeader = false
        lockClaimed = false
        lockHoldResolve = null
      })
  }

  function wireCrossTab() {
    try {
      if (typeof global.BroadcastChannel === 'function') {
        bc = new global.BroadcastChannel(BC_NAME)
        bc.onmessage = function (ev) {
          var d = (ev && ev.data) || {}
          if (d.type === 'leader') {
            if (!isAudioLeader) {
              otherTabPlaying = !!d.playing
              pauseLocalAudio()
              var lib = LP()
              if (lib) updateButton(lib.readWebMode())
            }
          } else if (d.type === 'enabled' || d.type === 'mode') {
            // Another tab toggled music mode — re-evaluate.
            applyDecision()
            var lib2 = LP()
            if (lib2) updateButton(lib2.readWebMode())
          }
        }
      }
    } catch (e) {}
    try {
      global.addEventListener('storage', function (ev) {
        var lib = LP()
        if (!lib || !ev) return
        if (ev.key !== lib.LS_MODE && ev.key !== lib.LS_KEY) return
        playBlocked = false
        applyDecision()
        updateButton(lib.readWebMode())
      })
    } catch (e2) {}
    try {
      global.addEventListener('pagehide', function () {
        releaseLeadership()
      })
    } catch (e3) {}
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
    if (!isAudioLeader) return
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
        broadcast({ type: 'leader', playing: true })
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
      var mode = lib.readWebMode()
      var enabled = mode !== 'off'
      var dec = lib.evaluate(playlist, {
        mode: mode,
        theater: theater,
      })
      targetVol = dec.volume
      updateButton(mode)
      // Follower tabs never start audio — leader holds Web Lock.
      if (!isAudioLeader) {
        pauseLocalAudio()
        if (enabled) otherTabPlaying = true
        return
      }
      if (dec.action === 'fadeOut' || !enabled) {
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

  function updateButton(mode) {
    var lib = LP()
    var m = mode
    if (m == null && lib) m = lib.readWebMode()
    m = (lib && lib.normalizeMode ? lib.normalizeMode(m) : m) || 'off'
    var enabled = m !== 'off'
    var modeText =
      lib && lib.modeLabel ? lib.modeLabel(m) : m === 'allYear' ? 'all year' : m
    var nodes = global.document.querySelectorAll('[data-fb-lobby-music]')
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      el.setAttribute('aria-pressed', enabled ? 'true' : 'false')
      el.setAttribute('data-fb-lobby-mode', m)
      var label = 'Lobby music: ' + modeText
      if (enabled) {
        if (!isAudioLeader || otherTabPlaying) {
          label = 'Lobby music: ' + modeText + ' (other tab)'
        } else if (playBlocked) {
          label = 'Lobby music: ' + modeText + ' (tap)'
        }
      }
      el.textContent = label
      if (enabled) el.classList.add('fb-lobby-on')
      else el.classList.remove('fb-lobby-on')
    }
    btn = nodes.length ? nodes[0] : null
  }

  function setMode(mode) {
    var lib = LP()
    if (!lib) return
    var next = lib.normalizeMode(mode)
    lib.writeWebMode(next)
    playBlocked = false
    broadcast({ type: 'mode', mode: next })
    if (next !== 'off') claimLeadership()
    else {
      pauseLocalAudio()
      releaseLeadership()
    }
    applyDecision()
  }

  function setEnabled(on) {
    setMode(on ? 'auto' : 'off')
  }

  function toggle() {
    var lib = LP()
    if (!lib) return
    var next = lib.cycleWebMode()
    playBlocked = false
    broadcast({ type: 'mode', mode: next })
    if (next !== 'off') {
      ensureAudio()
      claimLeadership()
    } else {
      pauseLocalAudio()
      releaseLeadership()
    }
    applyDecision()
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
        // On + leader + not audibly playing → unlock / resume without cycling.
        // Follower tabs (other tab holds Web Lock) turn off.
        if (lib.readWebEnabled()) {
          if (!isAudioLeader) {
            setMode('off')
            return
          }
          var a = audio
          if (playBlocked || !a || a.paused) {
            retryPlayFromGesture()
            return
          }
        }
        toggle()
      })
    }
    var lib = LP()
    updateButton(lib ? lib.readWebMode() : 'off')
  }

  function syncUi() {
    wireButton()
    var lib = LP()
    if (lib) updateButton(lib.readWebMode())
  }

  function onNavigate() {
    try {
      var path = (global.location && global.location.pathname) || '/'
      if (path === '/') setTheater(false)
    } catch (e) {}
  }

  function boot() {
    wireCrossTab()
    syncUi()
    loadPlaylist()
    onNavigate()
    // Persisted "on" still needs a user gesture after reload (autoplay policy).
    try {
      var lib = LP()
      if (lib && lib.readWebEnabled()) {
        playBlocked = true
        armGestureUnlock()
        updateButton(lib.readWebMode())
        claimLeadership()
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
    setMode: setMode,
    toggle: toggle,
    apply: applyDecision,
    syncUi: syncUi,
    isEnabled: function () {
      var lib = LP()
      return !!(lib && lib.readWebEnabled())
    },
    mode: function () {
      var lib = LP()
      return lib ? lib.readWebMode() : 'off'
    },
    isAudioLeader: function () {
      return !!isAudioLeader
    },
  }
})(typeof globalThis !== 'undefined' ? globalThis : this)
