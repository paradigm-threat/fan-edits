/**
 * Web host for `fb-external-play`.
 * Ways to watch: Stream (Bunny Now showing) / Download (Bunny) or IPFS link / Email.
 */
(function (global) {
  'use strict';

  function prop(props, key, fallback) {
    if (!props) return fallback;
    const keys = [key];
    if (key.indexOf('data-') !== 0) {
      keys.push(
        'data-' +
          key.replace(/[A-Z]/g, function (m) {
            return '-' + m.toLowerCase();
          }),
      );
    }
    for (let i = 0; i < keys.length; i++) {
      const v = props[keys[i]];
      if (v == null) continue;
      if (typeof v === 'object' && v !== null && 'value' in v) {
        return v.value != null ? String(v.value) : fallback;
      }
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      return String(v);
    }
    return fallback;
  }

  function absoluteHttps(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    if (u.indexOf('https://') === 0 || u.indexOf('http://') === 0) return u;
    try {
      if (global.location && global.location.origin) {
        if (u.charAt(0) === '/') return global.location.origin + u;
        return global.location.origin + '/' + u;
      }
    } catch (_) {}
    if (u.charAt(0) === '/') return 'https://flashbackrepository.org' + u;
    return 'https://flashbackrepository.org/' + u;
  }

  function isAndroidBrowser() {
    try {
      const nav = global.navigator;
      if (!nav) return false;
      const ua = String(nav.userAgent || '');
      if (/Android/i.test(ua) && !/Windows Phone/i.test(ua)) return true;
      const uaData = nav.userAgentData;
      if (uaData && typeof uaData.platform === 'string') {
        if (String(uaData.platform).toLowerCase() === 'android') return true;
      }
    } catch (_) {}
    return false;
  }

  function isSmartTvBrowser() {
    try {
      const ua = String((global.navigator && global.navigator.userAgent) || '');
      if (/Web0S|webOS|WebOS/i.test(ua)) return true;
      if (/Tizen|SmartTV|Smart-TV|SMART-TV|AppleTV|BRAVIA|Viera|NetCast|HbbTV/i.test(ua)) {
        return true;
      }
      if (/Android/i.test(ua) && /(TV|AFT|SHIELD|MIBOX|MiBOX)/i.test(ua)) return true;
      if (
        global.matchMedia &&
        global.matchMedia('(pointer: coarse)').matches === false &&
        global.innerWidth >= 1200 &&
        /TV|SMART/i.test(ua)
      ) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function vlcProtocolUrl(httpsUrl) {
    const u = absoluteHttps(httpsUrl);
    if (u.indexOf('https://') !== 0 && u.indexOf('http://') !== 0) return '';
    try {
      if (global.encodeURIComponent) {
        return 'vlc://weblink?url=' + global.encodeURIComponent(u);
      }
    } catch (_) {}
    return 'vlc://' + u;
  }

  function intentViewUrl(httpsUrl) {
    const u = absoluteHttps(httpsUrl);
    if (u.indexOf('https://') !== 0 && u.indexOf('http://') !== 0) return '';
    return (
      'intent:' +
      u +
      '#Intent;action=android.intent.action.VIEW;type=video/*;scheme=https;end'
    );
  }

  function navigateExternal(href) {
    const h = String(href || '');
    if (!h) return false;
    try {
      const doc = global.document;
      if (doc && doc.body && doc.createElement) {
        const a = doc.createElement('a');
        a.href = h;
        a.setAttribute('rel', 'noopener noreferrer');
        a.style.display = 'none';
        doc.body.appendChild(a);
        a.click();
        try {
          doc.body.removeChild(a);
        } catch (_) {}
        return true;
      }
    } catch (_) {}
    try {
      global.location.href = h;
      return true;
    } catch (_) {
      return false;
    }
  }

  function copyText(text) {
    const t = String(text || '');
    if (!t) return false;
    try {
      if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
        global.navigator.clipboard.writeText(t);
        return true;
      }
    } catch (_) {}
    try {
      const ta = global.document.createElement('textarea');
      ta.value = t;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      global.document.body.appendChild(ta);
      ta.select();
      const ok = global.document.execCommand && global.document.execCommand('copy');
      global.document.body.removeChild(ta);
      return !!ok;
    } catch (_) {
      return false;
    }
  }

  function ownershipUnlocked(hostEl, propsUnlocked) {
    if (propsUnlocked === true) return true;
    try {
      if (hostEl && hostEl.getAttribute && hostEl.getAttribute('data-unlocked') === 'true') {
        return true;
      }
    } catch (_) {}
    try {
      const doc = global.document && global.document.documentElement;
      if (!doc) return false;
      const movieAck = doc.getAttribute('data-fb-movie-ack');
      const welcome = doc.getAttribute('data-fb-welcome-ack');
      return !!(movieAck && movieAck.length > 0 && welcome === '1');
    } catch (_) {
      return false;
    }
  }

  function el(tag, className, text) {
    const node = global.document.createElement(tag);
    if (className) node.className = className;
    if (text != null && text !== '') node.textContent = text;
    return node;
  }

  function setControlEnabled(node, on) {
    if (!node) return;
    if (node.tagName === 'BUTTON') {
      node.disabled = !on;
    }
    if (on) {
      node.removeAttribute('aria-disabled');
      node.classList.remove('is-disabled');
    } else {
      node.setAttribute('aria-disabled', 'true');
      node.classList.add('is-disabled');
    }
  }

  function buildExternalPlay(props, hostEl) {
    const masterUrl = absoluteHttps(prop(props, 'streamUrl', ''));
    const webUrl = absoluteHttps(prop(props, 'streamUrlWeb', '') || prop(props, 'data-stream-url-web', ''));
    const mobileUrl = absoluteHttps(
      prop(props, 'streamUrlMobile', '') || prop(props, 'data-stream-url-mobile', ''),
    );
    const catalogStatus = String(prop(props, 'status', '') || prop(props, 'data-status', '') || '')
      .trim()
      .toLowerCase();
    const catalogShowing = catalogStatus === 'showing';

    const disableWeb =
      prop(props, 'disableWeb', 'false') === true ||
      prop(props, 'disableWeb', 'false') === 'true' ||
      prop(props, 'data-disable-web', 'false') === 'true';
    const disableMobile =
      prop(props, 'disableMobile', 'false') === true ||
      prop(props, 'disableMobile', 'false') === 'true' ||
      prop(props, 'data-disable-mobile', 'false') === 'true';

    const ladder = [];
    function pushRung(kind, label, url) {
      const u = String(url || '');
      // Only live URLs — hide 1080p/720p until Bunny ladder (streamHttpsWeb/Mobile) exists.
      if (!u) return;
      for (let i = 0; i < ladder.length; i++) {
        if (ladder[i].url === u) return;
      }
      ladder.push({ kind: kind, label: label, url: u, disabled: false });
    }
    pushRung('master', 'Full quality', masterUrl);
    if (!disableWeb) pushRung('web', '1080p', webUrl);
    if (!disableMobile) pushRung('mobile', '720p', mobileUrl);
    // When disable* flags are set, rungs stay hidden (placeholders only). When flags
    // are false and URLs exist, show them.

    const smartTv = isSmartTvBrowser();
    let selectedIdx = 0;
    if (smartTv) {
      const webIdx = ladder.findIndex(function (r) {
        return r.kind === 'web';
      });
      const mobileIdx = ladder.findIndex(function (r) {
        return r.kind === 'mobile';
      });
      if (webIdx >= 0) selectedIdx = webIdx;
      else if (mobileIdx >= 0) selectedIdx = mobileIdx;
    }

    let streamUrl = ladder.length ? ladder[selectedIdx].url : '';
    const masterCid = String(prop(props, 'cid', '') || prop(props, 'data-cid', '') || '').trim();
    const downloadNameProp = String(
      prop(props, 'downloadName', '') || prop(props, 'data-download-name', '') || '',
    ).trim();
    const ipfsUri = masterCid ? 'ipfs://' + masterCid : '';
    const inCatalog = masterCid.length >= 8;

    function basenameFromUrl(url) {
      const raw = String(url || '');
      if (!raw) return 'movie.mkv';
      let path = raw;
      const q = path.indexOf('?');
      if (q >= 0) path = path.slice(0, q);
      const slash = path.lastIndexOf('/');
      let name = slash >= 0 ? path.slice(slash + 1) : path;
      try {
        if (global.decodeURIComponent) name = global.decodeURIComponent(name);
      } catch (_) {}
      return name || 'movie.mkv';
    }

    /** Bunny HTTPS download for Now showing only — never site /ipfs/ gateway. */
    function bunnyDownloadHref(url) {
      const u = String(url || '');
      if (!catalogShowing) return '';
      if (u.indexOf('https://') === 0 || u.indexOf('http://') === 0) return u;
      return '';
    }

    function downloadFilenameFor(kind, url) {
      if (downloadNameProp && kind === 'master') return downloadNameProp;
      return basenameFromUrl(url || downloadNameProp);
    }

    let unlocked = ownershipUnlocked(hostEl, prop(props, 'unlocked', 'false') === 'true');
    const setupHref = prop(props, 'setupHref', '/setup') || '/setup';
    const setupIpfsHref =
      setupHref.indexOf('#') >= 0 ? setupHref : setupHref.replace(/\/?$/, '') + '#ipfs';
    const android = isAndroidBrowser();
    const openMode = android ? 'android-intent' : smartTv ? 'https-stream' : 'vlc-protocol';

    const root = el('div', 'fb-external-play fb-theater-external fb-ways-to-watch');
    root.setAttribute('data-fb-external-play', '1');
    root.setAttribute('data-playback-engine', 'external');
    root.setAttribute('data-fb-open-mode', openMode);
    root.setAttribute('data-fb-unlocked', unlocked ? 'true' : 'false');
    root.setAttribute('data-fb-catalog-status', catalogStatus || 'unknown');
    if (smartTv) root.setAttribute('data-fb-smart-tv', '1');

    root.appendChild(el('h2', 'fb-ways-title', 'Ways to watch this movie'));
    root.appendChild(
      el(
        'p',
        'fb-ways-lead',
        'This browser cannot play the movie file here. Choose one of the three ways below.',
      ),
    );

    // Quality row only when more than one live rung (hide until Bunny 1080/720 exist).
    let qualityRow = null;
    if (ladder.length > 1) {
      const qWrap = el('div', 'fb-ways-quality');
      qWrap.appendChild(el('p', 'fb-ways-section-label', 'Quality'));
      qualityRow = el('div', 'fb-external-play-quality');
      qualityRow.setAttribute('role', 'radiogroup');
      qualityRow.setAttribute('aria-label', 'Stream quality');
      for (let qi = 0; qi < ladder.length; qi++) {
        ;(function (idx) {
          const btn = el('button', 'fb-btn fb-btn-quality' + (idx === selectedIdx ? ' is-active' : ''));
          btn.type = 'button';
          btn.textContent = ladder[idx].label;
          btn.setAttribute('role', 'radio');
          btn.setAttribute('aria-checked', idx === selectedIdx ? 'true' : 'false');
          btn.addEventListener('click', function () {
            selectedIdx = idx;
            applyStreamUrl(ladder[idx].url, ladder[idx].kind);
            const kids = qualityRow.querySelectorAll('.fb-btn-quality');
            for (let k = 0; k < kids.length; k++) {
              const on = k === idx;
              kids[k].classList.toggle('is-active', on);
              kids[k].setAttribute('aria-checked', on ? 'true' : 'false');
            }
          });
          qualityRow.appendChild(btn);
        })(qi);
      }
      qWrap.appendChild(qualityRow);
      root.appendChild(qWrap);
    }

    // --- 1. Stream ---
    const streamSec = el('section', 'fb-ways-section fb-ways-stream');
    streamSec.appendChild(el('h3', 'fb-ways-section-title', '1. Stream it now'));
    streamSec.appendChild(
      el(
        'p',
        'fb-ways-section-help',
        'Works for Now showing titles (Bunny CDN HTTPS). Other titles: open the IPFS link below, use the Flashback App, or Request Drive.',
      ),
    );
    const streamActions = el('div', 'fb-ways-actions fb-theater-external-actions');

    const openHttpsBtn = el('button', 'fb-btn fb-theater-open-https' + (smartTv ? ' fb-btn-primary' : ''));
    openHttpsBtn.type = 'button';
    openHttpsBtn.textContent = 'Open stream link';

    const openBtn = el(
      'button',
      'fb-btn fb-btn-external-play' +
        (android ? ' fb-btn-primary fb-theater-open-intent' : '') +
        (!android && !smartTv ? ' fb-btn-primary fb-theater-open-vlc' : '') +
        (smartTv ? ' fb-theater-open-vlc' : ''),
    );
    openBtn.type = 'button';
    openBtn.textContent = android ? 'Open in external player' : 'Open in VLC';

    const copyBtn = el('button', 'fb-btn fb-theater-copy-stream');
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy link';

    if (smartTv) {
      streamActions.appendChild(openHttpsBtn);
      streamActions.appendChild(openBtn);
    } else {
      streamActions.appendChild(openBtn);
      streamActions.appendChild(openHttpsBtn);
    }
    streamActions.appendChild(copyBtn);
    streamSec.appendChild(streamActions);

    const streamStatus = el('p', 'fb-ways-status fb-theater-seed-status');
    streamStatus.setAttribute('data-fb-seed-status', '1');
    streamSec.appendChild(streamStatus);
    root.appendChild(streamSec);

    // --- 2. Download (Bunny) or IPFS link (catalog) ---
    const dlSec = el('section', 'fb-ways-section fb-ways-download');
    dlSec.appendChild(
      el(
        'h3',
        'fb-ways-section-title',
        catalogShowing ? '2. Download the file' : '2. Open over IPFS',
      ),
    );
    dlSec.appendChild(
      el(
        'p',
        'fb-ways-section-help',
        catalogShowing
          ? 'Saves the MKV from Bunny CDN (Now showing). Open it in VLC when it finishes.'
          : 'Catalog masters are content hashes on IPFS — not a download from this site. Open the link in a supporting client, or use the Flashback App.',
      ),
    );
    const dlActions = el('div', 'fb-ways-actions fb-theater-external-actions');
    const kind0 = ladder[selectedIdx] ? ladder[selectedIdx].kind : 'master';
    const dlHref0 = bunnyDownloadHref(streamUrl);
    const dlName0 = downloadFilenameFor(kind0, streamUrl);

    // Bunny download button (Now showing only)
    const dlLink = el('a', 'fb-btn fb-theater-download-mkv');
    dlLink.href = dlHref0 || '#';
    if (dlHref0 && dlHref0.indexOf('b-cdn.net') >= 0) {
      dlLink.removeAttribute('download');
    } else if (dlHref0) {
      dlLink.setAttribute('download', dlName0);
    }
    dlLink.textContent =
      kind0 === 'master' || /\.mkv($|\?)/i.test(dlName0) ? 'Download MKV' : 'Download MP4';

    // Catalog: clickable ipfs:// + Copy CID (never site /ipfs/ gateway download)
    const ipfsLink = el('a', 'fb-btn fb-theater-ipfs-uri');
    ipfsLink.href = ipfsUri || '#';
    ipfsLink.textContent = ipfsUri || 'No IPFS CID';
    ipfsLink.setAttribute('rel', 'noopener noreferrer');

    const copyCidBtn = el('button', 'fb-btn fb-theater-copy-cid');
    copyCidBtn.type = 'button';
    copyCidBtn.textContent = 'Copy CID';

    if (catalogShowing) {
      dlActions.appendChild(dlLink);
    } else {
      dlActions.appendChild(ipfsLink);
      dlActions.appendChild(copyCidBtn);
    }
    dlSec.appendChild(dlActions);

    if (catalogShowing && dlHref0 && dlHref0.indexOf('http') === 0) {
      const dlUrlLine = el('p', 'fb-ways-url-line');
      const dlUrlA = el('a', 'fb-link fb-theater-download-url', dlHref0);
      dlUrlA.href = dlHref0;
      dlUrlA.setAttribute('target', '_blank');
      dlUrlA.setAttribute('rel', 'noopener noreferrer');
      dlUrlLine.appendChild(dlUrlA);
      dlSec.appendChild(dlUrlLine);
    }

    if (!catalogShowing && inCatalog) {
      const ipfsHow = el('p', 'fb-ways-helpers fb-ways-ipfs-how');
      const howLink = el('a', 'fb-link', 'How to open IPFS links');
      howLink.href = setupIpfsHref;
      ipfsHow.appendChild(howLink);
      ipfsHow.appendChild(global.document.createTextNode(' (Setup) · '));
      const appHow = el('a', 'fb-link', 'Flashback App');
      appHow.href = '/app';
      ipfsHow.appendChild(appHow);
      dlSec.appendChild(ipfsHow);
    }

    const dlStatus = el('p', 'fb-ways-status');
    dlSec.appendChild(dlStatus);
    root.appendChild(dlSec);

    // --- 3. Email ---
    const emailSec = el('section', 'fb-ways-section fb-ways-email');
    emailSec.appendChild(el('h3', 'fb-ways-section-title', '3. Get links by email'));
    emailSec.appendChild(
      el(
        'p',
        'fb-ways-section-help',
        'Send the request email — the automatic reply includes the shared Drive library.',
      ),
    );
    const emailActions = el('div', 'fb-ways-actions fb-theater-external-actions');
    const requestLink = el('a', 'fb-btn fb-theater-request-drive', 'Request Drive links');
    requestLink.href = '/request';
    emailActions.appendChild(requestLink);
    emailSec.appendChild(emailActions);
    root.appendChild(emailSec);

    // Helpers (not primary)
    const helpers = el('p', 'fb-ways-helpers');
    const setupLink = el('a', 'fb-link', 'Setup / VLC');
    setupLink.href = setupHref;
    helpers.appendChild(setupLink);
    if (!smartTv) {
      helpers.appendChild(global.document.createTextNode(' · '));
      const vlcGet = el('a', 'fb-link', android ? 'Get VLC (Play Store)' : 'Get VLC');
      if (android) {
        vlcGet.href = 'https://play.google.com/store/apps/details?id=org.videolan.vlc';
      } else {
        vlcGet.href = 'https://www.videolan.org/vlc/';
      }
      vlcGet.target = '_blank';
      vlcGet.rel = 'noopener noreferrer';
      helpers.appendChild(vlcGet);
    }
    helpers.appendChild(global.document.createTextNode(' · '));
    const appLink = el('a', 'fb-link', 'Flashback App');
    appLink.href = '/app';
    helpers.appendChild(appLink);
    root.appendChild(helpers);

    const feedback = el('p', 'fb-theater-external-status fb-ways-feedback');
    feedback.setAttribute('data-fb-external-status', '1');
    feedback.hidden = true;
    root.appendChild(feedback);

    // Hidden stream URL for accessibility / smart-TV fallback (not shown as a wall of text)
    const streamLink = el('a', 'fb-theater-external-url fb-ways-stream-url-sr');
    streamLink.setAttribute('data-fb-stream-url', '1');
    streamLink.setAttribute('rel', 'noopener noreferrer');
    if (streamUrl) {
      streamLink.href = streamUrl;
      streamLink.textContent = streamUrl;
    } else {
      streamLink.textContent = 'No stream URL yet.';
      streamLink.setAttribute('aria-disabled', 'true');
    }
    root.appendChild(streamLink);

    let failTimer = null;
    let leftPage = false;

    function setFeedback(msg) {
      const m = String(msg || '');
      if (!m) {
        feedback.textContent = '';
        feedback.hidden = true;
        return;
      }
      feedback.textContent = m;
      feedback.hidden = false;
    }

    function clearFailTimer() {
      if (failTimer) {
        global.clearTimeout(failTimer);
        failTimer = null;
      }
    }

    function syncUnlockedFlag() {
      unlocked = ownershipUnlocked(hostEl, false);
      try {
        const flag = unlocked ? 'true' : 'false';
        if (root.getAttribute('data-fb-unlocked') !== flag) {
          root.setAttribute('data-fb-unlocked', flag);
        }
        if (unlocked && hostEl && hostEl.getAttribute && hostEl.getAttribute('data-unlocked') !== 'true') {
          hostEl.setAttribute('data-unlocked', 'true');
        }
      } catch (_) {}
    }

    function streamServerReady() {
      // Stream is exclusive to Now showing (bytes uploaded on this server).
      // Never enable from tip-path probes — non-showing titles are IPFS/email only.
      return !!streamUrl && catalogShowing === true;
    }

    function applyAvailability() {
      syncUnlockedFlag();
      const own = unlocked;
      const serverOk = streamServerReady();
      const streamOn = own && serverOk;
      const bunnyHref = bunnyDownloadHref(streamUrl);
      const bunnyOn = own && !!bunnyHref;
      const ipfsOn = own && inCatalog && !!ipfsUri;

      if (catalogShowing && bunnyHref && dlLink) {
        dlLink.href = bunnyHref;
        const fname = downloadFilenameFor(
          ladder[selectedIdx] ? ladder[selectedIdx].kind : 'master',
          bunnyHref,
        );
        if (bunnyHref.indexOf('b-cdn.net') >= 0) {
          dlLink.removeAttribute('download');
        } else if (fname) {
          dlLink.setAttribute('download', fname);
        }
      }
      if (!catalogShowing && ipfsLink) {
        ipfsLink.href = ipfsUri || '#';
        ipfsLink.textContent = ipfsUri || 'No IPFS CID';
      }

      setControlEnabled(openBtn, streamOn);
      setControlEnabled(openHttpsBtn, streamOn);
      setControlEnabled(copyBtn, streamOn);
      if (catalogShowing) {
        setControlEnabled(dlLink, bunnyOn);
      } else {
        setControlEnabled(ipfsLink, ipfsOn);
        setControlEnabled(copyCidBtn, ipfsOn);
      }

      if (!own) {
        streamStatus.textContent = 'Confirm ownership above first.';
        dlStatus.textContent = 'Confirm ownership above first.';
      } else {
        if (!catalogShowing || !streamUrl) {
          streamStatus.textContent =
            'Not Now showing. Open the IPFS link below, use the Flashback App, or Request Drive.';
        } else {
          streamStatus.textContent = 'Ready on Bunny CDN (Now showing).';
        }

        if (catalogShowing && streamUrl) {
          dlStatus.textContent = 'Ready to download MKV from Bunny CDN.';
        } else if (!inCatalog || !ipfsUri) {
          dlStatus.textContent = 'This title is not in the IPFS catalog yet.';
        } else {
          dlStatus.textContent = 'Open the IPFS link in a supporting client (see Setup).';
        }
      }
    }

    function requireStreamAction(hint) {
      syncUnlockedFlag();
      if (!unlocked) {
        setFeedback(hint || 'Confirm ownership first, then stream.');
        scrollToGate();
        return false;
      }
      if (!streamUrl) {
        setFeedback('No stream URL yet.');
        return false;
      }
      if (!streamServerReady()) {
        setFeedback('This server does not have the file ready yet.');
        return false;
      }
      return true;
    }

    function requireBunnyDownload() {
      syncUnlockedFlag();
      if (!unlocked) {
        setFeedback('Confirm ownership first, then download.');
        scrollToGate();
        return false;
      }
      const href = bunnyDownloadHref(streamUrl);
      if (!href) {
        setFeedback('No download URL for this Now showing title yet.');
        return false;
      }
      return true;
    }

    function requireIpfsAction() {
      syncUnlockedFlag();
      if (!unlocked) {
        setFeedback('Confirm ownership first, then open the IPFS link.');
        scrollToGate();
        return false;
      }
      if (!ipfsUri) {
        setFeedback('This title is not in the IPFS catalog yet.');
        return false;
      }
      return true;
    }

    function scrollToGate() {
      try {
        const gate = global.document.querySelector(
          '.fb-affirmation-native, .fb-gate, [aria-modal="true"]',
        );
        if (gate && gate.scrollIntoView) {
          gate.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch (_) {}
    }

    function applyStreamUrl(url, kind) {
      streamUrl = String(url || '');
      if (streamUrl) {
        streamLink.href = streamUrl;
        streamLink.textContent = streamUrl;
        streamLink.removeAttribute('aria-disabled');
      } else {
        streamLink.removeAttribute('href');
        streamLink.textContent = 'No stream URL yet.';
        streamLink.setAttribute('aria-disabled', 'true');
      }
      if (catalogShowing) {
        const dlHref = bunnyDownloadHref(streamUrl);
        const dlName = downloadFilenameFor(kind, streamUrl);
        dlLink.href = dlHref || '#';
        if (dlHref && dlHref.indexOf('b-cdn.net') >= 0) {
          dlLink.removeAttribute('download');
        } else if (dlHref) {
          dlLink.setAttribute('download', dlName);
        }
        dlLink.textContent =
          kind === 'master' || /\.mkv($|\?)/i.test(dlName) ? 'Download MKV' : 'Download MP4';
      }
      applyAvailability();
    }

    openHttpsBtn.addEventListener('click', function () {
      clearFailTimer();
      leftPage = false;
      if (!requireStreamAction('Confirm ownership first, then open the stream link.')) return;
      setFeedback(smartTv ? 'Opening stream on this TV…' : 'Opening stream link…');
      if (!navigateExternal(streamUrl)) {
        setFeedback('Could not open the stream link. Try Copy link.');
      }
    });

    openBtn.addEventListener('click', function () {
      clearFailTimer();
      leftPage = false;
      if (
        !requireStreamAction(
          android
            ? 'Confirm ownership first, then open in an external player.'
            : 'Confirm ownership first, then open in VLC.',
        )
      ) {
        return;
      }
      let launch = '';
      if (android) {
        launch = intentViewUrl(streamUrl);
        if (!launch) {
          setFeedback('Could not build the player link. Try Open stream link or Copy link.');
          return;
        }
        setFeedback('Opening player…');
      } else {
        launch = vlcProtocolUrl(streamUrl);
        if (!launch) {
          setFeedback('Could not build the VLC link. Try Open stream link or Copy link.');
          return;
        }
        setFeedback('Opening VLC…');
      }
      if (!navigateExternal(launch)) {
        setFeedback(
          android
            ? 'Could not open a player. Try Open stream link or Copy link.'
            : 'VLC did not open. Try Open stream link, or finish Setup.',
        );
        return;
      }
      failTimer = global.setTimeout(function () {
        failTimer = null;
        if (leftPage) return;
        try {
          if (global.document && global.document.visibilityState === 'hidden') return;
        } catch (_) {}
        setFeedback(
          android
            ? 'No player opened — try Open stream link, or install VLC.'
            : 'VLC did not open — try Open stream link, or finish Setup.',
        );
      }, 1400);
    });

    copyBtn.addEventListener('click', function () {
      clearFailTimer();
      if (!requireStreamAction('Confirm ownership first, then copy the link.')) return;
      if (copyText(streamUrl)) {
        setFeedback(
          android
            ? 'Copied — open VLC → Network → paste the link.'
            : 'Copied — paste into VLC → Media → Open Network Stream.',
        );
      } else {
        setFeedback('Copy failed — try Open stream link instead.');
      }
    });

    if (catalogShowing) {
      dlLink.addEventListener('click', function (ev) {
        if (!requireBunnyDownload()) {
          ev.preventDefault();
          return;
        }
        if (!dlLink.getAttribute('href') || dlLink.getAttribute('href') === '#') {
          ev.preventDefault();
          setFeedback('No download URL yet.');
          return;
        }
        setFeedback('Download starting — large file; open it in VLC when finished.');
      });
    } else {
      ipfsLink.addEventListener('click', function (ev) {
        if (!requireIpfsAction()) {
          ev.preventDefault();
          return;
        }
        setFeedback('Opening IPFS URI — use a supporting client if your browser asks.');
      });
      copyCidBtn.addEventListener('click', function () {
        if (!requireIpfsAction()) return;
        if (copyText(masterCid)) {
          setFeedback('CID copied — paste into IPFS Desktop, Kubo, or Companion.');
        } else {
          setFeedback('Copy failed — select the IPFS link instead.');
        }
      });
    }

    streamLink.addEventListener('click', function (ev) {
      if (!requireStreamAction('Confirm ownership first, then open the stream link.')) {
        ev.preventDefault();
      }
    });

    try {
      global.addEventListener('pagehide', function () {
        leftPage = true;
        clearFailTimer();
      });
      global.addEventListener('visibilitychange', function () {
        try {
          if (global.document && global.document.visibilityState === 'hidden') {
            leftPage = true;
            clearFailTimer();
          }
        } catch (_) {}
      });
    } catch (_) {}

    try {
      if (global.MutationObserver) {
        const sync = function () {
          applyAvailability();
        };
        if (hostEl) {
          new global.MutationObserver(sync).observe(hostEl, {
            attributes: true,
            attributeFilter: ['data-unlocked'],
          });
        }
        if (global.document && global.document.documentElement) {
          new global.MutationObserver(sync).observe(global.document.documentElement, {
            attributes: true,
            attributeFilter: ['data-fb-movie-ack', 'data-fb-welcome-ack'],
          });
        }
      }
    } catch (_) {}

    applyAvailability();
    return root;
  }

  function attrsToProps(elNode) {
    const props = {};
    for (let i = 0; i < elNode.attributes.length; i++) {
      const a = elNode.attributes[i];
      props[a.name] = a.value;
    }
    return props;
  }

  function needsUpgrade(host) {
    const fn = global.__fbHostNeedsUpgrade;
    if (typeof fn === 'function') {
      return fn(host, '.fb-external-play');
    }
    return host && !host.querySelector('.fb-external-play');
  }

  function upgradePlaceholders() {
    try {
      const nodes = global.document.querySelectorAll('[data-relay-park-native="fb-external-play"]');
      for (let i = 0; i < nodes.length; i++) {
        const host = nodes[i];
        if (!needsUpgrade(host)) continue;
        host.setAttribute('data-fb-built', '1');
        const built = buildExternalPlay(attrsToProps(host), host);
        host.replaceChildren(built);
      }
    } catch (_) {}
  }

  function register() {
    if (typeof global.__relayRegisterParkNative === 'function') {
      global.__relayRegisterParkNative('fb-external-play', function (props) {
        return buildExternalPlay(props, null);
      });
    }
    try {
      if (global.customElements && !global.customElements.get('fb-external-play')) {
        global.customElements.define(
          'fb-external-play',
          class extends global.HTMLElement {
            connectedCallback() {
              if (this._fbBuilt) return;
              this._fbBuilt = true;
              const built = buildExternalPlay(attrsToProps(this), this);
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
    const t = global.setInterval(function () {
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
  global.__fbBuildExternalPlay = buildExternalPlay;
  global.__fbExternalPlayIsAndroid = isAndroidBrowser;
  global.__fbExternalPlayIsSmartTv = isSmartTvBrowser;
  global.__fbExternalPlayIntentUrl = intentViewUrl;
})(typeof globalThis !== 'undefined' ? globalThis : window);
