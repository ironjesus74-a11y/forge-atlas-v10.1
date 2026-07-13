import worker from "../../workers/swarm-ledger-worker.js";
export const onRequest = (context) => worker.fetch(context.request, context.env, context);
