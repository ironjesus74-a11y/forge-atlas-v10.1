/* ============================================================
   FORGE ATLAS · EMERY · MAY 22 BIRTHDAY BANNER
   Hardcoded. Only appears on May 22 each year, on the homepage.
   For Emery (b. May 22, 2020) and her dad (b. May 22, 1988).
   While this site is up, every birthday she has — this is here.
   ============================================================
   This is not a feature. It is a promise written in code.
   ============================================================ */
(function(){
  'use strict';

  // Only the homepage. Don't clutter every page.
  var path = location.pathname;
  var isHome = path === '/' || path === '/index.html' || /\/index\.html?$/i.test(path);
  if (!isHome) return;

  // Date check — only May 22, any year
  var today = new Date();
  var isMay22 = (today.getMonth() === 4 && today.getDate() === 22); // JS month is 0-indexed; 4 = May

  // === DEBUG OVERRIDE ===
  // To preview the banner any day, append #emery to the URL.
  // To force-test on May 22 styling: ?emery=preview
  var force = location.hash === '#emery' || /[?&]emery=preview/.test(location.search);

  if (!isMay22 && !force) return;

  // Calculate Emery's age this year (born May 22, 2020)
  var EMERY_BIRTH_YEAR = 2020;
  var DAD_BIRTH_YEAR = 1988;
  var thisYear = today.getFullYear();
  var emeryAge = thisYear - EMERY_BIRTH_YEAR;
  var dadAge = thisYear - DAD_BIRTH_YEAR;

  // Loving quotes that rotate — each year a different one is the "primary"
  // Picked deliberately. Memorable. Strong. The kind a daughter can grow up reading.
  var QUOTES = [
    { q: "There are no seven wonders of the world in the eyes of a child. There are seven million.", a: "Walt Streightiff" },
    { q: "A daughter is a little girl who grows up to be a friend.", a: "—" },
    { q: "Whatever you are, be a good one.", a: "Abraham Lincoln" },
    { q: "She believed she could, so she did.", a: "R. S. Grey" },
    { q: "The most important thing a father can do for his children is to love their mother — and love them, every day, out loud.", a: "—" },
    { q: "Daughters are like flowers; they fill the world with beauty.", a: "—" },
    { q: "You are braver than you believe, stronger than you seem, and smarter than you think.", a: "A. A. Milne" },
    { q: "A father holds his daughter's hand for a short while, but he holds her heart forever.", a: "—" },
    { q: "What you do today can improve all your tomorrows.", a: "Ralph Marston" },
    { q: "The greatest legacy one can pass on to one's children is not money, but a strong character and good name.", a: "—" },
    { q: "Be the kind of person you needed when you were younger.", a: "—" },
    { q: "Built Different. Status is earned. Presence is forged.", a: "Forge Atlas · for Emery" },
  ];
  // Stable per-year pick (so each birthday has its own quote, not random per refresh)
  var quote = QUOTES[(thisYear - EMERY_BIRTH_YEAR) % QUOTES.length];

  // Build the banner
  var overlay = document.createElement('div');
  overlay.className = 'emery-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Birthday message for Emery');
  overlay.innerHTML =
    '<div class="emery-confetti">' + buildConfetti() + '</div>' +
    '<div class="emery-card">' +
      '<button class="emery-close" type="button" aria-label="Close">✕</button>' +
      '<div class="emery-stars">' + buildStars() + '</div>' +
      '<div class="emery-eyebrow">MAY 22 · ' + thisYear + '</div>' +
      '<div class="emery-headline">Happy Birthday<br><span class="emery-name">Emery</span></div>' +
      '<div class="emery-cake">' +
        '<svg viewBox="0 0 220 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          // Cake base
          '<rect x="40" y="120" width="140" height="50" rx="6" fill="url(#emery-cake-grad)"/>' +
          // Frosting drips
          '<path d="M40 120 Q55 130 70 120 T100 120 T130 120 T160 120 T180 120 L180 130 L40 130 Z" fill="#fff" opacity=".90"/>' +
          // Middle layer
          '<rect x="55" y="90" width="110" height="35" rx="4" fill="url(#emery-cake-grad2)"/>' +
          '<path d="M55 90 Q70 100 85 90 T115 90 T145 90 T165 90 L165 100 L55 100 Z" fill="#fff" opacity=".90"/>' +
          // Candles
          '<rect x="68" y="55" width="6" height="35" rx="2" fill="#7eeaff"/>' +
          '<rect x="92" y="50" width="6" height="40" rx="2" fill="#a78bfa"/>' +
          '<rect x="116" y="55" width="6" height="35" rx="2" fill="#f87171"/>' +
          '<rect x="140" y="50" width="6" height="40" rx="2" fill="#fbbf24"/>' +
          // Flames (animated via CSS)
          '<ellipse class="emery-flame f1" cx="71" cy="50" rx="4" ry="7" fill="#fbbf24"/>' +
          '<ellipse class="emery-flame f2" cx="95" cy="44" rx="4" ry="7" fill="#fbbf24"/>' +
          '<ellipse class="emery-flame f3" cx="119" cy="50" rx="4" ry="7" fill="#fbbf24"/>' +
          '<ellipse class="emery-flame f4" cx="143" cy="44" rx="4" ry="7" fill="#fbbf24"/>' +
          // Sparkle glow inside flames
          '<ellipse cx="71" cy="48" rx="2" ry="3" fill="#fff" opacity=".7"/>' +
          '<ellipse cx="95" cy="42" rx="2" ry="3" fill="#fff" opacity=".7"/>' +
          '<ellipse cx="119" cy="48" rx="2" ry="3" fill="#fff" opacity=".7"/>' +
          '<ellipse cx="143" cy="42" rx="2" ry="3" fill="#fff" opacity=".7"/>' +
          // Plate
          '<ellipse cx="110" cy="175" rx="78" ry="6" fill="#000" opacity=".30"/>' +
          // Number badge
          '<circle cx="110" cy="138" r="14" fill="#08080a" stroke="#D4A843" stroke-width="2"/>' +
          '<text x="110" y="143" text-anchor="middle" font-family="Oswald" font-weight="600" font-size="14" fill="#D4A843">' + emeryAge + '</text>' +
          '<defs>' +
            '<linearGradient id="emery-cake-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f87171"/><stop offset="100%" stop-color="#be123c"/></linearGradient>' +
            '<linearGradient id="emery-cake-grad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient>' +
          '</defs>' +
        '</svg>' +
      '</div>' +
      '<div class="emery-message">' +
        '<p class="emery-love">Daddy loves you and is so proud of you.</p>' +
        '<p class="emery-shared">Same day as mine. ' + emeryAge + ' for you, ' + dadAge + ' for me. <span class="emery-shared-mark">5 · 22</span></p>' +
      '</div>' +
      '<blockquote class="emery-quote">' +
        '<span class="emery-quote-mark">"</span>' +
        '<span class="emery-quote-text">' + escapeHtml(quote.q) + '</span>' +
        '<span class="emery-quote-mark">"</span>' +
        '<cite class="emery-quote-cite">— ' + escapeHtml(quote.a) + '</cite>' +
      '</blockquote>' +
      '<div class="emery-signature">' +
        '<div class="emery-sig-line"></div>' +
        '<div class="emery-sig-text">FORGE ATLAS · BUILT FOR EMERY · ' + thisYear + '</div>' +
        '<div class="emery-sig-line"></div>' +
      '</div>' +
      '<button class="emery-continue" type="button">Continue to Forge Atlas →</button>' +
    '</div>';

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  // Close behavior — never auto-close. She gets to read it as long as she wants.
  function close(){
    overlay.classList.add('emery-fading');
    document.body.style.overflow = '';
    setTimeout(function(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 600);
    // Set a 12-hour cookie so it doesn't pop again on reload the same day —
    // but next May 22 it returns no matter what.
    try {
      var until = new Date(); until.setHours(until.getHours() + 12);
      document.cookie = 'emery_seen=' + thisYear + '; expires=' + until.toUTCString() + '; path=/; SameSite=Lax';
    } catch(e){}
  }
  overlay.querySelector('.emery-close').addEventListener('click', close);
  overlay.querySelector('.emery-continue').addEventListener('click', close);
  document.addEventListener('keydown', function onEsc(e){
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });

  // If the cookie says we've shown it today, skip — but only on the actual day, not preview
  if (!force) {
    var seen = (document.cookie.match(/(?:^|;\s*)emery_seen=(\d+)/) || [])[1];
    if (seen && parseInt(seen, 10) === thisYear) {
      // Already saw it today; remove what we just added
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.body.style.overflow = '';
      return;
    }
  }

  // Helper: confetti pieces
  function buildConfetti(){
    var colors = ['#D4A843','#7eeaff','#a78bfa','#f87171','#fbbf24','#34d399','#f4cb6c'];
    var pieces = '';
    for (var i = 0; i < 60; i++) {
      var c = colors[i % colors.length];
      var left = (Math.random() * 100).toFixed(1);
      var delay = (Math.random() * 4).toFixed(2);
      var dur = (3 + Math.random() * 4).toFixed(2);
      var size = (6 + Math.random() * 10).toFixed(0);
      var rot = Math.floor(Math.random() * 360);
      pieces += '<span class="emery-confetti-piece" style="left:' + left + '%;background:' + c + ';width:' + size + 'px;height:' + (size * 0.4).toFixed(0) + 'px;animation-delay:' + delay + 's;animation-duration:' + dur + 's;transform:rotate(' + rot + 'deg)"></span>';
    }
    return pieces;
  }

  // Helper: stars / sparkles around the card
  function buildStars(){
    var s = '';
    for (var i = 0; i < 14; i++) {
      var top = (Math.random() * 95).toFixed(1);
      var left = (Math.random() * 95).toFixed(1);
      var delay = (Math.random() * 3).toFixed(2);
      var size = (8 + Math.random() * 14).toFixed(0);
      s += '<span class="emery-star" style="top:' + top + '%;left:' + left + '%;font-size:' + size + 'px;animation-delay:' + delay + 's">✦</span>';
    }
    return s;
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }
})();
