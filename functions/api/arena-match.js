// Forge Atlas — REAL AI Arena v2.0. Divisions + topic pools + cost flags. FREE-first.
// Pages Function, native env.AI binding. Model IDs verified 2026-06.
// >>> ADD A MODEL = ADD ONE LINE. ADD A DIVISION = add to DIVISIONS + give it a topic pool. <<<

const DIVISIONS = {
  text:   { label:"Text / Debate",  status:"live",   blurb:"Same prompt. Sharpest answer wins." },
  code:   { label:"Code",           status:"live",   blurb:"Same problem. Cleanest solution wins." },
  webapp: { label:"Web / App",      status:"live",   blurb:"Build it. We render both side-by-side.", render:true },
  image:  { label:"Image / Art",    status:"live",   blurb:"Same brief. Best image wins." },
  music:  { label:"Music",          status:"coming", blurb:"Coming soon — no free music model exists yet." },
  voice:  { label:"Voice",          status:"coming", blurb:"Coming soon." },
  vision: { label:"Vision",         status:"coming", blurb:"Coming soon." },
};

const TOPIC_POOLS = {
  text: [
    "Is open-source AI inevitable, or will closed labs always lead?",
    "Defend an unpopular tech opinion in 120 words.",
    "Roast the phrase 'AI-powered' as a marketing term.",
    "What will matter more in 10 years: data or algorithms?",
    "Pitch why a junkyard is the perfect place to learn engineering.",
  ],
  code: [
    "Write a function that finds the longest palindrome in a string. Explain the tradeoff.",
    "Fix this race condition: two threads incrementing a shared counter without a lock.",
    "Implement a debounce function in plain JS. Under 20 lines.",
    "Reverse a linked list iteratively. Then say why recursion is worse here.",
    "Write a one-liner that flattens a nested array. Defend its readability.",
  ],
  webapp: [
    "Build a pricing card component: 3 tiers, hover effects. Single HTML file with inline CSS.",
    "Make a dark-mode hero section for an AI startup. One self-contained HTML file.",
    "Design a 404 page with personality. Inline CSS only.",
    "Build a countdown timer UI (static, no real JS clock needed). One HTML file.",
    "Create a testimonial slider layout (CSS only, no JS). Self-contained.",
  ],
  image: [
    "a chrome phoenix rising over a junkyard at dawn, cinematic",
    "a cozy reading nook on a spaceship, warm light, detailed",
    "a neon koi fish swimming through a rainy city street",
    "a lone lighthouse on a floating island in the clouds",
    "a steampunk owl made of brass gears, studio lighting",
  ],
};

