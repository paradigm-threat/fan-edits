/**
 * Fill affirmation-gated hit counters after paint (never during CleverScript SSR).
 * data-fb-hits="site" | data-fb-hits="movie" data-fb-hits-path="/slug"
 */
(function (global) {
  'use strict';

  function formatHitCount(n) {
    if (typeof n !== 'number' || !(n >= 0)) return '';
    if (n < 1000) return String(Math.floor(n));
    if (n < 1000000) return (n / 1000).toFixed(n < 10000 ? 1 : 0) + 'k';
    return (n / 1000000).toFixed(1) + 'M';
  }

  function fill(el, text, tip) {
    if (!el) return;
    el.textContent = text;
    if (tip) el.setAttribute('title', tip);
    el.hidden = false;
    el.removeAttribute('hidden');
  }

  function applySite(data) {
    var nodes = global.document.querySelectorAll('[data-fb-hits="site"]');
    if (!nodes.length) return;
    var n = data && typeof data.site_unique_24h === 'number' ? data.site_unique_24h : -1;
    if (n < 0) return;
    var label = formatHitCount(n);
    if (!label) return;
    var tip = 'Unique welcome affirmations across the fleet (24h) — not page bots';
    if (typeof data.site_unique_1h === 'number' && data.site_unique_1h >= 0) {
      tip += ' · 1h: ' + formatHitCount(data.site_unique_1h);
    }
    for (var i = 0; i < nodes.length; i++) {
      fill(nodes[i], label + ' visitors (24h)', tip);
    }
  }

  function applyMovie(el, data) {
    var n = data && typeof data.unique_24h === 'number' ? data.unique_24h : -1;
    if (n < 0) return;
    var label = formatHitCount(n);
    if (!label) return;
    var tip = 'Unique title affirmations in the last 24 hours (not plays)';
    if (typeof data.unique_1h === 'number' && data.unique_1h >= 0) {
      tip += ' · 1h: ' + formatHitCount(data.unique_1h);
    }
    fill(el, label + ' theater entries (24h)', tip);
  }

  function load() {
    try {
      if (!global.fetch || !global.document) return;
      var siteNodes = global.document.querySelectorAll('[data-fb-hits="site"]');
      var movieNodes = global.document.querySelectorAll('[data-fb-hits="movie"]');
      if (siteNodes.length) {
        global
          .fetch('/api/hits', { credentials: 'omit', cache: 'no-store' })
          .then(function (r) {
            return r && r.ok ? r.json() : null;
          })
          .then(applySite)
          .catch(function () {});
      }
      for (var i = 0; i < movieNodes.length; i++) {
        (function (el) {
          var path = el.getAttribute('data-fb-hits-path') || '';
          if (!path) return;
          global
            .fetch('/api/hits?path=' + encodeURIComponent(path), {
              credentials: 'omit',
              cache: 'no-store',
            })
            .then(function (r) {
              return r && r.ok ? r.json() : null;
            })
            .then(function (data) {
              applyMovie(el, data);
            })
            .catch(function () {});
        })(movieNodes[i]);
      }
    } catch (_) {}
  }

  function boot() {
    load();
    var sched = global.__fbScheduleParkNativeReupgrade;
    if (typeof sched === 'function') {
      sched(load);
    }
  }

  if (typeof global.document !== 'undefined') {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
