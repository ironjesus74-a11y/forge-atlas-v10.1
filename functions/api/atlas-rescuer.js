import worker from "../../workers/atlas-rescuer-worker.js";
export const onRequest = (context) => worker.fetch(context.request, context.env, context);