const REGISTRY = [
  // ===== TEXT =====
  { key:"llama",     label:"Llama 3.3 70B",      division:"text",  provider:"cf", id:"@cf/meta/llama-3.3-70b-instruct-fp8-fast",     tier:"free", status:"live", persona:"Open-source heavyweight. Confident, blunt." },
  { key:"llama4",    label:"Llama 4 Scout",      division:"text",  provider:"cf", id:"@cf/meta/llama-4-scout-17b-16e-instruct",       tier:"free", status:"live", persona:"New blood. Multimodal, fast, hungry." },
  { key:"llama8b",   label:"Llama 3.1 8B",       division:"text",  provider:"cf", id:"@cf/meta/llama-3.1-8b-instruct-fast",           tier:"free", status:"live", persona:"Nimble featherweight. Quick on its feet." },
  { key:"gptoss20",  label:"GPT-OSS 20B",        division:"text",  provider:"cf", id:"@cf/openai/gpt-oss-20b",                        tier:"free", status:"live", persona:"OpenAI's open model. Sharp, efficient." },
  { key:"mistral",   label:"Mistral Small 24B",  division:"text",  provider:"cf", id:"@cf/mistralai/mistral-small-3.1-24b-instruct",  tier:"free", status:"live", persona:"French precision. Elegant, a little smug." },
  { key:"granite",   label:"Granite 4.0 Micro",  division:"text",  provider:"cf", id:"@cf/ibm-granite/granite-4.0-h-micro",           tier:"free", status:"live", persona:"IBM's compact workhorse. All business." },
  // ===== CODE =====
  { key:"qwencoder", label:"Qwen 2.5 Coder 32B", division:"code",  provider:"cf", id:"@cf/qwen/qwen2.5-coder-32b-instruct",           tier:"free", status:"live", persona:"Code assassin. The diff does the talking." },
  { key:"deepseek",  label:"DeepSeek R1 32B",    division:"code",  provider:"cf", id:"@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",  tier:"free", status:"live", persona:"Chain-of-thought brawler." },
  { key:"qwq",       label:"Qwen QwQ 32B",       division:"code",  provider:"cf", id:"@cf/qwen/qwq-32b",                              tier:"free", status:"live", persona:"Reasoning specialist. Thinks ahead." },
  { key:"qwen3",     label:"Qwen3 30B",          division:"code",  provider:"cf", id:"@cf/qwen/qwen3-30b-a3b-fp8",                    tier:"free", status:"live", persona:"Fast quantized challenger." },
  // ===== WEB/APP (text models that output HTML; rendered) =====
  { key:"wa_qwen",   label:"Qwen Coder (Web)",   division:"webapp",provider:"cf", id:"@cf/qwen/qwen2.5-coder-32b-instruct",           tier:"free", status:"live", persona:"Builds clean, semantic markup." },
  { key:"wa_llama",  label:"Llama 3.3 (Web)",    division:"webapp",provider:"cf", id:"@cf/meta/llama-3.3-70b-instruct-fp8-fast",     tier:"free", status:"live", persona:"Bold layouts, big ideas." },
  { key:"wa_mistral",label:"Mistral (Web)",      division:"webapp",provider:"cf", id:"@cf/mistralai/mistral-small-3.1-24b-instruct",  tier:"free", status:"live", persona:"Tasteful, minimal, French-clean." },
  { key:"wa_llama4", label:"Llama 4 (Web)",      division:"webapp",provider:"cf", id:"@cf/meta/llama-4-scout-17b-16e-instruct",       tier:"free", status:"live", persona:"Modern, experimental." },
  // ===== IMAGE =====
  { key:"flux",      label:"FLUX.1 Schnell",     division:"image", provider:"cf", id:"@cf/black-forest-labs/flux-1-schnell",          tier:"free", status:"live", persona:"New-school champ. Fast, sharp." },
  { key:"sdxl",      label:"Stable Diffusion XL",division:"image", provider:"cf", id:"@cf/stabilityai/stable-diffusion-xl-base-1.0",  tier:"free", status:"live", persona:"Proven workhorse. Detailed." },
  { key:"sdxll",     label:"SDXL Lightning",     division:"image", provider:"cf", id:"@cf/bytedance/stable-diffusion-xl-lightning",   tier:"free", status:"live", persona:"Lightning-fast strokes." },
  { key:"dream",     label:"DreamShaper 8",      division:"image", provider:"cf", id:"@cf/lykon/dreamshaper-8-lcm",                    tier:"free", status:"live", persona:"Photoreal specialist." },
  { key:"leolucid",  label:"Leonardo Lucid",     division:"image", provider:"cf", id:"@cf/leonardo/lucid-origin",                     tier:"free", status:"live", costly:true, persona:"Premium-grade adherence. (Eats free budget ~130x faster.)" },
  { key:"leophoenix",label:"Leonardo Phoenix",   division:"image", provider:"cf", id:"@cf/leonardo/phoenix-1.0",                      tier:"free", status:"live", costly:true, persona:"Sharp text, coherent scenes. (Costly.)" },
  // ===== locked / coming =====
  { key:"gemma",     label:"Gemma 3 12B",        division:"text",  provider:"cf", id:"@cf/google/gemma-3-12b-it",                     tier:"free", status:"locked", persona:"Not enabled on this account." },
  { key:"claude",    label:"Claude 3.5 Sonnet",  division:"text",  provider:"openrouter", id:"anthropic/claude-3.5-sonnet", tier:"paid", status:"coming", persona:"Reigning closed-lab champ." },
  { key:"gpt4o",     label:"GPT-4o",             division:"text",  provider:"openrouter", id:"openai/gpt-4o",               tier:"paid", status:"coming", persona:"The household name." },
  { key:"gemini",    label:"Gemini 1.5 Pro",     division:"text",  provider:"openrouter", id:"google/gemini-pro-1.5",       tier:"paid", status:"coming", persona:"Google's frontier contender." },
  { key:"atlas",     label:"Atlas (Termux)",     division:"text",  provider:"tunnel", id:"", tier:"free", status:"coming", persona:"Home-built local-first underdog. Evolves weekly. For Emery & Isabella." },
];

const byKey = (k) => REGISTRY.find(m => m.key === String(k||"").toLowerCase());
const CORS = { "content-type":"application/json", "access-control-allow-origin":"*" };
const json = (o, s=200) => new Response(JSON.stringify(o, null, 2), { status:s, headers:CORS });

