/**
 * Shared boot helpers for park-native *.host.js — CSS + re-upgrade after soft-hydrate.
 *
 * CleverScript theme.yaml styles become vnode inline styles on SSR nodes only.
 * Host builders must ship their own stylesheet.
 */
(function (global) {
  'use strict';

  var CSS_ID = 'fb-park-native-css';

  function ensureParkNativeCss() {
    try {
      if (!global.document || global.document.getElementById(CSS_ID)) return;
      var st = global.document.createElement('style');
      st.id = CSS_ID;
      st.textContent = [
        /* Affirmation / ownership gate */
        '.fb-gate{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(6,4,5,.9)}',
        '.fb-gate-panel,.fb-gate-card{max-width:480px;width:100%;padding:28px 26px 24px;background:linear-gradient(165deg,#3a1820 0%,#1a0c10 55%,#12080a 100%);border:1px solid #d4a574;box-shadow:0 24px 70px rgba(0,0,0,.6);border-radius:4px;color:#f3e6d4}',
        '.fb-gate-eyebrow,.fb-gate-kicker{margin:0 0 8px;font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:#d4a574}',
        '.fb-gate-title{margin:0 0 14px;font-size:1.5rem;line-height:1.25;color:#f3e6d4}',
        '.fb-gate-body{margin:0 0 14px;color:#c9b8a4;font-size:1rem;line-height:1.55}',
        '.fb-gate-body p{margin:0 0 .7em}',
        '.fb-gate-check-box,.fb-gate-check{display:flex;flex-direction:row;gap:14px;align-items:flex-start;margin:20px 0 8px;padding:14px;background:rgba(0,0,0,.28);border:1px solid #a67c52;border-radius:4px;font-size:1rem;line-height:1.45;color:#f3e6d4;cursor:pointer}',
        '.fb-gate-check-box input,.fb-gate input[type=checkbox]{width:24px;height:24px;min-width:24px;flex-shrink:0;margin-top:1px;accent-color:#d4a574;cursor:pointer}',
        '.fb-gate-check-box-warn{outline:2px solid #c44;outline-offset:2px}',
        '.fb-gate-hint{margin:0 0 16px;font-size:.88rem;color:#c9b8a4}',
        '.fb-gate-ok{width:100%;justify-content:center;padding:12px 18px;font-size:1.02rem;cursor:pointer;border:1px solid #d4a574;background:linear-gradient(180deg,#5a2430,#2a1018);color:#f3e6d4;border-radius:4px}',
        '.fb-gate-links{margin:16px 0 0;font-size:.85rem;text-align:center}',
        '.fb-gate-links a{color:#d4a574}',
        'html[data-fb-welcome-ack="1"] .fb-gate{display:none!important}',
        'html[data-fb-welcome-ack="1"][data-fb-movie-ack] .fb-media-locked{display:none!important}',
        'html[data-fb-welcome-ack="1"][data-fb-movie-ack] .fb-media-unlock-target{display:block!important}',
        'html[data-fb-welcome-ack="1"][data-fb-movie-ack] .fb-video-controls .fb-btn{opacity:1;pointer-events:auto}',
        '.fb-media-unlock-target{display:none}',
        '.fb-video-controls .fb-btn{opacity:.45;pointer-events:none}',
        /* NowShowing LCD marquee */
        '.fb-marquee{position:relative;z-index:2;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:8px;padding:7px 12px;background:linear-gradient(180deg,#14100a 0%,#0a0806 55%,#100c08 100%);border-bottom:1px solid #3a2a1a;box-shadow:inset 0 0 18px rgba(0,0,0,.7);font-family:ui-monospace,"Courier New",Courier,monospace;color:#d4a574}',
        '.fb-marquee-board{flex:1;min-width:0;display:flex;flex-direction:row;align-items:center;max-width:920px;gap:8px}',
        '.fb-marquee-wing{max-width:22%;overflow:hidden;flex-shrink:0;display:flex;flex-direction:row;align-items:center;flex-wrap:nowrap}',
        '.fb-marquee-wing-letter{display:inline-block;font-size:.62rem;letter-spacing:.08em;text-transform:lowercase;color:#d4a574;text-shadow:0 0 6px rgba(212,165,116,.55);line-height:1;padding:0 1px}',
        '.fb-marquee-wing-gap{display:inline-block;width:4px}',
        '.fb-marquee-bulb{opacity:.55;flex-shrink:0;font-size:.45rem}',
        '.fb-bulb-0{opacity:.95}',
        '.fb-bulb-2{opacity:.75}',
        '.fb-lcd{flex:1;min-width:0;display:flex;flex-direction:row;align-items:center}',
        '.fb-lcd-window{flex:1;min-width:0;overflow:hidden;white-space:nowrap;mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}',
        '.fb-lcd-track{display:inline-block;white-space:nowrap;font-size:.78rem;letter-spacing:.04em;line-height:1.35;will-change:transform}',
        '.fb-lcd-link{color:#d4a574;text-decoration:none;text-shadow:0 0 5px rgba(212,165,116,.35)}',
        '.fb-lcd-link:hover{color:#f3e6d4;text-decoration:underline}',
        '.fb-lcd-star{opacity:.9}',
        /* Carousel */
        '.fb-now-showing-carousel{margin:12px 0 24px;color:#f3e6d4}',
        '.fb-slideshow-count{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#a67c52;margin:0 0 8px}',
        '.fb-slideshow-row{display:flex;flex-direction:row;align-items:stretch;gap:8px}',
        '.fb-slideshow-frame{flex:1;min-width:0;border:1px solid #3a2a1a;background:rgba(0,0,0,.35);padding:12px 14px}',
        '.fb-slideshow-media{display:block;color:#d4a574;text-decoration:none}',
        '.fb-slideshow-title{font-size:1.05rem;color:#f3e6d4}',
        '.fb-slideshow-next{flex-shrink:0;width:42px;border:1px solid #a67c52;background:linear-gradient(180deg,rgba(58,16,24,.95),rgba(18,8,10,.98));color:#d4a574;font-size:1.4rem;cursor:pointer}',
        /* Theater player shell */
        '.fb-theater-player{margin:12px 0}',
        '.fb-media-locked,.fb-media-pending{padding:16px;border:1px solid #3a2a1a;background:rgba(0,0,0,.35);color:#c9b8a4}',
        '.fb-media-video{width:100%;max-height:70vh;background:#000}',
        '.fb-media-inspect{margin-top:12px;font-size:.85rem}',
        '.fb-media-inspect-cid{word-break:break-all;color:#d4a574}',
        '.fb-media-inspect-links a{color:#d4a574;margin-right:10px}',
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
