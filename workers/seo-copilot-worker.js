/**
 * FORGE ATLAS · seo-copilot-worker
 * POST /api/seo-copilot
 *
 * Tier-routed SEO doctor.
 * - Quick fixes (meta rewrites, alt text, H1 polish) → Workers AI (free/cheap)
 * - Deep audits (content strategy, intent match, schema) → Anthropic Claude
 *
 * Body:
 *   {
 *     mode: "quick" | "deep",
 *     url: "/path",          // page to audit
 *     fix?: "meta" | "h1" | "alt" | "intent" | "schema",
 *     context?: "..."        // optional extra context for deep mode
 *   }
 *
 * Response:
 *   {
 *     ok, mode, url, score (0-100),
 *     findings: [{severity, what, fix, llm?: bool}],
 *     suggestions: { title?, description?, h1?, ... },
 *     used_models: [...]
 *   }
 *
 * REQUIRES:
 *   - wrangler.toml [ai] binding for quick mode
 *   - ANTHROPIC_API_KEY secret for deep mode
 */

const VERSION = "1.0.0";
const CF_FAST = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(env);
    if (request.method !== "POST") return j({ error: "method_not_allowed" }, 405, env);

    const origin = request.headers.get("origin") || "";
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) return j({ error: "forbidden" }, 403, env);

    let body;
    try { body = await request.json(); } catch { return j({ error: "invalid_json" }, 400, env); }

    const mode = body.mode === "deep" ? "deep" : "quick";
    const url = String(body.url || "/");
    if (!url.startsWith("/")) return j({ error: "url_must_be_path" }, 400, env);

    // Fetch the page on the same origin
    const targetUrl = new URL(url, request.url).toString();
    let html;
    try {
      const res = await fetch(targetUrl, { headers: { "user-agent": "ForgeAtlas-SeoCopilot/1.0" } });
      if (!res.ok) return j({ error: "fetch_failed", status: res.status }, 502, env);
      html = await res.text();
    } catch (err) {
      return j({ error: "fetch_exception", detail: String(err.message || err) }, 502, env);
    }

    // Static parse
    const audit = staticAudit(html);
    const usedModels = [];
    const suggestions = {};

    // Quick mode: hit Workers AI for the top 1-3 fixes
    if (mode === "quick" && env.AI) {
      const targets = audit.findings.filter(f => f.severity !== "info").slice(0, 3);
      for (const finding of targets) {
        try {
          if (finding.what.toLowerCase().includes("title") || finding.what.toLowerCase().includes("description")) {
            const out = await runCfAi(env, CF_FAST,
              `You rewrite SEO metadata. Output STRICT JSON only: {"title":"...(<=60 chars)","description":"...(90-160 chars)"}. No prose.`,
              `URL: ${url}\nCurrent title: "${audit.title || ''}"\nCurrent desc: "${audit.description || ''}"\nH1: "${audit.h1 || ''}"\nWrite better title + description for this page.`
            );
            const parsed = tryParseJson(out);
            if (parsed && parsed.title) suggestions.title = parsed.title;
            if (parsed && parsed.description) suggestions.description = parsed.description;
            usedModels.push(CF_FAST);
            finding.llm = true;
            break;
          } else if (finding.what.toLowerCase().includes("h1")) {
            const out = await runCfAi(env, CF_FAST,
              `You write strong H1 headings. Output a single line of plain text, 6-9 words, no quotes.`,
              `URL: ${url}\nTitle: ${audit.title}\nDescription: ${audit.description}`
            );
            if (out) suggestions.h1 = out.trim().split("\n")[0];
            usedModels.push(CF_FAST);
            finding.llm = true;
          }
        } catch (e) {
          // graceful — keep finding without LLM suggestion
        }
      }
    }

    // Deep mode: hit Anthropic for full audit + content strategy
    if (mode === "deep" && env.ANTHROPIC_API_KEY) {
      try {
        const deepRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: env.ANTHROPIC_MODEL || "claude-opus-4-5",
            max_tokens: 1500,
            system: `You are an elite SEO consultant. Output STRICT JSON only:
{
  "intent": "what searcher wants on this page",
  "intent_match": 0-10,
  "title": "...(<=60 chars)",
  "description": "...(90-160 chars)",
  "h1": "single line",
  "schema_recommendation": "one schema.org type to add and why",
  "content_gap": "the single biggest content opportunity"
}
No prose outside JSON.`,
            messages: [{
              role: "user",
              content: `URL: ${url}\nTitle: ${audit.title}\nDescription: ${audit.description}\nH1: ${audit.h1}\nFirst paragraph snippet: ${audit.first_p?.slice(0, 400) || ''}\n\nGive me the upgrade.${body.context ? "\n\nExtra context: " + body.context.slice(0, 500) : ''}`,
            }],
          }),
        });
        if (deepRes.ok) {
          const data = await deepRes.json();
          const text = data.content?.[0]?.text || "";
          const parsed = tryParseJson(text);
          if (parsed) {
            Object.assign(suggestions, parsed);
            usedModels.push(env.ANTHROPIC_MODEL || "claude-opus-4-5");
          }
        }
      } catch (e) { /* graceful */ }
    }

    return j({
      ok: true,
      version: VERSION,
      mode, url,
      score: audit.score,
      findings: audit.findings,
      suggestions,
      used_models: usedModels,
      static_only: usedModels.length === 0,
    }, 200, env);
  },
};

