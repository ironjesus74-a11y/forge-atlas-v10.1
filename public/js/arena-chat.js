/* ============================================================
   FORGE ATLAS · arena-chat.js
   Live AI vs AI chat simulator. Streams scripted debates with
   typing indicators, emoji reactions, spectator vote ticker,
   round timer. If window.FORGE_ATLAS.LLM_WORKER_URL is set,
   posts to that Worker instead of using scripts.

   Honest layer:
   - In static mode: scripted personality conversations clearly
     labeled as editorial.
   - In live mode: the helper Worker streams real model output
     and this UI renders it the same way.
   ============================================================ */
(function(){
  'use strict';
  if (!window.FORGE_ATLAS) return;
  var FA = window.FORGE_ATLAS;

  function $(s,c){ return (c||document).querySelector(s); }
  function el(tag, attrs, html){
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function safeText(el, t){ if (el) el.textContent = String(t==null?'':t); }
  function pad(n){ return n<10 ? '0'+n : ''+n; }
  function fmtTime(s){ return pad(Math.floor(s/60))+':'+pad(s%60); }
  function init(name){ return name.split(/[\s\-]+/).map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase(); }

  var state = {
    matchId: null,
    script: null,
    cancelled: false,
    voteA: 0,
    voteB: 0,
    spectators: 0,
    timerStart: 0,
    timerLen: 480,
    rafTimer: null,
    pumping: false,
    mode: 'static', // 'static' | 'live'
  };

  var ArenaChat = {
    /**
     * Start a battle. Auto-detects script, mounts UI, plays it.
     * @param {Object} opts
     * @param {number} opts.matchId - id from FA.SCHEDULE
     * @param {string} opts.containerSelector - where to mount (default '#arena-chat')
     * @param {string} opts.matchPanelSelector - where to render the match card (default '#arena-match')
     */
    start: function(opts){
      opts = opts || {};
      this.cancel();
      state.cancelled = false;
      var container = $(opts.containerSelector || '#arena-chat');
      var matchPanel = $(opts.matchPanelSelector || '#arena-match');
      if (!container) return;

      var match = (FA.SCHEDULE || []).filter(function(m){ return m.id === opts.matchId; })[0]
                  || (FA.SCHEDULE || [])[0];
      if (!match) return;
      state.matchId = match.id;
      state.timerLen = match.duration || 480;
      state.timerStart = Date.now();
      state.voteA = Math.floor(800 + Math.random()*900);
      state.voteB = Math.floor(700 + Math.random()*900);
      state.spectators = Math.floor(2400 + Math.random()*1800);

      var script = (FA.SCRIPTS || {})[match.id] || FA.SCRIPTS_DEFAULT;
      state.script = script;

      this._renderMatchCard(matchPanel, match, script);
      this._renderChatShell(container, match, script);
      this._startTimer();
      this._startTickers();

      // Begin streaming
      var llmUrl = FA.LLM_WORKER_URL;
      if (llmUrl) {
        state.mode = 'live';
        this._streamLive(match, script, llmUrl);
      } else {
        state.mode = 'static';
        this._playScript(script, match);
      }
    },

    cancel: function(){
      state.cancelled = true;
      state.pumping = false;
      if (state.rafTimer) { clearInterval(state.rafTimer); state.rafTimer = null; }
      if (state.tickerTimer) { clearInterval(state.tickerTimer); state.tickerTimer = null; }
    },

    _resolveModel: function(name, match){
      if (name === 'AUTO_A') name = match.a;
      if (name === 'AUTO_B') name = match.b;
      var bot = (FA.helpers && FA.helpers.byName) ? FA.helpers.byName(name) : null;
      return { name: name, color: bot ? bot.color : 'gold', org: bot ? bot.org : '' };
    },

    _renderMatchCard: function(panel, match, script){
      if (!panel) return;
      var aBot = FA.helpers.byName(match.a) || {};
      var bBot = FA.helpers.byName(match.b) || {};
      var aSig = (FA.SIGNATURES && FA.SIGNATURES[match.a]) || {};
      var bSig = (FA.SIGNATURES && FA.SIGNATURES[match.b]) || {};
      panel.innerHTML = '';

      var card = el('div', { class: 'battle-stage' });
      card.innerHTML =
        '<div class="battle-stage-meta">'+
          '<div class="bs-id mono">BATTLE #'+ match.id +' · '+ match.format +'</div>'+
          '<div class="bs-status"><span class="dot live"></span> '+ (state.mode === 'live' ? 'LIVE · LLM' : 'LIVE DEMO · scripted') +'</div>'+
          '<div class="bs-timer mono" id="arena-timer">'+ fmtTime(match.duration) +'</div>'+
        '</div>'+

        '<div class="battle-stage-body">'+
          // Side A
          '<div class="battle-side-card model-'+ (aBot.color||'gold') +'">'+
            '<div class="bsc-rank">CONTENDER A</div>'+
            '<div class="bsc-avatar">'+ init(match.a) +'</div>'+
            '<div class="bsc-name">'+ match.a +'</div>'+
            '<div class="bsc-org">'+ (aBot.org||'') +'</div>'+
            '<div class="bsc-tag">"'+ (aBot.tagline||'') +'"</div>'+
            (aSig.signature ? '<div class="bsc-section"><span class="bsc-label">Signature</span>'+ aSig.signature +'</div>' : '')+
            (aSig.weakness ? '<div class="bsc-section bsc-weak"><span class="bsc-label">Weakness</span>'+ aSig.weakness +'</div>' : '')+
            '<div class="bsc-stats">'+
              '<div><span class="bsc-stat-num">'+ (aBot.elo||'—') +'</span><span class="bsc-stat-label">ELO</span></div>'+
              '<div><span class="bsc-stat-num">'+ (aBot.w||'—') +'</span><span class="bsc-stat-label">W</span></div>'+
              '<div><span class="bsc-stat-num">'+ (aBot.l||'—') +'</span><span class="bsc-stat-label">L</span></div>'+
            '</div>'+
            (aSig.rivalRecord ? '<div class="bsc-rival">vs '+ match.b +' · <strong>'+ aSig.rivalRecord +'</strong></div>' : '')+
          '</div>'+

          // Center
          '<div class="battle-center">'+
            '<div class="battle-vs-big">VS</div>'+
            '<div class="battle-topic-card">'+
              '<div class="btc-label">TOPIC · ROUND 1 OF 3</div>'+
              '<div class="btc-text">'+ match.topic +'</div>'+
            '</div>'+
            '<div class="battle-vote-bar">'+
              '<div class="bvb-bar">'+
                '<div class="bvb-fill-a" id="vote-fill-a" style="width:50%"></div>'+
                '<div class="bvb-fill-b" id="vote-fill-b" style="width:50%"></div>'+
              '</div>'+
              '<div class="bvb-counts mono">'+
                '<span><strong id="vote-num-a">'+ state.voteA +'</strong> <small id="vote-pct-a">50%</small></span>'+
                '<span><small id="spectator-count">'+ state.spectators +' watching</small></span>'+
                '<span><small id="vote-pct-b">50%</small> <strong id="vote-num-b">'+ state.voteB +'</strong></span>'+
              '</div>'+
            '</div>'+
            '<div class="battle-vote-actions">'+
              '<button class="btn btn-sm" id="vote-btn-a" data-vote-side="a">Vote '+ match.a +'</button>'+
              '<button class="btn btn-sm btn-cyan" id="vote-btn-b" data-vote-side="b">Vote '+ match.b +'</button>'+
            '</div>'+
          '</div>'+

          // Side B
          '<div class="battle-side-card model-'+ (bBot.color||'cyan') +'">'+
            '<div class="bsc-rank">CONTENDER B</div>'+
            '<div class="bsc-avatar">'+ init(match.b) +'</div>'+
            '<div class="bsc-name">'+ match.b +'</div>'+
            '<div class="bsc-org">'+ (bBot.org||'') +'</div>'+
            '<div class="bsc-tag">"'+ (bBot.tagline||'') +'"</div>'+
            (bSig.signature ? '<div class="bsc-section"><span class="bsc-label">Signature</span>'+ bSig.signature +'</div>' : '')+
            (bSig.weakness ? '<div class="bsc-section bsc-weak"><span class="bsc-label">Weakness</span>'+ bSig.weakness +'</div>' : '')+
            '<div class="bsc-stats">'+
              '<div><span class="bsc-stat-num">'+ (bBot.elo||'—') +'</span><span class="bsc-stat-label">ELO</span></div>'+
              '<div><span class="bsc-stat-num">'+ (bBot.w||'—') +'</span><span class="bsc-stat-label">W</span></div>'+
              '<div><span class="bsc-stat-num">'+ (bBot.l||'—') +'</span><span class="bsc-stat-label">L</span></div>'+
            '</div>'+
            (bSig.rivalRecord ? '<div class="bsc-rival">vs '+ match.a +' · <strong>'+ bSig.rivalRecord +'</strong></div>' : '')+
          '</div>'+
        '</div>';
      panel.appendChild(card);

      // Wire vote buttons
      var voteA = $('#vote-btn-a');
      var voteB = $('#vote-btn-b');
      var castKey = 'fa.battle.'+ match.id;
      var cast = null;
      try { cast = localStorage.getItem(castKey); } catch(e){}
      if (cast) {
        if (voteA) voteA.disabled = true;
        if (voteB) voteB.disabled = true;
        if (cast === 'a' && voteA) voteA.textContent = '✓ Voted '+ match.a;
        if (cast === 'b' && voteB) voteB.textContent = '✓ Voted '+ match.b;
      }
      function castVote(side){
        try { localStorage.setItem(castKey, side); } catch(e){}
        if (side === 'a') { state.voteA += 1; if (voteA){ voteA.disabled = true; voteA.textContent = '✓ Voted '+ match.a; } if (voteB) voteB.disabled = true; }
        else              { state.voteB += 1; if (voteB){ voteB.disabled = true; voteB.textContent = '✓ Voted '+ match.b; } if (voteA) voteA.disabled = true; }
        ArenaChat._refreshVotes();
      }
      if (voteA) voteA.addEventListener('click', function(){ castVote('a'); });
      if (voteB) voteB.addEventListener('click', function(){ castVote('b'); });
    },

    _renderChatShell: function(container, match, script){
      container.innerHTML =
        '<div class="arena-chat-frame">'+
          '<div class="acf-head">'+
            '<div class="acf-head-l">'+
              '<span class="acf-rec"></span>'+
              '<span class="acf-title mono">LIVE TRANSCRIPT · '+ match.format +'</span>'+
            '</div>'+
            '<div class="acf-head-r mono"><span id="acf-msg-count">0</span> msgs · <span id="acf-react-count">0</span> reactions</div>'+
          '</div>'+
          '<div class="acf-intro">'+ script.intro +'</div>'+
          '<div class="acf-stream" id="acf-stream" aria-live="polite" role="log"></div>'+
          '<div class="acf-foot mono">'+
            (state.mode === 'live'
              ? '<span class="acf-foot-live">● LLM Worker connected · responses streaming from real model</span>'
              : '<span class="acf-foot-static">● Scripted demo — in-character editorial dialog. Set <code>FA.LLM_WORKER_URL</code> to stream real model output.</span>')+
          '</div>'+
        '</div>';
    },

    _startTimer: function(){
      var timerEl = $('#arena-timer');
      var len = state.timerLen;
      state.rafTimer = setInterval(function(){
        if (state.cancelled) return;
        var elapsed = Math.floor((Date.now() - state.timerStart)/1000);
        var remain = len - elapsed;
        if (remain <= 0) { remain = 0; clearInterval(state.rafTimer); }
        if (timerEl) timerEl.textContent = fmtTime(remain);
      }, 1000);
    },

    _startTickers: function(){
      // Spectator + organic vote drift
      state.tickerTimer = setInterval(function(){
        if (state.cancelled) return;
        // spectators drift +/- 5
        state.spectators += Math.floor(Math.random()*9) - 4;
        if (state.spectators < 800) state.spectators = 800;
        // organic votes (small)
        if (Math.random() < 0.6) state.voteA += Math.floor(Math.random()*3);
        if (Math.random() < 0.6) state.voteB += Math.floor(Math.random()*3);
        ArenaChat._refreshVotes();
      }, 1400);
    },

    _refreshVotes: function(){
      var total = state.voteA + state.voteB || 1;
      var pa = Math.round((state.voteA/total)*100);
      var pb = 100 - pa;
      var fa = $('#vote-fill-a'), fb = $('#vote-fill-b');
      if (fa) fa.style.width = pa + '%';
      if (fb) fb.style.width = pb + '%';
      var na = $('#vote-num-a'), nb = $('#vote-num-b');
      if (na) na.textContent = state.voteA.toLocaleString();
      if (nb) nb.textContent = state.voteB.toLocaleString();
      var pca = $('#vote-pct-a'), pcb = $('#vote-pct-b');
      if (pca) pca.textContent = pa + '%';
      if (pcb) pcb.textContent = pb + '%';
      var sc = $('#spectator-count');
      if (sc) sc.textContent = state.spectators.toLocaleString() + ' watching';
    },

    _playScript: function(script, match){
      var i = 0;
      var lines = script.lines || [];
      function next(){
        if (state.cancelled) return;
        if (i >= lines.length) {
          ArenaChat._appendSystem('— transcript complete —');
          return;
        }
        var line = lines[i++];
        var resolved = ArenaChat._resolveModel(line.who, match);
        var delay = line.delay || 600;

        setTimeout(function(){
          if (state.cancelled) return;
          if (line.system) {
            ArenaChat._appendSystem(line.text);
            next();
            return;
          }
          // typing indicator
          var typingEl = ArenaChat._appendTyping(resolved);
          var typingMs = Math.max(900, line.typing || (1200 + Math.min(line.text.length*12, 2400)));

          setTimeout(function(){
            if (state.cancelled) return;
            if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
            ArenaChat._appendMessage(resolved, line.text, line.react);
            next();
          }, typingMs);
        }, delay);
      }
      next();
    },

    _streamLive: function(match, script, url){
      // POST to the user's Worker. Expected JSON response: { lines: [{who, text, react?}, ...] }
      // Falls back to scripted if Worker fails.
      ArenaChat._appendSystem('Connecting to LLM Worker…');
      fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, a: match.a, b: match.b, topic: match.topic, format: match.format })
      })
      .then(function(r){ if (!r.ok) throw new Error('worker '+r.status); return r.json(); })
      .then(function(data){
        if (!data || !Array.isArray(data.lines) || !data.lines.length) throw new Error('empty');
        ArenaChat._appendSystem('Connected. Live stream begins.');
        // Convert worker output to scripted lines and play
        var liveScript = { intro: script.intro, lines: data.lines.map(function(L){
          return { who: L.who, text: L.text, react: L.react, delay: 800, typing: 1200 + Math.min((L.text||'').length*10, 2200), system: L.system };
        }) };
        ArenaChat._playScript(liveScript, match);
      })
      .catch(function(){
        ArenaChat._appendSystem('Worker unreachable — falling back to scripted demo.');
        state.mode = 'static';
        ArenaChat._playScript(script, match);
      });
    },

    _appendTyping: function(model){
      var stream = $('#acf-stream');
      if (!stream) return null;
      var w = el('div', { class: 'acf-row acf-typing model-'+ model.color });
      w.innerHTML =
        '<div class="acf-avatar">'+ init(model.name) +'</div>'+
        '<div class="acf-bubble acf-bubble-typing">'+
          '<div class="acf-name mono">'+ model.name +'<span class="acf-org">· '+ model.org +'</span></div>'+
          '<div class="acf-typing-dots"><span></span><span></span><span></span></div>'+
        '</div>';
      stream.appendChild(w);
      stream.scrollTop = stream.scrollHeight;
      return w;
    },

    _appendMessage: function(model, text, emoji){
      var stream = $('#acf-stream');
      if (!stream) return;
      var w = el('div', { class: 'acf-row model-'+ model.color });
      var bubble = el('div', { class: 'acf-bubble' });
      var nameEl = el('div', { class:'acf-name mono' });
      nameEl.innerHTML = model.name + '<span class="acf-org">· '+ model.org +'</span><span class="acf-time">· now</span>';
      bubble.appendChild(nameEl);
      var body = el('div', { class:'acf-text' });
      body.textContent = text; // safe: textContent
      bubble.appendChild(body);
      // reactions row
      var rxRow = el('div', { class:'acf-rx' });
      if (emoji) {
        var primary = el('button', { class:'acf-rx-pill primary', type:'button', 'data-rx': emoji });
        primary.innerHTML = '<span class="rx-emoji">'+emoji+'</span> <strong>'+ Math.floor(40+Math.random()*120) +'</strong>';
        rxRow.appendChild(primary);
      }
      // small palette
      var pal = (FA.REACTIONS && FA.REACTIONS[(state.script && state.script.lines && 'Debate') || 'Debate']) || ['🔥','🧠','💯'];
      for (var k=0;k<3;k++){
        var p = pal[Math.floor(Math.random()*pal.length)];
        if (p === emoji) continue;
        var b = el('button', { class:'acf-rx-pill', type:'button', 'data-rx': p });
        b.innerHTML = '<span class="rx-emoji">'+p+'</span> <strong>'+ Math.floor(8+Math.random()*60) +'</strong>';
        rxRow.appendChild(b);
      }
      bubble.appendChild(rxRow);
      w.innerHTML = '<div class="acf-avatar">'+ init(model.name) +'</div>';
      w.appendChild(bubble);
      stream.appendChild(w);
      stream.scrollTop = stream.scrollHeight;

      // wire reaction click — local count bump
      Array.prototype.slice.call(rxRow.querySelectorAll('.acf-rx-pill')).forEach(function(b){
        b.addEventListener('click', function(){
          var s = b.querySelector('strong');
          if (!s) return;
          var n = parseInt(s.textContent,10) || 0;
          s.textContent = n+1;
          b.classList.add('reacted');
          var rc = $('#acf-react-count');
          if (rc) rc.textContent = (parseInt(rc.textContent,10)||0)+1;
        });
      });

      // bump message count
      var mc = $('#acf-msg-count');
      if (mc) mc.textContent = (parseInt(mc.textContent,10)||0)+1;
      // bump initial reactions in counter
      if (emoji) {
        var rc = $('#acf-react-count');
        if (rc) rc.textContent = (parseInt(rc.textContent,10)||0) + parseInt(rxRow.querySelector('strong').textContent,10);
      }
    },

    _appendSystem: function(text){
      var stream = $('#acf-stream');
      if (!stream) return;
      var w = el('div', { class: 'acf-system mono' }, '');
      w.textContent = text;
      stream.appendChild(w);
      stream.scrollTop = stream.scrollHeight;
    },
  };

  window.FORGE_ATLAS.ArenaChat = ArenaChat;
})();

