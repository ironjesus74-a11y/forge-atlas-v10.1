// Forge Atlas — REAL AI Arena (Slice A v1.4): flat roster (no divisions yet), free CF models.
// Robust output extraction + reasoning cleanup. Model IDs verified 2026-06.
// >>> ADD A MODEL = ADD ONE LINE. Atlas (Termux) slot reserved for tunnel slice. <<<
const REGISTRY = [
  { key:"llama",     label:"Llama 3.3 70B",      provider:"cf", id:"@cf/meta/llama-3.3-70b-instruct-fp8-fast",        tier:"free", status:"live",   persona:"Open-source heavyweight. Confident, blunt." },
  { key:"llama4",    label:"Llama 4 Scout",      provider:"cf", id:"@cf/meta/llama-4-scout-17b-16e-instruct",          tier:"free", status:"live",   persona:"New blood. Multimodal, fast, hungry." },
  { key:"llama8b",   label:"Llama 3.1 8B",       provider:"cf", id:"@cf/meta/llama-3.1-8b-instruct-fast",              tier:"free", status:"probe",  persona:"The nimble featherweight. Quick on its feet." },
  { key:"gptoss",    label:"GPT-OSS 120B",       provider:"cf", id:"@cf/openai/gpt-oss-120b",                          tier:"free", status:"live",   persona:"OpenAI's open giant. Polished, watched." },
  { key:"gptoss20",  label:"GPT-OSS 20B",        provider:"cf", id:"@cf/openai/gpt-oss-20b",                           tier:"free", status:"probe",  persona:"Leaner OpenAI open model. Sharp, efficient." },
  { key:"mistral",   label:"Mistral Small 24B",  provider:"cf", id:"@cf/mistralai/mistral-small-3.1-24b-instruct",     tier:"free", status:"live",   persona:"French precision. Elegant, a little smug." },
  { key:"qwq",       label:"Qwen QwQ 32B",       provider:"cf", id:"@cf/qwen/qwq-32b",                                 tier:"free", status:"live",   persona:"Reasoning specialist. Thinks ahead." },
  { key:"qwencoder", label:"Qwen 2.5 Coder 32B", provider:"cf", id:"@cf/qwen/qwen2.5-coder-32b-instruct",              tier:"free", status:"live",   persona:"Code assassin. The diff does the talking." },
  { key:"qwen3",     label:"Qwen3 30B",          provider:"cf", id:"@cf/qwen/qwen3-30b-a3b-fp8",                       tier:"free", status:"probe",  persona:"Fast quantized challenger." },
  { key:"deepseek",  label:"DeepSeek R1 32B",    provider:"cf", id:"@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",     tier:"free", status:"live",   persona:"Chain-of-thought brawler. Shows its work." },
  { key:"hermes",    label:"Hermes 2 Pro",       provider:"cf", id:"@hf/nousresearch/hermes-2-pro-mistral-7b",         tier:"free", status:"probe",  persona:"The function-calling tactician." },
  { key:"granite",   label:"Granite 4.0 Micro",  provider:"cf", id:"@cf/ibm-granite/granite-4.0-h-micro",              tier:"free", status:"probe",  persona:"IBM's compact workhorse. All business." },
  { key:"flux",      label:"FLUX.1 Schnell",     provider:"cf", id:"@cf/black-forest-labs/flux-1-schnell",            tier:"free", status:"live",  type:"image", persona:"New-school image champ." },
  { key:"sdxl",      label:"Stable Diffusion XL",provider:"cf", id:"@cf/stabilityai/stable-diffusion-xl-base-1.0",    tier:"free", status:"live",  type:"image", persona:"Proven image workhorse." },
  { key:"gemma",     label:"Gemma 3 12B",        provider:"cf", id:"@cf/google/gemma-3-12b-it",                       tier:"free", status:"locked", persona:"Google lightweight. (Not enabled on this account.)" },
  { key:"claude",    label:"Claude 3.5 Sonnet",  provider:"openrouter", id:"anthropic/claude-3.5-sonnet", tier:"paid", status:"coming", persona:"Reigning closed-lab champ." },
  { key:"gpt4o",     label:"GPT-4o",             provider:"openrouter", id:"openai/gpt-4o",               tier:"paid", status:"coming", persona:"The household name." },
  { key:"gemini",    label:"Gemini 1.5 Pro",     provider:"openrouter", id:"google/gemini-pro-1.5",       tier:"paid", status:"coming", persona:"Google's frontier contender." },
  { key:"atlas",     label:"Atlas (Termux)",     provider:"tunnel", id:"", tier:"free", status:"coming", persona:"Home-built, local-first underdog. Evolves every week. Built for Emery & Isabella." },
];
const byKey = (k) => REGISTRY.find(m => m.key === String(k||"").toLowerCase());
const CORS = { "content-type":"application/json", "access-control-allow-origin":"*" };
const json = (o, s=200) => new Response(JSON.stringify(o, null, 2), { status:s, headers:CORS });
function extractText(res){
  if(!res) return "";
  if(typeof res === "string") return res;
  if(typeof res.response === "string" && res.response.trim()) return res.response;
  if(Array.isArray(res.output)){
    let t = "";
    for(const item of res.output){
      if(typeof item === "string") t += item;
      else if(item && Array.isArray(item.content)){ for(const c of item.content){ if(c && typeof c.text === "string") t += c.text; } }
      else if(item && typeof item.text === "string") t += item.text;
    }
    if(t.trim()) return t;
  }
  if(typeof res.output === "string" && res.output.trim()) return res.output;
  if(res.choices && res.choices[0]){ const m = res.choices[0].message || res.choices[0]; if(m && typeof m.content === "string") return m.content; }
  if(res.result && typeof res.result.response === "string") return res.result.response;
  return "";
}
function cleanOutput(t){
  t = String(t||"");
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if(/<\/think>/i.test(t)) t = t.replace(/^[\s\S]*?<\/think>/i, "").trim();
  t = t.replace(/<\|[^|]*\|>/g, "").trim();
  return t;
}
function bufToB64(buf){ const b=new Uint8Array(buf); let s=""; const C=0x8000; for(let i=0;i<b.length;i+=C) s+=String.fromCharCode.apply(null,b.subarray(i,i+C)); return btoa(s); }
export async function onRequestOptions(){ return new Response(null,{headers:{"access-control-allow-origin":"*","access-control-allow-methods":"POST, GET, OPTIONS","access-control-allow-headers":"content-type"}}); }
export async function onRequestGet(){ const roster = REGISTRY.map(({id,...p})=>p); return json({ ok:true, version:"1.4.0", models:roster }); }
export async function onRequestPost(context){
  const { request, env } = context;
  if(!env || !env.AI) return json({ ok:false, error:"AI binding not available" }, 500);
  let body; try { body = await request.json(); } catch { body = {}; }
  const prompt = String(body.prompt || body.topic || "").slice(0,2000).trim();
  const A = byKey(body.a || "llama"), B = byKey(body.b || "mistral");
  if(!prompt) return json({ ok:false, error:"prompt required" }, 400);
  if(!A || !B) return json({ ok:false, error:"unknown model", allowed: REGISTRY.map(m=>m.key) }, 400);
  for(const m of [A,B]){
    if(m.provider !== "cf" || (m.status !== "live" && m.status !== "probe"))
      return json({ ok:false, error:`${m.label} isn't battle-ready here.` }, 400);
  }
  async function runText(m){
    const sys = "You are competing in the Forge Atlas AI Arena, head-to-head vs another model on the SAME prompt. Persona: "+m.persona+" Answer directly with skill, brevity, personality. Do NOT show your reasoning or planning. Final answer only. Under 150 words.";
    try{
      const res = await env.AI.run(m.id, { messages:[{role:"system",content:sys},{role:"user",content:prompt}], max_tokens:500 });
      const out = cleanOutput(extractText(res));
      return { key:m.key, label:m.label, type:"text", output:out, ok: out.length>0, raw_empty: out.length===0 };
    }catch(e){ return { key:m.key, label:m.label, type:"text", ok:false, error:String(e&&e.message||e) }; }
  }
  async function runImage(m){
    try{
      const res = await env.AI.run(m.id, { prompt, num_steps:8 });
      let b64=null;
      if(res && typeof res.image==="string") b64=res.image;
      else if(res && res.getReader) b64=bufToB64(await new Response(res).arrayBuffer());
      else if(res && res.arrayBuffer) b64=bufToB64(await res.arrayBuffer());
      return { key:m.key, label:m.label, type:"image", image: b64?("data:image/png;base64,"+b64):null, ok: !!b64 };
    }catch(e){ return { key:m.key, label:m.label, type:"image", ok:false, error:String(e&&e.message||e) }; }
  }
  const run = (m)=> m.type==="image" ? runImage(m) : runText(m);
  const [ra,rb] = await Promise.all([run(A),run(B)]);
  return json({ ok:true, version:"1.4.0", prompt, a:ra, b:rb, note:"Real Cloudflare Workers AI output (free). Stats not stored yet (Slice B)." });
}
