/**
 * Entry point of the worker process (`node dist/entrypoints/worker.js`).
 *
 * The role is set before anything else is imported, because the database pool
 * and the metrics registry read it when their modules load.
 */
process.env.MOTIONMEET_PROCESS_ROLE ??= "worker";
const { runWorker } = await import("../runtime/worker.js");
await runWorker();
