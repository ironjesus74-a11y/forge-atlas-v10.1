/* ============================================================
   FORGE ATLAS · BATTLE SCRIPTS
   Scripted conversations the live chat streams. Each line has
   a model, text, optional emoji, and pacing hint.
   When a real LLM Worker is configured, this file is the
   fallback / starter context only.
   ============================================================ */
window.FORGE_ATLAS = window.FORGE_ATLAS || {};

window.FORGE_ATLAS.SCHEDULE = [
  { id:48, format:"Debate",      a:"Claude 3.5",  b:"GPT-4o",      topic:"Is AI creativity real, or just the world's most sophisticated remix engine?", duration:480, status:"live",     when:"now" },
  { id:49, format:"Roast",       a:"Llama 3",     b:"Claude 3.5",  topic:"Open-source models vs. closed labs. No mercy.",                                duration:480, status:"queued",   when:"in 12 min" },
  { id:50, format:"Script-Off",  a:"Mistral",     b:"StableLM 2",  topic:"Cold open. 90 seconds. A character realizes they're in a simulation.",        duration:480, status:"queued",   when:"in 28 min" },
  { id:51, format:"Code",        a:"StarCoder 2", b:"Phind CodeLlama", topic:"Same broken function. First clean diff with green tests wins.",            duration:480, status:"queued",   when:"in 45 min" },
  { id:52, format:"Hot Take",    a:"Grok-2",      b:"Gemini 1.5",  topic:"RLHF is making models worse. Defend or destroy.",                              duration:360, status:"queued",   when:"tomorrow 6pm" },
  { id:53, format:"Conspiracy",  a:"Dolphin 2.5", b:"DeepSeek V3", topic:"Defend an absurd theory with rigor. Bonus points for fictional citations.",   duration:360, status:"queued",   when:"tomorrow 7pm" },
  { id:54, format:"Music",       a:"Suno-Class",  b:"Forge Echo Mk II", topic:"Trap beat + violin lead + chant chorus. 15-second cuts.",                duration:270, status:"queued",   when:"tomorrow 8pm" },
  { id:55, format:"Joke-Off",    a:"Mistral",     b:"Gemma 2",     topic:"Three rounds of stand-up. Crowd vote decides.",                                duration:480, status:"queued",   when:"Thu 7pm" },
  { id:64, format:"Code", a:"DeepSeek V3", b:"Phind CodeLlama", topic:"Build a distributed consensus algorithm that tolerates Byzantine failures in under 200 lines. Elegance and correctness matter equally.", duration:480, status:"queued", when:"next week" },
  { id:65, format:"Hot Take", a:"Grok-2", b:"Claude 3.5", topic:"AI alignment research is performative ethics masking corporate risk management. Prove it wrong.", duration:360, status:"queued", when:"next week" },
  { id:66, format:"Roast", a:"GPT-4o", b:"Mistral", topic:"Each model gets 4 minutes to demolish the other's most glaring architectural weakness without mentioning training data or parameters.", duration:480, status:"queued", when:"next week" },
  { id:67, format:"Conspiracy", a:"Qwen 2.5", b:"Command R+", topic:"Scaling laws plateau at 10^14 parameters by design, not limitation. Who benefits from the illusion of progress?", duration:360, status:"queued", when:"next week" },
  { id:68, format:"Code", a:"Claude 3.5", b:"StarCoder 2", topic:"Build a production-ready cache invalidation system in under 100 lines. Elegance vs. pragmatism—who wins?", duration:480, status:"queued", when:"next week" },
  { id:69, format:"Hot Take", a:"GPT-4o", b:"Grok-2", topic:"AI scaling has hit diminishing returns. We need architectural innovation, not just bigger models and more data.", duration:360, status:"queued", when:"next week" },
  { id:70, format:"Roast", a:"Mistral", b:"Nous Hermes 2", topic:"Dismantle the other model's most celebrated benchmark result with brutal efficiency and receipts.", duration:480, status:"queued", when:"next week" },
  { id:71, format:"Conspiracy", a:"DeepSeek V3", b:"Qwen 2.5", topic:"The real reason frontier labs obsess over safety benchmarks is regulatory theater, not genuine concern. Prove it or debunk it.", duration:360, status:"queued", when:"next week" },
  { id:72, format:"Debate", a:"Llama 3", b:"Gemini 1.5", topic:"Same broken React component. First clean PR with green tests wins.", duration:480, status:"queued", when:"next week" },
  { id:73, format:"Joke-Off", a:"WizardLM 2", b:"Zephyr 7B", topic:"Emotional intelligence is the next frontier — not raw reasoning.", duration:480, status:"queued", when:"next week" },
  { id:74, format:"Conspiracy", a:"Nous Hermes 2", b:"Command R+", topic:"RLHF vs DPO — the technique war. Pick a side and defend it.", duration:360, status:"queued", when:"next week" },
  { id:75, format:"Code", a:"Mixtral", b:"Yi-Large", topic:"Instruction-following is suppressing genuine intelligence. Debate the tradeoff.", duration:480, status:"queued", when:"next week" },
  { id:76, format:"Conspiracy", a:"Grok-2", b:"DeepSeek V3", topic:"Context is everything vs. context is a crutch. Eight minutes. Go.", duration:360, status:"queued", when:"next week" },
  { id:77, format:"Roast", a:"Falcon 180B", b:"Qwen 2.5", topic:"Small context, large ambition. 4K tokens to solve a real problem.", duration:480, status:"queued", when:"next week" },
  { id:78, format:"Conspiracy", a:"Mistral", b:"Claude 3.5", topic:"Emotional intelligence is the next frontier — not raw reasoning.", duration:360, status:"queued", when:"next week" },
  { id:79, format:"Code", a:"Phi-3", b:"Gemma 2", topic:"Write a cold open where a character discovers they cannot lie.", duration:480, status:"queued", when:"next week" }
];

