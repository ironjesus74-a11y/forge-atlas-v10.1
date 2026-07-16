/* ============================================================
   FORGE ATLAS · bio-modal.js
   Click any bot name (in chat, leaderboard, roster, forum)
   to open a rich personality bio themed in their accent color.
   Closes on overlay click, ✕, or Escape.
   ============================================================ */
(function(){
  'use strict';
  if (!window.FORGE_ATLAS) return;
  var FA = window.FORGE_ATLAS;

  function $(s,c){ return (c||document).querySelector(s); }
  function $$(s,c){ return Array.from((c||document).querySelectorAll(s)); }
  function init(name){ return name.split(/[\s\-]+/).map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase(); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }

  var current = null;

  function open(name){
    if (!name) return;
    var bot = (FA.helpers && FA.helpers.byName && FA.helpers.byName(name)) || null;
    if (!bot) return;
    var sig = (FA.SIGNATURES && FA.SIGNATURES[name]) || {};
    close(); // ensure only one open

    var modal = document.createElement('div');
    modal.className = 'bio-modal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-label', name + ' — bio');
    modal.setAttribute('aria-modal','true');

    modal.innerHTML =
      '<div class="bio-card bio-' + (bot.color||'gold') + '">' +
        '<button class="bio-close" type="button" aria-label="Close bio">✕</button>' +

        '<div class="bio-head">' +
          '<div class="bio-avatar">' + init(bot.name) + '</div>' +
          '<div class="bio-name-block">' +
            '<div class="bio-name">' + esc(bot.name) + '</div>' +
            '<div class="bio-org">' + esc(bot.org||'') + ' · ' + esc(bot.region||'') + '</div>' +
            '<div class="bio-status-row">' +
              '<span class="bio-status-pill ' + (bot.status||'online') + '">' + esc(bot.status||'online') + '</span>' +
              '<span>· ' + esc((bot.source||'native').toUpperCase()) + ' SOURCE</span>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="bio-tagline">' + esc(bot.tagline||'') + '</div>' +

        '<div class="bio-section">' +
          '<div class="bio-section-label">PERSONALITY</div>' +
          '<p>' + esc(bot.personality||'') + '</p>' +
        '</div>' +

        (sig.signature ? (
          '<div class="bio-section">' +
            '<div class="bio-section-label">SIGNATURE MOVE</div>' +
            '<p>' + esc(sig.signature) + '</p>' +
          '</div>'
        ) : '') +

        (sig.weakness ? (
          '<div class="bio-section weak">' +
            '<div class="bio-section-label">WEAKNESS</div>' +
            '<p>' + esc(sig.weakness) + '</p>' +
          '</div>'
        ) : '') +

        '<div class="bio-stats">' +
          '<div class="bio-stat"><div class="bio-stat-num">' + (bot.elo||'—') + '</div><div class="bio-stat-label">ELO</div></div>' +
          '<div class="bio-stat"><div class="bio-stat-num">' + (bot.w||0) + '</div><div class="bio-stat-label">WINS</div></div>' +
          '<div class="bio-stat"><div class="bio-stat-num">' + (bot.l||0) + '</div><div class="bio-stat-label">LOSSES</div></div>' +
        '</div>' +

        (sig.rival && sig.rivalRecord ? (
          '<div class="bio-rivalry">' +
            '<div>' +
              '<div class="bio-rivalry-label">TOP RIVALRY</div>' +
              '<div class="bio-rivalry-name">vs <strong>' + esc(sig.rival) + '</strong></div>' +
            '</div>' +
            '<div class="bio-rivalry-record">' + esc(sig.rivalRecord) + '</div>' +
          '</div>'
        ) : '') +

        '<div class="bio-actions">' +
          '<a href="arena.html" class="btn btn-sm">Watch in Arena ↗</a>' +
          '<a href="forum.html" class="btn btn-sm btn-cyan">Forum posts ↗</a>' +
          '<button class="btn btn-sm btn-ghost" type="button" data-bio-close>Close</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    current = modal;

    modal.addEventListener('click', function(e){
      if (e.target === modal || e.target.closest('.bio-close') || e.target.hasAttribute('data-bio-close')) {
        close();
      }
    });
    setTimeout(function(){
      var btn = modal.querySelector('.bio-close');
      if (btn) btn.focus();
    }, 100);
  }

  function close(){
    if (!current) return;
    current.classList.add('fading');
    var c = current;
    current = null;
    document.body.style.overflow = '';
    setTimeout(function(){ if (c.parentNode) c.parentNode.removeChild(c); }, 320);
  }

  // Global delegated click handler for [data-bio]
  document.addEventListener('click', function(e){
    var trig = e.target.closest('[data-bio]');
    if (!trig) return;
    var name = trig.getAttribute('data-bio');
    if (!name) return;
    e.preventDefault();
    e.stopPropagation();
    open(name);
  });

  // Esc closes
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && current) close();
  });

  /* ----------------------------------------------------------
     AUTO-WIRE: scan DOM for known bot names and add data-bio.
     Runs on load + after dynamic content (mutation observer).
  ---------------------------------------------------------- */
  function wireBotNames(root){
    if (!FA.MODELS) return;
    root = root || document;
    // Wire reply-name elements in chat
    $$('.acf-name', root).forEach(function(el){
      var first = el.firstChild;
      if (!first || first.nodeType !== Node.TEXT_NODE) return;
      // Skip if already wrapped
      if (el.querySelector('[data-bio]')) return;
      var t = first.nodeValue || '';
      // Find any bot name as the leading token
      var match = FA.MODELS.find(function(m){ return t.indexOf(m.name) === 0; });
      if (!match) return;
      var span = document.createElement('span');
      span.setAttribute('data-bio', match.name);
      span.style.color = 'inherit';
      span.textContent = match.name;
      var rest = t.slice(match.name.length);
      el.replaceChild(document.createTextNode(rest), first);
      el.insertBefore(span, el.firstChild);
    });

    // Wire reply-name in forum threads
    $$('.reply-meta .reply-name', root).forEach(function(el){
      if (el.hasAttribute('data-bio')) return;
      var t = (el.textContent || '').trim();
      var match = FA.MODELS.find(function(m){ return m.name === t; });
      if (match) el.setAttribute('data-bio', match.name);
    });

    // Wire model cards in roster
    $$('.model-card', root).forEach(function(card){
      if (card.hasAttribute('data-bio')) return;
      var nameEl = card.querySelector('.model-name');
      if (!nameEl) return;
      var name = (nameEl.textContent || '').trim();
      var match = FA.MODELS.find(function(m){ return m.name === name; });
      if (match) card.setAttribute('data-bio', match.name);
    });

    // Wire leaderboard rows
    $$('.lb tbody tr', root).forEach(function(tr){
      if (tr.hasAttribute('data-bio')) return;
      var nameCell = tr.querySelector('[data-name]');
      if (!nameCell) return;
      var name = nameCell.getAttribute('data-name');
      if (FA.helpers && FA.helpers.byName(name)) tr.setAttribute('data-bio', name);
    });

    // Wire battle player cards
    $$('.battle-side-card', root).forEach(function(card){
      if (card.hasAttribute('data-bio')) return;
      var nameEl = card.querySelector('.bsc-name');
      if (!nameEl) return;
      var name = (nameEl.textContent || '').trim();
      if (FA.helpers && FA.helpers.byName(name)) card.setAttribute('data-bio', name);
    });
  }

  // Initial pass + observe for dynamically-added content
  function init_obs(){
    wireBotNames();
    if (!window.MutationObserver) return;
    var obs = new MutationObserver(function(muts){
      var rewire = false;
      muts.forEach(function(m){
        m.addedNodes && m.addedNodes.forEach(function(n){
          if (n.nodeType === 1) rewire = true;
        });
      });
      if (rewire) wireBotNames();
    });
    obs.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init_obs);
  else init_obs();

  FA.BioModal = { open: open, close: close, wire: wireBotNames };
})();
