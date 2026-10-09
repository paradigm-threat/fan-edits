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
    style.textContent =
      '@keyframes fb-lcd-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}' +
      '.fb-lcd-track{display:inline-block;white-space:nowrap;will-change:transform;' +
      'animation:fb-lcd-scroll ' +
      secs +
      's linear infinite;}' +
      '@media (prefers-reduced-motion:reduce){.fb-lcd-track{animation:none!important;transform:none}}';
    root.appendChild(style);
  }

  function buildCarousel(root, items) {
    const doc = global.document;
    root.className = 'fb-now-showing fb-now-showing-carousel';
    let idx = 0;
    let busy = false;
    let autoTimer = null;
    const list = items.filter((it) => it && it.title);
    if (list.length === 0) {
      root.textContent = 'No titles yet.';
      return;
    }

    const reduceMotion = (function () {
      try {
        return (
          global.matchMedia &&
          global.matchMedia('(prefers-reduced-motion: reduce)').matches === true
        );
      } catch (_) {
        return false;
      }
    })();

    const head = doc.createElement('div');
    head.className = 'fb-now-showing-head';
    const h2 = doc.createElement('h2');
    h2.className = 'fb-section-title fb-now-showing-title';
    h2.textContent = 'Now showing';
    const counter = doc.createElement('p');
    counter.className = 'fb-now-showing-count fb-slideshow-count';
    head.appendChild(h2);
    head.appendChild(counter);

    const frame = doc.createElement('div');
    frame.className = 'fb-slideshow-frame';
    frame.setAttribute('aria-live', 'polite');

    const stage = doc.createElement('div');
    stage.className = 'fb-slideshow-stage';

    function makeLayer(cls) {
      const a = doc.createElement('a');
      a.className = 'fb-slideshow-media ' + cls;
      a.setAttribute('aria-hidden', cls.indexOf('is-active') >= 0 ? 'false' : 'true');
      const img = doc.createElement('img');
      img.className = 'fb-slideshow-img';
      img.alt = '';
      img.decoding = 'async';
      const copy = doc.createElement('div');
      copy.className = 'fb-slideshow-copy';
      const kicker = doc.createElement('p');
      kicker.className = 'fb-slideshow-kicker';
      kicker.textContent = 'Feature presentation';
      const title = doc.createElement('h3');
      title.className = 'fb-slideshow-title';
      const blurb = doc.createElement('p');
      blurb.className = 'fb-slideshow-blurb';
      copy.appendChild(kicker);
      copy.appendChild(title);
      copy.appendChild(blurb);
      a.appendChild(img);
      a.appendChild(copy);
      return { a: a, img: img, title: title, blurb: blurb };
    }

    const front = makeLayer('fb-slideshow-layer is-active');
    const back = makeLayer('fb-slideshow-layer');
    stage.appendChild(back.a);
    stage.appendChild(front.a);
    frame.appendChild(stage);

    const prev = doc.createElement('button');
    prev.type = 'button';
    prev.className = 'fb-slideshow-nav fb-slideshow-prev';
    prev.setAttribute('aria-label', 'Previous title');
    prev.textContent = '‹';

    const next = doc.createElement('button');
    next.type = 'button';
    next.className = 'fb-slideshow-nav fb-slideshow-next';
    next.setAttribute('aria-label', 'Next title');
    next.textContent = '›';

    function fillLayer(layer, it) {
      layer.a.href = it.href || '#';
      layer.title.textContent = it.title || '';
      const blurbText = it && it.blurb ? String(it.blurb) : '';
      if (blurbText) {
        layer.blurb.textContent = blurbText;
        layer.blurb.style.display = '';
      } else {
        layer.blurb.textContent = '';
        layer.blurb.style.display = 'none';
      }
      if (layer._softRetry) {
        try {
          layer._softRetry.cancel();
        } catch (_) {}
        layer._softRetry = null;
      }
      if (it.poster) {
        layer.img.style.display = '';
        layer.a.classList.add('has-poster');
        const attach = global.__relayAttachSoftRetryImage;
        if (typeof attach === 'function') {
          layer._softRetry = attach(layer.img, it.poster, {});
        } else {
          layer.img.src = it.poster;
        }
      } else {
        layer.img.removeAttribute('src');
        layer.img.removeAttribute('data-relay-img-state');
        layer.img.style.display = 'none';
        layer.a.classList.remove('has-poster');
      }
    }

    function prefetch(i) {
      const it = list[i];
      if (!it || !it.poster) return;
      try {
        const pre = new global.Image();
        pre.decoding = 'async';
        pre.src = it.poster;
      } catch (_) {}
    }

    function paintInstant() {
      const it = list[idx];
      counter.textContent = idx + 1 + ' / ' + list.length;
      fillLayer(front, it);
      front.a.classList.add('is-active');
      front.a.setAttribute('aria-hidden', 'false');
      back.a.classList.remove('is-active');
      back.a.setAttribute('aria-hidden', 'true');
      prefetch((idx + 1) % list.length);
      prefetch((idx - 1 + list.length) % list.length);
    }

    function go(delta) {
      if (list.length < 2) return;
      if (busy) return;
      const nextIdx = (idx + delta + list.length) % list.length;
      if (reduceMotion) {
        idx = nextIdx;
        paintInstant();
        armAuto();
        return;
      }
      busy = true;
      const incoming = list[nextIdx];
      fillLayer(back, incoming);
      // Force style flush so opacity transition runs.
      void back.a.offsetWidth;
      back.a.classList.add('is-active');
      back.a.setAttribute('aria-hidden', 'false');
      front.a.classList.remove('is-active');
      front.a.setAttribute('aria-hidden', 'true');
      counter.textContent = nextIdx + 1 + ' / ' + list.length;

      const finish = function () {
        // Swap roles: keep DOM order stable by copying active into front.
        fillLayer(front, incoming);
        front.a.classList.add('is-active');
        front.a.setAttribute('aria-hidden', 'false');
        back.a.classList.remove('is-active');
        back.a.setAttribute('aria-hidden', 'true');
        idx = nextIdx;
        busy = false;
        prefetch((idx + 1) % list.length);
        armAuto();
      };

      let done = false;
      const onEnd = function (ev) {
        if (done) return;
        if (ev && ev.target !== back.a) return;
        done = true;
        back.a.removeEventListener('transitionend', onEnd);
        finish();
      };
      back.a.addEventListener('transitionend', onEnd);
      global.setTimeout(function () {
        if (done) return;
        done = true;
        back.a.removeEventListener('transitionend', onEnd);
        finish();
      }, 700);
    }

    function armAuto() {
      if (autoTimer) {
        global.clearTimeout(autoTimer);
        autoTimer = null;
      }
      if (reduceMotion || list.length < 2) return;
      autoTimer = global.setTimeout(function () {
        go(1);
      }, 6500);
    }

    prev.addEventListener('click', function () {
      go(-1);
    });
    next.addEventListener('click', function () {
      go(1);
    });

    // Pause autoplay while hovering / focused.
    root.addEventListener('mouseenter', function () {
      if (autoTimer) {
        global.clearTimeout(autoTimer);
        autoTimer = null;
      }
    });
    root.addEventListener('mouseleave', function () {
      armAuto();
    });

    root.appendChild(head);
    const row = doc.createElement('div');
    row.className = 'fb-slideshow-row';
    row.appendChild(prev);
    row.appendChild(frame);
    row.appendChild(next);
    root.appendChild(row);
    paintInstant();
    armAuto();
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
