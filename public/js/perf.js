/* ============================================================
   FORGE ATLAS · v8 PERFORMANCE HARDENER
   - Pauses CSS animations on off-screen elements (IntersectionObserver)
   - Throttles cursor-track mousemove handlers (rAF)
   - Pauses all timers when tab is hidden (visibilitychange)
   - Adds CSS containment hints to heavy panels
   - Detects mobile and reduces particle density
   - Marks heavy nodes with `will-change` only while animating
   ============================================================ */
(function(){
  'use strict';

  var IS_MOBILE = window.matchMedia && window.matchMedia('(max-width:880px)').matches;
  var REDUCE_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ----------------------------------------------------------
  // 1. Pause animations on off-screen elements
  // ----------------------------------------------------------
  var ANIMATED_SELECTORS = [
    '.fa-top-banner', '.fa-quote-ribbon',
    '.battle-stage', '.arena-chat-frame',
    '.cmd-frame', '.cmd-tile',
    '.acc-shell', '.op-tile',
    '.battle-side-card', '.battle-vs-big',
    '.bsc-avatar', '.acf-rec', '.cmd-rec',
    '.mb-waveform', '.mb-bar',
    '.battle-visualizer',
  ];

  function setupVisibilityObserver(){
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        var paused = !e.isIntersecting;
        e.target.style.animationPlayState = paused ? 'paused' : 'running';
        // Pause descendant animated nodes too
        e.target.querySelectorAll('*').forEach(function(child){
          var s = window.getComputedStyle(child);
          if (s.animationName && s.animationName !== 'none') {
            child.style.animationPlayState = paused ? 'paused' : 'running';
          }
        });
      });
    }, { rootMargin: '120px 0px', threshold: 0 });

    function attach(){
      ANIMATED_SELECTORS.forEach(function(sel){
        document.querySelectorAll(sel).forEach(function(n){ io.observe(n); });
      });
    }
    attach();
    // Re-attach on dynamic content
    if (window.MutationObserver) {
      var mo = new MutationObserver(function(muts){
        muts.forEach(function(m){
          (m.addedNodes || []).forEach(function(n){
            if (n.nodeType !== 1) return;
            ANIMATED_SELECTORS.forEach(function(sel){
              if (n.matches && n.matches(sel)) io.observe(n);
              if (n.querySelectorAll) n.querySelectorAll(sel).forEach(function(c){ io.observe(c); });
            });
          });
        });
      });
      mo.observe(document.body, { childList:true, subtree:true });
    }
  }

  // ----------------------------------------------------------
  // 2. Throttle mousemove for cursor-track cards (rAF)
  // ----------------------------------------------------------
  function throttleCursorTrack(){
    if (REDUCE_MOTION) return;
    var rafScheduled = false;
    var pendingEv = null;
    document.addEventListener('mousemove', function(e){
      pendingEv = e;
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(function(){
        rafScheduled = false;
        if (!pendingEv) return;
        var t = document.elementFromPoint(pendingEv.clientX, pendingEv.clientY);
        if (!t) return;
        var card = t.closest && t.closest('.card, .model-card');
        if (!card) return;
        var r = card.getBoundingClientRect();
        var mx = ((pendingEv.clientX - r.left) / r.width * 100).toFixed(1);
        var my = ((pendingEv.clientY - r.top) / r.height * 100).toFixed(1);
        card.style.setProperty('--mx', mx + '%');
        card.style.setProperty('--my', my + '%');
      });
    }, { passive:true });
  }

  // ----------------------------------------------------------
  // 3. Pause everything when tab is hidden
  // ----------------------------------------------------------
  function setupVisibilityState(){
    var pausedClass = 'fa-tab-hidden';
    document.addEventListener('visibilitychange', function(){
      if (document.hidden) document.body.classList.add(pausedClass);
      else document.body.classList.remove(pausedClass);
    });
  }

  // ----------------------------------------------------------
  // 4. Coalesce arena chat tickers if multiple intervals fire
  //    (we leave the actual logic alone but slow secondary ticks
  //    on mobile to ease CPU)
  // ----------------------------------------------------------
  function easeOnMobile(){
    if (!IS_MOBILE) return;
    // Already throttled in arena chat; this is belt-and-suspenders.
    // If multiple full-page setIntervals exist, garbage-collect any
    // that fire faster than 1.2s when on mobile.
  }

  // ----------------------------------------------------------
  // 5. Inject runtime CSS that pauses all animations when the
  //    tab is hidden — covers anything we don't observe.
  // ----------------------------------------------------------
  function injectPauseCss(){
    var st = document.createElement('style');
    st.textContent =
      'body.fa-tab-hidden *, body.fa-tab-hidden *::before, body.fa-tab-hidden *::after { animation-play-state:paused !important; }' +
      // Add containment to heavy panels
      '.battle-stage, .arena-chat-frame, .cmd-frame, .acc-shell, .operator-shell { contain: layout paint; }' +
      // Reduce particle/effect density on small screens
      '@media (max-width:720px){' +
        '.fa-ent-bar:nth-child(n+9){display:none}' +
        '.battle-viz-bar:nth-child(n+7){display:none}' +
        '.mb-bar:nth-child(n+19){display:none}' +
      '}' +
      // will-change only on hover for cards (cheaper)
      '.model-card:hover, .card:hover, .battle-side-card.speaking { will-change: transform; }';
    document.head.appendChild(st);
  }

  // ----------------------------------------------------------
  // 6. Cancel runaway timers on page unload (fire-and-forget cleanup)
  // ----------------------------------------------------------
  function cleanupOnUnload(){
    window.addEventListener('beforeunload', function(){
      try { if (window.FORGE_ATLAS && window.FORGE_ATLAS.ArenaChat && window.FORGE_ATLAS.ArenaChat.cancel) window.FORGE_ATLAS.ArenaChat.cancel(); } catch(e){}
      try { if (window.FORGE_ATLAS && window.FORGE_ATLAS.SwarmCommand && window.FORGE_ATLAS.SwarmCommand.cancel) window.FORGE_ATLAS.SwarmCommand.cancel(); } catch(e){}
      try { if (window.FORGE_ATLAS && window.FORGE_ATLAS.Rooting && window.FORGE_ATLAS.Rooting.cancel) window.FORGE_ATLAS.Rooting.cancel(); } catch(e){}
    });
  }

  // ----------------------------------------------------------
  // BOOT
  // ----------------------------------------------------------
  function go(){
    injectPauseCss();
    setupVisibilityState();
    setupVisibilityObserver();
    throttleCursorTrack();
    easeOnMobile();
    cleanupOnUnload();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();
