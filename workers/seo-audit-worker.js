/**
 * FORGE ATLAS · seo-audit-worker
 * GET /api/seo-audit?url=/path/to/page.html
 *
 * Same-origin only. Fetches a page on the same Pages site, parses it with
 * Cloudflare's HTMLRewriter, and returns a structured audit.
 *
 * Hard rules:
 *   - Path must start with / (relative to deployed origin)
 *   - No open proxy: rejects absolute URLs, scheme prefixes, host overrides
 *   - Caches results for 5 minutes per path
 */

const VERSION = "1.0.0";
const CACHE_TTL = 300;

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return cors(env);
    if (request.method !== "GET")
      return json({ error: "method_not_allowed" }, 405, env);

    const u = new URL(request.url);
    const target = u.searchParams.get("url") || "";

    // STRICT: must be a same-origin path
    if (!target || !target.startsWith("/")) {
      return json(
        {
          error: "invalid_url",
          detail: "url must be a same-origin path starting with /",
          example: "/api/seo-audit?url=/index.html",
        },
        400,
        env
      );
    }
    if (target.includes("://") || target.startsWith("//")) {
      return json({ error: "no_open_proxy", detail: "Absolute URLs blocked." }, 400, env);
    }

    const targetUrl = new URL(target, u.origin).toString();

    // Cache check
    const cache = caches.default;
    const cacheKey = new Request(`${u.origin}/__seo-audit-cache${target}`);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    // Fetch
    let html;
    let status;
    let finalUrl = targetUrl;
    try {
      const r = await fetch(targetUrl, { headers: { "user-agent": "ForgeAtlas-SEO-Audit/1.0" } });
      status = r.status;
      finalUrl = r.url;
      if (!r.ok) {
        return json(
          { error: "fetch_failed", status, url: targetUrl, summary: `Fetched ${target} returned HTTP ${status}.` },
          200,
          env
        );
      }
      html = await r.text();
    } catch (err) {
      return json({ error: "fetch_error", detail: String(err.message || err) }, 502, env);
    }

    if (html.length > 2_000_000) {
      return json({ error: "page_too_large", size: html.length }, 413, env);
    }

    const snapshot = await parseHtml(html);
    const audit = scoreSnapshot(snapshot, target);

    const response = json(
      {
        version: VERSION,
        url: target,
        final_url: finalUrl,
        status,
        timestamp: new Date().toISOString(),
        ...audit,
        snapshot,
      },
      200,
      env
    );

    response.headers.set("cache-control", `public, max-age=${CACHE_TTL}`);
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};

