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

  function formatBytes(n) {
    if (n == null || typeof n !== 'number' || !(n >= 0)) return '';
    if (n < 1000) return n + ' B';
    if (n < 1000000) return (n / 1000).toFixed(1) + ' KB';
    if (n < 1000000000) return (n / 1000000).toFixed(1) + ' MB';
    return (n / 1000000000).toFixed(2) + ' GB';
  }

  function displayPct(st) {
    if (!st) return 0;
    if (typeof st.progressPct === 'number' && !Number.isNaN(st.progressPct)) {
      return Math.max(0, Math.min(100, st.progressPct));
    }
    return 0;
  }

  function isStubCid(st) {
    return !!(st && typeof st.bytesTotal === 'number' && st.bytesTotal > 0 && st.bytesTotal < STUB_BYTES_MAX);
  }

  function statusLabel(st) {
    if (!st) return 'Checking this node’s IPFS… 0%';
    if (st.ok) return 'Ready';
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
      let line = 'Server fetching… ' + pct + '%';
      if (st.bytesReceived != null && st.bytesTotal != null && st.bytesTotal > 0) {
        line += ' · ' + formatBytes(st.bytesReceived) + ' / ' + formatBytes(st.bytesTotal);
      }
      if (prov) line += ' · ' + prov;
      return line;
    }
    if (st.seedState === 'unavailable' || st.error === 'ipfs-not-found') {
      return 'Waiting for this node’s IPFS… ' + pct + '%' + (prov ? ' · ' + prov : ' · 0 providers');
    }
    if (st.seedState === 'missing' || st.error === 'ipfs-pending') {
      return 'Waiting for this node’s IPFS… ' + pct + '%' + (prov ? ' · ' + prov : '') + ' — retrying…';
    }
    if (st.error === 'ipfs-busy') return 'Busy · ' + pct + '% — retrying…';
    if (st.error === 'ipfs-gateway-timeout') return 'Gateway timeout · ' + pct + '% — retrying…';
    if (st.message) return st.message + ' · ' + pct + '%';
    return 'Waiting for this node’s IPFS… ' + pct + '%';
  }

  function statusHint(st) {
    if (isStubCid(st)) {
      return (
        'This content hash points at ' +
        formatBytes(st.bytesTotal) +
        ' (a filesystem symlink path), not multi‑GB video bytes. Local re-ingest must follow the symlink, then republish the stub.'
      );
    }
    if (st && st.seedState === 'fetching') {
      return 'This Relay node is pinning the CID into its local IPFS, then will serve the file same-origin.';
    }
    if (st && typeof st.providers === 'number' && st.providers === 0) {
      return 'No peer currently advertises this CID. The server queued a local pin; playback starts once blocks arrive.';
    }
    return 'Playback uses this site only. The server fetches the CID into its local IPFS — the browser never talks to public gateways.';
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

  function applyCommands(video, props) {
    const playing = prop(props, 'playing', 'false') === 'true';
    const cmd = parseInt(prop(props, 'command', '0'), 10) || 0;
    const arg = parseFloat(prop(props, 'commandArg', ''));
    if (cmd === 1 || playing) {
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else if (cmd === 2) {
      video.pause();
    } else if (cmd === 3 && !Number.isNaN(arg)) {
      try {
        video.currentTime = arg;
      } catch (_) {}
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

    const video = global.document.createElement('video');
    video.className = 'fb-media-video relay-video-player';
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'metadata');
    video.controls = false;
    if (src) video.src = src;
    if (poster) video.poster = poster;
    video.addEventListener('play', () => invoke(propHandler(props, 'onPlay'), invokeHandler, onAfterInvoke));
    video.addEventListener('pause', () => invoke(propHandler(props, 'onPause'), invokeHandler, onAfterInvoke));
    video.addEventListener('ended', () => invoke(propHandler(props, 'onEnded'), invokeHandler, onAfterInvoke));
    video.addEventListener('error', () => invoke(propHandler(props, 'onError'), invokeHandler, onAfterInvoke));
    applyCommands(video, props);
    shell.appendChild(video);

    unlock.appendChild(pending);
    unlock.appendChild(shell);
    root.appendChild(unlock);

    let attempt = 0;
    let timer = null;
    let stopped = false;
    const maxAttempts = 48;

    function showReady() {
      pending.style.display = 'none';
      shell.style.display = 'block';
      root.setAttribute('data-seed-state', 'ready');
      pending.setAttribute('data-relay-media', 'ready');
      stopped = true;
      if (timer) {
        global.clearTimeout(timer);
        timer = null;
      }
    }

    function showStatus(st) {
      if (!st) return;
      const stub = isStubCid(st);
      const permanent =
        stub ||
        (st.retryable !== true && (st.error === 'ipfs-not-found' || st.seedState === 'unavailable'));
      const exhausted = attempt >= maxAttempts;
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
      if (exhausted || permanent) {
        pending.className = 'fb-media fb-media-failed';
        retryBtn.style.display = 'inline-block';
      } else {
        pending.className = 'fb-media fb-media-pending';
        retryBtn.style.display = 'none';
      }
      const cid = st.cid || cidProp;
      inspectHost.replaceChildren(buildInspect(cid, st.providers, st.bytesTotal));
    }

    function scheduleNext(st) {
      if (stopped || !src) return;
      let delay = st && st.retryAfterSecs > 0 ? st.retryAfterSecs * 1000 : 2500;
      if (delay < 2000) delay = 2000;
      if (delay > 15000) delay = 15000;
      if (timer) global.clearTimeout(timer);
      timer = global.setTimeout(() => {
        attempt += 1;
        probe();
      }, delay);
    }

    function probe() {
      if (stopped || !src) return;
      const statusUrl = src + (src.indexOf('?') >= 0 ? '&' : '?') + 'relayAssetStatus=1';
      global
        .fetch(statusUrl, { credentials: 'same-origin' })
        .then((r) => (r && r.ok ? r.json() : r ? r.json().catch(() => null) : null))
        .then((j) => {
          const st = parseStatusJson(j);
          if (!st) {
            showStatus({
              ok: false,
              retryable: true,
              error: 'http',
              message: 'Checking seed status…',
              progressPct: 0,
              seedState: 'unknown',
              providers: null,
              bytesTotal: null,
              bytesReceived: null,
              retryAfterSecs: 5,
              cid: cidProp,
            });
            scheduleNext(null);
            return;
          }
          // Tiny "cached" CIDs are symlink stubs — never treat as playable ready.
          if (
            !isStubCid(st) &&
            (st.ok || st.seedState === 'cached' || st.seedState === 'ready')
          ) {
            showReady();
            return;
          }
          showStatus(st);
          const permanent =
            isStubCid(st) ||
            (st.retryable !== true &&
              (st.error === 'ipfs-not-found' || st.seedState === 'unavailable'));
          if (permanent || attempt >= maxAttempts) return;
          scheduleNext(st);
        })
        .catch(() => {
          showStatus({
            ok: false,
            retryable: true,
            error: 'network',
            message: 'Checking seed status…',
            progressPct: 0,
            seedState: 'unknown',
            providers: null,
            bytesTotal: null,
            bytesReceived: null,
            retryAfterSecs: 5,
            cid: cidProp,
          });
          scheduleNext(null);
        });
    }

    retryBtn.addEventListener('click', () => {
      attempt = 0;
      stopped = false;
      pending.className = 'fb-media fb-media-pending';
      retryBtn.style.display = 'none';
      msg.textContent = 'Checking seed status…';
      probe();
    });

    // Poll whenever we have a src. Unlock often arrives later via Affirmation +
    // html[data-fb-movie-ack] CSS (host is not rebuilt), so do not gate on unlocked.
    if (src) {
      msg.textContent = 'Checking seed status…';
      probe();
    }

    root.__fbVideo = video;
    root.__fbApplyCommands = () => applyCommands(video, props);
    root.__fbStopSeedPoll = () => {
      stopped = true;
      if (timer) {
        global.clearTimeout(timer);
        timer = null;
      }
    };
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
        if (!needsUpgrade(host)) continue;
        host.setAttribute('data-fb-built', '1');
        const built = buildTheaterPlayer(attrsToProps(host), () => {}, null);
        host.replaceChildren(built);
      }
    } catch (_) {}
  }

  function register() {
    if (typeof global.__relayRegisterParkNative === 'function') {
      global.__relayRegisterParkNative('fb-theater-player', buildTheaterPlayer);
    }
    try {
      if (global.customElements && !global.customElements.get('fb-theater-player')) {
        global.customElements.define(
          'fb-theater-player',
          class extends global.HTMLElement {
            connectedCallback() {
              if (this._fbBuilt) return;
              this._fbBuilt = true;
              const built = buildTheaterPlayer(attrsToProps(this), () => {}, null);
              this.replaceChildren(built);
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
