/**
 * Web host for `fb-theater-player`: HTML5 video, seed/inspect chrome, external command props.
 * Polls `?relayAssetStatus=1` while unlocked so unseeded titles show live progress / fail UI.
 */
(function (global) {
  'use strict';

  function prop(props, key, fallback) {
    if (!props) return fallback;
    const keys = [key];
    if (key.indexOf('data-') !== 0) {
      keys.push('data-' + key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()));
    }
    for (let i = 0; i < keys.length; i++) {
      const v = props[keys[i]];
      if (v == null) continue;
      if (typeof v === 'object' && v !== null && 'value' in v) {
        return v.value != null ? String(v.value) : fallback;
      }
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      if (typeof v === 'number') return String(v);
      return String(v);
    }
    return fallback;
  }

  function propHandler(props, key) {
    if (!props) return null;
    const v = props[key];
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object' && typeof v.value === 'number') return v.value;
    return null;
  }

  function invoke(id, invokeHandler, onAfterInvoke) {
    if (id == null || typeof invokeHandler !== 'function') return;
    try {
      invokeHandler(id);
    } catch (_) {}
    if (typeof onAfterInvoke === 'function') {
      try {
        onAfterInvoke();
      } catch (_) {}
    }
  }

  /** Tiny CIDs are almost always symlink-path stubs from a bad ingest, not playable video. */
  const STUB_BYTES_MAX = 100000;
  const DEFAULT_REPO = 'fan-edits';
  const DEFAULT_PEER_FQDNS = [
    'iad1.relaygateway.net',
    'ord1.relaygateway.net',
    'hkg1.relaygateway.net',
  ];

  function formatBytes(n) {
    if (n == null || typeof n !== 'number' || !(n >= 0)) return '';
    if (n < 1000) return n + ' B';
    if (n < 1000000) return (n / 1000).toFixed(1) + ' KB';
    if (n < 1000000000) return (n / 1000000).toFixed(1) + ' MB';
    return (n / 1000000000).toFixed(2) + ' GB';
  }

  function peerShort(fqdn) {
    const s = String(fqdn || '');
    const i = s.indexOf('.');
    return i > 0 ? s.slice(0, i) : s || 'mirror';
  }

  function encodeLogicalPath(path) {
    return String(path || '')
      .replace(/^\/+/, '')
      .split('/')
      .filter(function (p) {
        return p.length > 0;
      })
      .map(encodeURIComponent)
      .join('/');
  }

  function logicalPathFromSrc(src) {
    try {
      const u = new global.URL(src, global.location.href);
      return decodeURIComponent(String(u.pathname || '').replace(/^\/+/, ''));
    } catch (_) {
      return String(src || '')
        .split('?')[0]
        .replace(/^\/+/, '');
    }
  }

  function buildMirrorList(logicalPath, peerFqdns) {
    const enc = encodeLogicalPath(logicalPath);
    const peers = peerFqdns && peerFqdns.length ? peerFqdns : DEFAULT_PEER_FQDNS;
    const out = [];
    const seen = {};
    function add(label, origin) {
      const base = String(origin || '').replace(/\/$/, '');
      if (!base || seen[base]) return;
      seen[base] = true;
      out.push({ label: label, origin: base, mediaUrl: base + '/' + enc });
    }
    try {
      add(global.location.hostname || 'this site', global.location.origin);
    } catch (_) {}
    for (let i = 0; i < peers.length; i++) {
      const fqdn = peers[i];
      add(peerShort(fqdn), 'https://' + DEFAULT_REPO + '.' + fqdn);
    }
    return out;
  }

  function parseTotalFromHeaders(headers) {
    if (!headers || typeof headers.get !== 'function') return null;
    const cr = headers.get('Content-Range') || '';
    if (cr.indexOf('/') >= 0) {
      const t = parseInt(cr.split('/').pop(), 10);
      if (!Number.isNaN(t) && t >= 0) return t;
    }
    const cl = parseInt(headers.get('Content-Length') || '', 10);
    if (!Number.isNaN(cl) && cl >= 0) return cl;
    return null;
  }

  function displayPct(st) {
    if (!st) return 0;
    if (typeof st.progressPct === 'number' && !Number.isNaN(st.progressPct)) {
      return Math.max(0, Math.min(100, st.progressPct));
    }
    return 0;
  }

  function isStubCid(st) {
    if (st && st.stub === true) return true;
    if (st && typeof st.contentType === 'string' && st.contentType.indexOf('symlink') >= 0) {
      return true;
    }
    return !!(st && typeof st.bytesTotal === 'number' && st.bytesTotal > 0 && st.bytesTotal < STUB_BYTES_MAX);
  }

  function statusLabel(st) {
    if (!st) return 'Checking mirrors… 0%';
    if (st.mirrorLabel) {
      if (st.ok && !isStubCid(st)) return 'Ready on ' + st.mirrorLabel;
      if (isStubCid(st)) {
        return (
          st.mirrorLabel +
          ': broken CID — only ' +
          formatBytes(st.bytesTotal) +
          ' (symlink stub, not the video)'
        );
      }
    }
    if (st.ok && !isStubCid(st)) return 'Ready';
    const pct = displayPct(st);
    const prov =
      typeof st.providers === 'number' ? st.providers + (st.providers === 1 ? ' provider' : ' providers') : null;
    if (isStubCid(st)) {
      return (
        'Broken CID — only ' +
        formatBytes(st.bytesTotal) +
        ' (symlink stub, not the video). Re-ingest required.'
      );
    }
    if (st.seedState === 'fetching') {
      let line = (st.mirrorLabel ? st.mirrorLabel + ': ' : '') + 'Server fetching… ' + pct + '%';
      if (st.bytesReceived != null && st.bytesTotal != null && st.bytesTotal > 0) {
        line += ' · ' + formatBytes(st.bytesReceived) + ' / ' + formatBytes(st.bytesTotal);
      }
      if (prov) line += ' · ' + prov;
      return line;
    }
    if (st.seedState === 'unavailable' || st.error === 'ipfs-not-found') {
      return (
        (st.mirrorLabel ? st.mirrorLabel + ': ' : '') +
        'Waiting for IPFS… ' +
        pct +
        '%' +
        (prov ? ' · ' + prov : ' · 0 providers')
      );
    }
    if (st.seedState === 'missing' || st.error === 'ipfs-pending') {
      return (
        (st.mirrorLabel ? st.mirrorLabel + ': ' : '') +
        'Waiting for IPFS… ' +
        pct +
        '%' +
        (prov ? ' · ' + prov : '') +
        ' — trying mirrors…'
      );
    }
    if (st.error === 'ipfs-busy') return (st.mirrorLabel ? st.mirrorLabel + ': ' : '') + 'Busy · ' + pct + '% — retrying…';
    if (st.error === 'ipfs-gateway-timeout') {
      return (st.mirrorLabel ? st.mirrorLabel + ': ' : '') + 'Gateway timeout · ' + pct + '% — trying next mirror…';
    }
    if (st.message) return (st.mirrorLabel ? st.mirrorLabel + ': ' : '') + st.message + ' · ' + pct + '%';
    return (st.mirrorLabel ? st.mirrorLabel + ': ' : '') + 'Checking… ' + pct + '%';
  }

  function statusHint(st) {
    if (isStubCid(st)) {
      return (
        'This content hash points at ' +
        formatBytes(st.bytesTotal) +
        ' (a filesystem symlink path), not multi‑GB video bytes. Local re-ingest must follow the symlink, then republish the stub. Mirrors share the same broken CID.'
      );
    }
    if (st && st.seedState === 'fetching') {
      return 'This Relay node is pinning the CID into its local IPFS, then will serve the file same-origin (or via CORS from a fleet mirror).';
    }
    if (st && typeof st.providers === 'number' && st.providers === 0) {
      return 'No peer currently advertises this CID. Nodes queued a local pin; playback starts once blocks arrive on any mirror.';
    }
    return 'After Play, the client probes this site then fleet mirrors (iad1 / ord1 / hkg1). The first playable host wins.';
  }

  function parseStatusJson(j) {
    if (!j || typeof j !== 'object') return null;
    const seed = j.seed && typeof j.seed === 'object' ? j.seed : {};
    return {
      ok: j.error === 'ok',
      retryable: j.retryable === true,
      error: typeof j.error === 'string' ? j.error : 'unknown',
      message: typeof j.message === 'string' ? j.message : '',
      progressPct: typeof seed.progressPct === 'number' ? seed.progressPct : null,
      seedState: typeof seed.state === 'string' ? seed.state : 'unknown',
      providers: typeof seed.providers === 'number' ? seed.providers : null,
      bytesTotal: typeof seed.bytesTotal === 'number' ? seed.bytesTotal : null,
      bytesReceived: typeof seed.bytesReceived === 'number' ? seed.bytesReceived : null,
      retryAfterSecs: typeof j.retryAfterSecs === 'number' ? j.retryAfterSecs : 5,
      cid: typeof j.cid === 'string' ? j.cid : '',
    };
  }

  function buildInspect(cid, providers, bytesTotal) {
    const wrap = global.document.createElement('div');
    wrap.className = 'fb-media-inspect';
    wrap.setAttribute('data-ipfs-inspect', '1');
    if (!cid) return wrap;

    const label = global.document.createElement('p');
    label.className = 'fb-media-inspect-label';
    label.textContent = 'Inspect on IPFS';
    wrap.appendChild(label);

    const row = global.document.createElement('div');
    row.className = 'fb-media-inspect-cid-row';
    const code = global.document.createElement('code');
    code.className = 'fb-media-inspect-cid';
    code.textContent = cid;
    row.appendChild(code);
    const copy = global.document.createElement('button');
    copy.type = 'button';
    copy.className = 'fb-btn fb-media-inspect-copy';
    copy.textContent = 'Copy CID';
    copy.addEventListener('click', () => {
      try {
        if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
          global.navigator.clipboard.writeText(cid);
        }
      } catch (_) {}
    });
    row.appendChild(copy);
    wrap.appendChild(row);

    const links = global.document.createElement('div');
    links.className = 'fb-media-inspect-links';
    const enc = encodeURIComponent(cid);
    const specs = [
      ['CID Inspector', 'https://cid.ipfs.tech/#' + cid],
      ['Providers', 'https://check.ipfs.network/?cid=' + enc],
    ];
    specs.forEach((pair) => {
      const a = global.document.createElement('a');
      a.href = pair[1];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = pair[0];
      links.appendChild(a);
    });
    wrap.appendChild(links);

    const playNote = global.document.createElement('p');
    playNote.className = 'fb-media-inspect-note';
    playNote.textContent =
      'Playback is same-origin only. Public gateways are not used for video.';
    wrap.appendChild(playNote);

    if (providers != null || (typeof bytesTotal === 'number' && bytesTotal > 0)) {
      const note = global.document.createElement('p');
      note.className = 'fb-media-inspect-note';
      const parts = [];
      if (typeof bytesTotal === 'number' && bytesTotal > 0) {
        parts.push('Reported size ' + formatBytes(bytesTotal));
      }
      if (providers != null) {
        if (providers === 0) parts.push('0 providers');
        else if (providers === 1) parts.push('1 provider');
        else parts.push(providers + ' providers');
      }
      note.textContent = parts.join(' · ');
      wrap.appendChild(note);
    }
    return wrap;
  }

  /** Parse `90`, `1:30`, `1:02:03`, or media-fragment `t=90` / `t=1m30s`. */
  function parseMediaTime(raw) {
    if (raw == null) return NaN;
    let s = String(raw).trim();
    if (!s) return NaN;
    if (s.indexOf('t=') === 0) s = s.slice(2);
    if (s.charAt(0) === '#') s = s.slice(1);
    if (s.indexOf('t=') === 0) s = s.slice(2);
    // drop end range in t=10,20
    const comma = s.indexOf(',');
    if (comma >= 0) s = s.slice(0, comma);
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    const hms = s.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d(?:\.\d+)?))?$/);
    if (hms) {
      if (hms[3] != null) {
        return parseInt(hms[1], 10) * 3600 + parseInt(hms[2], 10) * 60 + parseFloat(hms[3]);
      }
      return parseInt(hms[1], 10) * 60 + parseFloat(hms[2]);
    }
    const fancy = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/i);
    if (fancy && (fancy[1] || fancy[2] || fancy[3])) {
      return (
        (parseInt(fancy[1] || '0', 10) || 0) * 3600 +
        (parseInt(fancy[2] || '0', 10) || 0) * 60 +
        (parseFloat(fancy[3] || '0') || 0)
      );
    }
    return NaN;
  }

  function seekFromLocation() {
    const out = { start: NaN, end: NaN };
    try {
      const loc = global.location;
      if (!loc) return out;
      if (loc.search) {
        const q = new global.URLSearchParams(loc.search);
        const t = q.get('t') || q.get('start') || q.get('time');
        const n = parseMediaTime(t);
        if (!Number.isNaN(n)) out.start = n;
        // Record end for future clip-stop; do not pause at end yet.
        const e = parseMediaTime(q.get('end') || q.get('e') || '');
        if (!Number.isNaN(e)) out.end = e;
      }
      if (Number.isNaN(out.start) && loc.hash) {
        const h = loc.hash.replace(/^#/, '');
        if (h.indexOf('t=') === 0 || /^\d/.test(h)) {
          const n = parseMediaTime(h.indexOf('t=') === 0 ? h : 't=' + h);
          if (!Number.isNaN(n)) out.start = n;
        }
      }
    } catch (_) {}
    return out;
  }

  function startAtFromLocation() {
    return seekFromLocation().start;
  }

  function applyCommands(ctx, props) {
    const video = ctx.video;
    if (!video) return;
    const playing = prop(props, 'playing', 'false') === 'true';
    const cmd = parseInt(prop(props, 'command', '0'), 10) || 0;
    let arg = parseMediaTime(prop(props, 'commandArg', ''));
    if (Number.isNaN(arg)) arg = parseFloat(prop(props, 'commandArg', ''));

    if (cmd === 3 && !Number.isNaN(arg)) {
      ctx.pendingSeek = arg;
    }
    const startProp = parseMediaTime(prop(props, 'startAt', ''));
    if (!Number.isNaN(startProp) && ctx.pendingSeek == null && !ctx.didInitialSeek) {
      ctx.pendingSeek = startProp;
    }

    if (!ctx.isReady) {
      if (cmd === 1 || playing) {
        ctx.notePlayWhileSeeding();
      }
      return;
    }

    if (ctx.pendingSeek != null && !Number.isNaN(ctx.pendingSeek)) {
      try {
        video.currentTime = ctx.pendingSeek;
        ctx.didInitialSeek = true;
        let note = 'Seeking to ' + Math.floor(video.currentTime) + 's…';
        if (ctx.pendingEnd != null && !Number.isNaN(ctx.pendingEnd)) {
          note += ' (section ends ~' + Math.floor(ctx.pendingEnd) + 's — stop not enforced yet)';
        }
        ctx.setPlaybackNote(note);
        ctx.pendingSeek = null;
      } catch (_) {}
    }

    if (cmd === 1 || playing) {
      try {
        shell.style.display = 'block';
        pending.style.display = 'none';
      } catch (_) {}
      ctx.clearPlaybackError();
      ctx.setPlaybackNote('Starting playback…');
      try {
        video.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (_) {}
      const p = video.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          ctx.setPlaybackNote('Playing');
          ctx.clearPlaybackError();
        }).catch((err) => {
          const name = err && err.name ? err.name : 'PlayError';
          const msg =
            name === 'NotAllowedError'
              ? 'Browser blocked autoplay — tap Play on the video controls.'
              : 'Could not start playback (' + name + ').';
          ctx.setPlaybackError(msg);
        });
      } else {
        ctx.setPlaybackNote('Play sent — use video controls if nothing moves.');
      }
    } else if (cmd === 2) {
      video.pause();
      ctx.setPlaybackNote('Paused');
    }
  }

  function buildTheaterPlayer(props, invokeHandler, onAfterInvoke) {
    const src = prop(props, 'src', '');
    const poster = prop(props, 'poster', '');
    const cidProp = prop(props, 'cid', '');
    const seedState = prop(props, 'seedState', 'pending');
    const seedMessage = prop(props, 'seedMessage', 'This file needs to be seeded');
    const seedHint = prop(props, 'seedHint', '');
    const unlocked = prop(props, 'unlocked', 'false') === 'true';
    let startAt = parseMediaTime(prop(props, 'startAt', ''));
    const fromUrl = seekFromLocation();
    if (Number.isNaN(startAt)) startAt = fromUrl.start;
    const endAt = fromUrl.end;

    const root = global.document.createElement('div');
    root.className = 'fb-theater-player';
    root.setAttribute('data-seed-state', seedState);

    const locked = global.document.createElement('div');
    locked.className = 'fb-media fb-media-locked';
    locked.setAttribute('aria-hidden', unlocked ? 'true' : 'false');
    if (unlocked) locked.style.display = 'none';
    const lockedMsg = global.document.createElement('p');
    lockedMsg.className = 'fb-media-msg';
    lockedMsg.textContent = 'Playback unlocks after you confirm ownership below.';
    locked.appendChild(lockedMsg);
    root.appendChild(locked);

    const unlock = global.document.createElement('div');
    unlock.className = 'fb-media-unlock-target';
    if (!unlocked) unlock.style.display = 'none';

    const pending = global.document.createElement('div');
    pending.className = 'fb-media fb-media-pending';
    pending.setAttribute('data-relay-media', seedState);

    const msg = global.document.createElement('p');
    msg.className = 'fb-media-msg';
    msg.textContent = seedMessage;
    pending.appendChild(msg);

    const hint = global.document.createElement('p');
    hint.className = 'fb-media-hint';
    hint.textContent =
      seedHint ||
      'The content hash is known. Until a peer seeds the bytes onto IPFS, playback cannot start.';
    pending.appendChild(hint);

    const bar = global.document.createElement('div');
    bar.className = 'fb-media-bar';
    bar.style.display = 'block';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', '0');
    bar.setAttribute('title', '0%');
    const fill = global.document.createElement('div');
    fill.className = 'fb-media-bar-fill';
    fill.style.width = '0%';
    bar.appendChild(fill);
    pending.appendChild(bar);

    const inspectHost = global.document.createElement('div');
    inspectHost.appendChild(buildInspect(cidProp, null, null));
    pending.appendChild(inspectHost);

    const retryBtn = global.document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'fb-btn';
    retryBtn.textContent = 'Retry';
    retryBtn.style.display = 'none';
    pending.appendChild(retryBtn);

    const shell = global.document.createElement('div');
    shell.className = 'fb-media-ready';
    shell.style.display = seedState === 'ready' && src ? 'block' : 'none';
    if (seedState === 'ready' && src) {
      pending.style.display = 'none';
    }

    const statusBanner = global.document.createElement('p');
    statusBanner.className = 'fb-media-playback-note';
    statusBanner.style.display = 'none';
    shell.appendChild(statusBanner);

    const errBanner = global.document.createElement('div');
    errBanner.className = 'fb-media fb-media-failed fb-media-playback-error';
    errBanner.style.display = 'none';
    const errMsg = global.document.createElement('p');
    errMsg.className = 'fb-media-msg';
    errBanner.appendChild(errMsg);
    shell.appendChild(errBanner);

    const video = global.document.createElement('video');
    video.className = 'fb-media-video relay-video-player';
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'metadata');
    video.controls = true;
    if (src) video.src = src;
    if (poster) video.poster = poster;

    const ctx = {
      video: video,
      isReady: seedState === 'ready' && !!src,
      pendingSeek: Number.isNaN(startAt) ? null : startAt,
      pendingEnd: Number.isNaN(endAt) ? null : endAt, // recorded for future clip-stop; not enforced yet
      didInitialSeek: false,
      lastCommandSeq: prop(props, 'commandSeq', '0'),
      setPlaybackNote: function (text) {
        if (!text) {
          statusBanner.style.display = 'none';
          statusBanner.textContent = '';
          return;
        }
        statusBanner.textContent = text;
        statusBanner.style.display = 'block';
      },
      setPlaybackError: function (text) {
        errMsg.textContent = text || 'Playback failed.';
        errBanner.style.display = 'block';
        pending.style.display = 'none';
        shell.style.display = 'block';
        root.setAttribute('data-seed-state', 'error');
      },
      clearPlaybackError: function () {
        errBanner.style.display = 'none';
        errMsg.textContent = '';
      },
      notePlayWhileSeeding: function () {
        pending.style.display = 'block';
        shell.style.display = 'none';
        pending.className = 'fb-media fb-media-pending fb-media-play-requested';
        msg.textContent = 'Play requested — probing this site and fleet mirrors…';
        hint.textContent =
          'Trying the current host, then iad1 / ord1 / hkg1. The first mirror with real video bytes wins.';
        try {
          pending.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (_) {}
        startMirrorHunt({ fromPlay: true });
      },
      seekTo: function (secs, endSecs) {
        if (typeof secs === 'number' && !Number.isNaN(secs)) {
          ctx.pendingSeek = secs;
          ctx.didInitialSeek = false;
        }
        if (typeof endSecs === 'number' && !Number.isNaN(endSecs)) {
          ctx.pendingEnd = endSecs;
        }
        applyCommands(ctx, props);
        if (ctx.isReady) {
          const p = video.play();
          if (p && typeof p.catch === 'function') p.catch(function () {});
        } else {
          ctx.notePlayWhileSeeding();
        }
      },
    };

    video.addEventListener('play', () => invoke(propHandler(props, 'onPlay'), invokeHandler, onAfterInvoke));
    video.addEventListener('pause', () => invoke(propHandler(props, 'onPause'), invokeHandler, onAfterInvoke));
    video.addEventListener('ended', () => invoke(propHandler(props, 'onEnded'), invokeHandler, onAfterInvoke));
    video.addEventListener('waiting', () => ctx.setPlaybackNote('Buffering…'));
    video.addEventListener('playing', () => {
      ctx.setPlaybackNote('');
      ctx.clearPlaybackError();
    });
    video.addEventListener('loadedmetadata', () => {
      if (ctx.pendingSeek != null) applyCommands(ctx, props);
    });
    video.addEventListener('error', () => {
      invoke(propHandler(props, 'onError'), invokeHandler, onAfterInvoke);
      ctx.isReady = false;
      stopped = false;
      mirrorIndex += 1;
      msg.textContent = 'Playback failed on current mirror — trying next…';
      pending.style.display = 'block';
      shell.style.display = 'none';
      startMirrorHunt({ fromPlay: true, resume: true });
    });
    applyCommands(ctx, props);
    shell.appendChild(video);

    unlock.appendChild(pending);
    unlock.appendChild(shell);
    root.appendChild(unlock);

    let attempt = 0;
    let timer = null;
    let stopped = false;
    let mirrorIndex = 0;
    let mirrors = buildMirrorList(logicalPathFromSrc(src), DEFAULT_PEER_FQDNS);
    let activeMirror = mirrors[0] || null;
    const maxRounds = 8;

    function setVideoSource(mediaUrl) {
      try {
        const u = new global.URL(mediaUrl, global.location.href);
        if (u.origin !== global.location.origin) {
          video.crossOrigin = 'anonymous';
        } else {
          try {
            video.removeAttribute('crossorigin');
          } catch (_) {}
        }
      } catch (_) {}
      video.src = mediaUrl;
    }

    function showReady(mirror, size) {
      activeMirror = mirror || activeMirror;
      if (activeMirror && activeMirror.mediaUrl) {
        setVideoSource(activeMirror.mediaUrl);
      }
      pending.style.display = 'none';
      shell.style.display = 'block';
      root.setAttribute('data-seed-state', 'ready');
      pending.setAttribute('data-relay-media', 'ready');
      ctx.isReady = true;
      stopped = true;
      if (timer) {
        global.clearTimeout(timer);
        timer = null;
      }
      const where = activeMirror && activeMirror.label ? activeMirror.label : 'mirror';
      const sizeNote = size ? ' · ' + formatBytes(size) : '';
      ctx.setPlaybackNote('Ready via ' + where + sizeNote);
      try {
        shell.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (_) {}
      applyCommands(ctx, props);
      if (prop(props, 'playing', 'false') === 'true' || root.getAttribute('data-play-requested') === '1') {
        ctx.setPlaybackNote('Starting playback via ' + where + sizeNote + '…');
        const p = video.play();
        if (p && typeof p.then === 'function') {
          p.then(function () {
            ctx.setPlaybackNote('Playing via ' + where + sizeNote);
            ctx.clearPlaybackError();
          }).catch(function (err) {
            const name = err && err.name ? err.name : 'PlayError';
            ctx.setPlaybackError(
              name === 'NotAllowedError'
                ? 'Ready on ' + where + ' — tap Play on the video controls.'
                : 'Ready on ' + where + ' but play failed (' + name + ').',
            );
          });
        }
      }
    }

    function showStatus(st) {
      if (!st) return;
      const stub = isStubCid(st);
      const permanent =
        stub ||
        (st.retryable !== true && (st.error === 'ipfs-not-found' || st.seedState === 'unavailable'));
      const exhausted = attempt >= maxRounds * Math.max(1, mirrors.length);
      msg.textContent = statusLabel(st);
      root.setAttribute('data-seed-state', stub ? 'stub' : st.seedState || 'pending');
      pending.setAttribute('data-relay-media', exhausted || permanent ? 'failed' : 'pending');
      const pct = displayPct(st);
      bar.style.display = 'block';
      fill.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', String(pct));
      bar.setAttribute('title', pct + '%');
      hint.style.display = 'block';
      hint.textContent = statusHint(st);
      if (exhausted || (permanent && stub)) {
        pending.className = 'fb-media fb-media-failed';
        retryBtn.style.display = 'inline-block';
      } else {
        pending.className = 'fb-media fb-media-pending';
        retryBtn.style.display = 'none';
      }
      const cid = st.cid || cidProp;
      inspectHost.replaceChildren(buildInspect(cid, st.providers, st.bytesTotal));
    }

    function loadPeerList(done) {
      let left = DEFAULT_PEER_FQDNS.length;
      let found = null;
      function finish() {
        if (found && found.length) {
          mirrors = buildMirrorList(logicalPathFromSrc(src), found);
        }
        done();
      }
      for (let i = 0; i < DEFAULT_PEER_FQDNS.length; i++) {
        const fqdn = DEFAULT_PEER_FQDNS[i];
        global
          .fetch('https://' + fqdn + '/api/config', { credentials: 'omit', cache: 'no-store' })
          .then(function (r) {
            return r && r.ok ? r.json() : null;
          })
          .then(function (j) {
            if (!found && j && Array.isArray(j.peers) && j.peers.length) {
              found = j.peers;
            }
          })
          .catch(function () {})
          .then(function () {
            left -= 1;
            if (left <= 0) finish();
          });
      }
    }

    function probeOneMirror(mirror) {
      const statusUrl =
        mirror.mediaUrl + (mirror.mediaUrl.indexOf('?') >= 0 ? '&' : '?') + 'relayAssetStatus=1';
      return global
        .fetch(statusUrl, { credentials: 'omit', cache: 'no-store' })
        .then(function (r) {
          return r ? r.json().catch(function () { return null; }) : null;
        })
        .then(function (j) {
          const st = parseStatusJson(j) || {
            ok: false,
            retryable: true,
            error: 'http',
            message: 'No status',
            progressPct: 0,
            seedState: 'unknown',
            providers: null,
            bytesTotal: null,
            bytesReceived: null,
            retryAfterSecs: 3,
            cid: cidProp,
          };
          st.mirrorLabel = mirror.label;
          return global
            .fetch(mirror.mediaUrl, {
              method: 'GET',
              headers: { Range: 'bytes=0-0' },
              credentials: 'omit',
              cache: 'no-store',
            })
            .then(function (r2) {
              const size = parseTotalFromHeaders(r2.headers);
              const ct = (r2.headers.get('Content-Type') || '').toLowerCase();
              if (size != null) st.bytesTotal = size;
              st.contentType = ct;
              if (size != null && size < STUB_BYTES_MAX) {
                st.ok = false;
                st.stub = true;
                st.retryable = false;
                st.seedState = 'stub';
                st.error = 'ipfs-stub';
                st.message = 'Symlink stub (' + formatBytes(size) + ')';
              } else if (ct.indexOf('symlink') >= 0) {
                st.ok = false;
                st.stub = true;
                st.retryable = false;
                st.seedState = 'stub';
                st.error = 'ipfs-stub';
                st.message = 'Symlink stub';
              } else if (r2.ok || r2.status === 206) {
                if (st.ok || st.seedState === 'cached' || st.seedState === 'ready') {
                  st.ok = true;
                  st.seedState = 'ready';
                }
              } else if (r2.status >= 500 || r2.status === 425 || r2.status === 503 || r2.status === 504) {
                st.ok = false;
                st.retryable = true;
                st.error = 'http-' + r2.status;
                st.message = 'HTTP ' + r2.status;
              } else if (!r2.ok) {
                st.ok = false;
                st.retryable = r2.status !== 410 && r2.status !== 404;
                st.error = 'http-' + r2.status;
                st.message = 'HTTP ' + r2.status;
              }
              return { mirror: mirror, st: st };
            })
            .catch(function () {
              st.ok = false;
              st.retryable = true;
              st.error = 'range-fail';
              st.message = 'Range probe failed';
              return { mirror: mirror, st: st };
            });
        })
        .catch(function () {
          return {
            mirror: mirror,
            st: {
              ok: false,
              retryable: true,
              error: 'network',
              message: 'Unreachable',
              progressPct: 0,
              seedState: 'unknown',
              providers: null,
              bytesTotal: null,
              bytesReceived: null,
              retryAfterSecs: 3,
              cid: cidProp,
              mirrorLabel: mirror.label,
            },
          };
        });
    }

    function scheduleNext(delayMs) {
      if (stopped || !src) return;
      if (timer) global.clearTimeout(timer);
      let delay = delayMs || 2500;
      if (delay < 1200) delay = 1200;
      if (delay > 12000) delay = 12000;
      timer = global.setTimeout(function () {
        attempt += 1;
        huntStep();
      }, delay);
    }

    function huntStep() {
      if (stopped || !src || !mirrors.length) return;
      if (mirrorIndex >= mirrors.length) {
        mirrorIndex = 0;
        if (attempt >= maxRounds * mirrors.length) {
          showStatus({
            ok: false,
            retryable: false,
            error: 'mirrors-exhausted',
            message: 'All mirrors failed or still seeding',
            progressPct: 0,
            seedState: 'unavailable',
            providers: null,
            bytesTotal: null,
            bytesReceived: null,
            retryAfterSecs: 5,
            cid: cidProp,
          });
          retryBtn.style.display = 'inline-block';
          return;
        }
      }
      const mirror = mirrors[mirrorIndex];
      msg.textContent = 'Checking mirror ' + mirror.label + '…';
      hint.textContent =
        'Client mirror retry: ' +
        (mirrorIndex + 1) +
        '/' +
        mirrors.length +
        ' (' +
        mirrors
          .map(function (m) {
            return m.label;
          })
          .join(' → ') +
        ')';
      probeOneMirror(mirror).then(function (result) {
        if (stopped) return;
        const st = result.st;
        showStatus(st);
        if (!isStubCid(st) && (st.ok || st.seedState === 'cached' || st.seedState === 'ready')) {
          showReady(result.mirror, st.bytesTotal);
          return;
        }
        if (isStubCid(st)) {
          retryBtn.style.display = 'inline-block';
          return;
        }
        mirrorIndex += 1;
        const delay =
          st && st.retryAfterSecs > 0 ? st.retryAfterSecs * 1000 : mirrorIndex === 0 ? 2500 : 900;
        scheduleNext(delay);
      });
    }

    function startMirrorHunt(opts) {
      opts = opts || {};
      if (!src) return;
      if (opts.fromPlay) {
        root.setAttribute('data-play-requested', '1');
      }
      stopped = false;
      ctx.isReady = false;
      if (!opts.resume) {
        mirrorIndex = 0;
        attempt = 0;
      }
      pending.style.display = 'block';
      shell.style.display = 'none';
      pending.className =
        'fb-media fb-media-pending' + (opts.fromPlay ? ' fb-media-play-requested' : '');
      retryBtn.style.display = 'none';
      msg.textContent = opts.fromPlay
        ? 'Play requested — probing mirrors…'
        : 'Checking this site and fleet mirrors…';
      loadPeerList(function () {
        if (stopped) return;
        huntStep();
      });
    }

    retryBtn.addEventListener('click', function () {
      attempt = 0;
      mirrorIndex = 0;
      stopped = false;
      ctx.isReady = false;
      ctx.clearPlaybackError();
      startMirrorHunt({ fromPlay: true });
    });

    if (src) {
      startMirrorHunt({ fromPlay: false });
    }

    root.__fbVideo = video;
    root.__fbCtx = ctx;
    root.__fbApplyCommands = (nextProps) => applyCommands(ctx, nextProps || props);
    root.__fbStartMirrorHunt = startMirrorHunt;
    root.__fbStopSeedPoll = () => {
      stopped = true;
      if (timer) {
        global.clearTimeout(timer);
        timer = null;
      }
    };
    return root;
    return root;
  }

  function attrsToProps(el) {
    const props = {};
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes[i];
      props[a.name] = a.value;
    }
    return props;
  }

  function wireHostCommands(host, built) {
    if (!host || !built || host.__fbCmdWired) return;
    host.__fbCmdWired = true;
    const apply = () => {
      try {
        if (typeof built.__fbApplyCommands === 'function') {
          built.__fbApplyCommands(attrsToProps(host));
        }
      } catch (_) {}
    };
    try {
      if (global.MutationObserver) {
        new global.MutationObserver(apply).observe(host, {
          attributes: true,
          attributeFilter: [
            'data-playing',
            'data-command',
            'data-command-seq',
            'data-command-arg',
            'data-start-at',
            'data-unlocked',
          ],
        });
      }
    } catch (_) {}
  }

  function needsUpgrade(host) {
    const fn = global.__fbHostNeedsUpgrade;
    if (typeof fn === 'function') {
      return fn(host, '.fb-theater-player');
    }
    return host && !host.querySelector('.fb-theater-player');
  }

  function upgradePlaceholders() {
    try {
      const nodes = global.document.querySelectorAll('[data-relay-park-native="fb-theater-player"]');
      for (let i = 0; i < nodes.length; i++) {
        const host = nodes[i];
        if (!needsUpgrade(host)) {
          const existing = host.querySelector('.fb-theater-player');
          if (existing) wireHostCommands(host, existing);
          continue;
        }
        host.setAttribute('data-fb-built', '1');
        const built = buildTheaterPlayer(attrsToProps(host), () => {}, null);
        host.replaceChildren(built);
        wireHostCommands(host, built);
      }
    } catch (_) {}
  }

  function applyUrlSeekToPlayers() {
    try {
      const seek = seekFromLocation();
      if (Number.isNaN(seek.start)) return;
      const nodes = global.document.querySelectorAll('.fb-theater-player');
      for (let i = 0; i < nodes.length; i++) {
        const built = nodes[i];
        if (built.__fbCtx && typeof built.__fbCtx.seekTo === 'function') {
          built.__fbCtx.seekTo(seek.start, seek.end);
        }
      }
    } catch (_) {}
  }

  function wireSectionLinkClicks() {
    if (global.__fbTheaterSeekClicks) return;
    global.__fbTheaterSeekClicks = true;
    try {
      global.document.addEventListener(
        'click',
        function (ev) {
          let el = ev.target;
          while (el && el.tagName !== 'A') {
            el = el.parentElement;
          }
          if (!el || !el.getAttribute) return;
          const href = el.getAttribute('href') || '';
          if (href.indexOf('t=') < 0 && href.indexOf('start=') < 0) return;
          // Same-page relative seek links: ?t=… or #t=…
          const isRelQuery = href.charAt(0) === '?' || href.charAt(0) === '#';
          let samePath = isRelQuery;
          if (!samePath && href.charAt(0) === '/') {
            try {
              const u = new global.URL(href, global.location.href);
              samePath = u.pathname === global.location.pathname;
            } catch (_) {
              samePath = false;
            }
          }
          if (!samePath) return;
          try {
            ev.preventDefault();
          } catch (_) {}
          try {
            const u = new global.URL(href, global.location.href);
            if (global.history && global.history.pushState) {
              global.history.pushState({}, '', u.pathname + u.search + u.hash);
            } else {
              global.location.href = u.pathname + u.search + u.hash;
              return;
            }
          } catch (_) {}
          applyUrlSeekToPlayers();
          try {
            const panel = global.document.querySelector('.fb-video-panel, .fb-theater-player');
            if (panel && panel.scrollIntoView) {
              panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          } catch (_) {}
        },
        true,
      );
      global.addEventListener('popstate', applyUrlSeekToPlayers);
    } catch (_) {}
  }

  function register() {
    wireSectionLinkClicks();
    if (typeof global.__relayRegisterParkNative === 'function') {
      global.__relayRegisterParkNative('fb-theater-player', buildTheaterPlayer);
    }
    try {
      if (global.customElements && !global.customElements.get('fb-theater-player')) {
        global.customElements.define(
          'fb-theater-player',
          class extends global.HTMLElement {
            static get observedAttributes() {
              return [
                'data-playing',
                'data-command',
                'data-command-seq',
                'data-command-arg',
                'data-start-at',
                'src',
                'data-src',
              ];
            }
            connectedCallback() {
              if (this._fbBuilt) return;
              this._fbBuilt = true;
              const built = buildTheaterPlayer(attrsToProps(this), () => {}, null);
              this.replaceChildren(built);
              wireHostCommands(this, built);
            }
            attributeChangedCallback() {
              const built = this.querySelector('.fb-theater-player');
              if (built && typeof built.__fbApplyCommands === 'function') {
                built.__fbApplyCommands(attrsToProps(this));
              }
            }
            disconnectedCallback() {
              const child = this.querySelector('.fb-theater-player');
              if (child && typeof child.__fbStopSeedPoll === 'function') {
                child.__fbStopSeedPoll();
              }
            }
          },
        );
      }
    } catch (_) {}
    upgradePlaceholders();
  }

  function boot() {
    register();
    let n = 0;
    const t = global.setInterval(() => {
      register();
      n += 1;
      if (typeof global.__relayRegisterParkNative === 'function' || n > 80) {
        global.clearInterval(t);
      }
    }, 50);
    const sched = global.__fbScheduleParkNativeReupgrade;
    if (typeof sched === 'function') {
      sched(register);
    }
  }

  if (typeof global.document !== 'undefined') {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  } else {
    register();
  }
  global.__fbBuildTheaterPlayer = buildTheaterPlayer;
})(typeof globalThis !== 'undefined' ? globalThis : window);
