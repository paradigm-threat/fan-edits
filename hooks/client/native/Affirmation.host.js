/**
 * Web host for park-native tag `fb-affirmation`.
 * Modern JS/CSS; owns CTA + localStorage (CleverScript must not).
 * Checkbox is desktop fine-pointer only — mobile web / touch get a single OK button.
 */
(function (global) {
  'use strict';

  var WKEY = 'flashback.ownershipAck.v1';
  var MPREF = 'flashback.movieOwn.v1.';

  /** Desktop mouse/trackpad: show checkbox. Phones/tablets: one-tap confirm. */
  function preferDesktopCheckbox() {
    try {
      if (!global.matchMedia) return false;
      return global.matchMedia('(hover: hover) and (pointer: fine)').matches;
    } catch (_) {
      return false;
    }
  }

  function prop(props, key, fallback) {
    if (!props) return fallback;
    const keys = [key];
    if (key.indexOf('data-') !== 0) {
      keys.push('data-' + key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()));
    }
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = props[k];
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
    if (v == null) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'object' && v !== null && typeof v.value === 'number') return v.value;
    return null;
  }

  function parseLinks(props) {
    const raw = prop(props, 'linksJson', prop(props, 'links-json', '[]'));
    try {
      const a = JSON.parse(raw);
      return Array.isArray(a) ? a : [];
    } catch (_) {
      return [];
    }
  }

  /**
   * Affirmation-gated unique hit (not playback / VLC).
   * Fail closed if localStorage unavailable. setItem happens in persist() first;
   * undercount if POST fails after write is intentional.
   */
  function reportHit(kind, path) {
    try {
      var payload = { kind: kind };
      if (path) payload.path = path;
      var body = JSON.stringify(payload);
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon('/api/hits', blob)) return;
      }
      if (typeof global.fetch === 'function') {
        global.fetch('/api/hits', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: body,
          keepalive: true,
        }).catch(function () {});
      }
    } catch (_) {
      /* optional */
    }
  }

  function persist(storageKey, mode, slugHint) {
    var wrote = false;
    var isTitle = mode === 'title' || storageKey.indexOf(MPREF) === 0;
    var isWelcome = mode === 'welcome' || storageKey === WKEY;
    try {
      if (typeof global.localStorage === 'undefined' || !global.localStorage.setItem) {
        return;
      }
      // Already counted this browser — do not re-POST.
      var already = false;
      try {
        already = global.localStorage.getItem(storageKey) === '1';
      } catch (_) {
        return;
      }
      global.localStorage.setItem(storageKey, '1');
      wrote = true;
      // Any movie-title ack also satisfies site-wide welcome (unlock CSS needs both).
      if (isTitle) {
        var hadWelcome = false;
        try {
          hadWelcome = global.localStorage.getItem(WKEY) === '1';
        } catch (_) {}
        global.localStorage.setItem(WKEY, '1');
        if (!hadWelcome) {
          reportHit('site_view', null);
        }
      }
      if (!already) {
        if (isTitle) {
          var slug = slugHint || slugFromKey(storageKey) || pathSlug();
          if (slug) reportHit('movie_view', '/' + slug);
        } else if (isWelcome) {
          reportHit('site_view', null);
        }
      }
    } catch (_) {
      return;
    }
    if (!wrote) return;
    try {
      const root = global.document && global.document.documentElement;
      if (!root) return;
      const slug = slugHint || slugFromKey(storageKey);
      if (slug) {
        root.setAttribute('data-fb-movie-ack', slug);
      }
      root.setAttribute('data-fb-welcome-ack', '1');
      syncDocFlags();
    } catch (_) {}
  }

  function slugFromKey(storageKey) {
    if (storageKey.indexOf(MPREF) === 0) return storageKey.slice(MPREF.length);
    return '';
  }

  function pathSlug() {
    try {
      const path = (global.location && global.location.pathname) || '/';
      if (!path || path === '/') return '';
      let p = path.charAt(0) === '/' ? path.slice(1) : path;
      const slash = p.indexOf('/');
      if (slash >= 0) p = p.slice(0, slash);
      return p;
    } catch (_) {
      return '';
    }
  }

  function hasWelcome() {
    try {
      return !!(global.localStorage && global.localStorage.getItem && global.localStorage.getItem(WKEY) === '1');
    } catch (_) {
      return false;
    }
  }

  function hasMovie(slug) {
    try {
      return !!(slug && global.localStorage && global.localStorage.getItem && global.localStorage.getItem(MPREF + slug) === '1');
    } catch (_) {
      return false;
    }
  }

  function syncDocFlags() {
    try {
      const el = global.document.documentElement;
      const ps = pathSlug();
      if (hasWelcome()) el.setAttribute('data-fb-welcome-ack', '1');
      else el.removeAttribute('data-fb-welcome-ack');
      if (ps && hasMovie(ps)) {
        el.setAttribute('data-fb-movie-ack', ps);
        if (hasWelcome()) el.classList.add('fb-playback-unlocked');
      } else {
        el.removeAttribute('data-fb-movie-ack');
        el.classList.remove('fb-playback-unlocked');
      }
    } catch (_) {}
  }

  function ensureCss() {
    try {
      if (global.document.getElementById('fb-own-unlock-css')) return;
      const st = global.document.createElement('style');
      st.id = 'fb-own-unlock-css';
      st.textContent =
        '.fb-media-unlock-target{display:none}' +
        '.fb-video-controls .fb-btn{opacity:.45;pointer-events:none}' +
        'html[data-fb-welcome-ack="1"] .fb-affirmation-native[data-fb-affirmation="welcome"]{display:none!important}' +
        'html[data-fb-welcome-ack="1"][data-fb-movie-ack] .fb-media-locked{display:none!important}' +
        'html[data-fb-welcome-ack="1"][data-fb-movie-ack] .fb-media-unlock-target{display:block!important}' +
        'html[data-fb-welcome-ack="1"][data-fb-movie-ack] .fb-movie-ack{display:none!important}' +
        'html[data-fb-welcome-ack="1"][data-fb-movie-ack] .fb-video-controls .fb-btn{opacity:1;pointer-events:auto}' +
        'html[data-fb-welcome-ack="1"][data-fb-movie-ack] .fb-affirmation-native[data-fb-affirmation="title"]{display:none!important}';
      (global.document.head || global.document.documentElement).appendChild(st);
    } catch (_) {}
  }

  function consumeQueryAcks() {
    try {
      const s = (global.location && global.location.search) || '';
      const path = (global.location && global.location.pathname) || '/';
      let dirty = false;
      if (s.indexOf('ownershipAck=1') >= 0) {
        try {
          global.localStorage.setItem(WKEY, '1');
        } catch (_) {}
        dirty = true;
      }
      const k = 'movieOwnAck=';
      const i = s.indexOf(k);
      if (i >= 0) {
        let slug = s.slice(i + k.length);
        const a = slug.indexOf('&');
        if (a >= 0) slug = slug.slice(0, a);
        try {
          slug = decodeURIComponent(slug);
        } catch (_) {}
        if (slug) {
          try {
            global.localStorage.setItem(MPREF + slug, '1');
            global.localStorage.setItem(WKEY, '1');
          } catch (_) {}
          dirty = true;
        }
      }
      syncDocFlags();
      if (dirty) {
        try {
          global.location.replace(path);
        } catch (_) {
          try {
            global.history.replaceState(null, '', path);
          } catch (_) {}
          syncDocFlags();
        }
      }
    } catch (_) {}
  }

  function bootstrapOwnership() {
    ensureCss();
    consumeQueryAcks();
    syncDocFlags();
  }

  function buildAffirmation(props, invokeHandler, onAfterInvoke) {
    const mode = prop(props, 'mode', 'welcome');
    const title = prop(props, 'title', 'Own the original — then enjoy the edit');
    const eyebrow = prop(props, 'eyebrow', mode === 'title' ? 'CONFIRM' : 'WELCOME');
    const body = prop(
      props,
      'body',
      'Before you play any fan edit here, please confirm you own a legal commercial copy of the corresponding original film.',
    );
    const checkboxLabel = prop(
      props,
      'checkboxLabel',
      'I confirm I own a legal copy of each original film before I play its edit.',
    );
    const confirmLabel = prop(props, 'confirmLabel', 'OK — I confirm');
    const storageKey = prop(props, 'storageKey', WKEY);
    const confirmed = prop(props, 'confirmed', 'false') === 'true';
    const onConfirmId = propHandler(props, 'onConfirm');
    const links = parseLinks(props);
    const slugHint = slugFromKey(storageKey);

    // Already acked in LS — stay hidden even if CS soft-hydrate resets confirmed.
    if (confirmed || (storageKey === WKEY ? hasWelcome() : hasMovie(slugHint))) {
      const hidden = global.document.createElement('div');
      hidden.className = 'fb-gate fb-affirmation-native';
      hidden.setAttribute('data-fb-affirmation', mode);
      hidden.setAttribute('data-confirmed', '1');
      hidden.style.display = 'none';
      return hidden;
    }

    const root = global.document.createElement('div');
    root.className = 'fb-gate fb-affirmation-native';
    root.setAttribute('data-fb-affirmation', mode);
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');

    const panel = global.document.createElement('div');
    panel.className = 'fb-gate-panel fb-gate-card';

    const eye = global.document.createElement('p');
    eye.className = 'fb-gate-eyebrow';
    eye.textContent = eyebrow;
    panel.appendChild(eye);

    const h = global.document.createElement('h2');
    h.className = 'fb-gate-title';
    h.textContent = title;
    panel.appendChild(h);

    const bodyEl = global.document.createElement('div');
    bodyEl.className = 'fb-gate-body';
    body.split(/\n\n+/).forEach((para) => {
      const p = global.document.createElement('p');
      p.textContent = para.trim();
      if (p.textContent) bodyEl.appendChild(p);
    });
    panel.appendChild(bodyEl);

    const desktopCheck = preferDesktopCheckbox();
    let cb = null;
    let box = null;
    if (desktopCheck) {
      box = global.document.createElement('label');
      box.className = 'fb-gate-check-box';
      cb = global.document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'fb-gate-check';
      cb.setAttribute('aria-required', 'true');
      const cbText = global.document.createElement('span');
      cbText.textContent = checkboxLabel;
      box.appendChild(cb);
      box.appendChild(cbText);
      panel.appendChild(box);

      const hint = global.document.createElement('p');
      hint.className = 'fb-gate-hint';
      hint.textContent = 'Check the box above, then tap OK to continue.';
      panel.appendChild(hint);
    }

    const btn = global.document.createElement('button');
    btn.type = 'button';
    btn.className = 'fb-btn fb-btn-primary fb-gate-ok';
    btn.textContent = confirmLabel;

    function doConfirm() {
      if (cb && !cb.checked) {
        cb.focus();
        if (box) box.classList.add('fb-gate-check-box-warn');
        return;
      }
      persist(storageKey, mode, slugHint);
      root.style.display = 'none';
      root.setAttribute('data-confirmed', '1');
      if (onConfirmId != null && typeof invokeHandler === 'function') {
        try {
          invokeHandler(onConfirmId);
        } catch (_) {}
      }
      if (typeof onAfterInvoke === 'function') {
        try {
          onAfterInvoke();
        } catch (_) {}
      }
    }

    btn.addEventListener('click', doConfirm);
    btn.addEventListener('pointerdown', () => {
      if (!cb || cb.checked) persist(storageKey, mode, slugHint);
    });
    panel.appendChild(btn);

    if (links.length) {
      const foot = global.document.createElement('p');
      foot.className = 'fb-gate-links';
      links.forEach((link, i) => {
        if (!link || !link.href) return;
        if (i > 0) foot.appendChild(global.document.createTextNode(' · '));
        const a = global.document.createElement('a');
        a.href = String(link.href);
        a.textContent = String(link.label || link.href);
        foot.appendChild(a);
      });
      panel.appendChild(foot);
    }

    root.appendChild(panel);
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
      return fn(host, '.fb-affirmation-native');
    }
    return host && !host.querySelector('.fb-affirmation-native');
  }

  function upgradePlaceholders() {
    try {
      const nodes = global.document.querySelectorAll('[data-relay-park-native="fb-affirmation"]');
      for (let i = 0; i < nodes.length; i++) {
        const host = nodes[i];
        if (!needsUpgrade(host)) continue;
        host.setAttribute('data-fb-built', '1');
        const built = buildAffirmation(attrsToProps(host), null, null);
        host.replaceChildren(built);
      }
    } catch (_) {}
  }

  function register() {
    const reg = global.__relayRegisterParkNative;
    if (typeof reg === 'function') {
      reg('fb-affirmation', buildAffirmation);
    }
    try {
      if (global.customElements && !global.customElements.get('fb-affirmation')) {
        global.customElements.define(
          'fb-affirmation',
          class extends global.HTMLElement {
            connectedCallback() {
              if (this._fbBuilt) return;
              this._fbBuilt = true;
              const built = buildAffirmation(
                attrsToProps(this),
                () => {
                  this.dispatchEvent(new Event('confirm'));
                },
                null,
              );
              this.replaceChildren(built);
            }
          },
        );
      }
    } catch (_) {}
    upgradePlaceholders();
  }

  function boot() {
    bootstrapOwnership();
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
      sched(() => {
        register();
        bootstrapOwnership();
      });
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

  global.__fbBuildAffirmation = buildAffirmation;
  global.__fbSyncOwnershipFlags = syncDocFlags;
})(typeof globalThis !== 'undefined' ? globalThis : window);
