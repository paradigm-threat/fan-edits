/**
 * Web host for `fb-external-play`: Open in VLC (vlc://), Copy stream URL, status, Setup.
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

  function buildExternalPlay(props) {
    const streamUrl = absoluteHttps(prop(props, 'streamUrl', ''));
    const unlocked = prop(props, 'unlocked', 'false') === 'true';
    const setupHref = prop(props, 'setupHref', '/setup') || '/setup';

    const root = global.document.createElement('div');
    root.className = 'fb-external-play fb-theater-external';
    root.setAttribute('data-fb-external-play', '1');
    root.setAttribute('data-playback-engine', 'external');

    const heading = global.document.createElement('p');
    heading.className = 'fb-theater-downloads-label';
    heading.textContent = 'Watch in an external player';
    root.appendChild(heading);

    const steps = global.document.createElement('ol');
    steps.className = 'fb-theater-external-steps';
    const stepTexts = [
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
    openBtn.className = 'fb-btn fb-btn-primary fb-btn-external-play fb-theater-open-vlc';
    openBtn.textContent = 'Open in VLC';
    openBtn.addEventListener('click', function () {
      clearFailTimer();
      if (!streamUrl) {
        setStatus('No stream URL yet.');
        return;
      }
      if (!unlocked) {
        setStatus('Confirm ownership first, then tap Open in VLC.');
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
      const vlc = vlcProtocolUrl(streamUrl);
      if (!vlc) {
        setStatus('Could not build vlc:// link. Use Copy stream URL instead.');
        return;
      }
      setStatus('Opening VLC…');
      try {
        global.location.href = vlc;
      } catch (_) {
        setStatus('Could not launch vlc://. Copy the stream URL or finish Setup.');
        return;
      }
      failTimer = global.setTimeout(function () {
        failTimer = null;
        setStatus(
          'VLC did not open — install the vlc:// handler on Setup, or Copy stream URL and paste in VLC.',
        );
      }, 1200);
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
        setStatus('Copied — paste into VLC → Media → Open Network Stream.');
      } else {
        setStatus('Copy failed — select the URL above manually.');
      }
    });
    actions.appendChild(copyBtn);

    const setupLink = global.document.createElement('a');
    setupLink.className = 'fb-btn fb-btn-setup';
    setupLink.href = setupHref;
    setupLink.textContent = 'Setup';
    actions.appendChild(setupLink);

    const vlcGet = global.document.createElement('a');
    vlcGet.className = 'fb-btn fb-theater-get-vlc';
    vlcGet.href = 'https://www.videolan.org/vlc/';
    vlcGet.target = '_blank';
    vlcGet.rel = 'noopener noreferrer';
    vlcGet.textContent = 'Get VLC';
    actions.appendChild(vlcGet);

    root.appendChild(actions);

    const note = global.document.createElement('p');
    note.className = 'fb-theater-downloads-note';
    note.textContent =
      'Browsers cannot play Matroska + HEVC in-page yet. A local vlc:// handler (Setup) opens the HTTPS stream in VLC.';
    root.appendChild(note);

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
        const built = buildExternalPlay(attrsToProps(host));
        host.replaceChildren(built);
      }
    } catch (_) {}
  }

  function register() {
    if (typeof global.__relayRegisterParkNative === 'function') {
      global.__relayRegisterParkNative('fb-external-play', buildExternalPlay);
    }
    try {
      if (global.customElements && !global.customElements.get('fb-external-play')) {
        global.customElements.define(
          'fb-external-play',
          class extends global.HTMLElement {
            connectedCallback() {
              if (this._fbBuilt) return;
              this._fbBuilt = true;
              const built = buildExternalPlay(attrsToProps(this));
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
})(typeof globalThis !== 'undefined' ? globalThis : window);
