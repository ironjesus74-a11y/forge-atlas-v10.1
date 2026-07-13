// Fight Club Phase 1 API
// Server-side safety boundary for AI code battles.
// No browser secrets. No fake live results.

const MAX_PROMPT_LENGTH = 500;
const COOLDOWN_MS = 30_000;
const CUSTOM_DAILY_LIMIT = 5;

// Model is intentionally not hardcoded.
// Set FIGHT_CLUB_MODEL in Cloudflare Pages/Worker env after Bryant confirms the real enabled Workers AI model.
function getConfiguredModel(env) {
  return env.FIGHT_CLUB_MODEL || null;
}

const FIGHTERS = {
  "fighter-a": {
    label: "Workers AI Fighter A",
    style: "Write clean, beginner-readable code. Prefer clarity and comments."
  },
  "fighter-b": {
    label: "Workers AI Fighter B",
    style: "Write compact, production-minded code. Prefer structure and reusable functions."
  }
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return json({ status: "error", label: "ERROR", error: "Method not allowed" }, 405);
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return json({ status: "error", label: "ERROR", error: "JSON required" }, 415);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ status: "error", label: "ERROR", error: "Invalid JSON" }, 400);
  }

  const mode = body.mode;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const custom = body.custom === true;
  const fighterA = body.fighterA || "fighter-a";
  const fighterB = body.fighterB || "fighter-b";

  if (mode !== "code-battle") {
    return json({ status: "error", label: "ERROR", error: "Invalid mode" }, 400);
  }

  if (prompt.length < 3) {
    return json({ status: "error", label: "ERROR", error: "Prompt required" }, 400);
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return json({ status: "error", label: "ERROR", error: "Prompt too long" }, 400);
  }

  if (!FIGHTERS[fighterA] || !FIGHTERS[fighterB]) {
    return json({ status: "error", label: "ERROR", error: "Invalid fighter alias" }, 400);
  }

  const rate = await checkRateLimit(env, request, custom);
  if (!rate.ok) {
    return json({ status: "rate_limited", label: "RATE LIMITED", error: rate.error }, 429);
  }

  if (!env.AI || typeof env.AI.run !== "function") {
    return json({
      status: "error",
      label: "ERROR",
      error: "Workers AI binding is not configured."
    }, 503);
  }

  const model = getConfiguredModel(env);
  if (!model) {
    return json({
      status: "error",
      label: "ERROR",
      error: "FIGHT_CLUB_MODEL is not configured. Set it after confirming the enabled Workers AI model."
    }, 503);
  }

  try {
    const [a, b] = await Promise.all([
      runFighter(env, model, prompt, FIGHTERS[fighterA]),
      runFighter(env, model, prompt, FIGHTERS[fighterB])
    ]);

    return json({
      status: "success",
      label: "LIVE AI",
      mode: "code-battle",
      fighterA: FIGHTERS[fighterA].label,
      fighterB: FIGHTERS[fighterB].label,
      model1_response: a,
      model2_response: b
    }, 200);
  } catch (error) {
    return json({
      status: "error",
      label: "ERROR",
      error: "AI generation failed. No demo result was counted."
    }, 500);
  }
}

async function runFighter(env, model, prompt, fighter) {
  const result = await env.AI.run(model, {
    messages: [
      {
        role: "system",
        content:
          "You are a Forge Atlas Fight Club code competitor. " +
          fighter.style +
          " Return useful code and brief setup notes. Do not include secrets, tokens, cookies, malware, phishing, or destructive commands."
      },
      {
        role: "user",
        content:
          "Build this as code. Keep it safe and practical:\n\n" + prompt
      }
    ],
    max_tokens: 900
  });

  return extractText(result).slice(0, 12000);
}

function extractText(result) {
  if (!result) return "// No AI response returned.";
  if (typeof result === "string") return result;
  if (typeof result.response === "string") return result.response;
  if (result.result && typeof result.result.response === "string") return result.result.response;
  if (Array.isArray(result.choices) && result.choices[0]?.message?.content) {
    return result.choices[0].message.content;
  }
  return JSON.stringify(result, null, 2);
}

async function checkRateLimit(env, request, custom) {
  // Browser localStorage is UX only. This is the server-side guard.
  // Uses RATE_LIMIT KV when available. If unavailable, allow but do not pretend it is enforced.
  if (!env.RATE_LIMIT || typeof env.RATE_LIMIT.get !== "function") {
    return { ok: true, soft: true };
  }

  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";

  const safeIp = ip.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 80);
  const now = Date.now();
  const day = new Date().toISOString().slice(0, 10);

  const cooldownKey = `fight-club:cooldown:${safeIp}`;
  const last = await env.RATE_LIMIT.get(cooldownKey);

  if (last && now - Number(last) < COOLDOWN_MS) {
    return { ok: false, error: "Wait 30 seconds between battles." };
  }

  await env.RATE_LIMIT.put(cooldownKey, String(now), { expirationTtl: 60 });

  if (custom) {
    const customKey = `fight-club:custom:${safeIp}:${day}`;
    const count = Number(await env.RATE_LIMIT.get(customKey) || "0");

    if (count >= CUSTOM_DAILY_LIMIT) {
      return { ok: false, error: "Daily custom battle limit reached." };
    }

    await env.RATE_LIMIT.put(customKey, String(count + 1), { expirationTtl: 90_000 });
  }

  return { ok: true };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