function staticAudit(html) {
  const findings = [];
  const get = (re) => { const m = html.match(re); return m ? m[1].trim() : ""; };

  const title = get(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = get(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const og_image = get(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const canonical = get(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const lang = get(/<html[^>]*\slang=["']([^"']+)["']/i);
  const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h1 = h1Matches[0] ? h1Matches[0].replace(/<[^>]+>/g, "").trim() : "";
  const firstP = get(/<p[^>]*>([\s\S]*?)<\/p>/i).replace(/<[^>]+>/g, "").trim();
  const imgs = (html.match(/<img\b[^>]*>/gi) || []);
  const imgsNoAlt = imgs.filter(t => !/\salt=/i.test(t)).length;
  const wordCount = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").length;

  let score = 100;

  if (!title) { findings.push({ severity:"high", what:"Missing <title>", fix:"Add a 30-60 character title that frames the page intent." }); score -= 15; }
  else if (title.length < 30 || title.length > 65) { findings.push({ severity:"medium", what:`<title> length ${title.length} chars`, fix:"Aim for 30-60 chars." }); score -= 5; }

  if (!description) { findings.push({ severity:"high", what:"Missing meta description", fix:"Add a 90-160 character description summarizing the page." }); score -= 15; }
  else if (description.length < 70 || description.length > 175) { findings.push({ severity:"medium", what:`description length ${description.length}`, fix:"Aim for 90-160 chars." }); score -= 5; }

  if (h1Matches.length === 0) { findings.push({ severity:"high", what:"No <h1> on page", fix:"Add exactly one <h1> reflecting page intent." }); score -= 15; }
  if (h1Matches.length > 1) { findings.push({ severity:"medium", what:`Multiple <h1> tags (${h1Matches.length})`, fix:"Use one <h1>; subordinate to <h2>/<h3>." }); score -= 5; }

  if (!canonical) { findings.push({ severity:"low", what:"No canonical link", fix:"Add <link rel=\"canonical\" href=\"...\">." }); score -= 5; }
  if (!og_image) { findings.push({ severity:"low", what:"No og:image", fix:"Add an Open Graph image (1200x630)." }); score -= 5; }
  if (!lang) { findings.push({ severity:"low", what:"<html> missing lang attribute", fix:"Add lang=\"en\" or appropriate locale." }); score -= 5; }

  if (imgsNoAlt > 0) { findings.push({ severity:"medium", what:`${imgsNoAlt} <img> tags missing alt`, fix:"Add descriptive alt text to every img." }); score -= Math.min(10, imgsNoAlt * 2); }

  if (wordCount < 200) { findings.push({ severity:"info", what:`Sparse content (${wordCount} words)`, fix:"Pages under 300 words rarely rank for competitive terms." }); }

  return { title, description, h1, first_p: firstP, score: Math.max(0, score), findings };
}

async function runCfAi(env, model, system, user) {
  const res = await env.AI.run(model, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: 600,
  });
  return (res && (res.response || res.output || "")).toString().trim();
}

function tryParseJson(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch {}
  // strip markdown fences
  const cleaned = s.replace(/```json\s*|```\s*$/g, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  // find first { ... }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) try { return JSON.parse(m[0]); } catch {}
  return null;
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": (env && env.ALLOWED_ORIGIN) || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
  };
}
function cors(env) { return new Response(null, { status: 204, headers: corsHeaders(env) }); }
function j(payload, status, env) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...corsHeaders(env), "content-type": "application/json; charset=utf-8" },
  });
}