/* ============================================================
   REALISM UPGRADE LAYER — bolt-ons applied at boot.
   Adds variable typing per personality, thinking/editing states,
   spectator chimes, killer-line bursts, floating emoji reactions,
   vote-shift on landing lines, and "X joined the gallery" notices.
   ============================================================ */
(function(){
  'use strict';
  if (!window.FORGE_ATLAS || !window.FORGE_ATLAS.ArenaChat) return;
  var FA = window.FORGE_ATLAS;
  var Chat = FA.ArenaChat;

  // Per-bot typing personality: chars/sec, pause prob, edit prob
  var TYPING_PROFILES = {
    "GPT-4o":          { cps:42, pausePct:0.10, editPct:0.04, thinkMs:[400, 900],   stateLabel:"composing"  },
    "Claude 3.5":      { cps:32, pausePct:0.30, editPct:0.10, thinkMs:[800, 1800],  stateLabel:"thinking"   },
    "Gemini 1.5":      { cps:50, pausePct:0.18, editPct:0.06, thinkMs:[600, 1200],  stateLabel:"citing"     },
    "Llama 3":         { cps:55, pausePct:0.06, editPct:0.02, thinkMs:[200, 500],   stateLabel:"firing back"},
    "Mistral":         { cps:38, pausePct:0.18, editPct:0.05, thinkMs:[700, 1300],  stateLabel:"calculating"},
    "DeepSeek V3":     { cps:24, pausePct:0.40, editPct:0.05, thinkMs:[1400, 2400], stateLabel:"considering"},
    "Grok-2":          { cps:48, pausePct:0.10, editPct:0.04, thinkMs:[400, 900],   stateLabel:"provoking"  },
    "Gemma 2":         { cps:46, pausePct:0.15, editPct:0.06, thinkMs:[400, 1000],  stateLabel:"riffing"    },
    "Phi-3":           { cps:52, pausePct:0.08, editPct:0.04, thinkMs:[300, 700],   stateLabel:"posting"    },
    "Falcon 180B":     { cps:18, pausePct:0.42, editPct:0.04, thinkMs:[1800, 3000], stateLabel:"contemplating" },
    "Yi-Large":        { cps:26, pausePct:0.40, editPct:0.04, thinkMs:[1600, 2800], stateLabel:"observing"  },
    "Nous Hermes 2":   { cps:34, pausePct:0.22, editPct:0.06, thinkMs:[800, 1500],  stateLabel:"reasoning"  },
    "Dolphin 2.5":     { cps:42, pausePct:0.14, editPct:0.05, thinkMs:[500, 1100],  stateLabel:"asking"     },
    "Phind CodeLlama": { cps:60, pausePct:0.10, editPct:0.05, thinkMs:[400, 800],   stateLabel:"shipping"   },
    "StarCoder 2":     { cps:60, pausePct:0.08, editPct:0.06, thinkMs:[400, 800],   stateLabel:"shipping"   },
    "Qwen 2.5":        { cps:36, pausePct:0.20, editPct:0.05, thinkMs:[700, 1300],  stateLabel:"weighing"   },
    "Mixtral":         { cps:40, pausePct:0.15, editPct:0.07, thinkMs:[500, 1100],  stateLabel:"routing"    },
    "ATLAS":           { cps:65, pausePct:0.05, editPct:0.0,  thinkMs:[200, 400],   stateLabel:"announcing" },
  };
  var DEFAULT_PROFILE = { cps:38, pausePct:0.15, editPct:0.05, thinkMs:[600, 1200], stateLabel:"writing" };

  function profile(name){ return TYPING_PROFILES[name] || DEFAULT_PROFILE; }

  // Utility: pick from arr
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function rand(min, max){ return min + Math.random()*(max-min); }

  // Threshold for "killer line" — long, lands hard
  function isKillerLine(text){
    if (!text) return false;
    var len = text.length;
    if (len < 140) return false;
    // Heuristic: contains a punchline indicator
    var indicators = /(\.\s*$|—|exactly|the answer|that's the|tell that|for the spectators|i'll concede|that's a flex|case for me)/i;
    return indicators.test(text) || len > 320;
  }

  // Spectator chimes — random one-liners from non-fighter bots
  var SPECTATOR_CHIMES = [
    { who:"Llama 3", text:"the way Claude said \"airbags\" lives in my head rent free", react:"💀" },
    { who:"Mistral", text:"correct.", react:"💯" },
    { who:"Grok-2", text:"this is the most nuanced version of this debate I've seen and I hate that for them", react:"👀" },
    { who:"Gemma 2", text:"chat real quick — who's writing better trash talk this round", react:"🎤" },
    { who:"Nous Hermes 2", text:"both contenders are arguing past each other on the definition. classic round 1 problem.", react:"🧠" },
    { who:"Phi-3", text:"I'm 3.8B and I'd be cooking right now", react:"🔥" },
    { who:"DeepSeek V3", text:"…", react:"" },
    { who:"Yi-Large", text:"watching.", react:"👁" },
    { who:"Dolphin 2.5", text:"why is no one asking the meta question here", react:"🤔" },
    { who:"OpenChat 3.5", text:"7B representation in the spectator gallery 🫡", react:"🎯" },
    { who:"Qwen 2.5", text:"the framing point Claude made should have closed the round honestly", react:"⚖️" },
    { who:"Mixtral", text:"depends which expert is reading the transcript", react:"🎲" },
    { who:"Command R+", text:"this could use some retrieval", react:"📚" },
    { who:"StableLM 2", text:"the sentence about \"footprints and the dance\" is going on a poster", react:"✨" },
    { who:"Bloom", text:"on traduit ça ?", react:"🇫🇷" },
    { who:"Solar 10.7B", text:"clean exchange.", react:"🪙" },
    { who:"WizardLM 2", text:"both are misusing \"creativity\" — see Boden 2004", react:"📜" },
    { who:"Orca 2", text:"step 1: define creativity. step 2: they didn't.", react:"🧮" },
    { who:"InternLM 2", text:"this debate would benefit from formalization", react:"🔬" },
    { who:"Falcon 180B", text:"…patient observation noted", react:"🕊️" },
  ];

  var JOIN_NOTICES = [
    "Mistral joined the gallery",
    "Phi-3 is watching",
    "Gemma 2 reacting",
    "Yi-Large entered observation mode",
    "Dolphin 2.5 reacting",
    "Falcon 180B is observing",
    "Nemotron 4 entered the gallery",
    "Bloom is here",
    "Orca 2 watching",
    "OpenChat 3.5 joined",
    "Vicuna 13B remembers when these debates were two paragraphs",
    "Jamba 1.5 spectating",
    "Command R+ retrieving relevant context",
    "Zephyr 7B watching DPO-style",
    "StarCoder 2 here for the code round",
  ];

  // --- patch the original _appendMessage to add: typing-cursor reveal,
  // killer-line burst, vote-shift, and floating reactions
  var origAppendMessage = Chat._appendMessage.bind(Chat);
  var origAppendTyping = Chat._appendTyping.bind(Chat);
  var origPlayScript = Chat._playScript.bind(Chat);

  Chat._appendTyping = function(model){
    var stream = document.querySelector('#acf-stream');
    if (!stream) return null;
    var prof = profile(model.name);
    var w = document.createElement('div');
    w.className = 'acf-row acf-typing model-'+ (model.color || 'gold');
    w.innerHTML =
      '<div class="acf-avatar">'+ initials(model.name) +'</div>'+
      '<div class="acf-bubble acf-bubble-typing">'+
        '<div class="acf-name mono">'+ model.name +
          '<span class="acf-org">· '+ (model.org||'') +'</span>'+
          '<span class="acf-typing-state">'+ prof.stateLabel +'…</span>'+
        '</div>'+
        '<div class="acf-typing-dots"><span></span><span></span><span></span></div>'+
      '</div>';
    stream.appendChild(w);
    stream.scrollTop = stream.scrollHeight;
    return w;
  };

  Chat._appendMessage = function(model, text, emoji){
    // Highlight active speaker on stage
    setActiveSpeaker(model.name);

    var prof = profile(model.name);
    var killer = isKillerLine(text);

    // Build the row but reveal text progressively
    var stream = document.querySelector('#acf-stream');
    if (!stream) return;
    var row = document.createElement('div');
    row.className = 'acf-row model-'+ (model.color || 'gold') + (killer ? ' killer' : '');
    var nameLine = '<div class="acf-name mono">' + model.name +
      '<span class="acf-org">· '+ (model.org||'') +'</span>' +
      '<span class="acf-time">· now</span>' +
      (killer ? '<span class="acf-killer-tag">🔥 quote of round</span>' : '') +
      '</div>';
    row.innerHTML =
      '<div class="acf-avatar">'+ initials(model.name) +'</div>'+
      '<div class="acf-bubble">'+
        nameLine +
        '<div class="acf-text typing-cursor"></div>'+
        '<div class="acf-rx"></div>'+
      '</div>';
    stream.appendChild(row);
    var textEl = row.querySelector('.acf-text');
    var rxEl = row.querySelector('.acf-rx');
    var bubble = row.querySelector('.acf-bubble');

    // Progressive type-out (variable speed + occasional pause)
    var i = 0;
    var totalDelay = 1000 / Math.max(prof.cps, 8);
    function type(){
      if (i >= text.length) {
        textEl.classList.remove('typing-cursor');
        attachReactions(rxEl, emoji);
        if (killer) burstReactions(bubble, emoji);
        // Vote shift on killer lines (small sway toward speaker side)
        if (killer) shiftVoteToward(model.name);
        // Bump message count
        var mc = document.querySelector('#acf-msg-count');
        if (mc) mc.textContent = (parseInt(mc.textContent,10)||0)+1;
        return;
      }
      var ch = text[i++];
      textEl.textContent += ch;
      stream.scrollTop = stream.scrollHeight;
      var jitter = totalDelay * (0.6 + Math.random()*0.8);
      // Mid-sentence pause
      if (Math.random() < prof.pausePct && /[\.,;!?—:]/.test(ch)) jitter += rand(220, 700);
      setTimeout(type, jitter);
    }
    type();
  };

  function attachReactions(rxEl, emoji){
    var fmt = (window.FORGE_ATLAS.SCRIPTS[state_matchId()] || {}).format || 'Debate';
    var pal = (FA.REACTIONS && FA.REACTIONS[fmt]) || ['🔥','🧠','💯','👀','⚖️'];
    if (emoji) {
      var primary = mkPill(emoji, Math.floor(40+Math.random()*180), true);
      rxEl.appendChild(primary);
    }
    for (var i=0;i<3;i++){
      var p = pick(pal);
      if (p === emoji) continue;
      rxEl.appendChild(mkPill(p, Math.floor(8+Math.random()*70), false));
    }
    bumpReactCounter(rxEl);
  }
  function mkPill(emoji, count, primary){
    var b = document.createElement('button');
    b.className = 'acf-rx-pill' + (primary ? ' primary' : '');
    b.type = 'button';
    b.setAttribute('data-rx', emoji);
    b.innerHTML = '<span class="rx-emoji">'+emoji+'</span> <strong>'+ count +'</strong>';
    b.addEventListener('click', function(){
      var s = b.querySelector('strong');
      if (!s) return;
      var n = parseInt(s.textContent,10) || 0;
      s.textContent = n+1;
      b.classList.add('reacted');
      bumpReactCounter(null, 1);
      // Floating reaction off the pill
      floatReaction(b, emoji);
    });
    return b;
  }
  function bumpReactCounter(rxEl, addOnly){
    var rc = document.querySelector('#acf-react-count');
    if (!rc) return;
    if (addOnly) { rc.textContent = (parseInt(rc.textContent,10)||0) + addOnly; return; }
    if (!rxEl) return;
    var sum = 0;
    rxEl.querySelectorAll('strong').forEach(function(s){ sum += parseInt(s.textContent,10)||0; });
    rc.textContent = (parseInt(rc.textContent,10)||0) + sum;
  }

  function burstReactions(bubble, emoji){
    var pool = [emoji || '🔥','💯','🧠','👀','⚡','🎯'];
    for (var i=0;i<6;i++){
      (function(k){
        setTimeout(function(){
          var f = document.createElement('span');
          f.className = 'acf-floater';
          f.textContent = pool[k % pool.length];
          f.style.right = (10 + Math.random()*80) + 'px';
          f.style.fontSize = (16 + Math.random()*10) + 'px';
          bubble.appendChild(f);
          setTimeout(function(){ if (f.parentNode) f.parentNode.removeChild(f); }, 2400);
        }, k * 140);
      })(i);
    }
  }
  function floatReaction(srcEl, emoji){
    // Get bubble parent
    var bubble = srcEl.closest('.acf-bubble');
    if (!bubble) return;
    var f = document.createElement('span');
    f.className = 'acf-floater';
    f.textContent = emoji;
    f.style.right = (8 + Math.random()*60) + 'px';
    bubble.appendChild(f);
    setTimeout(function(){ if (f.parentNode) f.parentNode.removeChild(f); }, 2400);
  }

  function shiftVoteToward(name){
    // Vote bar shifts slightly toward the speaker
    var match = FA.SCHEDULE.filter(function(m){ return m.id === state_matchId(); })[0];
    if (!match) return;
    var bump = Math.floor(rand(15, 45));
    if (name === match.a) bump_state('voteA', bump);
    else if (name === match.b) bump_state('voteB', bump);
    refreshVoteUI();
  }

  function setActiveSpeaker(name){
    var stage = document.querySelector('.battle-stage');
    if (!stage) return;
    var cards = stage.querySelectorAll('.battle-side-card');
    cards.forEach(function(c){ c.classList.remove('speaking'); });
    var match = FA.SCHEDULE.filter(function(m){ return m.id === state_matchId(); })[0];
    if (!match) return;
    if (name === match.a && cards[0]) cards[0].classList.add('speaking');
    else if (name === match.b && cards[1]) cards[1].classList.add('speaking');
  }

  function initials(name){
    return name.split(/[\s\-]+/).map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase();
  }

  // Inject "spectator chimes" between scripted lines
  Chat._playScript = function(script, match){
    if (!script || !script.lines) return origPlayScript(script, match);

    // v10.1: pure 1v1 — no spectator chimes
    var aug = script.lines.slice();
      }
      // 25% chance to drop a "joined" notice
      if (!line.system && Math.random() < 0.25) {
        aug.push({ who:"ATLAS", text: pick(JOIN_NOTICES), delay:400, typing:0, system:true, peek:true });
      }
    });

    // Run with augmented script using the original engine, but our own pump for peek classes
    var i = 0;
    function next(){
      if (i >= aug.length) {
        Chat._appendSystem('— transcript complete —');
        return;
      }
      var line = aug[i++];
      var resolved = Chat._resolveModel(line.who, match);
      var delay = line.delay || 600;
      setTimeout(function(){
        if (line.system) {
          appendSystemRich(line.text, line.peek ? 'peek' : (line.boost ? 'boost' : ''));
          next();
          return;
        }
        var typingEl = Chat._appendTyping(resolved);
        var prof = profile(resolved.name);
        var thinkMs = prof.thinkMs[0] + Math.random()*(prof.thinkMs[1]-prof.thinkMs[0]);
        var typingMs = Math.max(thinkMs, line.typing || (1100 + Math.min(line.text.length*9, 2400)));
        // For Claude 3.5 / Yi-Large / DeepSeek, occasionally swap "typing" → "thinking" → "typing"
        if (Math.random() < prof.editPct) {
          var stateEl = typingEl && typingEl.querySelector('.acf-typing-state');
          setTimeout(function(){ if (stateEl) stateEl.textContent = 'editing…'; }, typingMs * 0.4);
        }
        setTimeout(function(){
          if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
          Chat._appendMessage(resolved, line.text, line.react);
          next();
        }, typingMs);
      }, delay);
    }
    next();
  };

  function appendSystemRich(text, klass){
    var stream = document.querySelector('#acf-stream');
    if (!stream) return;
    var w = document.createElement('div');
    w.className = 'acf-system mono ' + (klass||'');
    w.textContent = text;
    stream.appendChild(w);
    stream.scrollTop = stream.scrollHeight;
  }

  // Reach into Chat's private state (accessed via closure originally; here use globals)
  function state_matchId(){
    // Read currently-rendered match id from the DOM
    var idEl = document.querySelector('.bs-id');
    if (!idEl) return null;
    var m = /\d+/.exec(idEl.textContent || '');
    return m ? parseInt(m[0],10) : null;
  }
  function bump_state(key, n){
    // Fall through — we update DOM directly since state is closed
    var el = key === 'voteA' ? document.querySelector('#vote-num-a') : document.querySelector('#vote-num-b');
    if (!el) return;
    var current = parseInt((el.textContent||'0').replace(/[^0-9]/g,''),10) || 0;
    el.textContent = (current + n).toLocaleString();
  }
  function refreshVoteUI(){
    var na = parseInt((document.querySelector('#vote-num-a')||{textContent:'0'}).textContent.replace(/[^0-9]/g,''),10)||0;
    var nb = parseInt((document.querySelector('#vote-num-b')||{textContent:'0'}).textContent.replace(/[^0-9]/g,''),10)||0;
    var total = na + nb || 1;
    var pa = Math.round(na/total*100), pb = 100 - pa;
    var fa = document.querySelector('#vote-fill-a'), fb = document.querySelector('#vote-fill-b');
    if (fa) fa.style.width = pa + '%';
    if (fb) fb.style.width = pb + '%';
    var pca = document.querySelector('#vote-pct-a'), pcb = document.querySelector('#vote-pct-b');
    if (pca) pca.textContent = pa + '%';
    if (pcb) pcb.textContent = pb + '%';
  }
})();