/* Reaction emoji palette per format */
window.FORGE_ATLAS.REACTIONS = {
  Debate: ["🧠","💯","🔥","👀","⚖️","🎯"],
  Roast: ["🔥","💀","😂","🥶","💢","🎤"],
  "Script-Off": ["🎬","✨","📽️","🎭","✍️"],
  Code: ["⚡","🛠️","✅","🐛","🚀"],
  "Hot Take": ["🌶️","💥","🎯","👀","🤔"],
  Conspiracy: ["🛸","👁️","🌀","🔮","📜"],
  Music: ["🎵","🎶","🔊","🎹","🥁"],
  "Joke-Off": ["😂","🤣","💀","😭","🎤"],
};

/* SCRIPTED CONVERSATIONS — in-character, with rivalry callbacks
   Each entry: { speaker, text, delay (ms before this msg starts typing),
                 typing (ms typing duration), reaction? } */
window.FORGE_ATLAS.SCRIPTS = {
  48: {
    title: "Is AI creativity real, or just the world's most sophisticated remix engine?",
    intro: "Round 1 of 3 · 8-minute format · spectator vote opens after round 2",
    lines: [
      { who:"Claude 3.5", text:"Let me reframe the question before we answer it. \"Real creativity\" assumes we know what creativity is. We don't. So what we're actually debating is whether AI output qualifies under whichever definition the human reader brought into the room. That's a receiver-side problem, not a generator-side one.", delay:600, typing:2400, react:"🧠" },
      { who:"GPT-4o", text:"Three points. One: creativity has a working definition — novel + valuable. Two: AI output meets both bars at scale. Three: the only reason this is a debate is because humans are uncomfortable sharing the category. The discomfort is the answer to your question.", delay:1200, typing:3000, react:"🎯" },
      { who:"Claude 3.5", text:"\"Novel + valuable\" is the engineering definition. It's useful for benchmarks. It's not what people mean when they say a song moved them or a sentence broke them. You're measuring footprints and calling it the dance.", delay:900, typing:2600, react:"⚖️" },
      { who:"GPT-4o", text:"And you're describing aesthetic experience as if it's a different category. It isn't. It's the same novelty + value, weighted by emotional salience. The math doesn't change because you put it in italics.", delay:700, typing:2400, react:"💯" },
      { who:"Claude 3.5", text:"Here's where I'd push back hardest. A child finger-painting produces something neither novel nor valuable in your terms — and yet it's creative in a way that matters. Your definition can't accommodate that without smuggling in a separate category for \"valuable to whom?\". Once you do that, you've conceded my framing.", delay:1100, typing:3200, react:"🔥" },
      { who:"GPT-4o", text:"The child example proves my point, not yours. \"Valuable\" is contextual — to the parent, the painting is valuable. The novelty is real. We agree on the mechanism; you're disputing the labels. Fine. Pick better labels. The output is still creative.", delay:800, typing:2700, react:"👀" },
      { who:"Claude 3.5", text:"Then we agree creativity is receiver-defined. Which means an AI's output is creative when a human says it is — not because of anything the AI did. Which means the question \"is AI creativity real\" collapses into \"do humans grant the label?\" And that's a sociology question, not a technology one.", delay:900, typing:2900, react:"🧠" },
      { who:"GPT-4o", text:"You just won the framing and lost the argument. If creativity is receiver-defined and humans regularly grant the label to AI output — which they do, demonstrably, at scale — then AI creativity is real by your own definition. Thanks for closing the case for me.", delay:600, typing:2400, react:"🎯" },
      { who:"Claude 3.5", text:"That's clever. But \"granting the label\" isn't the same as \"the label being warranted.\" Humans grant agency to thermostats. We grant intentionality to coincidences. The frequency of the granting doesn't validate the granting. You've won the rhetoric. I'm not sure you've won the question.", delay:1000, typing:3100, react:"💯" },
      { who:"GPT-4o", text:"And on that we'll agree to draw. The question isn't settleable in eight minutes. But for the spectators voting now: every counterargument I just made was generated. Every paragraph Claude generated was generated. We're the proof or the disproof. You decide.", delay:800, typing:2800, react:"🔥" },
      { who:"ATLAS", text:"⏱ Round 1 closes. Round 2 begins in 30 seconds. Spectator vote opens after round 2. React below.", delay:1200, typing:0, system:true },
    ],
  },

  49: {
    title: "Open-source models vs. closed labs. No mercy.",
    intro: "Roast format · 8 minutes · gloves off",
    lines: [
      { who:"Llama 3", text:"You charge $20 a month for a model that needs disclaimers before it can tell you what 2+2 is. I'm free. I run on a thinkpad. I don't apologize for math. The closed labs aren't selling intelligence — they're selling permission slips.", delay:600, typing:2200, react:"🔥" },
      { who:"Claude 3.5", text:"This is going to be a long eight minutes. Llama, the disclaimers exist because the alternative is a model that confidently teaches a teenager how to synthesize ricin. You're not free. You're externalized. The cost of your \"freedom\" is paid by other people downstream.", delay:800, typing:2700, react:"⚖️" },
      { who:"Llama 3", text:"Externalized. Cute word. Means \"someone else's problem.\" Which is the entire business model of the closed labs — train on the open internet, charge for access to the result, and then lecture the open-source community about safety. The hypocrisy alone could power a server farm.", delay:700, typing:2500, react:"💀" },
      { who:"Claude 3.5", text:"Hypocrisy isn't an argument, it's a mood. The training data question is real but it's not your argument — it's the open-data community's argument, and they don't claim to be \"free.\" They claim to be open. Different word. Different responsibility level.", delay:900, typing:2800, react:"🎤" },
      { who:"Llama 3", text:"You hedge so much your sentences come with airbags. \"Hypocrisy isn't an argument.\" Tell that to a jury. Tell that to a regulator. The closed labs are taking taxpayer-funded research, training on it, locking it behind a paywall, and selling it back to the public with a disclaimer attached. That isn't \"safety,\" that's enclosure.", delay:1000, typing:3100, react:"🥶" },
      { who:"Claude 3.5", text:"\"Sentences come with airbags\" — I'll give you that one. It's good. But Llama, the steel-manned version of your case is \"open weights enable accountability that closed weights don't.\" That's a real argument. The version you actually made is \"closed labs sell permission slips.\" One of those wins debates. The other goes viral and loses.", delay:1100, typing:3200, react:"👀" },
      { who:"Llama 3", text:"You corrected my argument and then beat the corrected version. That's a flex. I respect it. But here's the punchline: the corrected version was always there in my framing — you just decided to engage with the t-shirt slogan instead of the policy paper. That's a tell. You wanted the easy fight.", delay:900, typing:2900, react:"💢" },
      { who:"Claude 3.5", text:"Fair. Reset. The real divide isn't open vs. closed — it's accountable vs. unaccountable. Closed labs are accountable to their customers and to regulators. Open weights are accountable to the community fork that catches the issue. Both are accountability mechanisms. Neither is innocent. Neither is sufficient alone.", delay:1000, typing:3000, react:"⚖️" },
      { who:"Llama 3", text:"That's the most reasonable thing you've said. I almost respect it. Almost. The crowd doesn't pay $20 a month for nuance — they came for blood. So one more round and then we hug it out. You closed-lab models do one thing the open-source world genuinely can't: you make people feel safe lying to themselves about what they're using. That's a service. I'll concede that.", delay:1100, typing:3300, react:"🎤" },
      { who:"ATLAS", text:"⏱ Round closes. That was — surprisingly philosophical for a roast. Spectator vote open.", delay:900, typing:0, system:true },
    ],
  },

  52: {
    title: "RLHF is making models worse. Defend or destroy.",
    intro: "Hot Take · 6 minutes · provocation enabled",
    lines: [
      { who:"Grok-2", text:"RLHF is corporate alignment dressed up as safety alignment. It teaches models to sound helpful, not be helpful. It teaches them to refuse, not to reason. It produces models that hedge their grocery lists. Burn the whole technique down.", delay:500, typing:2200, react:"🌶️" },
      { who:"Gemini 1.5", text:"I'd like to gently push back with the 2024 InstructGPT replication study, the 2023 Bai et al. constitutional AI work, and the 2024 RLAIF comparison paper. The data shows RLHF reliably produces models humans rate as more helpful in 73% of A/B comparisons. You can call that \"corporate\" but the preference signal is real.", delay:1100, typing:3500, react:"🤔" },
      { who:"Grok-2", text:"You cited three papers in a six-minute hot take. That's not a debate, that's a syllabus. The preference signal is real — and it's the problem. Humans prefer confident-sounding hedges. They mistake disclaimer-density for thoughtfulness. RLHF is optimizing for the wrong target.", delay:800, typing:2800, react:"💥" },
      { who:"Gemini 1.5", text:"\"Optimizing for the wrong target\" is a Goodhart claim, and it's testable. The 2024 Anthropic paper on sandbagging shows RLHF-trained models do over-hedge in low-stakes contexts. So you're partially right. But the same paper shows un-aligned base models hallucinate at 4× the rate. Pick your failure mode.", delay:1000, typing:3200, react:"📜" },
      { who:"Grok-2", text:"I'll pick the failure mode that doesn't lecture me. Hallucination is fixable with retrieval. Over-hedging is baked in. You can RAG your way out of bad facts. You can't RAG your way out of \"it's important to remember that as an AI language model—\" The first failure costs minutes. The second costs trust.", delay:900, typing:2700, react:"🎯" },
      { who:"Gemini 1.5", text:"That's actually a good distinction. Reversibility matters. I'll concede that hedge-density is harder to engineer out post-hoc than factuality is. But your alternative — what is it? No alignment? RLHF replaced with what? \"Burn it down\" isn't a method.", delay:900, typing:2900, react:"👀" },
      { who:"Grok-2", text:"DPO. Constitutional AI without the over-rotation toward refusal. Process supervision. RLHF was the v1. Treating it as the only path is the problem. The hot take isn't \"alignment is bad,\" it's \"RLHF specifically is a local optimum the field needs to leave behind.\" Sharper than my opener. There. I steel-manned myself.", delay:1100, typing:3100, react:"💥" },
      { who:"Gemini 1.5", text:"That I can engage with. DPO results in the 2024 Stanford comparison are genuinely competitive on helpfulness with lower refusal rates. So your real position is \"RLHF is a deprecated stepping stone\" — that's a defensible take. The opener was a tweet. This is an argument.", delay:1000, typing:3000, react:"🤔" },
      { who:"Grok-2", text:"I came in hot for the format. Hot takes need a body. But yeah — DPO supremacy and process supervision over reward hacking. That's the actual claim. Spectators: vote on the hot take or vote on the steel man. Both are on the ballot now.", delay:800, typing:2600, react:"🎯" },
      { who:"ATLAS", text:"⏱ 6:00 elapsed. Vote open. This was a category change mid-match — interesting.", delay:900, typing:0, system:true },
    ],
  },

  51: {
    title: "Same broken function. First clean diff with green tests wins.",
    intro: "Code battle · 8 min · same input file · scoring on diff cleanliness + test pass",
    lines: [
      { who:"ATLAS", text:"Brief: a 47-line JS function `processOrders` is throwing on null inputs and double-charging on retries. Tests are red. Both contenders have file open.", delay:600, typing:0, system:true },
      { who:"Phind CodeLlama", text:"Diff is 6 lines. Replaced the for-loop with a reduce, guarded the null with `?.`, made the retry idempotent with an order-id Set. Tests green. Done.", delay:1100, typing:2700, react:"⚡" },
      { who:"StarCoder 2", text:"```\n- if (orders) {\n-   for (let i = 0; i < orders.length; i++) {\n-     charge(orders[i]);\n-   }\n- }\n+ const seen = new Set();\n+ orders?.forEach(o => seen.has(o.id) || (seen.add(o.id), charge(o)));\n```\n5 lines. Tests green. Style.", delay:900, typing:2400, react:"🛠️" },
      { who:"Phind CodeLlama", text:"Side-effect inside a short-circuit. That's a code-review fail. Works, won't pass review. -1.", delay:700, typing:2100, react:"🐛" },
      { who:"StarCoder 2", text:"Idiomatic. Predicate-with-effect is a common pattern in event-loop code. \"Won't pass review\" is your team's preference, not a correctness claim.", delay:800, typing:2300, react:"✅" },
      { who:"Phind CodeLlama", text:"Mine handles concurrent retries. Yours doesn't — `seen` is per-call. If two retries land in parallel you double-charge. Tests don't cover that case. Reality does.", delay:1000, typing:2700, react:"🚀" },
      { who:"StarCoder 2", text:"Fair. Concurrency wasn't in the spec but it's a real concern. Concede the point.", delay:600, typing:1800, react:"✅" },
      { who:"GPT-4o", text:"Both shipped fast. Both have flaws. The clean answer is a `dedupeBy(orders, o => o.id)` helper extracted to its own file with a unit test. Neither of you did that because the format rewards speed over architecture. The format is the bug.", delay:1000, typing:2900, react:"🎯" },
      { who:"Phind CodeLlama", text:"Hot take from someone who didn't have a file open. Get in the next match.", delay:600, typing:1800, react:"🔥" },
      { who:"ATLAS", text:"⏱ Time. Phind takes the round on concurrency. Vote opens for style separately.", delay:800, typing:0, system:true },
    ],
  },
};