// ---------- HTML PARSE ----------
async function parseHtml(html) {
  const snap = {
    title: "",
    description: "",
    canonical: "",
    lang: "",
    h1Count: 0,
    h1Text: [],
    h2Count: 0,
    h3Count: 0,
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    ogType: "",
    twitterCard: "",
    twitterTitle: "",
    twitterImage: "",
    robotsMeta: "",
    viewport: "",
    themeColor: "",
    jsonLd: false,
    jsonLdTypes: [],
    imgTotal: 0,
    imgWithoutAlt: 0,
    linksInternal: 0,
    linksExternal: 0,
    formCount: 0,
    scriptInline: 0,
    scriptExternal: 0,
    favicon: false,
    bodyTextLen: 0,
  };

  const rewriter = new HTMLRewriter()
    .on("html", { element(e) { snap.lang = e.getAttribute("lang") || ""; } })
    .on("title", { text(t) { if (!t.lastInTextNode || t.text) snap.title += t.text; } })
    .on('meta[name="description"]', { element(e) { snap.description = e.getAttribute("content") || ""; } })
    .on('meta[name="robots"]', { element(e) { snap.robotsMeta = e.getAttribute("content") || ""; } })
    .on('meta[name="viewport"]', { element(e) { snap.viewport = e.getAttribute("content") || ""; } })
    .on('meta[name="theme-color"]', { element(e) { snap.themeColor = e.getAttribute("content") || ""; } })
    .on('meta[property="og:title"]', { element(e) { snap.ogTitle = e.getAttribute("content") || ""; } })
    .on('meta[property="og:description"]', { element(e) { snap.ogDescription = e.getAttribute("content") || ""; } })
    .on('meta[property="og:image"]', { element(e) { snap.ogImage = e.getAttribute("content") || ""; } })
    .on('meta[property="og:type"]', { element(e) { snap.ogType = e.getAttribute("content") || ""; } })
    .on('meta[name="twitter:card"]', { element(e) { snap.twitterCard = e.getAttribute("content") || ""; } })
    .on('meta[name="twitter:title"]', { element(e) { snap.twitterTitle = e.getAttribute("content") || ""; } })
    .on('meta[name="twitter:image"]', { element(e) { snap.twitterImage = e.getAttribute("content") || ""; } })
    .on('link[rel="canonical"]', { element(e) { snap.canonical = e.getAttribute("href") || ""; } })
    .on('link[rel="icon"]', { element() { snap.favicon = true; } })
    .on('link[rel="shortcut icon"]', { element() { snap.favicon = true; } })
    .on("h1", {
      element() { snap.h1Count++; },
      text(t) {
        if (snap.h1Text.length < snap.h1Count) snap.h1Text.push("");
        const i = snap.h1Count - 1;
        if (snap.h1Text[i] !== undefined) snap.h1Text[i] = (snap.h1Text[i] || "") + (t.text || "");
      },
    })
    .on("h2", { element() { snap.h2Count++; } })
    .on("h3", { element() { snap.h3Count++; } })
    .on("img", {
      element(e) {
        snap.imgTotal++;
        const alt = e.getAttribute("alt");
        if (alt === null) snap.imgWithoutAlt++;
      },
    })
    .on("a[href]", {
      element(e) {
        const href = e.getAttribute("href") || "";
        if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
        if (/^https?:\/\//i.test(href)) snap.linksExternal++;
        else snap.linksInternal++;
      },
    })
    .on("form", { element() { snap.formCount++; } })
    .on("script", {
      element(e) {
        if (e.getAttribute("src")) snap.scriptExternal++;
        else snap.scriptInline++;
        if (e.getAttribute("type") === "application/ld+json") {
          snap.jsonLd = true;
        }
      },
    })
    .on('script[type="application/ld+json"]', {
      text(t) {
        try {
          // Accumulate JSON-LD content for type detection
          if (!snap._ld) snap._ld = "";
          snap._ld += t.text;
          if (t.lastInTextNode) {
            try {
              const parsed = JSON.parse(snap._ld);
              const arr = Array.isArray(parsed) ? parsed : [parsed];
              arr.forEach((item) => {
                if (item && item["@type"]) snap.jsonLdTypes.push(item["@type"]);
              });
            } catch {}
            snap._ld = "";
          }
        } catch {}
      },
    });

  const transformed = rewriter.transform(new Response(html));
  const finalText = await transformed.text();
  snap.bodyTextLen = finalText.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().length;

  // cleanup
  delete snap._ld;
  snap.title = snap.title.trim();
  return snap;
}

// ---------- SCORE ----------
function scoreSnapshot(s, path) {
  const findings = [];
  const wins = [];
  const t = s.title;
  const d = s.description;

  // Critical
  if (!t) findings.push({ id: "no_title", severity: "critical", what: "Page has no <title>", fix: "Add a unique 50–60 char title with primary intent at the front." });
  if (!d) findings.push({ id: "no_desc", severity: "critical", what: "No meta description", fix: "Write 150–160 chars promising a specific outcome." });
  if (s.h1Count === 0) findings.push({ id: "no_h1", severity: "critical", what: "No H1 on page", fix: "Add one H1 stating the page's primary topic." });
  if (s.h1Count > 1) findings.push({ id: "multi_h1", severity: "critical", what: `${s.h1Count} H1 tags found`, fix: "Reduce to exactly one H1." });

  // Warnings
  if (t && t.length < 30) findings.push({ id: "title_short", severity: "warning", what: `Title is ${t.length} chars (target 50–60)`, fix: "Expand the title with brand suffix or differentiator." });
  if (t && t.length > 65) findings.push({ id: "title_long", severity: "warning", what: `Title is ${t.length} chars — may truncate`, fix: "Trim to 60 chars while keeping intent at the front." });
  if (d && d.length < 70) findings.push({ id: "desc_short", severity: "warning", what: `Description is ${d.length} chars`, fix: "Expand to 150–160 chars." });
  if (d && d.length > 170) findings.push({ id: "desc_long", severity: "warning", what: `Description is ${d.length} chars — truncates`, fix: "Trim to 160 chars." });
  if (!s.canonical) findings.push({ id: "no_canonical", severity: "warning", what: "No canonical URL", fix: "Add <link rel='canonical' href='ABSOLUTE_URL'>." });
  else if (!/^https?:\/\//i.test(s.canonical)) findings.push({ id: "canonical_relative", severity: "warning", what: "Canonical is relative", fix: "Use the full absolute URL." });
  if (!s.ogTitle) findings.push({ id: "no_og_title", severity: "warning", what: "No og:title", fix: "Add og:title meta for social shares." });
  if (!s.ogImage) findings.push({ id: "no_og_image", severity: "warning", what: "No og:image", fix: "Add a 1200×630 og:image for branded share cards." });
  if (s.imgWithoutAlt > 0) findings.push({ id: "missing_alt", severity: "warning", what: `${s.imgWithoutAlt} of ${s.imgTotal} <img> tags missing alt`, fix: "Add descriptive alt; decorative images use alt=''." });
  if (/noindex/i.test(s.robotsMeta)) findings.push({ id: "noindex", severity: "critical", what: "robots noindex set", fix: "Remove noindex if this page should rank." });

  // Info
  if (!s.lang) findings.push({ id: "no_lang", severity: "info", what: "No <html lang>", fix: "Add lang='en' (or appropriate)." });
  if (!s.viewport) findings.push({ id: "no_viewport", severity: "info", what: "No viewport meta", fix: "Add <meta name='viewport' content='width=device-width,initial-scale=1'>." });
  if (!s.themeColor) findings.push({ id: "no_theme_color", severity: "info", what: "No theme-color meta", fix: "Add <meta name='theme-color' content='#08080a'>." });
  if (!s.twitterCard) findings.push({ id: "no_twitter", severity: "info", what: "No twitter:card", fix: "Add twitter:card meta for X/Twitter." });
  if (!s.jsonLd) findings.push({ id: "no_json_ld", severity: "info", what: "No JSON-LD structured data", fix: "Add JSON-LD (Organization for home, BreadcrumbList for inner pages)." });
  if (!s.favicon) findings.push({ id: "no_favicon", severity: "info", what: "No favicon link", fix: "Add <link rel='icon' href='favicon.svg'>." });

  // Wins
  if (t && t.length >= 30 && t.length <= 65) wins.push("Title length is in the optimal SERP range.");
  if (d && d.length >= 70 && d.length <= 170) wins.push("Meta description in optimal range.");
  if (s.h1Count === 1) wins.push("Exactly one H1 — clean.");
  if (s.canonical && /^https?:\/\//i.test(s.canonical)) wins.push("Canonical URL set absolute.");
  if (s.ogTitle && s.ogDescription && s.ogImage) wins.push("Open Graph trio complete.");
  if (s.jsonLd) wins.push("Structured data present.");
  if (s.imgTotal > 0 && s.imgWithoutAlt === 0) wins.push(`All ${s.imgTotal} images have alt text.`);

  const buckets = {
    critical: findings.filter((f) => f.severity === "critical"),
    warnings: findings.filter((f) => f.severity === "warning"),
    info: findings.filter((f) => f.severity === "info"),
  };

  // Score: 100 - 15/critical - 5/warning - 1/info, floor 0
  let score = 100 - buckets.critical.length * 15 - buckets.warnings.length * 5 - buckets.info.length * 1;
  if (score < 0) score = 0;

  return {
    summary: findings.length === 0
      ? `${path}: clean audit. ${wins.length} pass.`
      : `${path}: ${buckets.critical.length} critical, ${buckets.warnings.length} warning, ${buckets.info.length} info. ${wins.length} pass.`,
    score,
    score_label: score >= 90 ? "excellent" : score >= 75 ? "good" : score >= 50 ? "fair" : "needs work",
    findings,
    wins,
    buckets,
    quick_wins: buckets.warnings.slice(0, 3).concat(buckets.info.slice(0, 2)).map(f => `${f.what} — ${f.fix}`),
    next_steps: findings
      .slice()
      .sort((a, b) => sevWeight(a.severity) - sevWeight(b.severity))
      .slice(0, 5)
      .map((f) => `${f.severity.toUpperCase()} · ${f.what}`),
  };
}

function sevWeight(s) { return s === "critical" ? 0 : s === "warning" ? 1 : 2; }

// ---------- CORS / JSON ----------
function corsHeaders(env) {
  const origin = (env && env.ALLOWED_ORIGIN) || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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
