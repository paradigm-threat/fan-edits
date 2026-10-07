/**
 * Shared boot helpers for park-native *.host.js — CSS + re-upgrade after soft-hydrate.
 *
 * CleverScript theme.yaml styles become vnode inline styles on SSR nodes only.
 * Host builders must ship their own stylesheet.
 */
(function (global) {
  'use strict';

  var CSS_ID = 'fb-park-native-css';
  var BRAND_LINKS_ID = 'fb-brand-head-links';

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
      ensureBrandHeadLinks();
      if (!global.document || global.document.getElementById(CSS_ID)) return;
      var st = global.document.createElement('style');
      st.id = CSS_ID;
      st.textContent = [
        /* Affirmation / ownership gate — fullscreen modal for welcome AND title */
        '.fb-gate,.fb-affirmation-native{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(6,4,5,.9);box-sizing:border-box}',
        '.fb-gate-panel,.fb-gate-card{max-width:480px;width:100%;padding:28px 26px 24px;background:linear-gradient(165deg,#3a1820 0%,#1a0c10 55%,#12080a 100%);border:1px solid #e8c872;box-shadow:0 24px 70px rgba(0,0,0,.6);border-radius:4px;color:#f5e6be}',
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
        '.fb-lcd-track{display:inline-block;white-space:nowrap;font-size:.78rem;letter-spacing:.04em;line-height:1.35;will-change:transform}',
        '.fb-lcd-link{color:#e8c872;text-decoration:none;text-shadow:0 0 5px rgba(232,200,114,.35)}',
        '.fb-lcd-link:hover{color:#f5e6be;text-decoration:underline}',
        '.fb-lcd-star{opacity:.9}',
        /* Carousel — crossfade poster stage */
        '.fb-now-showing-carousel{margin:12px 0 28px;color:#f5e6be}',
        '.fb-now-showing-carousel .fb-now-showing-head{display:flex;flex-direction:row;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 10px}',
        '.fb-now-showing-carousel .fb-now-showing-title{margin:0}',
        '.fb-slideshow-count{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#b8860b;margin:0}',
        '.fb-slideshow-row{display:flex;flex-direction:row;align-items:stretch;gap:8px}',
        '.fb-slideshow-frame{flex:1;min-width:0;position:relative;border:1px solid #3a2a1a;background:linear-gradient(145deg,#2a1418 0%,#12080a 55%,#0d0505 100%);box-shadow:0 12px 36px rgba(0,0,0,.45);overflow:hidden;min-height:240px}',
        '.fb-slideshow-stage{position:relative;width:100%;min-height:240px}',
        '.fb-slideshow-layer{position:absolute;inset:0;display:flex;flex-direction:row;align-items:stretch;color:#e8c872;text-decoration:none;opacity:0;transform:scale(1.02);transition:opacity .55s ease,transform .55s ease;pointer-events:none;z-index:1}',
        '.fb-slideshow-layer.is-active{opacity:1;transform:scale(1);pointer-events:auto;z-index:2}',
        '.fb-slideshow-img{display:block;flex:0 0 42%;max-width:280px;width:42%;height:100%;object-fit:cover;background:#0d0505}',
        '.fb-slideshow-layer:not(.has-poster) .fb-slideshow-img{display:none}',
        '.fb-slideshow-copy{flex:1;min-width:0;padding:22px 20px 20px;display:flex;flex-direction:column;gap:8px;justify-content:center}',
        '.fb-slideshow-kicker{margin:0;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#e8c872}',
        '.fb-slideshow-title{margin:0;font-size:1.35rem;line-height:1.25;color:#f5e6be}',
        '.fb-slideshow-nav{flex-shrink:0;width:42px;align-self:stretch;border:1px solid #b8860b;background:linear-gradient(180deg,rgba(58,16,24,.95),rgba(18,8,10,.98));color:#e8c872;font-size:1.8rem;line-height:1;cursor:pointer;font-family:inherit;border-radius:2px}',
        '.fb-slideshow-nav:hover{border-color:#e8c872;color:#f5e6be}',
        '@media (prefers-reduced-motion:reduce){.fb-slideshow-layer{transition:none!important;transform:none!important}}',
        '@media (max-width:720px){.fb-slideshow-stage,.fb-slideshow-frame{min-height:320px}.fb-slideshow-layer{flex-direction:column}.fb-slideshow-img{flex:0 0 auto;max-width:none;width:100%;height:180px}}',
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
        '.fb-theater-external-steps{margin:0 0 12px;padding-left:1.25rem;color:#d4c4a8;font-size:.9rem;line-height:1.45}',
        '.fb-theater-external-url-row{margin:0 0 10px;overflow:auto}',
        '.fb-theater-external-url{display:block;font-size:.75rem;word-break:break-all;color:#f5e6be}',
        '.fb-theater-external-actions{display:flex;flex-wrap:wrap;gap:10px 16px;margin:0 0 8px}',
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

  global.__fbEnsureParkNativeCss = ensureParkNativeCss;
  global.__fbHostNeedsUpgrade = hostNeedsUpgrade;
  global.__fbScheduleParkNativeReupgrade = scheduleParkNativeReupgrade;
})(typeof globalThis !== 'undefined' ? globalThis : window);
