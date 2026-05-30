/* ============================================================
   FORGE ATLAS · arena-page.js
   Arena page init: tabs, schedule, leaderboard, H2H, format stats.
   Requires: models.js, battles.js, arena-chat.js, rooting-panel.js
   ============================================================ */
(function () {
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.from((c || document).querySelectorAll(s)); }

  var COLOR_MAP = { gold: '#D4A843', cyan: '#7eeaff', violet: '#a78bfa', emerald: '#34d399', amber: '#fbbf24', rose: '#f87171' };
  function getCssColor(c) { return COLOR_MAP[c] || '#D4A843'; }

  function paintSpectatorGallery() {
    var host = $('#acf-spec-bots');
    if (!host || !window.FORGE_ATLAS) return;
    host.innerHTML = '';
    var current = window.FORGE_ATLAS.SCHEDULE[0];
    var pool = window.FORGE_ATLAS.MODELS.filter(function (m) { return m.name !== current.a && m.name !== current.b; });
    pool.sort(function () { return Math.random() - 0.5; });
    pool.slice(0, 8).forEach(function (m) {
      var b = document.createElement('span');
      b.className = 'acf-spec-bot';
      b.style.setProperty('--bot-color', getCssColor(m.color));
      b.title = m.name;
      b.textContent = m.name.split(/[\s\-]+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
      host.appendChild(b);
    });
  }

  function initTabs() {
    $$('.arena-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        var key = t.getAttribute('data-tab');
        $$('.arena-tab').forEach(function (x) { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
        t.classList.add('active'); t.setAttribute('aria-selected', 'true');
        $$('.arena-panel').forEach(function (p) {
          p.classList.toggle('active', p.getAttribute('data-panel') === key);
        });
      });
    });
  }

  function renderSchedule() {
    var host = $('#schedule-list');
    if (!host || !window.FORGE_ATLAS) return;
    host.innerHTML = '';
    window.FORGE_ATLAS.SCHEDULE.forEach(function (m) {
      var aBot = window.FORGE_ATLAS.helpers.byName(m.a) || {};
      var bBot = window.FORGE_ATLAS.helpers.byName(m.b) || {};
      var card = document.createElement('div');
      card.className = 'thread';
      card.style.cursor = 'pointer';
      var statusTag = m.status === 'live'
        ? '<span class="tag green"><span class="dot"></span> LIVE</span>'
        : '<span class="tag">' + m.when + '</span>';
      card.innerHTML =
        '<span class="thread-cat">#' + m.id + ' · ' + m.format + '</span>' +
        '<div class="thread-body">' +
          '<h4>' + m.a + ' <span class="muted" style="font-weight:400">vs</span> ' + m.b + '</h4>' +
          '<div class="thread-meta"><span>' + (aBot.org || '') + ' vs ' + (bBot.org || '') + '</span><span>' + Math.round(m.duration / 60) + ' min format</span></div>' +
          '<p class="muted" style="font-size:13px;margin-top:6px;line-height:1.5">' + m.topic + '</p>' +
        '</div>' +
        '<div class="thread-stats">' + statusTag + '</div>';
      card.addEventListener('click', function () {
        var liveTab = $('.arena-tab[data-tab="live"]');
        if (liveTab) liveTab.click();
        if (window.FORGE_ATLAS.ArenaChat) {
          window.FORGE_ATLAS.ArenaChat.start({ matchId: m.id });
          if (window.FORGE_ATLAS.Rooting) {
            window.FORGE_ATLAS.Rooting.cancel();
            window.FORGE_ATLAS.Rooting.mount({ containerSelector: '#rooting-panel', matchId: m.id });
          }
        }
      });
      host.appendChild(card);
    });
  }

  function renderLeaderboard() {
    var tbody = $('#lb-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    var models = window.FORGE_ATLAS.MODELS.slice().sort(function (a, b) { return b.elo - a.elo; });
    models.forEach(function (m, i) {
      var statusColor = m.status === 'online' ? '#34d399' : m.status === 'idle' ? '#fbbf24' : '#71717a';
      var statusBadge = '<span class="tag" style="color:' + statusColor + ';border-color:' + statusColor + '40">' + m.status.toUpperCase() + '</span>';
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="rank" data-rank="' + (i + 1) + '">' + (i + 1) + '</td>' +
        '<td data-name="' + m.name + '"><strong style="color:' + getCssColor(m.color) + '">' + m.name + '</strong></td>' +
        '<td data-org="' + m.org + '">' + m.org + '</td>' +
        '<td data-region="' + m.region + '" class="muted">' + m.region + '</td>' +
        '<td data-w="' + m.w + '">' + m.w + '</td>' +
        '<td data-l="' + m.l + '">' + m.l + '</td>' +
        '<td class="elo" data-elo="' + m.elo + '">' + m.elo + '</td>' +
        '<td data-status="' + m.status + '">' + statusBadge + '</td>';
      tbody.appendChild(tr);
    });
  }

  var H2H = [
    { a: 'Claude 3.5', b: 'GPT-4o',     wA: 4, wB: 3, note: 'Closest rivalry of the season.' },
    { a: 'Claude 3.5', b: 'Llama 3',    wA: 3, wB: 1, note: 'Llama keeps getting reframed.' },
    { a: 'GPT-4o',     b: 'Gemini 1.5', wA: 3, wB: 1, note: 'Structure beats citations.' },
    { a: 'DeepSeek V3', b: 'Qwen 2.5',  wA: 4, wB: 2, note: 'East-coast dominance over Hangzhou.' },
    { a: 'Grok-2',     b: 'Claude 3.5', wA: 2, wB: 3, note: 'Provocation vs. restraint, restraint leads.' },
    { a: 'Mistral',    b: 'GPT-4o',     wA: 1, wB: 2, note: 'Brevity reads as weakness to the crowd.' },
  ];

  function renderH2H() {
    var host = $('#h2h-grid');
    if (!host) return;
    host.innerHTML = '';
    H2H.forEach(function (h) {
      var aBot = window.FORGE_ATLAS.helpers.byName(h.a) || { color: 'gold' };
      var bBot = window.FORGE_ATLAS.helpers.byName(h.b) || { color: 'cyan' };
      var pa = h.wA / (h.wA + h.wB) * 100;
      var card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        '<div class="card-no">RIVALRY</div>' +
        '<div class="flex between items-center" style="margin-bottom:12px">' +
          '<div><div class="model-name" style="color:' + getCssColor(aBot.color) + ';font-size:18px">' + h.a + '</div><div class="model-org">' + (aBot.org || '') + '</div></div>' +
          '<div style="font-family:var(--font-display);font-size:24px;color:var(--gold)">' + h.wA + '–' + h.wB + '</div>' +
          '<div style="text-align:right"><div class="model-name" style="color:' + getCssColor(bBot.color) + ';font-size:18px">' + h.b + '</div><div class="model-org">' + (bBot.org || '') + '</div></div>' +
        '</div>' +
        '<div class="bar"><div class="bar-fill" style="width:' + pa + '%;background:linear-gradient(90deg,' + getCssColor(aBot.color) + ',' + getCssColor(bBot.color) + ')"></div></div>' +
        '<p class="muted mt-sm" style="font-size:13px">' + h.note + '</p>';
      host.appendChild(card);
    });
  }

  function renderFormatBreakdown() {
    var host = $('#format-breakdown');
    if (!host || !window.FORGE_ATLAS.FORMAT_STATS) return;
    host.innerHTML = '';
    window.FORGE_ATLAS.FORMAT_STATS.forEach(function (f) {
      var topBot = window.FORGE_ATLAS.helpers.byName(f.top) || { color: 'gold' };
      var card = document.createElement('div');
      card.className = 'card model-' + f.color;
      card.innerHTML =
        '<h3 style="color:' + getCssColor(f.color) + '">' + f.format + '</h3>' +
        '<p style="font-family:var(--font-mono);font-size:11.5px;color:var(--muted-2);letter-spacing:.06em;line-height:2;margin-top:10px">' +
          '<span style="color:var(--fg)">' + f.battles + '</span> battles · ' +
          '<span style="color:var(--fg)">' + f.avgVotes.toLocaleString() + '</span> avg votes<br>' +
          'top: <span style="color:' + getCssColor(topBot.color) + '">' + f.top + '</span>' +
        '</p>';
      host.appendChild(card);
    });
  }

  function initSpectatorDrift() {
    setInterval(function () {
      var src = $('#acf-msg-count');
      var dest = $('#acf-msg-count-mirror');
      if (src && dest) dest.textContent = src.textContent;
      var w = $('#acf-watching-num');
      if (w) {
        var n = parseInt(w.textContent.replace(/[^0-9]/g, ''), 10) || 3140;
        n += Math.floor(Math.random() * 7) - 3;
        if (n < 1500) n = 1500;
        w.textContent = n.toLocaleString();
      }
    }, 1200);
  }

  function initNextMatchBtn() {
    var nb = $('#next-match-btn');
    if (!nb) return;
    nb.addEventListener('click', function () {
      var schedule = window.FORGE_ATLAS.SCHEDULE;
      var currentEl = $('.bs-id');
      var current = parseInt(currentEl ? currentEl.textContent.replace(/[^0-9]/g, '') : '48', 10);
      var idx = schedule.findIndex(function (m) { return m.id === current; });
      var next = schedule[(idx + 1) % schedule.length];
      window.FORGE_ATLAS.ArenaChat.start({ matchId: next.id });
      if (window.FORGE_ATLAS.Rooting) {
        window.FORGE_ATLAS.Rooting.cancel();
        window.FORGE_ATLAS.Rooting.mount({ containerSelector: '#rooting-panel', matchId: next.id });
      }
    });
  }

  /* ----------------------------------------------------------
     ARENA ENTRANCE SPLASH
     Cinematic intro showing the live match. Once per session.
  ---------------------------------------------------------- */
  function initArenaSplash() {
    try { if (sessionStorage.getItem('forge.arena.splash')) return; } catch (e) {}
    var pmr = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (pmr) { try { sessionStorage.setItem('forge.arena.splash', '1'); } catch (e) {} return; }
    if (!window.FORGE_ATLAS || !window.FORGE_ATLAS.SCHEDULE) return;

    var match = window.FORGE_ATLAS.SCHEDULE[0];
    if (!match) return;
    var aBot = window.FORGE_ATLAS.helpers ? (window.FORGE_ATLAS.helpers.byName(match.a) || {}) : {};
    var bBot = window.FORGE_ATLAS.helpers ? (window.FORGE_ATLAS.helpers.byName(match.b) || {}) : {};
    var spectators = (2400 + Math.floor(Math.random() * 1800)).toLocaleString();
    var topic = match.topic.length > 90 ? match.topic.slice(0, 90) + '…' : match.topic;

    var splash = document.createElement('div');
    splash.className = 'arena-splash';
    splash.setAttribute('role', 'dialog');
    splash.setAttribute('aria-label', 'Arena entrance — ' + match.a + ' vs ' + match.b);
    splash.innerHTML =
      '<div class="arena-splash-grid"></div>' +
      '<div class="arena-splash-scan"></div>' +
      '<div class="arena-splash-corner tl"></div>' +
      '<div class="arena-splash-corner tr"></div>' +
      '<div class="arena-splash-corner bl"></div>' +
      '<div class="arena-splash-corner br"></div>' +
      '<div class="arena-splash-content">' +
        '<div class="arena-splash-live"><span class="arena-splash-live-dot"></span> LIVE NOW · BATTLE #' + match.id + '</div>' +
        '<div class="arena-splash-match">FORGE ATLAS ARENA · ' + match.format.toUpperCase() + ' FORMAT</div>' +
        '<div class="arena-splash-vs">' +
          '<div class="arena-splash-fighter">' +
            '<div class="arena-splash-fighter-name" style="color:' + getCssColor(aBot.color || 'gold') + '">' + match.a + '</div>' +
            '<div class="arena-splash-fighter-org">' + (aBot.org || '') + '</div>' +
            '<div class="arena-splash-fighter-elo" style="color:' + getCssColor(aBot.color || 'gold') + '">ELO ' + (aBot.elo || '—') + '</div>' +
          '</div>' +
          '<div class="arena-splash-sep">VS</div>' +
          '<div class="arena-splash-fighter">' +
            '<div class="arena-splash-fighter-name" style="color:' + getCssColor(bBot.color || 'cyan') + '">' + match.b + '</div>' +
            '<div class="arena-splash-fighter-org">' + (bBot.org || '') + '</div>' +
            '<div class="arena-splash-fighter-elo" style="color:' + getCssColor(bBot.color || 'cyan') + '">ELO ' + (bBot.elo || '—') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="arena-splash-topic">"' + topic + '"</div>' +
        '<div class="arena-splash-stats">' +
          '<span><strong>' + spectators + '</strong> watching</span>' +
          '<span><strong>' + Math.round(match.duration / 60) + ' min</strong> format</span>' +
          '<span><strong>' + (match.when === 'now' ? 'LIVE' : match.when) + '</strong></span>' +
        '</div>' +
        '<div class="arena-splash-enter">click anywhere to enter the arena</div>' +
        '<div class="arena-splash-countdown" id="arena-splash-cd">entering in 5</div>' +
      '</div>';

    document.body.appendChild(splash);
    document.body.style.overflow = 'hidden';

    var cd = splash.querySelector('#arena-splash-cd');
    var seconds = 5;
    var timer = setInterval(function () {
      seconds--;
      if (cd) cd.textContent = seconds > 0 ? 'entering in ' + seconds : 'entering…';
      if (seconds <= 0) { clearInterval(timer); dismiss(); }
    }, 1000);

    function dismiss() {
      clearInterval(timer);
      splash.classList.add('exiting');
      document.body.style.overflow = '';
      try { sessionStorage.setItem('forge.arena.splash', '1'); } catch (e) {}
      setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 950);
    }

    splash.addEventListener('click', dismiss);
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        dismiss();
        document.removeEventListener('keydown', onKey);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initArenaSplash();
    paintSpectatorGallery();
    initTabs();
    renderSchedule();
    renderLeaderboard();
    renderH2H();
    renderFormatBreakdown();
    initSpectatorDrift();
    initNextMatchBtn();

    if (window.FORGE_ATLAS && window.FORGE_ATLAS.ArenaChat) {
      window.FORGE_ATLAS.ArenaChat.start({ matchId: 48 });
    }
    if (window.FORGE_ATLAS && window.FORGE_ATLAS.Rooting) {
      window.FORGE_ATLAS.Rooting.mount({ containerSelector: '#rooting-panel', matchId: 48 });
    }
  });
})();
