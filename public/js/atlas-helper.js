/**
 * FORGE ATLAS · atlas-helper.js (frontend widget)
 *
 * Premium operator-grade helper. Floating panel with mode-driven flows.
 *
 * Behavior:
 *   1. On open, probes /api/ops-status to know what's live.
 *   2. Each mode either calls the matching worker OR falls back to the local
 *      rule engine (mirrors atlas-helper-worker.js logic for offline use).
 *   3. Same UX whether live or fallback. Status banner shows the mode.
 *
 * Drop in:
 *   <link rel="stylesheet" href="public/css/atlas-helper.css">
 *   <script src="public/js/atlas-helper.js" defer></script>
 *
 * Or place at the project root and adjust paths.
 */
(function () {
  "use strict";

  // ---------- Utilities ----------
  const $ = (s, c) => (c || document).querySelector(s);
  const el = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") e.className = attrs[k];
        else if (k === "html") e.innerHTML = attrs[k];
        else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else e.setAttribute(k, attrs[k]);
      }
    }
    for (const k of kids) {
      if (k == null) continue;
      e.appendChild(typeof k === "string" ? document.createTextNode(k) : k);
    }
    return e;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Mount ----------
  const root = el("aside", { class: "fa-helper", "aria-label": "Forge Atlas Helper", role: "complementary" });
  document.body.appendChild(root);

  const orb = el("button", {
    class: "fa-helper-orb",
    type: "button",
    "aria-haspopup": "dialog",
    "aria-expanded": "false",
    "aria-controls": "fa-helper-panel",
    title: "Atlas Helper · diagnostics & SEO",
  });
  orb.innerHTML = `
    <span class="fa-helper-orb-pulse" aria-hidden="true"></span>
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/></svg>
  `;
  root.appendChild(orb);

  const panel = el("div", { class: "fa-helper-panel", id: "fa-helper-panel", role: "dialog", "aria-label": "Atlas Helper panel", "aria-hidden": "true" });
  root.appendChild(panel);

  panel.appendChild(el("div", { class: "fa-helper-head" },
    el("div", { class: "fa-helper-avatar" }, "A"),
    el("div", { class: "fa-helper-titles" },
      el("h4", null, "Atlas Helper"),
      el("div", { class: "fa-helper-sub" },
        el("span", { class: "fa-helper-dot", id: "fa-status-dot" }),
        el("span", { id: "fa-status-text" }, "checking…")
      )
    ),
    el("button", { class: "fa-helper-close", type: "button", "aria-label": "Close helper", onclick: close }, "✕")
  ));

  const tabs = el("div", { class: "fa-helper-tabs", role: "tablist", "aria-label": "Helper modes" });
  const MODES = [
    { id: "seo", label: "SEO Audit", desc: "Audit a page on this site." },
    { id: "metadata", label: "Metadata", desc: "Generate title/description/JSON-LD." },
    { id: "routes", label: "Routes", desc: "Diagnose paths/links/orphans." },
    { id: "deploy", label: "Deploy", desc: "Pre-flight readiness checklist." },
    { id: "site-cleanup", label: "Cleanup", desc: "Risky/dead/duplicate files." },
    { id: "trust-review", label: "Trust", desc: "Scan copy for fake-claim language." },
    { id: "help", label: "Help", desc: "Ask anything; routes to the right tool." },
  ];
  MODES.forEach((m, i) => {
    const t = el("button", {
      class: "fa-helper-tab" + (i === 0 ? " active" : ""),
      type: "button",
      role: "tab",
      "data-mode": m.id,
      "aria-selected": i === 0 ? "true" : "false",
      onclick: () => switchMode(m.id),
    }, m.label);
    tabs.appendChild(t);
  });
  panel.appendChild(tabs);

  const body = el("div", { class: "fa-helper-body", "aria-live": "polite" });
  panel.appendChild(body);

  panel.appendChild(el("div", { class: "fa-helper-foot-note" },
    el("strong", null, "Honest layer."), " Live results when Workers are deployed; expert rules-only fallback when not. ",
    el("a", { href: "docs/cloudflare-integration.md", target: "_blank", rel: "noopener" }, "Setup →")
  ));

  // ---------- State ----------
  const state = {
    open: false,
    mode: "seo",
    workersLive: false,
    statusChecked: false,
    lastResult: null,
  };

  // ---------- Probing ----------
  async function probeStatus() {
    const dot = $("#fa-status-dot");
    const txt = $("#fa-status-text");
    try {
      const r = await fetch("/api/ops-status", { method: "GET" });
      if (r.ok) {
        const data = await r.json();
        state.workersLive = true;
        const mode = data.helper && data.helper.mode === "live-ai-adapter" ? "live · AI" : "live · rules";
        if (txt) txt.textContent = mode;
        if (dot) dot.classList.add("live");
        return data;
      }
    } catch {}
    state.workersLive = false;
    if (txt) txt.textContent = "static fallback";
    if (dot) dot.classList.remove("live");
    return null;
  }

  // ---------- Open / Close ----------
  orb.addEventListener("click", () => (state.open ? close() : open()));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.open) close();
  });

  async function open() {
    state.open = true;
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    orb.setAttribute("aria-expanded", "true");
    if (!state.statusChecked) {
      await probeStatus();
      state.statusChecked = true;
    }
    if (!body.dataset.bootstrapped) {
      body.dataset.bootstrapped = "1";
      switchMode("seo");
    }
  }
  function close() {
    state.open = false;
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    orb.setAttribute("aria-expanded", "false");
  }

  // ---------- Mode router ----------
  function switchMode(mode) {
    state.mode = mode;
    Array.from(tabs.children).forEach((t) => {
      const active = t.getAttribute("data-mode") === mode;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
    body.innerHTML = "";
    switch (mode) {
      case "seo":          renderSEO(); break;
      case "metadata":     renderMetadata(); break;
      case "routes":       renderRoutes(); break;
      case "deploy":       renderDeploy(); break;
      case "site-cleanup": renderCleanup(); break;
      case "trust-review": renderTrust(); break;
      case "help":         renderHelp(); break;
    }
  }

  // ============================================================
  // SEO
  // ============================================================
  function renderSEO() {
    body.appendChild(el("p", { class: "fa-help-lead" }, "Audit a page on this site. Same-origin only."));
    const input = el("input", { type: "text", placeholder: "/index.html", value: location.pathname || "/index.html", class: "fa-input" });
    const btn = el("button", { class: "fa-btn-primary", type: "button", onclick: run }, "Run Audit");
    const out = el("div", { class: "fa-result" });
    body.appendChild(el("div", { class: "fa-row" }, input, btn));
    body.appendChild(out);

    async function run() {
      out.innerHTML = "";
      out.appendChild(spinner("Running audit…"));
      const path = input.value.trim() || "/index.html";

      if (state.workersLive) {
        try {
          const r = await fetch("/api/seo-audit?url=" + encodeURIComponent(path));
          const data = await r.json();
          renderAuditResult(out, data, path, true);
          return;
        } catch {}
      }

      // Fallback: fetch HTML directly (browser can do it for same-origin)
      try {
        const r = await fetch(path);
        const html = await r.text();
        const snap = parseHtmlClient(html);
        const audit = scoreSnapshotClient(snap, path);
        renderAuditResult(out, { ...audit, snapshot: snap, url: path }, path, false);
      } catch (e) {
        out.innerHTML = "";
        out.appendChild(errorBox("Could not fetch " + path + " for analysis."));
      }
    }
  }

  function renderAuditResult(out, data, path, live) {
    out.innerHTML = "";
    out.appendChild(modeBadge(live));

    const score = data.score != null ? data.score : "—";
    out.appendChild(el("div", { class: "fa-score" },
      el("div", { class: "fa-score-num" }, String(score)),
      el("div", { class: "fa-score-meta" },
        el("div", { class: "fa-score-label" }, data.score_label || ""),
        el("div", { class: "fa-score-path mono" }, path)
      )
    ));

    if (data.summary) out.appendChild(el("p", { class: "fa-summary" }, data.summary));

    const findings = data.findings || [];
    if (findings.length) {
      const list = el("ul", { class: "fa-findings" });
      findings.forEach((f) => {
        list.appendChild(el("li", { class: "fa-finding fa-sev-" + (f.severity || "info") },
          el("div", { class: "fa-finding-head" },
            el("span", { class: "fa-sev-tag" }, (f.severity || "info").toUpperCase()),
            el("span", { class: "fa-finding-what" }, f.what)
          ),
          el("div", { class: "fa-finding-fix" }, f.fix)
        ));
      });
      out.appendChild(list);
    } else {
      out.appendChild(el("div", { class: "fa-clean" }, "Clean audit. Nothing to fix."));
    }

    if (data.wins && data.wins.length) {
      out.appendChild(el("h5", { class: "fa-h5" }, `${data.wins.length} pass`));
      const ul = el("ul", { class: "fa-wins" });
      data.wins.forEach((w) => ul.appendChild(el("li", null, w)));
      out.appendChild(ul);
    }
  }

  // ============================================================
  // METADATA
  // ============================================================
  function renderMetadata() {
    body.appendChild(el("p", { class: "fa-help-lead" }, "Generate title, description, and JSON-LD options."));
    const topic = el("input", { type: "text", class: "fa-input", placeholder: "Topic e.g. AI Arena battles" });
    const type = el("select", { class: "fa-input" });
    ["home", "product", "article", "category", "other"].forEach((t) => type.appendChild(el("option", { value: t }, t)));
    const brand = el("input", { type: "text", class: "fa-input", placeholder: "Brand", value: "Forge Atlas" });
    const btn = el("button", { class: "fa-btn-primary", type: "button" }, "Generate");
    const out = el("div", { class: "fa-result" });

    body.appendChild(el("div", { class: "fa-stack" },
      labeled("Topic", topic), labeled("Page type", type), labeled("Brand", brand), btn
    ));
    body.appendChild(out);

    btn.addEventListener("click", async () => {
      out.innerHTML = "";
      out.appendChild(spinner("Generating…"));
      const ctx = { topic: topic.value, pageType: type.value, brand: brand.value };
      const data = await callHelper("metadata", ctx);
      out.innerHTML = "";
      out.appendChild(modeBadge(state.workersLive));
      out.appendChild(el("p", { class: "fa-summary" }, data.summary || ""));
      if (data.title_suggestions) {
        out.appendChild(el("h5", { class: "fa-h5" }, "Title options"));
        const ul = el("ul", { class: "fa-suggest-list" });
        data.title_suggestions.forEach((s) => {
          ul.appendChild(el("li", null,
            el("code", { class: "mono" }, s),
            el("button", { class: "fa-btn-sm", type: "button", onclick: () => copy(s) }, "copy")
          ));
        });
        out.appendChild(ul);
      }
      if (data.description_suggestions) {
        out.appendChild(el("h5", { class: "fa-h5" }, "Description options"));
        const ul = el("ul", { class: "fa-suggest-list" });
        data.description_suggestions.forEach((s) => {
          ul.appendChild(el("li", null,
            el("code", { class: "mono" }, s),
            el("button", { class: "fa-btn-sm", type: "button", onclick: () => copy(s) }, "copy")
          ));
        });
        out.appendChild(ul);
      }
      if (data.json_ld_template) {
        out.appendChild(el("h5", { class: "fa-h5" }, "JSON-LD template"));
        const code = JSON.stringify(data.json_ld_template, null, 2);
        const pre = el("pre", { class: "fa-code mono" }, code);
        out.appendChild(pre);
        out.appendChild(el("button", { class: "fa-btn-sm", type: "button", onclick: () => copy(code) }, "copy JSON-LD"));
      }
    });
  }

  // ============================================================
  // ROUTES
  // ============================================================
  function renderRoutes() {
    body.appendChild(el("p", { class: "fa-help-lead" }, "Paste your file paths (one per line) and optionally internal links found across pages."));
    const paths = el("textarea", { class: "fa-input fa-textarea", placeholder: "/index.html\n/arena.html\n/swarm.html\n…", rows: "6" });
    const links = el("textarea", { class: "fa-input fa-textarea", placeholder: "Optional: hrefs found on pages\n/arena.html\n/atlas-id.html", rows: "4" });
    const btn = el("button", { class: "fa-btn-primary", type: "button" }, "Diagnose");
    const out = el("div", { class: "fa-result" });
    body.appendChild(el("div", { class: "fa-stack" }, labeled("Paths", paths), labeled("Internal links (optional)", links), btn));
    body.appendChild(out);

    btn.addEventListener("click", async () => {
      out.innerHTML = "";
      out.appendChild(spinner("Diagnosing routes…"));
      const ctx = {
        paths: paths.value.split("\n").map((s) => s.trim()).filter(Boolean),
        links: links.value.split("\n").map((s) => s.trim()).filter(Boolean),
      };
      const data = await callHelper("routes", ctx);
      out.innerHTML = "";
      renderResult(out, data);
      if (data.redirects_recommended) {
        out.appendChild(el("h5", { class: "fa-h5" }, "Recommended _redirects"));
        const pre = el("pre", { class: "fa-code mono" }, data.redirects_recommended.join("\n"));
        out.appendChild(pre);
      }
    });
  }

  // ============================================================
  // DEPLOY
  // ============================================================
  function renderDeploy() {
    body.appendChild(el("p", { class: "fa-help-lead" }, "Pre-flight checklist. Toggle what you have, get a verdict."));
    const flags = [
      ["hasFavicon", "favicon.svg/.ico"],
      ["hasRobots", "robots.txt"],
      ["hasSitemap", "sitemap.xml"],
      ["hasHeaders", "_headers"],
      ["hasRedirects", "_redirects"],
      ["has404", "404.html"],
      ["hasOgImage", "opengraph image"],
      ["customDomain", "custom domain"],
      ["paypalConfigured", "payment configured"],
    ];
    const inputs = {};
    const grid = el("div", { class: "fa-checks" });
    flags.forEach(([k, label]) => {
      const cb = el("input", { type: "checkbox", id: "fa-flag-" + k });
      inputs[k] = cb;
      grid.appendChild(el("label", { class: "fa-check-row", for: "fa-flag-" + k }, cb, el("span", null, label)));
    });
    body.appendChild(grid);
    body.appendChild(el("p", { class: "fa-help-note" }, "secrets-clean check is auto-confirmed for static deploys."));
    const btn = el("button", { class: "fa-btn-primary", type: "button" }, "Check Readiness");
    const out = el("div", { class: "fa-result" });
    body.appendChild(btn);
    body.appendChild(out);

    btn.addEventListener("click", async () => {
      out.innerHTML = "";
      out.appendChild(spinner("Checking…"));
      const ctx = { secretsScan: "clean" };
      flags.forEach(([k]) => (ctx[k] = inputs[k].checked));
      const data = await callHelper("deploy", ctx);
      out.innerHTML = "";
      out.appendChild(modeBadge(state.workersLive));
      const verdict = el("div", { class: "fa-verdict " + (data.ready_to_ship ? "ok" : "warn") }, data.summary);
      out.appendChild(verdict);
      if (data.checks) {
        const ul = el("ul", { class: "fa-findings" });
        data.checks.forEach((c) => {
          ul.appendChild(el("li", { class: "fa-finding fa-sev-" + (c.ok ? "ok" : c.severity || "info") },
            el("div", { class: "fa-finding-head" },
              el("span", { class: "fa-sev-tag" }, c.ok ? "PASS" : (c.severity || "info").toUpperCase()),
              el("span", { class: "fa-finding-what" }, c.label)
            )
          ));
        });
        out.appendChild(ul);
      }
    });
  }

  // ============================================================
  // CLEANUP
  // ============================================================
  function renderCleanup() {
    body.appendChild(el("p", { class: "fa-help-lead" }, "Paste your full file list. Flags risky / dead / duplicate / source-build artifacts."));
    const ta = el("textarea", { class: "fa-input fa-textarea", placeholder: "/index.html\n/.env\n/node_modules/foo.js\n/package-lock.json\n/.DS_Store", rows: "8" });
    const btn = el("button", { class: "fa-btn-primary", type: "button" }, "Scan");
    const out = el("div", { class: "fa-result" });
    body.appendChild(el("div", { class: "fa-stack" }, labeled("Files (one per line)", ta), btn));
    body.appendChild(out);
    btn.addEventListener("click", async () => {
      out.innerHTML = "";
      out.appendChild(spinner("Scanning…"));
      const data = await callHelper("site-cleanup", { files: ta.value.split("\n").map((s) => s.trim()).filter(Boolean) });
      out.innerHTML = "";
      renderResult(out, data);
    });
  }

  // ============================================================
  // TRUST REVIEW
  // ============================================================
  function renderTrust() {
    body.appendChild(el("p", { class: "fa-help-lead" }, "Paste page copy. Flags fake-claim / unverifiable / hype language."));
    const ta = el("textarea", { class: "fa-input fa-textarea", placeholder: "Paste body text…", rows: "10" });
    const btn = el("button", { class: "fa-btn-primary", type: "button" }, "Scan");
    const out = el("div", { class: "fa-result" });
    body.appendChild(el("div", { class: "fa-stack" }, labeled("Copy", ta), btn));
    body.appendChild(out);
    btn.addEventListener("click", async () => {
      out.innerHTML = "";
      out.appendChild(spinner("Scanning…"));
      const data = await callHelper("trust-review", { copy: ta.value });
      out.innerHTML = "";
      out.appendChild(modeBadge(state.workersLive));
      out.appendChild(el("p", { class: "fa-summary" }, data.summary || ""));
      if (data.flagged && data.flagged.length) {
        const ul = el("ul", { class: "fa-findings" });
        data.flagged.forEach((f) => {
          ul.appendChild(el("li", { class: "fa-finding fa-sev-warning" },
            el("div", { class: "fa-finding-head" },
              el("span", { class: "fa-sev-tag" }, "REVIEW"),
              el("span", { class: "fa-finding-what mono" }, `"${f.match}"`)
            ),
            el("div", { class: "fa-finding-fix" }, f.why)
          ));
        });
        out.appendChild(ul);
      }
    });
  }

  // ============================================================
  // HELP
  // ============================================================
  function renderHelp() {
    body.appendChild(el("p", { class: "fa-help-lead" }, "Ask anything about the site. The helper routes to the right tool."));
    const input = el("input", { class: "fa-input", type: "text", placeholder: "How do I integrate Claude safely?" });
    const btn = el("button", { class: "fa-btn-primary", type: "button" }, "Ask");
    const out = el("div", { class: "fa-result" });
    body.appendChild(el("div", { class: "fa-row" }, input, btn));
    body.appendChild(out);
    btn.addEventListener("click", run);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });

    async function run() {
      const q = input.value.trim();
      if (!q) return;
      out.innerHTML = "";
      out.appendChild(spinner("Routing…"));
      const data = await callHelper("help", {}, q);
      out.innerHTML = "";
      out.appendChild(modeBadge(state.workersLive));
      out.appendChild(el("p", { class: "fa-summary" }, data.summary || ""));
    }
  }

  // ============================================================
  // CALL HELPER · routing chain
  //   1. Try Cloudflare Workers AI via /api/cf-ai (premium answers)
  //   2. Try /api/atlas-helper worker (rule-based)
  //   3. Fall back to local rule mirror (always available)
  //
  // No keys live in the frontend. The Worker holds them.
  // ============================================================
  async function callHelper(mode, context, message) {
    // 1. Cloudflare Workers AI — only for free-form 'help' mode where genuine AI shines
    if (state.workersLive && mode === "help" && message && message.length > 4) {
      try {
        const r = await fetch("/api/cf-ai", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "atlas-helper",
            message: message,
            context: { page: location.pathname, ...(context || {}) },
            system: "You are Atlas, the in-site helper for Forge Atlas. Brief, direct, useful. 2-4 specific moves max. No filler. Sign with — Atlas.",
          }),
        });
        if (r.ok) {
          const data = await r.json();
          if (data && (data.reply || data.summary)) {
            return { summary: data.reply || data.summary, source: "cf-ai" };
          }
        }
      } catch {}
    }

    // 2. Atlas Helper worker (rule-based, all modes)
    if (state.workersLive) {
      try {
        const r = await fetch("/api/atlas-helper", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode, context: context || {}, message: message || "" }),
        });
        if (r.ok) return await r.json();
      } catch {}
    }

    // 3. Local rule mirror — always available
    return await sleep(180).then(() => fallbackEngine(mode, context || {}, message || ""));
  }

  // ============================================================
  // CLIENT-SIDE FALLBACK ENGINE (mirrors worker rules)
  // ============================================================
  function fallbackEngine(mode, ctx, message) {
    switch (mode) {
      case "metadata":     return metadataFallback(ctx);
      case "routes":       return routesFallback(ctx);
      case "deploy":       return deployFallback(ctx);
      case "site-cleanup": return cleanupFallback(ctx);
      case "trust-review": return trustFallback(ctx);
      case "help":         return helpFallback(message);
      case "seo":          return { summary: "SEO mode requires the Worker, or use the SEO Audit tab to fetch the page directly." };
    }
    return { summary: "Unknown mode." };
  }

  function parseHtmlClient(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const m = (sel) => (doc.querySelector(sel) || {});
    const meta = (n) => (doc.querySelector(`meta[name="${n}"]`) || {}).content || "";
    const og = (p) => (doc.querySelector(`meta[property="${p}"]`) || {}).content || "";
    const imgs = doc.querySelectorAll("img");
    let imgWithoutAlt = 0;
    imgs.forEach((i) => { if (i.getAttribute("alt") === null) imgWithoutAlt++; });
    return {
      title: (m("title").textContent || "").trim(),
      description: meta("description"),
      canonical: (m('link[rel="canonical"]').getAttribute && m('link[rel="canonical"]').getAttribute("href")) || "",
      lang: doc.documentElement.getAttribute("lang") || "",
      h1Count: doc.querySelectorAll("h1").length,
      h2Count: doc.querySelectorAll("h2").length,
      ogTitle: og("og:title"),
      ogDescription: og("og:description"),
      ogImage: og("og:image"),
      twitterCard: meta("twitter:card"),
      robotsMeta: meta("robots"),
      viewport: meta("viewport"),
      themeColor: meta("theme-color"),
      jsonLd: !!doc.querySelector('script[type="application/ld+json"]'),
      imgTotal: imgs.length,
      imgWithoutAlt,
      favicon: !!doc.querySelector('link[rel="icon"], link[rel="shortcut icon"]'),
    };
  }

  function scoreSnapshotClient(s, path) {
    const findings = [];
    const wins = [];
    const t = s.title;
    const d = s.description;
    if (!t) findings.push({ id: "no_title", severity: "critical", what: "No <title>", fix: "Add a unique 50–60 char title." });
    else if (t.length < 30) findings.push({ id: "title_short", severity: "warning", what: `Title is ${t.length} chars`, fix: "Aim for 50–60." });
    else if (t.length > 65) findings.push({ id: "title_long", severity: "warning", what: `Title is ${t.length} chars`, fix: "Trim to 60." });
    else wins.push("Title length optimal.");
    if (!d) findings.push({ id: "no_desc", severity: "critical", what: "No meta description", fix: "Write 150–160 chars." });
    else if (d.length < 70) findings.push({ id: "desc_short", severity: "warning", what: `Description is ${d.length} chars`, fix: "Expand to 150–160." });
    else if (d.length > 170) findings.push({ id: "desc_long", severity: "warning", what: `Description is ${d.length} chars`, fix: "Trim to 160." });
    else wins.push("Description length optimal.");
    if (!s.canonical) findings.push({ id: "no_canonical", severity: "warning", what: "No canonical URL", fix: "Add link rel=canonical." });
    if (s.h1Count === 0) findings.push({ id: "no_h1", severity: "critical", what: "No H1", fix: "Add one H1." });
    if (s.h1Count > 1) findings.push({ id: "multi_h1", severity: "warning", what: `${s.h1Count} H1s`, fix: "Reduce to one." });
    if (s.h1Count === 1) wins.push("Exactly one H1.");
    if (!s.ogTitle) findings.push({ id: "no_og", severity: "warning", what: "No og:title", fix: "Add og:title." });
    if (!s.ogImage) findings.push({ id: "no_og_image", severity: "warning", what: "No og:image", fix: "Add 1200×630 og:image." });
    if (s.imgWithoutAlt > 0) findings.push({ id: "no_alt", severity: "warning", what: `${s.imgWithoutAlt}/${s.imgTotal} imgs without alt`, fix: "Add alt text." });
    if (!s.jsonLd) findings.push({ id: "no_jsonld", severity: "info", what: "No JSON-LD", fix: "Add structured data." });
    const crit = findings.filter((f) => f.severity === "critical").length;
    const warn = findings.filter((f) => f.severity === "warning").length;
    const inf = findings.filter((f) => f.severity === "info").length;
    let score = 100 - crit * 15 - warn * 5 - inf * 1;
    if (score < 0) score = 0;
    return {
      summary: findings.length ? `${path}: ${crit} critical · ${warn} warning · ${inf} info.` : `${path}: clean.`,
      score, score_label: score >= 90 ? "excellent" : score >= 75 ? "good" : score >= 50 ? "fair" : "needs work",
      findings, wins,
    };
  }

  function metadataFallback(ctx) {
    const topic = (ctx.topic || "").trim();
    const brand = (ctx.brand || "Forge Atlas").trim();
    const type = ctx.pageType || "other";
    if (!topic) return { summary: "Provide a topic." };
    const titles = type === "home"
      ? [`${brand} — Built Different. ${topic}.`, `${topic} · ${brand}`, `${brand}: The Operator Layer for ${topic}`]
      : [`${topic} — ${brand}`, `${topic} · ${brand}`, `Inside ${topic} · ${brand}`];
    const descs = [
      `${topic}. ${brand}: static-first prototype, backend-ready, never backend-fake.`,
      `${topic} for the AI era. Built Different.`,
    ];
    return {
      summary: `Generated ${titles.length} titles and ${descs.length} descriptions for "${topic}".`,
      title_suggestions: titles.map((s) => (s.length > 60 ? s.slice(0, 57) + "…" : s)),
      description_suggestions: descs.map((s) => (s.length > 160 ? s.slice(0, 157) + "…" : s)),
      json_ld_template: type === "home"
        ? { "@context": "https://schema.org", "@type": "Organization", name: brand, description: topic }
        : { "@context": "https://schema.org", "@type": "WebPage", name: topic, isPartOf: { "@type": "WebSite", name: brand } },
    };
  }
  function routesFallback(ctx) {
    const paths = ctx.paths || [];
    const links = ctx.links || [];
    const findings = [];
    const seen = {};
    paths.forEach((p) => {
      const k = p.toLowerCase().replace(/\/$/, "");
      seen[k] = (seen[k] || 0) + 1;
    });
    Object.keys(seen).forEach((k) => { if (seen[k] > 1) findings.push({ severity: "warning", what: `Duplicate: ${k}`, fix: "Remove duplicate." }); });
    const risky = [".env", ".pem", ".key", "id_rsa"];
    paths.forEach((p) => risky.forEach((r) => { if (p.toLowerCase().includes(r)) findings.push({ severity: "critical", what: `Risky file: ${p}`, fix: "Delete before deploy." }); }));
    if (links.length) {
      const linkSet = new Set(links.map((l) => l.toLowerCase().replace(/^\//, "")));
      paths.forEach((p) => {
        if (!p.endsWith(".html") || p.endsWith("index.html")) return;
        const norm = p.toLowerCase().replace(/^\//, "");
        if (!linkSet.has(norm) && !linkSet.has(norm.replace(/\.html$/, "")))
          findings.push({ severity: "info", what: `Orphan: ${p}`, fix: "Link from another page or remove." });
      });
    }
    return { summary: `Route audit: ${findings.length} finding(s).`, findings };
  }
  function deployFallback(ctx) {
    const checks = [
      { id: "favicon", label: "favicon", ok: !!ctx.hasFavicon, severity: "warning" },
      { id: "robots", label: "robots.txt", ok: !!ctx.hasRobots, severity: "warning" },
      { id: "sitemap", label: "sitemap.xml", ok: !!ctx.hasSitemap, severity: "warning" },
      { id: "headers", label: "_headers", ok: !!ctx.hasHeaders, severity: "warning" },
      { id: "redirects", label: "_redirects", ok: !!ctx.hasRedirects, severity: "info" },
      { id: "404", label: "404.html", ok: !!ctx.has404, severity: "info" },
      { id: "og", label: "og:image", ok: !!ctx.hasOgImage, severity: "warning" },
      { id: "domain", label: "custom domain", ok: !!ctx.customDomain, severity: "info" },
      { id: "secrets", label: "no client-side secrets", ok: ctx.secretsScan === "clean", severity: "critical" },
      { id: "payment", label: "payment configured", ok: !!ctx.paypalConfigured, severity: "info" },
    ];
    const blockers = checks.filter((c) => !c.ok && c.severity === "critical");
    const failed = checks.filter((c) => !c.ok);
    return {
      summary: blockers.length ? `BLOCKED: ${blockers.length} critical.` : failed.length ? `Ready with ${failed.length} non-blocking gap(s).` : "Green light.",
      ready_to_ship: blockers.length === 0,
      checks,
    };
  }
  function cleanupFallback(ctx) {
    const files = ctx.files || [];
    const findings = [];
    const RISKY = [".env", ".pem", ".key", "id_rsa", ".sqlite", "credentials"];
    const DEAD = [".DS_Store", "Thumbs.db", ".swp", ".bak"];
    const NODE = ["node_modules/", "package-lock.json", "yarn.lock"];
    files.forEach((f) => {
      const l = f.toLowerCase();
      RISKY.forEach((n) => { if (l.includes(n)) findings.push({ severity: "critical", what: `Risky: ${f}`, fix: "Delete." }); });
      DEAD.forEach((n) => { if (l.endsWith(n)) findings.push({ severity: "info", what: `Junk: ${f}`, fix: "Delete." }); });
      NODE.forEach((n) => { if (l.includes(n)) findings.push({ severity: "warning", what: `Build artifact: ${f}`, fix: "Static deploys don't need this." }); });
    });
    return { summary: `Scanned ${files.length} files; ${findings.length} finding(s).`, findings };
  }
  function trustFallback(ctx) {
    const text = String(ctx.copy || "");
    const flagged = [];
    const PATTERNS = [
      [/\b(real-time|live)\s+ai\b/gi, "Confirm a real Worker is wired or label as static demo."],
      [/\binstantly\s+deliver(ed|s|y)?\b/gi, "Implies automatic fulfillment. If manual, say so."],
      [/\b(zero|no)\s+(human|manual)\s+intervention\b/gi, "Confirm automation actually exists."],
      [/\bguaranteed\b/gi, "Guarantee language has legal weight."],
      [/\b(100%|completely)\s+(secure|safe|private)\b/gi, "Soften — no system is 100% secure."],
      [/\bmilitary[-\s]?grade\b/gi, "Marketing cliché. Replace with specifics."],
      [/\benterprise[-\s]?grade\b/gi, "Vague tier claim. State the differentiator."],
    ];
    PATTERNS.forEach(([rx, why]) => { let m; while ((m = rx.exec(text)) !== null) flagged.push({ match: m[0], why }); });
    return { summary: flagged.length ? `Flagged ${flagged.length} claim(s).` : "Clean.", flagged };
  }
  function helpFallback(msg) {
    const t = msg.toLowerCase();
    if (t.includes("seo")) return { summary: "Switch to the SEO Audit tab and run on a page path." };
    if (t.includes("deploy") || t.includes("cloudflare")) return { summary: "Use the Deploy tab. Check off what you have, get a verdict." };
    if (t.includes("claude") || t.includes("anthropic") || t.includes("api key")) return { summary: "Never put an Anthropic key in frontend. Deploy a Worker with the key as a secret. The atlas-helper-worker calls it via env.LIVE_AI_URL." };
    if (t.includes("github")) return { summary: "GitHub write actions are designed-but-disabled. Need a GitHub App or fine-grained PAT bound to a Worker secret." };
    return { summary: "I'm a rules helper. Ask about SEO, deploy, routes, metadata, cleanup, or trust." };
  }

  // ============================================================
  // RENDERERS
  // ============================================================
  function renderResult(out, data) {
    out.appendChild(modeBadge(state.workersLive));
    if (data.summary) out.appendChild(el("p", { class: "fa-summary" }, data.summary));
    const findings = data.findings || [];
    if (findings.length) {
      const list = el("ul", { class: "fa-findings" });
      findings.forEach((f) => {
        list.appendChild(el("li", { class: "fa-finding fa-sev-" + (f.severity || "info") },
          el("div", { class: "fa-finding-head" },
            el("span", { class: "fa-sev-tag" }, (f.severity || "info").toUpperCase()),
            el("span", { class: "fa-finding-what" }, f.what)
          ),
          f.fix ? el("div", { class: "fa-finding-fix" }, f.fix) : null
        ));
      });
      out.appendChild(list);
    } else {
      out.appendChild(el("div", { class: "fa-clean" }, "Clean."));
    }
  }
  function modeBadge(live) {
    return el("div", { class: "fa-mode-badge " + (live ? "live" : "fallback") },
      el("span", { class: "fa-helper-dot" + (live ? " live" : "") }),
      live ? "Live worker" : "Static fallback"
    );
  }
  function spinner(label) {
    const w = el("div", { class: "fa-spinner" },
      el("span", { class: "fa-spin-dot" }),
      el("span", { class: "fa-spin-dot" }),
      el("span", { class: "fa-spin-dot" }),
      el("span", { class: "fa-spin-label" }, label || "Working…")
    );
    return w;
  }
  function errorBox(msg) {
    return el("div", { class: "fa-error" }, msg);
  }
  function labeled(label, input) {
    return el("label", { class: "fa-labeled" }, el("span", { class: "fa-labeled-text" }, label), input);
  }
  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  }
})();
