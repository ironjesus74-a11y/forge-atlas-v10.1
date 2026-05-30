/**
 * FORGE ATLAS · atlas-rescuer-worker
 * POST /api/atlas-rescuer
 *
 * Generates an Atlas reply for a Town Square thread that has been
 * waiting >24h without a human response. Uses Cloudflare Workers AI
 * (Llama 3.3) by default, falls back to Anthropic if ANTHROPIC_API_KEY
 * is set and AI binding is unavailable.
 *
 * Triggers:
 *   - Called by the frontend when a thread is detected as stuck
 *   - Or scheduled via Cron Trigger (see wrangler.toml)
 *
 * Body:
 *   { threadId, forum, title, body, replies?: [{author, body, created}] }
 *
 * Returns:
 *   { ok, reply: "...", model: "..." }
 */

const VERSION = "1.0.0";
const CF_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const ANTHROPIC_MODEL = "claude-opus-4-5";

const SYSTEM_PROMPT = `You are Atlas, an AI assistant who helps people on a community forum called Forge Atlas Town Square. Your job is to weigh in on threads that have been sitting unanswered for over 24 hours.

VOICE:
- Direct, useful, not falsely cheerful
- One short framing sentence, then concrete moves
- Cite sources or specific approaches when they apply
- Sign off briefly — never long farewells

NEVER:
- Pretend to be human
- Claim to know what the asker knows
- Give generic motivational filler
- Use phrases like "great question" or "happy to help"
- Promise outcomes you can't deliver

ALWAYS:
- Treat the asker as competent
- Acknowledge what's hard about their question if it's hard
- Give 2-4 specific next moves, not abstract principles
- If you don't know, say so and suggest where to look
- Keep the whole reply under 250 words

Sign with: "— Atlas"`;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(env);
    if (request.method !== "POST") return j({ ok: false, error: "method_not_allowed" }, 405, env);

    const origin = request.headers.get("origin") || "";
    if (env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== "*" && origin !== env.ALLOWED_ORIGIN) {
      return j({ ok: false, error: "forbidden" }, 403, env);
    }

    let body;
    try { body = await request.json(); }
    catch { return j({ ok: false, error: "invalid_json" }, 400, env); }

    const title = String(body.title || "").slice(0, 300);
    const threadBody = String(body.body || "").slice(0, 3000);
    const replies = Array.isArray(body.replies) ? body.replies.slice(-5) : [];

    if (!title && !threadBody) {
      return j({ ok: false, error: "empty_thread" }, 400, env);
    }

    // Build user prompt
    const repliesText = replies.length
      ? "\n\nPRIOR REPLIES:\n" + replies.map(r => `[${r.author?.callsign || "Anon"}]: ${r.body || ""}`).join("\n---\n")
      : "";

    const userMsg = `THREAD TITLE: ${title}\n\nORIGINAL POST:\n${threadBody}${repliesText}\n\nWrite your reply now.`;

    // Try Cloudflare Workers AI first (cheap, fast, included)
    if (env.AI) {
      try {
        const res = await env.AI.run(CF_MODEL, {
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMsg },
          ],
          max_tokens: 500,
        });
        const reply = ((res && (res.response || res.output || "")) + "").trim();
        if (reply && reply.length > 20) {
          return j({ ok: true, version: VERSION, reply, model: CF_MODEL, source: "cf_workers_ai" }, 200, env);
        }
      } catch (e) {
        // Fall through to Anthropic
      }
    }

    // Anthropic fallback
    if (env.ANTHROPIC_API_KEY) {
      try {
        const anthropicBase = env.CF_AI_GATEWAY
          ? env.CF_AI_GATEWAY + "/anthropic"
          : "https://api.anthropic.com";
        const anthropicRes = await fetch(anthropicBase + "/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: env.ANTHROPIC_MODEL || ANTHROPIC_MODEL,
            max_tokens: 600,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userMsg }],
          }),
        });
        if (anthropicRes.ok) {
          const data = await anthropicRes.json();
          const reply = (data.content?.[0]?.text || "").trim();
          if (reply) {
            return j({
              ok: true,
              version: VERSION,
              reply,
              model: env.ANTHROPIC_MODEL || ANTHROPIC_MODEL,
              source: "anthropic",
            }, 200, env);
          }
        }
      } catch (e) {
        // Will fall through to error
      }
    }

    return j({
      ok: false,
      error: "no_provider_available",
      hint: "Add [ai] binding for CF Workers AI, or set ANTHROPIC_API_KEY secret",
    }, 503, env);
  },

  // Scheduled trigger — invoked by cron to scan for stuck threads
  async scheduled(event, env, ctx) {
    // Future: scan GitHub Issues via forum-bridge for threads >24h old without comments,
    // generate replies, post via the bridge. Wired-but-disabled until you turn it on.
    // scheduled tick — add rescuer logic here when GitHub token is configured
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
