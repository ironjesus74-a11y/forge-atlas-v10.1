/**
 * FORGE ATLAS · atlas-helper-worker
 * POST /api/atlas-helper
 *
 * Rules-driven expert helper. Runs fully without live AI.
 * If env.LIVE_AI_URL is configured, calls that adapter for fuzzy questions
 * the rule engine doesn't cleanly resolve. Never holds the API key —
 * the LIVE_AI_URL endpoint is itself a separate Worker that holds the secret.
 *
 * Modes:
 *   seo            · score and improve a metadata snapshot
 *   routes         · diagnose a path/file list (orphans, dupes, redirects)
 *   metadata       · suggest title/description/OG improvements
 *   deploy         · pre-deploy readiness checklist
 *   site-cleanup   · flag risky / dead / duplicate files
 *   trust-review   · scan copy for fake-claim language
 *   help           · operator FAQ routing (default)
 */

const VERSION = "1.0.0";

// ---------- ENTRY ----------
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(env);
    if (request.method !== "POST")
      return json({ error: "method_not_allowed" }, 405, env);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400, env);
    }

    const mode = String(body.mode || "help").toLowerCase().trim();
    const ctx = body.context || {};
    const message = String(body.message || "").slice(0, 4000);

    let result;
    try {
      switch (mode) {
        case "seo":          result = analyzeSEO(ctx); break;
        case "routes":       result = analyzeRoutes(ctx); break;
        case "metadata":     result = analyzeMetadata(ctx); break;
        case "deploy":       result = deployChecklist(ctx); break;
        case "site-cleanup": result = analyzeCleanup(ctx); break;
        case "trust-review": result = trustReview(ctx); break;
        case "help":
        default:             result = await helpRoute(message, env); break;
      }
    } catch (err) {
      return json({ error: "rule_engine_failed", detail: String(err.message || err) }, 500, env);
    }

    return json(
      {
        mode,
        version: VERSION,
        live_ai: Boolean(env.LIVE_AI_URL),
        ...result,
      },
      200,
      env
    );
  },
};

