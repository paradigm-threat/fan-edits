/**
 * Web host for `fb-now-showing`: LCD marquee (variant=lcd) or carousel (variant=carousel).
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
      return String(v);
    }
    return fallback;
  }

  function parseItems(props) {
    try {
      const a = JSON.parse(prop(props, 'itemsJson', '[]'));
      return Array.isArray(a) ? a : [];
    } catch (_) {
      return [];
    }
  }

  function bulb(doc, i) {
    const s = doc.createElement('span');
    s.className = 'fb-marquee-bulb fb-bulb-' + (i % 4);
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  function wing(doc, phrase) {
    const w = doc.createElement('div');
    w.className = 'fb-marquee-wing';
    w.setAttribute('aria-hidden', 'true');
    const letters = String(phrase || '').split('');
    let bi = 0;
    w.appendChild(bulb(doc, bi++));
    letters.forEach((ch) => {
      if (ch === ' ') {
        const sp = doc.createElement('span');
        sp.className = 'fb-marquee-wing-gap';
        sp.textContent = ' ';
        w.appendChild(sp);
      } else {
        const L = doc.createElement('span');
        L.className = 'fb-marquee-wing-letter';
        L.textContent = ch;
        w.appendChild(L);
      }
      w.appendChild(bulb(doc, bi++));
    });
    return w;
  }

  function buildLcd(root, items) {
    const doc = global.document;
    root.className = 'fb-marquee fb-now-showing-lcd';

    const board = doc.createElement('div');
    board.className = 'fb-marquee-board';

    board.appendChild(wing(doc, 'now'));

    const lcd = doc.createElement('div');
    lcd.className = 'fb-lcd';
    const track = doc.createElement('div');
    track.className = 'fb-lcd-track';

    const parts = [];
    items.forEach((it) => {
      if (!it || !it.title) return;
      parts.push(it);
    });
    if (parts.length === 0) {
      const empty = doc.createElement('span');
      empty.className = 'fb-lcd-empty';
      empty.textContent = '★ catalog ★';
      track.appendChild(empty);
    } else {
      const makeSeg = (list) => {
        list.forEach((it) => {
          const star = doc.createElement('span');
          star.className = 'fb-lcd-star';
          star.textContent = ' ★ ';
          track.appendChild(star);
          if (it.href) {
            const a = doc.createElement('a');
            a.className = 'fb-lcd-link';
            a.href = it.href;
            a.textContent = it.title;
            track.appendChild(a);
          } else {
            const span = doc.createElement('span');
            span.className = 'fb-lcd-text';
            span.textContent = it.title;
            track.appendChild(span);
          }
        });
      };
      makeSeg(parts);
      makeSeg(parts);
    }

    const win = doc.createElement('div');
    win.className = 'fb-lcd-window';
    win.appendChild(track);
    lcd.appendChild(win);
    board.appendChild(lcd);
    board.appendChild(wing(doc, 'showing'));
    root.appendChild(board);

    const style = doc.createElement('style');
    const n = Math.max(24, (track.textContent || '').length);
    const secs = Math.max(40, Math.min(180, n * 0.08));
    const steps = Math.max(40, Math.min(400, Math.floor(n / 4)));
    style.textContent =
      '@keyframes fb-lcd-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}' +
      '.fb-lcd-track{display:inline-block;white-space:nowrap;animation:fb-lcd-scroll ' +
      secs +
      's steps(' +
      steps +
      ') infinite;}' +
      '@media (prefers-reduced-motion:reduce){.fb-lcd-track{animation:none!important}}';
    root.appendChild(style);
  }

  function buildCarousel(root, items) {
    const doc = global.document;
    root.className = 'fb-now-showing fb-now-showing-carousel';
    let idx = 0;
    const list = items.filter((it) => it && it.title);
    if (list.length === 0) {
      root.textContent = 'No titles yet.';
      return;
    }

    const counter = doc.createElement('div');
    counter.className = 'fb-slideshow-count';
    const frame = doc.createElement('div');
    frame.className = 'fb-slideshow-frame';
    const media = doc.createElement('a');
    media.className = 'fb-slideshow-media';
    const img = doc.createElement('img');
    img.alt = '';
    media.appendChild(img);
    const title = doc.createElement('div');
    title.className = 'fb-slideshow-title';
    media.appendChild(title);
    frame.appendChild(media);

    const next = doc.createElement('button');
    next.type = 'button';
    next.className = 'fb-slideshow-next';
    next.setAttribute('aria-label', 'Next');
    next.textContent = '›';

    function paint() {
      const it = list[idx];
      counter.textContent = idx + 1 + ' / ' + list.length;
      media.href = it.href || '#';
      title.textContent = it.title;
      if (it.poster) {
        img.src = it.poster;
        img.style.display = '';
      } else {
        img.removeAttribute('src');
        img.style.display = 'none';
        title.textContent = it.title;
      }
    }

    next.addEventListener('click', () => {
      idx = (idx + 1) % list.length;
      paint();
    });

    root.appendChild(counter);
    const row = doc.createElement('div');
    row.className = 'fb-slideshow-row';
    row.appendChild(frame);
    row.appendChild(next);
    root.appendChild(row);
    paint();
  }

  function buildNowShowing(props) {
    const variant = prop(props, 'variant', 'lcd');
    const items = parseItems(props);
    const root = global.document.createElement('div');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', prop(props, 'ariaLabel', 'Now showing'));
    if (variant === 'carousel') buildCarousel(root, items);
    else buildLcd(root, items);
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
      return fn(host, '.fb-marquee, .fb-now-showing-carousel');
    }
    return host && !host.querySelector('.fb-marquee, .fb-now-showing-carousel');
  }

  function upgradePlaceholders() {
    try {
      const nodes = global.document.querySelectorAll('[data-relay-park-native="fb-now-showing"]');
      for (let i = 0; i < nodes.length; i++) {
        const host = nodes[i];
        if (!needsUpgrade(host)) continue;
        host.setAttribute('data-fb-built', '1');
        const built = buildNowShowing(attrsToProps(host));
        host.replaceChildren(built);
      }
    } catch (_) {}
  }

  function register() {
    if (typeof global.__relayRegisterParkNative === 'function') {
      global.__relayRegisterParkNative('fb-now-showing', buildNowShowing);
    }
    try {
      if (global.customElements && !global.customElements.get('fb-now-showing')) {
        global.customElements.define(
          'fb-now-showing',
          class extends global.HTMLElement {
            connectedCallback() {
              if (this._fbBuilt) return;
              this._fbBuilt = true;
              const built = buildNowShowing(attrsToProps(this));
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
  global.__fbBuildNowShowing = buildNowShowing;
})(typeof globalThis !== 'undefined' ? globalThis : window);
