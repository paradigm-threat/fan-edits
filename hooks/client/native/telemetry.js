/**
 * Theater / park RUM beacons → same-origin POST /api/rum (gateway SQLite).
 * Counts only; no free-form log shipping. Loaded before TheaterPlayer.host.js.
 */
(function (global) {
  'use strict';

  var MAJOR_ALWAYS = true;
  var SAMPLE = {
    js_error: 0.03,
    hydrate_fail: 0.25,
    compat_fallback: 0.05,
    underrun_soft: 0.1,
  };

  function pathname() {
    try {
      return (global.location && global.location.pathname) || '/';
    } catch (_) {
      return '/';
    }
  }

  function shouldSample(severity, code) {
    if (severity === 'major') return MAJOR_ALWAYS;
    var rate = SAMPLE[code];
    if (rate == null) rate = 0.05;
    return Math.random() < rate;
  }

  /**
   * @param {{ severity: 'major'|'minor', code: string, message?: string, rendition?: string, engine?: string, path?: string, force?: boolean }} opts
   */
  function reportTheaterIssue(opts) {
    try {
      if (!opts || !opts.code) return;
      var severity = opts.severity === 'major' ? 'major' : 'minor';
      var code = String(opts.code);
      if (!opts.force && !shouldSample(severity, code)) return;
      var payload = {
        kind: 'theater',
        severity: severity,
        code: code,
        path: opts.path || pathname(),
        rendition: opts.rendition || null,
        engine: opts.engine || null,
        message: opts.message ? String(opts.message).slice(0, 480) : null,
      };
      var body = JSON.stringify(payload);
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon('/api/rum', blob)) return;
      }
      if (typeof global.fetch === 'function') {
        global.fetch('/api/rum', {
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

  function installMinorErrorSampling() {
    try {
      if (global.__fbTheaterMinorInstalled) return;
      global.__fbTheaterMinorInstalled = true;
      global.addEventListener('error', function (ev) {
        var msg = (ev && (ev.message || (ev.error && ev.error.message))) || 'js_error';
        reportTheaterIssue({
          severity: 'minor',
          code: 'js_error',
          message: String(msg).slice(0, 240),
          engine: 'js',
        });
      });
      global.addEventListener('unhandledrejection', function (ev) {
        var reason = ev && ev.reason;
        var msg =
          (reason && (reason.message || String(reason))) || 'unhandledrejection';
        reportTheaterIssue({
          severity: 'minor',
          code: 'js_error',
          message: String(msg).slice(0, 240),
          engine: 'js',
        });
      });
    } catch (_) {
      /* optional */
    }
  }

  var api = {
    reportTheaterIssue: reportTheaterIssue,
    installMinorErrorSampling: installMinorErrorSampling,
  };
  global.__fbTheaterTelemetry = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
