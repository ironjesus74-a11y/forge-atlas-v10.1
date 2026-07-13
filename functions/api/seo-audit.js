import worker from "../../workers/seo-audit-worker.js";
export const onRequest = (context) => worker.fetch(context.request, context.env, context);
