/**
 * Shared boot helpers for park-native *.host.js — CSS + re-upgrade after soft-hydrate.
 *
 * CleverScript theme.yaml styles become vnode inline styles on SSR nodes only.
 * Host builders must ship their own stylesheet.
 */
(function (global) {
  'use strict';

  var CSS_ID = 'fb-park-native-css-v10';
  var BRAND_LINKS_ID = 'fb-brand-head-links';
  var THEATER_BG_CSS = '/hooks/client/brand/theater-bg.css';
  var THEATER_THEME_KEY = 'flashback.theaterTheme.v1';
  var THEATER_THEMES = ['velvet', 'classic'];
  var DEFAULT_THEATER_THEME = 'velvet';

  function normalizeTheaterTheme(raw) {
    var t = (raw || '').toString().trim().toLowerCase();
    if (THEATER_THEMES.indexOf(t) >= 0) return t;
    return DEFAULT_THEATER_THEME;
  }

  function readTheaterTheme() {
    try {
      if (!global.localStorage) return DEFAULT_THEATER_THEME;
      return normalizeTheaterTheme(global.localStorage.getItem(THEATER_THEME_KEY));
    } catch (_) {
      return DEFAULT_THEATER_THEME;
    }
  }

  function writeTheaterTheme(theme) {
    var t = normalizeTheaterTheme(theme);
    try {
      if (global.localStorage) global.localStorage.setItem(THEATER_THEME_KEY, t);
    } catch (_) {}
    return t;
  }

  function applyTheaterTheme(theme) {
    try {
      if (!global.document || !global.document.documentElement) return;
      var t = writeTheaterTheme(theme);
      global.document.documentElement.setAttribute('data-fb-theater', t);
      var nodes = global.document.querySelectorAll('[data-fb-theater-theme-toggle]');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var label = t === 'classic' ? 'Classic' : 'Velvet';
        el.textContent = 'Theme: ' + label;
        el.setAttribute('aria-label', 'Switch theater theme (current: ' + label + ')');
        el.setAttribute('title', 'Theater theme: ' + label + ' — click to switch');
      }
    } catch (_) {}
  }

  function cycleTheaterTheme() {
    var cur = readTheaterTheme();
    var idx = THEATER_THEMES.indexOf(cur);
    var next = THEATER_THEMES[(idx + 1) % THEATER_THEMES.length];
    applyTheaterTheme(next);
    return next;
  }

  function wireTheaterThemeToggles() {
    try {
      if (!global.document) return;
      applyTheaterTheme(readTheaterTheme());
      var nodes = global.document.querySelectorAll('[data-fb-theater-theme-toggle]');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.getAttribute('data-fb-theater-wired') === '1') continue;
        el.setAttribute('data-fb-theater-wired', '1');
        el.addEventListener(
          'click',
          function (ev) {
            try {
              if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
              if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
            } catch (_) {}
            cycleTheaterTheme();
          },
          false,
        );
      }
    } catch (_) {}
  }

  function ensureBrandHeadLinks() {
    try {
      if (!global.document || global.document.getElementById(BRAND_LINKS_ID)) return;
      var head = global.document.head || global.document.getElementsByTagName('head')[0];
      if (!head) return;
      var mark = global.document.createElement('meta');
      mark.id = BRAND_LINKS_ID;
      mark.name = 'fb-brand-links';
      mark.content = '1';
      head.appendChild(mark);

      function addLink(attrs) {
        var el = global.document.createElement('link');
        for (var k in attrs) {
          if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
        }
        head.appendChild(el);
      }
      // Responsive theater covers (theme.yaml @media is not emitted into relay-ssr-theme).
      addLink({
        rel: 'stylesheet',
        href: THEATER_BG_CSS,
        id: 'fb-theater-bg-css',
      });
      addLink({ rel: 'icon', href: '/hooks/client/favicon.svg', type: 'image/svg+xml' });
      addLink({ rel: 'icon', href: '/favicon.ico', sizes: 'any' });
      addLink({ rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' });
      addLink({ rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' });
      addLink({ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' });
      addLink({ rel: 'manifest', href: '/site.webmanifest' });
      var theme = global.document.createElement('meta');
      theme.name = 'theme-color';
      theme.content = '#0D0505';
      head.appendChild(theme);
    } catch (_) {}
  }

  function ensureParkNativeCss() {
    try {
      applyTheaterTheme(readTheaterTheme());
      ensureBrandHeadLinks();
      wireTheaterThemeToggles();
      if (!global.document) return;
      // Drop prior park CSS ids so layout revisions win after soft-hydrate.
      ;[
        'fb-park-native-css',
        'fb-park-native-css-v2',
        'fb-park-native-css-v3',
        'fb-park-native-css-v4',
        'fb-park-native-css-v5',
        'fb-park-native-css-v6',
        'fb-park-native-css-v7',
        'fb-park-native-css-v8',
        'fb-park-native-css-v9',
      ].forEach(
        function (oldId) {
          var old = global.document.getElementById(oldId);
          if (old && old.parentNode) old.parentNode.removeChild(old);
        },
      );
      if (global.document.getElementById(CSS_ID)) return;
      var st = global.document.createElement('style');
      st.id = CSS_ID;
      st.textContent = [
        /* Affirmation / ownership gate — fullscreen modal for welcome AND title */
        '.fb-gate,.fb-affirmation-native{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(6,4,5,.9);box-sizing:border-box}',
        '.fb-gate-panel,.fb-gate-card{max-width:480px;width:100%;padding:28px 26px 24px;background:linear-gradient(165deg,#3a1820 0%,#1a0c10 55%,#12080a 100%);border:1px solid #e8c872;box-shadow:0 24px 70px rgba(0,0,0,.6);border-radius:4px;color:#f5e6be}',
        '@media (max-width:640px){.fb-gate,.fb-affirmation-native{align-items:stretch;justify-content:flex-start;padding:0;overflow:auto}.fb-gate-panel,.fb-gate-card{max-width:none;width:100%;min-height:100%;border-radius:0;box-shadow:none;box-sizing:border-box;padding:max(20px,env(safe-area-inset-top)) 18px max(24px,env(safe-area-inset-bottom))}}',
        '.fb-gate-eyebrow,.fb-gate-kicker{margin:0 0 8px;font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:#e8c872}',
        '.fb-gate-title{margin:0 0 14px;font-size:1.5rem;line-height:1.25;color:#f5e6be}',
        '.fb-gate-body{margin:0 0 14px;color:#c4b49a;font-size:1rem;line-height:1.55}',
        '.fb-gate-body p{margin:0 0 .7em}',
        '.fb-gate-check-box,.fb-gate-check{display:flex;flex-direction:row;gap:14px;align-items:flex-start;margin:20px 0 8px;padding:14px;background:rgba(0,0,0,.28);border:1px solid #b8860b;border-radius:4px;font-size:1rem;line-height:1.45;color:#f5e6be;cursor:pointer}',
        '.fb-gate-check-box input,.fb-gate input[type=checkbox]{width:24px;height:24px;min-width:24px;flex-shrink:0;margin-top:1px;accent-color:#e8c872;cursor:pointer}',
        '.fb-gate-check-box-warn{outline:2px solid #c44;outline-offset:2px}',
        '.fb-gate-hint{margin:0 0 16px;font-size:.88rem;color:#c4b49a}',
        '.fb-gate-ok{width:100%;justify-content:center;padding:12px 18px;font-size:1.02rem;cursor:pointer;border:1px solid #e8c872;background:linear-gradient(180deg,#5a2430,#2a1018);color:#f5e6be;border-radius:4px}',
        '.fb-gate-links{margin:16px 0 0;font-size:.85rem;text-align:center}',
        '.fb-gate-links a{color:#e8c872}',
        /* Only hide welcome overlay after site-wide ack — never hide movie title ack via this rule. */
        'html[data-fb-welcome-ack="1"] .fb-affirmation-native[data-fb-affirmation="welcome"]{display:none!important}',
        'html[data-fb-welcome-ack="1"][data-fb-movie-ack] .fb-media-locked{display:none!important}',
        'html[data-fb-welcome-ack="1"][data-fb-movie-ack] .fb-media-unlock-target{display:block!important}',
        'html[data-fb-welcome-ack="1"][data-fb-movie-ack] .fb-video-controls .fb-btn{opacity:1;pointer-events:auto}',
        'html[data-fb-welcome-ack="1"][data-fb-movie-ack] .fb-affirmation-native[data-fb-affirmation="title"]{display:none!important}',
        '.fb-media-unlock-target{display:none}',
        '.fb-video-controls .fb-btn{opacity:.45;pointer-events:none}',
        /* NowShowing LCD marquee */
        '.fb-marquee{position:relative;z-index:2;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:8px;padding:7px 12px;background:linear-gradient(180deg,#14100a 0%,#0a0806 55%,#100c08 100%);border-bottom:1px solid #3a2a1a;box-shadow:inset 0 0 18px rgba(0,0,0,.7);font-family:ui-monospace,"Courier New",Courier,monospace;color:#e8c872}',
        '.fb-marquee-board{flex:1;min-width:0;display:flex;flex-direction:row;align-items:center;max-width:920px;gap:8px}',
        '.fb-marquee-wing{max-width:22%;overflow:hidden;flex-shrink:0;display:flex;flex-direction:row;align-items:center;flex-wrap:nowrap}',
        '.fb-marquee-wing-letter{display:inline-block;font-size:.62rem;letter-spacing:.08em;text-transform:lowercase;color:#e8c872;text-shadow:0 0 6px rgba(232,200,114,.55);line-height:1;padding:0 1px}',
        '.fb-marquee-wing-gap{display:inline-block;width:4px}',
        '.fb-marquee-bulb{opacity:.55;flex-shrink:0;font-size:.45rem}',
        '.fb-bulb-0{opacity:.95}',
        '.fb-bulb-2{opacity:.75}',
        '.fb-lcd{flex:1;min-width:0;display:flex;flex-direction:row;align-items:center}',
        '.fb-lcd-window{flex:1;min-width:0;overflow:hidden;white-space:nowrap;mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}',
        /* Animation duration injected once via #fb-now-showing-lcd-anim — do not restart here. */
        '.fb-lcd-track{display:inline-block;white-space:nowrap;font-size:.78rem;letter-spacing:.04em;line-height:1.35}',
        '.fb-lcd-link{color:#e8c872;text-decoration:none;text-shadow:0 0 5px rgba(232,200,114,.35)}',
        '.fb-lcd-link:hover{color:#f5e6be;text-decoration:underline}',
        '.fb-lcd-star{opacity:.9}',
        /* Carousel — desktop 50/50; height tracks poster (no empty gap under art). */
        '.fb-now-showing-carousel{margin:12px 0 28px;color:#f5e6be}',
        '.fb-now-showing-carousel .fb-now-showing-head{display:flex;flex-direction:row;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 0 10px}',
        '.fb-now-showing-carousel .fb-now-showing-title-block{min-width:0;flex:1}',
        '.fb-now-showing-carousel .fb-now-showing-title{margin:0}',
        '.fb-now-showing-sub{margin:6px 0 0;font-size:.85rem;line-height:1.45;color:#a69788;max-width:42rem}',
        '.fb-now-showing-sub .fb-link{color:#e8c872;text-decoration:none}',
        '.fb-now-showing-sub .fb-link:hover{color:#f5e6be;text-decoration:none}',
        '.fb-theater-seed-status{margin:0 0 10px;color:#c4b49a}',
        /* Ways to watch — large type, three clear paths */
        '.fb-ways-to-watch{margin:14px 0 0;padding:18px 16px 16px;border:1px solid #5a4a2a;background:rgba(40,28,12,.45)}',
        '.fb-ways-title{margin:0 0 10px;font-size:1.35rem;line-height:1.3;color:#f5e6be;font-weight:600}',
        '.fb-ways-lead{margin:0 0 16px;font-size:1.08rem;line-height:1.5;color:#d4c4a8}',
        '.fb-ways-quality{margin:0 0 16px}',
        '.fb-ways-section-label{margin:0 0 8px;font-size:1.05rem;color:#f5e6be}',
        '.fb-ways-section{margin:0 0 18px;padding:0 0 14px;border-bottom:1px solid #3a2a1a}',
        '.fb-ways-section:last-of-type{border-bottom:0;padding-bottom:0;margin-bottom:12px}',
        '.fb-ways-section-title{margin:0 0 8px;font-size:1.2rem;line-height:1.3;color:#e8c872;font-weight:600}',
        '.fb-ways-section-help{margin:0 0 12px;font-size:1.05rem;line-height:1.45;color:#c4b49a}',
        '.fb-ways-actions{display:flex;flex-wrap:wrap;gap:10px 12px;margin:0 0 8px}',
        '.fb-ways-to-watch .fb-btn{padding:8px 14px;font-size:1.05rem;line-height:1.25;min-height:0}',
        '.fb-ways-to-watch .fb-btn.is-disabled,.fb-ways-to-watch .fb-btn:disabled,.fb-ways-to-watch a.fb-btn[aria-disabled="true"]{opacity:.4;pointer-events:none;cursor:not-allowed}',
        '.fb-ways-status{margin:0;font-size:1.02rem;line-height:1.4;color:#c4b49a}',
        '.fb-ways-helpers{margin:4px 0 0;font-size:1.02rem;line-height:1.45;color:#a69788}',
        '.fb-ways-helpers .fb-link{color:#e8c872}',
        '.fb-ways-feedback{margin:10px 0 0;font-size:1.02rem;color:#e8c872}',
        '.fb-ways-stream-url-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
        '.fb-slideshow-count{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#b8860b;margin:0}',
        '.fb-slideshow-row{display:flex;flex-direction:row;align-items:stretch;gap:8px}',
        '.fb-slideshow-frame{flex:1;min-width:0;position:relative;border:1px solid #3a2a1a;background:linear-gradient(145deg,#2a1418 0%,#12080a 55%,#0d0505 100%);box-shadow:0 12px 36px rgba(0,0,0,.45);overflow:hidden}',
        '.fb-slideshow-stage{position:relative;width:100%}',
        /* Stack front/back in one grid cell; active layer sets height from poster. */
        '.fb-slideshow-stage{display:grid}',
        /* Opacity-only crossfade — do not use visibility:hidden on inactive (kills old-card fade). */
        '.fb-slideshow-layer{grid-area:1/1;min-width:0;display:grid;grid-template-columns:1fr 1fr;align-items:stretch;color:#e8c872;text-decoration:none;opacity:0;transition:opacity 1.1s ease-in-out;pointer-events:none;z-index:1}',
        '.fb-slideshow-layer:hover,.fb-slideshow-layer:focus{text-decoration:none}',
        '.fb-slideshow-layer.is-active{opacity:1;pointer-events:auto;z-index:2}',
        /* Poster column: intrinsic 2:3 height drives the whole card — no empty gap under art. */
        '.fb-slideshow-img{display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:contain;object-position:center center;background:#0d0505}',
        '.fb-slideshow-layer:not(.has-poster){grid-template-columns:1fr}',
        '.fb-slideshow-layer:not(.has-poster) .fb-slideshow-img{display:none}',
        /* Copy column: height:0 + min-height:100% matches poster row without growing the card. */
        '.fb-slideshow-copy{min-width:0;height:0;min-height:100%;padding:22px 20px 18px;display:flex;flex-direction:column;gap:8px;justify-content:flex-start;box-sizing:border-box;overflow:hidden}',
        '.fb-slideshow-kicker{margin:0;flex-shrink:0;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#e8c872}',
        '.fb-slideshow-title{margin:0;flex-shrink:0;font-size:1.35rem;line-height:1.25;color:#f5e6be}',
        '.fb-slideshow-scroll{flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding-right:4px}',
        '.fb-slideshow-blurb{margin:0;font-size:.95rem;line-height:1.5;color:#c4b49a}',
        '.fb-slideshow-blurb p{margin:0 0 .55em}',
        '.fb-slideshow-blurb p:last-child{margin-bottom:0}',
        '.fb-slideshow-md strong{color:#f5e6be;font-weight:600}',
        '.fb-slideshow-md em{font-style:italic}',
        '.fb-slideshow-md-code{font-family:ui-monospace,Consolas,monospace;font-size:.88em;color:#e8c872}',
        '.fb-slideshow-md-link{color:#e8c872;text-decoration:none}',
        '.fb-slideshow-md-link:hover,.fb-slideshow-md-link:focus{color:#f5e6be;text-decoration:none}',
        '.fb-slideshow-md-list{margin:.35em 0 .55em;padding-left:1.15em}',
        '.fb-slideshow-meta{margin-top:10px;padding-top:8px;border-top:1px solid rgba(184,134,11,.35);font-size:.78rem;line-height:1.4;color:#a69788}',
        '.fb-slideshow-meta-label{display:inline-block;margin-right:6px;letter-spacing:.1em;text-transform:uppercase;color:#b8860b;font-size:.68rem}',
        '.fb-slideshow-stats{margin:0 0 6px}',
        '.fb-slideshow-changes{margin:0}',
        '.fb-slideshow-changes p,.fb-slideshow-changes ul{margin:4px 0 0}',
        '.fb-slideshow-changes ul{padding-left:1.1em}',
        '.fb-slideshow-nav{flex-shrink:0;width:42px;align-self:stretch;border:1px solid #b8860b;background:linear-gradient(180deg,rgba(58,16,24,.95),rgba(18,8,10,.98));color:#e8c872;font-size:1.8rem;line-height:1;cursor:pointer;font-family:inherit;border-radius:2px}',
        '.fb-slideshow-nav:hover{border-color:#e8c872;color:#f5e6be}',
        '@media (prefers-reduced-motion:reduce){.fb-slideshow-layer{transition:none!important}}',
        /* Mobile stack — leave as stacked poster + copy (user: fine as-is). */
        '@media (max-width:720px){.fb-slideshow-layer{display:flex;flex-direction:column;grid-template-columns:none}.fb-slideshow-img{width:100%;height:auto;aspect-ratio:2/3;object-fit:contain}.fb-slideshow-copy{height:auto;max-height:none;padding:18px 16px 20px;overflow:visible}.fb-slideshow-scroll{max-height:min(42vh,280px);overflow-y:auto}}',
        /* Theater player shell + seed status */
        '.fb-theater-player{margin:12px 0}',
        '.fb-media-locked,.fb-media-pending,.fb-media-failed{padding:16px;border:1px solid #3a2a1a;background:rgba(0,0,0,.35);color:#c4b49a}',
        '.fb-media-failed{border-color:#6a3030}',
        '.fb-media-msg{margin:0 0 8px;font-size:1rem;line-height:1.4;color:#f5e6be}',
        '.fb-media-hint{margin:0 0 12px;font-size:.88rem;line-height:1.45;color:#c4b49a}',
        '.fb-media-bar{height:8px;margin:0 0 12px;background:rgba(0,0,0,.45);border:1px solid #3a2a1a;border-radius:2px;overflow:hidden}',
        '.fb-media-bar-fill{height:100%;background:linear-gradient(90deg,#b8860b,#e8c872);transition:width .35s ease}',
        '.fb-media-video{width:100%;max-height:70vh;background:#000}',
        '.fb-cc-row{margin:8px 0 0;display:flex;gap:8px;align-items:center}',
        '.fb-cc-btn{font-size:.85rem;letter-spacing:.04em}',
        '.fb-media-inspect{margin-top:12px;font-size:.85rem}',
        '.fb-media-inspect-label{margin:0 0 6px;letter-spacing:.08em;text-transform:uppercase;color:#b8860b;font-size:.72rem}',
        '.fb-media-inspect-cid-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 8px}',
        '.fb-media-inspect-cid{word-break:break-all;color:#e8c872}',
        '.fb-media-inspect-links a{color:#e8c872;margin-right:10px}',
        '.fb-media-inspect-note{margin:6px 0 0;font-size:.8rem;color:#a69788}',
        '.fb-media-playback-note{margin:0 0 8px;padding:8px 10px;border:1px solid #3a2a1a;background:rgba(0,0,0,.4);color:#e8c872;font-size:.9rem}',
        '.fb-media-playback-error{margin:0 0 10px}',
        '.fb-theater-report{margin:0}',
        '.fb-theater-actions{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0 0}',
        '.fb-theater-tech{margin:12px 0 0;font-size:.85rem;color:#a69788}',
        '.fb-theater-tech-summary{cursor:pointer;color:#c4b49a;list-style:none}',
        '.fb-theater-tech-summary::-webkit-details-marker{display:none}',
        '.fb-theater-tech-summary::before{content:"▸ ";color:#b8860b}',
        '.fb-theater-tech[open] .fb-theater-tech-summary::before{content:"▾ "}',
        '.fb-theater-tech-body{margin:8px 0 0;padding:10px;border:1px solid #3a2a1a;background:rgba(0,0,0,.28);color:#a69788;white-space:pre-wrap;word-break:break-word}',
        '.fb-theater-downloads{margin:14px 0 0;padding:12px 14px;border:1px solid #3a2a1a;background:rgba(0,0,0,.28)}',
        '.fb-theater-external{margin:14px 0 0;padding:12px 14px;border:1px solid #5a4a2a;background:rgba(40,28,12,.45)}',
        '.fb-theater-external.fb-ways-to-watch{padding:18px 16px 16px}',
        '.fb-theater-external-actions{display:flex;flex-wrap:wrap;gap:10px 12px;margin:0 0 8px}',
        '.fb-theater-downloads-label{margin:0 0 8px;font-size:.95rem;color:#f5e6be}',
        '.fb-theater-downloads-links{display:flex;flex-wrap:wrap;gap:10px 16px}',
        '.fb-theater-download-link{color:#e8c872;font-size:.95rem;text-decoration:underline}',
        '.fb-theater-downloads-note,.fb-theater-downloads-empty{margin:10px 0 0;font-size:.85rem;color:#a69788;line-height:1.4}',
        '.fb-theater-download-nudge{margin:0 0 8px}',
        '.fb-media-play-requested{outline:1px solid #e8c872;outline-offset:2px}',
        /* Public board */
        '.fb-board{margin:0 0 24px}',
        '.fb-board-intro{margin:0 0 16px;color:#c4b49a;line-height:1.5}',
        '.fb-board-form{display:flex;flex-direction:column;gap:12px;margin:0 0 28px;padding:16px;border:1px solid #3a2a1a;background:rgba(0,0,0,.28)}',
        '.fb-board-label{display:flex;flex-direction:column;gap:6px;color:#f5e6be;font-size:.9rem}',
        '.fb-board-input{padding:10px 12px;border:1px solid #3a2a1a;background:rgba(0,0,0,.4);color:#f5e6be;font:inherit}',
        '.fb-board-textarea{min-height:120px;resize:vertical}',
        '.fb-board-actions{display:flex;gap:10px}',
        '.fb-board-status{margin:0;font-size:.9rem;color:#e8c872}',
        '.fb-board-list-title{margin:0 0 12px;font-size:1.15rem;color:#f5e6be}',
        '.fb-board-post{margin:0 0 14px;padding:14px;border:1px solid #3a2a1a;background:rgba(0,0,0,.22)}',
        '.fb-board-post-meta{margin:0 0 8px;font-size:.8rem;color:#b8860b}',
        '.fb-board-post-body{margin:0;white-space:pre-wrap;color:#c4b49a;line-height:1.45}',
        '.fb-board-empty{color:#a69788}',
      ].join('');
      (global.document.head || global.document.documentElement).appendChild(st);
    } catch (_) {}
  }

  /** @param {Element} el @param {string} markerSelector */
  function hostNeedsUpgrade(el, markerSelector) {
    if (!el || !el.getAttribute) return false;
    try {
      if (!el.querySelector(markerSelector)) return true;
    } catch (_) {
      return true;
    }
    return false;
  }

  /**
   * Poll + observe #root so placeholders rebuild when SSR/hydrate clears host children.
   * @param {() => void} runUpgrade
   */
  function scheduleParkNativeReupgrade(runUpgrade) {
    if (typeof runUpgrade !== 'function') return;
    ensureParkNativeCss();
    function run() {
      try {
        ensureParkNativeCss();
        runUpgrade();
      } catch (_) {}
    }
    run();
    let n = 0;
    const iv = global.setInterval(() => {
      run();
      n += 1;
      if (n >= 120) global.clearInterval(iv);
    }, 100);
    try {
      const root = global.document && global.document.getElementById('root');
      if (root && global.MutationObserver) {
        let debounce = 0;
        new global.MutationObserver(() => {
          global.clearTimeout(debounce);
          debounce = global.setTimeout(run, 50);
        }).observe(root, { childList: true, subtree: true });
      }
    } catch (_) {}
    try {
      global.document.addEventListener('visibilitychange', () => {
        if (global.document.visibilityState === 'visible') run();
      });
    } catch (_) {}
  }

  ensureParkNativeCss();
  wireTheaterThemeToggles();

  global.__fbEnsureParkNativeCss = ensureParkNativeCss;
  global.__fbHostNeedsUpgrade = hostNeedsUpgrade;
  global.__fbScheduleParkNativeReupgrade = scheduleParkNativeReupgrade;
  global.__fbApplyTheaterTheme = applyTheaterTheme;
  global.__fbCycleTheaterTheme = cycleTheaterTheme;
})(typeof globalThis !== 'undefined' ? globalThis : window);
