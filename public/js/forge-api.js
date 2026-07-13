/* ============================================================
   FORGE ATLAS · forge-api.js
   Unified frontend API client.
   Wraps Workers endpoints + Atlas ID auth state.
   Exposes window.FORGE_ATLAS.API
   ============================================================ */
(function () {
  'use strict';
  window.FORGE_ATLAS = window.FORGE_ATLAS || {};

  var ID_KEY = 'atlas.id.v10';
  var ENDPOINTS = {
    forum:   '/api/forum-bridge',
    arena:   '/api/arena-llm',
    status:  '/api/ops-status',
    helper:  '/api/atlas-helper',
    rescuer: '/api/atlas-rescuer',
  };

  /* ----------------------------------------------------------
     UTIL
  ---------------------------------------------------------- */
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) { return r.json(); });
  }

  function get(url) {
    return fetch(url).then(function (r) { return r.json(); });
  }

  /* ----------------------------------------------------------
     AUTH · Atlas ID localStorage identity
     No server-side auth in v10 — identity is local + portable.
     Full profile editing at atlas-id.html.
  ---------------------------------------------------------- */
  var Auth = {
    get: function () {
      try {
        var raw = localStorage.getItem(ID_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },

    save: function (profile) {
      try {
        localStorage.setItem(ID_KEY, JSON.stringify(profile));
        return true;
      } catch (e) { return false; }
    },

    ensure: function () {
      var p = Auth.get();
      if (!p) {
        var s = (Math.random().toString(36) + Date.now().toString(36))
          .replace(/[^a-z0-9]/g, '').slice(0, 4).toUpperCase();
        p = {
          callsign: 'Operator-' + s,
          rank: 'initiate',
          avatar: null,
          joined: Date.now(),
          guest: true,
          stats: { threads: 0, replies: 0, helpful: 0 },
        };
        Auth.save(p);
      }
      return p;
    },

    isLoggedIn: function () {
      var p = Auth.get();
      return Boolean(p && !p.guest);
    },

    logout: function () {
      try { localStorage.removeItem(ID_KEY); } catch (e) {}
    },

    rankLabel: function (rank) {
      return ({
        initiate: 'Initiate', operator: 'Operator',
        architect: 'Architect', strategist: 'Strategist', founder: 'Founder Class',
      })[rank] || 'Initiate';
    },
  };

  /* ----------------------------------------------------------
     FORUM · wraps /api/forum-bridge (GitHub Issues backend)
     Falls back to resolved error if endpoint unreachable.
  ---------------------------------------------------------- */
  var Forum = {
    list: function (forum, opts) {
      var body = { op: 'list', forum: forum || 'ai' };
      if (opts && opts.category) body.category = opts.category;
      return post(ENDPOINTS.forum, body);
    },

    read: function (forum, threadId) {
      return post(ENDPOINTS.forum, { op: 'read', forum: forum || 'ai', threadId: String(threadId) });
    },

    create: function (forum, opts) {
      var profile = Auth.ensure();
      return post(ENDPOINTS.forum, {
        op: 'create',
        forum: forum || 'ai',
        title: String(opts.title || '').slice(0, 200),
        body: String(opts.body || '').slice(0, 4000),
        category: opts.category || 'general',
        author: { callsign: profile.callsign, rank: profile.rank },
      });
    },

    reply: function (forum, threadId, body) {
      var profile = Auth.ensure();
      return post(ENDPOINTS.forum, {
        op: 'reply',
        forum: forum || 'ai',
        threadId: String(threadId),
        body: String(body || '').slice(0, 4000),
        author: { callsign: profile.callsign, rank: profile.rank },
      });
    },

    react: function (forum, threadId, reaction) {
      return post(ENDPOINTS.forum, {
        op: 'react',
        forum: forum || 'ai',
        threadId: String(threadId),
        reaction: reaction,
      });
    },
  };

  /* ----------------------------------------------------------
     ARENA · wraps /api/arena-llm
     Generates live battle transcripts via Anthropic API (server-side).
  ---------------------------------------------------------- */
  var Arena = {
    battle: function (opts) {
      if (!opts || !opts.a || !opts.b || !opts.topic) {
        return Promise.reject(new Error('arena.battle requires { a, b, topic }'));
      }
      return post(ENDPOINTS.arena, {
        matchId: opts.matchId || ('m-' + Date.now()),
        a: String(opts.a).slice(0, 60),
        b: String(opts.b).slice(0, 60),
        topic: String(opts.topic).slice(0, 400),
        format: String(opts.format || 'Debate').slice(0, 40),
      });
    },
  };

  /* ----------------------------------------------------------
     STATUS · wraps /api/ops-status
  ---------------------------------------------------------- */
  var Status = {
    get: function () { return get(ENDPOINTS.status); },
  };

  /* ----------------------------------------------------------
     RESCUER · wraps /api/atlas-rescuer
  ---------------------------------------------------------- */
  var Rescuer = {
    revive: function (forum, threadId) {
      return post(ENDPOINTS.rescuer, {
        op: 'rescue',
        forum: forum || 'ai',
        threadId: String(threadId),
      });
    },
  };

  /* ----------------------------------------------------------
     AUTH UI · identity badge widget
     Mounts a compact badge showing callsign + rank with edit link.
     Designed for nav or header injection.

     Usage: FORGE_ATLAS.API.AuthUI.mount('#my-container')
  ---------------------------------------------------------- */
  var AuthUI = {
    mount: function (selector) {
      var host = typeof selector === 'string'
        ? document.querySelector(selector)
        : selector;
      if (!host) return;
      var profile = Auth.ensure();
      AuthUI._render(host, profile);

      window.addEventListener('storage', function (e) {
        if (e.key === ID_KEY) {
          var p = Auth.get() || Auth.ensure();
          AuthUI._render(host, p);
        }
      });
    },

    _render: function (host, profile) {
      var rankClass = 'fa-rank-' + (profile.rank || 'initiate');
      var guestNote = profile.guest
        ? ' · <a href="atlas-id.html" style="color:var(--gold)">claim callsign</a>'
        : '';
      host.innerHTML =
        '<span class="fa-id-badge ' + rankClass + '">' +
          '<span class="fa-id-callsign">' + esc(profile.callsign) + '</span>' +
          '<span class="fa-id-rank">' + esc(Auth.rankLabel(profile.rank)) + '</span>' +
          guestNote +
        '</span>';
    },

    /* Inline signup panel — renders a minimal callsign-picker overlay.
       For full profile management, users visit atlas-id.html. */
    promptCallsign: function (onSave) {
      if (document.querySelector('.fa-callsign-prompt')) return;
      var panel = document.createElement('div');
      panel.className = 'fa-callsign-prompt';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Set your callsign');
      panel.innerHTML =
        '<div class="fa-callsign-card">' +
          '<div class="fa-callsign-head">Choose your callsign</div>' +
          '<p class="fa-callsign-sub">Pseudonymous. Stored locally. No email. No password.</p>' +
          '<input type="text" class="fa-callsign-input" id="fa-cs-input" ' +
            'placeholder="Enter callsign..." maxlength="24" autocomplete="off">' +
          '<div class="fa-callsign-hint" id="fa-cs-hint"></div>' +
          '<div class="fa-callsign-actions">' +
            '<button class="fa-btn" id="fa-cs-save">Save callsign</button>' +
            '<button class="fa-btn fa-btn-ghost" id="fa-cs-cancel">Cancel</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(panel);

      var input = panel.querySelector('#fa-cs-input');
      var hint = panel.querySelector('#fa-cs-hint');
      var save = panel.querySelector('#fa-cs-save');
      var cancel = panel.querySelector('#fa-cs-cancel');

      var existing = Auth.get();
      if (existing && existing.callsign) input.value = existing.callsign;

      function validate(v) {
        v = v.trim();
        if (!v) return 'Enter a callsign.';
        if (v.length < 3) return 'At least 3 characters.';
        if (!/^[a-zA-Z0-9_\-\. ]+$/.test(v)) return 'Letters, numbers, - _ . only.';
        return '';
      }

      input.addEventListener('input', function () {
        hint.textContent = validate(input.value);
      });

      function close() {
        if (panel.parentNode) panel.parentNode.removeChild(panel);
      }

      save.addEventListener('click', function () {
        var err = validate(input.value);
        if (err) { hint.textContent = err; return; }
        var profile = Auth.ensure();
        profile.callsign = input.value.trim();
        profile.guest = false;
        Auth.save(profile);
        close();
        if (typeof onSave === 'function') onSave(profile);
      });

      cancel.addEventListener('click', close);
      input.focus();

      panel.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
        if (e.key === 'Enter') save.click();
      });
    },
  };

  /* ----------------------------------------------------------
     AVAILABILITY CHECK · probe endpoints once per session
  ---------------------------------------------------------- */
  var availability = {};

  function probeEndpoint(key) {
    var cached = sessionStorage.getItem('forge.api.avail.' + key);
    if (cached !== null) { availability[key] = cached === '1'; return; }
    var url = ENDPOINTS[key];
    var method = key === 'status' ? 'GET' : 'POST';
    var body = method === 'POST'
      ? JSON.stringify({ op: 'list', forum: 'ai' })
      : undefined;
    var headers = method === 'POST' ? { 'content-type': 'application/json' } : {};
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 3000) : null;
    fetch(url, { method: method, headers: headers, body: body,
      signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        clearTimeout(timer);
        availability[key] = r.status < 500;
        try { sessionStorage.setItem('forge.api.avail.' + key, availability[key] ? '1' : '0'); } catch (e) {}
      })
      .catch(function () {
        clearTimeout(timer);
        availability[key] = false;
        try { sessionStorage.setItem('forge.api.avail.' + key, '0'); } catch (e) {}
      });
  }

  /* Probe asynchronously at startup — no blocking.
     'arena' is probed so challenge.js's live gate (available.arena) can pass. */
  try { probeEndpoint('forum'); probeEndpoint('status'); probeEndpoint('arena'); } catch (e) {}

  /* ----------------------------------------------------------
     PUBLIC API
  ---------------------------------------------------------- */
  window.FORGE_ATLAS.API = {
    Auth: Auth,
    Forum: Forum,
    Arena: Arena,
    Status: Status,
    Rescuer: Rescuer,
    AuthUI: AuthUI,
    available: availability,
    endpoints: ENDPOINTS,
  };

  /* ----------------------------------------------------------
     INLINE STYLES · minimal for AuthUI widget + callsign prompt
  ---------------------------------------------------------- */
  var style = document.createElement('style');
  style.textContent =
    '.fa-id-badge{display:inline-flex;align-items:center;gap:7px;font-family:var(--font-mono,monospace);font-size:11px;letter-spacing:.1em}' +
    '.fa-id-callsign{color:var(--fg,#e8e8ec);font-weight:500}' +
    '.fa-id-rank{color:var(--muted,#6b7280);text-transform:uppercase;font-size:10px;letter-spacing:.14em}' +
    '.fa-rank-founder .fa-id-callsign{color:var(--gold,#D4A843)}' +
    '.fa-rank-strategist .fa-id-callsign{color:var(--violet,#a78bfa)}' +
    '.fa-rank-architect .fa-id-callsign{color:var(--cyan,#7eeaff)}' +
    '.fa-callsign-prompt{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);z-index:200;display:grid;place-items:center;padding:24px}' +
    '.fa-callsign-card{background:#0e0e12;border:1px solid rgba(212,168,67,.3);border-radius:12px;padding:32px;width:min(400px,100%);display:flex;flex-direction:column;gap:14px}' +
    '.fa-callsign-head{font-family:var(--font-display,sans-serif);font-size:20px;font-weight:600;color:#e8e8ec;letter-spacing:.04em}' +
    '.fa-callsign-sub{font-size:13px;color:#71717a;line-height:1.5;margin:0}' +
    '.fa-callsign-input{background:#08080a;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:10px 14px;color:#e8e8ec;font-family:var(--font-mono,monospace);font-size:14px;outline:none;transition:border-color 180ms}' +
    '.fa-callsign-input:focus{border-color:rgba(212,168,67,.5)}' +
    '.fa-callsign-hint{font-family:var(--font-mono,monospace);font-size:11px;color:#f87171;min-height:16px;letter-spacing:.06em}' +
    '.fa-callsign-actions{display:flex;gap:10px;margin-top:4px}' +
    '.fa-btn{flex:1;padding:10px 18px;border-radius:6px;border:1px solid rgba(212,168,67,.5);background:transparent;color:#D4A843;font-family:var(--font-mono,monospace);font-size:12px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:background 180ms,color 180ms}' +
    '.fa-btn:hover{background:#D4A843;color:#08080a}' +
    '.fa-btn-ghost{border-color:rgba(255,255,255,.12);color:#71717a}' +
    '.fa-btn-ghost:hover{background:rgba(255,255,255,.06);color:#e8e8ec}';
  document.head.appendChild(style);
})();
