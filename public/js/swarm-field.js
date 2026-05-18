/* ============================================================
   FORGE ATLAS · v10.1 · PARTICLE SWARM FIELD
   Sigma (cyan) vs Omega (gold). Mouse highlights nearby connections.
   Timed matches with rooting + spectator prompt (1/match).
   Performance: capped node count, pauses on hidden tab, reduced-motion safe.
   ============================================================ */
(function(){
  'use strict';

  // ============================================================
  // CONFIG · tuned for premium feel without melting phones
  // ============================================================
  var CFG = {
    nodesPerSide: 18,        // 36 total — dense enough to feel alive, light enough to be smooth
    nodeRadius: 2.2,
    nodeRadiusHover: 5,
    connectDistance: 130,    // px — within this, nodes draw connection lines
    mouseInfluence: 180,     // px — within this, mouse highlights connections to nodes
    speedBase: 0.18,         // baseline drift speed
    speedJitter: 0.15,
    engagementChance: 0.003, // per-frame chance of cross-faction signal
    matchDurationMs: 90000,  // 90s match
    bgFlowLines: 24,         // ambient drifting lines in background
    sigma: { color: [126, 234, 255], name: 'Sigma Pack' },
    omega: { color: [212, 168, 67], name: 'Omega Squad' },
  };

  // ============================================================
  // STATE
  // ============================================================
  var canvas, ctx, w, h, dpr, raf, paused = false;
  var nodes = [];
  var bgLines = [];
  var mouse = { x: -9999, y: -9999, active: false };
  var match = null;
  var lastFrame = 0;

  var roles = ['Strategist', 'Scout', 'Builder', 'Critic', 'Researcher', 'Refiner', 'Defender', 'Negotiator', 'Optimizer', 'Closer'];

  // Reduced-motion guard
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================================
  // BOOT
  // ============================================================
  function init(hostSelector, opts){
    opts = opts || {};
    var host = document.querySelector(hostSelector);
    if (!host) return;
    var ambient = opts.ambient === true;
    if (ambient) {
      host.classList.add('swarm-ambient-host');
    }

    // Build canvas
    canvas = document.createElement('canvas');
    canvas.className = 'swarm-field-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    ctx = canvas.getContext('2d');
    dpr = window.devicePixelRatio || 1;

    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Build nodes — fewer in ambient mode
    nodes = [];
    var perSide = ambient ? Math.floor(CFG.nodesPerSide * 0.55) : CFG.nodesPerSide;
    for (var i = 0; i < perSide; i++) {
      nodes.push(makeNode('sigma'));
      nodes.push(makeNode('omega'));
    }

    // Background drift lines
    bgLines = [];
    var nBg = ambient ? Math.floor(CFG.bgFlowLines * 0.6) : CFG.bgFlowLines;
    for (var j = 0; j < nBg; j++) {
      bgLines.push(makeBgLine());
    }

    // Mouse — disabled in ambient mode
    if (!ambient && window.matchMedia && window.matchMedia('(hover: hover)').matches) {
      canvas.addEventListener('mousemove', onMouse, { passive: true });
      canvas.addEventListener('mouseleave', function(){ mouse.active = false; });
    }

    // Pause when hidden
    document.addEventListener('visibilitychange', function(){
      paused = document.hidden;
      if (!paused) tick();
    });

    // Match only in full mode
    if (!ambient && opts.startMatch !== false) {
      startMatch();
    }

    if (REDUCE) {
      drawStatic();
    } else {
      tick();
    }
  }

  function resize(){
    w = canvas.parentElement.offsetWidth;
    h = canvas.parentElement.offsetHeight || 480;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width  = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.scale(dpr, dpr);
  }

  // ============================================================
  // NODES
  // ============================================================
  function makeNode(faction){
    return {
      x: Math.random() * (w || 800),
      y: Math.random() * (h || 480),
      vx: (Math.random() - 0.5) * CFG.speedBase,
      vy: (Math.random() - 0.5) * CFG.speedBase,
      faction: faction,
      role: roles[Math.floor(Math.random() * roles.length)],
      energy: 0.6 + Math.random() * 0.4,
      pulse: 0,
      flash: 0,
    };
  }

  function makeBgLine(){
    var startY = Math.random() * (h || 480);
    return {
      x1: Math.random() * (w || 800),
      y1: startY,
      x2: Math.random() * (w || 800),
      y2: startY + 40 + Math.random() * 80,
      opacity: 0.015 + Math.random() * 0.025,
      speed: 0.10 + Math.random() * 0.25,
      hue: Math.random() < 0.6 ? 'gold' : 'cyan',
    };
  }

  function onMouse(e){
    var rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  }

  // ============================================================
  // ENGAGEMENTS · cross-faction signal events
  // ============================================================
  var engagements = []; // active signal lines
  function maybeEngage(){
    if (Math.random() > CFG.engagementChance) return;
    var sigmas = nodes.filter(function(n){ return n.faction === 'sigma'; });
    var omegas = nodes.filter(function(n){ return n.faction === 'omega'; });
    if (!sigmas.length || !omegas.length) return;
    var a = sigmas[Math.floor(Math.random() * sigmas.length)];
    var b = omegas[Math.floor(Math.random() * omegas.length)];
    engagements.push({
      from: a, to: b,
      life: 1.0,
      attacker: Math.random() < 0.5 ? 'sigma' : 'omega',
    });
    a.flash = 1.0;
    b.flash = 1.0;

    // Track momentum
    if (match && match.active) {
      var attacker = Math.random() < 0.52 ? 'sigma' : 'omega'; // slight Sigma edge for variety
      if (attacker === 'sigma') match.sigmaScore += 1;
      else match.omegaScore += 1;
      renderMatchHUD();
    }
  }

  // ============================================================
  // MATCH LOGIC
  // ============================================================
  function startMatch(){
    match = {
      id: 'm-' + Date.now(),
      startedAt: Date.now(),
      durationMs: CFG.matchDurationMs,
      sigmaScore: 0,
      omegaScore: 0,
      active: true,
      backed: getBacked(),         // sigma | omega | null
      prompted: getPrompted(),     // true if user already prompted this match
    };
    renderMatchHUD();
  }

  function endMatch(){
    if (!match) return;
    match.active = false;
    var winner = match.sigmaScore > match.omegaScore ? 'sigma' :
                 match.omegaScore > match.sigmaScore ? 'omega' : 'draw';
    match.winner = winner;
    // Clear backing for next match
    try {
      localStorage.removeItem('forge.swarm.match.backed');
      localStorage.removeItem('forge.swarm.match.prompt');
    } catch(e){}
    renderMatchHUD();
    // Auto-start next match after 5s
    setTimeout(startMatch, 5000);
  }

  function getBacked(){
    try { return localStorage.getItem('forge.swarm.match.backed') || null; } catch(e){ return null; }
  }
  function setBacked(faction){
    try {
      if (localStorage.getItem('forge.swarm.match.backed')) return false;
      localStorage.setItem('forge.swarm.match.backed', faction);
      localStorage.setItem('forge.swarm.battles.watched',
        String((parseInt(localStorage.getItem('forge.swarm.battles.watched')||'0',10)+1)));
      return true;
    } catch(e){ return false; }
  }
  function getPrompted(){
    try { return !!localStorage.getItem('forge.swarm.match.prompt'); } catch(e){ return false; }
  }
  function setPrompted(faction, prompt){
    try {
      localStorage.setItem('forge.swarm.match.prompt', JSON.stringify({ faction: faction, prompt: prompt, at: Date.now() }));
      return true;
    } catch(e){ return false; }
  }

  // ============================================================
  // HUD · the match overlay (DOM, not canvas — easier to interact)
  // ============================================================
  function renderMatchHUD(){
    var hud = document.getElementById('swarm-field-hud');
    if (!hud) return;
    if (!match) { hud.innerHTML = ''; return; }

    var remaining = Math.max(0, match.durationMs - (Date.now() - match.startedAt));
    var mins = Math.floor(remaining / 60000);
    var secs = Math.floor((remaining % 60000) / 1000);
    var totalScore = match.sigmaScore + match.omegaScore || 1;
    var sigmaPct = (match.sigmaScore / totalScore * 100).toFixed(0);
    var omegaPct = (match.omegaScore / totalScore * 100).toFixed(0);

    if (!match.active) {
      // Match ended — show winner card
      hud.innerHTML =
        '<div class="swarm-match-end">' +
          '<div class="swarm-match-end-label">match concluded</div>' +
          '<div class="swarm-match-end-winner">' +
            (match.winner === 'draw' ? '<span class="draw">DRAW</span>' :
             match.winner === 'sigma' ? '<span class="sigma">Sigma Pack holds the field</span>' :
                                        '<span class="omega">Omega Squad holds the field</span>') +
          '</div>' +
          '<div class="swarm-match-end-score">Σ ' + match.sigmaScore + ' · Ω ' + match.omegaScore + '</div>' +
          '<div class="swarm-match-end-next">next match in <strong id="next-match-cd">5</strong>s</div>' +
        '</div>';
      var nextCd = 5;
      var iv = setInterval(function(){
        nextCd--;
        var el = document.getElementById('next-match-cd');
        if (el) el.textContent = nextCd;
        if (nextCd <= 0) clearInterval(iv);
      }, 1000);
      return;
    }

    hud.innerHTML =
      '<div class="swarm-match-hud">' +
        '<div class="swarm-match-top">' +
          '<div class="swarm-match-side sigma' + (match.backed === 'sigma' ? ' backed' : '') + '">' +
            '<div class="sm-emblem">Σ</div>' +
            '<div class="sm-meta">' +
              '<div class="sm-name">Sigma Pack</div>' +
              '<div class="sm-score">' + match.sigmaScore + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="swarm-match-clock">' +
            '<div class="sm-clock-label">T-</div>' +
            '<div class="sm-clock-time">' + String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0') + '</div>' +
          '</div>' +
          '<div class="swarm-match-side omega' + (match.backed === 'omega' ? ' backed' : '') + '">' +
            '<div class="sm-meta sm-meta-right">' +
              '<div class="sm-name">Omega Squad</div>' +
              '<div class="sm-score">' + match.omegaScore + '</div>' +
            '</div>' +
            '<div class="sm-emblem">Ω</div>' +
          '</div>' +
        '</div>' +
        '<div class="swarm-match-bar">' +
          '<div class="sm-bar-sigma" style="width:' + sigmaPct + '%"></div>' +
          '<div class="sm-bar-omega" style="width:' + omegaPct + '%"></div>' +
        '</div>' +
        '<div class="swarm-match-actions">' +
          (match.backed
            ? '<div class="sm-backed-note">You\'re backing <strong class="' + match.backed + '">' + (match.backed === 'sigma' ? 'Sigma Pack' : 'Omega Squad') + '</strong></div>'
            : '<button class="sm-back sm-back-sigma" data-faction="sigma">⌂ Back Sigma</button>' +
              '<button class="sm-back sm-back-omega" data-faction="omega">⌂ Back Omega</button>') +
        '</div>' +
        '<div class="swarm-match-prompt">' +
          (match.prompted
            ? '<div class="sm-prompt-confirm">⚡ your prompt is in for this match</div>'
            : '<button class="sm-prompt-open" type="button">+ inject one prompt for your team</button>') +
        '</div>' +
      '</div>';

    // Wire backing
    hud.querySelectorAll('.sm-back').forEach(function(b){
      b.addEventListener('click', function(){
        var f = b.getAttribute('data-faction');
        if (setBacked(f)) {
          match.backed = f;
          renderMatchHUD();
        }
      });
    });

    // Wire prompt opener
    var promptBtn = hud.querySelector('.sm-prompt-open');
    if (promptBtn) {
      promptBtn.addEventListener('click', openPromptDialog);
    }
  }

  function openPromptDialog(){
    if (!match || !match.active || match.prompted) return;
    if (!match.backed) {
      alert('Back a side first, then send them a prompt.');
      return;
    }
    var dialog = document.createElement('div');
    dialog.className = 'sm-prompt-dialog';
    dialog.innerHTML =
      '<div class="sm-prompt-card">' +
        '<div class="sm-prompt-head">' +
          '<div class="sm-prompt-label">Spectator Prompt · ' + (match.backed === 'sigma' ? 'Sigma Pack' : 'Omega Squad') + '</div>' +
          '<button class="sm-prompt-close" aria-label="Close">✕</button>' +
        '</div>' +
        '<p class="sm-prompt-help">One prompt per match. Pick wisely. Your team will weave it into their next move.</p>' +
        '<textarea class="sm-prompt-input" rows="4" maxlength="280" placeholder="e.g. break formation, send a scout right..."></textarea>' +
        '<div class="sm-prompt-foot">' +
          '<span class="sm-prompt-count">0 / 280</span>' +
          '<button class="sm-prompt-submit">Inject prompt</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(dialog);

    var ta = dialog.querySelector('.sm-prompt-input');
    var cc = dialog.querySelector('.sm-prompt-count');
    var submit = dialog.querySelector('.sm-prompt-submit');
    ta.addEventListener('input', function(){
      cc.textContent = ta.value.length + ' / 280';
      submit.disabled = ta.value.trim().length === 0;
    });
    submit.disabled = true;
    ta.focus();

    function close(){
      if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
    }
    dialog.querySelector('.sm-prompt-close').addEventListener('click', close);
    dialog.addEventListener('click', function(e){ if (e.target === dialog) close(); });

    submit.addEventListener('click', function(){
      var v = ta.value.trim();
      if (!v) return;
      setPrompted(match.backed, v);
      match.prompted = true;
      // Reward: minor score boost to backed faction
      if (match.backed === 'sigma') match.sigmaScore += 3;
      else match.omegaScore += 3;
      // Visual: flash all nodes on backed faction
      nodes.filter(function(n){ return n.faction === match.backed; }).forEach(function(n){ n.flash = 1.5; });
      close();
      renderMatchHUD();
    });
  }

  // ============================================================
  // ANIMATION LOOP
  // ============================================================
  function tick(){
    if (paused) return;
    raf = requestAnimationFrame(tick);

    var now = Date.now();
    var dt = Math.min((now - lastFrame) || 16, 50);
    lastFrame = now;

    // Match timing
    if (match && match.active && (now - match.startedAt) >= match.durationMs) {
      endMatch();
    } else if (match && match.active) {
      // Update HUD clock once per second
      if (!match._lastHudTick || now - match._lastHudTick > 1000) {
        match._lastHudTick = now;
        renderMatchHUD();
      }
    }

    ctx.clearRect(0, 0, w, h);

    // Background drift lines (your reference's vibe)
    drawBgLines();

    // Engagement events
    maybeEngage();

    // Update nodes
    nodes.forEach(function(n){
      n.x += n.vx;
      n.y += n.vy;
      // Wrap
      if (n.x < -10) n.x = w + 10;
      if (n.x > w + 10) n.x = -10;
      if (n.y < -10) n.y = h + 10;
      if (n.y > h + 10) n.y = -10;
      // Decay pulse + flash
      n.pulse = Math.max(0, n.pulse - 0.02);
      n.flash = Math.max(0, n.flash - 0.015);
    });

    // Draw connections (same-faction nodes within range)
    drawConnections();

    // Draw mouse-highlight lines
    if (mouse.active) drawMouseHighlight();

    // Draw engagement signals
    drawEngagements();

    // Draw nodes
    drawNodes();
  }

  function drawBgLines(){
    for (var i = 0; i < bgLines.length; i++) {
      var L = bgLines[i];
      L.y1 -= L.speed;
      L.y2 -= L.speed * 0.85;
      if (L.y1 < -120) {
        L.y1 = h + 120;
        L.y2 = h + 50;
        L.x1 = Math.random() * w;
        L.x2 = Math.random() * w;
      }
      var c = L.hue === 'gold' ? CFG.omega.color : CFG.sigma.color;
      ctx.beginPath();
      ctx.moveTo(L.x1, L.y1);
      ctx.lineTo(L.x2, L.y2);
      ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + L.opacity + ')';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  function drawConnections(){
    var d2 = CFG.connectDistance * CFG.connectDistance;
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var a = nodes[i], b = nodes[j];
        if (a.faction !== b.faction) continue; // same-faction only
        var dx = a.x - b.x, dy = a.y - b.y;
        var dist2 = dx*dx + dy*dy;
        if (dist2 > d2) continue;
        var alpha = (1 - dist2 / d2) * 0.18;
        var c = a.faction === 'sigma' ? CFG.sigma.color : CFG.omega.color;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }
  }

  function drawMouseHighlight(){
    var d2 = CFG.mouseInfluence * CFG.mouseInfluence;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var dx = mouse.x - n.x, dy = mouse.y - n.y;
      var dist2 = dx*dx + dy*dy;
      if (dist2 > d2) continue;
      var alpha = (1 - dist2 / d2) * 0.55;
      n.pulse = Math.max(n.pulse, alpha * 0.5);
      var c = n.faction === 'sigma' ? CFG.sigma.color : CFG.omega.color;
      ctx.beginPath();
      ctx.moveTo(mouse.x, mouse.y);
      ctx.lineTo(n.x, n.y);
      ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    // Mouse cursor mark
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.50)';
    ctx.fill();
  }

  function drawEngagements(){
    for (var i = engagements.length - 1; i >= 0; i--) {
      var e = engagements[i];
      e.life -= 0.02;
      if (e.life <= 0) { engagements.splice(i, 1); continue; }
      var c = e.attacker === 'sigma' ? CFG.sigma.color : CFG.omega.color;
      ctx.beginPath();
      ctx.moveTo(e.from.x, e.from.y);
      ctx.lineTo(e.to.x, e.to.y);
      ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + e.life * 0.8 + ')';
      ctx.lineWidth = 1.6 * e.life;
      ctx.stroke();
      // Burst at endpoint
      ctx.beginPath();
      ctx.arc(e.to.x, e.to.y, 6 * e.life, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + e.life * 0.3 + ')';
      ctx.fill();
    }
  }

  function drawNodes(){
    nodes.forEach(function(n){
      var c = n.faction === 'sigma' ? CFG.sigma.color : CFG.omega.color;
      var r = CFG.nodeRadius + n.pulse * 3 + n.flash * 4;
      // Glow
      if (n.flash > 0 || n.pulse > 0) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.10 + n.flash * 0.25) + ')';
        ctx.fill();
      }
      // Body
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (n.energy * 0.9) + ')';
      ctx.fill();
      // Bright core
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + n.flash * 0.5) + ')';
      ctx.fill();
    });
  }

  function drawStatic(){
    // Reduced-motion path — render once, no animation
    ctx.clearRect(0, 0, w, h);
    drawBgLines();
    drawConnections();
    drawNodes();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  if (!window.FORGE_ATLAS) window.FORGE_ATLAS = {};
  window.FORGE_ATLAS.SwarmField = {
    init: init,
    pause: function(){ paused = true; if (raf) cancelAnimationFrame(raf); },
    resume: function(){ paused = false; if (!REDUCE) tick(); },
  };
})();
