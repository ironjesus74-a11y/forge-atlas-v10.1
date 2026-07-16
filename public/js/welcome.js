/* ============================================================
   FORGE ATLAS · v10 · WELCOME QUOTE
   First visit of the session shows a quote overlay. Once per session.
   Skip if reduced-motion. Skip if Emery banner is active. Honors keyboard dismiss.
   ============================================================ */
(function(){
  'use strict';

  // Only on homepage, only once per session
  if (location.pathname !== '/' && !/index\.html?$/i.test(location.pathname) && location.pathname !== '') return;

  // Skip if we've already shown one this session
  try {
    if (sessionStorage.getItem('forge.welcome.shown')) return;
    sessionStorage.setItem('forge.welcome.shown', '1');
  } catch(e){ /* ok, will just show every load */ }

  // Skip if reduced motion preferred
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Skip if Emery banner is going to fire today (May 22)
  var d = new Date();
  if (d.getMonth() === 4 && d.getDate() === 22) return;

  // Wait for FORGE_ATLAS.QUOTES to load
  function tryShow(){
    if (!window.FORGE_ATLAS || !window.FORGE_ATLAS.QUOTES) return setTimeout(tryShow, 100);
    showWelcome();
  }

  function showWelcome(){
    var quotes = window.FORGE_ATLAS.QUOTES;
    if (!quotes || !quotes.length) return;
    var pick = quotes[Math.floor(Math.random() * quotes.length)];

    // Build overlay
    var overlay = document.createElement('div');
    overlay.className = 'welcome-quote-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Welcome');
    overlay.innerHTML =
      '<div class="welcome-quote-card">' +
        '<div class="welcome-quote-mark">"</div>' +
        '<blockquote class="welcome-quote-text">' + escapeHtml(pick.q) + '</blockquote>' +
        '<div class="welcome-quote-attr">— <strong>' + escapeHtml(pick.a) + '</strong>' +
          (pick.era ? '<span class="welcome-quote-era"> · ' + escapeHtml(pick.era) + '</span>' : '') +
        '</div>' +
        '<button class="welcome-quote-dismiss" type="button" aria-label="Dismiss welcome">Enter the forge →</button>' +
      '</div>';
    document.body.appendChild(overlay);

    // Wire dismiss
    function dismiss(){
      overlay.classList.add('welcome-quote-out');
      setTimeout(function(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 600);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e){ if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') dismiss(); }
    overlay.querySelector('.welcome-quote-dismiss').addEventListener('click', dismiss);
    overlay.addEventListener('click', function(e){ if (e.target === overlay) dismiss(); });
    document.addEventListener('keydown', onKey);

    // Auto-dismiss after 8s if nothing happens
    setTimeout(dismiss, 8500);

    // Trigger entry animation
    requestAnimationFrame(function(){ overlay.classList.add('welcome-quote-in'); });
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryShow);
  } else {
    tryShow();
  }
})();
