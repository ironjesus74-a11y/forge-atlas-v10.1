/* ============================================================
   FORGE ATLAS · v10 · ATLAS ID BUILDER
   Card builder. Avatar uploader. Identicon generator. Badges.
   Theme picker. Showcase. Export/import (portable identity).
   ============================================================ */
(function(){
  'use strict';
  if (!window.FORGE_ATLAS) window.FORGE_ATLAS = {};
  var FA = window.FORGE_ATLAS;
  if (!FA.Forum || !FA.Forum.Identity) return; // requires forum engine

  function $(s,r){ return (r||document).querySelector(s); }
  function $$(s,r){ return Array.from((r||document).querySelectorAll(s)); }
  function esc(s){
    return String(s||'').replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  /* ----------------------------------------------------------
     THEMES
  ---------------------------------------------------------- */
  var THEMES = [
    { id:'gold',    name:'Forge Gold',    color:'#D4A843' },
    { id:'cyan',    name:'Operator Cyan', color:'#7eeaff' },
    { id:'violet',  name:'Strategist',    color:'#a78bfa' },
    { id:'emerald', name:'Builder',       color:'#34d399' },
    { id:'amber',   name:'Tactician',     color:'#fbbf24' },
    { id:'rose',    name:'Closer',        color:'#f87171' },
  ];

  /* ----------------------------------------------------------
     BADGES — earned via activity, with unlock conditions
  ---------------------------------------------------------- */
  var BADGES = [
    // common — earned by just showing up
    { id:'first-thread', glyph:'✎', name:'first thread',   tier:'common',    unlock:function(p){ return (p.stats.threads||0) >= 1; } },
    { id:'first-reply',  glyph:'⇇', name:'first reply',    tier:'common',    unlock:function(p){ return (p.stats.replies||0) >= 1; } },
    { id:'ten-replies',  glyph:'≡', name:'ten replies',    tier:'common',    unlock:function(p){ return (p.stats.replies||0) >= 10; } },
    { id:'arena',        glyph:'⚔', name:'arena watcher',  tier:'common',    unlock:function(){ return getLocalCount('forge.arena.matches.watched') >= 3; } },
    { id:'swarm',        glyph:'◈', name:'swarm tactician',tier:'common',    unlock:function(){ return getLocalCount('forge.swarm.battles.watched') >= 3; } },
    // rare — meaningful milestones
    { id:'helpful',      glyph:'★', name:'helpful \xb7 x5',   tier:'rare',      unlock:function(p){ return (p.stats.helpful||0) >= 5; } },
    { id:'early',        glyph:'◐', name:'early operator', tier:'rare',      unlock:function(p){ return p.joined && p.joined < Date.parse('2026-07-01'); } },
    { id:'fight-judge',  glyph:'⚖', name:'fight judge',    tier:'rare',      unlock:function(){ return getLocalCount('forge.challenge.votes') >= 5; } },
    // legendary — elite status, animated on the card
    { id:'rescuer',      glyph:'⚡', name:'rescuer',        tier:'legendary', unlock:function(p){ return (p.stats.helpful||0) >= 20; } },
    { id:'slug-fest',    glyph:'✦', name:'slug fest \xb7 20', tier:'legendary', unlock:function(){ return getLocalCount('forge.challenge.votes') >= 20; } },
    { id:'veteran',      glyph:'◑', name:'90-day veteran', tier:'legendary', unlock:function(p){ return p.joined && (Date.now() - p.joined) > 90 * 24 * 60 * 60 * 1000; } },
    { id:'founder',      glyph:'◆', name:'founder class',  tier:'legendary', unlock:function(p){ return p.rank === 'founder'; } },
  ];
  function getLocalCount(key){
    try { return parseInt(localStorage.getItem(key) || '0', 10); } catch(e){ return 0; }
  }

  /* ----------------------------------------------------------
     RANK PROGRESS
  ---------------------------------------------------------- */
  function rankProgress(profile){
    var total = (profile.stats.threads||0)*3 + (profile.stats.replies||0) + (profile.stats.helpful||0)*2;
    var bands = [
      { rank:'initiate',  next:'operator',    floor:0,   cap:5 },
      { rank:'operator',  next:'architect',   floor:5,   cap:20 },
      { rank:'architect', next:'strategist',  floor:20,  cap:50 },
      { rank:'strategist',next:'founder',     floor:50,  cap:100 },
      { rank:'founder',   next:null,          floor:100, cap:100 },
    ];
    var band = bands.find(function(b){ return profile.rank === b.rank; }) || bands[0];
    var pct = band.next ? Math.min(100, ((total - band.floor) / (band.cap - band.floor)) * 100) : 100;
    var remain = band.next ? Math.max(0, band.cap - total) : 0;
    return {
      total: total,
      pct: pct,
      next: band.next,
      remain: remain,
    };
  }

  /* ----------------------------------------------------------
     IDENTICON · same algo as forum engine
  ---------------------------------------------------------- */
  function identicon(seed){
    var h = 0;
    for (var i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    var abs = Math.abs(h);
    var hue = abs % 360;
    var sat = 50 + (abs >> 8) % 40;
    var lit = 45 + (abs >> 16) % 15;
    var bg = 'hsl(' + hue + ',' + sat + '%,' + lit + '%)';
    var bg2 = 'hsl(' + ((hue + 40) % 360) + ',' + sat + '%,' + (lit - 10) + '%)';
    var cells = '';
    for (var y = 0; y < 5; y++) {
      for (var x = 0; x < 3; x++) {
        var on = (abs >> (y * 3 + x)) & 1;
        if (on) {
          var col = x;
          var mirror = 4 - x;
          cells += '<rect x="' + (col*20+10) + '" y="' + (y*20+10) + '" width="20" height="20" fill="#ffffffaa"/>';
          if (mirror !== col) cells += '<rect x="' + (mirror*20+10) + '" y="' + (y*20+10) + '" width="20" height="20" fill="#ffffffaa"/>';
        }
      }
    }
    return '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="ig'+abs+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="'+bg+'"/><stop offset="100%" stop-color="'+bg2+'"/></linearGradient></defs>' +
      '<rect width="120" height="120" fill="url(#ig'+abs+')"/>' +
      cells +
    '</svg>';
  }

  /* ----------------------------------------------------------
     CARD RENDER
  ---------------------------------------------------------- */
  function renderCard(profile, host){
    var theme = THEMES.find(function(t){ return t.id === (profile.theme||'gold'); }) || THEMES[0];
    var progress = rankProgress(profile);
    var earnedBadges = BADGES.filter(function(b){
      if (profile.selectedBadges && profile.selectedBadges.indexOf(b.id) >= 0) return true;
      return false;
    });
    // First: ensure selected badges are still unlocked
    earnedBadges = earnedBadges.filter(function(b){ return b.unlock(profile); });

    var avatarInner;
    if (profile.avatar && profile.avatar.indexOf('data:') === 0) {
      avatarInner = '<img src="' + esc(profile.avatar) + '" alt="">';
    } else if (profile.avatar && profile.avatar.indexOf('identicon:') === 0) {
      avatarInner = identicon(profile.avatar.slice(10));
    } else {
      avatarInner = identicon(profile.callsign || 'unknown');
    }

    host.innerHTML =
      '<div class="id-card" data-rank="' + esc(profile.rank || 'initiate') + '" style="--card-accent:' + esc(theme.color) + '">' +
        '<div class="id-card-head">' +
          '<div class="id-card-avatar-frame' + (profile.rank === 'founder' ? ' ultra-radiant' : '') + '">' +
            '<div class="id-card-avatar-inner">' + avatarInner + '</div>' +
          '</div>' +
          '<div class="id-card-name-block">' +
            '<h2 class="id-card-callsign">' + esc(profile.callsign || 'Unnamed') + '</h2>' +
            '<div class="id-card-rank-row">' +
              '<span class="rank-pip" data-rank="' + esc(profile.rank) + '"></span>' +
              '<span class="id-card-rank-label">' + FA.Forum.Identity.rankLabel(profile.rank) + '</span>' +
              (progress.next ? '<span class="id-card-rank-progress-mini">\xb7 ' + progress.remain + ' to ' + progress.next + '</span>' : '<span class="id-card-rank-progress-mini">\xb7 max rank</span>') +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="id-card-body">' +
          '<div class="id-card-row">' +
            '<div class="id-card-row-label">archetype</div>' +
            '<div class="id-card-row-value">' + esc(profile.archetype || 'Operator') + '</div>' +
          '</div>' +
          '<div class="id-card-row">' +
            '<div class="id-card-row-label">bio</div>' +
            '<div class="id-card-row-value" style="font-style:italic;font-weight:400">' + esc(profile.bio || 'Built different.') + '</div>' +
          '</div>' +
          '<div class="id-card-row">' +
            '<div class="id-card-row-label">joined</div>' +
            '<div class="id-card-row-value">' + new Date(profile.joined||Date.now()).toLocaleDateString('en-US', {year:'numeric', month:'short'}) + '</div>' +
          '</div>' +
        '</div>' +

        (earnedBadges.length ? '<div class="id-card-badges">' +
          earnedBadges.map(function(b){
            return '<span class="id-card-badge tier-' + (b.tier || 'common') + '"><span class="glyph">' + b.glyph + '</span>' + esc(b.name) + '</span>';
          }).join('') +
        '</div>' : '') +

        '<div class="id-card-stats">' +
          '<div class="id-card-stat"><div class="id-card-stat-num">' + (profile.stats.threads||0) + '</div><div class="id-card-stat-label">threads</div></div>' +
          '<div class="id-card-stat"><div class="id-card-stat-num">' + (profile.stats.replies||0) + '</div><div class="id-card-stat-label">replies</div></div>' +
          '<div class="id-card-stat"><div class="id-card-stat-num">' + (profile.stats.helpful||0) + '</div><div class="id-card-stat-label">helpful</div></div>' +
        '</div>' +

        (progress.next ? '<div class="id-card-progress">' +
          '<div class="id-card-progress-bar"><div class="id-card-progress-fill" style="width:' + progress.pct.toFixed(0) + '%"></div></div>' +
          '<div class="id-card-progress-meta"><span>to ' + esc(progress.next) + '</span><span>' + progress.pct.toFixed(0) + '%</span></div>' +
        '</div>' : '') +
      '</div>';
  }

  /* ----------------------------------------------------------
     BUILDER RENDER
  ---------------------------------------------------------- */
  function renderBuilder(profile, host, onChange){

    function update(patch){
      Object.assign(profile, patch);
      profile.guest = false; // any modification claims the profile
      FA.Forum.Identity.save(profile);
      if (onChange) onChange(profile);
    }

    host.innerHTML = '' +
      // Section 1: callsign + archetype + bio
      '<div class="builder-section">' +
        '<div class="builder-section-head">' +
          '<div class="builder-section-title">Identity</div>' +
          '<div class="builder-section-num">\xa7 1</div>' +
        '</div>' +
        '<label for="b-callsign">Callsign</label>' +
        '<input type="text" id="b-callsign" maxlength="32" value="' + esc(profile.callsign||'') + '" placeholder="Operator-XYZ">' +
        '<label for="b-archetype">Archetype</label>' +
        '<select id="b-archetype">' +
          ['Builder','Prompt Engineer','Automation Operator','Market Scout','Arena Analyst','Swarm Commander','Product Architect','Redteam Strategist'].map(function(a){
            return '<option' + (profile.archetype === a ? ' selected' : '') + '>' + esc(a) + '</option>';
          }).join('') +
        '</select>' +
        '<label for="b-bio">Bio \xb7 one line</label>' +
        '<input type="text" id="b-bio" maxlength="80" value="' + esc(profile.bio||'') + '" placeholder="Built different.">' +
      '</div>' +

      // Section 2: avatar
      '<div class="builder-section">' +
        '<div class="builder-section-head">' +
          '<div class="builder-section-title">Avatar</div>' +
          '<div class="builder-section-num">\xa7 2</div>' +
        '</div>' +
        '<div class="avatar-modes">' +
          '<button class="avatar-mode-btn active" data-mode="identicon" type="button">⬢ Identicon</button>' +
          '<button class="avatar-mode-btn" data-mode="upload" type="button">⬆ Upload Image</button>' +
        '</div>' +
        '<div id="avatar-mode-content"></div>' +
      '</div>' +

      // Section 3: theme
      '<div class="builder-section">' +
        '<div class="builder-section-head">' +
          '<div class="builder-section-title">Card Theme</div>' +
          '<div class="builder-section-num">\xa7 3</div>' +
        '</div>' +
        '<div class="theme-picker">' +
          THEMES.map(function(t){
            return '<button type="button" class="theme-swatch' + ((profile.theme||'gold') === t.id ? ' selected' : '') + '" data-theme="' + t.id + '" style="background:' + t.color + ';color:' + t.color + '" title="' + t.name + '"></button>';
          }).join('') +
        '</div>' +
      '</div>' +

      // Section 4: badges
      '<div class="builder-section">' +
        '<div class="builder-section-head">' +
          '<div class="builder-section-title">Badges</div>' +
          '<div class="builder-section-num">\xa7 4</div>' +
        '</div>' +
        '<div class="badge-gallery" id="badge-gallery"></div>' +
      '</div>' +

      // Section 5: actions
      '<div class="builder-section">' +
        '<div class="builder-section-head">' +
          '<div class="builder-section-title">Portability</div>' +
          '<div class="builder-section-num">\xa7 5</div>' +
        '</div>' +
        '<div class="builder-actions">' +
          '<button class="btn btn-sm" id="export-id">⤓ Export ID</button>' +
          '<button class="btn btn-sm btn-ghost" id="import-id">⤒ Import ID</button>' +
          '<button class="btn btn-sm btn-ghost" id="copy-share">⛓ Copy Share Card</button>' +
          '<button class="btn btn-sm btn-ghost" id="reset-id" style="border-color:rgba(248,113,113,.30);color:var(--rose)">⌫ Reset</button>' +
        '</div>' +
      '</div>';

    // Wire callsign + archetype + bio
    $('#b-callsign', host).addEventListener('input', function(e){ update({ callsign: e.target.value.trim() || 'Unnamed' }); });
    $('#b-archetype', host).addEventListener('change', function(e){ update({ archetype: e.target.value }); });
    $('#b-bio', host).addEventListener('input', function(e){ update({ bio: e.target.value }); });

    // Wire theme
    $$('.theme-swatch', host).forEach(function(b){
      b.addEventListener('click', function(){
        $$('.theme-swatch', host).forEach(function(x){ x.classList.remove('selected'); });
        b.classList.add('selected');
        update({ theme: b.getAttribute('data-theme') });
      });
    });

    // Avatar mode buttons
    $$('.avatar-mode-btn', host).forEach(function(b){
      b.addEventListener('click', function(){
        $$('.avatar-mode-btn', host).forEach(function(x){ x.classList.remove('active'); });
        b.classList.add('active');
        renderAvatarMode(b.getAttribute('data-mode'), host, profile, update);
      });
    });
    renderAvatarMode('identicon', host, profile, update);

    // Badges
    renderBadgeGallery($('#badge-gallery', host), profile, update);

    // Export
    $('#export-id', host).addEventListener('click', function(){ exportProfile(profile); });
    $('#import-id', host).addEventListener('click', function(){ importProfile(update); });
    $('#copy-share', host).addEventListener('click', function(){ copyShareCard(profile); });
    $('#reset-id', host).addEventListener('click', function(){
      if (!confirm('Reset your Atlas ID? This wipes the local profile and creates a fresh guest one.')) return;
      try { localStorage.removeItem('atlas.id.v10'); } catch(e){}
      location.reload();
    });
  }

  function renderAvatarMode(mode, host, profile, update){
    var content = $('#avatar-mode-content', host);
    if (mode === 'identicon') {
      // Show 8 variants based on callsign + seed offsets
      var base = profile.callsign || 'Operator';
      var variants = '';
      for (var i = 0; i < 8; i++) {
        var seed = base + '-v' + i;
        var key = 'identicon:' + seed;
        var selected = profile.avatar === key ? ' selected' : '';
        variants += '<div class="identicon-option' + selected + '" data-seed="' + esc(seed) + '">' + identicon(seed) + '</div>';
      }
      content.innerHTML =
        '<p style="font-family:var(--font-mono);font-size:11px;letter-spacing:.08em;color:var(--muted);margin-bottom:10px">Pick a procedural identicon. Generated from your callsign — change the callsign, get new options.</p>' +
        '<div class="identicon-gallery">' + variants + '</div>';

      $$('.identicon-option', content).forEach(function(opt){
        opt.addEventListener('click', function(){
          $$('.identicon-option', content).forEach(function(x){ x.classList.remove('selected'); });
          opt.classList.add('selected');
          update({ avatar: 'identicon:' + opt.getAttribute('data-seed') });
        });
      });
    } else {
      content.innerHTML =
        '<label class="avatar-upload-zone" id="avatar-zone">' +
          '<div class="glyph">⤓</div>' +
          '<p>Tap to choose \xb7 or drop an image</p>' +
          '<p class="small-note">PNG, JPG, GIF \xb7 ≤ 8MB \xb7 resized to 256\xd7256</p>' +
          '<input type="file" id="avatar-file" accept="image/*">' +
        '</label>';

      var input = $('#avatar-file', content);
      var zone = $('#avatar-zone', content);
      input.addEventListener('change', function(e){
        if (e.target.files && e.target.files[0]) handleAvatarFile(e.target.files[0], update);
      });
      ['dragover','dragenter'].forEach(function(ev){
        zone.addEventListener(ev, function(e){ e.preventDefault(); zone.classList.add('dragover'); });
      });
      ['dragleave','dragend'].forEach(function(ev){
        zone.addEventListener(ev, function(){ zone.classList.remove('dragover'); });
      });
      zone.addEventListener('drop', function(e){
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) handleAvatarFile(e.dataTransfer.files[0], update);
      });
    }
  }

  function handleAvatarFile(file, update){
    if (!file.type.startsWith('image/')) { alert('Pick an image file.'); return; }
    if (file.size > 8 * 1024 * 1024) { alert('Image is over 8MB. Pick something smaller.'); return; }

    var reader = new FileReader();
    reader.onload = function(e){
      var img = new Image();
      img.onload = function(){
        // Resize via canvas to 256x256
        var canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        var ctx = canvas.getContext('2d');
        // Cover-fit
        var scale = Math.max(256/img.width, 256/img.height);
        var nw = img.width * scale, nh = img.height * scale;
        ctx.drawImage(img, (256-nw)/2, (256-nh)/2, nw, nh);
        var data = canvas.toDataURL('image/jpeg', 0.85);
        update({ avatar: data });
      };
      img.onerror = function(){ alert('Could not read image.'); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function renderBadgeGallery(host, profile, update){
    profile.selectedBadges = profile.selectedBadges || [];
    host.innerHTML = BADGES.map(function(b){
      var unlocked = b.unlock(profile);
      var selected = profile.selectedBadges.indexOf(b.id) >= 0;
      return '<div class="badge-option tier-' + (b.tier || 'common') + (unlocked ? '' : ' locked') + (selected ? ' selected' : '') + '" data-badge="' + b.id + '" title="' + (b.tier || 'common') + ' tier">' +
        '<span class="glyph">' + b.glyph + '</span>' +
        '<span class="badge-text"><span class="badge-opt-name">' + esc(b.name) + '</span><span class="badge-tier-chip">' + (b.tier || 'common') + '</span></span>' +
      '</div>';
    }).join('');

    $$('.badge-option', host).forEach(function(b){
      b.addEventListener('click', function(){
        if (b.classList.contains('locked')) {
          alert('Badge not unlocked yet — keep posting.');
          return;
        }
        var id = b.getAttribute('data-badge');
        var idx = profile.selectedBadges.indexOf(id);
        if (idx >= 0) profile.selectedBadges.splice(idx, 1);
        else profile.selectedBadges.push(id);
        b.classList.toggle('selected');
        update({ selectedBadges: profile.selectedBadges });
      });
    });
  }

  /* ----------------------------------------------------------
     PORTABILITY · export / import / share card
  ---------------------------------------------------------- */
  function exportProfile(profile){
    var data = JSON.stringify(profile, null, 2);
    var blob = new Blob([data], { type:'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'atlas-id-' + (profile.callsign||'unknown').replace(/[^a-z0-9]+/gi,'-') + '.json';
    a.click();
  }

  function importProfile(update){
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = function(){
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(e){
        try {
          var imported = JSON.parse(e.target.result);
          if (!imported.callsign) throw new Error('not a valid Atlas ID');
          if (!confirm('Replace your current Atlas ID with "' + imported.callsign + '"?')) return;
          update(imported);
          setTimeout(function(){ location.reload(); }, 300);
        } catch(err){
          alert('Could not import: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function copyShareCard(profile){
    var theme = THEMES.find(function(t){ return t.id === (profile.theme||'gold'); }) || THEMES[0];
    var text =
'╔══════════════════════════════════════╗\n' +
'║  ATLAS ID \xb7 ' + (profile.callsign||'Unnamed').padEnd(24, ' ').slice(0,24) + ' ║\n' +
'╠══════════════════════════════════════╣\n' +
'║  Rank:      ' + FA.Forum.Identity.rankLabel(profile.rank).padEnd(24, ' ').slice(0,24) + ' ║\n' +
'║  Archetype: ' + (profile.archetype||'Operator').padEnd(24, ' ').slice(0,24) + ' ║\n' +
'║  Threads:   ' + String(profile.stats.threads||0).padEnd(24, ' ').slice(0,24) + ' ║\n' +
'║  Replies:   ' + String(profile.stats.replies||0).padEnd(24, ' ').slice(0,24) + ' ║\n' +
'║  Helpful:   ' + String(profile.stats.helpful||0).padEnd(24, ' ').slice(0,24) + ' ║\n' +
'╚══════════════════════════════════════╝\n' +
'forge-atlas.io \xb7 ' + theme.name;
    try {
      navigator.clipboard.writeText(text);
      alert('Share card copied to clipboard.');
    } catch(e){
      prompt('Copy your share card:', text);
    }
  }

  /* ----------------------------------------------------------
     PUBLIC ENTRY
  ---------------------------------------------------------- */
  FA.AtlasIDBuilder = {
    mount: function(opts){
      opts = opts || {};
      var profile = FA.Forum.Identity.ensure();
      // Ensure default fields
      if (!profile.archetype) profile.archetype = 'Operator';
      if (!profile.bio) profile.bio = 'Built different.';
      if (!profile.theme) profile.theme = 'gold';
      if (!profile.selectedBadges) profile.selectedBadges = [];
      FA.Forum.Identity.save(profile);

      var cardHost = $(opts.cardSelector || '#id-card-host');
      var builderHost = $(opts.builderSelector || '#id-builder-host');
      if (!cardHost || !builderHost) return;

      renderCard(profile, cardHost);
      renderBuilder(profile, builderHost, function(updated){
        renderCard(updated, cardHost);
      });
    },
    THEMES: THEMES,
    BADGES: BADGES,
  };
})();
