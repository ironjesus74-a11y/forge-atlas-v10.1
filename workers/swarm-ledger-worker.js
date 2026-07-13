/**
 * FORGE ATLAS · swarm-ledger-worker (Phase 2 · shared world)
 * GET|POST /api/swarm-ledger
 *
 * The persistent, SHARED all-time ledger behind the swarm field.
 * Every visitor's finished matches and spectator prompts are recorded
 * in D1, so the Sigma-vs-Omega tally is genuinely global — labeled
 * honestly in the UI as "ALL-TIME · shared ledger".
 *
 * REQUIRES (bindings — Pages dashboard or wrangler [env.swarm-ledger]):
 *   DB          · D1 database "forge-atlas-ledger" (schema: db/schema.sql)
 *   RATE_LIMIT  · KV namespace for the per-IP write limiter (optional)
 *
 * GET → {
 *   ok, configured, sigma, omega, draws, totalMatches,
 *   totalPrompts, sigmaPrompts, omegaPrompts,
 *   recent: [{ ts, winner, sigma_score, omega_score } x ≤8 newest]
 * }
 *
 * POST body → { type:"match", winner, sigmaScore, omegaScore }
 *           | { type:"prompt", faction }
 *   ts is set server-side. Malformed input → 400.
 *   > 20 writes/min/IP → 429 { ok:false, error:"rate_limited" }.
 *
 * GRACEFUL DEGRADATION: if env.DB is absent (bindings not configured
 * yet), BOTH methods return HTTP 200 { ok:false, configured:false } so
 * the frontend simply hides the shared panel — nothing crashes.
 */

import { checkRateLimit } from "./lib/rate-limit.js";

const VERSION = "1.0.0";
const WRITES_PER_MIN = 20;   // per-IP POST budget
const SCORE_MAX = 9999;      // clamp ceiling for absurd score values

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(env);

    try {
      if (request.method === "GET") return await handleGet(env);
      if (request.method === "POST") return await handlePost(request, env);
      return j({ ok: false, error: "method_not_allowed" }, 405, env);
    } catch (err) {
      return j({ ok: false, error: "exception", detail: String(err.message || err) }, 500, env);
    }
  },
};

// ── GET · all-time aggregates ───────────────────────────────
async function handleGet(env) {
  if (!env.DB) return j(notConfigured(), 200, env);

  const [mAgg, pAgg, recent] = await Promise.all([
    env.DB.prepare(
      "SELECT COUNT(*) AS total, " +
      "SUM(CASE WHEN winner = 'sigma' THEN 1 ELSE 0 END) AS sigma, " +
      "SUM(CASE WHEN winner = 'omega' THEN 1 ELSE 0 END) AS omega, " +
      "SUM(CASE WHEN winner = 'draw'  THEN 1 ELSE 0 END) AS draws " +
      "FROM matches"
    ).first(),
    env.DB.prepare(
      "SELECT COUNT(*) AS total, " +
      "SUM(CASE WHEN faction = 'sigma' THEN 1 ELSE 0 END) AS sigma, " +
      "SUM(CASE WHEN faction = 'omega' THEN 1 ELSE 0 END) AS omega " +
      "FROM prompts"
    ).first(),
    env.DB.prepare(
      "SELECT ts, winner, sigma_score, omega_score FROM matches ORDER BY ts DESC LIMIT 8"
    ).all(),
  ]);

  return j({
    ok: true,
    configured: true,
    version: VERSION,
    sigma: n(mAgg && mAgg.sigma),
    omega: n(mAgg && mAgg.omega),
    draws: n(mAgg && mAgg.draws),
    totalMatches: n(mAgg && mAgg.total),
    totalPrompts: n(pAgg && pAgg.total),
    sigmaPrompts: n(pAgg && pAgg.sigma),
    omegaPrompts: n(pAgg && pAgg.omega),
    recent: (recent && recent.results) || [],
  }, 200, env);
}

// ── POST · record an event ──────────────────────────────────
async function handlePost(request, env) {
  // Browser-origin lock (defense-in-depth; non-browser clients are
  // governed by the rate limiter + strict validation below).
  const origin = request.headers.get("origin") || "";
  if (env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== "*" && origin && origin !== env.ALLOWED_ORIGIN) {
    return j({ ok: false, error: "forbidden" }, 403, env);
  }

  // Per-IP write limiter — no-ops gracefully if RATE_LIMIT is unbound.
  const rl = await checkRateLimit(env, request, "ledger", WRITES_PER_MIN);
  if (rl.limited) return j({ ok: false, error: "rate_limited" }, 429, env);

  if (!env.DB) return j(notConfigured(), 200, env);

  let body;
  try { body = await request.json(); }
  catch { return j({ ok: false, error: "invalid_json" }, 400, env); }

  const type = String(body.type || "");
  const ts = Date.now(); // server-side timestamp, always

  if (type === "match") {
    const winner = String(body.winner || "");
    if (winner !== "sigma" && winner !== "omega" && winner !== "draw") {
      return j({ ok: false, error: "invalid_winner" }, 400, env);
    }
    const sigmaScore = toScore(body.sigmaScore);
    const omegaScore = toScore(body.omegaScore);
    if (sigmaScore === null || omegaScore === null) {
      return j({ ok: false, error: "invalid_score" }, 400, env);
    }
    await env.DB.prepare(
      "INSERT INTO matches (ts, winner, sigma_score, omega_score) VALUES (?1, ?2, ?3, ?4)"
    ).bind(ts, winner, sigmaScore, omegaScore).run();
    return j({ ok: true, configured: true, recorded: "match", ts }, 200, env);
  }

  if (type === "prompt") {
    const faction = String(body.faction || "");
    if (faction !== "sigma" && faction !== "omega") {
      return j({ ok: false, error: "invalid_faction" }, 400, env);
    }
    await env.DB.prepare(
      "INSERT INTO prompts (ts, faction) VALUES (?1, ?2)"
    ).bind(ts, faction).run();
    return j({ ok: true, configured: true, recorded: "prompt", ts }, 200, env);
  }

  return j({ ok: false, error: "invalid_type" }, 400, env);
}

// ── helpers ─────────────────────────────────────────────────
function notConfigured() {
  return {
    ok: false,
    configured: false,
    hint: "Bind D1 database 'forge-atlas-ledger' as DB (and KV as RATE_LIMIT) in Pages → Settings → Functions, or deploy via wrangler --env swarm-ledger.",
  };
}

// Strict score validation: must be a non-negative integer.
// Absurdly high values are clamped to SCORE_MAX rather than rejected.
function toScore(v) {
  if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) return null;
  return Math.min(v, SCORE_MAX);
}

function n(v) { return Number(v) || 0; }

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": (env && env.ALLOWED_ORIGIN) || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
