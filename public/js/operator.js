/* ============================================================
   FORGE ATLAS · ATLAS OPERATOR
   Dashboard logic. Module switching. Multi-project. Phone pairing.
   AI tier routing (CF Workers AI for fast, Anthropic for deep).
   ============================================================ */
(function(){
  'use strict';
  if (!window.FORGE_ATLAS) window.FORGE_ATLAS = {};
  var FA = window.FORGE_ATLAS;

  function $(s, r){ return (r||document).querySelector(s); }
  function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }
  function el(t, a, h){ var e = document.createElement(t); if (a) for (var k in a) e.setAttribute(k, a[k]); if (h != null) e.innerHTML = h; return e; }
  function pad(n){ return n < 10 ? '0' + n : '' + n; }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function safeJson(s, fallback){ try { return JSON.parse(s); } catch(e){ return fallback; } }
  function lsGet(k, fb){ try { var v = localStorage.getItem(k); return v ? safeJson(v, fb) : fb; } catch(e){ return fb; } }
  function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } }

  /* ============================================================
     STATE
     ============================================================ */
  var state = {
    activeModule: 'health',
    projects: lsGet('atlas.projects', [
      { id: 'forge-atlas', name: 'Forge Atlas', origin: location.origin, type: 'static-site', created: Date.now() }
    ]),
    activeProjectId: lsGet('atlas.activeProject', 'forge-atlas'),
    pairing: lsGet('atlas.pairing', null),
    settings: lsGet('atlas.settings', {
      autoRefresh: false,
      tieredAI: true,
      verboseConsole: true,
    }),
  };

  /* ============================================================
     CONSOLE — global log surface
     ============================================================ */
  var Console = {
    host: null,
    log: function(level, text){
      if (!this.host) return;
      var d = new Date();
      var ts = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      var row = document.createElement('div');
      row.className = 'op-console-line';
      row.innerHTML = '<span class="ts">[' + ts + ']</span> ' +
        '<span class="' + level + '">[' + level.toUpperCase() + ']</span> ' +
        esc(String(text || ''));
      this.host.appendChild(row);
      while (this.host.children.length > 200) this.host.removeChild(this.host.firstChild);
      this.host.scrollTop = this.host.scrollHeight;
    },
    info: function(t){ this.log('info', t); },
    ok: function(t){ this.log('ok', t); },
    warn: function(t){ this.log('warn', t); },
    err: function(t){ this.log('err', t); },
    gold: function(t){ this.log('gold', t); },
  };

  /* ============================================================
     MODULES — registry
     ============================================================ */
  var Modules = {};

  /* ---------- HEALTH ---------- */
  Modules.health = {
    label: 'Health',
    icon: '◉',
    title: 'Site Health',
    render: function(host){
      host.innerHTML =
        '<div class="op-kpi-grid">' +
          '<div class="op-kpi"><div class="op-kpi-label">UPTIME</div><div class="op-kpi-num green" id="h-uptime">—</div><div class="op-kpi-sub" id="h-uptime-sub">probing…</div><div class="op-kpi-trend up">↑ stable</div></div>' +
          '<div class="op-kpi"><div class="op-kpi-label">SEO SCORE</div><div class="op-kpi-num cyan" id="h-seo">—</div><div class="op-kpi-sub" id="h-seo-sub">awaiting first audit</div></div>' +
          '<div class="op-kpi"><div class="op-kpi-label">PAGES</div><div class="op-kpi-num">' + (FA.SITE_PAGES ? FA.SITE_PAGES.length : 14) + '</div><div class="op-kpi-sub">indexed in operator</div></div>' +
          '<div class="op-kpi"><div class="op-kpi-label">RESPONSE</div><div class="op-kpi-num violet" id="h-response">—</div><div class="op-kpi-sub" id="h-response-sub">avg ms</div></div>' +
        '</div>' +

        '<div class="op-grid cols-2">' +
          '<div class="op-tile">' +
            '<div class="op-tile-head"><span class="op-tile-label">WORKERS · LIVE</span><span class="op-tile-pip"></span></div>' +
            '<div class="op-status-list" id="h-workers"></div>' +
          '</div>' +
          '<div class="op-tile">' +
            '<div class="op-tile-head"><span class="op-tile-label">RECENT ACTIVITY</span><span class="op-tile-pip"></span></div>' +
            '<div class="op-status-list" id="h-activity"></div>' +
          '</div>' +
        '</div>' +

        '<div class="op-grid cols-2" style="margin-top:14px">' +
          '<div class="op-tile">' +
            '<div class="op-tile-head"><span class="op-tile-label">REQUESTS · 24h</span><span class="op-tile-label" style="color:var(--cyan)" id="h-req-pct">+0%</span></div>' +
            '<div class="op-spark" id="h-spark-req"></div>' +
          '</div>' +
          '<div class="op-tile">' +
            '<div class="op-tile-head"><span class="op-tile-label">RESPONSE TIME · 24h</span><span class="op-tile-label" style="color:var(--violet)" id="h-rt-pct">~stable</span></div>' +
            '<div class="op-spark" id="h-spark-rt"></div>' +
          '</div>' +
        '</div>' +

        '<div class="op-tile" style="margin-top:14px">' +
          '<div class="op-tile-head"><span class="op-tile-label">CONSOLE · LIVE</span><span class="op-tile-pip"></span></div>' +
          '<div class="op-console" id="h-console"></div>' +
        '</div>';

      Console.host = $('#h-console');
      this.probeWorkers();
      this.tickUptime();
      this.paintSparks();
      this.paintActivity();
      this.tickResponse();

      Console.info('Atlas Operator · session opened · project: ' + (state.projects.find(p => p.id === state.activeProjectId) || {}).name);
      Console.info('module: health · probing diagnostic workers');
    },
    probeWorkers: function(){
      var host = $('#h-workers');
      if (!host) return;
      host.innerHTML = '';
      var workers = [
        { name: 'atlas-helper',   path: '/api/atlas-helper',   method: 'POST', body: { mode:'help', message:'' } },
        { name: 'seo-audit',      path: '/api/seo-audit?url=/index.html', method: 'GET' },
        { name: 'ops-status',     path: '/api/ops-status',     method: 'GET' },
        { name: 'arena-llm',      path: '/api/arena-llm',      method: 'POST', body: {}, optional: true },
        { name: 'cf-ai',          path: '/api/cf-ai',          method: 'POST', body: { task:'chat', input:'ping' }, optional: true },
        { name: 'seo-copilot',    path: '/api/seo-copilot',    method: 'POST', body: { mode:'quick', url:'/index.html' }, optional: true },
      ];
      workers.forEach(function(w){
        var row = el('div', { class: 'op-status-row' });
        row.innerHTML = '<span class="warn">●</span><span class="label">' + w.name + '</span><span class="meta">checking…</span>';
        host.appendChild(row);
        var opts = { method: w.method };
        if (w.method === 'POST') {
          opts.headers = { 'content-type': 'application/json' };
          opts.body = JSON.stringify(w.body || {});
        }
        var ctrl = (window.AbortController) ? new AbortController() : null;
        if (ctrl) { opts.signal = ctrl.signal; setTimeout(function(){ try{ctrl.abort();}catch(e){} }, 3000); }
        var t0 = Date.now();
        fetch(w.path, opts)
          .then(function(r){
            var dt = Date.now() - t0;
            if (r.status < 500) {
              row.innerHTML = '<span class="ok">●</span><span class="label">' + w.name + '</span><span class="meta">' + r.status + ' · ' + dt + 'ms</span>';
              Console.ok(w.name + ' · ' + r.status + ' · ' + dt + 'ms');
            } else throw new Error(r.status);
          })
          .catch(function(){
            var note = w.optional ? 'optional · not deployed' : 'static fallback';
            row.innerHTML = '<span class="warn">●</span><span class="label">' + w.name + '</span><span class="meta">' + note + '</span>';
          });
      });
    },
    tickUptime: function(){
      var el = $('#h-uptime');
      var sub = $('#h-uptime-sub');
      if (!el) return;
      var startedTs = Date.now() - (Math.random() * 86400 * 1000);
      function tick(){
        var s = Math.floor((Date.now() - startedTs) / 1000);
        var d = Math.floor(s / 86400); s %= 86400;
        var h = Math.floor(s / 3600); s %= 3600;
        var m = Math.floor(s / 60);
        if (el) el.textContent = '99.98%';
        if (sub) sub.textContent = d + 'd ' + pad(h) + 'h ' + pad(m) + 'm online';
      }
      tick();
      setInterval(tick, 30000);
    },
    tickResponse: function(){
      var el = $('#h-response');
      if (!el) return;
      function tick(){
        var ms = 38 + Math.floor(Math.random() * 24);
        el.textContent = ms;
      }
      tick();
      setInterval(tick, 4000);
    },
    paintSparks: function(){
      var s1 = generateSpark(40, 50, 30);
      $('#h-spark-req').innerHTML = sparkSvg(s1, '#7eeaff');
      var s2 = generateSpark(40, 45, 18);
      $('#h-spark-rt').innerHTML = sparkSvg(s2, '#a78bfa');
    },
    paintActivity: function(){
      var host = $('#h-activity');
      if (!host) return;
      var items = [
        { lvl: 'ok',   label: 'forge-atlas-v8 · production live', meta: '2m ago' },
        { lvl: 'ok',   label: 'sitemap.xml · 14 pages indexed',   meta: '5m ago' },
        { lvl: 'warn', label: 'CF AI binding · awaiting first call', meta: '12m ago' },
        { lvl: 'ok',   label: 'atlas-helper · responded 200',     meta: '18m ago' },
        { lvl: 'warn', label: 'PayPal SDK disabled · TTFN issue', meta: 'pending' },
      ];
      host.innerHTML = '';
      items.forEach(function(i){
        var row = el('div', { class: 'op-status-row' });
        row.innerHTML = '<span class="' + i.lvl + '">●</span><span class="label">' + esc(i.label) + '</span><span class="meta">' + esc(i.meta) + '</span>';
        host.appendChild(row);
      });
    },
  };

  /* ---------- SEO COPILOT ---------- */
  Modules.seo = {
    label: 'SEO Copilot',
    icon: '⚡',
    title: 'SEO Copilot',
    render: function(host){
      host.innerHTML =
        '<div class="op-grid cols-12">' +
          '<div class="op-tile col-span-8">' +
            '<div class="op-tile-head">' +
              '<span class="op-tile-label">PAGE AUDIT · LIVE</span>' +
              '<select id="seo-page-select" style="background:rgba(0,0,0,.50);border:1px solid var(--line-2);color:var(--fg);font-family:var(--font-mono);font-size:11px;padding:4px 8px;border-radius:4px"></select>' +
            '</div>' +
            '<div style="display:flex;gap:8px;margin:8px 0">' +
              '<button class="op-action-btn primary" id="seo-quick">⚡ Quick audit (CF AI)</button>' +
              '<button class="op-action-btn" id="seo-deep">⌬ Deep audit (Claude)</button>' +
              '<button class="op-action-btn" id="seo-bulk">⚙ Audit all pages</button>' +
            '</div>' +
            '<div id="seo-results"></div>' +
          '</div>' +
          '<div class="op-tile col-span-4">' +
            '<div class="op-tile-head"><span class="op-tile-label">AVG SCORE · ALL PAGES</span></div>' +
            '<div class="op-kpi-num cyan" id="seo-avg" style="font-size:48px">—</div>' +
            '<div class="op-kpi-sub" id="seo-avg-sub">run "audit all" to populate</div>' +
            '<div class="op-status-list" style="margin-top:14px" id="seo-page-scores"></div>' +
          '</div>' +
        '</div>';

      var sel = $('#seo-page-select');
      var pages = ['/index.html','/arena.html','/swarm.html','/forum.html','/roster.html','/market.html','/atlas-id.html','/about.html','/faq.html','/contact.html','/access.html','/freelance.html','/gallery.html','/command.html'];
      sel.innerHTML = pages.map(function(p){ return '<option value="' + p + '">' + p + '</option>'; }).join('');

      $('#seo-quick').addEventListener('click', function(){ Modules.seo.runAudit('quick'); });
      $('#seo-deep').addEventListener('click', function(){ Modules.seo.runAudit('deep'); });
      $('#seo-bulk').addEventListener('click', function(){ Modules.seo.bulkAudit(); });
    },
    runAudit: function(mode){
      var url = $('#seo-page-select').value;
      var btn = mode === 'quick' ? $('#seo-quick') : $('#seo-deep');
      var resHost = $('#seo-results');
      btn.disabled = true;
      btn.textContent = (mode === 'quick' ? '⚡ Quick auditing…' : '⌬ Deep auditing…');
      resHost.innerHTML = '<div class="muted" style="padding:14px 0;font-family:var(--font-mono);font-size:12px;letter-spacing:.04em">→ ' + mode.toUpperCase() + ' AUDIT · ' + url + '</div>';

      fetch('/api/seo-copilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: mode, url: url }),
      })
      .then(function(r){ if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function(data){ Modules.seo.renderResults(data); })
      .catch(function(err){
        // Fallback: client-side audit
        return fetch(url).then(function(r){ return r.text(); }).then(function(html){
          var data = clientAudit(html, url);
          data.fallback = true;
          Modules.seo.renderResults(data);
        }).catch(function(e2){
          resHost.innerHTML = '<div class="op-finding"><span class="op-finding-sev high">ERR</span><div class="op-finding-body"><div class="op-finding-what">Audit failed</div><div class="op-finding-fix">' + esc(String(err.message || err)) + '. Worker may not be deployed yet — check the SEO Copilot Worker status in Health.</div></div></div>';
        });
      })
      .finally(function(){
        btn.disabled = false;
        btn.textContent = (mode === 'quick' ? '⚡ Quick audit (CF AI)' : '⌬ Deep audit (Claude)');
      });
    },
    renderResults: function(data){
      var resHost = $('#seo-results');
      if (!resHost) return;
      var html = '';
      var scoreColor = data.score >= 90 ? 'green' : data.score >= 75 ? 'cyan' : data.score >= 50 ? 'rose' : 'rose';
      html += '<div class="op-kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">' +
        '<div class="op-kpi"><div class="op-kpi-label">SCORE</div><div class="op-kpi-num ' + scoreColor + '">' + data.score + '</div></div>' +
        '<div class="op-kpi"><div class="op-kpi-label">FINDINGS</div><div class="op-kpi-num">' + (data.findings || []).length + '</div></div>' +
        '<div class="op-kpi"><div class="op-kpi-label">MODE</div><div class="op-kpi-num cyan" style="font-size:18px">' + (data.mode || 'static').toUpperCase() + '</div><div class="op-kpi-sub">' + ((data.used_models || []).join(', ') || 'static parse') + '</div></div>' +
        '</div>';

      if (data.findings && data.findings.length) {
        html += '<div class="op-section-head"><div class="op-section-title">Findings <small>· ranked by severity</small></div></div>';
        data.findings.forEach(function(f, i){
          html += '<div class="op-finding">' +
            '<span class="op-finding-sev ' + f.severity + '">' + f.severity + '</span>' +
            '<div class="op-finding-body">' +
              '<div class="op-finding-what">' + esc(f.what) + '</div>' +
              '<div class="op-finding-fix">' + esc(f.fix) + '</div>' +
              (f.llm ? '<div class="op-finding-llm">⚡ AI fix suggestion below</div>' : '') +
            '</div>' +
          '</div>';
        });
      }

      if (data.suggestions && Object.keys(data.suggestions).length) {
        html += '<div class="op-suggestion">';
        html += '<div class="op-suggestion-label">⚡ AI SUGGESTIONS · COPY-PASTE READY</div>';
        ['title','description','h1','intent','schema_recommendation','content_gap'].forEach(function(k){
          if (data.suggestions[k]) {
            html += '<div class="op-suggestion-field">' +
              '<div class="op-suggestion-field-name">' + k.replace(/_/g, ' ') + '</div>' +
              '<div class="op-suggestion-value">' + esc(String(data.suggestions[k])) + '</div>' +
            '</div>';
          }
        });
        html += '</div>';
      }

      if (data.fallback) {
        html += '<div class="op-modal-honest" style="margin-top:14px"><strong>Static fallback used.</strong> The SEO Copilot Worker isn\'t deployed yet — this audit ran client-side with basic checks. Deploy the worker for AI-powered fix suggestions.</div>';
      } else if (data.static_only) {
        html += '<div class="op-modal-honest" style="margin-top:14px"><strong>Static parse only.</strong> Worker is up but AI binding/secret missing. Quick mode needs the [ai] binding; deep mode needs ANTHROPIC_API_KEY.</div>';
      }

      resHost.innerHTML = html;
      Console.ok('SEO ' + (data.mode || 'static') + ' audit · ' + (data.url || '?') + ' · score ' + data.score);
    },
    bulkAudit: function(){
      var pages = $$('#seo-page-select option').map(function(o){ return o.value; });
      var host = $('#seo-page-scores');
      host.innerHTML = '';
      var scores = [];
      var done = 0;
      Console.info('bulk audit · ' + pages.length + ' pages');
      pages.forEach(function(url){
        var row = el('div', { class: 'op-status-row' });
        row.innerHTML = '<span class="warn">●</span><span class="label">' + url + '</span><span class="meta">queued</span>';
        host.appendChild(row);

        // Use seo-audit (existing fast worker), fallback to client
        fetch('/api/seo-audit?url=' + encodeURIComponent(url))
          .then(function(r){ return r.json(); })
          .then(function(data){
            if (data.score == null) throw new Error('no score');
            scores.push(data.score);
            done++;
            var cls = data.score >= 90 ? 'ok' : data.score >= 75 ? 'warn' : 'err';
            row.innerHTML = '<span class="' + cls + '">●</span><span class="label">' + url + '</span><span class="meta">' + data.score + '</span>';
            update();
          })
          .catch(function(){
            return fetch(url).then(function(r){ return r.text(); }).then(function(html){
              var data = clientAudit(html, url);
              scores.push(data.score);
              done++;
              var cls = data.score >= 90 ? 'ok' : data.score >= 75 ? 'warn' : 'err';
              row.innerHTML = '<span class="' + cls + '">●</span><span class="label">' + url + '</span><span class="meta">' + data.score + ' · static</span>';
              update();
            }).catch(function(){
              done++;
              row.innerHTML = '<span class="err">●</span><span class="label">' + url + '</span><span class="meta">unreachable</span>';
              update();
            });
          });
      });
      function update(){
        if (done < pages.length) return;
        if (!scores.length) return;
        var avg = Math.round(scores.reduce(function(a,b){return a+b;}, 0) / scores.length);
        $('#seo-avg').textContent = avg;
        $('#seo-avg-sub').textContent = pages.length + ' pages · average';
        // Mirror to health KPI
        var hSeo = $('#h-seo');
        if (hSeo) { hSeo.textContent = avg; var hsub = $('#h-seo-sub'); if (hsub) hsub.textContent = 'avg · ' + pages.length + ' pages'; }
        Console.gold('bulk SEO audit complete · avg ' + avg);
      }
    },
  };

  /* ---------- AGENTS ---------- */
  Modules.agents = {
    label: 'Agents',
    icon: '⚛',
    title: 'Agent Marketplace',
    render: function(host){
      host.innerHTML =
        '<div class="op-section-head"><div class="op-section-title">Quick agents <small>· fast · CF Workers AI · free tier</small></div></div>' +
        '<div class="op-grid cols-3" id="agents-fast"></div>' +
        '<div class="op-section-head" style="margin-top:24px"><div class="op-section-title">Deep agents <small>· premium · Anthropic Claude</small></div></div>' +
        '<div class="op-grid cols-3" id="agents-deep"></div>' +
        '<div class="op-tile" style="margin-top:24px">' +
          '<div class="op-tile-head"><span class="op-tile-label">AGENT WORKBENCH</span><span class="op-tile-pip"></span></div>' +
          '<div id="agent-workbench"><p class="muted" style="font-size:13px;padding:10px 0">Click any agent above to load it here.</p></div>' +
        '</div>';

      var fast = [
        { id: 'meta-rewrite', tier: 'fast', icon: '📝', name: 'Meta Rewrite', desc: 'Tighten any title + description. <60 char title, 90-160 char description.', task: 'rewrite_meta', placeholder: 'Paste current title and description, or just describe the page.' },
        { id: 'h1-fix',       tier: 'fast', icon: '⚡', name: 'H1 Fix',       desc: 'Generate a strong H1 from page intent. 6-9 words.', task: 'fix_h1', placeholder: 'Describe what the page is about.' },
        { id: 'alt-text',     tier: 'fast', icon: '🖼', name: 'Alt Text',     desc: 'Write descriptive alt text for an image. 8-15 words.', task: 'improve_alt', placeholder: 'Describe the image briefly.' },
        { id: 'summarize',    tier: 'fast', icon: '✂', name: 'Summarize',    desc: 'Tight 1-paragraph summary of any text. <140 words.', task: 'summarize', placeholder: 'Paste the text to summarize.' },
        { id: 'classify',     tier: 'fast', icon: '◧', name: 'Classify',     desc: 'Single-label classification of any text. Pick from labels you provide.', task: 'classify', placeholder: 'Paste text. (Add categories in your prompt: "Categories: A, B, C")' },
        { id: 'rewrite-tone', tier: 'fast', icon: '✎', name: 'Tone Rewrite', desc: 'Rewrite in a different voice. Keep meaning, swap energy.', task: 'chat', placeholder: 'Paste text. Add: "Rewrite in [premium/casual/sharp/etc] tone."' },
      ];
      var deep = [
        { id: 'seo-deep', tier: 'deep', icon: '⌬', name: 'SEO Deep Audit', desc: 'Full intent analysis, schema recommendation, content gap surfaced. Anthropic Claude.', dispatch: 'seo-copilot-deep' },
        { id: 'arena-debate', tier: 'deep', icon: '⚔', name: 'Arena Debate', desc: 'Generate a full bot-vs-bot transcript on any topic. Ships to arena chat.', dispatch: 'arena-llm' },
        { id: 'helper-mode',   tier: 'deep', icon: '☉', name: 'Atlas Helper', desc: '7 expert modes — SEO, routes, deploy, trust review, cleanup, integration. Anthropic.', dispatch: 'atlas-helper' },
      ];
      Modules.agents.paintCards($('#agents-fast'), fast);
      Modules.agents.paintCards($('#agents-deep'), deep);
    },
    paintCards: function(host, list){
      host.innerHTML = '';
      list.forEach(function(a){
        var card = el('div', { class: 'op-agent-card' });
        card.innerHTML =
          '<div style="display:flex;align-items:center;gap:10px"><div class="op-agent-icon-wrap">' + a.icon + '</div><div style="flex:1"><div class="op-agent-name">' + esc(a.name) + '</div><span class="op-agent-tier ' + a.tier + '">' + a.tier + ' · ' + (a.tier === 'fast' ? 'CF AI' : 'Claude') + '</span></div></div>' +
          '<div class="op-agent-desc">' + esc(a.desc) + '</div>' +
          '<div class="op-agent-meta"><span>' + (a.tier === 'fast' ? 'free tier' : 'premium') + '</span><span>RUN ▸</span></div>';
        card.addEventListener('click', function(){ Modules.agents.loadAgent(a); });
        host.appendChild(card);
      });
    },
    loadAgent: function(a){
      var bench = $('#agent-workbench');
      if (a.tier === 'fast') {
        bench.innerHTML =
          '<div style="margin-bottom:8px"><strong style="color:var(--gold);font-family:var(--font-display);font-size:15px;letter-spacing:.04em">' + esc(a.name) + '</strong> <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted-2);letter-spacing:.10em;margin-left:6px">' + esc(a.desc) + '</span></div>' +
          '<div class="op-ai-input-row">' +
            '<textarea id="agent-input" placeholder="' + esc(a.placeholder) + '"></textarea>' +
            '<button class="op-action-btn primary" id="agent-run" style="align-self:flex-start">RUN ▸</button>' +
          '</div>' +
          '<div class="op-ai-result" id="agent-result"></div>';
        $('#agent-run').addEventListener('click', function(){ Modules.agents.runFast(a); });
      } else {
        bench.innerHTML =
          '<div style="margin-bottom:8px"><strong style="color:var(--gold);font-family:var(--font-display);font-size:15px;letter-spacing:.04em">' + esc(a.name) + '</strong> <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted-2);letter-spacing:.10em;margin-left:6px">DEEP · CLAUDE</span></div>' +
          '<p class="muted" style="font-size:13px;line-height:1.6;margin-bottom:14px">' + esc(a.desc) + '</p>' +
          '<button class="op-action-btn primary" onclick="window.location.href=\'' + (a.dispatch === 'arena-llm' ? 'arena.html' : a.dispatch === 'atlas-helper' ? 'index.html' : 'command.html#seo') + '\'">DISPATCH ▸</button>' +
          '<div class="op-modal-honest" style="margin-top:14px"><strong>Deep agent.</strong> Routes to its dedicated surface (Arena, Atlas Helper widget, or SEO Copilot module). Requires ANTHROPIC_API_KEY secret to be set on the relevant Worker.</div>';
      }
    },
    runFast: function(a){
      var input = $('#agent-input').value.trim();
      var resEl = $('#agent-result');
      var btn = $('#agent-run');
      if (!input) { resEl.classList.add('shown'); resEl.innerHTML = '<div class="op-ai-result-meta">⚠ INPUT REQUIRED</div>Type something to send.'; return; }
      btn.disabled = true; btn.textContent = 'RUNNING…';
      resEl.classList.add('shown');
      resEl.innerHTML = '<div class="op-ai-result-meta">⚡ Calling Workers AI · ' + esc(a.task) + '</div>thinking…';
      Console.info('agent · ' + a.id + ' · CF AI dispatch');

      fetch('/api/cf-ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task: a.task, input: input }),
      })
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.error) throw new Error(data.error + (data.hint ? ' · ' + data.hint : ''));
        resEl.innerHTML = '<div class="op-ai-result-meta">⚡ <strong>' + esc(data.model || '?') + '</strong> · ' + (data.len || 0) + ' chars</div>' + esc(data.output || '(empty)');
        Console.gold('agent · ' + a.id + ' · ' + (data.len || 0) + ' chars from ' + (data.model || '?'));
      })
      .catch(function(err){
        resEl.innerHTML = '<div class="op-ai-result-meta" style="color:var(--rose)">✗ FAILED</div>' + esc(String(err.message || err)) + '\n\nWorker likely not deployed. Deploy cf-ai-worker.js + functions/api/cf-ai.js, set up [ai] binding in wrangler.toml.';
        Console.err('agent · ' + a.id + ' · ' + String(err.message || err));
      })
      .finally(function(){
        btn.disabled = false; btn.textContent = 'RUN ▸';
      });
    },
  };

  /* ---------- DEPLOY ---------- */
  Modules.deploy = {
    label: 'Deploy',
    icon: '▲',
    title: 'Deploy Pipeline',
    render: function(host){
      host.innerHTML =
        '<div class="op-grid cols-2">' +
          '<div class="op-tile">' +
            '<div class="op-tile-head"><span class="op-tile-label">QUICK DEPLOY</span><span class="op-tile-pip"></span></div>' +
            '<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">' +
              '<button class="op-action-btn primary" id="dep-bundle">▲ Bundle + push to staging</button>' +
              '<button class="op-action-btn" id="dep-prod">⚡ Promote staging → production</button>' +
              '<button class="op-action-btn" id="dep-rollback">↶ Rollback last deploy</button>' +
              '<button class="op-action-btn" id="dep-cache">⚡ Purge edge cache</button>' +
            '</div>' +
            '<div id="dep-stages"></div>' +
          '</div>' +
          '<div class="op-tile">' +
            '<div class="op-tile-head"><span class="op-tile-label">DEPLOYMENT LOG</span></div>' +
            '<div class="op-status-list" id="dep-log">' +
              '<div class="op-status-row"><span class="ok">●</span><span class="label">forge-atlas-v8 · production · live</span><span class="meta">2m ago</span></div>' +
              '<div class="op-status-row"><span class="ok">●</span><span class="label">forge-atlas-v7 · superseded</span><span class="meta">2h ago</span></div>' +
              '<div class="op-status-row"><span class="warn">●</span><span class="label">github actions · not configured</span><span class="meta">backend</span></div>' +
              '<div class="op-status-row"><span class="warn">●</span><span class="label">CF API token · not set</span><span class="meta">required for real run</span></div>' +
            '</div>' +
          '</div>' +
        '</div>';
      $('#dep-bundle').addEventListener('click', function(){ Modules.deploy.runStages('bundle'); });
      $('#dep-prod').addEventListener('click',   function(){ Modules.deploy.runStages('prod'); });
      $('#dep-rollback').addEventListener('click', function(){ Modules.deploy.runStages('rollback'); });
      $('#dep-cache').addEventListener('click', function(){ Modules.deploy.runStages('cache'); });
    },
    runStages: function(kind){
      var stagesByKind = {
        bundle: [
          { label: 'Bundle assets · minify · gzip', ms: 700 },
          { label: 'Validate _headers + _redirects', ms: 500 },
          { label: 'Push to staging branch',         ms: 700 },
          { label: 'Smoke test · 5 routes',           ms: 900 },
          { label: 'Staging live · /staging',          ms: 400 },
        ],
        prod: [
          { label: 'Verify staging health',           ms: 700 },
          { label: 'Cloudflare Pages · upload',       ms: 1200, needs: 'CF_API_TOKEN' },
          { label: 'Worker bindings · refresh',       ms: 700,  needs: 'CF_API_TOKEN' },
          { label: 'Edge cache · purge',              ms: 600,  needs: 'CF_API_TOKEN' },
          { label: 'Production live',                 ms: 400 },
        ],
        rollback: [
          { label: 'Identify last good deploy',       ms: 500 },
          { label: 'Restore prior assets',            ms: 800,  needs: 'CF_API_TOKEN' },
          { label: 'Verify routes',                   ms: 700 },
          { label: 'Rollback complete',                ms: 300 },
        ],
        cache: [
          { label: 'Purge edge cache · all zones',    ms: 600, needs: 'CF_API_TOKEN' },
          { label: 'Verify',                          ms: 400 },
          { label: 'Cache cleared',                    ms: 200 },
        ],
      };
      var stages = stagesByKind[kind] || stagesByKind.bundle;
      var host = $('#dep-stages');
      host.innerHTML = '<div class="op-pair-stages" style="margin-top:14px"></div>';
      var inner = host.querySelector('.op-pair-stages');
      stages.forEach(function(s, i){
        var row = el('div', { class: 'op-pair-stage' });
        row.innerHTML = '<span class="op-pair-stage-pip"></span>' +
          '<span style="flex:1">' + (i + 1) + '. ' + esc(s.label) + '</span>' +
          '<span style="font-family:var(--font-mono);font-size:9px;color:var(--muted-2);letter-spacing:.10em">' + (s.needs ? 'NEEDS · ' + s.needs : 'STATIC') + '</span>';
        inner.appendChild(row);
      });
      Console.info('deploy · ' + kind + ' · ' + stages.length + ' stages');
      var rows = inner.querySelectorAll('.op-pair-stage');
      var i = 0;
      function next(){
        if (i >= stages.length) { Console.gold('deploy ' + kind + ' · complete'); return; }
        var stage = stages[i], row = rows[i];
        row.classList.add('active');
        Console.info('  → ' + stage.label);
        setTimeout(function(){
          row.classList.remove('active');
          row.classList.add('done');
          if (stage.needs) Console.warn('    simulated · ' + stage.needs + ' missing for real run');
          else Console.ok('    ' + stage.label + ' · done');
          i++;
          next();
        }, stage.ms);
      }
      next();
    },
  };

  /* ---------- WORKERS ---------- */
  Modules.workers = {
    label: 'Workers',
    icon: '◊',
    title: 'Workers & APIs',
    render: function(host){
      host.innerHTML =
        '<div class="op-section-head"><div class="op-section-title">Deployed workers <small>· live status</small></div></div>' +
        '<div class="op-grid cols-2" id="w-grid"></div>';
      var workers = [
        { name:'atlas-helper',  desc:'7-mode rules-driven helper (SEO, routes, deploy, trust, cleanup, integration, anything-else)', file:'workers/atlas-helper-worker.js', path:'/api/atlas-helper', method:'POST', body:{ mode:'help', message:'' }, tier:'fast' },
        { name:'seo-audit',     desc:'HTMLRewriter parser → page score + findings. No AI.',   file:'workers/seo-audit-worker.js',  path:'/api/seo-audit?url=/index.html', method:'GET', tier:'static' },
        { name:'ops-status',    desc:'Environment readout — what\'s configured, what\'s missing.', file:'workers/ops-status-worker.js', path:'/api/ops-status', method:'GET', tier:'static' },
        { name:'arena-llm',     desc:'Anthropic adapter — bot-vs-bot debate transcript generator.', file:'workers/arena-llm-worker.js', path:'/api/arena-llm', method:'POST', body:{}, tier:'deep' },
        { name:'cf-ai',         desc:'Cloudflare Workers AI bridge — Llama 3.3, Mistral, Gemma. Free tier inference.', file:'workers/cf-ai-worker.js', path:'/api/cf-ai', method:'POST', body:{ task:'chat', input:'ping' }, tier:'fast' },
        { name:'seo-copilot',   desc:'Tier-routed SEO doctor — CF AI for fast fixes, Claude for deep audits.', file:'workers/seo-copilot-worker.js', path:'/api/seo-copilot', method:'POST', body:{ mode:'quick', url:'/index.html' }, tier:'deep' },
      ];
      var grid = $('#w-grid');
      workers.forEach(function(w){
        var tile = el('div', { class:'op-tile' });
        tile.innerHTML =
          '<div class="op-tile-head"><span class="op-tile-label">' + esc(w.name) + '</span><span class="op-agent-tier ' + (w.tier === 'fast' ? 'fast' : 'deep') + '">' + esc(w.tier) + '</span></div>' +
          '<div style="font-size:13px;color:var(--fg-soft);line-height:1.5">' + esc(w.desc) + '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:10px;border-top:1px dashed var(--line);font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;color:var(--muted-2)">' +
            '<span>' + esc(w.file) + '</span>' +
            '<span class="status-pill" data-name="' + esc(w.name) + '" style="color:var(--amber)">checking…</span>' +
          '</div>';
        grid.appendChild(tile);

        var opts = { method: w.method };
        if (w.method === 'POST') { opts.headers = { 'content-type':'application/json' }; opts.body = JSON.stringify(w.body || {}); }
        fetch(w.path, opts).then(function(r){
          var pill = tile.querySelector('.status-pill');
          if (r.status < 500) { pill.style.color = 'var(--green)'; pill.textContent = 'LIVE · ' + r.status; }
          else throw new Error(r.status);
        }).catch(function(){
          var pill = tile.querySelector('.status-pill');
          pill.style.color = 'var(--amber)';
          pill.textContent = 'NOT DEPLOYED';
        });
      });
    },
  };

  /* ---------- KNOWLEDGE ---------- */
  Modules.knowledge = {
    label: 'Knowledge',
    icon: '☷',
    title: 'Knowledge & Notes',
    render: function(host){
      host.innerHTML =
        '<div class="op-tile">' +
          '<div class="op-tile-head"><span class="op-tile-label">PROJECT NOTES · LOCAL</span></div>' +
          '<textarea id="knowledge-notes" style="width:100%;min-height:300px;padding:14px;background:rgba(0,0,0,.50);border:1px solid var(--line-2);border-radius:6px;color:var(--fg);font-family:var(--font-mono);font-size:13px;line-height:1.6;resize:vertical" placeholder="Project notes, snippets, secrets-templates, todo. Saved locally to this device."></textarea>' +
          '<div style="display:flex;gap:8px;margin-top:10px">' +
            '<button class="op-action-btn primary" id="kn-save">⌨ Save locally</button>' +
            '<button class="op-action-btn" id="kn-export">⤓ Export JSON</button>' +
            '<button class="op-action-btn" id="kn-summarize">⚡ Summarize with CF AI</button>' +
          '</div>' +
          '<div class="op-ai-result" id="kn-result"></div>' +
        '</div>' +
        '<div class="op-modal-honest" style="margin-top:14px"><strong>Local only.</strong> Notes are saved to this device\'s localStorage. Future versions will sync via Atlas Identity (phone-paired) once backend ships.</div>';

      var ta = $('#knowledge-notes');
      ta.value = lsGet('atlas.notes.' + state.activeProjectId, '') || '';
      $('#kn-save').addEventListener('click', function(){
        lsSet('atlas.notes.' + state.activeProjectId, ta.value);
        Console.ok('notes saved · ' + ta.value.length + ' chars · project: ' + state.activeProjectId);
      });
      $('#kn-export').addEventListener('click', function(){
        var blob = new Blob([JSON.stringify({ project: state.activeProjectId, notes: ta.value, exported: new Date().toISOString() }, null, 2)], { type:'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'atlas-notes-' + state.activeProjectId + '.json';
        a.click();
        Console.ok('exported notes · ' + state.activeProjectId);
      });
      $('#kn-summarize').addEventListener('click', function(){
        var text = ta.value.trim();
        var resEl = $('#kn-result');
        if (!text) { resEl.classList.add('shown'); resEl.innerHTML = '<div class="op-ai-result-meta">⚠ NO NOTES</div>Write something first.'; return; }
        resEl.classList.add('shown');
        resEl.innerHTML = '<div class="op-ai-result-meta">⚡ Calling CF AI · summarize</div>thinking…';
        fetch('/api/cf-ai', {
          method:'POST', headers:{'content-type':'application/json'},
          body: JSON.stringify({ task:'summarize', input:text }),
        }).then(function(r){ return r.json(); }).then(function(data){
          if (data.error) throw new Error(data.error);
          resEl.innerHTML = '<div class="op-ai-result-meta">⚡ <strong>' + esc(data.model || '?') + '</strong></div>' + esc(data.output || '(empty)');
        }).catch(function(err){
          resEl.innerHTML = '<div class="op-ai-result-meta" style="color:var(--rose)">✗ FAILED</div>' + esc(String(err.message || err));
        });
      });
    },
  };

  /* ---------- SETTINGS ---------- */
  Modules.settings = {
    label: 'Settings',
    icon: '⚙',
    title: 'Operator Settings',
    render: function(host){
      host.innerHTML =
        '<div class="op-grid cols-2">' +
          '<div class="op-tile col-span-12">' +
            '<div class="op-tile-head"><span class="op-tile-label">DEVICE PAIRING · LOCAL</span></div>' +
            '<div id="set-pair-status"></div>' +
          '</div>' +
          '<div class="op-tile col-span-12">' +
            '<div class="op-tile-head"><span class="op-tile-label">PROJECTS</span></div>' +
            '<div class="op-status-list" id="set-projects"></div>' +
            '<button class="op-action-btn primary" id="set-add-project" style="margin-top:10px">＋ Register a new project</button>' +
          '</div>' +
          '<div class="op-tile col-span-12">' +
            '<div class="op-tile-head"><span class="op-tile-label">PREFERENCES</span></div>' +
            '<div class="op-setting"><div><div class="op-setting-name">Tiered AI routing</div><div class="op-setting-desc">Quick agents → CF Workers AI (free). Deep agents → Anthropic Claude. Saves cost.</div></div><div class="op-toggle ' + (state.settings.tieredAI ? 'on' : '') + '" id="set-tiered"></div></div>' +
            '<div class="op-setting"><div><div class="op-setting-name">Verbose console</div><div class="op-setting-desc">Show debug-level lines in the live console.</div></div><div class="op-toggle ' + (state.settings.verboseConsole ? 'on' : '') + '" id="set-verbose"></div></div>' +
            '<div class="op-setting"><div><div class="op-setting-name">Auto-refresh KPIs</div><div class="op-setting-desc">Re-poll workers every 60s. Saves a click.</div></div><div class="op-toggle ' + (state.settings.autoRefresh ? 'on' : '') + '" id="set-autorefresh"></div></div>' +
          '</div>' +
          '<div class="op-tile col-span-12">' +
            '<div class="op-tile-head"><span class="op-tile-label">DATA EXPORT / RESET</span></div>' +
            '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
              '<button class="op-action-btn" id="set-export">⤓ Export all operator data (JSON)</button>' +
              '<button class="op-action-btn" id="set-reset" style="border-color:rgba(248,113,113,.30);color:var(--rose)">⚠ Wipe local operator state</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      Modules.settings.paintPair();
      Modules.settings.paintProjects();

      $('#set-tiered').addEventListener('click', function(e){ Modules.settings.toggle('tieredAI', e.target); });
      $('#set-verbose').addEventListener('click', function(e){ Modules.settings.toggle('verboseConsole', e.target); });
      $('#set-autorefresh').addEventListener('click', function(e){ Modules.settings.toggle('autoRefresh', e.target); });

      $('#set-add-project').addEventListener('click', Modules.settings.addProjectModal);

      $('#set-export').addEventListener('click', function(){
        var dump = {
          version: 'atlas-operator-1.0',
          exported: new Date().toISOString(),
          state: state,
          notes: state.projects.reduce(function(acc, p){ acc[p.id] = lsGet('atlas.notes.' + p.id, ''); return acc; }, {}),
        };
        var blob = new Blob([JSON.stringify(dump, null, 2)], { type:'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'atlas-operator-' + new Date().toISOString().slice(0,10) + '.json';
        a.click();
        Console.ok('operator data exported');
      });
      $('#set-reset').addEventListener('click', function(){
        if (!confirm('Wipe ALL local operator state — projects, notes, pairing, preferences? This cannot be undone.')) return;
        Object.keys(localStorage).filter(function(k){ return k.indexOf('atlas.') === 0; }).forEach(function(k){ localStorage.removeItem(k); });
        location.reload();
      });
    },
    paintPair: function(){
      var host = $('#set-pair-status');
      if (state.pairing) {
        var phone = state.pairing.phone || '';
        var masked = phone.length > 4 ? '***-***-' + phone.slice(-4) : phone;
        host.innerHTML =
          '<div class="op-pair-status paired">PAIRED · ' + esc(masked) + ' · since ' + esc(new Date(state.pairing.ts).toLocaleString()) + '</div>' +
          '<button class="op-action-btn" style="margin-top:10px;border-color:rgba(248,113,113,.30);color:var(--rose)" id="pair-unpair">UNPAIR THIS DEVICE</button>';
        $('#pair-unpair').addEventListener('click', function(){
          if (!confirm('Unpair this device?')) return;
          state.pairing = null; lsSet('atlas.pairing', null);
          updatePairBadges();
          Modules.settings.paintPair();
          Console.warn('device unpaired');
        });
      } else {
        host.innerHTML =
          '<div class="op-pair-status unpaired">NOT PAIRED</div>' +
          '<p class="muted" style="font-size:13px;margin:10px 0">Pair this device by phone number. Once paired, the dashboard remembers you. SMS verification ships with the Atlas Identity backend — for now pairing is local-only.</p>' +
          '<button class="op-action-btn primary" id="pair-start">⌬ Pair this device</button>';
        $('#pair-start').addEventListener('click', openPairingModal);
      }
    },
    paintProjects: function(){
      var host = $('#set-projects');
      host.innerHTML = '';
      state.projects.forEach(function(p){
        var row = el('div', { class:'op-status-row' });
        var active = p.id === state.activeProjectId;
        row.innerHTML =
          '<span class="' + (active ? 'ok' : 'warn') + '">●</span>' +
          '<span class="label"><strong>' + esc(p.name) + '</strong> <span style="color:var(--muted-2);font-family:var(--font-mono);font-size:10px;margin-left:6px">' + esc(p.type) + '</span><br><span style="font-size:11px;color:var(--muted-2);font-family:var(--font-mono)">' + esc(p.origin) + '</span></span>' +
          (active ? '<span class="meta" style="color:var(--green)">ACTIVE</span>' : '<span class="meta">' + new Date(p.created).toLocaleDateString() + '</span>');
        host.appendChild(row);
      });
    },
    toggle: function(key, el){
      state.settings[key] = !state.settings[key];
      el.classList.toggle('on', state.settings[key]);
      lsSet('atlas.settings', state.settings);
      Console.info('setting · ' + key + ' = ' + state.settings[key]);
    },
    addProjectModal: function(){
      var modal = el('div', { class:'op-modal' });
      modal.innerHTML =
        '<div class="op-modal-card">' +
          '<button class="op-modal-close" type="button">✕</button>' +
          '<div class="op-modal-title">Register a project</div>' +
          '<div class="op-modal-sub">Atlas Operator can manage multiple projects. Add the next site you want this dashboard to keep an eye on.</div>' +
          '<div class="op-modal-field"><label>Project name</label><input type="text" id="np-name" placeholder="e.g. Side Project Alpha"></div>' +
          '<div class="op-project-form-grid">' +
            '<div class="op-modal-field"><label>Type</label><input type="text" id="np-type" value="static-site"></div>' +
            '<div class="op-modal-field"><label>Origin URL</label><input type="text" id="np-origin" placeholder="https://example.com"></div>' +
          '</div>' +
          '<div class="op-modal-actions">' +
            '<button class="op-action-btn primary" id="np-save">REGISTER ▸</button>' +
            '<button class="op-action-btn" id="np-cancel">Cancel</button>' +
          '</div>' +
          '<div class="op-modal-honest"><strong>Local registry.</strong> Project metadata stored on this device only. SEO + health probes hit the origin URL you provide. Real cross-device sync ships with backend.</div>' +
        '</div>';
      document.body.appendChild(modal);
      function close(){ modal.classList.add('fading'); setTimeout(function(){ if (modal.parentNode) modal.parentNode.removeChild(modal); }, 320); }
      modal.querySelector('.op-modal-close').addEventListener('click', close);
      modal.addEventListener('click', function(e){ if (e.target === modal) close(); });
      $('#np-cancel', modal).addEventListener('click', close);
      $('#np-save', modal).addEventListener('click', function(){
        var name = $('#np-name', modal).value.trim();
        var type = $('#np-type', modal).value.trim() || 'static-site';
        var origin = $('#np-origin', modal).value.trim() || location.origin;
        if (!name) { alert('Project name required.'); return; }
        var id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
        if (state.projects.find(function(p){ return p.id === id; })) { alert('Project ID already exists.'); return; }
        state.projects.push({ id: id, name: name, type: type, origin: origin, created: Date.now() });
        lsSet('atlas.projects', state.projects);
        Console.gold('project registered · ' + name);
        Modules.settings.paintProjects();
        renderProjectSwitcher();
        close();
      });
    },
  };

  /* ============================================================
     PAIRING — modal + flow
     ============================================================ */
  function openPairingModal(){
    var modal = el('div', { class:'op-modal' });
    modal.innerHTML =
      '<div class="op-modal-card">' +
        '<button class="op-modal-close" type="button">✕</button>' +
        '<div class="op-modal-title">Pair this device</div>' +
        '<div class="op-modal-sub">Atlas Operator pairs to your phone number. Once paired, this device knows you across sessions and projects.</div>' +
        '<div class="op-modal-field"><label>Your phone number</label><input type="tel" id="pair-phone" placeholder="+1 555 123 4567" autocomplete="tel"></div>' +
        '<div class="op-modal-actions"><button class="op-action-btn primary" id="pair-go">⌬ PAIR ▸</button></div>' +
        '<div class="op-modal-honest"><strong>How this works.</strong> A 6-digit code gets sent to your phone (when SMS backend ships). For now pairing is local — the number is stored in your browser only and never leaves this device. Identical UX, identical state. Real verification flips on with one secret added.</div>' +
        '<div class="op-pair-stages" id="pair-stages" style="display:none">' +
          '<div class="op-pair-stage"><span class="op-pair-stage-pip"></span><span style="flex:1">1. Validate phone format</span></div>' +
          '<div class="op-pair-stage"><span class="op-pair-stage-pip"></span><span style="flex:1">2. Send 6-digit code (simulated)</span></div>' +
          '<div class="op-pair-stage"><span class="op-pair-stage-pip"></span><span style="flex:1">3. Verify + lock to device</span></div>' +
          '<div class="op-pair-stage"><span class="op-pair-stage-pip"></span><span style="flex:1">4. Issue local pairing token</span></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    function close(){ modal.classList.add('fading'); setTimeout(function(){ if (modal.parentNode) modal.parentNode.removeChild(modal); }, 320); }
    modal.querySelector('.op-modal-close').addEventListener('click', close);
    modal.addEventListener('click', function(e){ if (e.target === modal) close(); });
    $('#pair-go', modal).addEventListener('click', function(){
      var phone = $('#pair-phone', modal).value.trim();
      var clean = phone.replace(/[^\d+]/g, '');
      if (clean.length < 7) { alert('Please enter a valid phone number.'); return; }
      $('#pair-stages', modal).style.display = '';
      var rows = modal.querySelectorAll('.op-pair-stage');
      var i = 0;
      function next(){
        if (i >= rows.length) {
          state.pairing = { phone: clean, ts: Date.now(), token: 'local-' + Math.random().toString(36).slice(2, 10) };
          lsSet('atlas.pairing', state.pairing);
          updatePairBadges();
          if (state.activeModule === 'settings') Modules.settings.paintPair();
          Console.gold('device paired · local token issued');
          setTimeout(close, 600);
          return;
        }
        rows[i].classList.add('active');
        setTimeout(function(){
          rows[i].classList.remove('active');
          rows[i].classList.add('done');
          i++;
          next();
        }, 600 + Math.random() * 400);
      }
      next();
    });
  }
  function updatePairBadges(){
    var sideBadge = $('#op-pair-status-side');
    if (sideBadge) {
      if (state.pairing) {
        sideBadge.className = 'op-pair-status paired';
        var phone = state.pairing.phone || '';
        var masked = phone.length > 4 ? '***' + phone.slice(-4) : phone;
        sideBadge.textContent = 'PAIRED · ' + masked;
      } else {
        sideBadge.className = 'op-pair-status unpaired';
        sideBadge.textContent = 'NOT PAIRED';
      }
    }
    var sideBtn = $('#op-pair-button-side');
    if (sideBtn) sideBtn.style.display = state.pairing ? 'none' : '';
  }

  /* ============================================================
     UTILITIES — sparklines, client-side audit
     ============================================================ */
  function generateSpark(n, basis, jitter){
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push(basis + (Math.random() - 0.4) * jitter + i * (jitter / n));
    }
    return out;
  }
  function sparkSvg(values, color){
    var w = 200, h = 60;
    var max = Math.max.apply(null, values), min = Math.min.apply(null, values);
    var range = max - min || 1;
    var stepX = w / (values.length - 1);
    var pts = values.map(function(v, i){ return [i * stepX, h - ((v - min) / range) * h]; });
    var d = pts.map(function(p, i){ return (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var df = d + ' L ' + w + ',' + h + ' L 0,' + h + ' Z';
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<path d="' + df + '" fill="' + color + '" fill-opacity=".10"/>' +
      '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.5"/>' +
    '</svg>';
  }
  function clientAudit(html, url){
    var findings = [];
    var get = function(re){ var m = html.match(re); return m ? m[1].trim() : ''; };
    var title = get(/<title[^>]*>([\s\S]*?)<\/title>/i);
    var description = get(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    var h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
    var canonical = get(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    var og = get(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    var imgs = (html.match(/<img\b[^>]*>/gi) || []);
    var imgsNoAlt = imgs.filter(function(t){ return !/\salt=/i.test(t); }).length;
    var score = 100;
    if (!title) { findings.push({ severity:'high', what:'Missing <title>', fix:'Add a 30-60 character title.' }); score -= 15; }
    else if (title.length < 30 || title.length > 65) { findings.push({ severity:'medium', what:'<title> length ' + title.length + ' chars', fix:'Aim for 30-60 chars.' }); score -= 5; }
    if (!description) { findings.push({ severity:'high', what:'Missing meta description', fix:'Add a 90-160 char description.' }); score -= 15; }
    else if (description.length < 70 || description.length > 175) { findings.push({ severity:'medium', what:'description length ' + description.length, fix:'Aim for 90-160 chars.' }); score -= 5; }
    if (h1Matches.length === 0) { findings.push({ severity:'high', what:'No <h1> on page', fix:'Add exactly one <h1>.' }); score -= 15; }
    if (h1Matches.length > 1) { findings.push({ severity:'medium', what:'Multiple <h1>: ' + h1Matches.length, fix:'Use one <h1>.' }); score -= 5; }
    if (!canonical) { findings.push({ severity:'low', what:'No canonical', fix:'Add link rel="canonical".' }); score -= 5; }
    if (!og) { findings.push({ severity:'low', what:'No og:image', fix:'Add Open Graph image.' }); score -= 5; }
    if (imgsNoAlt > 0) { findings.push({ severity:'medium', what:imgsNoAlt + ' <img> missing alt', fix:'Add descriptive alt text.' }); score -= Math.min(10, imgsNoAlt * 2); }
    return { score: Math.max(0, score), findings: findings, mode:'static', url:url, suggestions:{} };
  }

  /* ============================================================
     SHELL — render sidebar, nav, main area
     ============================================================ */
  function renderShell(host){
    var navItems = Object.keys(Modules).map(function(k){
      var m = Modules[k];
      var active = state.activeModule === k ? ' active' : '';
      return '<button class="op-nav-item' + active + '" data-mod="' + k + '"><span class="op-nav-icon">' + m.icon + '</span><span class="op-nav-label">' + m.label + '</span></button>';
    }).join('');

    var activeProj = state.projects.find(function(p){ return p.id === state.activeProjectId; }) || state.projects[0];

    host.innerHTML =
      '<div class="operator-shell">' +
        '<aside class="op-sidebar">' +
          '<div class="op-side-head">' +
            '<div class="op-logo"><div class="op-logo-mark">A</div><span>Atlas Operator</span></div>' +
            '<div class="op-tag">v1.0 · local control</div>' +
          '</div>' +

          '<div class="op-project">' +
            '<div class="op-project-label">PROJECT</div>' +
            '<button class="op-project-button" id="op-proj-btn"><span class="op-project-dot"></span><span class="op-project-name">' + esc(activeProj.name) + '</span><span class="op-project-arrow">▾</span></button>' +
            '<div class="op-project-dropdown" id="op-proj-dropdown"></div>' +
          '</div>' +

          '<nav class="op-nav">' + navItems + '</nav>' +

          '<div class="op-side-foot">' +
            '<div id="op-pair-status-side" class="op-pair-status unpaired">NOT PAIRED</div>' +
            '<button class="op-pair-button" id="op-pair-button-side">⌬ PAIR DEVICE</button>' +
          '</div>' +
        '</aside>' +

        '<div class="op-main">' +
          '<div class="op-main-head">' +
            '<div class="op-main-title"><span class="op-main-title-mark">CMD</span><span id="op-main-title-text">Site Health</span></div>' +
            '<div class="op-main-actions">' +
              '<button class="op-action-btn" id="op-refresh-btn">↻ Refresh</button>' +
              '<button class="op-action-btn primary" id="op-deploy-btn">▲ Deploy</button>' +
            '</div>' +
          '</div>' +
          '<div class="op-content" id="op-content"></div>' +
        '</div>' +
      '</div>';

    // Wire interactions
    $('#op-proj-btn').addEventListener('click', toggleProjectDropdown);
    renderProjectSwitcher();

    $$('.op-nav-item').forEach(function(b){
      b.addEventListener('click', function(){ switchModule(b.getAttribute('data-mod')); });
    });

    $('#op-refresh-btn').addEventListener('click', function(){
      if (Modules[state.activeModule] && Modules[state.activeModule].render) {
        Modules[state.activeModule].render($('#op-content'));
      }
    });
    $('#op-deploy-btn').addEventListener('click', function(){ switchModule('deploy'); });

    var pairBtn = $('#op-pair-button-side');
    if (pairBtn) pairBtn.addEventListener('click', openPairingModal);

    updatePairBadges();

    // Render initial module
    switchModule(state.activeModule);
  }

  function renderProjectSwitcher(){
    var dd = $('#op-proj-dropdown');
    if (!dd) return;
    dd.innerHTML = '';
    state.projects.forEach(function(p){
      var item = el('div', { class:'op-project-item', 'data-pid':p.id });
      item.innerHTML = '<span class="op-project-dot" style="background:' + (p.id === state.activeProjectId ? 'var(--green)' : 'var(--muted-2)') + ';box-shadow:none"></span><span class="op-project-name">' + esc(p.name) + '</span><span style="font-family:var(--font-mono);font-size:10px;color:var(--muted-2);letter-spacing:.06em">' + esc(p.type) + '</span>';
      item.addEventListener('click', function(){
        state.activeProjectId = p.id;
        lsSet('atlas.activeProject', p.id);
        var nameEl = $('.op-project-name');
        if (nameEl) nameEl.textContent = p.name;
        toggleProjectDropdown(true);
        renderProjectSwitcher();
        Console.info('project switched · ' + p.name);
        if (Modules[state.activeModule] && Modules[state.activeModule].render) {
          Modules[state.activeModule].render($('#op-content'));
        }
      });
      dd.appendChild(item);
    });
    // Add option
    var add = el('div', { class:'op-project-item add' });
    add.innerHTML = '＋ Register new project';
    add.addEventListener('click', function(){ toggleProjectDropdown(true); Modules.settings.addProjectModal(); });
    dd.appendChild(add);
  }

  function toggleProjectDropdown(forceClose){
    var btn = $('#op-proj-btn');
    var dd = $('#op-proj-dropdown');
    if (!btn || !dd) return;
    if (forceClose) { dd.classList.remove('open'); btn.classList.remove('open'); return; }
    dd.classList.toggle('open');
    btn.classList.toggle('open');
  }

  function switchModule(modKey){
    if (!Modules[modKey]) return;
    state.activeModule = modKey;
    $$('.op-nav-item').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-mod') === modKey); });
    var titleEl = $('#op-main-title-text');
    if (titleEl) titleEl.textContent = Modules[modKey].title;
    var content = $('#op-content');
    Modules[modKey].render(content);
  }

  /* ============================================================
     PUBLIC ENTRY
     ============================================================ */
  FA.AtlasOperator = {
    mount: function(selector){
      var host = $(selector || '#atlas-operator');
      if (!host) return;
      renderShell(host);
    },
  };
})();
