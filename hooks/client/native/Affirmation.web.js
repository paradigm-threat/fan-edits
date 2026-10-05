/**
 * Web host for park-native tag `fb-affirmation`.
 * Modern JS/CSS; owns checkbox + CTA + localStorage (CleverScript must not).
 */
(function (global) {
  'use strict';

  function prop(props, key, fallback) {
    if (!props) return fallback;
    const v = props[key];
    if (v == null) return fallback;
    if (typeof v === 'object' && v !== null && 'value' in v) return v.value != null ? String(v.value) : fallback;
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
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
    const raw = prop(props, 'linksJson', '[]');
    try {
      const a = JSON.parse(raw);
      return Array.isArray(a) ? a : [];
    } catch (_) {
      return [];
    }
  }

  function persist(storageKey, mode, slugHint) {
    try {
      if (global.localStorage && global.localStorage.setItem) {
        global.localStorage.setItem(storageKey, '1');
      }
    } catch (_) {}
    try {
      const root = global.document && global.document.documentElement;
      if (!root) return;
      if (mode === 'title' && slugHint) {
        root.setAttribute('data-fb-movie-ack', slugHint);
        root.setAttribute('data-fb-welcome-ack', '1');
      } else {
        root.setAttribute('data-fb-welcome-ack', '1');
      }
    } catch (_) {}
  }

  function slugFromKey(storageKey) {
    const p = 'flashback.movieOwn.v1.';
    if (storageKey.indexOf(p) === 0) return storageKey.slice(p.length);
    return '';
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
    const storageKey = prop(props, 'storageKey', 'flashback.ownershipAck.v1');
    const confirmed = prop(props, 'confirmed', 'false') === 'true';
    const onConfirmId = propHandler(props, 'onConfirm');
    const links = parseLinks(props);
    const slugHint = slugFromKey(storageKey);

    const root = global.document.createElement('div');
    root.className = 'fb-gate fb-affirmation-native';
    root.setAttribute('data-fb-affirmation', mode);
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');

    if (confirmed) {
      root.style.display = 'none';
      root.setAttribute('data-confirmed', '1');
      return root;
    }

    const panel = global.document.createElement('div');
    panel.className = 'fb-gate-panel';

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

    const box = global.document.createElement('label');
    box.className = 'fb-gate-check-box';
    const cb = global.document.createElement('input');
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

    const btn = global.document.createElement('button');
    btn.type = 'button';
    btn.className = 'fb-btn fb-btn-primary fb-gate-ok';
    btn.textContent = confirmLabel;

    function doConfirm() {
      if (!cb.checked) {
        cb.focus();
        box.classList.add('fb-gate-check-box-warn');
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
    btn.addEventListener('pointerdown', (ev) => {
      if (cb.checked) {
        // Persist early so soft-hydrate remounts still see ack
        persist(storageKey, mode, slugHint);
      }
    });
    panel.appendChild(btn);

    if (links.length) {
      const foot = global.document.createElement('p');
      foot.className = 'fb-gate-links';
      links.forEach((link, i) => {
        if (!link || !link.href) return;
        if (i > 0) {
          foot.appendChild(global.document.createTextNode(' · '));
        }
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
              const props = {};
              for (let i = 0; i < this.attributes.length; i++) {
                const a = this.attributes[i];
                props[a.name] = a.value;
              }
              const built = buildAffirmation(
                props,
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
  }

  register();
  if (typeof global.document !== 'undefined') {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', register);
    }
  }

  global.__fbBuildAffirmation = buildAffirmation;
})(typeof globalThis !== 'undefined' ? globalThis : window);
