// Forge Atlas — REAL AI Arena (Slice A): registry-driven, division-aware, FREE models only.
// Pages Function. Uses native env.AI binding (no API key, no cost). Model IDs verified 2026-06.
//
// >>> ADD A NEW MODEL = ADD ONE LINE to REGISTRY. As new AI ships on Workers AI, drop it in. <<<
//
const REGISTRY = [
  // ===== TEXT division (free) =====
  { key:"llama",    label:"Llama 3.3 70B",      division:"text",  provider:"cf", id:"@cf/meta/llama-3.3-70b-instruct-fp8-fast",       tier:"free", status:"live",   persona:"The open-source heavyweight. Confident, blunt, no love for closed labs." },
  { key:"llama4",   label:"Llama 4 Scout",      division:"text",  provider:"cf", id:"@cf/meta/llama-4-scout-17b-16e-instruct",         tier:"free", status:"live",   persona:"New blood. Multimodal, fast, hungry to prove itself." },
  { key:"gptoss",   label:"GPT-OSS 120B",       division:"text",  provider:"cf", id:"@cf/openai/gpt-oss-120b",                         tier:"free", status:"live",   persona:"OpenAI's open-weight giant. Polished, knows everyone's watching." },
  { key:"mistral",  label:"Mistral Small 24B",  division:"text",  provider:"cf", id:"@cf/mistralai/mistral-small-3.1-24b-instruct",    tier:"free", status:"live",   persona:"French precision. Elegant, efficient, a little smug about it." },
  { key:"gemma",    label:"Gemma 3 12B",        division:"text",  provider:"cf", id:"@cf/google/gemma-3-12b-it",                       tier:"free", status:"live",   persona:"The lightweight underdog with Google pedigree. Scrappy, fast." },
  { key:"qwq",      label:"Qwen QwQ 32B",       division:"text",  provider:"cf", id:"@cf/qwen/qwq-32b",                                tier:"free", status:"live",   persona:"The reasoning specialist. Thinks three moves ahead." },
  // ===== CODE division (free) =====
  { key:"qwencoder",label:"Qwen 2.5 Coder 32B", division:"code",  provider:"cf", id:"@cf/qwen/qwen2.5-coder-32b-instruct",             tier:"free", status:"live",   persona:"Code assassin. Lets the diff do the talking." },
  { key:"deepseek", label:"DeepSeek R1 32B",    division:"code",  provider:"cf", id:"@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",    tier:"free", status:"live",   persona:"Chain-of-thought brawler. Shows its work, then wins." },
  // ===== IMAGE division (free) =====
  { key:"flux",     label:"FLUX.1 Schnell",     division:"image", provider:"cf", id:"@cf/black-forest-labs/flux-1-schnell",           tier:"free", status:"live",   persona:"New-school image champ. Fast, sharp, stylish." },
  { key:"sdxl",     label:"Stable Diffusion XL",division:"image", provider:"cf", id:"@cf/stabilityai/stable-diffusion-xl-base-1.0",   tier:"free", status:"live",   persona:"The proven workhorse. Reliable, detailed, battle-tested." },
  // ===== PREMIUM slots (dormant — light up in Slice A.5 with an OpenRouter key) =====
  { key:"claude",   label:"Claude 3.5 Sonnet",  division:"text",  provider:"openrouter", id:"anthropic/claude-3.5-sonnet", tier:"paid", status:"coming", persona:"The reigning champ from the closed labs." },
  { key:"gpt4o",    label:"GPT-4o",             division:"text",  provider:"openrouter", id:"openai/gpt-4o",               tier:"paid", status:"coming", persona:"The household name. Polished, everywhere." },
  { key:"gemini",   label:"Gemini 1.5 Pro",     division:"text",  provider:"openrouter", id:"google/gemini-pro-1.5",       tier:"paid", status:"coming", persona:"Google's frontier contender." },
];
const byKey = (k) => REGISTRY.find(m => m.key === String(k||"").toLowerCase());
const CORS = { "content-type":"application/json", "access-control-allow-origin":"*" };
const json = (o, s=200) => new Response(JSON.stringify(o, null, 2), { status:s, headers:CORS });
function bufToB64(buf) {
  const bytes = new Uint8Array(buf); let bin = ""; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin);
}
export async function onRequestOptions() {
  return new Response(null, { headers: {
    "access-control-allow-origin":"*", "access-control-allow-methods":"POST, GET, OPTIONS", "access-control-allow-headers":"content-type",
  }});
}
export async function onRequestGet() {
  const roster = REGISTRY.map(({id, ...pub}) => pub);
  return json({ ok:true, version:"1.2.0", divisions:["text","code","image"], models: roster });
}
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env || !env.AI) return json({ ok:false, error:"AI binding not available on this Pages project" }, 500);
  let body; try { body = await request.json(); } catch { body = {}; }
  const prompt = String(body.prompt || body.topic || "").slice(0,2000).trim();
  const A = byKey(body.a || "llama");
  const B = byKey(body.b || "mistral");
  if (!prompt) return json({ ok:false, error:"prompt required" }, 400);
  if (!A || !B) return json({ ok:false, error:"unknown model", allowed: REGISTRY.map(m=>m.key) }, 400);
  for (const m of [A,B]) {
    if (m.provider !== "cf" || m.status !== "live")
      return json({ ok:false, error:`${m.label} isn't live in this free build. Free models: `+REGISTRY.filter(x=>x.provider==="cf"&&x.status==="live").map(x=>x.key).join(", ") }, 400);
  }
  const division = A.division === B.division ? A.division : "crossover";
  async function runText(m) {
    const sys = "You are competing in the Forge Atlas AI Arena, judged head-to-head against another model on the SAME prompt. Your persona: "+m.persona+" Answer with skill, brevity, and personality. Under 150 words. Make it count.";
    try {
      const res = await env.AI.run(m.id, { messages:[{role:"system",content:sys},{role:"user",content:prompt}], max_tokens:400 });
      const out = (res && (res.response || res.output || "")) || "";
      return { key:m.key, label:m.label, division:m.division, type:"text", output:String(out).trim(), ok:true };
    } catch(e){ return { key:m.key, label:m.label, division:m.division, type:"text", ok:false, error:String(e&&e.message||e) }; }
  }
  async function runImage(m) {
    try {
      const res = await env.AI.run(m.id, { prompt, num_steps: 8 });
      let b64 = null;
      if (res && typeof res.image === "string") b64 = res.image;
      else if (res && res.getReader) b64 = bufToB64(await new Response(res).arrayBuffer());
      else if (res && res.arrayBuffer) b64 = bufToB64(await res.arrayBuffer());
      return { key:m.key, label:m.label, division:m.division, type:"image", image: b64 ? ("data:image/png;base64,"+b64) : null, ok: !!b64 };
    } catch(e){ return { key:m.key, label:m.label, division:m.division, type:"image", ok:false, error:String(e&&e.message||e) }; }
  }
  const run = (m) => m.division === "image" ? runImage(m) : runText(m);
  const [ra, rb] = await Promise.all([run(A), run(B)]);
  return json({ ok:true, version:"1.2.0", division, prompt, a:ra, b:rb,
    note:"Real model outputs via Cloudflare Workers AI (free). Stats not stored yet (Slice B)." });
}
