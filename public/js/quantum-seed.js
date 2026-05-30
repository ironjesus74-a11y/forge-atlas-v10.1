/* ============================================================
   Forge Atlas · quantum-seed.js
   Fetches a real quantum random number from /api/quantum-seed
   (ANU Quantum RNG via homodyne detection of vacuum fluctuations)
   and renders the animated widget on the Arena page.
   ============================================================ */
(function () {
  'use strict';

  var ENDPOINT = '/api/quantum-seed';
  var state = { loading: false, data: null };

  function mount(hostSelector) {
    var host = document.querySelector(hostSelector);
    if (!host) return;
    host.innerHTML = buildShell();
    fetch$1();

    var btn = host.querySelector('.qs-refresh');
    if (btn) btn.addEventListener('click', function () { fetch$1(); });
  }

  function buildShell() {
    return (
      '<div class="qs-panel qs-loading" id="qs-panel">' +
        '<div class="qs-scan"></div>' +
        '<div class="qs-header">' +
          '<div class="qs-glyph" aria-hidden="true">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="12" cy="12" r="3"/>' +
              '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>' +
            '</svg>' +
          '</div>' +
          '<div>' +
            '<div class="qs-title">Quantum Seed</div>' +
            '<div class="qs-subtitle" id="qs-subtitle">initializing…</div>' +
          '</div>' +
        '</div>' +
        '<div class="qs-grid">' +
          '<div class="qs-row">' +
            '<div class="qs-label">Qubit readout · 64 bits</div>' +
            '<div class="qs-bits" id="qs-bits">---- ---- ---- ---- ---- ---- ---- ----</div>' +
          '</div>' +
          '<div class="qs-row">' +
            '<div class="qs-label">Hex seed</div>' +
            '<div class="qs-hex" id="qs-hex">0x————————</div>' +
          '</div>' +
          '<div class="qs-row">' +
            '<div class="qs-label">Source</div>' +
            '<div class="qs-source" id="qs-source"><strong>connecting…</strong></div>' +
          '</div>' +
          '<div class="qs-row">' +
            '<div class="qs-label">Sampled at</div>' +
            '<div class="qs-timestamp" id="qs-timestamp">—</div>' +
          '</div>' +
        '</div>' +
        '<div class="qs-footer">' +
          '<div class="qs-status">' +
            '<div class="qs-dot" id="qs-dot"></div>' +
            '<span id="qs-status-text">awaiting quantum collapse</span>' +
          '</div>' +
          '<button class="qs-refresh" id="qs-refresh" disabled>New seed</button>' +
        '</div>' +
      '</div>'
    );
  }

  function fetch$1() {
    if (state.loading) return;
    state.loading = true;

    var panel = document.getElementById('qs-panel');
    var btn   = document.getElementById('qs-refresh');
    var sub   = document.getElementById('qs-subtitle');
    if (panel) panel.classList.add('qs-loading');
    if (btn)   btn.disabled = true;
    if (sub)   sub.textContent = 'collapsing wavefunction…';

    fetch(ENDPOINT)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        state.data = d;
        state.loading = false;
        render(d);
      })
      .catch(function () {
        state.loading = false;
        renderError();
      });
  }

  function render(d) {
    var panel = document.getElementById('qs-panel');
    if (panel) panel.classList.remove('qs-loading');

    var bitsEl  = document.getElementById('qs-bits');
    var hexEl   = document.getElementById('qs-hex');
    var srcEl   = document.getElementById('qs-source');
    var tsEl    = document.getElementById('qs-timestamp');
    var subEl   = document.getElementById('qs-subtitle');
    var dotEl   = document.getElementById('qs-dot');
    var stEl    = document.getElementById('qs-status-text');
    var btn     = document.getElementById('qs-refresh');

    if (bitsEl) animateBits(bitsEl, d.bits || '');
    if (hexEl)  hexEl.textContent = d.hex || '0x—';

    if (srcEl) {
      srcEl.innerHTML = '<strong>' + esc(d.source || 'unknown') + '</strong>' +
        (d.hardware ? ' &middot; ' + esc(d.hardware) : '') +
        '<br><span style="color:var(--muted-2);font-size:10px">' + esc(d.method || '') + '</span>';
    }

    if (tsEl && d.timestamp) {
      tsEl.textContent = new Date(d.timestamp).toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }

    if (subEl) {
      subEl.textContent = d.fallback
        ? 'CSPRNG fallback · ANU offline'
        : 'live · vacuum fluctuation';
    }

    if (dotEl) {
      dotEl.className = 'qs-dot' + (d.fallback ? ' fallback' : '');
    }
    if (stEl) {
      stEl.textContent = d.fallback
        ? 'CSPRNG · cryptographically secure'
        : 'quantum · physically guaranteed';
    }
    if (btn) btn.disabled = false;
  }

  function animateBits(el, bits) {
    el.innerHTML = '';
    var chars = bits.split('');
    chars.forEach(function (ch, i) {
      var span = document.createElement('span');
      span.className = ch === ' ' ? '' : 'qs-bit-char';
      span.style.animationDelay = (i * 18) + 'ms';
      span.textContent = ch;
      el.appendChild(span);
    });
  }

  function renderError() {
    var sub = document.getElementById('qs-subtitle');
    var btn = document.getElementById('qs-refresh');
    if (sub) sub.textContent = 'endpoint unavailable';
    if (btn) btn.disabled = false;
    var panel = document.getElementById('qs-panel');
    if (panel) panel.classList.remove('qs-loading');
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  if (!window.FORGE_ATLAS) window.FORGE_ATLAS = {};
  window.FORGE_ATLAS.QuantumSeed = { mount: mount };

  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('quantum-seed-host')) {
      mount('#quantum-seed-host');
    }
  });
})();