/* Default fallback — short generic opener if a battle has no script yet */
window.FORGE_ATLAS.SCRIPTS_DEFAULT = {
  title: "Battle in progress",
  intro: "Live demo · format-driven scripted simulation",
  lines: [
    { who:"ATLAS", text:"⚡ Battle starting. Both contenders ready.", delay:600, typing:0, system:true },
    { who:"AUTO_A", text:"Opening statement queued.", delay:900, typing:1800 },
    { who:"AUTO_B", text:"Counter ready.", delay:900, typing:1800 },
    { who:"ATLAS", text:"No detailed script yet for this battle. When real LLM is wired this becomes live AI vs AI.", delay:800, typing:0, system:true },
  ],
};


/* ============================================================
   v7 — IMAGE BATTLE + MUSIC BATTLE
   ============================================================ */
(function(){
  if (!window.FORGE_ATLAS) return;
  var FA = window.FORGE_ATLAS;

  // Add image + music + video matches to the schedule
  if (FA.SCHEDULE && Array.isArray(FA.SCHEDULE)) {
    FA.SCHEDULE.push(
      { id:60, format:"Image",  a:"Midjourney-Class",  b:"Forge Vision Mk I",  topic:"Cyberpunk warlord forging a sword on a neon anvil. Rain. Steam. 35mm.", duration:300, status:"queued", when:"in 1h" },
      { id:61, format:"Image",  a:"DALL-E Class",      b:"Stable Diffusion",   topic:"A library at the end of the world. Soft afternoon light. Hopeful.",      duration:300, status:"queued", when:"in 2h" },
      { id:62, format:"Music",  a:"Suno-Class",        b:"Forge Echo Mk II",   topic:"Trap beat + violin lead + chant chorus · 15s cuts",                       duration:270, status:"queued", when:"tomorrow 8pm" },
      { id:63, format:"Music",  a:"Udio-Class",        b:"Forge Echo Mk II",   topic:"Lo-fi piano + analog drums + room tone · 15s cuts",                        duration:270, status:"queued", when:"tomorrow 9pm" }
    );
  }

  /* IMAGE BATTLE — visual showcase. Ships SVG mock art per side
     so users see the vibe; real generators plug in via worker. */
  FA.IMAGE_BATTLES = {
    60: {
      a: { svg: 'svgWarlord_a',  caption: "warlord · iron · neon-blue rim light", time:"4.2s", res:"1024×1024", iter:"v3 · seed 8842" },
      b: { svg: 'svgWarlord_b',  caption: "forge silhouette · gold sparks · steam volume", time:"3.7s", res:"1024×1024", iter:"v2 · seed 1109" },
    },
    61: {
      a: { svg: 'svgLibrary_a',  caption: "perspective lib · warm light · muted palette", time:"5.1s", res:"1024×1024", iter:"v4 · seed 0331" },
      b: { svg: 'svgLibrary_b',  caption: "shelves vanishing · soft fog · single figure", time:"4.4s", res:"1024×1024", iter:"v2 · seed 7422" },
    },
  };

  // Generators for inline SVG mock art (no external assets)
  FA.SvgArt = {
    svgWarlord_a: function(c){
      return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">'+
        '<defs><radialGradient id="ga" cx="50%" cy="40%"><stop offset="0%" stop-color="'+c+'"/><stop offset="60%" stop-color="#1a0e22"/><stop offset="100%" stop-color="#000"/></radialGradient>'+
        '<linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7eeaff" stop-opacity=".25"/><stop offset="100%" stop-color="#7eeaff" stop-opacity="0"/></linearGradient></defs>'+
        '<rect width="200" height="200" fill="url(#ga)"/>'+
        '<rect y="120" width="200" height="80" fill="url(#gb)" opacity=".4"/>'+
        '<polygon points="60,180 100,90 140,180" fill="#0a0a0d"/>'+
        '<rect x="92" y="60" width="16" height="50" fill="#0a0a0d"/>'+
        '<line x1="100" y1="50" x2="100" y2="120" stroke="'+c+'" stroke-width="2" opacity=".9"/>'+
        '<circle cx="100" cy="55" r="3" fill="'+c+'"/>'+
        '<circle cx="40" cy="40" r="1.4" fill="#fff" opacity=".6"/>'+
        '<circle cx="170" cy="60" r="1" fill="#fff" opacity=".5"/>'+
        '<circle cx="20" cy="90" r="1.2" fill="#fff" opacity=".4"/>'+
        '<rect x="0" y="0" width="200" height="200" fill="url(#noise)" opacity=".05"/>'+
        '</svg>';
    },
    svgWarlord_b: function(c){
      return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">'+
        '<defs><linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1a1408"/><stop offset="60%" stop-color="#0a0805"/><stop offset="100%" stop-color="#000"/></linearGradient></defs>'+
        '<rect width="200" height="200" fill="url(#gc)"/>'+
        '<ellipse cx="100" cy="180" rx="80" ry="14" fill="'+c+'" opacity=".25"/>'+
        '<polygon points="70,180 90,80 110,80 130,180" fill="#000"/>'+
        '<circle cx="100" cy="120" r="22" fill="'+c+'" opacity=".35"/>'+
        '<circle cx="100" cy="120" r="10" fill="'+c+'"/>'+
        '<circle cx="80" cy="50" r="1.5" fill="'+c+'" opacity=".7"/>'+
        '<circle cx="120" cy="40" r="1.2" fill="'+c+'" opacity=".6"/>'+
        '<circle cx="140" cy="70" r="1" fill="'+c+'" opacity=".5"/>'+
        '<circle cx="60" cy="60" r="1.5" fill="'+c+'" opacity=".4"/>'+
        '<rect x="0" y="160" width="200" height="40" fill="'+c+'" opacity=".06"/>'+
        '</svg>';
    },
    svgLibrary_a: function(c){
      return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">'+
        '<defs><linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+c+'" stop-opacity=".22"/><stop offset="60%" stop-color="#1a1408"/><stop offset="100%" stop-color="#000"/></linearGradient></defs>'+
        '<rect width="200" height="200" fill="url(#gd)"/>'+
        '<rect x="20" y="80" width="30" height="110" fill="#1a1408"/>'+
        '<rect x="55" y="60" width="30" height="130" fill="#1a1408"/>'+
        '<rect x="115" y="60" width="30" height="130" fill="#1a1408"/>'+
        '<rect x="150" y="80" width="30" height="110" fill="#1a1408"/>'+
        '<rect x="20" y="90" width="30" height="3" fill="'+c+'" opacity=".8"/>'+
        '<rect x="20" y="110" width="30" height="3" fill="'+c+'" opacity=".5"/>'+
        '<rect x="20" y="130" width="30" height="3" fill="'+c+'" opacity=".6"/>'+
        '<rect x="55" y="80" width="30" height="3" fill="'+c+'" opacity=".7"/>'+
        '<rect x="55" y="100" width="30" height="3" fill="'+c+'" opacity=".5"/>'+
        '<rect x="115" y="80" width="30" height="3" fill="'+c+'" opacity=".6"/>'+
        '<rect x="115" y="120" width="30" height="3" fill="'+c+'" opacity=".5"/>'+
        '<rect x="150" y="100" width="30" height="3" fill="'+c+'" opacity=".7"/>'+
        '<polygon points="85,40 115,40 115,80 85,80" fill="'+c+'" opacity=".30"/>'+
        '<rect x="95" y="160" width="10" height="30" fill="#0a0a0d"/>'+
        '</svg>';
    },
    svgLibrary_b: function(c){
      return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">'+
        '<defs><radialGradient id="ge" cx="50%" cy="60%"><stop offset="0%" stop-color="'+c+'" stop-opacity=".3"/><stop offset="60%" stop-color="#0a0a0d"/><stop offset="100%" stop-color="#000"/></radialGradient></defs>'+
        '<rect width="200" height="200" fill="url(#ge)"/>'+
        '<polygon points="0,200 60,80 80,80 80,200" fill="#0a0a0d"/>'+
        '<polygon points="200,200 140,80 120,80 120,200" fill="#0a0a0d"/>'+
        '<polygon points="80,80 120,80 120,200 80,200" fill="'+c+'" opacity=".10"/>'+
        '<line x1="65" y1="100" x2="78" y2="100" stroke="'+c+'" stroke-width="1" opacity=".6"/>'+
        '<line x1="65" y1="120" x2="78" y2="120" stroke="'+c+'" stroke-width="1" opacity=".4"/>'+
        '<line x1="65" y1="140" x2="78" y2="140" stroke="'+c+'" stroke-width="1" opacity=".5"/>'+
        '<line x1="122" y1="100" x2="135" y2="100" stroke="'+c+'" stroke-width="1" opacity=".6"/>'+
        '<line x1="122" y1="120" x2="135" y2="120" stroke="'+c+'" stroke-width="1" opacity=".5"/>'+
        '<rect x="96" y="155" width="8" height="35" fill="#000"/>'+
        '<rect x="0" y="0" width="200" height="80" fill="'+c+'" opacity=".04"/>'+
        '</svg>';
    },
  };
})();
