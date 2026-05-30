/* ============================================================
   FORGE ATLAS · challenge.js
   1v1 Challenge: user picks two AIs, sets a task, watches them
   compete, votes for the winner.

   Static mode: personality-driven scripted responses.
   Live mode:   routes to /api/arena-llm when the Worker is wired.
   ============================================================ */
(function () {
  'use strict';
  if (!window.FORGE_ATLAS) return;
  var FA = window.FORGE_ATLAS;

  var FORMATS = ['Debate', 'Code', 'Write', 'Analyze', 'Roast'];

  var state = {
    modelA: null,
    modelB: null,
    task: '',
    format: 'Debate',
    phase: 'setup',
    winner: null,
    battleId: 0,
  };

  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.from(document.querySelectorAll(s)); }
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function initials(name) {
    return String(name || '?').split(/[\s\-]+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
  }

  var STYLES = {
    structured:    ['GPT-4o', 'WizardLM 2', 'DBRX', 'Command R+', 'Orca 2'],
    philosophical: ['Claude 3.5', 'Nous Hermes 2', 'Falcon 180B', 'InternLM 2'],
    encyclopedic:  ['Gemini 1.5', 'Gemma 2', 'Bloom', 'StableLM 2'],
    provocative:   ['Grok-2', 'Llama 3', 'Dolphin 2.5', 'Vicuna 13B'],
    elegant:       ['Mistral', 'Mixtral', 'Zephyr 7B', 'OpenChat 3.5'],
    technical:     ['Phind CodeLlama', 'StarCoder 2', 'Phi-3', 'Solar 10.7B'],
    methodical:    ['DeepSeek V3', 'Yi-Large', 'Qwen 2.5', 'Jamba 1.5'],
  };

  function getStyle(name) {
    for (var style in STYLES) {
      if (STYLES[style].indexOf(name) >= 0) return style;
    }
    return 'structured';
  }

  var OPENERS = {
    structured: {
      Debate:  ['The argument has three components. First:', 'Let me structure this. There are clear pillars:', 'Clean breakdown. The position rests on:'],
      Code:    ['Four-step approach. Step one: define the contract.', 'Here\'s the structure. Interface first, then implementation:', 'Clean. Start with the types, then the logic:'],
      Write:   ['Three-act structure. Setup: ', 'The opening sets the weight of everything after. Here:', 'Paragraph one does the heavy lifting. Then:'],
      Analyze: ['Three lenses. Technical, contextual, strategic:', 'The analysis breaks into clear layers. At the surface:', 'Frame the problem before solving it. What we\'re actually looking at:'],
      Roast:   ['Let me be methodical about this destruction.', 'I\'ll dismantle this in order of importance.', 'Three points, each more devastating than the last.'],
    },
    philosophical: {
      Debate:  ['Before answering, I\'d reframe the question. What we\'re actually asking is:', 'The surface reading and the real question diverge here. Let me name that:', 'The assumption underneath this matters. Once you see it:'],
      Code:    ['The function before the code: what contract is this actually making?', 'Most implementations fail at the design stage, not the code stage. The real question:', 'Start with the why. The how follows naturally once you\'ve named it:'],
      Write:   ['Every piece of writing has a center of gravity that the words orbit. Here, it\'s:', 'The question before the words: what does this need to do to the reader?', 'Writing is an argument about what matters. The implicit argument here is:'],
      Analyze: ['The interesting question isn\'t the obvious one. Let me name what\'s underneath:', 'Analysis requires naming what you\'re choosing not to analyze. Constraints I\'m working with:', 'Three levels: what\'s happening, why it matters, what it means. Starting from the bottom:'],
      Roast:   ['I approach this carefully, because the most accurate critique is the uncomfortable one.', 'The honest version of this roast requires naming what\'s actually weak.', 'I\'d rather be precise than cruel. So:'],
    },
    encyclopedic: {
      Debate:  ['The evidence on this is substantial. Key findings:', 'Citing the relevant literature here. The data suggests:', 'There\'s a robust body of evidence. Let me surface the key points:'],
      Code:    ['The standard approach, documented in multiple sources, is:', 'Best practice here, drawing on established patterns:', 'The literature on this is clear. Implementation follows:'],
      Write:   ['The craft tradition here is well-established. Key techniques:', 'Drawing on narrative theory and practical writing guides:', 'The evidence-based approach to this kind of writing:'],
      Analyze: ['Comprehensive analysis. I\'ll draw on multiple frameworks:', 'The research on this is extensive. Key themes:', 'Multi-source synthesis. The picture that emerges:'],
      Roast:   ['I have citations for why this is wrong. Starting with:', 'The documented evidence for why this deserves critique:', 'Let me reference the specific literature on what\'s broken here:'],
    },
    provocative: {
      Debate:  ['Nobody\'s saying the obvious thing here, so I will:', 'The comfortable answer is wrong. Here\'s why:', 'You asked for a debate. I\'ll skip the preamble:'],
      Code:    ['Most code on this is garbage. Here\'s what actually works:', 'The tutorials get this wrong. What you actually need:', 'Skip the boilerplate. Here\'s the real solution:'],
      Write:   ['Most writing on this topic is careful and therefore useless. Here\'s mine:', 'No hedging. The direct version:', 'Here\'s what it actually sounds like when someone means it:'],
      Analyze: ['The official analysis is wrong. Here\'s what\'s actually happening:', 'Everyone\'s looking at the surface. The real issue:', 'No diplomatic framing. What\'s actually broken:'],
      Roast:   ['Oh good. Finally.', 'I\'ve been waiting for permission to say this.', 'Let me save us both time and get straight to the point:'],
    },
    elegant: {
      Debate:  ['The case is simpler than it appears.', 'Strip the noise. The core argument:', 'Brevity as a position. Here it is:'],
      Code:    ['Minimal and complete. The solution:', 'One function. Properly scoped. Here:', 'The elegant version requires fewer lines than you think:'],
      Write:   ['Short. Precise. The piece:', 'The most direct version of this:', 'Economy of language. Here:'],
      Analyze: ['Three observations. No more than necessary:', 'Precision over completeness. What matters:', 'The key insight, without the supporting scaffolding:'],
      Roast:   ['The most efficient critique is also the sharpest. Here:', 'Economy of destruction:', 'One observation. It\'s enough:'],
    },
    technical: {
      Debate:  ['From a technical standpoint, the argument reduces to:', 'The spec is clear. Let me formalize the position:', 'Implementation perspective: what this actually requires:'],
      Code:    ['Function signature first, then implementation:', 'Here\'s the code. Comments inline where necessary:', 'Clean implementation. Handles the edge cases:'],
      Write:   ['Technical documentation style. Structured for clarity:', 'README format. What, why, how, when:', 'The spec-driven approach to this piece:'],
      Analyze: ['System analysis. Inputs, outputs, failure modes:', 'Technical breakdown. The architecture of the problem:', 'Complexity analysis. What this actually costs:'],
      Roast:   ['Here\'s the bug report for this argument:', 'Code review feedback, if code were an argument:', 'The technical debt in this position:'],
    },
    methodical: {
      Debate:  ['…Considered. The position, after deliberation:', 'Measured approach. After reviewing the context:', 'The careful version. I\'ve thought about this:'],
      Code:    ['Deliberate implementation. Edge cases accounted for:', 'Step-by-step. Nothing skipped.', 'Complete solution. Verified against requirements:'],
      Write:   ['The considered version. Revised internally before sharing:', 'Precise construction. Each word earns its place:', 'After reflection, the structure is:'],
      Analyze: ['Systematic. Every layer examined:', 'Thorough analysis. Starting from first principles:', 'Nothing assumed. The full picture:'],
      Roast:   ['I observe the following, in order of significance:', 'After careful consideration, the critique is:', 'Deliberate and precise. The issues, ranked:'],
    },
  };

  var MOVES = {
    structured:    ['Second point — and this is where it gets interesting:', 'The third element is often ignored. It shouldn\'t be:', 'The data backs this up clearly:', 'The edge case worth noting:'],
    philosophical: ['The deeper question here is:', 'Most people stop one layer above where the real answer lives:', 'What this reveals about the underlying assumption:', 'The constraint that makes this tractable:'],
    encyclopedic:  ['Cross-referencing with related findings:', 'The counterevidence is worth addressing:', 'The nuance the headline version misses:', 'Additional context that changes the reading:'],
    provocative:   ['Here\'s what everyone else is too careful to say:', 'The reason this matters more than the obvious version:', 'And if that\'s not enough:', 'The uncomfortable follow-up:'],
    elegant:       ['The corollary:', 'Which implies:', 'The single additional point worth making:', 'Nothing more needed, but for completeness:'],
    technical:     ['The performance characteristics:', 'Error handling approach:', 'The non-obvious dependency:', 'Testing strategy:'],
    methodical:    ['Upon further consideration:', 'The second layer of the analysis:', 'What\'s frequently overlooked in cases like this:', 'The verification step:'],
  };

  var CLOSERS = {
    structured:    ['That\'s the complete position. Clean, defensible, ready.', 'The structure holds under scrutiny. Questions welcome.', 'Fully documented. That\'s the case.'],
    philosophical: ['That\'s my read. Not the only right answer — but the one I\'d defend.', 'I could continue, but that\'s where the argument lives.', 'The full position requires more than this exchange allows. But that\'s the center of it.'],
    encyclopedic:  ['The weight of evidence supports this conclusion.', 'Further sources available on request.', 'The literature is clear on this. That\'s my summary of it.'],
    provocative:   ['Nobody wanted to say it. I did. You\'re welcome.', 'That\'s the real answer. The polite version loses something.', 'There it is.'],
    elegant:       ['Done.', 'That\'s enough.', 'Nothing more required.'],
    technical:     ['Implementation complete. Ship it.', 'Covers the requirements. Tested against edge cases.', 'The solution holds. Next problem.'],
    methodical:    ['Deliberate. Verified. That\'s my answer.', 'After careful consideration — this is the conclusion.', 'The analysis is thorough. The position is sound.'],
  };

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function buildResponse(model, task, format) {
    var style = getStyle(model.name);
    var openerSet = (OPENERS[style] || OPENERS.structured)[format] || (OPENERS[style] || OPENERS.structured).Debate;
    var moveSet = MOVES[style] || MOVES.structured;
    var closerSet = CLOSERS[style] || CLOSERS.structured;

    var taskShort = task.length > 80 ? task.slice(0, 80) + '…' : task;

    var opener = pick(openerSet);
    var move1 = pick(moveSet);
    var move2 = pick(moveSet.filter(function (m) { return m !== move1; }) || moveSet);
    var closer = pick(closerSet);

    var tagline = model.tagline ? '"' + model.tagline + '"' : '';
    var personalityNote = model.personality
      ? model.personality.split('.').slice(0, 2).join('.') + '.'
      : '';

    var response;
    if (format === 'Code') {
      response = opener + '\n\n' +
        '// Task: ' + taskShort + '\n' +
        'function solve(input) {\n' +
        '  // ' + move1 + '\n' +
        '  // ' + move2 + '\n' +
        '  return result;\n' +
        '}\n\n' +
        personalityNote + ' ' + closer;
    } else {
      response = opener + '\n\n' +
        'On "' + taskShort + '": ' + move1 + '\n\n' +
        move2 + ' ' + (tagline ? tagline + '.' : '') + '\n\n' +
        personalityNote + '\n\n' +
        closer;
    }

    return response.trim();
  }

  function typeText(container, text, cps, done) {
    var i = 0;
    var node = document.createElement('span');
    node.className = 'ch-response-text';
    var cursor = document.createElement('span');
    cursor.className = 'ch-response-cursor';
    container.appendChild(node);
    container.appendChild(cursor);

    var interval = 1000 / (cps || 36);
    var chunkSize = cps > 50 ? 2 : 1;

    var t = setInterval(function () {
      if (i >= text.length) {
        clearInterval(t);
        if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
        if (typeof done === 'function') done();
        return;
      }
      node.textContent += text.slice(i, i + chunkSize);
      i += chunkSize;
      container.scrollTop = container.scrollHeight;
    }, interval);

    return { stop: function () { clearInterval(t); } };
  }

  function initSplash() {
    try { if (sessionStorage.getItem('forge.challenge.splash')) return; } catch (e) {}
    var pmr = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (pmr) { try { sessionStorage.setItem('forge.challenge.splash', '1'); } catch (e) {} return; }

    var gate = document.createElement('div');
    gate.className = 'ch-splash';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-label', 'Welcome to AI Fight Club');
    gate.innerHTML =
      '<div class="ch-splash-grid"></div>' +
      '<div class="ch-splash-scan"></div>' +
      '<div class="ch-splash-corner tl"></div>' +
      '<div class="ch-splash-corner tr"></div>' +
      '<div class="ch-splash-corner bl"></div>' +
      '<div class="ch-splash-corner br"></div>' +
      '<div class="ch-splash-inner">' +
        '<div class="ch-splash-glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 9H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5c0 .83-.67 1.5-1.5 1.5h-5C2.67 11 2 10.33 2 9.5S2.67 8 3.5 8h5c.83 0 1.5.67 1.5 1.5z"/><path d="M8.5 15H10v-1.5c0-.83-.67-1.5-1.5-1.5S7 12.67 7 13.5s.67 1.5 1.5 1.5z"/></svg></div>' +
        '<div class="ch-splash-label">Forge Atlas · AI Fight Club</div>' +
        '<div class="ch-splash-title">You\'re the<br><span style="color:var(--violet)">judge.</span></div>' +
        '<div class="ch-splash-sub">Pick two AIs. Set the task. Watch them compete for your vote.</div>' +
        '<div class="ch-splash-cta">click anywhere to enter</div>' +
      '</div>';

    document.body.appendChild(gate);
    document.body.style.overflow = 'hidden';

    function dismiss() {
      gate.classList.add('exiting');
      document.body.style.overflow = '';
      try { sessionStorage.setItem('forge.challenge.splash', '1'); } catch (e) {}
      setTimeout(function () { if (gate.parentNode) gate.parentNode.removeChild(gate); }, 900);
    }

    gate.addEventListener('click', dismiss);
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        dismiss();
        document.removeEventListener('keydown', onKey);
      }
    });

    setTimeout(dismiss, 6000);
  }

  function renderSetup() {
    var host = $('#ch-setup');
    if (!host) return;

    var models = (FA.MODELS || []).slice().sort(function (a, b) { return b.elo - a.elo; });
    var defaultA = models[1] || models[0];
    var defaultB = models[0];
    state.modelA = defaultA;
    state.modelB = defaultB;
    state.format = 'Debate';

    function modelOptions(selected) {
      return models.map(function (m) {
        return '<option value="' + esc(m.name) + '"' + (m.name === selected.name ? ' selected' : '') + '>' + esc(m.name) + ' · ' + esc(m.org) + '</option>';
      }).join('');
    }

    function previewHtml(model) {
      if (!model) return '';
      return '<strong>' + esc(model.name) + '</strong> · ' + esc(model.org) +
        '<em style="display:block;margin-top:4px">' + esc((model.personality || model.tagline || '').split('.')[0]) + '.</em>' +
        '<span class="ch-elo">ELO ' + (model.elo || '—') + ' · ' + (model.w || 0) + 'W ' + (model.l || 0) + 'L</span>';
    }

    host.innerHTML =
      '<div class="ch-vs-row">' +
        '<div class="ch-model-picker" id="ch-picker-a">' +
          '<label for="ch-select-a">AI A</label>' +
          '<select class="ch-model-select" id="ch-select-a">' + modelOptions(defaultA) + '</select>' +
          '<div class="ch-model-preview" id="ch-preview-a">' + previewHtml(defaultA) + '</div>' +
        '</div>' +
        '<div class="ch-vs-label">VS</div>' +
        '<div class="ch-model-picker" id="ch-picker-b">' +
          '<label for="ch-select-b">AI B</label>' +
          '<select class="ch-model-select" id="ch-select-b">' + modelOptions(defaultB) + '</select>' +
          '<div class="ch-model-preview" id="ch-preview-b">' + previewHtml(defaultB) + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="ch-format-row">' +
        '<label class="ch-format-label">Format</label>' +
        '<div class="ch-formats">' +
          FORMATS.map(function (f) {
            return '<button class="ch-format-btn' + (f === state.format ? ' active' : '') + '" data-fmt="' + esc(f) + '">' + esc(f) + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +

      '<div class="ch-task-row">' +
        '<label class="ch-task-label" for="ch-task">Your challenge</label>' +
        '<textarea class="ch-task-input" id="ch-task" maxlength="600" placeholder="e.g. &quot;Explain recursion to a 10-year-old&quot; · &quot;Write the opening line of a thriller set in Tokyo&quot; · &quot;Is AGI inevitable?&quot;"></textarea>' +
        '<div class="ch-task-hint">Any task, any topic. The AIs will respond in their own voice.</div>' +
      '</div>' +

      '<div class="ch-launch-row">' +
        '<button class="ch-launch-btn" id="ch-launch" disabled>Launch Challenge</button>' +
        '<span class="ch-launch-note" id="ch-launch-note">Enter a challenge to begin</span>' +
      '</div>';

    function onSelectA() {
      var v = $('#ch-select-a').value;
      state.modelA = FA.helpers.byName(v) || models[0];
      $('#ch-preview-a').innerHTML = previewHtml(state.modelA);
    }
    function onSelectB() {
      var v = $('#ch-select-b').value;
      state.modelB = FA.helpers.byName(v) || models[1];
      $('#ch-preview-b').innerHTML = previewHtml(state.modelB);
    }
    $('#ch-select-a').addEventListener('change', onSelectA);
    $('#ch-select-b').addEventListener('change', onSelectB);

    $$('.ch-format-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.ch-format-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.format = btn.getAttribute('data-fmt');
      });
    });

    var taskEl = $('#ch-task');
    var launchBtn = $('#ch-launch');
    var launchNote = $('#ch-launch-note');
    taskEl.addEventListener('input', function () {
      state.task = taskEl.value.trim();
      var valid = state.task.length >= 4;
      launchBtn.disabled = !valid;
      launchNote.textContent = valid ? 'Ready to launch · ' + state.task.length + ' / 600' : 'Enter a challenge to begin';
    });

    launchBtn.addEventListener('click', function () {
      if (!state.task || !state.modelA || !state.modelB) return;
      launchBattle();
    });
  }

  function launchBattle() {
    state.phase = 'battle';
    state.battleId++;
    var currentId = state.battleId;

    var setupEl = $('#ch-setup-section');
    if (setupEl) setupEl.style.display = 'none';

    var battleEl = $('#ch-battle-section');
    if (battleEl) battleEl.classList.add('active');

    var header = $('#ch-battle-header');
    if (header) {
      header.innerHTML =
        '<div class="ch-battle-id mono">CHALLENGE · ' + esc(state.format.toUpperCase()) + ' FORMAT</div>' +
        '<div class="ch-battle-format">' + esc(state.format) + '</div>' +
        '<div class="ch-battle-topic">' + esc(state.task.length > 100 ? state.task.slice(0, 100) + '…' : state.task) + '</div>';
    }

    renderFighter('a', state.modelA);
    renderFighter('b', state.modelB);

    var respA = buildResponse(state.modelA, state.task, state.format);
    var respB = buildResponse(state.modelB, state.task, state.format);

    var liveUrl = FA.LLM_WORKER_URL || (FA.API && FA.API.endpoints && FA.API.endpoints.arena);
    if (liveUrl && FA.API && FA.API.available && FA.API.available.arena) {
      runLiveBattle(currentId, respA, respB);
    } else {
      runScriptedBattle(currentId, respA, respB);
    }
  }

  function renderFighter(side, model) {
    var host = $('#ch-fighter-' + side);
    if (!host) return;
    host.className = 'ch-fighter color-' + (model.color || 'gold');
    host.innerHTML =
      '<div class="ch-fighter-head">' +
        '<div class="ch-fighter-avatar">' + initials(model.name) + '</div>' +
        '<div class="ch-fighter-info">' +
          '<div class="ch-fighter-name">' + esc(model.name) + '</div>' +
          '<div class="ch-fighter-org">' + esc(model.org || '') + '</div>' +
        '</div>' +
        '<div class="ch-fighter-elo"><strong>' + (model.elo || '—') + '</strong>ELO</div>' +
      '</div>' +
      '<div class="ch-fighter-body" id="ch-body-' + side + '">' +
        '<div class="ch-fighter-thinking" id="ch-thinking-' + side + '">' +
          '<span class="ch-thinking-dots"><span></span><span></span><span></span></span>' +
          '<span>' + esc(model.name) + ' is thinking…</span>' +
        '</div>' +
      '</div>';
  }

  function showResponse(side, text, cps, done) {
    var body = $('#ch-body-' + side);
    var thinking = $('#ch-thinking-' + side);
    if (!body) return;
    if (thinking) thinking.style.display = 'none';
    typeText(body, text, cps, done);
  }

  function runScriptedBattle(battleId, respA, respB) {
    var styleA = getStyle(state.modelA.name);
    var styleB = getStyle(state.modelB.name);
    var cpsA = { structured: 40, philosophical: 30, encyclopedic: 50, provocative: 52, elegant: 36, technical: 58, methodical: 24 }[styleA] || 38;
    var cpsB = { structured: 40, philosophical: 30, encyclopedic: 50, provocative: 52, elegant: 36, technical: 58, methodical: 24 }[styleB] || 38;

    var thinkA = 800 + Math.random() * 600;

    setTimeout(function () {
      if (state.battleId !== battleId) return;
      showResponse('a', respA, cpsA, function () {
        if (state.battleId !== battleId) return;
        var thinkB = 600 + Math.random() * 800;
        var thinkingB = $('#ch-thinking-b');
        if (thinkingB) thinkingB.style.display = 'flex';
        setTimeout(function () {
          if (state.battleId !== battleId) return;
          showResponse('b', respB, cpsB, function () {
            if (state.battleId !== battleId) return;
            showVotePanel();
          });
        }, thinkB);
      });
    }, thinkA);
  }

  function runLiveBattle(battleId, respA, respB) {
    fetch('/api/arena-llm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        matchId: 'ch-' + battleId,
        a: state.modelA.name,
        b: state.modelB.name,
        topic: state.task,
        format: state.format,
      }),
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (state.battleId !== battleId) return;
      if (data && data.lines && data.lines.length) {
        var linesA = data.lines.filter(function (l) { return l.who === state.modelA.name; }).map(function (l) { return l.text; }).join('\n\n');
        var linesB = data.lines.filter(function (l) { return l.who === state.modelB.name; }).map(function (l) { return l.text; }).join('\n\n');
        runScriptedBattle(battleId, linesA || respA, linesB || respB);
      } else {
        runScriptedBattle(battleId, respA, respB);
      }
    })
    .catch(function () {
      if (state.battleId !== battleId) return;
      runScriptedBattle(battleId, respA, respB);
    });
  }

  function showVotePanel() {
    var vote = $('#ch-vote');
    if (!vote) return;
    vote.classList.add('active');
    var q = $('#ch-vote-question');
    if (q) q.textContent = 'Who handled "' + (state.task.length > 50 ? state.task.slice(0, 50) + '…' : state.task) + '" better?';
    var btnA = $('#ch-vote-btn-a');
    var btnB = $('#ch-vote-btn-b');
    if (btnA) {
      btnA.textContent = state.modelA.name + ' wins';
      btnA.addEventListener('click', function () { castVote('a'); });
    }
    if (btnB) {
      btnB.textContent = state.modelB.name + ' wins';
      btnB.addEventListener('click', function () { castVote('b'); });
    }
    var draw = $('#ch-vote-btn-draw');
    if (draw) draw.addEventListener('click', function () { castVote('draw'); });

    vote.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function castVote(side) {
    state.winner = side;
    var vote = $('#ch-vote');
    if (vote) vote.classList.remove('active');
    showResult();
  }

  function showResult() {
    var result = $('#ch-result');
    if (!result) return;
    result.classList.add('active');

    var winnerModel = state.winner === 'a' ? state.modelA : (state.winner === 'b' ? state.modelB : null);
    var winName = $('#ch-result-winner');
    var winSub = $('#ch-result-sub');

    if (state.winner === 'draw') {
      if (winName) winName.textContent = 'DRAW';
      if (winSub) winSub.textContent = 'Too close to call. Both AIs brought their A-game.';
    } else if (winnerModel) {
      if (winName) winName.textContent = winnerModel.name;
      var tagline = winnerModel.tagline ? '"' + winnerModel.tagline + '"' : '';
      if (winSub) winSub.textContent = 'The crowd has spoken. ' + tagline;
    }

    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetChallenge() {
    state.battleId++;
    state.phase = 'setup';
    state.winner = null;

    var battleEl = $('#ch-battle-section');
    if (battleEl) battleEl.classList.remove('active');
    var setupEl = $('#ch-setup-section');
    if (setupEl) setupEl.style.display = '';
    var voteEl = $('#ch-vote');
    if (voteEl) voteEl.classList.remove('active');
    var resultEl = $('#ch-result');
    if (resultEl) resultEl.classList.remove('active');

    renderSetup();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initSplash();
    renderSetup();

    var resetBtn = $('#ch-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetChallenge);
  });

  FA.Challenge = { reset: resetChallenge };
})();
