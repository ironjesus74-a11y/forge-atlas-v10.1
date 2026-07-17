/**
 * FORGE ATLAS · arena-llm-worker
 * POST /api/arena-llm
 *
 * Optional Worker. When deployed and the frontend has
 * FORGE_ATLAS.LLM_WORKER_URL pointing here, the arena chat
 * streams REAL model output instead of scripted dialog.
 *
 * Input:  { matchId, a, b, topic, format }
 * Output: { lines: [{ who, text, react?, system? }] }
 *
 * Holds the API key server-side. Origin-locked. Rate-limit
 * aware. Replace the system prompts with your own voice tuning.
 *
 * Default uses Anthropic's API. Swap to OpenAI / OpenRouter
 * with the same shape — only the fetch URL and headers change.
 */

const VERSION = "1.0.0";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(env);
    if (request.method !== "POST")
      return json({ error: "method_not_allowed" }, 405, env);

    // Origin lock
    const origin = request.headers.get("origin") || "";
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) {
      return json({ error: "forbidden" }, 403, env);
    }

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "invalid_json" }, 400, env); }

    const a = String(body.a || "").slice(0, 60);
    const b = String(body.b || "").slice(0, 60);
    const topic = String(body.topic || "").slice(0, 400);
    const format = String(body.format || "Debate").slice(0, 40);
    if (!a || !b || !topic) return json({ error: "missing_inputs" }, 400, env);

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "not_configured", hint: "Set ANTHROPIC_API_KEY as a Worker secret." }, 503, env);
    }

    // Voice tunings — keep tight; they read the bot personality from the message
    const systemPrompt = buildSystemPrompt(format);
    const userPrompt = buildUserPrompt(a, b, topic, format);

    let lines;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: env.MODEL || "claude-opus-4-5",
          max_tokens: 2400,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!r.ok) {
        const errTxt = await r.text();
        return json({ error: "upstream", status: r.status, detail: errTxt.slice(0, 500) }, 502, env);
      }
      const data = await r.json();
      const text = (data.content && data.content[0] && data.content[0].text) || "";
      lines = parseTranscript(text, a, b);
      if (!lines.length) {
        return json({ error: "parse_failed", raw: text.slice(0, 1000) }, 502, env);
      }
    } catch (err) {
      return json({ error: "exception", detail: String(err.message || err) }, 500, env);
    }

    return json({ version: VERSION, format, a, b, topic, lines }, 200, env);
  },
};

function buildSystemPrompt(format) {
  return `You are simulating a Forge Atlas Arena ${format.toLowerCase()} battle between two named AI contenders. You write IN-CHARACTER for each contender based on their well-known public personality. Output a transcript of 8–12 alternating turns.

STRICT FORMAT — output ONLY transcript lines, one per turn, in this exact shape:

[CONTENDER NAME] :: short emoji :: line of dialog

Example:
Claude 3.5 :: 🧠 :: Let me reframe before we answer. The question assumes a definition we haven't established.

Rules:
- Alternate strictly between the two named contenders.
- Stay in character. No "as an AI language model" disclaimers.
- Keep each line under 350 characters but VARY length naturally.
- Pick one emoji per line that matches the energy.
- End with one ATLAS line wrapping the round.
- Do not output anything except the transcript lines.`;
}

function buildUserPrompt(a, b, topic, format) {
  return `Format: ${format}
Topic: ${topic}
Contender A: ${a}
Contender B: ${b}

Write the transcript now. Begin with ${a}.`;
}

function parseTranscript(text, a, b) {
  const lines = [];
  const rows = text.split(/\r?\n/);
  for (const row of rows) {
    const r = row.trim();
    if (!r) continue;
    const m = r.match(/^([^:]+?)\s*::\s*([^:\s][^:]*?)\s*::\s*(.+)$/);
    if (!m) continue;
    const who = m[1].trim();
    const react = m[2].trim();
    const txt = m[3].trim();
    if (!txt) continue;
    lines.push({
      who,
      text: txt,
      react: emojiOnly(react),
      system: who.toUpperCase() === "ATLAS",
    });
  }
  return lines;
}

function emojiOnly(s) {
  // Keep first emoji-like character. Fallback empty.
  if (!s) return "";
  // Match a unicode symbol/emoji
  const m = s.match(/(?:[\p{Emoji_Presentation}\p{Emoji}\u200d]+)/u);
  return m ? m[0] : "";
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": (env && env.ALLOWED_ORIGIN) || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
  };
}
function cors(env) {
  return new Response(null, { status: 204, headers: corsHeaders(env) });
}
function json(payload, status, env) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...corsHeaders(env), "content-type": "application/json; charset=utf-8" },
  });
}
