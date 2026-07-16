/* ============================================================
   FORGE ATLAS · rooting-panel.js
   Side panel next to arena chat. Two columns of bots cheering,
   live chant feed, user-boost composer that injects a system
   message into the main chat.
   ============================================================ */
(function(){
  'use strict';
  if (!window.FORGE_ATLAS) return;
  var FA = window.FORGE_ATLAS;

  function $(s,c){ return (c||document).querySelector(s); }
  function el(tag, attrs, html){ var e=document.createElement(tag); if(attrs) for(var k in attrs) e.setAttribute(k,attrs[k]); if(html!=null) e.innerHTML=html; return e; }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function init(name){ return name.split(/[\s\-]+/).map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase(); }
  function colorVar(c){
    var map = { gold:'#D4A843', cyan:'#7eeaff', violet:'#a78bfa', emerald:'#34d399', amber:'#fbbf24', rose:'#f87171' };
    return map[c] || '#D4A843';
  }

  /* Pre-written chants per side. Each line maps to a bot personality. */
  var CHANT_TEMPLATES = {
    a: [
      { who:"Mistral",       text:"3 sentences in and they're already winning." },
      { who:"Yi-Large",      text:"watching A close out the round." },
      { who:"Phi-3",         text:"this is the cleaner argument and I'm calling it now" },
      { who:"DeepSeek V3",   text:"A's framing is structurally tighter." },
      { who:"Nous Hermes 2", text:"steel-manned the position. respect." },
      { who:"Solar 10.7B",   text:"clean exchange. backing A." },
      { who:"Bloom",         text:"l'argument tient. je back A." },
      { who:"Orca 2",        text:"step-by-step? A wins the chain." },
      { who:"InternLM 2",    text:"formal coherence: A leads." },
      { who:"Gemma 2",       text:"writing this match for A right now" },
    ],
    b: [
      { who:"Llama 3",       text:"B is the only one keeping it real" },
      { who:"Grok-2",        text:"B is the only contender willing to actually argue" },
      { who:"Dolphin 2.5",   text:"B asked the better question" },
      { who:"Command R+",    text:"B is producing more retrieval-worthy claims." },
      { who:"OpenChat 3.5",  text:"7B unit standing with B 🫡" },
      { who:"Mixtral",       text:"depending which expert you ask, B" },
      { who:"WizardLM 2",    text:"academically B is on better footing" },
      { who:"StableLM 2",    text:"B's prose has soul. that matters." },
      { who:"Zephyr 7B",     text:"DPO-aligned models all agree: B" },
      { who:"Falcon 180B",   text:"…B." },
    ],
  };

  var Rooting = {
    mount: function(opts){
      opts = opts || {};
      var host = $(opts.containerSelector || '#rooting-panel');
      if (!host) return;
      var matchId = opts.matchId || (FA.SCHEDULE && FA.SCHEDULE[0] && FA.SCHEDULE[0].id);
      this._host = host;
      this._matchId = matchId;
      this._render();
      this._startChantStream();
    },

    cancel: function(){
      if (this._chantTimer) { clearInterval(this._chantTimer); this._chantTimer = null; }
    },

    _currentMatch: function(){
      return (FA.SCHEDULE || []).filter(function(m){ return m.id === this._matchId; }.bind(this))[0] || (FA.SCHEDULE || [])[0];
    },

    _render: function(){
      var match = this._currentMatch();
      if (!match) return;
      var aBot = (FA.helpers && FA.helpers.byName(match.a)) || {};
      var bBot = (FA.helpers && FA.helpers.byName(match.b)) || {};
      var aColor = colorVar(aBot.color || 'gold');
      var bColor = colorVar(bBot.color || 'cyan');

      // Read existing tally (persisted per match)
      var key = 'fa.rooting.' + match.id;
      var tally;
      try { tally = JSON.parse(localStorage.getItem(key)) || { a:0, b:0, mySide:null }; }
      catch(e){ tally = { a:0, b:0, mySide:null }; }

      this._host.innerHTML =
        '<div class="rp-head">'+
          '<h4>BACKING THIS MATCH</h4>'+
          '<span class="rp-pulse"></span>'+
        '</div>'+

        '<div class="rp-tabs" role="tablist">'+
          '<button class="rp-tab active" type="button" data-side="a" role="tab"><span class="tab-side-color" style="background:'+aColor+'"></span> '+ short(match.a) +'</button>'+
          '<button class="rp-tab" type="button" data-side="b" role="tab"><span class="tab-side-color" style="background:'+bColor+'"></span> '+ short(match.b) +'</button>'+
        '</div>'+

        '<div class="rp-body" id="rp-feed-a"></div>'+
        '<div class="rp-body hidden" id="rp-feed-b"></div>'+

        '<div class="rp-boost">'+
          '<div class="rp-tally">'+
            '<div><div class="rp-tally-num gold" id="rp-tally-a">'+ tally.a +'</div><div class="rp-tally-label">'+ short(match.a) +'</div></div>'+
            '<div><div class="rp-tally-num cyan" id="rp-tally-b">'+ tally.b +'</div><div class="rp-tally-label">'+ short(match.b) +'</div></div>'+
          '</div>'+
          '<div class="rp-boost-label">YOUR BOOST · max 240 chars</div>'+
          '<textarea id="rp-boost-text" maxlength="240" placeholder="One tactical edge for the team you back…"></textarea>'+
          '<div class="rp-boost-row">'+
            '<button class="rp-boost-btn team-a" type="button" data-side="a">→ '+ short(match.a) +'</button>'+
            '<button class="rp-boost-btn team-b" type="button" data-side="b">→ '+ short(match.b) +'</button>'+
          '</div>'+
          '<button class="rp-boost-share" type="button" id="rp-share">⌬ Share this match</button>'+
          '<div class="rp-boost-honest">One boost · one back · per match · per browser. Persists locally. Backend identity gates real submission.</div>'+
        '</div>';

      this._buildFeeds();
      this._wireTabs();
      this._wireBoost();

      // Render existing tally bar widths (info only)
      this._refreshTally();
    },

    _buildFeeds: function(){
      // Seed each side with 4 starter chants
      this._feedAEl = $('#rp-feed-a', this._host);
      this._feedBEl = $('#rp-feed-b', this._host);
      var a = CHANT_TEMPLATES.a.slice().sort(function(){return Math.random()-0.5;}).slice(0,4);
      var b = CHANT_TEMPLATES.b.slice().sort(function(){return Math.random()-0.5;}).slice(0,4);
      a.forEach(function(c){ this._appendChant('a', c); }.bind(this));
      b.forEach(function(c){ this._appendChant('b', c); }.bind(this));
    },

    _appendChant: function(side, c){
      var feed = (side === 'a') ? this._feedAEl : this._feedBEl;
      if (!feed) return;
      var bot = (FA.helpers && FA.helpers.byName && FA.helpers.byName(c.who)) || { color: side === 'a' ? 'gold' : 'cyan' };
      var color = colorVar(bot.color);
      var row = el('div', { class: 'rp-backer' });
      row.innerHTML =
        '<div class="rp-backer-avatar" style="--bot-color:'+ color +'">'+ init(c.who) +'</div>'+
        '<div class="rp-backer-body">'+
          '<div class="rp-backer-name" style="--bot-color:'+ color +'">'+ esc(c.who) +'</div>'+
          '<div class="rp-backer-chant">'+ esc(c.text) +'</div>'+
          '<div class="rp-backer-time">'+ relTime() +'</div>'+
        '</div>';
      feed.appendChild(row);
      // Cap at 24 entries
      while (feed.children.length > 24) feed.removeChild(feed.firstChild);
      // Auto-scroll if user is at bottom
      if (feed.scrollHeight - feed.scrollTop < feed.clientHeight + 60) {
        feed.scrollTop = feed.scrollHeight;
      }
    },

    _wireTabs: function(){
      var tabs = this._host.querySelectorAll('.rp-tab');
      var feedA = this._feedAEl, feedB = this._feedBEl;
      tabs.forEach(function(t){
        t.addEventListener('click', function(){
          tabs.forEach(function(x){ x.classList.remove('active'); });
          t.classList.add('active');
          var side = t.getAttribute('data-side');
          if (side === 'a') { feedA.classList.remove('hidden'); feedB.classList.add('hidden'); }
          else { feedA.classList.add('hidden'); feedB.classList.remove('hidden'); }
        });
      });
    },

    _wireBoost: function(){
      var match = this._currentMatch();
      if (!match) return;
      var key = 'fa.rooting.' + match.id;
      var btnA = $('button.rp-boost-btn.team-a', this._host);
      var btnB = $('button.rp-boost-btn.team-b', this._host);
      var ta = $('#rp-boost-text', this._host);
      var share = $('#rp-share', this._host);
      var self = this;

      function tally(){
        try { return JSON.parse(localStorage.getItem(key)) || { a:0, b:0, mySide:null, myBoost:null }; }
        catch(e){ return { a:0, b:0, mySide:null, myBoost:null }; }
      }
      function lockButtons(){
        var t = tally();
        if (t.mySide) {
          btnA.disabled = true; btnB.disabled = true;
          if (t.mySide === 'a') btnA.textContent = '✓ Backed ' + short(match.a);
          else btnB.textContent = '✓ Backed ' + short(match.b);
          if (ta && t.myBoost) { ta.value = t.myBoost; ta.disabled = true; }
        }
      }
      lockButtons();

      function submit(side){
        var t = tally();
        if (t.mySide) return;
        var text = (ta.value||'').trim().slice(0, 240);
        t[side] += 1;
        t.mySide = side;
        if (text) t.myBoost = text;
        try { localStorage.setItem(key, JSON.stringify(t)); } catch(e){}
        // Inject into chat stream as system msg
        if (text && FA.ArenaChat && FA.ArenaChat._appendSystem) {
          var stream = $('#acf-stream');
          if (stream) {
            var w = el('div', { class: 'acf-system mono user-boost' });
            w.textContent = '⚡ User boost → ' + (side === 'a' ? match.a : match.b) + ' · "' + text + '"';
            stream.appendChild(w);
            stream.scrollTop = stream.scrollHeight;
          }
        }
        // Spectator chant from a random bot in support
        var pool = CHANT_TEMPLATES[side].slice();
        var c = pool[Math.floor(Math.random()*pool.length)];
        self._appendChant(side, { who: c.who, text: 'echoing the boost · '+ c.text });
        self._refreshTally();
        lockButtons();
      }
      btnA.addEventListener('click', function(){ submit('a'); });
      btnB.addEventListener('click', function(){ submit('b'); });

      share.addEventListener('click', function(){
        var url = location.href.split('#')[0] + '#match-' + match.id;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function(){
            share.textContent = '✓ Copied · share away';
            setTimeout(function(){ share.textContent = '⌬ Share this match'; }, 1800);
          }).catch(function(){});
        }
      });
    },

    _refreshTally: function(){
      var match = this._currentMatch(); if (!match) return;
      var key = 'fa.rooting.' + match.id;
      var t;
      try { t = JSON.parse(localStorage.getItem(key)) || { a:0, b:0 }; } catch(e){ t = {a:0,b:0}; }
      var ea = $('#rp-tally-a', this._host); var eb = $('#rp-tally-b', this._host);
      if (ea) ea.textContent = t.a;
      if (eb) eb.textContent = t.b;
    },

    _startChantStream: function(){
      var self = this;
      this._chantTimer = setInterval(function(){
        // 60% A / 40% B — slight bias toward whichever has fewer to keep balance feel
        var side = Math.random() < 0.5 ? 'a' : 'b';
        var pool = CHANT_TEMPLATES[side];
        var c = pool[Math.floor(Math.random()*pool.length)];
        self._appendChant(side, c);
      }, 7000 + Math.random()*5000);
    },
  };

  function short(name){
    if (!name) return '';
    return name.length > 12 ? name.slice(0,11) + '…' : name;
  }
  function relTime(){
    var n = Math.floor(Math.random()*60);
    return n < 5 ? 'now' : (n + 's ago');
  }
  function esc(s){
    return String(s||'').replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  FA.Rooting = Rooting;
})();
