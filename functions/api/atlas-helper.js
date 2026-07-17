// Cloudflare Pages Function wrapper — same code as workers/atlas-helper-worker.js
// Deploys automatically when this folder is in your Pages project.
// Pages Functions receive { request, env, ctx, params } as a context object.
import worker from "../../workers/atlas-helper-worker.js";
export const onRequest = (context) => worker.fetch(context.request, context.env, context);
