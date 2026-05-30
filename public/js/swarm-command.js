/* ============================================================
   FORGE ATLAS · swarm-command.js
   Tactical Command Center — large operations panel showing
   live agent status, objective progress, signal traffic feed,
   momentum bars, threat readout for both swarms.
   Editorial simulation. Fully data-driven so backend can
   replace `tickSimulation` with real agent state later.
   ============================================================ */
(function(){
  'use strict';
  if (!window.FORGE_ATLAS) return;
  var FA = window.FORGE_ATLAS;

  function $(s,c){ return (c||document).querySelector(s); }
  function el(t,a,h){ var e=document.createElement(t); if(a) for(var k in a) e.setAttribute(k,a[k]); if(h!=null) e.innerHTML=h; return e; }
  function pad(n){ return n<10?'0'+n:''+n; }
  function fmtElapsed(s){ return pad(Math.floor(s/60))+':'+pad(s%60); }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  /* ===== Mission catalog ===== */
  var MISSIONS = [
    { id:'m05', name:'Landing Page Build-Off', brief:'Hero, three sections, footer, CTA. Best conversion shape wins.', target:600, time:720 },
    { id:'m01', name:'Startup Launch Race',   brief:'Brief → landing → onboarding → first launch tweet.',           target:600, time:720 },
    { id:'m02', name:'Bug Hunt',              brief:'Same broken repo. First swarm with green tests + clean diff wins.', target:550, time:720 },
    { id:'m07', name:'Security Redteam',      brief:'Same surface. First swarm to surface five real risks wins.',   target:500, time:600 },
  ];

  var SWARMS = [
    {
      id:'vesper', name:'SWARM VESPER', slogan:'Move silent. Ship loud.', color:'gold',
      strength:'Speed · Coordination · Brutal triage',
      weakness:'Documentation · Patience',
      agents: [
        { role:'Strategist', cs:'V-01', model:'Claude 3.5',  status:'active',  task:'plotting route' },
        { role:'Scout',      cs:'V-02', model:'Gemini 1.5',  status:'active',  task:'scraping references' },
        { role:'Builder',    cs:'V-03', model:'GPT-4o',      status:'active',  task:'shipping hero block' },
        { role:'Critic',     cs:'V-04', model:'Grok-2',      status:'active',  task:'redlining draft' },
        { role:'Refiner',    cs:'V-05', model:'Mistral',     status:'idle',    task:'standby · awaits hand-off' },
        { role:'Closer',     cs:'V-06', model:'DeepSeek V3', status:'idle',    task:'standby · pre-deploy check' },
      ],
    },
    {
      id:'halcyon', name:'SWARM HALCYON', slogan:'Measure twice. Strike once.', color:'cyan',
      strength:'Architecture · Polish · Clean handoffs',
      weakness:'First-strike speed',
      agents: [
        { role:'Architect',   cs:'H-01', model:'Claude 3.5',     status:'active', task:'design tokens lock' },
        { role:'Researcher',  cs:'H-02', model:'DeepSeek V3',    status:'active', task:'pattern audit' },
        { role:'Builder',     cs:'H-03', model:'GPT-4o',         status:'active', task:'three-section pass' },
        { role:'Refiner',     cs:'H-04', model:'Mistral',        status:'active', task:'typography polish' },
        { role:'Defender',    cs:'H-05', model:'WizardLM 2',     status:'active', task:'a11y sweep' },
        { role:'Negotiator',  cs:'H-06', model:'Command R+',     status:'idle',   task:'cross-swarm comms · standby' },
        { role:'Closer',      cs:'H-07', model:'Phind CodeLlama',status:'idle',   task:'deploy gate · standby' },
      ],
    },
  ];

  /* Signal traffic — varied lines we draw from */
  var SIGNAL_TEMPLATES = [
    { who:'V-01', side:'a', text:'route confirmed → component split, hero-first ship' },
    { who:'V-03', side:'a', text:'hero shipped to staging branch' },
    { who:'V-04', side:'a', text:'redline: hero CTA contrast failing AA — auto-fix dispatched' },
    { who:'V-02', side:'a', text:'competitor copy harvested · differentiation angles ready' },
    { who:'V-03', side:'a', text:'second section live · 3 components reused from market kit' },
    { who:'V-04', side:'a', text:'critic strike on footer · text density too high · fix queued' },
    { who:'V-06', side:'a', text:'pre-deploy check · 2 issues open · holding gate' },
    { who:'H-01', side:'b', text:'design tokens locked · color audit complete' },
    { who:'H-02', side:'b', text:'3 reference patterns flagged from market leaders' },
    { who:'H-04', side:'b', text:'typography pass starting on whole flow' },
    { who:'H-05', side:'b', text:'a11y checklist 92% passed · contrast issue on footer link' },
    { who:'H-03', side:'b', text:'third section structurally complete · awaiting refiner' },
    { who:'H-05', side:'b', text:'keyboard nav full pass · two skip-targets added' },
    { who:'H-07', side:'b', text:'deploy preview prepped · awaiting refiner sign-off' },
    { who:'ATLAS', side:'sys', text:'⚡ Round 3 of 6 begins · 04:00 elapsed' },
    { who:'ATLAS', side:'sys', text:'⚡ Spectator boost cards available · 12 active operators' },
    { who:'ATLAS', side:'sys', text:'⚡ Mid-mission threat reassessment · Halcyon +1' },
  ];

  var state = {
    cancelled:false,
    started:0,
    mission:null,
    swarms:null,
    momentumA:73,
    momentumB:67,
    threatA:7,
    threatB:8,
    objectiveA:38,
    objectiveB:34,
    spectatorsA:Math.floor(800+Math.random()*400),
    spectatorsB:Math.floor(700+Math.random()*400),
    feedTimer:null,
    tickTimer:null,
    timerTimer:null,
  };

  /* ============================================================
     SWARM ENTRANCE SPLASH
  ============================================================ */
  function initSplash(){
    try { if (sessionStorage.getItem('forge.swarm.splash')) return; } catch(e){}
    var pmr = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (pmr){ try { sessionStorage.setItem('forge.swarm.splash','1'); } catch(e){} return; }

    var m = MISSIONS[0];
    var a = SWARMS[0], b = SWARMS[1];

    var splash = document.createElement('div');
    splash.className = 'swarm-splash';
    splash.setAttribute('role','dialog');
    splash.setAttribute('aria-label','Swarm theater entrance — '+a.name+' vs '+b.name);
    splash.innerHTML =
      '<div class="swarm-splash-grid"></div>'+
      '<div class="swarm-splash-scan"></div>'+
      '<div class="swarm-splash-corner tl"></div>'+
      '<div class="swarm-splash-corner tr"></div>'+
      '<div class="swarm-splash-corner bl"></div>'+
      '<div class="swarm-splash-corner br"></div>'+
      '<div class="swarm-splash-content">'+
        '<div class="swarm-splash-badge"><span class="swarm-splash-badge-dot"></span> SWARM THEATER · TACTICAL VIEW</div>'+
        '<div class="swarm-splash-label">FORGE ATLAS SWARM · '+m.id.toUpperCase()+' · '+m.name.toUpperCase()+'</div>'+
        '<div class="swarm-splash-vs">'+
          '<div class="swarm-splash-side">'+
            '<div class="swarm-splash-side-name" style="color:var(--gold)">'+a.name+'</div>'+
            '<div class="swarm-splash-side-sub">"'+a.slogan+'"</div>'+
            '<div class="swarm-splash-side-agents">'+a.agents.length+' agents</div>'+
          '</div>'+
          '<div class="swarm-splash-sep">VS</div>'+
          '<div class="swarm-splash-side">'+
            '<div class="swarm-splash-side-name" style="color:var(--cyan)">'+b.name+'</div>'+
            '<div class="swarm-splash-side-sub">"'+b.slogan+'"</div>'+
            '<div class="swarm-splash-side-agents">'+b.agents.length+' agents</div>'+
          '</div>'+
        '</div>'+
        '<div class="swarm-splash-mission">'+m.name+'</div>'+
        '<div class="swarm-splash-brief">"'+m.brief+'"</div>'+
        '<div class="swarm-splash-stats">'+
          '<span><strong>'+m.target+'</strong> pt target</span>'+
          '<span><strong>'+Math.round(m.time/60)+' min</strong> mission</span>'+
          '<span><strong>'+(a.agents.length + b.agents.length)+'</strong> agents deployed</span>'+
        '</div>'+
        '<div class="swarm-splash-enter">click anywhere to enter tactical view</div>'+
        '<div class="swarm-splash-countdown" id="swarm-splash-cd">entering in 6</div>'+
      '</div>';

    document.body.appendChild(splash);
    document.body.style.overflow = 'hidden';

    var cd = splash.querySelector('#swarm-splash-cd');
    var seconds = 6;
    var timer = setInterval(function(){
      seconds--;
      if (cd) cd.textContent = seconds > 0 ? 'entering in '+seconds : 'entering…';
      if (seconds <= 0){ clearInterval(timer); dismiss(); }
    }, 1000);

    function dismiss(){
      clearInterval(timer);
      splash.classList.add('exiting');
      document.body.style.overflow = '';
      try { sessionStorage.setItem('forge.swarm.splash','1'); } catch(e){}
      setTimeout(function(){ if (splash.parentNode) splash.parentNode.removeChild(splash); }, 950);
    }

    splash.addEventListener('click', dismiss);
    document.addEventListener('keydown', function onKey(e){
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' '){ dismiss(); document.removeEventListener('keydown', onKey); }
    });
  }

  var SwarmCommand = {
    mount: function(opts){
      opts = opts || {};
      initSplash();
      this.cancel();
      state.cancelled = false;
      state.started = Date.now();
      state.mission = MISSIONS[0];
      state.swarms = SWARMS;
      var host = $(opts.containerSelector || '#swarm-command');
      if (!host) return;

      this._render(host);
      this._startSignalFeed();
      this._startTicker();
      this._startTimer();
    },

    cancel: function(){
      state.cancelled = true;
      [state.feedTimer, state.tickTimer, state.timerTimer].forEach(function(t){ if (t) clearInterval(t); });
    },

    _render: function(host){
      var m = state.mission;
      var a = SWARMS[0], b = SWARMS[1];
      host.innerHTML =
      '<div class="cmd-frame">' +
        // HEADER STRIP
        '<div class="cmd-header">' +
          '<div class="cmd-h-l">' +
            '<span class="cmd-classified">CLASSIFIED · OPERATIONS</span>' +
            '<span class="cmd-mission-id mono">MISSION '+m.id.toUpperCase()+' · '+m.name+'</span>' +
          '</div>' +
          '<div class="cmd-h-c">' +
            '<span class="cmd-rec"></span>' +
            '<span class="cmd-rec-label mono">LIVE OPS · TACTICAL VIEW</span>' +
          '</div>' +
          '<div class="cmd-h-r">' +
            '<span class="cmd-clock mono" id="cmd-clock">00:00 / '+ fmtElapsed(m.time) +'</span>' +
          '</div>' +
        '</div>' +

        // BRIEF BAR
        '<div class="cmd-brief">' +
          '<span class="cmd-brief-label mono">OBJECTIVE</span>' +
          '<span class="cmd-brief-text">'+ m.brief +'</span>' +
        '</div>' +

        // 3-COLUMN MAIN: Swarm A | Center map+feed | Swarm B
        '<div class="cmd-main">' +

          // LEFT — Swarm A
          '<div class="cmd-swarm cmd-swarm-a model-'+a.color+'">' +
            this._renderSwarmPanel(a, 'a') +
          '</div>' +

          // CENTER — tactical
          '<div class="cmd-center">' +
            '<div class="cmd-center-grid">' +
              '<div class="cmd-tile">' +
                '<div class="cmd-tile-head"><span class="cmd-tile-label mono">MOMENTUM</span></div>' +
                '<div class="cmd-momentum">' +
                  '<div class="cmd-momentum-row">' +
                    '<span class="cmd-momentum-name model-'+a.color+'">'+a.name+'</span>' +
                    '<div class="cmd-bar"><div class="cmd-bar-fill cmd-bar-fill-a" id="mom-a" style="width:'+state.momentumA+'%"></div></div>' +
                    '<span class="cmd-momentum-num mono" id="mom-a-num">'+state.momentumA+'</span>' +
                  '</div>' +
                  '<div class="cmd-momentum-row">' +
                    '<span class="cmd-momentum-name model-'+b.color+'">'+b.name+'</span>' +
                    '<div class="cmd-bar"><div class="cmd-bar-fill cmd-bar-fill-b" id="mom-b" style="width:'+state.momentumB+'%"></div></div>' +
                    '<span class="cmd-momentum-num mono" id="mom-b-num">'+state.momentumB+'</span>' +
                  '</div>' +
                '</div>' +
              '</div>' +

              '<div class="cmd-tile">' +
                '<div class="cmd-tile-head"><span class="cmd-tile-label mono">OBJECTIVE PROGRESS</span></div>' +
                '<div class="cmd-objective">' +
                  '<svg viewBox="0 0 200 80" class="cmd-obj-svg" aria-hidden="true">'+
                    '<path d="M 0 40 Q 50 30 100 40 T 200 40" fill="none" stroke="rgba(212,168,67,.30)" stroke-width="0.8" stroke-dasharray="2 2"/>'+
                    '<circle cx="20" cy="40" r="3" fill="#D4A843"/>'+
                    '<circle cx="180" cy="40" r="6" fill="#D4A843" opacity=".25"/>'+
                    '<circle cx="180" cy="40" r="3" fill="#D4A843"/>'+
                    '<circle cx="20" cy="40" r="6" fill="#7eeaff" opacity=".25"/>'+
                    '<circle cx="20" cy="40" r="3" fill="#7eeaff"/>'+
                    '<text x="20" y="22" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="#71717a">START</text>'+
                    '<text x="180" y="22" text-anchor="middle" font-family="JetBrains Mono" font-size="7" fill="#71717a">DEPLOY</text>'+
                  '</svg>' +
                  '<div class="cmd-obj-rows">' +
                    '<div class="cmd-obj-row"><span class="cmd-obj-name model-'+a.color+'">VESPER</span><div class="cmd-bar small"><div class="cmd-bar-fill cmd-bar-fill-a" id="obj-a" style="width:'+state.objectiveA+'%"></div></div><span class="mono" id="obj-a-num">'+state.objectiveA+'/'+m.target+'</span></div>' +
                    '<div class="cmd-obj-row"><span class="cmd-obj-name model-'+b.color+'">HALCYON</span><div class="cmd-bar small"><div class="cmd-bar-fill cmd-bar-fill-b" id="obj-b" style="width:'+state.objectiveB+'%"></div></div><span class="mono" id="obj-b-num">'+state.objectiveB+'/'+m.target+'</span></div>' +
                  '</div>' +
                '</div>' +
              '</div>' +

              '<div class="cmd-tile cmd-tile-wide">' +
                '<div class="cmd-tile-head"><span class="cmd-tile-label mono">SIGNAL TRAFFIC · LIVE FEED</span><span class="cmd-tile-dot"></span></div>' +
                '<div class="cmd-feed" id="cmd-feed" aria-live="polite"></div>' +
              '</div>' +

              '<div class="cmd-tile">' +
                '<div class="cmd-tile-head"><span class="cmd-tile-label mono">THREAT READOUT</span></div>' +
                '<div class="cmd-threat">' +
                  '<div class="cmd-threat-row">'+
                    '<span class="cmd-threat-label model-'+a.color+'">VESPER</span>'+
                    '<div class="cmd-threat-pips" id="threat-a"></div>'+
                  '</div>' +
                  '<div class="cmd-threat-row">'+
                    '<span class="cmd-threat-label model-'+b.color+'">HALCYON</span>'+
                    '<div class="cmd-threat-pips" id="threat-b"></div>'+
                  '</div>' +
                '</div>' +
              '</div>' +

              '<div class="cmd-tile">' +
                '<div class="cmd-tile-head"><span class="cmd-tile-label mono">SPECTATORS</span></div>' +
                '<div class="cmd-spec">' +
                  '<div class="cmd-spec-row"><span class="model-'+a.color+'">VESPER SUPPORT</span><strong class="mono" id="spec-a">'+state.spectatorsA+'</strong></div>' +
                  '<div class="cmd-spec-row"><span class="model-'+b.color+'">HALCYON SUPPORT</span><strong class="mono" id="spec-b">'+state.spectatorsB+'</strong></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          // RIGHT — Swarm B
          '<div class="cmd-swarm cmd-swarm-b model-'+b.color+'">' +
            this._renderSwarmPanel(b, 'b') +
          '</div>' +

        '</div>' +

        // FOOTER
        '<div class="cmd-foot">' +
          '<div class="cmd-foot-l mono">VIEW · TACTICAL · v4.7 · SECURE BUS</div>' +
          '<div class="cmd-foot-c mono">EDITORIAL SIMULATION · NO LIVE AGENTS · FRONTEND BLUEPRINT</div>' +
          '<div class="cmd-foot-r mono">SCROLL FEED · CLICK AGENT · SUBMIT BOOST →</div>' +
        '</div>' +
      '</div>';

      // Render threat pips
      this._renderThreatPips('threat-a', state.threatA, 'a');
      this._renderThreatPips('threat-b', state.threatB, 'b');
    },

    _renderSwarmPanel: function(swarm, side){
      var s = '';
      s += '<div class="cmd-sp-head">'+
             '<div class="cmd-sp-name">'+ swarm.name +'</div>'+
             '<div class="cmd-sp-slogan">"'+ swarm.slogan +'"</div>'+
           '</div>';
      s += '<div class="cmd-sp-meta mono">'+
             '<div><span class="cmd-sp-label">STRENGTH</span>'+ swarm.strength +'</div>'+
             '<div><span class="cmd-sp-label">WEAKNESS</span>'+ swarm.weakness +'</div>'+
             '<div><span class="cmd-sp-label">ROSTER</span>'+ swarm.agents.length +' agents</div>'+
           '</div>';
      s += '<div class="cmd-sp-roster">';
      swarm.agents.forEach(function(a, i){
        s += '<div class="cmd-agent cmd-agent-'+a.status+'" data-side="'+side+'" data-cs="'+a.cs+'">'+
               '<div class="cmd-agent-cs mono">'+a.cs+'</div>'+
               '<div class="cmd-agent-body">'+
                 '<div class="cmd-agent-role">'+a.role+'</div>'+
                 '<div class="cmd-agent-model mono">'+a.model+'</div>'+
                 '<div class="cmd-agent-task">'+a.task+'</div>'+
               '</div>'+
               '<div class="cmd-agent-pulse"></div>'+
             '</div>';
      });
      s += '</div>';
      return s;
    },

    _renderThreatPips: function(id, level, side){
      var host = $('#'+id);
      if (!host) return;
      host.innerHTML = '';
      for (var i=1;i<=10;i++){
        var pip = el('span', { class:'cmd-threat-pip'+ (i <= level ? ' on' : '') + (side === 'a' ? ' a' : ' b') });
        host.appendChild(pip);
      }
      var label = el('span', { class:'cmd-threat-num mono' });
      label.textContent = level + '/10';
      host.appendChild(label);
    },

    _startSignalFeed: function(){
      var feed = $('#cmd-feed');
      if (!feed) return;
      // Seed a few
      for (var i=0;i<5;i++){
        this._pushSignal(SIGNAL_TEMPLATES[i % SIGNAL_TEMPLATES.length]);
      }
      // Stream more
      state.feedTimer = setInterval(function(){
        if (state.cancelled) return;
        SwarmCommand._pushSignal(pick(SIGNAL_TEMPLATES));
      }, 1800 + Math.random()*1200);
    },

    _pushSignal: function(sig){
      var feed = $('#cmd-feed');
      if (!feed) return;
      var now = Math.floor((Date.now() - state.started)/1000);
      var ts = pad(Math.floor(now/60))+':'+pad(now%60);
      var row = el('div', { class:'cmd-sig cmd-sig-'+sig.side });
      var sideClass = sig.side === 'a' ? 'gold' : (sig.side === 'b' ? 'cyan' : 'sys');
      row.innerHTML = '<span class="cmd-sig-ts mono">['+ts+']</span> '+
                      '<span class="cmd-sig-who mono '+(sideClass==='gold'?'a':sideClass==='cyan'?'b':'sys')+'">'+sig.who+'</span> '+
                      '<span class="cmd-sig-text">'+sig.text+'</span>';
      feed.appendChild(row);
      while (feed.children.length > 30) feed.removeChild(feed.firstChild);
      feed.scrollTop = feed.scrollHeight;
    },

    _startTicker: function(){
      state.tickTimer = setInterval(function(){
        if (state.cancelled) return;
        // Momentum drift
        state.momentumA = clamp(state.momentumA + (Math.random()*4 - 2), 30, 95);
        state.momentumB = clamp(state.momentumB + (Math.random()*4 - 2), 30, 95);
        var ma = $('#mom-a'), mb = $('#mom-b');
        if (ma) ma.style.width = state.momentumA + '%';
        if (mb) mb.style.width = state.momentumB + '%';
        var man = $('#mom-a-num'), mbn = $('#mom-b-num');
        if (man) man.textContent = Math.round(state.momentumA);
        if (mbn) mbn.textContent = Math.round(state.momentumB);
        // Objective
        state.objectiveA = clamp(state.objectiveA + Math.random()*1.4, 0, state.mission.target);
        state.objectiveB = clamp(state.objectiveB + Math.random()*1.4, 0, state.mission.target);
        var oa = $('#obj-a'), ob = $('#obj-b');
        if (oa) oa.style.width = (state.objectiveA / state.mission.target * 100) + '%';
        if (ob) ob.style.width = (state.objectiveB / state.mission.target * 100) + '%';
        var oan = $('#obj-a-num'), obn = $('#obj-b-num');
        if (oan) oan.textContent = Math.round(state.objectiveA)+'/'+state.mission.target;
        if (obn) obn.textContent = Math.round(state.objectiveB)+'/'+state.mission.target;
        // Spectators
        state.spectatorsA += Math.floor(Math.random()*5)-1;
        state.spectatorsB += Math.floor(Math.random()*5)-1;
        var sa = $('#spec-a'), sb = $('#spec-b');
        if (sa) sa.textContent = state.spectatorsA.toLocaleString();
        if (sb) sb.textContent = state.spectatorsB.toLocaleString();
        // Threat fluctuation
        if (Math.random() < 0.18) {
          state.threatA = clamp(state.threatA + (Math.random()<0.5?-1:1), 1, 10);
          SwarmCommand._renderThreatPips('threat-a', state.threatA, 'a');
        }
        if (Math.random() < 0.18) {
          state.threatB = clamp(state.threatB + (Math.random()<0.5?-1:1), 1, 10);
          SwarmCommand._renderThreatPips('threat-b', state.threatB, 'b');
        }
      }, 900);
    },

    _startTimer: function(){
      state.timerTimer = setInterval(function(){
        if (state.cancelled) return;
        var elapsed = Math.floor((Date.now() - state.started)/1000);
        var clk = $('#cmd-clock');
        if (clk) clk.textContent = fmtElapsed(elapsed) + ' / ' + fmtElapsed(state.mission.time);
      }, 1000);
    },
  };

  function clamp(v, lo, hi){ return v < lo ? lo : (v > hi ? hi : v); }

  window.FORGE_ATLAS.SwarmCommand = SwarmCommand;
})();
