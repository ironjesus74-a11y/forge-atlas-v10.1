import worker from "../../workers/seo-copilot-worker.js";
export const onRequest = (context) => worker.fetch(context.request, context.env, context);
