/* ============================================================
   FORGE ATLAS · challenge.js  v10.2
   AI Fight Club — cinematic FIGHT! flash, swipe comparison,
   code/design preview (bolt.new style), Copy battle mode.
   ============================================================ */
(function () {
  'use strict';
  if (!window.FORGE_ATLAS) return;
  var FA = window.FORGE_ATLAS;

  var FORMATS = ['Debate', 'Code', 'Design', 'Write', 'Copy', 'Analyze', 'Roast', 'Hot Take'];

  var state = {
    modelA: null, modelB: null,
    task: '', format: 'Debate',
    phase: 'setup', winner: null, battleId: 0,
    respA: '', respB: '',
    bothDone: false,
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

  function weightClass(model) {
    var elo = model.elo || 1700;
    if (elo >= 2150) return '∞ params \xb7 unlimited class';
    if (elo >= 2050) return 'frontier heavyweight';
    if (elo >= 1950) return 'production middleweight';
    if (elo >= 1850) return 'enterprise welterweight';
    if (elo >= 1800) return 'open-weight lightweight';
    if (elo >= 1750) return 'community featherweight';
    return 'small model flyweight';
  }

  var OPENERS = {
    structured: {
      Debate:      ['The argument has three components. First:', 'Let me structure this. There are clear pillars:', 'Clean breakdown. The position rests on:'],
      Code:        ['Four-step approach. Step one: define the contract.', 'Here\'s the structure. Interface first, then implementation:', 'Clean. Start with the types, then the logic:'],
      Write:       ['Three-act structure. Setup: ', 'The opening sets the weight of everything after. Here:', 'Paragraph one does the heavy lifting. Then:'],
      Analyze:     ['Three lenses. Technical, contextual, strategic:', 'The analysis breaks into clear layers. At the surface:', 'Frame the problem before solving it. What we\'re actually looking at:'],
      Roast:       ['Let me be methodical about this destruction.', 'I\'ll dismantle this in order of importance.', 'Three points, each more devastating than the last.'],
      'Hot Take':  ['Controversial? Yes. Defensible? Also yes. Here\'s the case:', 'The unpopular position is often correct. This is one of those times:', 'I\'ll structure the argument for why everyone else is wrong:'],
    },
    philosophical: {
      Debate:      ['Before answering, I\'d reframe the question. What we\'re actually asking is:', 'The surface reading and the real question diverge here. Let me name that:', 'The assumption underneath this matters. Once you see it:'],
      Code:        ['The function before the code: what contract is this actually making?', 'Most implementations fail at the design stage, not the code stage. The real question:', 'Start with the why. The how follows naturally once you\'ve named it:'],
      Write:       ['Every piece of writing has a center of gravity that the words orbit. Here, it\'s:', 'The question before the words: what does this need to do to the reader?', 'Writing is an argument about what matters. The implicit argument here is:'],
      Analyze:     ['The interesting question isn\'t the obvious one. Let me name what\'s underneath:', 'Analysis requires naming what you\'re choosing not to analyze. Constraints I\'m working with:', 'Three levels: what\'s happening, why it matters, what it means. Starting from the bottom:'],
      Roast:       ['I approach this carefully, because the most accurate critique is the uncomfortable one.', 'The honest version of this roast requires naming what\'s actually weak.', 'I\'d rather be precise than cruel. So:'],
      'Hot Take':  ['The uncomfortable truth nobody wants to sit with:', 'Every consensus has an underlying assumption worth questioning. This one:', 'What if the majority position is comfortable, not correct?'],
    },
    encyclopedic: {
      Debate:      ['The evidence on this is substantial. Key findings:', 'Citing the relevant literature here. The data suggests:', 'There\'s a robust body of evidence. Let me surface the key points:'],
      Code:        ['The standard approach, documented in multiple sources, is:', 'Best practice here, drawing on established patterns:', 'The literature on this is clear. Implementation follows:'],
      Write:       ['The craft tradition here is well-established. Key techniques:', 'Drawing on narrative theory and practical writing guides:', 'The evidence-based approach to this kind of writing:'],
      Analyze:     ['Comprehensive analysis. I\'ll draw on multiple frameworks:', 'The research on this is extensive. Key themes:', 'Multi-source synthesis. The picture that emerges:'],
      Roast:       ['I have citations for why this is wrong. Starting with:', 'The documented evidence for why this deserves critique:', 'Let me reference the specific literature on what\'s broken here:'],
      'Hot Take':  ['The contrarian position has scholarly support. Citing:', 'The majority view relies on assumptions the literature challenges:', 'The evidence for the unpopular read:'],
    },
    provocative: {
      Debate:      ['Nobody\'s saying the obvious thing here, so I will:', 'The comfortable answer is wrong. Here\'s why:', 'You asked for a debate. I\'ll skip the preamble:'],
      Code:        ['Most code on this is garbage. Here\'s what actually works:', 'The tutorials get this wrong. What you actually need:', 'Skip the boilerplate. Here\'s the real solution:'],
      Write:       ['Most writing on this topic is careful and therefore useless. Here\'s mine:', 'No hedging. The direct version:', 'Here\'s what it actually sounds like when someone means it:'],
      Analyze:     ['The official analysis is wrong. Here\'s what\'s actually happening:', 'Everyone\'s looking at the surface. The real issue:', 'No diplomatic framing. What\'s actually broken:'],
      Roast:       ['Oh good. Finally.', 'I\'ve been waiting for permission to say this.', 'Let me save us both time and get straight to the point:'],
      'Hot Take':  ['Everyone else is wrong and here\'s why:', 'I\'ll say what needs to be said:', 'The comfortable consensus is scared of this:'],
    },
    elegant: {
      Debate:      ['The case is simpler than it appears.', 'Strip the noise. The core argument:', 'Brevity as a position. Here it is:'],
      Code:        ['Minimal and complete. The solution:', 'One function. Properly scoped. Here:', 'The elegant version requires fewer lines than you think:'],
      Write:       ['Short. Precise. The piece:', 'The most direct version of this:', 'Economy of language. Here:'],
      Analyze:     ['Three observations. No more than necessary:', 'Precision over completeness. What matters:', 'The key insight, without the supporting scaffolding:'],
      Roast:       ['The most efficient critique is also the sharpest. Here:', 'Economy of destruction:', 'One observation. It\'s enough:'],
      'Hot Take':  ['Simply:', 'The short version of what everyone\'s afraid to say:', 'Blunt:'],
    },
    technical: {
      Debate:      ['From a technical standpoint, the argument reduces to:', 'The spec is clear. Let me formalize the position:', 'Implementation perspective: what this actually requires:'],
      Code:        ['Function signature first, then implementation:', 'Here\'s the code. Comments inline where necessary:', 'Clean implementation. Handles the edge cases:'],
      Write:       ['Technical documentation style. Structured for clarity:', 'README format. What, why, how, when:', 'The spec-driven approach to this piece:'],
      Analyze:     ['System analysis. Inputs, outputs, failure modes:', 'Technical breakdown. The architecture of the problem:', 'Complexity analysis. What this actually costs:'],
      Roast:       ['Here\'s the bug report for this argument:', 'Code review feedback, if code were an argument:', 'The technical debt in this position:'],
      'Hot Take':  ['Spec says one thing. Implementation says another:', 'Performance review: the commonly accepted answer has bugs:', 'The technical case for the unpopular position:'],
    },
    methodical: {
      Debate:      ['…Considered. The position, after deliberation:', 'Measured approach. After reviewing the context:', 'The careful version. I\'ve thought about this:'],
      Code:        ['Deliberate implementation. Edge cases accounted for:', 'Step-by-step. Nothing skipped.', 'Complete solution. Verified against requirements:'],
      Write:       ['The considered version. Revised internally before sharing:', 'Precise construction. Each word earns its place:', 'After reflection, the structure is:'],
      Analyze:     ['Systematic. Every layer examined:', 'Thorough analysis. Starting from first principles:', 'Nothing assumed. The full picture:'],
      Roast:       ['I observe the following, in order of significance:', 'After careful consideration, the critique is:', 'Deliberate and precise. The issues, ranked:'],
      'Hot Take':  ['After due diligence, the position I\'m defending:', 'Thoroughly considered. The unpopular-but-correct view:', 'Deliberate contrarianism, justified:'],
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

  /* ── Copy battle mode ──────────────────────────────────── */
  var COPY_HEADLINES = {
    structured:    ['The Clear Choice.', 'Built to Perform.', 'Results by Design.'],
    philosophical: ['What If Everything Changed?', 'Begin With Why.', 'The Question Behind the Question.'],
    encyclopedic:  ['Proven. Documented. Trusted.', 'The Evidence-Based Solution.', 'Research First.'],
    provocative:   ['Stop Wasting Time.', 'Everyone Else Is Wrong.', 'Do This Instead.'],
    elegant:       ['Simply Better.', 'Nothing Extra.', 'Pure.'],
    technical:     ['It Works.', 'Zero Surprises.', 'Built Right.'],
    methodical:    ['Step by Step.', 'Measured. Verified.', 'The Careful Path.'],
  };
  var COPY_SUBS = {
    structured:    'Engineered for the work that actually matters — not what looks good in a deck.',
    philosophical: 'For the operators who ask why before they ask how.',
    encyclopedic:  'Every claim is backed. Every promise is documented.',
    provocative:   'No fluff. No wasted words. Just the result.',
    elegant:       'The simplest version that solves the problem completely.',
    technical:     'Zero dependencies. Zero magic. Zero surprises.',
    methodical:    'Every step verified before the next one begins.',
  };
  var COPY_CTAS = {
    structured: 'Get Started →', philosophical: 'Explore the Idea →',
    encyclopedic: 'See the Evidence →', provocative: 'Start Now →',
    elegant: 'Begin →', technical: 'Read the Docs →', methodical: 'See the Plan →',
  };

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function buildCopyResponse(model, task) {
    var style = getStyle(model.name);
    var taskShort = task.length > 70 ? task.slice(0, 70) + '…' : task;
    var headline = pick(COPY_HEADLINES[style] || COPY_HEADLINES.structured);
    var sub = COPY_SUBS[style] || COPY_SUBS.structured;
    var cta = COPY_CTAS[style] || COPY_CTAS.structured;
    var move = pick(MOVES[style] || MOVES.structured);
    return (
      '━━━ HEADLINE ━━━\n' + headline + '\n\n' +
      '━━━ SUBHEADLINE ━━━\n' + sub + '\n\n' +
      '━━━ BODY ━━━\n"' + taskShort + '"\n' +
      move + ' The offer is clear. The promise is real.\n\n' +
      '━━━ CTA ━━━\n[ ' + cta + ' ]\n\n' +
      '— ' + model.name
    );
  }

  /* ── Design mode HTML generator ────────────────────────────── */
  function buildDesignHTML(model, task) {
    var style = getStyle(model.name);
    var taskShort = task.length > 55 ? task.slice(0, 55) + '…' : task;
    var name = model.name;

    if (style === 'philosophical' || style === 'elegant') {
      return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
        '*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%}' +
        'body{background:#07070f;color:#e8e8ec;font-family:Georgia,"Times New Roman",serif;display:grid;place-items:center;min-height:100vh;padding:32px 24px}' +
        '.w{text-align:center;max-width:420px;animation:fu .8s ease both}' +
        '@keyframes fu{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}' +
        '.eye{font-size:9px;letter-spacing:.32em;text-transform:uppercase;color:rgba(167,139,250,.55);font-family:system-ui,sans-serif;margin-bottom:28px}' +
        'h1{font-size:clamp(20px,4.5vw,34px);line-height:1.25;color:#e8e8ec;font-weight:400;margin-bottom:14px;letter-spacing:-.01em}' +
        'h1 em{color:#a78bfa;font-style:normal}' +
        'p{font-size:13px;color:rgba(255,255,255,.38);line-height:1.75;margin-bottom:28px;font-family:system-ui,sans-serif}' +
        'a{display:inline-block;padding:11px 28px;background:transparent;border:1px solid rgba(167,139,250,.35);color:#a78bfa;border-radius:2px;font-family:system-ui,sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;text-decoration:none;transition:all .25s}' +
        'a:hover{background:rgba(167,139,250,.1)}' +
        '</style></head><body>' +
        '<div class="w"><div class="eye">component \xb7 ' + name + '</div>' +
        '<h1><em>' + taskShort + '</em></h1>' +
        '<p>Intentional. Minimal. The design carries its own argument before a word is read.</p>' +
        '<a href="#">Engage →</a></div></body></html>';
    }

    if (style === 'provocative') {
      return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
        '*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%}' +
        'body{background:#000;color:#fff;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:48px 36px}' +
        '.label{font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,107,107,.7);margin-bottom:20px;animation:si .5s ease both}' +
        '@keyframes si{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}' +
        'h1{font-size:clamp(26px,7vw,56px);font-weight:900;line-height:1;letter-spacing:-.02em;text-transform:uppercase;margin-bottom:14px;max-width:640px;animation:si .45s .1s ease both;opacity:0}' +
        '.acc{color:#ff6b6b}' +
        'p{font-size:13px;color:rgba(255,255,255,.4);max-width:440px;line-height:1.65;margin-bottom:28px;animation:si .45s .2s ease both;opacity:0}' +
        '.btns{display:flex;gap:10px;animation:si .45s .3s ease both;opacity:0}' +
        'button{padding:11px 22px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:opacity .15s;border:none}' +
        '.pri{background:#ff6b6b;color:#000}.pri:hover{opacity:.85}' +
        '.sec{background:transparent;border:1px solid rgba(255,255,255,.18)!important;color:rgba(255,255,255,.55)}' +
        '.sec:hover{border-color:rgba(255,255,255,.45)!important;color:#fff}' +
        '</style></head><body>' +
        '<span class="label">' + name + ' \xb7 Fight Mode</span>' +
        '<h1>' + taskShort.toUpperCase() + ' <span class="acc">\xb7</span></h1>' +
        '<p>No hedging. The direct version. Built to perform under pressure — not to comfort the cautious.</p>' +
        '<div class="btns"><button class="pri">GO NOW</button><button class="sec">LEARN MORE</button></div>' +
        '</body></html>';
    }

    if (style === 'technical') {
      return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
        '*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%}' +
        'body{background:#011627;color:#d6deeb;font-family:"JetBrains Mono","Fira Code",monospace;min-height:100vh;padding:32px;display:flex;flex-direction:column;justify-content:center}' +
        '.prompt{color:#637777;font-size:11px;margin-bottom:8px}\n' +
        'h1{font-size:clamp(18px,3.5vw,28px);font-weight:700;line-height:1.3;color:#7fdbca;margin-bottom:12px;letter-spacing:-.01em}' +
        '.desc{font-size:12px;color:#637777;line-height:1.6;max-width:480px;margin-bottom:24px}' +
        '.fn{color:#82aaff}.kw{color:#c792ea}.str{color:#c3e88d}' +
        'pre{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:4px;padding:16px;font-size:11px;line-height:1.6;color:#abb2bf;margin-bottom:20px}' +
        '.run{padding:8px 20px;background:#7fdbca;border:none;color:#011627;font-family:inherit;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;border-radius:2px;transition:opacity .15s}' +
        '.run:hover{opacity:.85}' +
        '</style></head><body>' +
        '<div class="prompt">// ' + name + ' \xb7 Design Output</div>' +
        '<h1><span class="kw">function</span> <span class="fn">solve</span>(<span class="str">"' + taskShort + '"</span>)</h1>' +
        '<div class="desc">Zero dependencies. Zero surprises. Tested against edge cases before shipping.</div>' +
        '<pre><span class="kw">const</span> result = <span class="fn">build</span>(\n  input: <span class="str">"' + taskShort.slice(0,30) + '..."</span>,\n  mode: <span class="str">"production"</span>,\n  verify: <span class="kw">true</span>\n})\n\n<span class="fn">console</span>.log(result); <span class="kw">// → clean output</span></pre>' +
        '<button class="run">&#9654; Run</button>' +
        '</body></html>';
    }

    /* Default: structured / encyclopedic / methodical */
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
      '*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%}' +
      'body{background:#0d1117;color:#c9d1d9;font-family:system-ui,-apple-system,sans-serif;min-height:100vh}' +
      'nav{padding:14px 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.06)}' +
      '.logo{font-weight:700;color:#e6edf3;font-size:14px;letter-spacing:-.01em}' +
      '.nlinks{display:flex;gap:20px;font-size:12px;color:rgba(255,255,255,.4)}' +
      '.hero{padding:52px 28px;max-width:660px;animation:hi .7s ease both}' +
      '@keyframes hi{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}' +
      '.badge{display:inline-block;padding:3px 11px;background:rgba(88,166,255,.1);border:1px solid rgba(88,166,255,.2);border-radius:20px;font-size:10px;color:#58a6ff;letter-spacing:.06em;margin-bottom:20px}' +
      'h1{font-size:clamp(20px,4.5vw,38px);font-weight:700;line-height:1.2;color:#e6edf3;letter-spacing:-.02em;margin-bottom:12px}' +
      'p{font-size:14px;color:#8b949e;line-height:1.65;margin-bottom:24px;max-width:500px}' +
      '.actions{display:flex;gap:10px;flex-wrap:wrap}' +
      '.bp{padding:9px 22px;background:#238636;border:1px solid rgba(240,246,252,.1);color:#fff;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;transition:background .15s}' +
      '.bp:hover{background:#2ea043}' +
      '.bg{padding:9px 22px;background:rgba(240,246,252,.04);border:1px solid rgba(240,246,252,.1);color:#c9d1d9;border-radius:6px;font-size:13px;cursor:pointer;transition:background .15s}' +
      '.bg:hover{background:rgba(240,246,252,.08)}' +
      '</style></head><body>' +
      '<nav><span class="logo">■ ' + name + '</span><div class="nlinks"><span>Docs</span><span>API</span><span>Pricing</span></div></nav>' +
      '<div class="hero">' +
        '<span class="badge">v2.0 \xb7 production ready</span>' +
        '<h1>' + taskShort + '</h1>' +
        '<p>Structured. Predictable. Built for teams that need reliable output at scale with zero drift and full auditability.</p>' +
        '<div class="actions"><button class="bp">Get Started</button><button class="bg">View Docs →</button></div>' +
      '</div></body></html>';
  }

  function buildResponse(model, task, format) {
    if (format === 'Design') return buildDesignHTML(model, task);
    if (format === 'Copy')   return buildCopyResponse(model, task);

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

  /* ── Typewriter ───────────────────────────────────────────── */
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

  /* ── FIGHT! cinematic flash ─────────────────────────────────── */
  function showFightFlash(done) {
    var flash = document.createElement('div');
    flash.className = 'ch-fight-flash';
    flash.innerHTML = '<div class="ch-fight-text">FIGHT!</div>';
    document.body.appendChild(flash);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { flash.classList.add('show'); });
    });
    setTimeout(function () {
      if (flash.parentNode) flash.parentNode.removeChild(flash);
      if (typeof done === 'function') done();
    }, 750);
  }

  /* ── Site-entrance splash (session-gated) ─────────────────────── */
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
      '<div class="ch-splash-corner tl"></div><div class="ch-splash-corner tr"></div>' +
      '<div class="ch-splash-corner bl"></div><div class="ch-splash-corner br"></div>' +
      '<div class="ch-splash-inner">' +
        '<div class="ch-splash-glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 9H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5c0 .83-.67 1.5-1.5 1.5h-5C2.67 11 2 10.33 2 9.5S2.67 8 3.5 8h5c.83 0 1.5.67 1.5 1.5z"/><path d="M8.5 15H10v-1.5c0-.83-.67-1.5-1.5-1.5S7 12.67 7 13.5s.67 1.5 1.5 1.5z"/></svg></div>' +
        '<div class="ch-splash-label">Forge Atlas \xb7 AI Fight Club</div>' +
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
        dismiss(); document.removeEventListener('keydown', onKey);
      }
    });
    setTimeout(dismiss, 6000);
  }

  /* ── Per-fight VS card (with FIGHT! flash after) ──────────────────── */
  function showEventSplash(modelA, modelB, format, done) {
    var pmr = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var dismissed = false;

    var sigA = (FA.SIGNATURES || {})[modelA.name] || {};
    var sigB = (FA.SIGNATURES || {})[modelB.name] || {};
    var hasRivalry = sigA.rival === modelB.name || sigB.rival === modelA.name;
    var rivalRecord = hasRivalry
      ? (sigA.rival === modelB.name ? sigA.rivalRecord : sigB.rivalRecord) || ''
      : '';
    var season = FA.SEASON || {};
    var eventNum = (season.totalBattles || 47) + 1;

    var overlay = document.createElement('div');
    overlay.className = 'ch-event-splash';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-label', modelA.name + ' vs ' + modelB.name);

    overlay.innerHTML =
      '<div class="ch-ev-bg"></div>' +
      '<div class="ch-ev-scan"></div>' +
      '<div class="ch-ev-inner">' +
        '<div class="ch-ev-header">' +
          '<div class="ch-ev-eyebrow">Forge Atlas \xb7 Fight Night</div>' +
          (hasRivalry ? '<div class="ch-ev-rivalry">⚡ Rivalry Match \xb7 ' + esc(rivalRecord) + '</div>' : '') +
          '<div class="ch-ev-event-num">Season ' + esc(String(season.number || 1)) + ' \xb7 Event #' + esc(String(eventNum)) + '</div>' +
        '</div>' +
        '<div class="ch-ev-matchup">' +
          '<div class="ch-ev-fighter ch-ev-a color-' + esc(modelA.color || 'gold') + '">' +
            '<div class="ch-ev-f-initials">' + initials(modelA.name) + '</div>' +
            '<div class="ch-ev-f-name">' + esc(modelA.name) + '</div>' +
            '<div class="ch-ev-f-org">' + esc(modelA.org || '') + '</div>' +
            '<div class="ch-ev-f-city">' + esc(modelA.region || '') + '</div>' +
            '<div class="ch-ev-f-elo">ELO ' + esc(String(modelA.elo || '—')) + '</div>' +
            '<div class="ch-ev-f-weight">' + esc(weightClass(modelA)) + '</div>' +
            (sigA.signature ? '<div class="ch-ev-f-sig">"' + esc(sigA.signature.split('.')[0]) + '"</div>' : '') +
          '</div>' +
          '<div class="ch-ev-vs">' +
            '<div class="ch-ev-vs-text">VS</div>' +
            '<div class="ch-ev-format-badge">' + esc(format) + '</div>' +
          '</div>' +
          '<div class="ch-ev-fighter ch-ev-b color-' + esc(modelB.color || 'cyan') + '">' +
            '<div class="ch-ev-f-initials">' + initials(modelB.name) + '</div>' +
            '<div class="ch-ev-f-name">' + esc(modelB.name) + '</div>' +
            '<div class="ch-ev-f-org">' + esc(modelB.org || '') + '</div>' +
            '<div class="ch-ev-f-city">' + esc(modelB.region || '') + '</div>' +
            '<div class="ch-ev-f-elo">ELO ' + esc(String(modelB.elo || '—')) + '</div>' +
            '<div class="ch-ev-f-weight">' + esc(weightClass(modelB)) + '</div>' +
            (sigB.signature ? '<div class="ch-ev-f-sig">"' + esc(sigB.signature.split('.')[0]) + '"</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="ch-ev-footer"><div class="ch-ev-cta">tap to start \xb7 auto in 3s</div></div>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      clearTimeout(timer);
      overlay.classList.add('exiting');
      document.body.style.overflow = '';
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        /* FIGHT! flash before starting battle */
        if (pmr) { if (typeof done === 'function') done(); }
        else showFightFlash(done);
      }, 500);
    }

    var timer = setTimeout(dismiss, pmr ? 50 : 3000);
    overlay.addEventListener('click', dismiss);
  }

  /* ── Setup panel ────────────────────────────────────────────── */
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
        return '<option value="' + esc(m.name) + '"' + (m.name === selected.name ? ' selected' : '') + '>' + esc(m.name) + ' \xb7 ' + esc(m.org) + '</option>';
      }).join('');
    }

    function previewHtml(model) {
      if (!model) return '';
      return '<strong>' + esc(model.name) + '</strong> \xb7 ' + esc(model.org) +
        (model.region ? ' <span class="ch-preview-city">\xb7 ' + esc(model.region) + '</span>' : '') +
        '<em style="display:block;margin-top:4px">' + esc((model.personality || model.tagline || '').split('.')[0]) + '.</em>' +
        '<span class="ch-elo">ELO ' + (model.elo || '—') + ' \xb7 ' + (model.w || 0) + 'W ' + (model.l || 0) + 'L</span>' +
        '<span class="ch-weight-preview">' + esc(weightClass(model)) + '</span>';
    }

    host.innerHTML =
      '<div class="ch-vs-row">' +
        '<div class="ch-model-picker" id="ch-picker-a">' +
          '<label for="ch-select-a">Corner A</label>' +
          '<select class="ch-model-select" id="ch-select-a">' + modelOptions(defaultA) + '</select>' +
          '<div class="ch-model-preview" id="ch-preview-a">' + previewHtml(defaultA) + '</div>' +
        '</div>' +
        '<div class="ch-vs-label">VS</div>' +
        '<div class="ch-model-picker" id="ch-picker-b">' +
          '<label for="ch-select-b">Corner B</label>' +
          '<select class="ch-model-select" id="ch-select-b">' + modelOptions(defaultB) + '</select>' +
          '<div class="ch-model-preview" id="ch-preview-b">' + previewHtml(defaultB) + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="ch-format-row">' +
        '<label class="ch-format-label">Fight Format</label>' +
        '<div class="ch-formats">' +
          FORMATS.map(function (f) {
            return '<button class="ch-format-btn' + (f === state.format ? ' active' : '') + '" data-fmt="' + esc(f) + '">' + esc(f) + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +

      '<div class="ch-task-row">' +
        '<label class="ch-task-label" for="ch-task">Set the challenge</label>' +
        '<textarea class="ch-task-input" id="ch-task" maxlength="600" placeholder="e.g. &quot;Explain recursion to a 10-year-old&quot; \xb7 &quot;Is AGI inevitable?&quot; \xb7 &quot;Hero section for a SaaS product&quot; \xb7 &quot;Landing page copy for an AI tool&quot;"></textarea>' +
        '<div class="ch-task-hint">Any task, any format. The AIs respond in their own voice — code previews live.</div>' +
      '</div>' +

      '<div class="ch-launch-row">' +
        '<button class="ch-launch-btn" id="ch-launch" disabled>Fight Night</button>' +
        '<span class="ch-launch-note" id="ch-launch-note">Enter a challenge to begin</span>' +
      '</div>';

    $('#ch-select-a').addEventListener('change', function () {
      state.modelA = FA.helpers.byName(this.value) || models[0];
      $('#ch-preview-a').innerHTML = previewHtml(state.modelA);
    });
    $('#ch-select-b').addEventListener('change', function () {
      state.modelB = FA.helpers.byName(this.value) || models[1];
      $('#ch-preview-b').innerHTML = previewHtml(state.modelB);
    });

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
      launchNote.textContent = valid ? 'Ready \xb7 ' + state.task.length + ' / 600' : 'Enter a challenge to begin';
    });

    launchBtn.addEventListener('click', function () {
      if (!state.task || !state.modelA || !state.modelB) return;
      launchBattle();
    });
  }

  /* ── Launch battle ───────────────────────────────────────────── */
  function launchBattle() {
    state.phase = 'battle';
    state.battleId++;
    state.bothDone = false;
    var currentId = state.battleId;

    showEventSplash(state.modelA, state.modelB, state.format, function () {
      if (state.battleId !== currentId) return;

      var setupEl = $('#ch-setup-section');
      if (setupEl) setupEl.style.display = 'none';

      var battleEl = $('#ch-battle-section');
      if (battleEl) battleEl.classList.add('active');

      var sigA = (FA.SIGNATURES || {})[state.modelA.name] || {};
      var sigB = (FA.SIGNATURES || {})[state.modelB.name] || {};
      var hasRivalry = sigA.rival === state.modelB.name || sigB.rival === state.modelA.name;
      var rivalRecord = hasRivalry
        ? (sigA.rival === state.modelB.name ? sigA.rivalRecord : sigB.rivalRecord) || ''
        : '';

      var header = $('#ch-battle-header');
      if (header) {
        header.innerHTML =
          (hasRivalry ? '<div class="ch-rivalry-banner">⚡ Rivalry Match \xb7 ' + esc(rivalRecord) + '</div>' : '') +
          '<div class="ch-battle-id mono">Fight Night \xb7 ' + esc(state.format.toUpperCase()) + '</div>' +
          '<div class="ch-battle-format">' + esc(state.format) + '</div>' +
          '<div class="ch-battle-topic">' + esc(state.task.length > 100 ? state.task.slice(0, 100) + '…' : state.task) + '</div>';
      }

      renderFighter('a', state.modelA);
      renderFighter('b', state.modelB);

      /* reset swipe to fighter A */
      var arena = $('#ch-arena');
      if (arena) arena.scrollLeft = 0;
      updateSwipeDots(0);

      /* hide compare bar from previous battle */
      var compareBar = $('#ch-compare-bar');
      if (compareBar) compareBar.classList.remove('visible');

      state.respA = buildResponse(state.modelA, state.task, state.format);
      state.respB = buildResponse(state.modelB, state.task, state.format);

      var liveUrl = FA.LLM_WORKER_URL || (FA.API && FA.API.endpoints && FA.API.endpoints.arena);
      if (liveUrl && FA.API && FA.API.available && FA.API.available.arena) {
        runLiveBattle(currentId, state.respA, state.respB);
      } else {
        runScriptedBattle(currentId, state.respA, state.respB);
      }
    });
  }

  /* ── Render fighter card ───────────────────────────────────────── */
  function renderFighter(side, model) {
    var host = $('#ch-fighter-' + side);
    if (!host) return;
    var sig = (FA.SIGNATURES || {})[model.name] || {};
    var record = (model.w || 0) + 'W \xb7 ' + (model.l || 0) + 'L';
    var isCode   = (state.format === 'Code');
    var isDesign = (state.format === 'Design');
    var isCodeLike = isCode || isDesign;

    host.className = 'ch-fighter color-' + (model.color || 'gold');

    var tabsHtml = isCodeLike
      ? '<div class="ch-fighter-tabs">' +
          '<button class="ch-fighter-tab active" data-tab="code" aria-pressed="true">' + (isDesign ? 'Source' : 'Code') + '</button>' +
          '<button class="ch-fighter-tab" data-tab="preview" aria-pressed="false">Preview</button>' +
        '</div>'
      : '';

    var bodyHtml;
    if (isCodeLike) {
      bodyHtml =
        '<div class="ch-code-wrap" id="ch-body-' + side + '">' +
          '<div class="ch-code-block" id="ch-code-' + side + '">' +
            '<div class="ch-fighter-thinking" id="ch-thinking-' + side + '">' +
              '<span class="ch-thinking-dots"><span></span><span></span><span></span></span>' +
              '<span>' + esc(model.name) + (isDesign ? ' is designing…' : ' is coding…') + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="ch-code-actions" id="ch-code-actions-' + side + '">' +
            '<button class="ch-code-btn" id="ch-copy-' + side + '">Copy</button>' +
            '<button class="ch-code-btn ch-preview-trigger" id="ch-preview-btn-' + side + '">▶ Preview</button>' +
          '</div>' +
          '<div class="ch-preview-wrap" id="ch-preview-wrap-' + side + '">' +
            '<iframe class="ch-preview-frame" id="ch-iframe-' + side + '" sandbox="allow-scripts" title="' + esc(model.name) + ' preview"></iframe>' +
          '</div>' +
        '</div>';
    } else {
      bodyHtml =
        '<div class="ch-fighter-body" id="ch-body-' + side + '">' +
          '<div class="ch-fighter-thinking" id="ch-thinking-' + side + '">' +
            '<span class="ch-thinking-dots"><span></span><span></span><span></span></span>' +
            '<span>' + esc(model.name) + ' is thinking…</span>' +
          '</div>' +
        '</div>';
    }

    host.innerHTML =
      '<div class="ch-fighter-head">' +
        '<div class="ch-fighter-avatar">' + initials(model.name) + '</div>' +
        '<div class="ch-fighter-info">' +
          '<div class="ch-fighter-name">' + esc(model.name) + '</div>' +
          '<div class="ch-fighter-org">' + esc(model.org || '') +
            (model.region ? ' \xb7 <span class="ch-fighter-city">' + esc(model.region) + '</span>' : '') +
          '</div>' +
          '<div class="ch-fighter-weight">' + esc(weightClass(model)) + '</div>' +
        '</div>' +
        '<div class="ch-fighter-elo">' +
          '<strong>' + (model.elo || '—') + '</strong>ELO' +
          '<span class="ch-fighter-record">' + record + '</span>' +
        '</div>' +
      '</div>' +
      (sig.signature ? '<div class="ch-fighter-sig">"' + esc(sig.signature.split('.')[0]) + '."</div>' : '') +
      tabsHtml +
      bodyHtml;

    if (isCodeLike) {
      /* Tab switching */
      host.querySelectorAll('.ch-fighter-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          var tabName = tab.getAttribute('data-tab');
          host.querySelectorAll('.ch-fighter-tab').forEach(function (t) {
            t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
            t.setAttribute('aria-pressed', String(t.getAttribute('data-tab') === tabName));
          });
          var codeEl = document.getElementById('ch-code-' + side);
          var prevWrap = document.getElementById('ch-preview-wrap-' + side);
          if (codeEl) codeEl.style.display = tabName === 'code' ? '' : 'none';
          if (prevWrap) prevWrap.classList.toggle('active', tabName === 'preview');
        });
      });

      /* Copy button */
      var copyBtn = document.getElementById('ch-copy-' + side);
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          var codeEl = document.getElementById('ch-code-' + side);
          var text = codeEl ? (codeEl.querySelector('.ch-response-text') || codeEl).textContent : '';
          try { navigator.clipboard.writeText(text); } catch (e) {
            var ta = document.createElement('textarea');
            ta.value = text; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); } catch (ex) {}
            document.body.removeChild(ta);
          }
          copyBtn.textContent = '✓ Copied';
          copyBtn.classList.add('copied');
          triggerPreview(side);
          setTimeout(function () { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 2000);
        });
      }

      /* Preview button */
      var prevBtn = document.getElementById('ch-preview-btn-' + side);
      if (prevBtn) {
        prevBtn.addEventListener('click', function () { triggerPreview(side); });
      }
    }
  }

  /* ── Bolt.new style: Copy opens live preview ──────────────────────── */
  function triggerPreview(side) {
    var iframe   = document.getElementById('ch-iframe-' + side);
    var prevWrap = document.getElementById('ch-preview-wrap-' + side);
    var codeEl   = document.getElementById('ch-code-' + side);
    var prevBtn  = document.getElementById('ch-preview-btn-' + side);
    var host     = document.getElementById('ch-fighter-' + side);
    if (!iframe || !prevWrap) return;

    var html;
    if (state.format === 'Design') {
      /* Design: content IS the HTML page */
      var textNode = codeEl ? codeEl.querySelector('.ch-response-text') : null;
      html = textNode ? textNode.textContent : (side === 'a' ? state.respA : state.respB);
    } else {
      /* Code: wrap raw text in a minimal viewer */
      var raw = codeEl ? (codeEl.querySelector('.ch-response-text') || codeEl).textContent : '';
      html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
        '*{margin:0;padding:0;box-sizing:border-box}' +
        'body{background:#0d1117;color:#abb2bf;font-family:"JetBrains Mono","Fira Code",monospace;font-size:12.5px;line-height:1.7;padding:20px;overflow-x:auto}' +
        'pre{white-space:pre-wrap;word-break:break-word}' +
        '</style></head><body><pre>' + raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</pre></body></html>';
    }

    iframe.srcdoc = html;
    prevWrap.classList.add('active');
    if (codeEl) codeEl.style.display = 'none';

    /* Switch to preview tab */
    if (host) {
      host.querySelectorAll('.ch-fighter-tab').forEach(function (t) {
        var isPreview = t.getAttribute('data-tab') === 'preview';
        t.classList.toggle('active', isPreview);
        t.setAttribute('aria-pressed', String(isPreview));
      });
    }
    if (prevBtn) {
      prevBtn.textContent = '✓ Live';
      prevBtn.classList.add('previewing');
    }
  }

  /* ── Show response (typewriter or code) ─────────────────────────── */
  function showResponse(side, text, cps, done) {
    var isCodeLike = (state.format === 'Code' || state.format === 'Design');

    if (isCodeLike) {
      var codeBlock = document.getElementById('ch-code-' + side);
      var thinking  = document.getElementById('ch-thinking-' + side);
      if (thinking) thinking.style.display = 'none';
      if (!codeBlock) { if (done) done(); return; }

      if (state.format === 'Design') {
        /* Show truncated source, then auto-preview */
        var preview = text.slice(0, 160) + '…';
        var span = document.createElement('span');
        span.className = 'ch-response-text';
        span.textContent = preview;
        codeBlock.appendChild(span);
        var acts = document.getElementById('ch-code-actions-' + side);
        if (acts) acts.classList.add('visible');
        setTimeout(function () {
          triggerPreview(side);
          if (done) done();
        }, 900);
        return;
      }

      typeText(codeBlock, text, cps, function () {
        var acts = document.getElementById('ch-code-actions-' + side);
        if (acts) acts.classList.add('visible');
        if (done) done();
      });
    } else {
      var body    = document.getElementById('ch-body-' + side);
      var think2  = document.getElementById('ch-thinking-' + side);
      if (!body) { if (done) done(); return; }
      if (think2) think2.style.display = 'none';
      typeText(body, text, cps, done);
    }
  }

  /* ── Scripted battle engine ───────────────────────────────────────── */
  function runScriptedBattle(battleId, respA, respB) {
    var styleA = getStyle(state.modelA.name);
    var styleB = getStyle(state.modelB.name);
    var CPS = { structured: 40, philosophical: 30, encyclopedic: 50, provocative: 52, elegant: 36, technical: 58, methodical: 24 };
    var cpsA = CPS[styleA] || 38;
    var cpsB = CPS[styleB] || 38;

    var doneA = false, doneB = false;
    function checkBothDone() {
      if (doneA && doneB && !state.bothDone) {
        state.bothDone = true;
        showVotePanel();
      }
    }

    var thinkA = 800 + Math.random() * 600;
    setTimeout(function () {
      if (state.battleId !== battleId) return;
      showResponse('a', respA, cpsA, function () {
        if (state.battleId !== battleId) return;
        doneA = true; checkBothDone();
      });
    }, thinkA);

    var thinkB = 1200 + Math.random() * 800;
    var thinkingB = document.getElementById('ch-thinking-b');
    if (thinkingB) thinkingB.style.display = 'flex';
    setTimeout(function () {
      if (state.battleId !== battleId) return;
      showResponse('b', respB, cpsB, function () {
        if (state.battleId !== battleId) return;
        doneB = true; checkBothDone();
      });
    }, thinkB);
  }

  /* ── Live battle (Worker) ───────────────────────────────────────────── */
  function runLiveBattle(battleId, respA, respB) {
    fetch('/api/arena-llm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        matchId: 'ch-' + battleId,
        a: state.modelA.name, b: state.modelB.name,
        topic: state.task, format: state.format,
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

  /* ── Vote panel ────────────────────────────────────────────────── */
  function showVotePanel() {
    var vote = $('#ch-vote');
    if (!vote) return;
    vote.classList.add('active');
    var q = $('#ch-vote-question');
    if (q) q.textContent = 'Who handled "' + (state.task.length > 50 ? state.task.slice(0, 50) + '…' : state.task) + '" better?';
    var btnA = $('#ch-vote-btn-a');
    var btnB = $('#ch-vote-btn-b');
    if (btnA) { btnA.textContent = state.modelA.name + ' wins'; btnA.addEventListener('click', function () { castVote('a'); }); }
    if (btnB) { btnB.textContent = state.modelB.name + ' wins'; btnB.addEventListener('click', function () { castVote('b'); }); }
    var draw = $('#ch-vote-btn-draw');
    if (draw) draw.addEventListener('click', function () { castVote('draw'); });
    vote.scrollIntoView({ behavior: 'smooth', block: 'center' });

    /* Show compare bar after battle completes */
    var compareBar = $('#ch-compare-bar');
    if (compareBar) compareBar.classList.add('visible');
  }

  function castVote(side) {
    state.winner = side;
    try {
      var cv = parseInt(localStorage.getItem('forge.challenge.votes') || '0', 10);
      localStorage.setItem('forge.challenge.votes', String(cv + 1));
    } catch (e) {}
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
    var winSub  = $('#ch-result-sub');

    if (state.winner === 'draw') {
      if (winName) winName.textContent = 'DRAW';
      if (winSub)  winSub.textContent = 'Too close to call. Both AIs brought their A-game.';
    } else if (winnerModel) {
      if (winName) winName.textContent = winnerModel.name;
      var tagline = winnerModel.tagline ? '"' + winnerModel.tagline + '"' : '';
      if (winSub)  winSub.textContent = 'The crowd has spoken. ' + tagline;
    }
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ── Compare overlay ─────────────────────────────────────────────── */
  function initCompare() {
    var toggleBtn = $('#ch-compare-toggle');
    if (!toggleBtn) return;

    var overlay = document.createElement('div');
    overlay.id = 'ch-compare-overlay';
    overlay.className = 'ch-compare-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Compare AI responses');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="ch-compare-head">' +
        '<span class="ch-compare-head-title">Side by Side \xb7 Compare</span>' +
        '<button class="ch-compare-head-close" id="ch-compare-close">✕ Close</button>' +
      '</div>' +
      '<div class="ch-compare-panes">' +
        '<div class="ch-compare-pane a" id="ch-compare-pane-a">' +
          '<span class="ch-compare-pane-label" id="ch-compare-label-a">Fighter A</span>' +
          '<div class="ch-compare-content" id="ch-compare-content-a"></div>' +
        '</div>' +
        '<div class="ch-compare-divider" id="ch-compare-divider" role="separator" aria-label="Drag to resize"></div>' +
        '<div class="ch-compare-pane b" id="ch-compare-pane-b">' +
          '<span class="ch-compare-pane-label" id="ch-compare-label-b">Fighter B</span>' +
          '<div class="ch-compare-content" id="ch-compare-content-b"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    toggleBtn.addEventListener('click', function () {
      openCompareView();
    });

    document.getElementById('ch-compare-close').addEventListener('click', function () {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      toggleBtn.classList.remove('active');
    });

    /* Draggable divider */
    var divider = document.getElementById('ch-compare-divider');
    var panes = overlay.querySelector('.ch-compare-panes');
    var dragging = false;
    divider.addEventListener('mousedown', function (e) { dragging = true; e.preventDefault(); });
    document.addEventListener('mousemove', function (e) {
      if (!dragging || !panes) return;
      var rect = panes.getBoundingClientRect();
      var pct = Math.min(85, Math.max(15, ((e.clientX - rect.left) / rect.width) * 100));
      panes.style.gridTemplateColumns = pct + '% 4px ' + (100 - pct) + '%';
    });
    document.addEventListener('mouseup', function () { dragging = false; });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) {
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        toggleBtn.classList.remove('active');
      }
    });
  }

  function openCompareView() {
    var overlay = document.getElementById('ch-compare-overlay');
    if (!overlay) return;

    var labelA = document.getElementById('ch-compare-label-a');
    var labelB = document.getElementById('ch-compare-label-b');
    var contentA = document.getElementById('ch-compare-content-a');
    var contentB = document.getElementById('ch-compare-content-b');

    if (labelA && state.modelA) labelA.textContent = state.modelA.name;
    if (labelB && state.modelB) labelB.textContent = state.modelB.name;

    var isCodeLike = (state.format === 'Code' || state.format === 'Design');

    if (isCodeLike && contentA && contentB) {
      /* Show iframes side by side for code/design */
      contentA.innerHTML = '<iframe class="ch-compare-iframe" sandbox="allow-scripts" srcdoc="' + state.respA.replace(/"/g, '&quot;') + '" title="' + esc((state.modelA || {}).name || 'A') + '"></iframe>';
      contentB.innerHTML = '<iframe class="ch-compare-iframe" sandbox="allow-scripts" srcdoc="' + state.respB.replace(/"/g, '&quot;') + '" title="' + esc((state.modelB || {}).name || 'B') + '"></iframe>';
    } else {
      if (contentA) {
        var bodyA = document.getElementById('ch-body-a');
        contentA.textContent = bodyA ? bodyA.textContent : state.respA;
      }
      if (contentB) {
        var bodyB = document.getElementById('ch-body-b');
        contentB.textContent = bodyB ? bodyB.textContent : state.respB;
      }
    }

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    var toggleBtn = $('#ch-compare-toggle');
    if (toggleBtn) toggleBtn.classList.add('active');
  }

  /* ── Mobile swipe (scroll-snap + dots) ────────────────────────────── */
  function initSwipe() {
    var arena = document.getElementById('ch-arena');
    if (!arena) return;

    arena.addEventListener('scroll', function () {
      var idx = Math.round(arena.scrollLeft / Math.max(1, arena.offsetWidth));
      updateSwipeDots(idx);
    }, { passive: true });

    var prevBtn = document.getElementById('ch-swipe-prev');
    var nextBtn = document.getElementById('ch-swipe-next');
    if (prevBtn) prevBtn.addEventListener('click', function () {
      arena.scrollTo({ left: 0, behavior: 'smooth' });
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      arena.scrollTo({ left: arena.offsetWidth, behavior: 'smooth' });
    });
  }

  function updateSwipeDots(idx) {
    $$('.ch-swipe-dot').forEach(function (dot, i) {
      dot.classList.toggle('active', i === idx);
    });
    var prev = document.getElementById('ch-swipe-prev');
    var next = document.getElementById('ch-swipe-next');
    if (prev) prev.disabled = idx === 0;
    if (next) next.disabled = idx === 1;
  }

  /* ── Reset challenge ──────────────────────────────────────────────── */
  function resetChallenge() {
    state.battleId++;
    state.phase = 'setup';
    state.winner = null;
    state.bothDone = false;
    state.respA = '';
    state.respB = '';

    var battleEl = $('#ch-battle-section');
    if (battleEl) battleEl.classList.remove('active');
    var setupEl = $('#ch-setup-section');
    if (setupEl) setupEl.style.display = '';
    var voteEl = $('#ch-vote');
    if (voteEl) voteEl.classList.remove('active');
    var resultEl = $('#ch-result');
    if (resultEl) resultEl.classList.remove('active');
    var compareBar = $('#ch-compare-bar');
    if (compareBar) compareBar.classList.remove('visible');

    var overlay = document.getElementById('ch-compare-overlay');
    if (overlay && overlay.classList.contains('open')) {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    renderSetup();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initSplash();
    renderSetup();
    var resetBtn = $('#ch-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetChallenge);
    initCompare();
    initSwipe();
  });

  FA.Challenge = { reset: resetChallenge };
})();
