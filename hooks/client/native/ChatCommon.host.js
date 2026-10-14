/**
 * Shared Flashback chat helpers for LiveChat / ChatApp park hosts.
 */
(function (global) {
  'use strict';

  if (global.__fbChat) return;

  var NICK_KEY = 'flashback.chat.nick.v1';
  var MODE_KEY = 'flashback.chat.nickMode.v1';

  function el(tag, className, text) {
    var n = global.document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Limited markdown → safe HTML (bold/italic/code/links/images). */
  function renderMd(raw) {
    var s = escapeHtml(raw);
    s = s.replace(/`([^`]+)`/g, '<code class="fb-chat-code">$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(
      /(https?:\/\/[^\s<]+)/g,
      function (url) {
        var clean = url.replace(/[),.;]+$/, '');
        var trail = url.slice(clean.length);
        var lower = clean.toLowerCase();
        var isImg =
          /\.(png|jpe?g|gif|webp)(\?|$)/i.test(clean) ||
          /\/media\//i.test(clean);
        if (isImg) {
          return (
            '<a class="fb-chat-link" href="' +
            clean +
            '" target="_blank" rel="noopener noreferrer">' +
            clean +
            '</a><div class="fb-chat-img-wrap"><img class="fb-chat-img" src="' +
            clean +
            '" alt="" loading="lazy" referrerpolicy="no-referrer" /></div>' +
            trail
          );
        }
        return (
          '<a class="fb-chat-link" href="' +
          clean +
          '" target="_blank" rel="noopener noreferrer">' +
          clean +
          '</a>' +
          trail
        );
      },
    );
    return s;
  }

  function normalizeChannel(raw) {
    var c = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/^#/, '');
    c = c.replace(/[^a-z0-9_\-./]/g, '').slice(0, 64);
    return c || 'flashback';
  }

  function channelFromPath(pathname) {
    var p = String(pathname || '/').split('?')[0];
    if (!p || p === '/') return 'page-home';
    if (p.charAt(0) === '/') p = p.slice(1);
    if (p.indexOf('movie/') === 0) p = p.slice(6);
    // known static pages
    var staticMap = {
      board: 'page-board',
      feedback: 'page-board',
      bugs: 'page-board',
      setup: 'page-setup',
      playback: 'page-setup',
      vlc: 'page-setup',
      app: 'page-app',
      android: 'page-app',
      apk: 'page-app',
      legal: 'page-legal',
      terms: 'page-terms',
      motivation: 'page-motivation',
      why: 'page-motivation',
      submit: 'page-submit',
      contribute: 'page-submit',
      request: 'page-request',
      downloads: 'page-request',
      email: 'page-request',
      chat: 'page-chat',
      'android-lab': 'page-android-lab',
    };
    if (staticMap[p]) return staticMap[p];
    if (p.indexOf('/') >= 0) return 'page-home';
    // movie slug
    return 'movie-' + p.replace(/[^a-z0-9_\-]/g, '-').slice(0, 48);
  }

  function getStoredNick() {
    try {
      var n = global.localStorage.getItem(NICK_KEY);
      if (n && n.length >= 2) return n.slice(0, 24);
    } catch (_) {}
    return '';
  }

  function setStoredNick(n) {
    try {
      global.localStorage.setItem(NICK_KEY, String(n || '').slice(0, 24));
    } catch (_) {}
  }

  function getNickMode() {
    try {
      return global.localStorage.getItem(MODE_KEY) || 'theater';
    } catch (_) {
      return 'theater';
    }
  }

  function setNickMode(m) {
    try {
      global.localStorage.setItem(MODE_KEY, m === 'cut-room' ? 'cut-room' : 'theater');
    } catch (_) {}
  }

  function apiBase() {
    return '';
  }

  function fetchJson(path) {
    return global.fetch(apiBase() + path, { credentials: 'same-origin', cache: 'no-store' }).then(
      function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      },
    );
  }

  function healthCheck() {
    return fetchJson('/chat/api/health').then(
      function (j) {
        return !!(j && j.ok);
      },
      function () {
        return false;
      },
    );
  }

  function fetchHistory(channel, limit) {
    var q =
      '/chat/api/history?channel=' +
      encodeURIComponent(normalizeChannel(channel)) +
      '&limit=' +
      encodeURIComponent(String(limit || 50));
    return fetchJson(q).then(function (j) {
      return (j && j.messages) || [];
    });
  }

  function fetchChannels(q) {
    var path = '/chat/api/channels';
    if (q) path += '?q=' + encodeURIComponent(q);
    return fetchJson(path).then(function (j) {
      return (j && j.channels) || [];
    });
  }

  function fetchName(mode) {
    var m = mode || getNickMode();
    return fetchJson('/chat/api/name?mode=' + encodeURIComponent(m)).then(function (j) {
      return (j && j.nick) || 'Lobby-A1';
    });
  }

  function ensureNick() {
    var existing = getStoredNick();
    if (existing) return Promise.resolve(existing);
    return fetchName().then(function (n) {
      setStoredNick(n);
      return n;
    });
  }

  function wsUrl() {
    var proto = global.location && global.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var host = (global.location && global.location.host) || 'localhost';
    return proto + '//' + host + '/chat/ws';
  }

  /**
   * Minimal JSON chat socket.
   * onEvent(obj) for server messages.
   */
  function connectChat(opts) {
    var nick = opts.nick;
    var onEvent = opts.onEvent || function () {};
    var ws = new global.WebSocket(wsUrl());
    var opened = false;
    var queue = [];

    function send(obj) {
      var raw = JSON.stringify(obj);
      if (ws.readyState === 1) ws.send(raw);
      else queue.push(raw);
    }

    ws.addEventListener('open', function () {
      opened = true;
      if (nick) send({ type: 'nick', nick: nick });
      while (queue.length) ws.send(queue.shift());
      onEvent({ type: 'open' });
    });
    ws.addEventListener('message', function (ev) {
      try {
        onEvent(JSON.parse(String(ev.data || '{}')));
      } catch (_) {}
    });
    ws.addEventListener('close', function () {
      onEvent({ type: 'close' });
    });
    ws.addEventListener('error', function () {
      onEvent({ type: 'error' });
    });

    return {
      send: send,
      join: function (ch) {
        send({ type: 'join', channel: normalizeChannel(ch) });
      },
      part: function (ch) {
        send({ type: 'part', channel: normalizeChannel(ch) });
      },
      privmsg: function (ch, text) {
        send({ type: 'privmsg', channel: normalizeChannel(ch), text: text });
      },
      nick: function (n) {
        nick = n;
        setStoredNick(n);
        send({ type: 'nick', nick: n });
      },
      close: function () {
        try {
          ws.close();
        } catch (_) {}
      },
      raw: function () {
        return ws;
      },
    };
  }

  function ensureChatCss() {
    if (global.document.getElementById('fb-chat-css')) return;
    var st = global.document.createElement('style');
    st.id = 'fb-chat-css';
    st.textContent = [
      '.fb-live-chat{margin:28px 0 8px;border:1px solid #3a2a1a;background:linear-gradient(165deg,rgba(42,20,24,.92),rgba(13,5,5,.96));color:#f5e6be;border-radius:4px;overflow:hidden}',
      '.fb-live-chat-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;border-bottom:1px solid #3a2a1a;background:rgba(0,0,0,.28)}',
      '.fb-live-chat-title{margin:0;font-size:.95rem;letter-spacing:.06em;text-transform:uppercase;color:#e8c872}',
      '.fb-live-chat-meta{font-size:.8rem;color:#a69788}',
      '.fb-live-chat-body{min-height:140px;max-height:280px;overflow:auto;padding:10px 14px;font-size:.92rem;line-height:1.45}',
      '.fb-live-chat-placeholder{padding:18px 14px;color:#a69788;font-size:.9rem}',
      '.fb-live-chat-foot{display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;border-top:1px solid #3a2a1a;background:rgba(0,0,0,.22)}',
      '.fb-live-chat-nick{width:140px;max-width:40%;padding:8px 10px;border:1px solid #5a4a2a;background:#12080a;color:#f5e6be;border-radius:3px;font:inherit}',
      '.fb-live-chat-input{flex:1;min-width:140px;padding:8px 10px;border:1px solid #5a4a2a;background:#12080a;color:#f5e6be;border-radius:3px;font:inherit}',
      '.fb-live-chat-send,.fb-chat-btn{padding:8px 12px;border:1px solid #e8c872;background:linear-gradient(180deg,#5a2430,#2a1018);color:#f5e6be;border-radius:3px;cursor:pointer;font:inherit}',
      '.fb-live-chat-send:hover,.fb-chat-btn:hover{border-color:#f5e6be}',
      '.fb-chat-msg{margin:0 0 8px;word-break:break-word}',
      '.fb-chat-msg-nick{color:#e8c872;font-weight:600;margin-right:6px}',
      '.fb-chat-msg-action{color:#c4b49a;font-style:italic}',
      '.fb-chat-msg-time{color:#6a5a4a;font-size:.75rem;margin-right:6px}',
      '.fb-chat-link{color:#e8c872}',
      '.fb-chat-code{font-family:ui-monospace,Consolas,monospace;font-size:.88em;color:#e8c872}',
      '.fb-chat-img-wrap{margin:6px 0}',
      '.fb-chat-img{max-width:min(320px,100%);max-height:200px;border:1px solid #3a2a1a;border-radius:2px}',
      '.fb-chat-unavailable{opacity:.85}',
      '.fb-chat-app{display:flex;flex-direction:row;align-items:stretch;min-height:min(70vh,720px);border:1px solid #3a2a1a;background:#0d0505;color:#f5e6be;border-radius:4px;overflow:hidden}',
      '.fb-chat-side{width:240px;max-width:42vw;flex-shrink:0;display:flex;flex-direction:column;border-right:1px solid #3a2a1a;background:rgba(18,8,10,.95)}',
      '.fb-chat-side-head{padding:12px;border-bottom:1px solid #3a2a1a}',
      '.fb-chat-side-title{margin:0 0 8px;font-size:.85rem;letter-spacing:.12em;text-transform:uppercase;color:#e8c872}',
      '.fb-chat-search{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #5a4a2a;background:#12080a;color:#f5e6be;border-radius:3px;font:inherit}',
      '.fb-chat-chan-list{flex:1;overflow:auto;padding:8px 0;margin:0;list-style:none}',
      '.fb-chat-chan{display:block;width:100%;text-align:left;padding:8px 12px;border:0;background:transparent;color:#c4b49a;cursor:pointer;font:inherit}',
      '.fb-chat-chan:hover,.fb-chat-chan.is-active{background:rgba(232,200,114,.12);color:#f5e6be}',
      '.fb-chat-main{flex:1;min-width:0;display:flex;flex-direction:column}',
      '.fb-chat-topic{padding:10px 14px;border-bottom:1px solid #3a2a1a;font-size:.88rem;color:#a69788;background:rgba(0,0,0,.25)}',
      '.fb-chat-scroll{flex:1;overflow:auto;padding:12px 14px}',
      '.fb-chat-composer{display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;border-top:1px solid #3a2a1a}',
      '.fb-chat-names{width:160px;flex-shrink:0;border-left:1px solid #3a2a1a;padding:10px;overflow:auto;font-size:.85rem;color:#a69788;background:rgba(0,0,0,.2)}',
      '.fb-chat-names h3{margin:0 0 8px;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;color:#b8860b}',
      '.fb-chat-status{font-size:.78rem;color:#a69788}',
      '@media (max-width:800px){.fb-chat-app{flex-direction:column;min-height:80vh}.fb-chat-side{width:100%;max-width:none;max-height:180px;border-right:0;border-bottom:1px solid #3a2a1a}.fb-chat-names{display:none}}',
    ].join('');
    (global.document.head || global.document.documentElement).appendChild(st);
  }

  function appendMessage(container, msg, opts) {
    opts = opts || {};
    var row = el('div', 'fb-chat-msg');
    if (msg.id) row.setAttribute('data-id', msg.id);
    var time = el('span', 'fb-chat-msg-time');
    try {
      var d = msg.ts ? new Date(msg.ts) : new Date();
      time.textContent = d.toISOString().slice(11, 19);
    } catch (_) {
      time.textContent = '';
    }
    row.appendChild(time);
    if (msg.kind === 'action') {
      var act = el('span', 'fb-chat-msg-action');
      act.textContent = '* ' + (msg.nick || '') + ' ' + (msg.text || '');
      row.appendChild(act);
    } else {
      var nick = el('span', 'fb-chat-msg-nick', msg.nick || '?');
      row.appendChild(nick);
      var body = el('span', 'fb-chat-msg-body');
      body.innerHTML = renderMd(msg.text || '');
      row.appendChild(body);
    }
    container.appendChild(row);
    if (opts.scroll !== false) {
      container.scrollTop = container.scrollHeight;
    }
  }

  global.__fbChat = {
    el: el,
    renderMd: renderMd,
    normalizeChannel: normalizeChannel,
    channelFromPath: channelFromPath,
    getStoredNick: getStoredNick,
    setStoredNick: setStoredNick,
    getNickMode: getNickMode,
    setNickMode: setNickMode,
    healthCheck: healthCheck,
    fetchHistory: fetchHistory,
    fetchChannels: fetchChannels,
    fetchName: fetchName,
    ensureNick: ensureNick,
    connectChat: connectChat,
    ensureChatCss: ensureChatCss,
    appendMessage: appendMessage,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
