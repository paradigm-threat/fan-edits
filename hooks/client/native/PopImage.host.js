/**
 * SSR-static poster lightbox (hydrate:false — no @relay/gallery CE).
 * Enhances img[data-fb-pop-image] → click / Enter / Space opens fullscreen.
 */
(function (global) {
  'use strict';

  var CSS_ID = 'fb-pop-image-css';
  var OVERLAY_ID = 'fb-pop-image-overlay';

  function ensureCss() {
    try {
      if (!global.document || global.document.getElementById(CSS_ID)) return;
      var st = global.document.createElement('style');
      st.id = CSS_ID;
      st.textContent = [
        'img[data-fb-pop-image]{cursor:zoom-in}',
        'img[data-fb-pop-image]:focus-visible{outline:2px solid #e8c872;outline-offset:3px}',
        '.fb-pop-overlay{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:rgba(6,4,5,.94);box-sizing:border-box}',
        '.fb-pop-overlay[hidden]{display:none!important}',
        '.fb-pop-overlay-img{max-width:min(960px,100%);max-height:100%;width:auto;height:auto;object-fit:contain;border:1px solid #4a3028;box-shadow:0 24px 80px rgba(0,0,0,.65);background:#1c1410}',
        '.fb-pop-overlay-close{position:absolute;top:max(12px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));border:1px solid #e8c872;background:rgba(26,8,12,.9);color:#f5e6be;font:inherit;font-size:1.25rem;line-height:1;padding:8px 12px;cursor:pointer;border-radius:4px}',
        '.fb-pop-overlay-close:hover{background:#3a1820}',
      ].join('');
      (global.document.head || global.document.documentElement).appendChild(st);
    } catch (_) {}
  }

  function closeOverlay() {
    var ov = global.document.getElementById(OVERLAY_ID);
    if (!ov) return;
    ov.hidden = true;
    try {
      if (ov._fbPrevOverflow != null && global.document.body) {
        global.document.body.style.overflow = ov._fbPrevOverflow;
      }
    } catch (_) {}
    try {
      if (ov._fbKeyHandler) {
        global.document.removeEventListener('keydown', ov._fbKeyHandler);
        ov._fbKeyHandler = null;
      }
    } catch (_) {}
    try {
      if (ov._fbReturnFocus && typeof ov._fbReturnFocus.focus === 'function') {
        ov._fbReturnFocus.focus();
      }
    } catch (_) {}
  }

  function openOverlay(src, alt, returnFocus) {
    ensureCss();
    var doc = global.document;
    var ov = doc.getElementById(OVERLAY_ID);
    if (!ov) {
      ov = doc.createElement('div');
      ov.id = OVERLAY_ID;
      ov.className = 'fb-pop-overlay';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      ov.setAttribute('aria-label', 'Poster');
      ov.hidden = true;

      var closeBtn = doc.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'fb-pop-overlay-close';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        closeOverlay();
      });

      var img = doc.createElement('img');
      img.className = 'fb-pop-overlay-img';
      img.alt = '';

      ov.appendChild(closeBtn);
      ov.appendChild(img);
      ov.addEventListener('click', function (e) {
        if (e.target === ov) closeOverlay();
      });
      (doc.body || doc.documentElement).appendChild(ov);
    }

    var imgEl = ov.querySelector('.fb-pop-overlay-img');
    if (imgEl) {
      imgEl.src = src;
      imgEl.alt = alt || '';
    }
    ov.setAttribute('aria-label', alt || 'Poster');
    ov._fbReturnFocus = returnFocus || null;
    try {
      ov._fbPrevOverflow = doc.body ? doc.body.style.overflow : '';
      if (doc.body) doc.body.style.overflow = 'hidden';
    } catch (_) {}
    ov.hidden = false;

    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        closeOverlay();
      }
    }
    ov._fbKeyHandler = onKey;
    doc.addEventListener('keydown', onKey);
    try {
      var btn = ov.querySelector('.fb-pop-overlay-close');
      if (btn) btn.focus();
    } catch (_) {}
  }

  function wire(img) {
    if (!img || img.getAttribute('data-fb-pop-wired') === '1') return;
    img.setAttribute('data-fb-pop-wired', '1');
    if (!img.getAttribute('role')) img.setAttribute('role', 'button');
    if (!img.hasAttribute('tabindex')) img.setAttribute('tabindex', '0');
    if (!img.getAttribute('aria-label')) {
      var titleHint =
        img.getAttribute('data-fb-pop-label') ||
        img.getAttribute('data-title') ||
        '';
      img.setAttribute(
        'aria-label',
        titleHint
          ? 'View poster for ' + titleHint
          : 'View poster fullscreen',
      );
    }
    function open(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      var src = img.currentSrc || img.src || img.getAttribute('src') || '';
      if (!src) return;
      var label =
        img.getAttribute('aria-label') || img.getAttribute('alt') || 'Poster';
      openOverlay(src, label, img);
    }
    img.addEventListener('click', open);
    img.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        open(e);
      }
    });
  }

  function enhance() {
    ensureCss();
    var nodes = global.document.querySelectorAll('img[data-fb-pop-image]');
    for (var i = 0; i < nodes.length; i++) wire(nodes[i]);
  }

  function boot() {
    enhance();
    if (typeof global.__fbScheduleParkNativeReupgrade === 'function') {
      global.__fbScheduleParkNativeReupgrade(enhance);
    } else {
      try {
        global.document.addEventListener('DOMContentLoaded', enhance);
      } catch (_) {}
    }
  }

  if (global.document && global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
