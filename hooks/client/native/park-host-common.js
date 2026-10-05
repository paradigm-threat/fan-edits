/**
 * Shared boot helpers for park-native *.host.js — re-upgrade after soft-hydrate.
 */
(function (global) {
  'use strict';

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
    function run() {
      try {
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

  global.__fbHostNeedsUpgrade = hostNeedsUpgrade;
  global.__fbScheduleParkNativeReupgrade = scheduleParkNativeReupgrade;
})(typeof globalThis !== 'undefined' ? globalThis : window);