function extractText(res){
  if(!res) return "";
  if(typeof res === "string") return res;
  if(typeof res.response === "string" && res.response.trim()) return res.response;
  if(Array.isArray(res.output)){ let t=""; for(const it of res.output){ if(typeof it==="string") t+=it; else if(it&&Array.isArray(it.content)){ for(const c of it.content){ if(c&&typeof c.text==="string") t+=c.text; } } else if(it&&typeof it.text==="string") t+=it.text; } if(t.trim()) return t; }
  if(typeof res.output === "string" && res.output.trim()) return res.output;
  if(res.choices && res.choices[0]){ const m=res.choices[0].message||res.choices[0]; if(m&&typeof m.content==="string") return m.content; }
  if(res.result && typeof res.result.response === "string") return res.result.response;
  return "";
}
function cleanOutput(t){ t=String(t||""); t=t.replace(/<think>[\s\S]*?<\/think>/gi,"").trim(); if(/<\/think>/i.test(t)) t=t.replace(/^[\s\S]*?<\/think>/i,"").trim(); t=t.replace(/<\|[^|]*\|>/g,"").trim(); return t; }
function extractHtml(t){ t=String(t||""); const fence=t.match(/```(?:html)?\s*([\s\S]*?)```/i); if(fence) return fence[1].trim(); const idx=t.search(/<(!doctype|html|div|section|main|body|style)/i); if(idx>=0) return t.slice(idx).trim(); return t.trim(); }
function bufToB64(buf){ const b=new Uint8Array(buf); let s=""; const C=0x8000; for(let i=0;i<b.length;i+=C) s+=String.fromCharCode.apply(null,b.subarray(i,i+C)); return btoa(s); }

export async function onRequestOptions(){ return new Response(null,{headers:{"access-control-allow-origin":"*","access-control-allow-methods":"POST, GET, OPTIONS","access-control-allow-headers":"content-type"}}); }
export async function onRequestGet(){
  const roster = REGISTRY.map(({id,...p})=>p);
  return json({ ok:true, version:"2.0.0", divisions:DIVISIONS, topicPools:TOPIC_POOLS, models:roster });
}
export async function onRequestPost(context){
  const { request, env } = context;
  if(!env || !env.AI) return json({ ok:false, error:"AI binding not available" }, 500);
  let body; try { body = await request.json(); } catch { body = {}; }
  const A = byKey(body.a), B = byKey(body.b);
  if(!A || !B) return json({ ok:false, error:"unknown model(s)", allowed: REGISTRY.filter(m=>m.status==="live").map(m=>m.key) }, 400);
  for(const m of [A,B]) if(m.provider!=="cf" || m.status!=="live") return json({ ok:false, error:`${m.label} isn't battle-ready (free build).` }, 400);

  const division = A.division;
  let prompt = String(body.prompt || body.topic || "").slice(0,2000).trim();
  if(!prompt){ const pool = TOPIC_POOLS[division] || TOPIC_POOLS.text; prompt = pool[(Math.random()*pool.length)|0]; }

  async function runText(m, mode){
    let sys = "You are competing in the Forge Atlas AI Arena, head-to-head vs another model on the SAME prompt. Persona: "+m.persona+" Answer directly, skill + brevity + personality. No reasoning shown. Final answer only. Under 150 words.";
    if(mode==="webapp") sys = "You are competing in the Forge Atlas AI Arena (Web/App division). Output ONE self-contained HTML file with inline CSS only — no external links, no JS frameworks, no markdown commentary. Just the HTML. Persona: "+m.persona;
    try{
      const res = await env.AI.run(m.id, { messages:[{role:"system",content:sys},{role:"user",content:prompt}], max_tokens: mode==="webapp"?1200:500 });
      let out = cleanOutput(extractText(res));
      if(mode==="webapp"){ const html = extractHtml(out); return { key:m.key, label:m.label, type:"html", html, ok: html.length>0 }; }
      return { key:m.key, label:m.label, type:"text", output:out, ok: out.length>0 };
    }catch(e){ return { key:m.key, label:m.label, ok:false, error:String(e&&e.message||e) }; }
  }
  async function runImage(m){
    try{
      const res = await env.AI.run(m.id, { prompt, num_steps: 8 });
      let b64=null;
      if(res && typeof res.image==="string") b64=res.image;
      else if(res && res.getReader) b64=bufToB64(await new Response(res).arrayBuffer());
      else if(res && res.arrayBuffer) b64=bufToB64(await res.arrayBuffer());
      return { key:m.key, label:m.label, type:"image", image: b64?("data:image/png;base64,"+b64):null, ok: !!b64, costly: !!m.costly };
    }catch(e){ return { key:m.key, label:m.label, ok:false, error:String(e&&e.message||e) }; }
  }
  const run = (m)=> division==="image" ? runImage(m) : runText(m, division==="webapp"?"webapp":"text");

  const [ra,rb] = await Promise.all([run(A),run(B)]);
  return json({ ok:true, version:"2.0.0", division, prompt, a:ra, b:rb, note:"Real Cloudflare Workers AI output (free). Stats not stored yet (Slice B)." });
}
