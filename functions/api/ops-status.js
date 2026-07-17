import worker from "../../workers/ops-status-worker.js";
export const onRequest = (context) => worker.fetch(context.request, context.env, context);
