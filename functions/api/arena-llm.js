import worker from "../../workers/arena-llm-worker.js";
export const onRequest = (context) => worker.fetch(context.request, context.env, context);
