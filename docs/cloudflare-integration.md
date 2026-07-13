# Cloudflare Integration · Forge Atlas

Two deployment paths, same code. Pick one based on how you want to operate.

---

## TL;DR

| You want… | Use this path |
|-----------|---------------|
| Easiest setup, one deploy step | **Pages Functions** (`functions/api/*.js`) |
| Independent Worker scaling/rotation | **Standalone Workers** (`workers/*.js` + `wrangler.toml`) |

Either way the frontend widget at `public/js/atlas-helper.js` Just Works™ — it probes `/api/ops-status`, uses live workers when available, falls back to local rules when not.

---

## Path A — Cloudflare Pages Functions (recommended)

Pages Functions live alongside your static site and auto-deploy with it. Zero separate Worker setup.

### Steps

1. **Confirm folder structure** — at the root of your Pages project:
    ```
    forge-atlas/
    ├── index.html
    ├── ...other static pages...
    ├── functions/
    │   └── api/
    │       ├── atlas-helper.js
    │       ├── seo-audit.js
    │       └── ops-status.js
    ├── workers/                ← can stay (imports source from here)
    │   ├── atlas-helper-worker.js
    │   ├── seo-audit-worker.js
    │   └── ops-status-worker.js
    └── public/
        ├── js/atlas-helper.js
        └── css/atlas-helper.css
    ```

2. **Push to your Pages-connected git repo, OR upload via Pages dashboard.**
   Cloudflare detects `functions/` and mounts them as routes:
    - `POST /api/atlas-helper`
    - `GET  /api/seo-audit?url=/path`
    - `GET  /api/ops-status`

