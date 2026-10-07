/**
 * Web host for `fb-board`: list + submit public notes on branch `comments`.
 * Storage: `.relay/comments/by-path/<encoded-path>/<UTC>-<kind>.md`
 */
(function (global) {
  'use strict';

  var BRANCH = 'comments';
  var PATH_ROOT = '.relay/comments/by-path/';
  var MAX_BODY = 30000;

  function prop(props, key, fallback) {
    if (!props) return fallback;
    var keys = [key];
    if (key.indexOf('data-') !== 0) {
      keys.push('data-' + key.replace(/[A-Z]/g, function (m) {
        return '-' + m.toLowerCase();
      }));
    }
    for (var i = 0; i < keys.length; i++) {
      var v = props[keys[i]];
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

  function attrsToProps(el) {
    var o = {};
    if (!el || !el.attributes) return o;
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      o[a.name] = a.value;
    }
    return o;
  }

  /** Match Rust percent_encoding::NON_ALPHANUMERIC (A-Za-z0-9 only unescaped). */
  function encodeCommentTargetPath(repoRelativePath) {
    var trimmed = String(repoRelativePath || '').replace(/^\/+/, '');
    var out = '';
    for (var i = 0; i < trimmed.length; i++) {
      var c = trimmed.charAt(i);
      if (/[A-Za-z0-9]/.test(c)) {
        out += c;
      } else {
        var code = trimmed.charCodeAt(i);
        if (code < 128) {
          out += '%' + ('0' + code.toString(16).toUpperCase()).slice(-2);
        } else {
          var bytes = unescape(encodeURIComponent(c));
          for (var j = 0; j < bytes.length; j++) {
            out += '%' + ('0' + bytes.charCodeAt(j).toString(16).toUpperCase()).slice(-2);
          }
        }
      }
    }
    return out;
  }

  /**
   * HTTP path for a repo-relative path. Axum Path decodes once; write/file handlers
   * call url_decode again — so each segment needs encodeURIComponent twice for
   * storage keys that already contain %XX (e.g. encodeCommentTargetPath output).
   */
  function httpUrlForRepoPath(repoRelativePath) {
    var rel = String(repoRelativePath || '').replace(/^\/+/, '');
    if (!rel) return '/';
    var parts = rel.split('/');
    var enc = [];
    for (var i = 0; i < parts.length; i++) {
      enc.push(encodeURIComponent(encodeURIComponent(parts[i])));
    }
    return '/' + enc.join('/');
  }

  function branchHeaders(extra) {
    var h = { 'X-Relay-Branch': BRANCH };
    if (extra) {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k];
      }
    }
    return h;
  }

  function listTree(prefix) {
    var url = httpUrlForRepoPath(prefix || '');
    return global
      .fetch(url, {
        method: 'GET',
        headers: branchHeaders({ 'X-Relay-Tree': '1' }),
        credentials: 'same-origin',
        cache: 'no-store',
      })
      .then(function (r) {
        if (!r.ok) throw new Error('tree HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        return (j && j.entries) || [];
      });
  }

  function fetchText(path) {
    var url = httpUrlForRepoPath(path);
    return global
      .fetch(url, {
        method: 'GET',
        headers: branchHeaders({ Accept: 'text/plain, text/markdown, */*' }),
        credentials: 'same-origin',
        cache: 'no-store',
      })
      .then(function (r) {
        if (!r.ok) throw new Error('file HTTP ' + r.status);
        return r.text();
      });
  }

  function parseFrontMatter(raw) {
    var text = String(raw || '');
    var meta = {};
    var body = text;
    if (text.indexOf('---\n') === 0 || text.indexOf('---\r\n') === 0) {
      var end = text.indexOf('\n---', 3);
      if (end > 0) {
        var block = text.slice(4, end);
        body = text.slice(end + 4).replace(/^\r?\n/, '');
        var lines = block.split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
          var m = /^([a-zA-Z0-9_]+):\s*(.*)$/.exec(lines[i]);
          if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
      }
    }
    return { meta: meta, body: body };
  }

  function joinPath(a, b) {
    var left = String(a || '').replace(/\/+$/, '');
    var right = String(b || '').replace(/^\/+/, '');
    if (!left) return right;
    if (!right) return left;
    return left + '/' + right;
  }

  function collectMarkdownFiles(prefix, depth, acc) {
    if (depth > 8) return Promise.resolve(acc);
    return listTree(prefix).then(function (entries) {
      var jobs = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var name = e.name || '';
        var typ = e.type || '';
        var full = joinPath(prefix, name);
        if (typ === 'dir' || typ === 'tree') {
          jobs.push(collectMarkdownFiles(full, depth + 1, acc));
        } else if (/\.md$/i.test(name)) {
          acc.push(full);
        }
      }
      return Promise.all(jobs).then(function () {
        return acc;
      });
    });
  }

  function loadPosts() {
    return collectMarkdownFiles(PATH_ROOT.replace(/\/+$/, ''), 0, [])
      .catch(function () {
        return [];
      })
      .then(function (paths) {
        paths.sort();
        paths.reverse();
        var slice = paths.slice(0, 40);
        return Promise.all(
          slice.map(function (p) {
            return fetchText(p)
              .then(function (raw) {
                var parsed = parseFrontMatter(raw);
                return {
                  path: p,
                  kind: parsed.meta.kind || 'comment',
                  pagePath: parsed.meta.path || '',
                  created: parsed.meta.created || '',
                  name: parsed.meta.name || '',
                  body: parsed.body || '',
                };
              })
              .catch(function () {
                return null;
              });
          }),
        ).then(function (rows) {
          return rows.filter(Boolean).sort(function (a, b) {
            return String(b.created).localeCompare(String(a.created));
          });
        });
      });
  }

  function utcStamp() {
    var d = new Date();
    function p(n) {
      return (n < 10 ? '0' : '') + n;
    }
    return (
      d.getUTCFullYear() +
      p(d.getUTCMonth() + 1) +
      p(d.getUTCDate()) +
      'T' +
      p(d.getUTCHours()) +
      p(d.getUTCMinutes()) +
      p(d.getUTCSeconds()) +
      'Z'
    );
  }

  function buildMarkdown(fields) {
    var lines = [
      '---',
      'kind: ' + fields.kind,
      'path: ' + JSON.stringify(fields.path),
      'created: ' + fields.created,
    ];
    if (fields.name) lines.push('name: ' + JSON.stringify(fields.name));
    lines.push('---', '', fields.body, '');
    return lines.join('\n');
  }

  function putPost(filePath, markdown) {
    return global.fetch(httpUrlForRepoPath(filePath), {
      method: 'PUT',
      headers: branchHeaders({ 'Content-Type': 'text/markdown; charset=utf-8' }),
      body: markdown,
      credentials: 'same-origin',
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error(t || 'PUT HTTP ' + r.status);
        });
      }
      return r.json().catch(function () {
        return { ok: true };
      });
    });
  }

  function el(tag, className, text) {
    var n = global.document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function buildBoard(props) {
    var initialPath = prop(props, 'path', '/') || '/';
    var initialKind = prop(props, 'kind', 'comment') || 'comment';
    if (['bug', 'comment', 'review'].indexOf(initialKind) < 0) initialKind = 'comment';

    var root = el('div', 'fb-board');
    root.setAttribute('data-fb-board', '1');

    var intro = el('p', 'fb-board-intro');
    intro.textContent =
      'Public notes for Flashback — bugs, comments, and short reviews. Everyone can read these. They live on the git comments branch (not analytics).';
    root.appendChild(intro);

    var form = el('form', 'fb-board-form');
    form.setAttribute('novalidate', '1');

    var kindLabel = el('label', 'fb-board-label', 'Type');
    var kindSelect = global.document.createElement('select');
    kindSelect.className = 'fb-board-input';
    ;['bug', 'comment', 'review'].forEach(function (k) {
      var opt = global.document.createElement('option');
      opt.value = k;
      opt.textContent = k === 'bug' ? 'Bug' : k === 'review' ? 'Review' : 'Comment';
      if (k === initialKind) opt.selected = true;
      kindSelect.appendChild(opt);
    });
    kindLabel.appendChild(kindSelect);
    form.appendChild(kindLabel);

    var pathLabel = el('label', 'fb-board-label', 'Page path');
    var pathInput = global.document.createElement('input');
    pathInput.type = 'text';
    pathInput.className = 'fb-board-input';
    pathInput.value = initialPath;
    pathInput.setAttribute('autocomplete', 'off');
    pathLabel.appendChild(pathInput);
    form.appendChild(pathLabel);

    var nameLabel = el('label', 'fb-board-label', 'Name (optional)');
    var nameInput = global.document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'fb-board-input';
    nameInput.setAttribute('autocomplete', 'nickname');
    nameLabel.appendChild(nameInput);
    form.appendChild(nameLabel);

    var bodyLabel = el('label', 'fb-board-label', 'Message');
    var bodyArea = global.document.createElement('textarea');
    bodyArea.className = 'fb-board-input fb-board-textarea';
    bodyArea.rows = 6;
    bodyArea.setAttribute('required', '1');
    bodyLabel.appendChild(bodyArea);
    form.appendChild(bodyLabel);

    var actions = el('div', 'fb-board-actions');
    var submitBtn = el('button', 'fb-btn fb-btn-primary', 'Post publicly');
    submitBtn.type = 'submit';
    actions.appendChild(submitBtn);
    form.appendChild(actions);

    var status = el('p', 'fb-board-status');
    status.setAttribute('aria-live', 'polite');
    form.appendChild(status);

    root.appendChild(form);

    var listTitle = el('h2', 'fb-board-list-title', 'Latest posts');
    root.appendChild(listTitle);
    var list = el('div', 'fb-board-list');
    list.textContent = 'Loading…';
    root.appendChild(list);

    function paintList(posts) {
      list.replaceChildren();
      if (!posts.length) {
        list.appendChild(
          el(
            'p',
            'fb-board-empty',
            'No posts yet on the comments branch. Be the first — keep it short and kind.',
          ),
        );
        return;
      }
      for (var i = 0; i < posts.length; i++) {
        var post = posts[i];
        var card = el('article', 'fb-board-post');
        var head = el('p', 'fb-board-post-meta');
        var bits = [post.kind];
        if (post.pagePath) bits.push(post.pagePath);
        if (post.created) bits.push(post.created);
        if (post.name) bits.push(post.name);
        head.textContent = bits.join(' · ');
        card.appendChild(head);
        var body = el('div', 'fb-board-post-body');
        body.textContent = post.body;
        card.appendChild(body);
        list.appendChild(card);
      }
    }

    function refresh() {
      list.textContent = 'Loading…';
      loadPosts()
        .then(paintList)
        .catch(function (err) {
          list.textContent =
            'Could not load the comments branch yet (' +
            (err && err.message ? err.message : 'error') +
            '). Posts appear after the branch exists on this node.';
        });
    }

    form.addEventListener('submit', function (ev) {
      try {
        ev.preventDefault();
      } catch (_) {}
      var kind = kindSelect.value || 'comment';
      var pagePath = String(pathInput.value || '/').trim() || '/';
      if (pagePath.charAt(0) !== '/') pagePath = '/' + pagePath;
      var name = String(nameInput.value || '').trim();
      var body = String(bodyArea.value || '').trim();
      if (!body) {
        status.textContent = 'Please write a short message.';
        return;
      }
      if (body.length > MAX_BODY) {
        status.textContent = 'Message is too long (keep under ' + MAX_BODY + ' characters).';
        return;
      }
      var created = utcStamp();
      var fileName = created + '-' + kind + '.md';
      var filePath =
        PATH_ROOT + encodeCommentTargetPath(pagePath.replace(/^\//, '') || 'home') + '/' + fileName;
      var markdown = buildMarkdown({
        kind: kind,
        path: pagePath,
        created: created,
        name: name,
        body: body,
      });
      submitBtn.disabled = true;
      status.textContent = 'Posting…';
      putPost(filePath, markdown)
        .then(function () {
          status.textContent = 'Posted. Thank you — it is public on the comments branch.';
          bodyArea.value = '';
          try {
            var tel = global.__fbTheaterTelemetry;
            if (kind === 'bug' && tel && typeof tel.reportTheaterIssue === 'function') {
              tel.reportTheaterIssue({
                severity: 'major',
                code: 'user_report',
                message: body.slice(0, 200),
                path: pagePath,
                force: true,
              });
            }
          } catch (_) {}
          refresh();
        })
        .catch(function (err) {
          status.textContent =
            'Could not post (' +
            (err && err.message ? err.message : 'error') +
            '). This site’s publish node must accept PUT on branch comments.';
        })
        .then(function () {
          submitBtn.disabled = false;
        });
    });

    refresh();
    return root;
  }

  function register() {
    if (typeof global.__relayRegisterParkNative === 'function') {
      global.__relayRegisterParkNative('fb-board', buildBoard);
    }
    try {
      if (global.customElements && !global.customElements.get('fb-board')) {
        global.customElements.define(
          'fb-board',
          class extends global.HTMLElement {
            connectedCallback() {
              if (this._fbBuilt) return;
              this._fbBuilt = true;
              this.replaceChildren(buildBoard(attrsToProps(this)));
            }
          },
        );
      }
    } catch (_) {}
    try {
      var nodes = global.document.querySelectorAll(
        '[data-relay-park-native="fb-board"]:not([data-fb-upgraded])',
      );
      for (var i = 0; i < nodes.length; i++) {
        var host = nodes[i];
        host.setAttribute('data-fb-upgraded', '1');
        host.replaceChildren(buildBoard(attrsToProps(host)));
      }
    } catch (_) {}
  }

  function boot() {
    register();
    var n = 0;
    var t = global.setInterval(function () {
      register();
      n += 1;
      if (typeof global.__relayRegisterParkNative === 'function' || n > 80) {
        global.clearInterval(t);
      }
    }, 50);
    if (typeof global.__fbScheduleParkNativeReupgrade === 'function') {
      global.__fbScheduleParkNativeReupgrade(register);
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
  global.__fbBuildBoard = buildBoard;
})(typeof globalThis !== 'undefined' ? globalThis : window);
