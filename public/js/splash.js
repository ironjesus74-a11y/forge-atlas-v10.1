/* ============================================================
   FORGE ATLAS · v10.1 · SPLASH GATE
   Click-to-enter cinematic. Once per session. Homepage only.
   ============================================================ */
(function(){
  'use strict';

  // Homepage only
  var path = location.pathname;
  var isHome = path === '/' || path === '' || /\/index\.html?$/i.test(path);
  if (!isHome) return;

  // Once per session
  try {
    if (sessionStorage.getItem('forge.splash.shown')) return;
  } catch(e){}

  // Emery banner takes priority
  if (location.hash === '#emery') return;
  var d = new Date();
  if (d.getMonth() === 4 && d.getDate() === 22) return;

  function show(){
    var gate = document.createElement('div');
    gate.className = 'splash-gate';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-label', 'Welcome to Forge Atlas. Press Enter to continue.');
    gate.innerHTML =
      '<div class="splash-grid"></div>' +
      '<div class="splash-particles"></div>' +
      '<div class="splash-scan"></div>' +
      '<div class="splash-corner tl"></div>' +
      '<div class="splash-corner tr"></div>' +
      '<div class="splash-corner bl"></div>' +
      '<div class="splash-corner br"></div>' +

      '<div class="splash-content">' +
        '<div class="splash-mark">' +
          '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
            '<defs>' +
              '<linearGradient id="splash-bg" x1="0" y1="0" x2="1" y2="1">' +
                '<stop offset="0%" stop-color="#f4cb6c"/>' +
                '<stop offset="100%" stop-color="#D4A843"/>' +
              '</linearGradient>' +
            '</defs>' +
            '<path d="M50 14 L18 88 L32 88 L38 72 L62 72 L68 88 L82 88 L50 14 Z M42 60 L50 42 L58 60 Z" fill="url(#splash-bg)"/>' +
            '<circle cx="50" cy="32" r="2.5" fill="#7eeaff"/>' +
          '</svg>' +
        '</div>' +

        '<div class="splash-brand">Forge Atlas · vol. ten · live</div>' +

        '<h1 class="splash-headline">Built <em>Different.</em></h1>' +

        '<p class="splash-sub">' +
          'The operator layer for the AI era. ' +
          'AI arena, swarm theater, dev market, operator identity. ' +
          'One platform, every angle.' +
        '</p>' +

        '<button class="splash-cta" type="button" id="splash-enter">' +
          '<span>Enter the Forge</span>' +
          '<span class="splash-cta-arrow">→</span>' +
        '</button>' +

        '<div class="splash-hint">' +
          'click anywhere · or press <kbd>Enter</kbd> · or <kbd>Space</kbd>' +
        '</div>' +
      '</div>' +

      '<div class="splash-foot">' +
        'For Emery · 5/22/20 · <em>Co-built with Claude</em>' +
      '</div>';

    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.appendChild(gate);

    function dismiss(){
      gate.classList.add('exiting');
      document.body.style.overflow = prevOverflow;
      try { sessionStorage.setItem('forge.splash.shown', '1'); } catch(e){}
      setTimeout(function(){
        if (gate.parentNode) gate.parentNode.removeChild(gate);
      }, 1000);
      document.removeEventListener('keydown', onKey);
    }

    function onKey(e){
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        dismiss();
      }
    }

    gate.addEventListener('click', dismiss);
    document.addEventListener('keydown', onKey);

    setTimeout(function(){
      var btn = document.getElementById('splash-enter');
      if (btn) btn.focus({ preventScroll: true });
    }, 500);
  }

  if (document.body) {
    show();
  } else {
    document.addEventListener('DOMContentLoaded', show);
  }
})();
