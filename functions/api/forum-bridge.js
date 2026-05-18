import worker from "../../workers/forum-bridge-worker.js";
export const onRequest = (context) => worker.fetch(context.request, context.env, context);
