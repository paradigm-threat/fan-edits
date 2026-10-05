/**
 * Web host for `fb-theater-player`: HTML5 video, seed/inspect chrome, external command props.
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
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      if (typeof v === 'number') return String(v);
      return String(v);
    }
    return fallback;
  }

  function propHandler(props, key) {
    if (!props) return null;
    const v = props[key];
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object' && typeof v.value === 'number') return v.value;
    return null;
  }

  function invoke(id, invokeHandler, onAfterInvoke) {
    if (id == null || typeof invokeHandler !== 'function') return;
    try {
      invokeHandler(id);
    } catch (_) {}
    if (typeof onAfterInvoke === 'function') {
      try {
        onAfterInvoke();
      } catch (_) {}
    }
  }

  function buildInspect(cid) {
    const wrap = global.document.createElement('div');
    wrap.className = 'fb-media-inspect';
    wrap.setAttribute('data-ipfs-inspect', '1');
    if (!cid) return wrap;

    const label = global.document.createElement('p');
    label.className = 'fb-media-inspect-label';
    label.textContent = 'Inspect on IPFS';
    wrap.appendChild(label);

    const row = global.document.createElement('div');
    row.className = 'fb-media-inspect-cid-row';
    const code = global.document.createElement('code');
    code.className = 'fb-media-inspect-cid';
    code.textContent = cid;
    row.appendChild(code);
    const copy = global.document.createElement('button');
    copy.type = 'button';
    copy.className = 'fb-btn fb-media-inspect-copy';
    copy.textContent = 'Copy CID';
    copy.addEventListener('click', () => {
      try {
        if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
          global.navigator.clipboard.writeText(cid);
        }
      } catch (_) {}
    });
    row.appendChild(copy);
    wrap.appendChild(row);

    const links = global.document.createElement('div');
    links.className = 'fb-media-inspect-links';
    const enc = encodeURIComponent(cid);
    const specs = [
      ['CID Inspector', 'https://cid.ipfs.tech/#' + cid],
      ['Providers', 'https://check.ipfs.network/?cid=' + enc],
      ['ipfs.io', 'https://ipfs.io/ipfs/' + enc],
      ['dweb.link', 'https://dweb.link/ipfs/' + enc],
    ];
    specs.forEach((pair) => {
      const a = global.document.createElement('a');
      a.href = pair[1];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = pair[0];
      links.appendChild(a);
    });
    wrap.appendChild(links);
    return wrap;
  }

  function applyCommands(video, props) {
    const playing = prop(props, 'playing', 'false') === 'true';
    const cmd = parseInt(prop(props, 'command', '0'), 10) || 0;
    const arg = parseFloat(prop(props, 'commandArg', ''));
    if (cmd === 1 || playing) {
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else if (cmd === 2) {
      video.pause();
    } else if (cmd === 3 && !Number.isNaN(arg)) {
      try {
        video.currentTime = arg;
      } catch (_) {}
    }
  }

  function buildTheaterPlayer(props, invokeHandler, onAfterInvoke) {
    const src = prop(props, 'src', '');
    const poster = prop(props, 'poster', '');
    const cid = prop(props, 'cid', '');
    const seedState = prop(props, 'seedState', 'pending');
    const seedMessage = prop(props, 'seedMessage', 'This file needs to be seeded');
    const seedHint = prop(props, 'seedHint', '');
    const unlocked = prop(props, 'unlocked', 'false') === 'true';

    const root = global.document.createElement('div');
    root.className = 'fb-theater-player';
    root.setAttribute('data-seed-state', seedState);

    const locked = global.document.createElement('div');
    locked.className = 'fb-media fb-media-locked';
    locked.setAttribute('aria-hidden', unlocked ? 'true' : 'false');
    if (unlocked) locked.style.display = 'none';
    const lockedMsg = global.document.createElement('p');
    lockedMsg.className = 'fb-media-msg';
    lockedMsg.textContent = 'Playback unlocks after you confirm ownership below.';
    locked.appendChild(lockedMsg);
    root.appendChild(locked);

    const unlock = global.document.createElement('div');
    unlock.className = 'fb-media-unlock-target';
    if (!unlocked) unlock.style.display = 'none';

    const pending = global.document.createElement('div');
    pending.className = 'fb-media fb-media-pending';
    pending.setAttribute('data-relay-media', seedState);
    const msg = global.document.createElement('p');
    msg.className = 'fb-media-msg';
    msg.textContent = seedMessage;
    pending.appendChild(msg);
    if (seedHint) {
      const hint = global.document.createElement('p');
      hint.className = 'fb-media-hint';
      hint.textContent = seedHint;
      pending.appendChild(hint);
    }
    pending.appendChild(buildInspect(cid));

    const shell = global.document.createElement('div');
    shell.className = 'fb-media-ready';
    shell.style.display = seedState === 'ready' && src ? 'block' : 'none';
    if (seedState === 'ready' && src) {
      pending.style.display = 'none';
    }

    const video = global.document.createElement('video');
    video.className = 'fb-media-video relay-video-player';
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'metadata');
    video.controls = false;
    if (src) video.src = src;
    if (poster) video.poster = poster;
    video.addEventListener('play', () => invoke(propHandler(props, 'onPlay'), invokeHandler, onAfterInvoke));
    video.addEventListener('pause', () => invoke(propHandler(props, 'onPause'), invokeHandler, onAfterInvoke));
    video.addEventListener('ended', () => invoke(propHandler(props, 'onEnded'), invokeHandler, onAfterInvoke));
    video.addEventListener('error', () => invoke(propHandler(props, 'onError'), invokeHandler, onAfterInvoke));
    applyCommands(video, props);
    shell.appendChild(video);

    unlock.appendChild(pending);
    unlock.appendChild(shell);
    root.appendChild(unlock);

    // Client-only: probe Relay asset status and reveal <video> when cached/ready.
    if (src && unlocked) {
      try {
        const statusUrl = src + (src.indexOf('?') >= 0 ? '&' : '?') + 'relayAssetStatus=1';
        global.fetch(statusUrl, { credentials: 'same-origin' })
          .then((r) => (r && r.ok ? r.json() : null))
          .then((j) => {
            if (!j) return;
            const st = (j.seed && j.seed.state) || j.state || '';
            const ready =
              st === 'cached' ||
              st === 'ready' ||
              j.error === 'ok' ||
              (j.message && String(j.message).indexOf('available') >= 0);
            if (ready) {
              pending.style.display = 'none';
              shell.style.display = 'block';
              root.setAttribute('data-seed-state', 'ready');
            }
          })
          .catch(() => {});
      } catch (_) {}
    }

    root.__fbVideo = video;
    root.__fbApplyCommands = () => applyCommands(video, props);
    return root;
  }

  function register() {
    if (typeof global.__relayRegisterParkNative === 'function') {
      global.__relayRegisterParkNative('fb-theater-player', buildTheaterPlayer);
    }
    try {
      if (global.customElements && !global.customElements.get('fb-theater-player')) {
        global.customElements.define(
          'fb-theater-player',
          class extends global.HTMLElement {
            connectedCallback() {
              if (this._fbBuilt) return;
              this._fbBuilt = true;
              const props = {};
              for (let i = 0; i < this.attributes.length; i++) {
                const a = this.attributes[i];
                props[a.name] = a.value;
              }
              const built = buildTheaterPlayer(props, () => {}, null);
              this.replaceChildren(built);
            }
          },
        );
      }
    } catch (_) {}
  }
  register();
  global.__fbBuildTheaterPlayer = buildTheaterPlayer;
})(typeof globalThis !== 'undefined' ? globalThis : window);
