/**
 * FORGE ATLAS · cf-ai-worker
 * POST /api/cf-ai
 *
 * Bridges the frontend to Cloudflare Workers AI.
 * Free-tier friendly. Use this for fast, cheap inference:
 *   - quick rewrites
 *   - SEO meta drafts
 *   - title/description suggestions
 *   - short summaries
 *   - classification
 *   - embedding lookups
 *
 * For deep audits / multi-step reasoning, route to arena-llm-worker
 * (Anthropic Claude) instead. Tiered cost = sustainable cost.
 *
 * Body:
 *   {
 *     task: "rewrite_meta" | "summarize" | "classify" | "chat",
 *     model?: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" | etc,
 *     input: string,
 *     system?: string,
 *     max_tokens?: number
 *   }
 *
 * Response:
 *   { ok: true, model, task, output: string, usage?: {...} }
 *
 * REQUIRES: wrangler.toml binding [ai] · binding = "AI"
 * OPTIONAL: KV binding RATE_LIMIT — enables a per-IP write limiter
 *           (10 req/min/IP). Absent binding = limiter no-ops.
 */

import { checkRateLimit } from "./lib/rate-limit.js";

const VERSION = "1.0.0";
const AI_CALLS_PER_MIN = 10; // per-IP POST budget when RATE_LIMIT is bound

const MODELS = {
  fast: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  balanced: "@cf/mistralai/mistral-small-3.1-24b-instruct",
  tiny: "@cf/google/gemma-3-12b-it",
};

const TASK_PROMPTS = {
  rewrite_meta: `You rewrite SEO metadata. Given a page's current title and description, produce one tight title (<=60 chars) and one tight description (90-160 chars). Output STRICT JSON: {"title":"...","description":"..."}. No prose, no explanation.`,
  summarize: `You write 1-paragraph summaries (<=140 words) that preserve the core claim. Output the summary text only. No preamble.`,
  classify: `You classify text. Output a single label only. No explanation.`,
  fix_h1: `You generate a strong H1 heading from page intent. Output a single H1 line, plain text, 6-9 words. No quotes, no preamble.`,
  improve_alt: `You write image alt text. Output a single descriptive alt-text line, 8-15 words, ending without a period. No preamble.`,
  chat: null,
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(env);
    if (request.method !== "POST") return j({ error: "method_not_allowed" }, 405, env);
    if (!env.AI) return j({ error: "not_configured", hint: "Add [ai] binding 'AI' in wrangler.toml" }, 503, env);

    const origin = request.headers.get("origin") || "";
    if (env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== "*" && origin !== env.ALLOWED_ORIGIN) {
      return j({ error: "forbidden" }, 403, env);
    }

    // Per-IP rate limit — protects the AI quota. No-ops if KV is unbound.
    const rl = await checkRateLimit(env, request, "cf-ai", AI_CALLS_PER_MIN);
    if (rl.limited) return j({ ok: false, error: "rate_limited" }, 429, env);

    let body;
    try { body = await request.json(); }
    catch { return j({ error: "invalid_json" }, 400, env); }

    const task = String(body.task || "chat");
    const input = String(body.input || body.message || "").slice(0, 8000);
    if (!input) return j({ error: "missing_input" }, 400, env);

    const model = body.model || MODELS.fast;
    const maxTokens = Math.min(parseInt(body.max_tokens || 600, 10), 1500);

    const systemPrompt = body.system || TASK_PROMPTS[task] || "You are a precise, terse assistant. Answer directly. No preamble.";

    try {
      const res = await env.AI.run(model, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input },
        ],
        max_tokens: maxTokens,
      });

      // Workers AI returns { response: "..." } for chat models
      const output = (res && (res.response || res.output || "")).toString().trim();

      return j({
        ok: true,
        version: VERSION,
        model,
        task,
        output,
        reply: output,
        len: output.length,
      }, 200, env);
    } catch (err) {
      return j({ error: "inference_failed", detail: String(err.message || err) }, 502, env);
    }
  },
};

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
