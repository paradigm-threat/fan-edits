/**
 * Web host for `fb-now-showing`: LCD marquee (variant=lcd) or carousel (variant=carousel).
 */
(function (global) {
  'use strict';

  var LCD_ANIM_STYLE_ID = 'fb-now-showing-lcd-anim';
  var FADE_MS = 1100;
  var AUTO_MS = 10000;

  /** Test / harness override: `{ fadeMs, autoMs }` (autoMs 0 disables autoplay). */
  function timing() {
    const t = global.__fbNowShowingTiming || {};
    const fadeMs = typeof t.fadeMs === 'number' && t.fadeMs > 0 ? t.fadeMs : FADE_MS;
    const autoMs = typeof t.autoMs === 'number' ? t.autoMs : AUTO_MS;
    return { fadeMs: fadeMs, autoMs: autoMs };
  }
  var LCD_MIN_S = 70;
  var LCD_MAX_S = 240;
  var LCD_CHAR_S = 0.14;

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

  function itemsSignature(items) {
    try {
      return JSON.stringify(items || []);
    } catch (_) {
      return String((items && items.length) || 0);
    }
  }

  /** Escape text for safe HTML insertion. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Lightweight markdown → HTML for carousel copy (emphasis, links, lists, code).
   * Mirrors the intent of RelayMarkdownView / @clevertree/markdown for short blurbs.
   */
  function mdInline(raw) {
    let s = esc(raw);
    // [label](url) — only http(s) or relative paths
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, url) {
      const u = String(url || '').trim();
      if (!/^(https?:\/\/|\/|#)/i.test(u)) return label;
      return '<a class="fb-slideshow-md-link" href="' + esc(u) + '">' + label + '</a>';
    });
    s = s.replace(/`([^`]+)`/g, '<code class="fb-slideshow-md-code">$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return s;
  }

  function setMarkdown(el, md) {
    if (!el) return;
    const text = String(md == null ? '' : md).trim();
    if (!text) {
      el.innerHTML = '';
      return;
    }
    const lines = text.split(/\r?\n/);
    const parts = [];
    let inList = false;
    function closeList() {
      if (inList) {
        parts.push('</ul>');
        inList = false;
      }
    }
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const t = raw.trim();
      if (!t || t === '---') {
        closeList();
        continue;
      }
      // Skip GFM tables (carousel is prose; full tables live on the title page).
      if (t.charAt(0) === '|') {
        closeList();
        continue;
      }
      const heading = t.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        closeList();
        const level = heading[1].length;
        const tag = level === 1 ? 'h4' : level === 2 ? 'h4' : 'h5';
        parts.push(
          '<' +
            tag +
            ' class="fb-slideshow-md-h">' +
            mdInline(heading[2]) +
            '</' +
            tag +
            '>',
        );
        continue;
      }
      if (/^[-*]\s+/.test(t)) {
        if (!inList) {
          parts.push('<ul class="fb-slideshow-md-list">');
          inList = true;
        }
        parts.push('<li>' + mdInline(t.replace(/^[-*]\s+/, '')) + '</li>');
        continue;
      }
      closeList();
      parts.push('<p>' + mdInline(t) + '</p>');
    }
    closeList();
    el.innerHTML = parts.join('') || '<p>' + mdInline(text) + '</p>';
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

  /** Single document-level LCD animation — avoids duplicate style tags / restart ghosts. */
  function ensureLcdAnim(secs) {
    try {
      const doc = global.document;
      if (!doc) return;
      let st = doc.getElementById(LCD_ANIM_STYLE_ID);
      if (!st) {
        st = doc.createElement('style');
        st.id = LCD_ANIM_STYLE_ID;
        (doc.head || doc.documentElement).appendChild(st);
      }
      const dur = Math.max(LCD_MIN_S, Math.min(LCD_MAX_S, secs));
      // Only rewrite if duration changed — rewriting restarts the animation.
      const next =
        '@keyframes fb-lcd-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}' +
        '.fb-lcd-track{animation:fb-lcd-scroll ' +
        dur +
        's linear infinite;}' +
        '@media (prefers-reduced-motion:reduce){.fb-lcd-track{animation:none!important;transform:none}}';
      if (st.getAttribute('data-fb-dur') === String(dur)) return;
      st.setAttribute('data-fb-dur', String(dur));
      st.textContent = next;
    } catch (_) {}
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

    const n = Math.max(24, (track.textContent || '').length);
    ensureLcdAnim(n * LCD_CHAR_S);
  }

  function buildCarousel(root, items) {
    const doc = global.document;
    root.className = 'fb-now-showing fb-now-showing-carousel';
    let idx = 0;
    let busy = false;
    let autoTimer = null;
    let fadeTimer = null;
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
    const titleBlock = doc.createElement('div');
    titleBlock.className = 'fb-now-showing-title-block';
    const h2 = doc.createElement('h2');
    h2.className = 'fb-section-title fb-now-showing-title';
    h2.textContent = 'Now showing';
    const sub = doc.createElement('p');
    sub.className = 'fb-now-showing-sub';
    sub.textContent =
      'Ready to play or download on this host now (Bunny CDN). Other titles need IPFS, the Flashback App, or a Drive request — see Setup.';
    titleBlock.appendChild(h2);
    titleBlock.appendChild(sub);
    const counter = doc.createElement('p');
    counter.className = 'fb-now-showing-count fb-slideshow-count';
    head.appendChild(titleBlock);
    head.appendChild(counter);

    const frame = doc.createElement('div');
    frame.className = 'fb-slideshow-frame';

    const live = doc.createElement('p');
    live.className = 'fb-slideshow-live';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    // Visually hide; counter in the head stays visible.
    live.style.cssText =
      'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0';

    const stage = doc.createElement('div');
    stage.className = 'fb-slideshow-stage';

    function makeLayer(cls) {
      // Article (not <a>) so markdown links in blurb/README are valid.
      const a = doc.createElement('article');
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
      const titleLink = doc.createElement('a');
      titleLink.className = 'fb-slideshow-title-link';
      title.appendChild(titleLink);
      const scroll = doc.createElement('div');
      scroll.className = 'fb-slideshow-scroll';
      const blurb = doc.createElement('div');
      blurb.className = 'fb-slideshow-blurb fb-slideshow-md';
      const readme = doc.createElement('div');
      readme.className = 'fb-slideshow-readme fb-slideshow-md';
      const meta = doc.createElement('div');
      meta.className = 'fb-slideshow-meta';
      scroll.appendChild(blurb);
      scroll.appendChild(readme);
      scroll.appendChild(meta);
      copy.appendChild(kicker);
      copy.appendChild(title);
      copy.appendChild(scroll);
      a.appendChild(img);
      a.appendChild(copy);
      return {
        a: a,
        img: img,
        title: title,
        titleLink: titleLink,
        blurb: blurb,
        readme: readme,
        meta: meta,
        scroll: scroll,
      };
    }

    // Mutable roles: after each crossfade we swap pointers so the visible
    // layer stays "front" without a second opacity animation.
    let front = makeLayer('fb-slideshow-layer is-active');
    let back = makeLayer('fb-slideshow-layer');
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

    function fillMeta(layer, it) {
      const stats = it && it.stats ? String(it.stats).trim() : '';
      const changes = it && it.changes ? String(it.changes).trim() : '';
      if (!stats && !changes) {
        layer.meta.innerHTML = '';
        layer.meta.style.display = 'none';
        return;
      }
      layer.meta.style.display = '';
      let html = '';
      if (stats) {
        html +=
          '<p class="fb-slideshow-stats"><span class="fb-slideshow-meta-label">Stats</span> ' +
          mdInline(stats) +
          '</p>';
      }
      if (changes) {
        html +=
          '<div class="fb-slideshow-changes"><span class="fb-slideshow-meta-label">Changes</span>' +
          (function () {
            // Prefer preformatted markdown list; otherwise wrap as paragraph.
            const c = String(changes).trim();
            if (/^[-*]\s/m.test(c) || c.indexOf('\n') >= 0) {
              const box = doc.createElement('div');
              setMarkdown(box, c);
              return box.innerHTML;
            }
            return '<p>' + mdInline(c) + '</p>';
          })() +
          '</div>';
      }
      layer.meta.innerHTML = html;
    }

    function fillLayer(layer, it) {
      const href = it.href || '#';
      layer.titleLink.href = href;
      layer.titleLink.textContent = it.title || '';
      const blurbText = it && it.blurb ? String(it.blurb) : '';
      if (blurbText) {
        setMarkdown(layer.blurb, blurbText);
        layer.blurb.style.display = '';
      } else {
        layer.blurb.innerHTML = '';
        layer.blurb.style.display = 'none';
      }
      // README body (sections after the lead blurb) — scroll clipped to poster height.
      const readmeText = it && it.readme ? String(it.readme) : '';
      if (readmeText.trim()) {
        setMarkdown(layer.readme, readmeText);
        layer.readme.style.display = '';
      } else {
        layer.readme.innerHTML = '';
        layer.readme.style.display = 'none';
      }
      // Reset scroll so a long previous title doesn't leave the pane mid-page.
      try {
        layer.scroll.scrollTop = 0;
      } catch (_) {}
      fillMeta(layer, it);
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

    function announce() {
      const it = list[idx];
      const label = it && it.title ? String(it.title) : '';
      counter.textContent = idx + 1 + ' / ' + list.length;
      live.textContent = label
        ? 'Slide ' + (idx + 1) + ' of ' + list.length + ': ' + label
        : 'Slide ' + (idx + 1) + ' of ' + list.length;
    }

    function paintInstant() {
      const it = list[idx];
      fillLayer(front, it);
      front.a.classList.add('is-active');
      front.a.setAttribute('aria-hidden', 'false');
      back.a.classList.remove('is-active');
      back.a.setAttribute('aria-hidden', 'true');
      announce();
      prefetch((idx + 1) % list.length);
      prefetch((idx - 1 + list.length) % list.length);
    }

    function go(delta) {
      if (list.length < 2) return;
      if (busy) return;
      const nextIdx = (idx + delta + list.length) % list.length;
      const { fadeMs } = timing();
      if (reduceMotion) {
        idx = nextIdx;
        paintInstant();
        armAuto();
        return;
      }
      busy = true;
      const incoming = list[nextIdx];
      const outgoingEl = front.a;
      const incomingEl = back.a;
      fillLayer(back, incoming);
      // Force style flush so opacity transition runs once (old → new crossfade).
      void incomingEl.offsetWidth;
      incomingEl.classList.add('is-active');
      incomingEl.setAttribute('aria-hidden', 'false');
      outgoingEl.classList.remove('is-active');
      outgoingEl.setAttribute('aria-hidden', 'true');

      const finish = function () {
        // Swap roles only — do not toggle is-active again (that caused a 2nd fade-in).
        const tmp = front;
        front = back;
        back = tmp;
        idx = nextIdx;
        busy = false;
        announce();
        prefetch((idx + 1) % list.length);
        armAuto();
      };

      let done = false;
      const onEnd = function (ev) {
        if (done) return;
        // Only opacity transition on the incoming layer (ignore child transitions).
        if (ev && ev.target !== incomingEl) return;
        if (ev && ev.propertyName && ev.propertyName !== 'opacity') return;
        done = true;
        incomingEl.removeEventListener('transitionend', onEnd);
        if (fadeTimer) {
          global.clearTimeout(fadeTimer);
          fadeTimer = null;
        }
        finish();
      };
      incomingEl.addEventListener('transitionend', onEnd);
      if (fadeTimer) global.clearTimeout(fadeTimer);
      fadeTimer = global.setTimeout(function () {
        if (done) return;
        done = true;
        incomingEl.removeEventListener('transitionend', onEnd);
        fadeTimer = null;
        finish();
      }, fadeMs + 120);
    }

    function armAuto() {
      if (autoTimer) {
        global.clearTimeout(autoTimer);
        autoTimer = null;
      }
      const { autoMs } = timing();
      if (reduceMotion || list.length < 2 || autoMs <= 0) return;
      autoTimer = global.setTimeout(function () {
        go(1);
      }, autoMs);
    }

    prev.addEventListener('click', function (ev) {
      try {
        ev.preventDefault();
      } catch (_) {}
      go(-1);
    });
    next.addEventListener('click', function (ev) {
      try {
        ev.preventDefault();
      } catch (_) {}
      go(1);
    });

    function pauseAuto() {
      if (autoTimer) {
        global.clearTimeout(autoTimer);
        autoTimer = null;
      }
    }

    // Pause autoplay while hovering / keyboard-focused inside the region.
    root.addEventListener('mouseenter', pauseAuto);
    root.addEventListener('mouseleave', function () {
      armAuto();
    });
    root.addEventListener('focusin', pauseAuto);
    root.addEventListener('focusout', function (ev) {
      try {
        if (ev && ev.relatedTarget && root.contains(ev.relatedTarget)) return;
      } catch (_) {}
      armAuto();
    });
    root.addEventListener('keydown', function (ev) {
      if (!ev) return;
      if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        go(-1);
      } else if (ev.key === 'ArrowRight') {
        ev.preventDefault();
        go(1);
      }
    });

    root.appendChild(head);
    const row = doc.createElement('div');
    row.className = 'fb-slideshow-row';
    row.appendChild(prev);
    row.appendChild(frame);
    frame.appendChild(live);
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
    root.setAttribute('data-fb-items-sig', itemsSignature(items));
    root.setAttribute('data-fb-variant', variant);
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
    if (!host) return false;
    const props = attrsToProps(host);
    const wantSig = itemsSignature(parseItems(props));
    const wantVariant = prop(props, 'variant', 'lcd');
    const existing = host.querySelector('.fb-marquee, .fb-now-showing-carousel');
    if (existing) {
      const haveSig = existing.getAttribute('data-fb-items-sig') || '';
      const haveVariant = existing.getAttribute('data-fb-variant') || '';
      // Pre-readme carousel shells match sig but omit .fb-slideshow-readme — force rebuild.
      if (
        wantVariant === 'carousel' &&
        !existing.querySelector('.fb-slideshow-readme')
      ) {
        return true;
      }
      // Same content already built — skip (prevents animation restart / ghosting).
      if (haveSig === wantSig && haveVariant === wantVariant) return false;
    }
    const fn = global.__fbHostNeedsUpgrade;
    if (typeof fn === 'function') {
      return fn(host, '.fb-marquee, .fb-now-showing-carousel');
    }
    return !existing;
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

  var registered = false;

  function register() {
    if (typeof global.__relayRegisterParkNative === 'function') {
      global.__relayRegisterParkNative('fb-now-showing', buildNowShowing);
      registered = true;
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
      // Keep trying until park registry exists; after that only upgrade placeholders.
      if (!registered) register();
      else upgradePlaceholders();
      n += 1;
      if ((registered && n > 20) || n > 80) {
        global.clearInterval(t);
      }
    }, 50);
    const sched = global.__fbScheduleParkNativeReupgrade;
    if (typeof sched === 'function') {
      sched(upgradePlaceholders);
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
