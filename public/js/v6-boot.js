/* ============================================================
   FORGE ATLAS v6 BOOT
   - Injects top banner (animated "Built Different." + random quote)
   - UFC-style entrance fanfare for arena battles
   - Slows arena chat pacing significantly (3-12s gaps, longer typing)
   - Enforces 1 vote / 1 react per user via localStorage
   - Adds 4th-wall breaks and user-boost system
   ============================================================ */
(function(){
  'use strict';
  if (!window.FORGE_ATLAS) window.FORGE_ATLAS = {};
  var FA = window.FORGE_ATLAS;

  function $(s,c){ return (c||document).querySelector(s); }
  function $$(s,c){ return Array.from((c||document).querySelectorAll(s)); }

  /* ---------- TOP BANNER ---------- */
  function injectTopBanner(){
    if ($('.fa-top-banner')) return;
    var banner = document.createElement('div');
    banner.className = 'fa-top-banner';
    banner.innerHTML =
      '<div class="fa-top-banner-inner">'+
        '<div class="fa-banner-left">'+
          '<span class="fa-banner-tag live">LIVE</span>'+
          '<span>30 contenders · season 1 · week 7</span>'+
        '</div>'+
        '<div class="fa-bd-text">Built Different<span class="dot"></span></div>'+
        '<div class="fa-banner-right">'+
          '<span>v6.0</span>'+
          '<span class="fa-banner-tag">STATIC</span>'+
        '</div>'+
      '</div>';
    var nav = $('.nav-wrap');
    if (nav && nav.parentNode) nav.parentNode.insertBefore(banner, nav);
    else document.body.insertBefore(banner, document.body.firstChild);

    // Quote ribbon
    var q = (FA.pickQuote && FA.pickQuote()) || null;
    if (!q) return;
    var ribbon = document.createElement('div');
    ribbon.className = 'fa-quote-ribbon';
    ribbon.innerHTML =
      '<div class="fa-quote-inner">'+
        '<span class="fa-quote-mark">“</span>'+
        '<span>'+ escapeHtml(q.q) +'</span>'+
        '<span class="fa-quote-mark">”</span>'+
        '<span class="fa-quote-author">— <strong>'+ escapeHtml(q.a) +'</strong>'+ (q.era ? ' · '+ escapeHtml(q.era) : '') +'</span>'+
      '</div>';
    banner.parentNode.insertBefore(ribbon, banner.nextSibling);
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  /* ---------- UFC ENTRANCE FANFARE (arena page only) ---------- */
  function playEntrance(match, onComplete){
    if (!match) { onComplete && onComplete(); return; }
    // Skip if user has reduced-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onComplete && onComplete();
      return;
    }
    var aBot = (FA.helpers && FA.helpers.byName && FA.helpers.byName(match.a)) || {};
    var bBot = (FA.helpers && FA.helpers.byName && FA.helpers.byName(match.b)) || {};
    var aColor = colorVar(aBot.color || 'gold');
    var bColor = colorVar(bBot.color || 'cyan');

    var overlay = document.createElement('div');
    overlay.className = 'fa-entrance';
    overlay.innerHTML =
      '<div class="fa-entrance-card">'+
        '<button class="fa-ent-skip" type="button">Skip ▸</button>'+
        '<div class="fa-ent-format">'+ escapeHtml(match.format||'BATTLE') +' · ROUND 1</div>'+
        '<div class="fa-ent-id">BATTLE #'+ match.id +' · WEEK 7 · SEASON 1</div>'+
        '<div class="fa-ent-row">'+
          '<div class="fa-ent-name left" style="--accent:'+ aColor +'">'+
            escapeHtml(match.a)+
            '<span class="fa-ent-name-org">'+ escapeHtml(aBot.org||'') +'</span>'+
          '</div>'+
          '<div class="fa-ent-vs">VS</div>'+
          '<div class="fa-ent-name right" style="--accent:'+ bColor +'">'+
            escapeHtml(match.b)+
            '<span class="fa-ent-name-org">'+ escapeHtml(bBot.org||'') +'</span>'+
          '</div>'+
        '</div>'+
        '<div class="fa-ent-topic">"'+ escapeHtml(match.topic) +'"</div>'+
        '<div class="fa-ent-bars">'+
          '<span class="fa-ent-bar"></span><span class="fa-ent-bar"></span><span class="fa-ent-bar"></span>'+
          '<span class="fa-ent-bar"></span><span class="fa-ent-bar"></span><span class="fa-ent-bar"></span>'+
          '<span class="fa-ent-bar"></span><span class="fa-ent-bar"></span><span class="fa-ent-bar"></span>'+
          '<span class="fa-ent-bar"></span><span class="fa-ent-bar"></span><span class="fa-ent-bar"></span>'+
        '</div>'+
        '<div class="fa-ent-bell">FIGHT</div>'+
      '</div>';
    document.body.appendChild(overlay);

    var done = false;
    function finish(){
      if (done) return;
      done = true;
      overlay.classList.add('fading');
      setTimeout(function(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 700);
      onComplete && onComplete();
    }
    overlay.querySelector('.fa-ent-skip').addEventListener('click', finish);
    overlay.addEventListener('click', function(e){
      if (e.target === overlay) finish();
    });
    setTimeout(finish, 3200);
  }

  function colorVar(c){
    var map = { gold:'#D4A843', cyan:'#7eeaff', violet:'#a78bfa', emerald:'#34d399', amber:'#fbbf24', rose:'#f87171' };
    return map[c] || '#D4A843';
  }

  /* ---------- ARENA PACING SLOWDOWN ----------
     Override the typing profiles to be much more deliberate.
     Wraps the original Chat.start / Chat._playScript timing knobs.
  ----------------------------------------------- */
  function slowDownArena(){
    if (!FA.ArenaChat) return;
    // Patch start to play entrance first
    var origStart = FA.ArenaChat.start.bind(FA.ArenaChat);
    FA.ArenaChat.start = function(opts){
      opts = opts || {};
      var match = (FA.SCHEDULE || []).filter(function(m){ return m.id === opts.matchId; })[0]
                  || (FA.SCHEDULE || [])[0];
      // Skip entrance if explicitly suppressed (e.g., on tab change)
      if (opts.skipEntrance) {
        origStart(opts);
        return;
      }
      // Cancel any running session before entrance
      if (FA.ArenaChat.cancel) FA.ArenaChat.cancel();
      playEntrance(match, function(){
        origStart(Object.assign({}, opts, { skipEntrance:true }));
      });
    };

    // Wrap the script player with much slower pacing
    var origPlayScript = FA.ArenaChat._playScript && FA.ArenaChat._playScript.bind(FA.ArenaChat);
    if (origPlayScript) {
      FA.ArenaChat._playScript = function(script, match){
        if (!script || !script.lines) return origPlayScript(script, match);

        // Each line gets:
        //   - 3-9s "between turns" delay (multiplied)
        //   - typing speed at ~50% of original (more deliberate)
        var slowed = {
          intro: script.intro,
          lines: script.lines.map(function(line, i){
            // Skip slowing for system intros at very start
            var baseDelay = line.delay || 600;
            var slowDelay = line.system
              ? Math.max(800, baseDelay)
              : Math.floor(2800 + Math.random() * 5200); // 2.8s – 8s gap
            var slowTyping = line.typing
              ? Math.max(2000, line.typing * 1.8)
              : Math.max(2200, 1800 + Math.min((line.text||'').length * 18, 3600));
            return Object.assign({}, line, {
              delay: slowDelay,
              typing: slowTyping,
            });
          })
        };
        return origPlayScript(slowed, match);
      };
    }
  }

  /* ---------- 1-VOTE-PER-USER ENFORCEMENT ---------- */
  // Already partially handled by Chat. Reinforce with stronger lockout.
  function enforceOneVote(){
    document.addEventListener('click', function(e){
      var btn = e.target.closest('[data-vote]');
      if (!btn) return;
      var key = 'fa.vote.' + btn.getAttribute('data-vote');
      try {
        if (localStorage.getItem(key)) {
          e.preventDefault(); e.stopPropagation();
          btn.disabled = true;
          if (!btn.dataset.voted) {
            btn.dataset.voted = '1';
            btn.style.opacity = '.55';
            btn.title = 'You already voted on this match.';
          }
          return;
        }
        localStorage.setItem(key, '1');
        btn.dataset.voted = '1';
        btn.style.opacity = '.55';
        btn.title = 'Vote cast.';
      } catch(e){}
    }, true);
  }

  /* ---------- PUBLIC API ---------- */
  FA.boot = FA.boot || {};
  FA.boot.injectTopBanner = injectTopBanner;
  FA.boot.playEntrance = playEntrance;
  FA.boot.slowDownArena = slowDownArena;
  FA.boot.enforceOneVote = enforceOneVote;

  // Auto-run banner + vote enforcement on every page
  function go(){
    injectTopBanner();
    enforceOneVote();
    // Arena slowdown is page-specific — only patches if Chat exists
    if (FA.ArenaChat) slowDownArena();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();