3. **Set environment variables** in Pages dashboard:
    - **Project → Settings → Environment variables**
    - Add for **Production**:
        - `ALLOWED_ORIGIN` → your custom domain or `*.pages.dev` URL
        - `SITE_MODE` → `static`
        - `LIVE_AI_URL` → *(leave empty unless you've deployed the AI adapter Worker)*

4. **Add the helper widget to any page** by adding two lines before `</body>`:
    ```html
    <link rel="stylesheet" href="/public/css/atlas-helper.css">
    <script src="/public/js/atlas-helper.js" defer></script>
    ```

5. **Verify** — visit `https://your-domain.com/api/ops-status` in a browser. You should see JSON with `workers.atlas_helper.available: true`.

### Path A done.

---

## Path B — Standalone Workers

Use this when you want each Worker on its own scaling envelope, separate logs, separate secret rotation, or you're not using Pages.

### Prereqs

```bash
npm install -g wrangler
wrangler login
```

### Deploy each Worker

```bash
# atlas-helper-worker
wrangler deploy --env helper

# seo-audit-worker
wrangler deploy --env audit

# ops-status-worker
wrangler deploy --env ops
```

The `wrangler.toml` at the repo root has all three env blocks pre-configured. Edit `ALLOWED_ORIGIN` per environment to lock CORS.

### Bind workers to your domain routes

In Cloudflare dashboard → **Workers & Pages → your worker → Triggers → Routes**, add:

```
forge-atlas.com/api/atlas-helper*   → atlas-helper-worker
forge-atlas.com/api/seo-audit*      → seo-audit-worker
forge-atlas.com/api/ops-status      → ops-status-worker
```

Or uncomment the `[[env.X.routes]]` blocks in `wrangler.toml` and re-deploy.

### Set secrets

```bash
# Optional adapter URL for AI-augmented help (NOT a real Anthropic key — see below)
wrangler secret put LIVE_AI_URL --env helper

# Future write-action enabling
wrangler secret put GITHUB_APP_ID --env helper
wrangler secret put CF_API_TOKEN --env helper
```

---

## SAFE Anthropic / Claude integration (the only correct way)

**NEVER put `sk-ant-*` in any frontend file or in `atlas-helper-worker.js` directly.**

The pattern:

```
[Browser]
    ↓  POST /api/atlas-helper { mode: "help", message: "..." }
[atlas-helper-worker]   ← rules-driven; no key needed
    ↓  if env.LIVE_AI_URL is set, POST { message } to:
[forge-ai-adapter Worker]   ← THIS Worker holds ANTHROPIC_API_KEY as a secret
    ↓
api.anthropic.com/v1/messages
```

### Adapter Worker template (`workers/ai-adapter-worker.js`)

```javascript
const ALLOWED_CALLER = "https://atlas-helper-worker.YOUR-SUBDOMAIN.workers.dev";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("nope", { status: 405 });

    // Lock the caller — only your other Workers can hit this
    const origin = request.headers.get("origin") || "";
    const referer = request.headers.get("referer") || "";
    if (!origin.startsWith(ALLOWED_CALLER) && !referer.startsWith(ALLOWED_CALLER)) {
      return new Response("forbidden", { status: 403 });
    }

    const { message } = await request.json();
    if (!message || message.length > 2000) return new Response("bad input", { status: 400 });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        system: "You are Atlas AI for Forge Atlas. Be sharp, useful, honest about what is static vs roadmap.",
        messages: [{ role: "user", content: message }],
      }),
    });

    const data = await r.json();
    const reply = data?.content?.[0]?.text || "Atlas hit a snag.";
    return new Response(JSON.stringify({ reply }), {
      headers: { "content-type": "application/json" }
    });
  },
};
```

Deploy:
```bash
wrangler deploy --env ai-adapter      # add a [env.ai-adapter] block to wrangler.toml first
wrangler secret put ANTHROPIC_API_KEY --env ai-adapter
```

Then point the helper at it:
```bash
wrangler secret put LIVE_AI_URL --env helper
# value: https://forge-ai-adapter.YOUR-SUBDOMAIN.workers.dev
```

### Hardening

- [ ] **Origin allow-list** on adapter Worker (only your other Worker hosts can call it)
- [ ] **Rate limit** per IP — Cloudflare KV or Durable Object counter
- [ ] **Input length cap** (2000 chars in template above)
- [ ] **Per-day budget cap** — track spend, kill switch over threshold
- [ ] **Logpush** for abuse detection
- [ ] **Never echo the API key** in error messages
- [ ] **Rotate the key quarterly** via `wrangler secret put`

---

## Endpoint reference

### POST `/api/atlas-helper`

```json
{
  "mode": "seo | routes | metadata | deploy | site-cleanup | trust-review | help",
  "context": { /* mode-specific */ },
  "message": "(optional) freeform query for help mode"
}
```

Mode-specific contexts:

| Mode | context shape |
|------|---------------|
| `seo` | `{ title, description, canonical, h1Count, ogTitle, ogDescription, ogImage, twitterCard, jsonLd, robotsMeta, imgWithoutAlt, lang }` |
| `routes` | `{ paths: ["/file.html"], links?: ["/href"] }` |
| `metadata` | `{ pageType: "home\|product\|article\|category\|other", topic, brand?, currentTitle?, currentDescription? }` |
| `deploy` | `{ hasFavicon, hasRobots, hasSitemap, hasHeaders, hasRedirects, has404, hasOgImage, customDomain, secretsScan, paypalConfigured }` |
| `site-cleanup` | `{ files: ["/path"] }` |
| `trust-review` | `{ copy: "page text" }` |
| `help` | `{}` + `message` |

Returns:
```json
{
  "mode": "seo",
  "version": "1.0.0",
  "live_ai": false,
  "summary": "...",
  "score": 87,
  "score_label": "good",
  "findings": [{ "id", "severity", "what", "fix" }],
  "wins": ["..."],
  "buckets": { "critical": [], "warnings": [], "info": [] },
  "next_steps": ["..."]
}
```

### GET `/api/seo-audit?url=/path`

Same-origin only. `url` must start with `/`. Returns full audit + raw snapshot.

### GET `/api/ops-status`

No params. Returns site/helper/integrations/workers/readiness snapshot.

---

## Phase E — Future write-actions roadmap

Designed-but-disabled. Each requires its own secured auth layer.

### GitHub PR creator

**Goal**: Operator triggers content/route changes via the helper UI; Worker opens a PR against the site repo.

**Auth**: GitHub App with fine-grained permissions (contents:write, pull-requests:write). App installation token rotated per request.

**Worker** (`workers/gh-pr-worker.js` — to be written):
1. Validate caller origin
2. Validate operator session (Atlas ID JWT once auth ships)
3. Generate JWT for GitHub App
4. Exchange for installation token
5. Create branch → commit changes → open PR
6. Return PR URL

**Risks**: token leakage, over-broad scopes, abuse if origin check is weak. Do not enable without rate-limiting and operator-tier gating.

### Cloudflare Pages deploy trigger

**Goal**: After PR merge, programmatically trigger a Pages deployment.

**Auth**: Cloudflare API Token, scoped only to Pages:Edit on the specific project.

**Worker**:
1. Validate caller (signed webhook from GitHub or operator session)
2. POST `https://api.cloudflare.com/client/v4/accounts/{id}/pages/projects/{project}/deployments`
3. Return deployment ID

**Note**: Pages auto-deploys on git push when connected to a repo. This Worker is only useful for manual/programmatic re-deploys.

### Content publish workflow

**Goal**: Operator writes a forum/feed post → backend persists → renders on next deploy or via dynamic Pages Function.

**Dependencies**: real auth, KV or D1 storage, content moderation flow.

### Route update workflow

**Goal**: Helper UI edits `_redirects` and `_headers` and PRs the change.

**Dependencies**: GitHub PR creator above; operator-tier gating.

---

## Verification

After deploying, run these from a browser console on your live site:

```javascript
// Should return JSON with all workers available: true
fetch("/api/ops-status").then(r => r.json()).then(console.log);

// Audit your home page
fetch("/api/seo-audit?url=/index.html").then(r => r.json()).then(console.log);

// Trigger a deploy-readiness check
fetch("/api/atlas-helper", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ mode: "deploy", context: {
    hasFavicon: true, hasRobots: true, hasSitemap: true, hasHeaders: true,
    hasRedirects: true, hasOgImage: true, secretsScan: "clean"
  }})
}).then(r => r.json()).then(console.log);
```

Status dot in the helper widget will go green when `/api/ops-status` returns 200.

---

## Honest claims policy

The integration claims **only**:

- The Workers run when deployed
- The rules engine is real and produces real findings
- The frontend gracefully falls back when Workers are unreachable
- Secrets stay on the server side

The integration does **not** claim:

- Live AI is connected (only true if you set `LIVE_AI_URL` and deploy the adapter)
- Programmatic deploys work (true only after Phase E auth is added)
- GitHub writes are functional (designed-but-disabled)

Trust compounds. Honesty today buys credibility tomorrow.