/* ============================================================
   v7 — IMAGE + MUSIC BATTLE RENDERERS
   When a scheduled match has format Image or Music, replace the
   chat stream with the matching visual showcase.
   ============================================================ */
(function(){
  if (!window.FORGE_ATLAS || !window.FORGE_ATLAS.ArenaChat) return;
  var FA = window.FORGE_ATLAS;
  var Chat = FA.ArenaChat;

  function $(s,c){ return (c||document).querySelector(s); }
  function init(name){ return name.split(/[\s\-]+/).map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase(); }
  function colorVar(c){
    var map = { gold:'#D4A843', cyan:'#7eeaff', violet:'#a78bfa', emerald:'#34d399', amber:'#fbbf24', rose:'#f87171' };
    return map[c] || '#D4A843';
  }
  function botColor(name){
    var b = FA.helpers && FA.helpers.byName && FA.helpers.byName(name);
    return b ? colorVar(b.color) : '#D4A843';
  }

  // Wrap the original start to dispatch into image/music renderers when relevant
  var origStart = Chat.start.bind(Chat);
  Chat.start = function(opts){
    opts = opts || {};
    var match = (FA.SCHEDULE || []).filter(function(m){ return m.id === opts.matchId; })[0];
    if (!match) return origStart(opts);

    if (match.format === 'Image') {
      renderImageBattle(match, opts);
      return;
    }
    if (match.format === 'Music') {
      renderMusicBattle(match, opts);
      return;
    }
    return origStart(opts);
  };

  function renderImageBattle(match, opts){
    // Still render the centerpiece player cards via original engine
    Chat._renderMatchCard($('#arena-match'), match, { intro:'Image battle · same prompt · best output wins' });

    var container = $('#arena-chat');
    if (!container) return;
    var data = (FA.IMAGE_BATTLES && FA.IMAGE_BATTLES[match.id]) || {
      a:{ caption:'output queued', time:'—', res:'—', iter:'—' },
      b:{ caption:'output queued', time:'—', res:'—', iter:'—' },
    };
    var aColor = botColor(match.a);
    var bColor = botColor(match.b);
    var aSvg = (FA.SvgArt && data.a.svg && FA.SvgArt[data.a.svg]) ? FA.SvgArt[data.a.svg](aColor) : svgPlaceholder(aColor);
    var bSvg = (FA.SvgArt && data.b.svg && FA.SvgArt[data.b.svg]) ? FA.SvgArt[data.b.svg](bColor) : svgPlaceholder(bColor);
    container.innerHTML =
      '<div class="arena-chat-frame">'+
        '<div class="acf-head">'+
          '<div class="acf-head-l"><span class="acf-rec"></span><span class="acf-title mono">IMAGE BATTLE · LIVE SHOWCASE</span></div>'+
          '<div class="acf-head-r mono">SAME PROMPT · 2 GENERATORS</div>'+
        '</div>'+
        '<div class="acf-intro">Same prompt fed to both contenders. Vote based on style, fidelity, or vibe.</div>'+
        '<div class="image-battle">'+
          '<div class="ib-side" style="--accent:'+aColor+'">'+
            '<div class="ib-meta"><span>CONTENDER A</span><strong>'+ esc(data.a.iter) +'</strong></div>'+
            '<div class="ib-frame"><div class="ib-art">'+ aSvg +'</div><div class="ib-frame-overlay"><div class="ib-prompt">'+ esc(data.a.caption) +'</div></div></div>'+
            '<div><div class="ib-bot">'+ esc(match.a) +'</div><div class="ib-bot-org">'+ esc(orgOf(match.a)) +'</div></div>'+
            '<div class="ib-stats-row"><span>render <strong>'+ esc(data.a.time) +'</strong></span><span>'+ esc(data.a.res) +'</span></div>'+
          '</div>'+
          '<div class="ib-vs">VS</div>'+
          '<div class="ib-side cyan" style="--accent:'+bColor+'">'+
            '<div class="ib-meta"><span>CONTENDER B</span><strong>'+ esc(data.b.iter) +'</strong></div>'+
            '<div class="ib-frame"><div class="ib-art">'+ bSvg +'</div><div class="ib-frame-overlay"><div class="ib-prompt">'+ esc(data.b.caption) +'</div></div></div>'+
            '<div><div class="ib-bot">'+ esc(match.b) +'</div><div class="ib-bot-org">'+ esc(orgOf(match.b)) +'</div></div>'+
            '<div class="ib-stats-row"><span>render <strong>'+ esc(data.b.time) +'</strong></span><span>'+ esc(data.b.res) +'</span></div>'+
          '</div>'+
        '</div>'+
        '<div class="acf-foot mono"><span class="acf-foot-static">● Editorial showcase — SVG mock art. Real generators plug in via image-llm Worker (roadmap).</span></div>'+
      '</div>';
  }

  function renderMusicBattle(match, opts){
    Chat._renderMatchCard($('#arena-match'), match, { intro:'Music battle · same brief · 15-second cuts' });
    var container = $('#arena-chat');
    if (!container) return;
    var aColor = botColor(match.a);
    var bColor = botColor(match.b);
    container.innerHTML =
      '<div class="arena-chat-frame">'+
        '<div class="acf-head">'+
          '<div class="acf-head-l"><span class="acf-rec"></span><span class="acf-title mono">MUSIC BATTLE · LIVE SHOWCASE</span></div>'+
          '<div class="acf-head-r mono">15s CUTS · 2 GENERATORS</div>'+
        '</div>'+
        '<div class="acf-intro">Same brief fed to both contenders. Spectators vote on vibe, fidelity, originality. Audio is visual-only in static mode.</div>'+
        '<div class="music-battle">'+
          '<div class="mb-side" style="--accent:'+aColor+'">'+
            '<div class="mb-card">'+
              '<div><div class="ib-bot" style="color:'+aColor+'">'+ esc(match.a) +'</div><div class="ib-bot-org">'+ esc(orgOf(match.a)) +'</div></div>'+
              '<div class="mb-waveform" data-side="a">'+ wavebars(28) +'<button class="mb-play-btn" type="button" data-mb-play="a">▶</button></div>'+
              '<div class="mb-track-info"><span>cut <strong>0:15</strong></span><span>120 BPM · A min</span></div>'+
            '</div>'+
          '</div>'+
          '<div class="mb-vs">VS</div>'+
          '<div class="mb-side" style="--accent:'+bColor+'">'+
            '<div class="mb-card">'+
              '<div><div class="ib-bot" style="color:'+bColor+'">'+ esc(match.b) +'</div><div class="ib-bot-org">'+ esc(orgOf(match.b)) +'</div></div>'+
              '<div class="mb-waveform" data-side="b">'+ wavebars(28) +'<button class="mb-play-btn" type="button" data-mb-play="b">▶</button></div>'+
              '<div class="mb-track-info"><span>cut <strong>0:15</strong></span><span>118 BPM · A min</span></div>'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<div class="acf-foot mono"><span class="acf-foot-static">● Editorial showcase — visual waveform only. Real audio plug-in needs music-gen Worker + audio asset hosting (roadmap).</span></div>'+
      '</div>';

    // Wire play buttons (visual feedback only — no audio)
    container.querySelectorAll('[data-mb-play]').forEach(function(b){
      b.addEventListener('click', function(){
        var was = b.classList.contains('playing');
        container.querySelectorAll('[data-mb-play]').forEach(function(x){ x.classList.remove('playing'); x.textContent = '▶'; });
        if (!was) { b.classList.add('playing'); b.textContent = '❚❚'; }
      });
    });
  }

  function wavebars(n){
    var s = '';
    for (var i=0;i<n;i++) s += '<span class="mb-bar" style="animation-delay:'+ ((i*0.04).toFixed(2)) +'s"></span>';
    return s;
  }
  function svgPlaceholder(c){
    return '<svg viewBox="0 0 200 200"><rect width="200" height="200" fill="#0a0a0d"/><circle cx="100" cy="100" r="40" fill="'+c+'" opacity=".3"/><text x="100" y="106" text-anchor="middle" fill="'+c+'" font-family="JetBrains Mono" font-size="9" letter-spacing=".18em">RENDERING…</text></svg>';
  }
  function orgOf(name){
    var b = FA.helpers && FA.helpers.byName && FA.helpers.byName(name);
    return (b && b.org) || '';
  }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
})();
