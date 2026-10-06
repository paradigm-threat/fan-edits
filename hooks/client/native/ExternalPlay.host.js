/**
 * Web host for `fb-external-play`.
 * Desktop: Open in VLC via vlc://. Android browsers: intent ACTION_VIEW (video/*).
 * CleverScript only passes data attrs — all click handling lives here.
 */
(function (global) {
  'use strict';

  function prop(props, key, fallback) {
    if (!props) return fallback;
    const keys = [key];
    if (key.indexOf('data-') !== 0) {
      keys.push('data-' + key.replace(/[A-Z]/g, function (m) {
        return '-' + m.toLowerCase();
      }));
    }
    for (let i = 0; i < keys.length; i++) {
      const v = props[keys[i]];
      if (v == null) continue;
      if (typeof v === 'object' && v !== null && 'value' in v) {
        return v.value != null ? String(v.value) : fallback;
      }
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      return String(v);
    }
    return fallback;
  }

  function absoluteHttps(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    if (u.indexOf('https://') === 0 || u.indexOf('http://') === 0) return u;
    try {
      if (global.location && global.location.origin) {
        if (u.charAt(0) === '/') return global.location.origin + u;
        return global.location.origin + '/' + u;
      }
    } catch (_) {}
    if (u.charAt(0) === '/') return 'https://flashbackrepository.org' + u;
    return 'https://flashbackrepository.org/' + u;
  }

  /** Chrome / Firefox / Samsung Internet / WebView on Android (not iOS). */
  function isAndroidBrowser() {
    try {
      const nav = global.navigator;
      if (!nav) return false;
      const ua = String(nav.userAgent || '');
      if (/Android/i.test(ua) && !/Windows Phone/i.test(ua)) return true;
      // Chromium client hints (when available)
      const uaData = nav.userAgentData;
      if (uaData && typeof uaData.platform === 'string') {
        if (String(uaData.platform).toLowerCase() === 'android') return true;
      }
    } catch (_) {}
    return false;
  }

  function vlcProtocolUrl(httpsUrl) {
    const u = absoluteHttps(httpsUrl);
    if (u.indexOf('https://') !== 0 && u.indexOf('http://') !== 0) return '';
    try {
      if (global.encodeURIComponent) {
        return 'vlc://weblink?url=' + global.encodeURIComponent(u);
      }
    } catch (_) {}
    return 'vlc://' + u;
  }

  /** Android Chrome intent URL — system chooser / VLC (no package pin). */
  function intentViewUrl(httpsUrl) {
    const u = absoluteHttps(httpsUrl);
    if (u.indexOf('https://') !== 0 && u.indexOf('http://') !== 0) return '';
    return (
      'intent:' +
      u +
      '#Intent;action=android.intent.action.VIEW;type=video/*;scheme=https;end'
    );
  }

  /**
   * Navigate to a custom scheme / intent from a user gesture.
   * Prefer a temporary <a> click (Chrome Android is pickier about location.href for intent:).
   */
  function navigateExternal(href) {
    const h = String(href || '');
    if (!h) return false;
    try {
      const doc = global.document;
      if (doc && doc.body && doc.createElement) {
        const a = doc.createElement('a');
        a.href = h;
        a.setAttribute('rel', 'noopener noreferrer');
        a.style.display = 'none';
        doc.body.appendChild(a);
        a.click();
        try {
          doc.body.removeChild(a);
        } catch (_) {}
        return true;
      }
    } catch (_) {}
    try {
      global.location.href = h;
      return true;
    } catch (_) {
      return false;
    }
  }

  function copyText(text) {
    const t = String(text || '');
    if (!t) return false;
    try {
      if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
        global.navigator.clipboard.writeText(t);
        return true;
      }
    } catch (_) {}
    try {
      const ta = global.document.createElement('textarea');
      ta.value = t;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      global.document.body.appendChild(ta);
      ta.select();
      const ok = global.document.execCommand && global.document.execCommand('copy');
      global.document.body.removeChild(ta);
      return !!ok;
    } catch (_) {
      return false;
    }
  }

  /** Live unlock: stub attrs can lag Affirmation; html data-fb-* is authoritative. */
  function ownershipUnlocked(hostEl, propsUnlocked) {
    if (propsUnlocked === true) return true;
    try {
      if (hostEl && hostEl.getAttribute && hostEl.getAttribute('data-unlocked') === 'true') {
        return true;
      }
    } catch (_) {}
    try {
      const doc = global.document && global.document.documentElement;
      if (!doc) return false;
      const movieAck = doc.getAttribute('data-fb-movie-ack');
      const welcome = doc.getAttribute('data-fb-welcome-ack');
      return !!(movieAck && movieAck.length > 0 && welcome === '1');
    } catch (_) {
      return false;
    }
  }

  function buildExternalPlay(props, hostEl) {
    const streamUrl = absoluteHttps(prop(props, 'streamUrl', ''));
    let unlocked = ownershipUnlocked(hostEl, prop(props, 'unlocked', 'false') === 'true');
    const setupHref = prop(props, 'setupHref', '/setup') || '/setup';
    const android = isAndroidBrowser();
    const openMode = android ? 'android-intent' : 'vlc-protocol';

    const root = global.document.createElement('div');
    root.className = 'fb-external-play fb-theater-external';
    root.setAttribute('data-fb-external-play', '1');
    root.setAttribute('data-playback-engine', 'external');
    root.setAttribute('data-fb-open-mode', openMode);
    root.setAttribute('data-fb-unlocked', unlocked ? 'true' : 'false');

    const heading = global.document.createElement('p');
    heading.className = 'fb-theater-downloads-label';
    heading.textContent = 'Watch in an external player';
    root.appendChild(heading);

    const steps = global.document.createElement('ol');
    steps.className = 'fb-theater-external-steps';
    const stepTexts = android
      ? [
          'Install VLC (or another video app) from the Play Store.',
          'Tap Open in external player — Android asks which app should open the stream.',
          'If nothing opens: Copy stream URL → open VLC → Network → paste the HTTPS link.',
        ]
      : [
          'One-time: install VLC and the playback setup (vlc:// handler).',
          'Tap Open in VLC (or Copy stream URL).',
          'If nothing opens: VLC → Media → Open Network Stream… → paste → Play.',
        ];
    for (let i = 0; i < stepTexts.length; i++) {
      const li = global.document.createElement('li');
      li.textContent = stepTexts[i];
      steps.appendChild(li);
    }
    root.appendChild(steps);

    const urlRow = global.document.createElement('div');
    urlRow.className = 'fb-theater-external-url-row';
    const code = global.document.createElement('code');
    code.className = 'fb-theater-external-url';
    code.setAttribute('data-fb-stream-url', '1');
    code.textContent = streamUrl || 'No stream URL yet.';
    urlRow.appendChild(code);
    root.appendChild(urlRow);

    const status = global.document.createElement('p');
    status.className = 'fb-theater-external-status';
    status.setAttribute('data-fb-external-status', '1');
    status.hidden = true;
    root.appendChild(status);

    let failTimer = null;
    let leftPage = false;

    function onPageHide() {
      leftPage = true;
      clearFailTimer();
    }
    function onVisibility() {
      try {
        if (global.document && global.document.visibilityState === 'hidden') {
          leftPage = true;
          clearFailTimer();
        }
      } catch (_) {}
    }
    try {
      global.addEventListener('pagehide', onPageHide);
      global.addEventListener('visibilitychange', onVisibility);
    } catch (_) {}

    function setStatus(msg) {
      const m = String(msg || '');
      if (!m) {
        status.textContent = '';
        status.hidden = true;
        return;
      }
      status.textContent = m;
      status.hidden = false;
    }

    function clearFailTimer() {
      if (failTimer) {
        global.clearTimeout(failTimer);
        failTimer = null;
      }
    }

    const actions = global.document.createElement('div');
    actions.className = 'fb-external-play-actions fb-theater-external-actions';

    const openBtn = global.document.createElement('button');
    openBtn.type = 'button';
    openBtn.className =
      'fb-btn fb-btn-primary fb-btn-external-play' +
      (android ? ' fb-theater-open-intent' : ' fb-theater-open-vlc');
    openBtn.textContent = android ? 'Open in external player' : 'Open in VLC';
    function refreshUnlocked() {
      unlocked = ownershipUnlocked(hostEl, false);
      try {
        root.setAttribute('data-fb-unlocked', unlocked ? 'true' : 'false');
        if (unlocked && hostEl && hostEl.setAttribute) {
          hostEl.setAttribute('data-unlocked', 'true');
        }
      } catch (_) {}
      return unlocked;
    }

    openBtn.addEventListener('click', function () {
      clearFailTimer();
      leftPage = false;
      refreshUnlocked();
      if (!streamUrl) {
        setStatus('No stream URL yet.');
        return;
      }
      if (!unlocked) {
        setStatus(
          android
            ? 'Confirm ownership first, then tap Open in external player.'
            : 'Confirm ownership first, then tap Open in VLC.',
        );
        try {
          const gate = global.document.querySelector(
            '.fb-affirmation-native, .fb-gate, [aria-modal="true"]',
          );
          if (gate && gate.scrollIntoView) {
            gate.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } catch (_) {}
        return;
      }

      let launch = '';
      if (android) {
        launch = intentViewUrl(streamUrl);
        if (!launch) {
          setStatus('Could not build Android intent link. Use Copy stream URL instead.');
          return;
        }
        setStatus('Opening player…');
      } else {
        launch = vlcProtocolUrl(streamUrl);
        if (!launch) {
          setStatus('Could not build vlc:// link. Use Copy stream URL instead.');
          return;
        }
        setStatus('Opening VLC…');
      }

      if (!navigateExternal(launch)) {
        setStatus(
          android
            ? 'Could not open an external player. Copy the stream URL and paste it in VLC.'
            : 'Could not launch vlc://. Copy the stream URL or finish Setup.',
        );
        return;
      }

      failTimer = global.setTimeout(function () {
        failTimer = null;
        if (leftPage) return;
        try {
          if (global.document && global.document.visibilityState === 'hidden') return;
        } catch (_) {}
        setStatus(
          android
            ? 'No player opened — install VLC from the Play Store, or Copy stream URL and open it in VLC → Network.'
            : 'VLC did not open — install the vlc:// handler on Setup, or Copy stream URL and paste in VLC.',
        );
      }, 1400);
    });
    actions.appendChild(openBtn);

    const copyBtn = global.document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'fb-btn fb-theater-copy-stream';
    copyBtn.textContent = 'Copy stream URL';
    copyBtn.disabled = !streamUrl;
    copyBtn.addEventListener('click', function () {
      clearFailTimer();
      if (!streamUrl) {
        setStatus('No stream URL yet.');
        return;
      }
      if (copyText(streamUrl)) {
        setStatus(
          android
            ? 'Copied — open VLC → Network / Open network stream → paste.'
            : 'Copied — paste into VLC → Media → Open Network Stream.',
        );
      } else {
        setStatus('Copy failed — select the URL above manually.');
      }
    });
    actions.appendChild(copyBtn);

    if (android && streamUrl) {
      const dl = global.document.createElement('a');
      dl.className = 'fb-btn fb-theater-download-mkv';
      dl.href = streamUrl;
      dl.setAttribute('download', '');
      dl.textContent = 'Download MKV';
      actions.appendChild(dl);
    }

    const setupLink = global.document.createElement('a');
    setupLink.className = 'fb-btn fb-btn-setup';
    setupLink.href = setupHref;
    setupLink.textContent = 'Setup';
    actions.appendChild(setupLink);

    const vlcGet = global.document.createElement('a');
    vlcGet.className = 'fb-btn fb-theater-get-vlc';
    if (android) {
      vlcGet.href = 'https://play.google.com/store/apps/details?id=org.videolan.vlc';
      vlcGet.textContent = 'Get VLC (Play Store)';
    } else {
      vlcGet.href = 'https://www.videolan.org/vlc/';
      vlcGet.textContent = 'Get VLC';
    }
    vlcGet.target = '_blank';
    vlcGet.rel = 'noopener noreferrer';
    actions.appendChild(vlcGet);

    root.appendChild(actions);

    const note = global.document.createElement('p');
    note.className = 'fb-theater-downloads-note';
    note.textContent = android
      ? 'Browsers cannot play Matroska + HEVC in-page yet. On Android, Open in external player hands the HTTPS stream to VLC (or another app) via the system chooser.'
      : 'Browsers cannot play Matroska + HEVC in-page yet. A local vlc:// handler (Setup) opens the HTTPS stream in VLC.';
    root.appendChild(note);

    // Affirmation sets html data-fb-* after first build — keep unlocked in sync.
    try {
      if (global.MutationObserver) {
        const sync = function () {
          refreshUnlocked();
        };
        if (hostEl) {
          new global.MutationObserver(sync).observe(hostEl, {
            attributes: true,
            attributeFilter: ['data-unlocked'],
          });
        }
        if (global.document && global.document.documentElement) {
          new global.MutationObserver(sync).observe(global.document.documentElement, {
            attributes: true,
            attributeFilter: ['data-fb-movie-ack', 'data-fb-welcome-ack'],
          });
        }
      }
    } catch (_) {}
    refreshUnlocked();

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
      return fn(host, '.fb-external-play');
    }
    return host && !host.querySelector('.fb-external-play');
  }

  function upgradePlaceholders() {
    try {
      const nodes = global.document.querySelectorAll('[data-relay-park-native="fb-external-play"]');
      for (let i = 0; i < nodes.length; i++) {
        const host = nodes[i];
        if (!needsUpgrade(host)) continue;
        host.setAttribute('data-fb-built', '1');
        const built = buildExternalPlay(attrsToProps(host), host);
        host.replaceChildren(built);
      }
    } catch (_) {}
  }

  function register() {
    if (typeof global.__relayRegisterParkNative === 'function') {
      global.__relayRegisterParkNative('fb-external-play', function (props) {
        return buildExternalPlay(props, null);
      });
    }
    try {
      if (global.customElements && !global.customElements.get('fb-external-play')) {
        global.customElements.define(
          'fb-external-play',
          class extends global.HTMLElement {
            connectedCallback() {
              if (this._fbBuilt) return;
              this._fbBuilt = true;
              const built = buildExternalPlay(attrsToProps(this), this);
              this.replaceChildren(built);
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
    const t = global.setInterval(function () {
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
  global.__fbBuildExternalPlay = buildExternalPlay;
  global.__fbExternalPlayIsAndroid = isAndroidBrowser;
  global.__fbExternalPlayIntentUrl = intentViewUrl;
})(typeof globalThis !== 'undefined' ? globalThis : window);
