/**
 * Web host for `fb-theater-player`: HTML5 video, seed/inspect chrome, external command props.
 * Polls `?relayAssetStatus=1` while unlocked so unseeded titles show live progress / fail UI.
 */
(function (global) {
  'use strict';

  function reportTheaterIssue(opts) {
    try {
      const api = global.__fbTheaterTelemetry;
      if (api && typeof api.reportTheaterIssue === 'function') {
        api.reportTheaterIssue(opts || {});
      }
    } catch (_) {}
  }

  function currentRendition(srcLadder, ladderIndex) {
    const cur = srcLadder && srcLadder[ladderIndex];
    return cur && cur.kind ? cur.kind : 'media';
  }

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
    // Prefer currently healthy US/APAC nodes; iad1 last while MKV Range often 504/hangs there.
    'ord1.relaygateway.net',
    'hkg1.relaygateway.net',
    'iad1.relaygateway.net',
  ];

  function formatBytes(n) {
    if (n == null || typeof n !== 'number' || !(n >= 0)) return '';
    if (n < 1000) return n + ' B';
    if (n < 1000000) return (n / 1000).toFixed(1) + ' KB';
    if (n < 1000000000) return (n / 1000000).toFixed(1) + ' MB';
    return (n / 1000000000).toFixed(2) + ' GB';
  }

  /** Timed fetch so hung mirrors cannot freeze Play feedback. */
  function fetchWithTimeout(url, opts, ms) {
    opts = opts || {};
    const timeoutMs = typeof ms === 'number' && ms > 0 ? ms : 5000;
    let settled = false;
    let timer = null;
    return new Promise(function (resolve, reject) {
      timer = global.setTimeout(function () {
        if (settled) return;
        settled = true;
        const e = new Error('timeout');
        e.code = 'timeout';
        reject(e);
      }, timeoutMs);
      global.fetch(url, opts).then(
        function (r) {
          if (settled) return;
          settled = true;
          if (timer) global.clearTimeout(timer);
          resolve(r);
        },
        function (err) {
          if (settled) return;
          settled = true;
          if (timer) global.clearTimeout(timer);
          const name = err && err.name ? err.name : '';
          if (name === 'AbortError') {
            const e = new Error('timeout');
            e.code = 'timeout';
            reject(e);
            return;
          }
          reject(err);
        },
      );
    });
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
    // Same-origin first: fleet subdomain mirrors often lack CORS from the park host.
    try {
      add(global.location.hostname || 'this site', global.location.origin);
    } catch (_) {}
    for (let i = 0; i < peers.length; i++) {
      const fqdn = peers[i];
      add(peerShort(fqdn), 'https://' + DEFAULT_REPO + '.' + fqdn);
    }
    return out;
  }

  /** Keep page origin at index 0 after peer-list rebuilds; demote known-flaky peers. */
  function prioritizeSameOrigin(list) {
    const arr = list && list.length ? list.slice() : [];
    let origin = '';
    try {
      origin = String(global.location.origin || '').replace(/\/$/, '');
    } catch (_) {}
    const rank = function (m) {
      if (!m || !m.origin) return 50;
      if (origin && m.origin === origin) return 0;
      const o = String(m.origin);
      if (o.indexOf('ord1.') >= 0) return 1;
      if (o.indexOf('hkg1.') >= 0) return 2;
      if (o.indexOf('iad1.') >= 0) return 40;
      return 10;
    };
    arr.sort(function (a, b) {
      return rank(a) - rank(b);
    });
    return arr;
  }

  function prefersDesktopPlayback() {
    // Wide/HD browser → max rung (web-1080p). Save-Data or narrow → mobile.
    try {
      const c = global.navigator && global.navigator.connection;
      if (c && c.saveData === true) return false;
    } catch (_) {}
    try {
      if (global.matchMedia && !global.matchMedia('(min-width: 901px)').matches) return false;
    } catch (_) {}
    return true;
  }

  function canPlayAvcMp4() {
    try {
      const v = global.document.createElement('video');
      const r = v.canPlayType('video/mp4; codecs="avc1.42E01E"');
      return r === 'probably' || r === 'maybe';
    } catch (_) {
      return true;
    }
  }

  function canPlayHevcMp4() {
    try {
      const v = global.document.createElement('video');
      const a = v.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"');
      const b = v.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"');
      return a === 'probably' || a === 'maybe' || b === 'probably' || b === 'maybe';
    } catch (_) {
      return false;
    }
  }

  function looksMatroskaUrl(url) {
    const u = String(url || '')
      .split('?')[0]
      .toLowerCase();
    return u.endsWith('.mkv') || u.endsWith('.mka') || u.endsWith('.mks');
  }

  /** Resolve `/wasm/c/{oid}/` from page scripts when `@relay/web-assets` is opted in. */
  function relayWasmPrefix() {
    try {
      if (global.__RELAY_WASM_PREFIX__) {
        return String(global.__RELAY_WASM_PREFIX__).replace(/\/?$/, '/');
      }
    } catch (_) {}
    try {
      const scripts = global.document.getElementsByTagName('script');
      for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].getAttribute('src') || '';
        const m = src.match(/\/(?:assets|wasm)\/c\/([a-f0-9]{40})\//i);
        if (m) return '/wasm/c/' + m[1] + '/';
      }
    } catch (_) {}
    return '/wasm/';
  }

  /** CDN / pinned URL for @clevertree/relay-video-web (same layout as relay-runtime). */
  function relayVideoWebModuleUrl() {
    try {
      if (global.__RELAY_VIDEO_WEB_URL__) return String(global.__RELAY_VIDEO_WEB_URL__);
    } catch (_) {}
    return relayWasmPrefix() + 'relay_video_wasm_pkg/player.js';
  }

  function relayVideoWasmBinaryUrl() {
    try {
      if (global.__RELAY_VIDEO_WASM_URL__) return String(global.__RELAY_VIDEO_WASM_URL__);
    } catch (_) {}
    return relayWasmPrefix() + 'relay_video_wasm_pkg/relay_video_wasm_bg.wasm';
  }

  /** Build ordered ladder: HEVC archival MP4 when decodable, then H.264 web/mobile. */
  function buildSrcLadder(props, preferredSrc) {
    const preferred = String(preferredSrc || prop(props, 'src', '') || '');
    const web = prop(props, 'srcWeb', '') || prop(props, 'data-src-web', '');
    const mobile = prop(props, 'srcMobile', '') || prop(props, 'data-src-mobile', '');
    const master = prop(props, 'srcMaster', '') || prop(props, 'data-src-master', '');
    const avc = canPlayAvcMp4();
    const hevc = canPlayHevcMp4();
    const desktop = prefersDesktopPlayback();
    const order = [];
    function push(kind, url) {
      const u = String(url || '');
      if (!u) return;
      for (let i = 0; i < order.length; i++) {
        if (order[i].src === u) return;
      }
      order.push({ kind: kind, src: u });
    }
    // HEVC archival first when the browser reports HEVC; else H.264 ladder then master fallback.
    if (hevc) push('master', master);
    if (desktop) {
      if (avc) {
        push('web', web);
        push('mobile', mobile);
      }
    } else {
      if (avc) {
        push('mobile', mobile);
        push('web', web);
      }
    }
    if (master && (!hevc || order.length === 0)) push('master', master);
    if (preferred) {
      let idx = -1;
      for (let i = 0; i < order.length; i++) {
        if (order[i].src === preferred) {
          idx = i;
          break;
        }
      }
      if (idx > 0) {
        const hit = order.splice(idx, 1)[0];
        order.unshift(hit);
      } else if (idx < 0) {
        order.unshift({ kind: 'preferred', src: preferred });
      }
    }
    return order;
  }

  function parseSubtitlesJson(raw) {
    const s = String(raw || '').trim();
    if (!s || s === '[]') return [];
    try {
      const list = JSON.parse(s);
      if (!Array.isArray(list)) return [];
      const out = [];
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t || !t.src) continue;
        out.push({
          src: String(t.src),
          label: String(t.label || 'Subtitles'),
          lang: String(t.lang || 'en'),
          isDefault: t.default === true,
        });
      }
      // Default tracks first (CleverScript cannot emit HTML default= attr)
      out.sort(function (a, b) {
        return (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0);
      });
      return out;
    } catch (_) {
      return [];
    }
  }

  function attachSubtitleTracks(video, tracks) {
    if (!video || !tracks || !tracks.length) return;
    // Clear prior tracks
    try {
      while (video.firstChild) video.removeChild(video.firstChild);
    } catch (_) {}
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const el = global.document.createElement('track');
      el.kind = 'subtitles';
      el.src = t.src;
      el.srclang = t.lang || 'en';
      el.label = t.label || 'Subtitles';
      if (i === 0 && t.isDefault) {
        try {
          el.setAttribute('default', '');
        } catch (_) {}
      }
      video.appendChild(el);
    }
    try {
      const tt = video.textTracks;
      if (tt && tt.length) {
        for (let j = 0; j < tt.length; j++) {
          tt[j].mode = j === 0 && tracks[0] && tracks[0].isDefault ? 'showing' : 'hidden';
        }
      }
    } catch (_) {}
  }

  function attachCcControl(shell, video, tracks) {
    if (!shell || !video || !tracks || !tracks.length) return null;
    const btn = global.document.createElement('button');
    btn.type = 'button';
    btn.className = 'fb-btn fb-cc-btn';
    btn.setAttribute('aria-label', 'Subtitles');
    let mode = tracks[0] && tracks[0].isDefault ? 0 : -1; // -1 off, else track index
    function paint() {
      if (mode < 0) {
        btn.textContent = 'CC Off';
        btn.setAttribute('aria-pressed', 'false');
      } else {
        const label = tracks[mode] && tracks[mode].label ? tracks[mode].label : 'CC';
        btn.textContent = 'CC: ' + label;
        btn.setAttribute('aria-pressed', 'true');
      }
      try {
        const tt = video.textTracks;
        if (!tt) return;
        for (let i = 0; i < tt.length; i++) {
          tt[i].mode = i === mode ? 'showing' : 'hidden';
        }
      } catch (_) {}
    }
    paint();
    btn.addEventListener('click', function () {
      mode += 1;
      if (mode >= tracks.length) mode = -1;
      paint();
    });
    const row = global.document.createElement('div');
    row.className = 'fb-cc-row';
    row.appendChild(btn);
    shell.appendChild(row);
    return btn;
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

  function downloadLabelForKind(kind, src) {
    if (kind === 'master') return 'Full quality (HEVC MP4)';
    if (kind === 'web') return '1080p (H.264 MP4)';
    if (kind === 'mobile') return '720p (H.264 MP4)';
    if (kind === 'sub') {
      const s = String(src || '').toLowerCase();
      if (s.indexOf('enhanced') >= 0 || s.indexOf('citation') >= 0) return 'Subtitles (enhanced)';
      if (s.indexOf('english') >= 0 || s.indexOf('default') >= 0) return 'Subtitles (default)';
      return 'Subtitles';
    }
    const s = String(src || '').toLowerCase();
    if (s.indexOf('.hevc.mp4') >= 0) return 'Full quality (HEVC MP4)';
    if (s.indexOf('.mkv') >= 0) return 'Full quality (legacy MKV)';
    if (s.indexOf('1080') >= 0 || s.indexOf('.web-') >= 0) return '1080p (H.264 MP4)';
    if (s.indexOf('720') >= 0 || s.indexOf('mobile') >= 0) return '720p (H.264 MP4)';
    if (s.indexOf('.vtt') >= 0 || s.indexOf('.srt') >= 0) return 'Subtitles';
    return 'Download';
  }

  /** Calm download row: MP4 rungs + shared subtitle files (always below the player). */
  function buildDownloadRow(props, ladder) {
    const wrap = global.document.createElement('div');
    wrap.className = 'fb-theater-downloads';
    wrap.setAttribute('data-fb-downloads', '1');
    const heading = global.document.createElement('p');
    heading.className = 'fb-theater-downloads-label';
    heading.textContent = 'Download the movie';
    wrap.appendChild(heading);
    const list = global.document.createElement('div');
    list.className = 'fb-theater-downloads-links';
    const seen = {};
    const items = [];
    function add(kind, url) {
      const u = String(url || '');
      if (!u || seen[u]) return;
      seen[u] = true;
      items.push({ kind: kind, src: u });
    }
    if (ladder && ladder.length) {
      for (let i = 0; i < ladder.length; i++) {
        add(ladder[i].kind, ladder[i].src);
      }
    }
    add('master', prop(props, 'srcMaster', '') || prop(props, 'data-src-master', ''));
    add('web', prop(props, 'srcWeb', '') || prop(props, 'data-src-web', ''));
    add('mobile', prop(props, 'srcMobile', '') || prop(props, 'data-src-mobile', ''));
    add('media', prop(props, 'src', '') || prop(props, 'data-src', ''));
    // Shared subs (not per-resolution) — same files the player uses for <track>.
    let tracks = [];
    try {
      const raw = prop(props, 'subtitlesJson', '') || prop(props, 'data-subtitles-json', '') || '[]';
      tracks = JSON.parse(raw);
      if (!Array.isArray(tracks)) tracks = [];
    } catch (_) {
      tracks = [];
    }
    for (let t = 0; t < tracks.length; t++) {
      const src = tracks[t] && tracks[t].src ? String(tracks[t].src) : '';
      if (!src) continue;
      add('sub', src.charAt(0) === '/' ? src : '/' + src);
    }
    if (!items.length) {
      const empty = global.document.createElement('p');
      empty.className = 'fb-theater-downloads-empty';
      empty.textContent = 'No downloadable files listed for this title yet.';
      wrap.appendChild(empty);
    } else {
      for (let j = 0; j < items.length; j++) {
        const a = global.document.createElement('a');
        a.className = 'fb-theater-download-link';
        a.href = items[j].src;
        a.setAttribute('download', '');
        a.rel = 'noopener';
        a.textContent = downloadLabelForKind(items[j].kind, items[j].src);
        list.appendChild(a);
      }
      wrap.appendChild(list);
    }
    const note = global.document.createElement('p');
    note.className = 'fb-theater-downloads-note';
    note.textContent =
      'Save the MP4 and matching subtitle files together, then open them in VLC or another video player.';
    wrap.appendChild(note);
    const boardRow = global.document.createElement('p');
    boardRow.className = 'fb-theater-downloads-note';
    const boardLink = global.document.createElement('a');
    boardLink.className = 'fb-theater-download-link';
    let pagePath = '/';
    try {
      pagePath = (global.location && global.location.pathname) || '/';
    } catch (_) {}
    boardLink.href =
      '/board?kind=bug&path=' + encodeURIComponent(pagePath);
    boardLink.textContent = 'Report a problem on the Board';
    boardRow.appendChild(boardLink);
    wrap.appendChild(boardRow);
    return wrap;
  }

  function goToBoardBug() {
    let pagePath = '/';
    try {
      pagePath = (global.location && global.location.pathname) || '/';
    } catch (_) {}
    const href = '/board?kind=bug&path=' + encodeURIComponent(pagePath);
    try {
      if (global.location) global.location.href = href;
    } catch (_) {}
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
    const unlockedNow =
      prop(props, 'unlocked', 'false') === 'true' || prop(props, 'data-unlocked', 'false') === 'true';
    if (typeof ctx.setUnlocked === 'function') {
      ctx.setUnlocked(unlockedNow);
    }
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
        if (ctx.uiShell) ctx.uiShell.style.display = 'block';
        if (ctx.uiPending) ctx.uiPending.style.display = 'none';
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
    const preferredSrc = prop(props, 'src', '');
    const srcLadder = buildSrcLadder(props, preferredSrc);
    let ladderIndex = 0;
    let src = srcLadder.length ? srcLadder[0].src : preferredSrc;
    const poster = prop(props, 'poster', '');
    const cidProp = prop(props, 'cid', '');
    const seedState = prop(props, 'seedState', 'pending');
    const seedMessage = prop(props, 'seedMessage', 'This file needs to be seeded');
    const seedHint = prop(props, 'seedHint', '');
    const unlocked = prop(props, 'unlocked', 'false') === 'true';
    const subtitleTracks = parseSubtitlesJson(
      prop(props, 'subtitlesJson', '') || prop(props, 'data-subtitles-json', ''),
    );
    let startAt = parseMediaTime(prop(props, 'startAt', ''));
    const fromUrl = seekFromLocation();
    if (Number.isNaN(startAt)) startAt = fromUrl.start;
    const endAt = fromUrl.end;
    let didPlaySucceed = false;
    let reportedSeedFail = false;
    let reportedMirrorsExhausted = false;

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
    msg.textContent = seedMessage || 'Getting the movie ready…';
    pending.appendChild(msg);

    const hint = global.document.createElement('p');
    hint.className = 'fb-media-hint';
    hint.textContent = seedHint || 'This usually takes a moment. Please wait.';
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

    const pendingActions = global.document.createElement('div');
    pendingActions.className = 'fb-theater-actions';
    const retryBtn = global.document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'fb-btn';
    retryBtn.textContent = 'Try again';
    retryBtn.style.display = 'none';
    pendingActions.appendChild(retryBtn);

    const reportPendingBtn = global.document.createElement('button');
    reportPendingBtn.type = 'button';
    reportPendingBtn.className = 'fb-btn fb-theater-report';
    reportPendingBtn.textContent = 'Report a problem';
    reportPendingBtn.style.display = 'none';
    reportPendingBtn.addEventListener('click', function () {
      reportTheaterIssue({
        severity: 'major',
        code: 'user_report',
        message: msg.textContent || 'user report (seed/mirrors)',
        rendition: currentRendition(srcLadder, ladderIndex),
        engine: 'hunt',
        force: true,
      });
      goToBoardBug();
    });
    pendingActions.appendChild(reportPendingBtn);
    pending.appendChild(pendingActions);

    const techDetails = global.document.createElement('details');
    techDetails.className = 'fb-theater-tech';
    const techSummary = global.document.createElement('summary');
    techSummary.className = 'fb-theater-tech-summary';
    techSummary.textContent = 'Technical details';
    techDetails.appendChild(techSummary);
    const techBody = global.document.createElement('div');
    techBody.className = 'fb-theater-tech-body';

    const liveLog = global.document.createElement('p');
    liveLog.className = 'fb-media-live';
    liveLog.setAttribute('data-fb-live-status', '1');
    liveLog.setAttribute('aria-live', 'polite');
    liveLog.style.display = 'none';
    techBody.appendChild(liveLog);

    const inspectHost = global.document.createElement('div');
    inspectHost.appendChild(buildInspect(cidProp, null, null));
    techBody.appendChild(inspectHost);
    techDetails.appendChild(techBody);
    pending.appendChild(techDetails);

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
    const errNudge = global.document.createElement('p');
    errNudge.className = 'fb-media-hint fb-theater-download-nudge';
    errNudge.textContent =
      'You can download the movie below, or leave a public note on the Board.';
    errBanner.appendChild(errNudge);
    const errActions = global.document.createElement('div');
    errActions.className = 'fb-theater-actions';
    const reportBtn = global.document.createElement('button');
    reportBtn.type = 'button';
    reportBtn.className = 'fb-btn fb-theater-report';
    reportBtn.textContent = 'Report a problem';
    reportBtn.style.display = 'none';
    errActions.appendChild(reportBtn);
    errBanner.appendChild(errActions);
    const errTech = global.document.createElement('details');
    errTech.className = 'fb-theater-tech';
    const errTechSummary = global.document.createElement('summary');
    errTechSummary.className = 'fb-theater-tech-summary';
    errTechSummary.textContent = 'Technical details';
    errTech.appendChild(errTechSummary);
    const errTechBody = global.document.createElement('p');
    errTechBody.className = 'fb-theater-tech-body fb-media-live';
    errTech.appendChild(errTechBody);
    errBanner.appendChild(errTech);
    reportBtn.addEventListener('click', function () {
      reportTheaterIssue({
        severity: 'major',
        code: 'user_report',
        message: errTechBody.textContent || errMsg.textContent || msg.textContent || 'user report',
        rendition: currentRendition(srcLadder, ladderIndex),
        engine: wasmApi ? 'wasm' : 'native',
        force: true,
      });
      goToBoardBug();
    });
    shell.appendChild(errBanner);

    const video = global.document.createElement('video');
    video.className = 'fb-media-video relay-video-player';
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'metadata');
    video.controls = true;
    if (src) video.src = src;
    if (poster) video.poster = poster;
    attachSubtitleTracks(video, subtitleTracks);

    const ctx = {
      video: video,
      uiShell: shell,
      uiPending: pending,
      isReady: seedState === 'ready' && !!src,
      pendingSeek: Number.isNaN(startAt) ? null : startAt,
      pendingEnd: Number.isNaN(endAt) ? null : endAt, // recorded for future clip-stop; not enforced yet
      didInitialSeek: false,
      lastCommandSeq: prop(props, 'commandSeq', '0'),
      setUnlocked: function (on) {
        if (on) {
          locked.style.display = 'none';
          locked.setAttribute('aria-hidden', 'true');
          unlock.style.display = '';
        } else {
          locked.style.display = '';
          locked.setAttribute('aria-hidden', 'false');
          unlock.style.display = 'none';
        }
      },
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
        const detail = text || 'Playback failed.';
        // Clear status strip so "Loading extended video engine…" does not stick over the error.
        statusBanner.style.display = 'none';
        statusBanner.textContent = '';
        // Prefer the spoken detail as the headline when we have one (e.g. SOURCE_TOO_LARGE).
        errMsg.textContent = detail;
        errNudge.textContent =
          'You can download the movie below, or leave a public note on the Board.';
        errNudge.style.display = 'block';
        errTechBody.textContent = detail;
        errBanner.style.display = 'block';
        reportBtn.style.display = 'inline-block';
        reportBtn.disabled = false;
        reportBtn.textContent = 'Report a problem';
        pending.style.display = 'none';
        shell.style.display = 'block';
        locked.style.display = 'none';
        unlock.style.display = '';
        root.setAttribute('data-seed-state', 'error');
      },
      clearPlaybackError: function () {
        errBanner.style.display = 'none';
        errMsg.textContent = '';
        errTechBody.textContent = '';
        reportBtn.style.display = 'none';
      },
      notePlayWhileSeeding: function () {
        locked.style.display = 'none';
        unlock.style.display = '';
        pending.style.display = 'block';
        shell.style.display = 'none';
        pending.className = 'fb-media fb-media-pending fb-media-play-requested';
        msg.textContent = 'Getting the movie ready…';
        hint.textContent = 'This usually takes a moment. Please wait.';
        liveLog.style.display = 'block';
        liveLog.textContent = 'Starting mirror hunt…';
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
          if (wasmApi && typeof wasmApi.play === 'function') {
            try {
              wasmApi.play();
            } catch (_) {}
          } else {
            const p = video.play();
            if (p && typeof p.catch === 'function') p.catch(function () {});
          }
        } else {
          ctx.notePlayWhileSeeding();
        }
      },
    };

    let wasmApi = null;
    let wasmTriedForUrl = '';

    function destroyWasmPlayer() {
      if (!wasmApi) return;
      try {
        if (typeof wasmApi.destroy === 'function') wasmApi.destroy();
      } catch (_) {}
      wasmApi = null;
      try {
        video.style.display = '';
      } catch (_) {}
    }

    function spokenPlaybackError(err) {
      if (err && typeof err.userMessage === 'string' && err.userMessage) return err.userMessage;
      if (err && typeof modSpokenMessage === 'function') {
        try {
          return modSpokenMessage(err);
        } catch (_) {}
      }
      const code = err && err.code ? String(err.code) : '';
      if (code === 'WEBCODECS_UNSUPPORTED') {
        return 'Full quality needs hardware decode this browser does not provide. Switching to 1080p for compatibility.';
      }
      if (code === 'SOURCE_TOO_LARGE') {
        return 'This archival file is too large for in-browser demux right now. Download the MKV below, or wait for a 1080p web rendition.';
      }
      if (code === 'FETCH_FAILED') {
        return 'The video file could not be downloaded from this mirror. Trying another source.';
      }
      if (code === 'WASM_LOAD_FAILED' || code === 'ENGINE_MISSING') {
        return 'This browser could not load the extended video engine. Switching to a compatibility stream.';
      }
      if (code === 'DEMUX_FAILED') {
        return 'This file’s container could not be read. Switching to a compatibility stream.';
      }
      if (code === 'DECODE_FAILED' || code === 'UNDERRUN') {
        return 'Video decode could not keep up. Switching to a compatibility stream.';
      }
      return 'Full quality is unavailable here — switching to a compatibility stream.';
    }

    let modSpokenMessage = null;

    function mountWasmPlayer(mediaUrl, where, sizeNote) {
      const url = String(mediaUrl || '');
      destroyWasmPlayer();
      wasmTriedForUrl = url;
      ctx.setPlaybackNote('Loading extended video engine…');
      const modUrl = relayVideoWebModuleUrl();
      return import(/* webpackIgnore: true */ modUrl)
        .then(function (mod) {
          if (typeof mod.spokenMessageForError === 'function') {
            modSpokenMessage = mod.spokenMessageForError;
          }
          const create = mod.createWasmPlayer || (mod.default && mod.default.createWasmPlayer);
          if (!create) {
            const err = new Error('createWasmPlayer missing');
            err.code = 'ENGINE_MISSING';
            throw err;
          }
          video.style.display = 'none';
          return create(shell, url, {
            wasmUrl: relayVideoWasmBinaryUrl(),
            autoPlay:
              prop(props, 'playing', 'false') === 'true' ||
              root.getAttribute('data-play-requested') === '1',
            onStatus: function (msg) {
              if (msg) ctx.setPlaybackNote(msg);
            },
            onPlay: function () {
              didPlaySucceed = true;
              invoke(propHandler(props, 'onPlay'), invokeHandler, onAfterInvoke);
            },
            onPause: function () {
              invoke(propHandler(props, 'onPause'), invokeHandler, onAfterInvoke);
            },
            onEnded: function () {
              invoke(propHandler(props, 'onEnded'), invokeHandler, onAfterInvoke);
            },
            onError: function (err) {
              invoke(propHandler(props, 'onError'), invokeHandler, onAfterInvoke);
              destroyWasmPlayer();
              const note = spokenPlaybackError(err);
              if (didPlaySucceed) {
                reportTheaterIssue({
                  severity: 'major',
                  code: 'post_play_collapse',
                  message: note,
                  rendition: currentRendition(srcLadder, ladderIndex),
                  engine: 'wasm',
                });
                ctx.setPlaybackError(note);
                return;
              }
              // Mirror fetch/CORS failures: try next fleet host before dropping quality.
              if (err && err.code === 'FETCH_FAILED' && mirrorIndex + 1 < mirrors.length) {
                mirrorIndex += 1;
                msg.textContent = 'Playback failed on current mirror — trying next…';
                liveLog.textContent = note + ' → next mirror';
                startMirrorHunt({ fromPlay: true, resume: true });
                return;
              }
              if (advanceRendition(note)) return;
              reportTheaterIssue({
                severity: 'major',
                code: 'wasm_hard_fail',
                message: note,
                rendition: currentRendition(srcLadder, ladderIndex),
                engine: 'wasm',
              });
              ctx.setPlaybackError(note);
            },
            onUnderrun: function (err) {
              destroyWasmPlayer();
              const note = spokenPlaybackError(err);
              if (didPlaySucceed) {
                reportTheaterIssue({
                  severity: 'major',
                  code: 'post_play_collapse',
                  message: note,
                  rendition: currentRendition(srcLadder, ladderIndex),
                  engine: 'wasm',
                });
                ctx.setPlaybackError(note);
                return;
              }
              reportTheaterIssue({
                severity: 'minor',
                code: 'underrun_soft',
                message: note,
                rendition: currentRendition(srcLadder, ladderIndex),
                engine: 'wasm',
              });
              if (advanceRendition(note)) return;
              reportTheaterIssue({
                severity: 'major',
                code: 'wasm_hard_fail',
                message: note,
                rendition: currentRendition(srcLadder, ladderIndex),
                engine: 'wasm',
              });
              ctx.setPlaybackError(note);
            },
            onTimeUpdate: function () {},
          });
        })
        .then(function (api) {
          wasmApi = api;
          ctx.isReady = true;
          pending.style.display = 'none';
          shell.style.display = 'block';
          root.setAttribute('data-seed-state', 'ready');
          ctx.setPlaybackNote('Playing full quality via ' + (where || 'mirror') + (sizeNote || ''));
          ctx.clearPlaybackError();
          if (ctx.pendingSeek != null && typeof api.seek === 'function') {
            try {
              api.seek(ctx.pendingSeek);
              ctx.didInitialSeek = true;
            } catch (_) {}
          }
          if (
            prop(props, 'playing', 'false') === 'true' ||
            root.getAttribute('data-play-requested') === '1'
          ) {
            return api.play && api.play();
          }
        })
        .catch(function (err) {
          destroyWasmPlayer();
          const note = spokenPlaybackError(err);
          if (err && err.code === 'FETCH_FAILED' && mirrorIndex + 1 < mirrors.length) {
            mirrorIndex += 1;
            msg.textContent = 'Playback failed on current mirror — trying next…';
            liveLog.textContent = note + ' → next mirror';
            startMirrorHunt({ fromPlay: true, resume: true });
            return;
          }
          if (advanceRendition(note)) return;
          reportTheaterIssue({
            severity: 'major',
            code:
              err && err.code === 'SOURCE_TOO_LARGE' ? 'wasm_source_too_large' : 'wasm_hard_fail',
            message: note,
            rendition: currentRendition(srcLadder, ladderIndex),
            engine: 'wasm',
          });
          ctx.setPlaybackError(note);
          hint.textContent =
            err && err.code === 'SOURCE_TOO_LARGE'
              ? 'Use “Download the movie” below for VLC / another player while we finish streaming demux and web MP4s.'
              : 'You can download the movie below if a file is listed.';
          liveLog.style.display = 'block';
          liveLog.textContent = note;
          retryBtn.style.display = 'inline-block';
          reportPendingBtn.style.display = 'inline-block';
        });
    }

    video.addEventListener('play', () => invoke(propHandler(props, 'onPlay'), invokeHandler, onAfterInvoke));
    video.addEventListener('pause', () => invoke(propHandler(props, 'onPause'), invokeHandler, onAfterInvoke));
    video.addEventListener('ended', () => invoke(propHandler(props, 'onEnded'), invokeHandler, onAfterInvoke));
    video.addEventListener('waiting', () => ctx.setPlaybackNote('Buffering…'));
    video.addEventListener('playing', () => {
      didPlaySucceed = true;
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
      // Try next mirror first; if mirrors for this path are done, escalate or advance ladder
      if (mirrorIndex + 1 < mirrors.length) {
        mirrorIndex += 1;
        msg.textContent = 'Playback failed on current mirror — trying next…';
        pending.style.display = 'block';
        shell.style.display = 'none';
        startMirrorHunt({ fromPlay: true, resume: true });
        return;
      }
      const cur = srcLadder[ladderIndex];
      const failUrl = activeMirror && activeMirror.mediaUrl ? activeMirror.mediaUrl : '';
      if (
        cur &&
        cur.kind === 'master' &&
        looksMatroskaUrl(failUrl) &&
        wasmTriedForUrl !== failUrl
      ) {
        mountWasmPlayer(failUrl, activeMirror && activeMirror.label, '');
        return;
      }
      if (advanceRendition('Playback failed — trying next quality…')) {
        return;
      }
      const failCode = didPlaySucceed ? 'post_play_collapse' : 'native_hard_fail';
      reportTheaterIssue({
        severity: 'major',
        code: failCode,
        message: 'Playback failed on all qualities and mirrors.',
        rendition: currentRendition(srcLadder, ladderIndex),
        engine: 'native',
      });
      msg.textContent = 'Sorry — we couldn’t play this movie here.';
      hint.textContent = 'You can download the movie below and open it on your computer.';
      liveLog.style.display = 'block';
      liveLog.textContent = 'Playback failed on all qualities and mirrors.';
      pending.style.display = 'block';
      shell.style.display = 'none';
      retryBtn.style.display = 'inline-block';
      reportPendingBtn.style.display = 'inline-block';
    });
    applyCommands(ctx, props);
    shell.appendChild(video);
    attachCcControl(shell, video, subtitleTracks);

    unlock.appendChild(pending);
    unlock.appendChild(shell);
    root.appendChild(unlock);
    root.appendChild(buildDownloadRow(props, srcLadder));

    let attempt = 0;
    let timer = null;
    let stopped = false;
    let huntGen = 0;
    let mirrorIndex = 0;
    let mirrors = buildMirrorList(logicalPathFromSrc(src), DEFAULT_PEER_FQDNS);
    let activeMirror = mirrors[0] || null;
    let probeLog = [];
    const maxRounds = 2;

    function rebuildMirrorsForSrc(nextSrc, peerFqdns) {
      src = nextSrc;
      mirrors = buildMirrorList(logicalPathFromSrc(src), peerFqdns || DEFAULT_PEER_FQDNS);
      activeMirror = mirrors[0] || null;
      mirrorIndex = 0;
      attempt = 0;
      root.setAttribute('data-src', src || '');
      const kind =
        srcLadder[ladderIndex] && srcLadder[ladderIndex].kind
          ? srcLadder[ladderIndex].kind
          : 'media';
      root.setAttribute('data-rendition', kind);
    }

    function advanceRendition(reason) {
      if (didPlaySucceed) return false;
      if (ladderIndex + 1 >= srcLadder.length) return false;
      ladderIndex += 1;
      const next = srcLadder[ladderIndex];
      if (!next || !next.src) return false;
      const prevKind =
        srcLadder[ladderIndex - 1] && srcLadder[ladderIndex - 1].kind
          ? srcLadder[ladderIndex - 1].kind
          : '';
      let note =
        reason ||
        'Trying ' + (next.kind === 'mobile' ? '720p MP4' : next.kind === 'web' ? '1080p MP4' : 'master') + '…';
      if (prevKind === 'master' && (next.kind === 'web' || next.kind === 'mobile')) {
        // Keep a caller-supplied spoken reason when present; otherwise explain the rung.
        if (!reason || reason.indexOf('compatibility') < 0) {
          note =
            'Full quality is unavailable in this browser — switching to ' +
            (next.kind === 'web' ? '1080p' : '720p') +
            ' for compatibility.';
        } else {
          note = reason;
        }
        reportTheaterIssue({
          severity: 'minor',
          code: 'compat_fallback',
          message: note,
          rendition: next.kind,
          engine: 'ladder',
        });
        try {
          ctx.setPlaybackNote(note);
        } catch (_) {}
      }
      liveLog.style.display = 'block';
      liveLog.textContent = note;
      msg.textContent = note.split(' http')[0];
      rebuildMirrorsForSrc(next.src, null);
      pending.style.display = 'block';
      shell.style.display = 'none';
      startMirrorHunt({ fromPlay: true, resume: false });
      return true;
    }

    function setVideoSource(mediaUrl) {
      destroyWasmPlayer();
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
      video.style.display = '';
      video.src = mediaUrl;
    }

    function showReady(mirror, size) {
      activeMirror = mirror || activeMirror;
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
      const mediaUrl = activeMirror && activeMirror.mediaUrl ? activeMirror.mediaUrl : '';
      try {
        shell.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (_) {}
      // Matroska masters: WASM demux → WebCodecs before HTML5 (native usually cannot).
      if (mediaUrl && looksMatroskaUrl(mediaUrl)) {
        mountWasmPlayer(mediaUrl, where, sizeNote);
        return;
      }
      if (mediaUrl) setVideoSource(mediaUrl);
      ctx.setPlaybackNote('Ready via ' + where + sizeNote);
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
            if (name === 'NotAllowedError') {
              ctx.setPlaybackNote('Ready — tap Play on the video controls.');
              return;
            }
            ctx.setPlaybackError('Ready on ' + where + ' but play failed (' + name + ').');
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
      root.setAttribute('data-seed-state', stub ? 'stub' : st.seedState || 'pending');
      pending.setAttribute('data-relay-media', exhausted || permanent ? 'failed' : 'pending');
      const pct = displayPct(st);
      bar.style.display = 'block';
      fill.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', String(pct));
      bar.setAttribute('title', pct + '%');
      hint.style.display = 'block';
      liveLog.style.display = 'block';
      const label = st.mirrorLabel || 'mirror';
      let line = label + ': ';
      if (stub) {
        line += 'blocked — symlink stub ' + formatBytes(st.bytesTotal);
      } else if (st.ok) {
        line += 'playable';
      } else if (st.error === 'timeout') {
        line += 'timed out (no response in time)';
      } else if (st.error) {
        line += (st.message || st.error) + (st.seedState ? ' · seed=' + st.seedState : '');
      } else {
        line += st.message || 'checking…';
      }
      if (typeof st.providers === 'number') {
        line += ' · ' + st.providers + (st.providers === 1 ? ' provider' : ' providers');
      }
      probeLog = probeLog.concat([line]);
      if (probeLog.length > 6) {
        probeLog = probeLog.slice(probeLog.length - 6);
      }
      liveLog.textContent = statusLabel(st) + '\n' + probeLog.join(' → ') + '\n' + statusHint(st);
      if (exhausted || (permanent && stub)) {
        msg.textContent = 'Sorry — we couldn’t play this movie here.';
        hint.textContent = 'You can download the movie below and open it on your computer.';
        pending.className =
          'fb-media fb-media-failed' +
          (root.getAttribute('data-play-requested') === '1' ? ' fb-media-play-requested' : '');
        retryBtn.style.display = 'inline-block';
        reportPendingBtn.style.display = 'inline-block';
      } else if (permanent && !stub) {
        msg.textContent = 'This movie isn’t ready to stream yet.';
        hint.textContent = 'You can download the movie below, or try again in a little while.';
        pending.className =
          'fb-media fb-media-failed' +
          (root.getAttribute('data-play-requested') === '1' ? ' fb-media-play-requested' : '');
        retryBtn.style.display = 'inline-block';
        reportPendingBtn.style.display = 'inline-block';
      } else {
        msg.textContent =
          pct > 0 ? 'Getting the movie ready… ' + pct + '%' : 'Getting the movie ready…';
        hint.textContent = 'This usually takes a moment. Please wait.';
        pending.className =
          'fb-media fb-media-pending' +
          (root.getAttribute('data-play-requested') === '1' ? ' fb-media-play-requested' : '');
        retryBtn.style.display = 'none';
        reportPendingBtn.style.display = 'none';
      }
      if (permanent && !stub && !reportedSeedFail) {
        reportedSeedFail = true;
        reportTheaterIssue({
          severity: 'major',
          code: 'seed_permanent_fail',
          message: st.message || st.error || 'CID permanently unavailable',
          rendition: currentRendition(srcLadder, ladderIndex),
          engine: 'seed',
        });
      }
      const cid = st.cid || cidProp;
      inspectHost.replaceChildren(buildInspect(cid, st.providers, st.bytesTotal));
    }

    function setPhase(text) {
      liveLog.style.display = 'block';
      const prefix = probeLog.length ? probeLog.join(' → ') + ' → ' : '';
      liveLog.textContent = prefix + (text || '');
      // Keep the calm headline; only refresh the waiting copy.
      if (text && text.indexOf('…') >= 0) {
        msg.textContent = 'Getting the movie ready…';
        hint.textContent = 'This usually takes a moment. Please wait.';
      }
    }

    function loadPeerList(done) {
      let left = DEFAULT_PEER_FQDNS.length;
      let found = null;
      function finish() {
        if (found && found.length) {
          mirrors = prioritizeSameOrigin(buildMirrorList(logicalPathFromSrc(src), found));
          activeMirror = mirrors[0] || activeMirror;
        } else {
          mirrors = prioritizeSameOrigin(mirrors);
          activeMirror = mirrors[0] || activeMirror;
        }
        done();
      }
      setPhase('Resolving fleet peer list…');
      for (let i = 0; i < DEFAULT_PEER_FQDNS.length; i++) {
        const fqdn = DEFAULT_PEER_FQDNS[i];
        fetchWithTimeout(
          'https://' + fqdn + '/api/config',
          { credentials: 'omit', cache: 'no-store' },
          3500,
        )
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

    function emptyProbeState(mirror) {
      return {
        ok: false,
        retryable: true,
        error: null,
        message: '',
        progressPct: 0,
        seedState: 'unknown',
        providers: null,
        bytesTotal: null,
        bytesReceived: null,
        retryAfterSecs: 3,
        cid: cidProp,
        mirrorLabel: mirror.label,
        contentType: '',
      };
    }

    function applyRangeResult(st, r2) {
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
        return st;
      }
      if (ct.indexOf('symlink') >= 0) {
        st.ok = false;
        st.stub = true;
        st.retryable = false;
        st.seedState = 'stub';
        st.error = 'ipfs-stub';
        st.message = 'Symlink stub';
        return st;
      }
      if (r2.ok || r2.status === 206) {
        // Range success is authoritative: status endpoints often 504 under load while bytes serve.
        st.ok = true;
        st.seedState = 'ready';
        st.retryable = true;
        st.error = null;
        st.progressPct = 100;
        st.message = 'Range HTTP ' + r2.status;
        return st;
      }
      if (r2.status >= 500 || r2.status === 425 || r2.status === 503 || r2.status === 504) {
        st.ok = false;
        st.retryable = true;
        st.error = 'http-' + r2.status;
        st.message = 'HTTP ' + r2.status;
        return st;
      }
      st.ok = false;
      st.retryable = r2.status !== 410 && r2.status !== 404;
      st.error = 'http-' + r2.status;
      st.message = 'HTTP ' + r2.status;
      return st;
    }

    function probeStatusOnly(mirror, st) {
      const statusUrl =
        mirror.mediaUrl + (mirror.mediaUrl.indexOf('?') >= 0 ? '&' : '?') + 'relayAssetStatus=1';
      setPhase(mirror.label + ': requesting relayAssetStatus…');
      return fetchWithTimeout(statusUrl, { credentials: 'omit', cache: 'no-store' }, 5000)
        .then(function (r) {
          if (!r) {
            throw Object.assign(new Error('No status'), { code: 'network' });
          }
          setPhase(mirror.label + ': parsing status (HTTP ' + r.status + ')…');
          return r.json().catch(function () {
            return null;
          });
        })
        .then(function (j) {
          const parsed = parseStatusJson(j);
          if (parsed) {
            parsed.mirrorLabel = mirror.label;
            if (st.bytesTotal != null && parsed.bytesTotal == null) {
              parsed.bytesTotal = st.bytesTotal;
            }
            return parsed;
          }
          st.message = st.message || 'No status JSON';
          return st;
        })
        .catch(function (err) {
          const code = err && err.code ? err.code : 'network';
          if (!st.message) {
            st.error = code;
            st.message = code === 'timeout' ? 'Status request timed out' : 'Unreachable';
          }
          return st;
        });
    }

    // Range-first: relayAssetStatus often 504s while the same URL serves Range 206 quickly.
    function probeOneMirror(mirror) {
      const st = emptyProbeState(mirror);
      setPhase(mirror.label + ': Range probe bytes=0-0…');
      return fetchWithTimeout(
        mirror.mediaUrl,
        {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
          credentials: 'omit',
          cache: 'no-store',
        },
        8000,
      )
        .then(function (r2) {
          applyRangeResult(st, r2);
          showStatus(st);
          if (st.ok || st.stub) {
            return { mirror: mirror, st: st };
          }
          // Range 4xx/5xx already tells us this mirror cannot serve bytes — skip status
          // (status often 504s for 5+ seconds and stalls the hunt).
          const hardFail =
            st.error &&
            (String(st.error).indexOf('http-4') === 0 ||
              String(st.error).indexOf('http-5') === 0);
          if (hardFail) {
            st.retryAfterSecs = 1;
            return { mirror: mirror, st: st };
          }
          return probeStatusOnly(mirror, st).then(function (st2) {
            showStatus(st2);
            return { mirror: mirror, st: st2 };
          });
        })
        .catch(function (err) {
          const code = err && err.code ? err.code : 'range-fail';
          st.error = code;
          st.message = code === 'timeout' ? 'Range probe timed out' : 'Range probe failed';
          return probeStatusOnly(mirror, st).then(function (st2) {
            // Same-origin only: status-cached may still play when Range probe was slow.
            // Cross-origin (fleet) without Range proof often fails CORS on hung nodes — skip.
            let sameOrigin = false;
            try {
              sameOrigin = mirror.origin === String(global.location.origin || '').replace(/\/$/, '');
            } catch (_) {}
            if (
              sameOrigin &&
              (st2.seedState === 'cached' || st2.seedState === 'ready' || st2.ok)
            ) {
              st2.ok = true;
              st2.seedState = 'ready';
              st2.retryable = true;
              st2.error = null;
              st2.message =
                (code === 'timeout' ? 'Range probe timed out' : 'Range probe failed') +
                ' — trying play from status';
            }
            showStatus(st2);
            return { mirror: mirror, st: st2 };
          });
        });
    }

    function scheduleNext(delayMs) {
      if (stopped || !src) return;
      if (timer) global.clearTimeout(timer);
      let delay = delayMs || 1800;
      if (delay < 600) delay = 600;
      if (delay > 8000) delay = 8000;
      setPhase('Next mirror in ' + Math.round(delay / 100) / 10 + 's…');
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
          if (advanceRendition('All mirrors failed for this file — trying next quality…')) {
            return;
          }
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
            mirrorLabel: 'fleet',
          });
          if (!reportedMirrorsExhausted) {
            reportedMirrorsExhausted = true;
            reportTheaterIssue({
              severity: 'major',
              code: 'mirrors_exhausted',
              message: 'All mirrors failed or still seeding',
              rendition: currentRendition(srcLadder, ladderIndex),
              engine: 'hunt',
            });
          }
          liveLog.textContent =
            'All mirrors exhausted after ' + attempt + ' probes. Tap Retry or re-ingest if stub.';
          retryBtn.style.display = 'inline-block';
          reportPendingBtn.style.display = 'inline-block';
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
      setPhase(mirror.label + ': starting probe…');
      const gen = huntGen;
      probeOneMirror(mirror).then(function (result) {
        if (stopped || gen !== huntGen) return;
        const st = result.st;
        showStatus(st);
        if (!isStubCid(st) && (st.ok || st.seedState === 'cached' || st.seedState === 'ready')) {
          showReady(result.mirror, st.bytesTotal);
          return;
        }
        if (isStubCid(st)) {
          liveLog.textContent =
            st.mirrorLabel +
            ': permanent block — CID is a ' +
            formatBytes(st.bytesTotal) +
            ' symlink stub on every mirror.';
          retryBtn.style.display = 'inline-block';
          return;
        }
        mirrorIndex += 1;
        const delay =
          st && st.retryAfterSecs > 0 ? Math.min(st.retryAfterSecs * 1000, 4000) : 900;
        scheduleNext(delay);
      });
    }

    function startMirrorHunt(opts) {
      opts = opts || {};
      if (!src) {
        pending.style.display = 'block';
        shell.style.display = 'none';
        msg.textContent = 'Sorry — this movie isn’t available to play yet.';
        hint.textContent = 'You can download the movie below if a file is listed.';
        liveLog.style.display = 'block';
        liveLog.textContent = 'error: missing src';
        retryBtn.style.display = 'none';
        return;
      }
      // Invalidate in-flight probes from a prior hunt
      huntGen += 1;
      const gen = huntGen;
      if (timer) {
        global.clearTimeout(timer);
        timer = null;
      }
      if (opts.fromPlay) {
        root.setAttribute('data-play-requested', '1');
        locked.style.display = 'none';
        unlock.style.display = '';
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
      reportPendingBtn.style.display = 'none';
      msg.textContent = 'Getting the movie ready…';
      hint.textContent = 'This usually takes a moment. Please wait.';
      liveLog.style.display = 'block';
      liveLog.textContent = opts.fromPlay ? 'Play → mirror hunt started' : 'Auto mirror hunt started';
      probeLog = [];
      try {
        pending.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (_) {}
      loadPeerList(function () {
        if (stopped || gen !== huntGen) return;
        setPhase(
          'Probing ' +
            mirrors.length +
            ' mirror' +
            (mirrors.length === 1 ? '' : 's') +
            ': ' +
            mirrors
              .map(function (m) {
                return m.label;
              })
              .join(' → '),
        );
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
    const syncUnlockFromDoc = () => {
      try {
        const doc = global.document.documentElement;
        const movieAck = doc.getAttribute('data-fb-movie-ack');
        const welcome = doc.getAttribute('data-fb-welcome-ack');
        const unlocked =
          host.getAttribute('data-unlocked') === 'true' ||
          (movieAck && movieAck.length > 0 && welcome === '1');
        if (unlocked && built.__fbCtx && typeof built.__fbCtx.setUnlocked === 'function') {
          host.setAttribute('data-unlocked', 'true');
          built.__fbCtx.setUnlocked(true);
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
        new global.MutationObserver(syncUnlockFromDoc).observe(global.document.documentElement, {
          attributes: true,
          attributeFilter: ['data-fb-movie-ack', 'data-fb-welcome-ack'],
        });
      }
    } catch (_) {}
    syncUnlockFromDoc();
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
    try {
      const tel = global.__fbTheaterTelemetry;
      if (tel && typeof tel.installMinorErrorSampling === 'function') {
        tel.installMinorErrorSampling();
      }
    } catch (_) {}
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
