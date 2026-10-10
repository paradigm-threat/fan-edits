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

  /**
   * Living-room browsers that often lack VLC / vlc:// but can open an HTTPS
   * progressive stream (webOS, Tizen, Android TV browser, etc.).
   */
  function isSmartTvBrowser() {
    try {
      const ua = String((global.navigator && global.navigator.userAgent) || '');
      if (/Web0S|webOS|WebOS/i.test(ua)) return true;
      if (/Tizen|SmartTV|Smart-TV|SMART-TV|AppleTV|BRAVIA|Viera|NetCast|HbbTV/i.test(ua)) {
        return true;
      }
      if (/Android/i.test(ua) && /(TV|AFT|SHIELD|MIBOX|MiBOX)/i.test(ua)) return true;
      // Large leanback viewport + no touch is a soft signal for TV browsers.
      if (
        global.matchMedia &&
        global.matchMedia('(pointer: coarse)').matches === false &&
        global.innerWidth >= 1200 &&
        /TV|SMART/i.test(ua)
      ) {
        return true;
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
    const masterUrl = absoluteHttps(prop(props, 'streamUrl', ''));
    const webUrl = absoluteHttps(prop(props, 'streamUrlWeb', '') || prop(props, 'data-stream-url-web', ''));
    const mobileUrl = absoluteHttps(
      prop(props, 'streamUrlMobile', '') || prop(props, 'data-stream-url-mobile', ''),
    );
    const ladder = [];
    function pushRung(kind, label, url) {
      const u = String(url || '');
      if (!u) return;
      for (let i = 0; i < ladder.length; i++) {
        if (ladder[i].url === u) return;
      }
      ladder.push({ kind: kind, label: label, url: u });
    }
    pushRung('master', 'Full quality (MKV)', masterUrl);
    pushRung('web', '1080p (H.264)', webUrl);
    pushRung('mobile', '720p (H.264)', mobileUrl);
    const smartTv = isSmartTvBrowser();
    // Prefer H.264 rungs on smart TVs (HEVC MKV often fails; MP4 plays in the TV browser).
    let selectedIdx = 0;
    if (smartTv) {
      const webIdx = ladder.findIndex(function (r) {
        return r.kind === 'web';
      });
      const mobileIdx = ladder.findIndex(function (r) {
        return r.kind === 'mobile';
      });
      if (webIdx >= 0) selectedIdx = webIdx;
      else if (mobileIdx >= 0) selectedIdx = mobileIdx;
    }
    let streamUrl = ladder.length ? ladder[selectedIdx].url : '';
    let dlLink = null;

    let unlocked = ownershipUnlocked(hostEl, prop(props, 'unlocked', 'false') === 'true');
    const setupHref = prop(props, 'setupHref', '/setup') || '/setup';
    const android = isAndroidBrowser();
    const openMode = android ? 'android-intent' : smartTv ? 'https-stream' : 'vlc-protocol';

    const root = global.document.createElement('div');
    root.className = 'fb-external-play fb-theater-external';
    root.setAttribute('data-fb-external-play', '1');
    root.setAttribute('data-playback-engine', 'external');
    root.setAttribute('data-fb-open-mode', openMode);
    root.setAttribute('data-fb-unlocked', unlocked ? 'true' : 'false');
    if (smartTv) root.setAttribute('data-fb-smart-tv', '1');

    const heading = global.document.createElement('p');
    heading.className = 'fb-theater-downloads-label';
    heading.textContent = smartTv ? 'Watch on this TV' : 'Watch in an external player';
    root.appendChild(heading);

    function applyStreamUrl(url, kind) {
      streamUrl = String(url || '');
      if (streamUrl) {
        streamLink.href = streamUrl;
        streamLink.textContent = streamUrl;
        streamLink.removeAttribute('aria-disabled');
      } else {
        streamLink.removeAttribute('href');
        streamLink.textContent = 'No stream URL yet.';
        streamLink.setAttribute('aria-disabled', 'true');
      }
      streamLink.setAttribute('data-fb-stream-url', '1');
      copyBtn.disabled = !streamUrl;
      openHttpsBtn.disabled = !streamUrl;
      if (dlLink) {
        dlLink.href = streamUrl || '#';
        dlLink.textContent = kind === 'master' ? 'Download MKV' : 'Download MP4';
      }
    }

    if (ladder.length > 1) {
      const qualityLabel = global.document.createElement('p');
      qualityLabel.className = 'fb-theater-downloads-label';
      qualityLabel.textContent = 'Quality';
      root.appendChild(qualityLabel);
      const qualityHint = global.document.createElement('p');
      qualityHint.className = 'fb-theater-downloads-note';
      qualityHint.textContent = smartTv
        ? 'On webOS and similar TVs, prefer 1080p/720p (H.264 MP4). Full quality MKV needs a player that supports HEVC Matroska.'
        : 'Full quality needs HEVC. Pick 1080p or 720p for phones/TVs that cannot decode the master.';
      root.appendChild(qualityHint);
      const qualityRow = global.document.createElement('div');
      qualityRow.className = 'fb-external-play-quality';
      qualityRow.setAttribute('role', 'radiogroup');
      qualityRow.setAttribute('aria-label', 'Stream quality');
      for (let qi = 0; qi < ladder.length; qi++) {
        ;(function (idx) {
          const btn = global.document.createElement('button');
          btn.type = 'button';
          btn.className =
            'fb-btn fb-btn-quality' + (idx === selectedIdx ? ' is-active' : '');
          btn.textContent = ladder[idx].label;
          btn.setAttribute('role', 'radio');
          btn.setAttribute('aria-checked', idx === selectedIdx ? 'true' : 'false');
          btn.addEventListener('click', function () {
            selectedIdx = idx;
            applyStreamUrl(ladder[idx].url, ladder[idx].kind);
            const kids = qualityRow.querySelectorAll('.fb-btn-quality');
            for (let k = 0; k < kids.length; k++) {
              const on = k === idx;
              kids[k].classList.toggle('is-active', on);
              kids[k].setAttribute('aria-checked', on ? 'true' : 'false');
            }
            setStatus('Selected ' + ladder[idx].label + '.');
          });
          qualityRow.appendChild(btn);
        })(qi);
      }
      root.appendChild(qualityRow);
    }

    const steps = global.document.createElement('ol');
    steps.className = 'fb-theater-external-steps';
    const stepTexts = android
      ? [
          'Install VLC (or another video app) from the Play Store.',
          'Tap Open in external player — Android asks which app should open the stream.',
          'If nothing opens: Copy stream URL → open VLC → Network → paste the HTTPS link.',
        ]
      : smartTv
        ? [
            'Confirm ownership above (same house rule as always).',
            'Pick 1080p or 720p if Full quality fails on this TV.',
            'Select Open stream link (or the blue URL) — the TV browser / media player opens the HTTPS file.',
          ]
        : [
            'One-time: install VLC and the playback setup (vlc:// handler).',
            'Tap Open in VLC — or Open stream link / the clickable URL on TVs without VLC.',
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
    // Real <a href> so webOS / smart TV remotes can activate the HTTPS stream.
    const streamLink = global.document.createElement('a');
    streamLink.className = 'fb-theater-external-url';
    streamLink.setAttribute('data-fb-stream-url', '1');
    streamLink.setAttribute('rel', 'noopener noreferrer');
    if (streamUrl) {
      streamLink.href = streamUrl;
      streamLink.textContent = streamUrl;
    } else {
      streamLink.textContent = 'No stream URL yet.';
      streamLink.setAttribute('aria-disabled', 'true');
    }
    streamLink.addEventListener('click', function (ev) {
      refreshUnlocked();
      if (!streamUrl) {
        ev.preventDefault();
        setStatus('No stream URL yet.');
        return;
      }
      if (!unlocked) {
        ev.preventDefault();
        setStatus('Confirm ownership first, then open the stream link.');
        try {
          const gate = global.document.querySelector(
            '.fb-affirmation-native, .fb-gate, [aria-modal="true"]',
          );
          if (gate && gate.scrollIntoView) {
            gate.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } catch (_) {}
      }
    });
    urlRow.appendChild(streamLink);
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

    function refreshUnlocked() {
      unlocked = ownershipUnlocked(hostEl, false);
      try {
        const flag = unlocked ? 'true' : 'false';
        // Only write attrs when changed — MutationObserver on data-unlocked would
        // otherwise re-enter forever and freeze the tab (SSR-static / no CleverScript).
        if (root.getAttribute('data-fb-unlocked') !== flag) {
          root.setAttribute('data-fb-unlocked', flag);
        }
        if (unlocked && hostEl && hostEl.getAttribute && hostEl.getAttribute('data-unlocked') !== 'true') {
          hostEl.setAttribute('data-unlocked', 'true');
        }
      } catch (_) {}
      return unlocked;
    }

    function requireUnlocked(actionHint) {
      refreshUnlocked();
      if (!streamUrl) {
        setStatus('No stream URL yet.');
        return false;
      }
      if (!unlocked) {
        setStatus(actionHint || 'Confirm ownership first, then open the stream.');
        try {
          const gate = global.document.querySelector(
            '.fb-affirmation-native, .fb-gate, [aria-modal="true"]',
          );
          if (gate && gate.scrollIntoView) {
            gate.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } catch (_) {}
        return false;
      }
      return true;
    }

    // Direct HTTPS — primary on webOS / smart TVs; available everywhere as fallback.
    const openHttpsBtn = global.document.createElement('button');
    openHttpsBtn.type = 'button';
    openHttpsBtn.className =
      'fb-btn fb-theater-open-https' + (smartTv ? ' fb-btn-primary' : '');
    openHttpsBtn.textContent = 'Open stream link';
    openHttpsBtn.disabled = !streamUrl;
    openHttpsBtn.addEventListener('click', function () {
      clearFailTimer();
      leftPage = false;
      if (
        !requireUnlocked(
          smartTv
            ? 'Confirm ownership first, then tap Open stream link.'
            : 'Confirm ownership first, then open the stream link.',
        )
      ) {
        return;
      }
      setStatus(smartTv ? 'Opening stream on this TV…' : 'Opening HTTPS stream…');
      if (!navigateExternal(streamUrl)) {
        setStatus('Could not open the stream link — try selecting the URL above.');
      }
    });

    const openBtn = global.document.createElement('button');
    openBtn.type = 'button';
    openBtn.className =
      'fb-btn fb-btn-external-play' +
      (android ? ' fb-btn-primary fb-theater-open-intent' : '') +
      (!android && !smartTv ? ' fb-btn-primary fb-theater-open-vlc' : '') +
      (smartTv ? ' fb-theater-open-vlc' : '');
    openBtn.textContent = android ? 'Open in external player' : 'Open in VLC';
    openBtn.addEventListener('click', function () {
      clearFailTimer();
      leftPage = false;
      if (
        !requireUnlocked(
          android
            ? 'Confirm ownership first, then tap Open in external player.'
            : 'Confirm ownership first, then tap Open in VLC.',
        )
      ) {
        return;
      }

      let launch = '';
      if (android) {
        launch = intentViewUrl(streamUrl);
        if (!launch) {
          setStatus('Could not build Android intent link. Use Open stream link or Copy instead.');
          return;
        }
        setStatus('Opening player…');
      } else {
        launch = vlcProtocolUrl(streamUrl);
        if (!launch) {
          setStatus('Could not build vlc:// link. Use Open stream link or Copy instead.');
          return;
        }
        setStatus('Opening VLC…');
      }

      if (!navigateExternal(launch)) {
        setStatus(
          android
            ? 'Could not open an external player. Use Open stream link or Copy.'
            : 'Could not launch vlc://. Use Open stream link or finish Setup.',
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
            ? 'No player opened — try Open stream link, or install VLC from the Play Store.'
            : 'VLC did not open — try Open stream link (works on many TVs), or finish Setup.',
        );
      }, 1400);
    });

    // Smart TV: HTTPS first. Phone/desktop: VLC/intent first, HTTPS still available.
    if (smartTv) {
      actions.appendChild(openHttpsBtn);
      actions.appendChild(openBtn);
    } else {
      actions.appendChild(openBtn);
      actions.appendChild(openHttpsBtn);
    }

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
          smartTv
            ? 'Copied — paste into your TV’s browser or media apps if Open stream link fails.'
            : android
              ? 'Copied — open VLC → Network / Open network stream → paste.'
              : 'Copied — paste into VLC → Media → Open Network Stream.',
        );
      } else {
        setStatus('Copy failed — select the URL above manually.');
      }
    });
    actions.appendChild(copyBtn);

    if (android && streamUrl) {
      dlLink = global.document.createElement('a');
      dlLink.className = 'fb-btn fb-theater-download-mkv';
      dlLink.href = streamUrl;
      dlLink.setAttribute('download', '');
      const kind0 = ladder[selectedIdx] ? ladder[selectedIdx].kind : 'master';
      dlLink.textContent = kind0 === 'master' ? 'Download MKV' : 'Download MP4';
      actions.appendChild(dlLink);
    }

    const setupLink = global.document.createElement('a');
    setupLink.className = 'fb-btn fb-btn-setup';
    setupLink.href = setupHref;
    setupLink.textContent = 'Setup';
    actions.appendChild(setupLink);

    if (!smartTv) {
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
    }

    root.appendChild(actions);

    const note = global.document.createElement('p');
    note.className = 'fb-theater-downloads-note';
    note.textContent = android
      ? 'Browsers cannot play Matroska + HEVC in-page yet. On Android, Open in external player hands the HTTPS stream to VLC (or another app) via the system chooser.'
      : smartTv
        ? 'Many TV browsers (webOS, Tizen, …) cannot run VLC. Open stream link uses the same HTTPS file URL — prefer 1080p/720p H.264 when Full quality fails.'
        : 'Browsers cannot play Matroska + HEVC in-page yet. Open in VLC uses a local vlc:// handler (Setup). On TVs without VLC, use Open stream link or the clickable URL.';
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
  global.__fbExternalPlayIsSmartTv = isSmartTvBrowser;
  global.__fbExternalPlayIntentUrl = intentViewUrl;
})(typeof globalThis !== 'undefined' ? globalThis : window);
