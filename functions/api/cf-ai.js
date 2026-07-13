import worker from "../../workers/cf-ai-worker.js";
export const onRequest = (context) => worker.fetch(context.request, context.env, context);