// ---------- CORS / JSON ----------
function corsHeaders(env) {
  const origin = (env && env.ALLOWED_ORIGIN) || "*";
  return {
    "Access-Control-Allow-Origin": origin,
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

// ============================================================
// MODE: seo  — score a metadata snapshot
// ctx: { title, description, canonical, h1Count, ogTitle, ogDescription,
//        ogImage, twitterCard, jsonLd, robotsMeta, imgWithoutAlt, lang }
// ============================================================
function analyzeSEO(ctx) {
  const findings = [];
  const wins = [];
  const t = (ctx.title || "").trim();
  const d = (ctx.description || "").trim();
  const h1 = Number(ctx.h1Count) || 0;

  // TITLE
  if (!t) findings.push(crit("missing_title", "No <title> on the page", "Add a unique 50–60 character title that includes the page's primary intent."));
  else if (t.length < 30) findings.push(warn("title_short", `Title is ${t.length} chars`, "Aim for 50–60 chars. Add brand suffix or differentiator."));
  else if (t.length > 65) findings.push(warn("title_long", `Title is ${t.length} chars (truncates in SERPs)`, "Trim to ≤60 chars while keeping primary intent at the front."));
  else wins.push("Title length in optimal SERP range.");

  // DESCRIPTION
  if (!d) findings.push(crit("missing_description", "No meta description", "Write a 150–160 char description that promises a specific outcome."));
  else if (d.length < 70) findings.push(warn("desc_short", `Description is ${d.length} chars`, "Expand to 150–160 chars. Include the differentiated promise."));
  else if (d.length > 170) findings.push(warn("desc_long", `Description is ${d.length} chars (truncates)`, "Trim to ≤160 chars."));
  else wins.push("Meta description in optimal range.");

  // CANONICAL
  if (!ctx.canonical) findings.push(warn("missing_canonical", "No canonical URL", "Add <link rel='canonical' href='ABSOLUTE_URL'> to prevent duplicate-content splits."));
  else if (!/^https?:\/\//i.test(ctx.canonical)) findings.push(warn("canonical_relative", "Canonical is relative", "Canonical should be absolute (https://your-domain.com/page)."));

  // H1
  if (h1 === 0) findings.push(crit("no_h1", "No H1 on page", "Every page needs exactly one H1 stating its primary intent."));
  else if (h1 > 1) findings.push(warn("multi_h1", `${h1} H1 tags found`, "Reduce to one H1; demote secondary H1s to H2."));
  else wins.push("Exactly one H1 — clean.");

  // OG
  if (!ctx.ogTitle) findings.push(warn("missing_og_title", "No og:title", "Add og:title for social shares."));
  if (!ctx.ogDescription) findings.push(warn("missing_og_desc", "No og:description", "Add og:description for social shares."));
  if (!ctx.ogImage) findings.push(warn("missing_og_image", "No og:image", "Add a 1200×630 og:image for branded share cards."));

  // TWITTER
  if (!ctx.twitterCard) findings.push(info("no_twitter_card", "No twitter:card meta", "Add <meta name='twitter:card' content='summary_large_image'> for X/Twitter previews."));

  // JSON-LD
  if (!ctx.jsonLd) findings.push(info("no_json_ld", "No structured data", "Add JSON-LD (Organization on home, BreadcrumbList on inner pages)."));

  // ALT TEXT
  const alt = Number(ctx.imgWithoutAlt) || 0;
  if (alt > 0) findings.push(warn("missing_alt", `${alt} image(s) without alt text`, "Add descriptive alt text. Decorative images use alt='' (empty)."));

  // ROBOTS
  if (ctx.robotsMeta && /noindex/i.test(ctx.robotsMeta))
    findings.push(crit("noindex_set", "Robots meta is noindex", "If this page should rank, remove the noindex."));

  // LANG
  if (!ctx.lang) findings.push(info("missing_lang", "No <html lang>", "Set <html lang='en'> for accessibility + SEO."));

  // SCORE
  const total = findings.length + wins.length;
  const passed = wins.length;
  const score = total ? Math.round((passed / total) * 100) : 0;

  const buckets = {
    critical: findings.filter((f) => f.severity === "critical"),
    warnings: findings.filter((f) => f.severity === "warning"),
    info: findings.filter((f) => f.severity === "info"),
  };

  return {
    summary: summarize("SEO audit", findings.length, wins.length),
    score,
    score_label: scoreLabel(score),
    findings,
    wins,
    buckets,
    next_steps: nextStepsFromFindings(findings),
  };
}

// ============================================================
// MODE: routes — diagnose a path/file list
// ctx: { paths: ["/index.html", "/arena.html", ...], links: [...] }
// links is an optional array of internal hrefs found on pages
// ============================================================
function analyzeRoutes(ctx) {
  const paths = Array.isArray(ctx.paths) ? ctx.paths.map(String) : [];
  const links = Array.isArray(ctx.links) ? ctx.links.map(String) : [];
  const findings = [];
  const wins = [];

  if (!paths.length) {
    return errResult("Provide ctx.paths as an array of '/file.html' strings.");
  }

  // Duplicates
  const seen = {};
  paths.forEach((p) => {
    const k = p.toLowerCase().replace(/\/$/, "") || "/";
    seen[k] = (seen[k] || 0) + 1;
  });
  Object.keys(seen).forEach((k) => {
    if (seen[k] > 1) findings.push(warn("duplicate_path", `Path appears ${seen[k]}× in manifest: ${k}`, "Remove duplicates from the file manifest."));
  });

  // Required pages
  const required = ["index.html"];
  required.forEach((r) => {
    const has = paths.some((p) => p.endsWith(r));
    if (!has) findings.push(crit("missing_required", `Required file missing: ${r}`, `Add ${r} or change deploy entry point.`));
    else wins.push(`Has ${r}.`);
  });

  // Unsafe extensions
  const risky = [".env", ".pem", ".key", ".sqlite", ".db", "id_rsa", ".log"];
  paths.forEach((p) => {
    risky.forEach((ext) => {
      if (p.toLowerCase().endsWith(ext) || p.toLowerCase().includes(ext)) {
        findings.push(crit("risky_file", `Unsafe file in deploy: ${p}`, "Remove before deploying — exposes secrets or PII."));
      }
    });
  });

  // Orphans (pages that exist but nothing links to)
  if (links.length) {
    const linkSet = new Set(links.map((l) => l.toLowerCase().replace(/^\//, "").replace(/\/$/, "")));
    paths.forEach((p) => {
      const norm = p.toLowerCase().replace(/^\//, "").replace(/\/$/, "");
      if (!norm.endsWith(".html")) return;
      if (norm === "index.html") return;
      if (!linkSet.has(norm) && !linkSet.has(norm.replace(/\.html$/, ""))) {
        findings.push(info("orphan_page", `No internal links point to ${p}`, "Either link to it from another page or remove if unused."));
      }
    });
  }

  // Common typo'd routes
  const aliases = {
    "/home": "/index.html",
    "/index": "/index.html",
    "/jobs": "/freelance.html",
    "/feed": "/forum.html",
    "/id": "/atlas-id.html",
  };
  const out = [];
  Object.keys(aliases).forEach((alias) => {
    out.push(`${alias}  →  ${aliases[alias]}  (recommend in _redirects)`);
  });
  if (out.length) wins.push("Recommended aliases ready for _redirects: " + out.length);

  return {
    summary: summarize("Route audit", findings.length, wins.length),
    findings,
    wins,
    redirects_recommended: out,
    next_steps: nextStepsFromFindings(findings),
  };
}

// ============================================================
// MODE: metadata — improve title / description / OG
// ctx: { pageType: "home|product|article|category|other", topic, brand,
//        currentTitle, currentDescription }
// ============================================================
function analyzeMetadata(ctx) {
  const pageType = String(ctx.pageType || "other").toLowerCase();
  const topic = String(ctx.topic || "").trim();
  const brand = String(ctx.brand || "Forge Atlas").trim();
  const findings = [];

  if (!topic) findings.push(crit("no_topic", "Provide ctx.topic (the page's primary intent)", "e.g. 'AI Arena battles' or 'Operator profiles'"));

  const titleSuggestions = [];
  const descSuggestions = [];

  if (topic) {
    if (pageType === "home") {
      titleSuggestions.push(
        `${brand} — Built Different. ${topic}.`,
        `${topic} · ${brand}`,
        `${brand}: The Operator Layer for ${topic}`
      );
      descSuggestions.push(
        `${brand} is a static-first prototype for a future ${topic} platform — backend-ready, never backend-fake.`,
        `${topic} for the AI era. Operator identity, marketplace, arena, and swarm battles. Built Different.`
      );
    } else if (pageType === "product") {
      titleSuggestions.push(
        `${topic} — ${brand}`,
        `Buy ${topic} · ${brand}`,
        `${topic} · Operator-grade · ${brand}`
      );
      descSuggestions.push(
        `${topic}. Tested across operator workflows. Manual fulfillment within 24 hours.`
      );
    } else if (pageType === "article") {
      titleSuggestions.push(
        `${topic} — ${brand}`,
        `Inside ${topic} · ${brand}`,
        `${topic}: A Field Note · ${brand}`
      );
      descSuggestions.push(
        `${topic}. What we learned, what we shipped, what stays static, what goes live.`
      );
    } else {
      titleSuggestions.push(`${topic} — ${brand}`, `${topic} · ${brand}`);
      descSuggestions.push(`${topic}. Static today, backend-ready tomorrow.`);
    }
  }

  return {
    summary: topic
      ? `Generated ${titleSuggestions.length} title and ${descSuggestions.length} description options for "${topic}".`
      : "Cannot generate without ctx.topic.",
    findings,
    title_suggestions: titleSuggestions.map(trimTitle),
    description_suggestions: descSuggestions.map(trimDesc),
    og_image_spec: { width: 1200, height: 630, format: "jpg or png", note: "Include brand mark + headline." },
    json_ld_template: jsonLdTemplate(pageType, topic, brand),
  };
}

// ============================================================
// MODE: deploy — pre-deploy readiness checklist
// ctx: { hasSitemap, hasRobots, hasHeaders, hasRedirects, has404,
//        hasFavicon, hasOgImage, customDomain, secretsScan, paypalConfigured }
// ============================================================
function deployChecklist(ctx) {
  const checks = [
    { id: "favicon",    label: "favicon.svg or favicon.ico exists",          ok: !!ctx.hasFavicon, severity: "warning" },
    { id: "robots",     label: "robots.txt exists",                          ok: !!ctx.hasRobots, severity: "warning" },
    { id: "sitemap",    label: "sitemap.xml exists and is referenced",       ok: !!ctx.hasSitemap, severity: "warning" },
    { id: "headers",    label: "_headers (CF Pages security headers)",       ok: !!ctx.hasHeaders, severity: "warning" },
    { id: "redirects",  label: "_redirects (clean URL aliases)",             ok: !!ctx.hasRedirects, severity: "info" },
    { id: "404",        label: "404.html for missing pages",                 ok: !!ctx.has404, severity: "info" },
    { id: "og",         label: "opengraph image present",                    ok: !!ctx.hasOgImage, severity: "warning" },
    { id: "domain",     label: "custom domain attached (not *.pages.dev)",   ok: !!ctx.customDomain, severity: "info" },
    { id: "secrets",    label: "no API keys in client code",                 ok: ctx.secretsScan === "clean", severity: "critical" },
    { id: "payment",    label: "payment integration verified",               ok: !!ctx.paypalConfigured, severity: "info" },
  ];

  const failed = checks.filter((c) => !c.ok);
  const passed = checks.filter((c) => c.ok);
  const blockers = failed.filter((c) => c.severity === "critical");

  return {
    summary: blockers.length
      ? `BLOCKED: ${blockers.length} critical issue(s).`
      : failed.length
      ? `Ready with ${failed.length} non-blocking gap(s).`
      : "Green light. Ship it.",
    ready_to_ship: blockers.length === 0,
    score: Math.round((passed.length / checks.length) * 100),
    checks,
    blockers,
    next_steps: failed.map((f) => `${f.severity.toUpperCase()} · ${f.label}`),
  };
}

// ============================================================
// MODE: site-cleanup — risky/duplicate/dead files
// ctx: { files: ["/path/file.ext", ...] }
// ============================================================
function analyzeCleanup(ctx) {
  const files = Array.isArray(ctx.files) ? ctx.files.map(String) : [];
  const findings = [];

  if (!files.length) return errResult("Provide ctx.files as an array.");

  const RISKY = [".env", ".env.local", ".env.production", ".pem", ".key", "id_rsa", ".sqlite", ".db", ".log", "credentials", "secret"];
  const DEAD = [".DS_Store", "Thumbs.db", "desktop.ini", ".swp", "~", ".bak", ".orig", ".tmp"];
  const NODE = ["node_modules/", ".npm/", "package-lock.json", "yarn.lock"];
  const SOURCE = [".tsx", ".ts", ".jsx", "src/", ".scss", ".sass", "vite.config", "webpack.config", "tsconfig.json"];

  const lower = files.map((f) => f.toLowerCase());

  RISKY.forEach((needle) => {
    lower.forEach((f, i) => {
      if (f.includes(needle)) findings.push(crit("risky", `${files[i]} — contains "${needle}"`, "Delete before deploy. May leak secrets."));
    });
  });
  DEAD.forEach((needle) => {
    lower.forEach((f, i) => {
      if (f.endsWith(needle) || f.includes("/" + needle)) findings.push(info("dead", `${files[i]} — junk`, "Safe to delete."));
    });
  });
  NODE.forEach((needle) => {
    lower.forEach((f, i) => {
      if (f.includes(needle)) findings.push(warn("node_artifact", `${files[i]} — build artifact`, "Static deploys do not need this. Delete."));
    });
  });

  let sourceCount = 0;
  SOURCE.forEach((needle) => {
    lower.forEach((f) => {
      if (f.includes(needle)) sourceCount++;
    });
  });
  if (sourceCount > 0) findings.push(info("source_files", `${sourceCount} build-source file(s) present`, "Static-first sites should not include uncompiled sources in deploy. Move to a separate /src folder or delete."));

  // Duplicate filenames
  const byName = {};
  files.forEach((f) => {
    const base = f.split("/").pop();
    byName[base] = (byName[base] || 0) + 1;
  });
  Object.keys(byName).forEach((n) => {
    if (byName[n] > 1) findings.push(info("duplicate_name", `${n} appears ${byName[n]}× across folders`, "Verify these are intentional copies."));
  });

  return {
    summary: summarize("Cleanup scan", findings.length, files.length - findings.length),
    files_scanned: files.length,
    findings,
    next_steps: nextStepsFromFindings(findings),
  };
}

// ============================================================
// MODE: trust-review — fake-claim language scanner
// ctx: { copy: "...combined site copy or specific page text..." }
// ============================================================
function trustReview(ctx) {
  const text = String(ctx.copy || "").slice(0, 50000);
  if (!text) return errResult("Provide ctx.copy as the body text to review.");

  const flagged = [];
  const PATTERNS = [
    { rx: /\bwe('|')re\s+the\s+(world's|#1|number\s+one|leading)\b/gi, why: "Unverifiable superlative. Replace with concrete proof." },
    { rx: /\b(real-time|live)\s+ai\b/gi, why: "Implies live AI. Confirm a Worker is actually wired or label as static demo." },
    { rx: /\binstantly\s+deliver(ed|s|y)?\b/gi, why: "Implies automatic fulfillment. If manual, say so." },
    { rx: /\bjoin\s+\d{4,}\+?\s+(operators|users|members)\b/gi, why: "User count claim. Verify with real number or remove." },
    { rx: /\btrusted\s+by\s+(thousands|millions)\b/gi, why: "Vague trust claim. Replace with named users or remove." },
    { rx: /\bbacked\s+by\s+(yc|y\s*combinator|sequoia|a16z)\b/gi, why: "Investor name-drop. Verify before publishing." },
    { rx: /\b(zero|no)\s+(human|manual)\s+intervention\b/gi, why: "Hands-off claim. Confirm automation actually exists." },
    { rx: /\bguaranteed\b/gi, why: "Guarantee language has legal weight. Confirm or soften." },
    { rx: /\b(100%|completely)\s+(secure|safe|private)\b/gi, why: "Absolute security claim. Soften — no system is 100% secure." },
    { rx: /\bmilitary[-\s]?grade\b/gi, why: "Marketing cliché with no defined meaning. Replace with specifics." },
    { rx: /\benterprise[-\s]?grade\b/gi, why: "Vague tier claim. State the actual feature differentiator." },
    { rx: /\baccount\s+(created|sync(ed|ing))\b/gi, why: "If using localStorage only, do not imply server account." },
    { rx: /\bautomatic(ally)?\s+(deploy|publish|sync)/gi, why: "Confirm a real CI/CD path exists." },
  ];

  PATTERNS.forEach((p) => {
    let m;
    while ((m = p.rx.exec(text)) !== null) {
      flagged.push({
        match: m[0],
        position: m.index,
        why: p.why,
      });
    }
  });

  return {
    summary: flagged.length
      ? `Flagged ${flagged.length} claim(s) that need verification or softening.`
      : "Trust scan clean. No fake-claim patterns detected.",
    flagged_count: flagged.length,
    flagged,
    next_steps: flagged.length
      ? ["Replace each flagged phrase with verified specifics or remove.",
         "Use 'static prototype' / 'manual fulfillment' / 'browser-local' where applicable.",
         "Trust compounds. Honesty today buys credibility tomorrow."]
      : ["Pattern scan clean — but rules cannot catch everything. Read the page yourself before launch."],
  };
}

// ============================================================
// MODE: help — operator FAQ routing (with optional AI handoff)
// ============================================================
async function helpRoute(message, env) {
  const t = message.toLowerCase().trim();

  const ROUTES = [
    { keys: ["seo", "search engine", "ranking", "google"], reply: "For SEO guidance, switch the helper mode to `seo` and pass a metadata snapshot. For full page audits, GET /api/seo-audit?url=/your-page.html." },
    { keys: ["deploy", "cloudflare", "pages", "publish", "ship"], reply: "Switch mode to `deploy` and pass the readiness flags. For deployment steps see docs/cloudflare-integration.md." },
    { keys: ["routes", "links", "navigation", "404", "broken"], reply: "Switch mode to `routes` and pass ctx.paths (file list) and ctx.links (internal hrefs found across pages)." },
    { keys: ["meta", "title", "description", "og", "social"], reply: "Switch mode to `metadata` and pass ctx.topic + ctx.pageType. Returns title/description options + JSON-LD template." },
    { keys: ["clean", "junk", "dead file", "tidy", "remove"], reply: "Switch mode to `site-cleanup` and pass ctx.files (full file list)." },
    { keys: ["trust", "honest", "fake", "claim"], reply: "Switch mode to `trust-review` and pass ctx.copy (page text). Flags hype language for replacement." },
    { keys: ["status", "ops", "config"], reply: "GET /api/ops-status returns the live config snapshot — no inputs needed." },
    { keys: ["claude", "anthropic", "ai key", "api key"], reply: "Never put an Anthropic key in frontend. Deploy a separate Worker with the key as a secret env var. The atlas-helper-worker calls THAT worker via env.LIVE_AI_URL when configured. README has the full template." },
    { keys: ["github", "git", "push", "commit"], reply: "GitHub write actions are designed-but-disabled in this build. Enabling requires a separate auth layer with a GitHub App or fine-grained PAT bound to a Worker secret. See docs/cloudflare-integration.md → 'Phase E'." },
    { keys: ["fallback", "offline", "static mode"], reply: "If a Worker is unreachable, the frontend helper falls back to a local rules engine. Same UX, same advice quality for the modes that don't need a real fetch (seo, metadata, deploy, trust-review)." },
  ];

  for (const r of ROUTES) {
    if (r.keys.some((k) => t.includes(k))) {
      return { summary: r.reply, matched: true };
    }
  }

  // Optional live AI handoff
  if (env && env.LIVE_AI_URL && t.length > 3) {
    try {
      const r = await fetch(env.LIVE_AI_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: t.slice(0, 2000) }),
      });
      if (r.ok) {
        const data = await r.json();
        return { summary: data.reply || "AI adapter returned no reply.", matched: false, source: "live-ai" };
      }
    } catch {
      // fall through
    }
  }

  return {
    summary:
      "I'm a rules-driven helper. Ask about SEO, deploy, routes, metadata, cleanup, or trust review. For freeform questions configure env.LIVE_AI_URL on the Worker.",
    matched: false,
    available_modes: ["seo", "routes", "metadata", "deploy", "site-cleanup", "trust-review", "help"],
  };
}

// ============================================================
// HELPERS
// ============================================================
function crit(id, what, fix) { return { id, severity: "critical", what, fix }; }
function warn(id, what, fix) { return { id, severity: "warning", what, fix }; }
function info(id, what, fix) { return { id, severity: "info", what, fix }; }
function errResult(msg) { return { error: msg, summary: msg, findings: [] }; }

function summarize(label, issueCount, winCount) {
  if (issueCount === 0) return `${label}: clean. ${winCount} pass.`;
  return `${label}: ${issueCount} finding(s), ${winCount} pass.`;
}
function nextStepsFromFindings(findings) {
  const order = { critical: 0, warning: 1, info: 2 };
  return findings
    .slice()
    .sort((a, b) => (order[a.severity] || 9) - (order[b.severity] || 9))
    .slice(0, 5)
    .map((f) => `${f.severity.toUpperCase()} · ${f.what} — ${f.fix}`);
}
function scoreLabel(s) {
  if (s >= 90) return "excellent";
  if (s >= 75) return "good";
  if (s >= 50) return "fair";
  return "needs work";
}
function trimTitle(s) { return s.length > 60 ? s.slice(0, 57) + "…" : s; }
function trimDesc(s) { return s.length > 160 ? s.slice(0, 157) + "…" : s; }

function jsonLdTemplate(pageType, topic, brand) {
  if (pageType === "home") {
    return {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: brand,
      description: `${topic} for the AI era.`,
      url: "https://YOUR-DOMAIN.com",
    };
  }
  if (pageType === "article") {
    return {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: topic,
      author: { "@type": "Organization", name: brand },
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: topic,
    isPartOf: { "@type": "WebSite", name: brand },
  };
}
