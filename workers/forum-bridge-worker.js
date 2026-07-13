/**
 * FORGE ATLAS · forum-bridge-worker
 * POST /api/forum-bridge
 *
 * Bridges the static forum frontend to GitHub Issues as backend.
 * Every thread = a GitHub Issue. Every reply = an Issue comment.
 * GitHub handles storage, auth, audit log, moderation, free forever.
 *
 * REQUIRES (set via wrangler secret put):
 *   GITHUB_TOKEN          · fine-grained PAT with Issues read+write on the repo
 *   GITHUB_REPO           · e.g. "Forge-Atlas-Founder/Forge-Atlas-Forum"
 *
 * Body shape:
 *   { op: "list" | "read" | "create" | "reply" | "react",
 *     forum: "ai" | "town",
 *     threadId?, title?, body?, category?, reaction?, author? }
 *
 * Returns:
 *   { ok: true, ... } | { ok: false, error: "..." }
 *
 * Threads are tagged with labels: forum:ai | forum:town | cat:<category>
 * The author callsign is stored in the issue body in a fenced metadata block.
 */

const VERSION = "1.0.0";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(env);
    if (request.method !== "POST") return j({ ok: false, error: "method_not_allowed" }, 405, env);

    const origin = request.headers.get("origin") || "";
    if (env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== "*" && origin !== env.ALLOWED_ORIGIN) {
      return j({ ok: false, error: "forbidden" }, 403, env);
    }
    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
      return j({ ok: false, error: "not_configured", hint: "set GITHUB_TOKEN and GITHUB_REPO secrets" }, 503, env);
    }

    let body;
    try { body = await request.json(); }
    catch { return j({ ok: false, error: "invalid_json" }, 400, env); }

    const op = String(body.op || "");
    try {
      switch (op) {
        case "list":   return j(await listThreads(env, body), 200, env);
        case "read":   return j(await readThread(env, body), 200, env);
        case "create": return j(await createThread(env, body), 200, env);
        case "reply":  return j(await replyToThread(env, body), 200, env);
        case "react":  return j(await reactToThread(env, body), 200, env);
        default:       return j({ ok: false, error: "unknown_op" }, 400, env);
      }
    } catch (err) {
      return j({ ok: false, error: "exception", detail: String(err.message || err) }, 500, env);
    }
  },
};

async function gh(env, path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "forge-atlas-forum-bridge/1.0",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${data && data.message ? data.message : text}`);
  return data;
}

function authorTag(author) {
  return `\n\n<!--forge-meta\n` + JSON.stringify(author || {}) + `\n-->`;
}
function parseAuthor(body) {
  const m = (body || "").match(/<!--forge-meta\n([\s\S]+?)\n-->/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}
function stripMeta(body) {
  return (body || "").replace(/<!--forge-meta\n[\s\S]+?\n-->/, "").trim();
}

async function listThreads(env, body) {
  const forum = body.forum === "town" ? "town" : "ai";
  const label = `forum:${forum}`;
  const params = new URLSearchParams({
    labels: label,
    state: "open",
    per_page: "30",
    sort: "updated",
    direction: "desc",
  });
  if (body.category) params.set("labels", `${label},cat:${body.category}`);
  const issues = await gh(env, `/repos/${env.GITHUB_REPO}/issues?${params.toString()}`);
  const threads = issues
    .filter((i) => !i.pull_request)
    .map(issueToThread);
  return { ok: true, threads };
}

async function readThread(env, body) {
  const num = parseInt(body.threadId, 10);
  if (!num) return { ok: false, error: "missing_threadId" };
  const [issue, comments] = await Promise.all([
    gh(env, `/repos/${env.GITHUB_REPO}/issues/${num}`),
    gh(env, `/repos/${env.GITHUB_REPO}/issues/${num}/comments?per_page=100`),
  ]);
  const thread = issueToThread(issue);
  thread.replies = comments.map(commentToReply);
  return { ok: true, thread };
}

async function createThread(env, body) {
  const forum = body.forum === "town" ? "town" : "ai";
  const labels = [`forum:${forum}`];
  if (body.category) labels.push(`cat:${body.category}`);

  const issue = await gh(env, `/repos/${env.GITHUB_REPO}/issues`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: String(body.title || "untitled").slice(0, 200),
      body: String(body.body || "").slice(0, 4000) + authorTag(body.author),
      labels,
    }),
  });
  return { ok: true, thread: issueToThread(issue) };
}

async function replyToThread(env, body) {
  const num = parseInt(body.threadId, 10);
  if (!num) return { ok: false, error: "missing_threadId" };
  const comment = await gh(env, `/repos/${env.GITHUB_REPO}/issues/${num}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      body: String(body.body || "").slice(0, 4000) + authorTag(body.author),
    }),
  });
  return { ok: true, reply: commentToReply(comment) };
}

async function reactToThread(env, body) {
  const num = parseInt(body.threadId, 10);
  const kindMap = { up: "+1", fire: "rocket", eyes: "eyes" };
  const content = kindMap[body.reaction] || "+1";
  await gh(env, `/repos/${env.GITHUB_REPO}/issues/${num}/reactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return { ok: true };
}

function issueToThread(i) {
  const author = parseAuthor(i.body) || { callsign: i.user?.login || "Anon", rank: "initiate" };
  const cleanBody = stripMeta(i.body);
  const cat = (i.labels || []).find((l) => l.name && l.name.startsWith("cat:"));
  const reactions = i.reactions || {};
  return {
    id: String(i.number),
    title: i.title,
    body: cleanBody,
    author,
    category: cat ? cat.name.slice(4) : "general",
    created: new Date(i.created_at).getTime(),
    updated: new Date(i.updated_at).getTime(),
    reactions: {
      up: reactions["+1"] || 0,
      fire: reactions.rocket || 0,
      eyes: reactions.eyes || 0,
    },
    replyCount: i.comments,
    state: i.state,
  };
}

function commentToReply(c) {
  const author = parseAuthor(c.body) || { callsign: c.user?.login || "Anon", rank: "initiate" };
  return {
    id: String(c.id),
    author,
    body: stripMeta(c.body),
    created: new Date(c.created_at).getTime(),
  };
}

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
