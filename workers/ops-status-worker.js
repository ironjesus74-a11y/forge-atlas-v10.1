/**
 * FORGE ATLAS · ops-status-worker
 * GET /api/ops-status
 *
 * Returns a machine-readable snapshot of the deployed environment's
 * configuration — site mode, helper mode, integration flags, worker
 * availability, deployment readiness checks. Designed for the future
 * Atlas Command Center to consume.
 *
 * Never returns secrets — only their presence/absence as booleans.
 */

const VERSION = "1.0.0";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(env);
    if (request.method !== "GET")
      return json({ error: "method_not_allowed" }, 405, env);

    const u = new URL(request.url);
    const origin = u.origin;

    // Probe sibling Workers (best-effort, short timeout, never blocking)
    const probes = await Promise.all([
      probe(`${origin}/api/atlas-helper`, "POST"),
      probe(`${origin}/api/seo-audit?url=/index.html`, "GET"),
    ]);

    const status = {
      version: VERSION,
      timestamp: new Date().toISOString(),
      site: {
        origin,
        mode: env.SITE_MODE || "static",
        custom_domain: !/\.pages\.dev$/.test(u.hostname),
        environment: env.ENV || "production",
      },
      helper: {
        mode: env.LIVE_AI_URL ? "live-ai-adapter" : "rules-only",
        live_ai_configured: Boolean(env.LIVE_AI_URL),
        rules_engine: "1.0.0",
      },
      integrations: {
        github: {
          enabled: false,
          reason: "Write-actions are designed-but-disabled in this build. Enable via secured GitHub App.",
          configured: Boolean(env.GITHUB_APP_ID),
        },
        cloudflare_pages: {
          enabled: true,
          deploy_trigger: false,
          reason: "Pages auto-deploys on git push or manual upload. Programmatic deploys require API token.",
          configured: Boolean(env.CF_API_TOKEN),
        },
        analytics: {
          enabled: Boolean(env.ANALYTICS_ENABLED === "true"),
          provider: env.ANALYTICS_PROVIDER || "none",
        },
        anthropic: {
          enabled: Boolean(env.LIVE_AI_URL),
          mode: env.LIVE_AI_URL ? "worker-adapter" : "disabled",
          reason: env.LIVE_AI_URL ? "Adapter Worker configured." : "Set LIVE_AI_URL to enable AI-augmented help.",
        },
      },
      workers: {
        atlas_helper: {
          path: "/api/atlas-helper",
          method: "POST",
          available: probes[0].ok,
          status: probes[0].status,
          modes: ["seo", "routes", "metadata", "deploy", "site-cleanup", "trust-review", "help"],
        },
        seo_audit: {
          path: "/api/seo-audit",
          method: "GET",
          available: probes[1].ok,
          status: probes[1].status,
          query: "?url=/path",
        },
        ops_status: {
          path: "/api/ops-status",
          method: "GET",
          available: true,
          status: 200,
        },
      },
      readiness: {
        score: scoreReadiness(probes, env),
        checks: [
          { id: "atlas_helper_responsive", ok: probes[0].ok },
          { id: "seo_audit_responsive", ok: probes[1].ok },
          { id: "allowed_origin_set", ok: Boolean(env.ALLOWED_ORIGIN), severity: "warning" },
          { id: "secrets_clean", ok: !exposesSecrets(env) },
          { id: "live_ai_optional", ok: true, note: "Optional. Helper works without it." },
        ],
      },
      future_actions: {
        github_pr_creator: "designed; disabled until secured auth is added",
        cf_pages_deploy: "designed; disabled until API token + role-gating is added",
        content_publish: "designed; depends on auth + storage layer",
        route_update_workflow: "designed; depends on _redirects update tooling",
      },
    };

    return json(status, 200, env);
  },
};

async function probe(url, method) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const r = await fetch(url, {
      method,
      signal: controller.signal,
      // POST probe: send a no-op body the helper recognizes
      body: method === "POST" ? JSON.stringify({ mode: "help", message: "" }) : undefined,
      headers: method === "POST" ? { "content-type": "application/json" } : {},
    });
    clearTimeout(timer);
    return { ok: r.status < 500, status: r.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

function exposesSecrets(env) {
  // Simple heuristic: flag if any var looks like a real key was placed where a flag belongs
  const flagPatterns = /(sk-|sk_live|sk_test|api_key|bearer\s)/i;
  for (const k of Object.keys(env || {})) {
    const v = String(env[k] || "");
    if (k.toLowerCase().includes("key") && flagPatterns.test(v) && !k.endsWith("_NAME")) return true;
  }
  return false;
}

function scoreReadiness(probes, env) {
  let s = 0;
  if (probes[0].ok) s += 35;
  if (probes[1].ok) s += 35;
  if (env.ALLOWED_ORIGIN) s += 15;
  if (!exposesSecrets(env)) s += 15;
  return s;
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": (env && env.ALLOWED_ORIGIN) || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}
function cors(env) {
  return new Response(null, { status: 204, headers: corsHeaders(env) });
}
function json(payload, status, env) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...corsHeaders(env),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=30",
    },
  });
}
