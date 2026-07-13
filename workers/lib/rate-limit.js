/**
 * FORGE ATLAS · shared KV rate limiter
 *
 * Soft per-IP write limiter backed by a KV namespace bound as RATE_LIMIT.
 * Counter key per (scope, IP) with a 60s TTL — i.e. "max N writes per
 * rolling-ish minute per IP". KV is eventually consistent, so this is a
 * quota-abuse guard, not a hard security boundary. That is fine here:
 * the goal is stopping runaway loops and casual flooding.
 *
 * GRACEFUL DEGRADATION: if env.RATE_LIMIT is absent (binding not yet
 * configured) or KV itself throws, we NEVER block the request — the
 * limiter silently no-ops so the API keeps working.
 *
 * Usage:
 *   import { checkRateLimit } from "./lib/rate-limit.js";
 *   const rl = await checkRateLimit(env, request, "cf-ai", 10);
 *   if (rl.limited) return j({ ok: false, error: "rate_limited" }, 429, env);
 */

export async function checkRateLimit(env, request, scope, limit) {
  if (!env || !env.RATE_LIMIT) return { limited: false, skipped: true };
  try {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const key = `rl:${scope}:${ip}`;
    const current = parseInt((await env.RATE_LIMIT.get(key)) || "0", 10) || 0;
    if (current >= limit) return { limited: true };
    // 60s is the KV minimum TTL — exactly the window we want.
    await env.RATE_LIMIT.put(key, String(current + 1), { expirationTtl: 60 });
    return { limited: false };
  } catch (_) {
    // Never let the limiter take the API down.
    return { limited: false, skipped: true };
  }
}
