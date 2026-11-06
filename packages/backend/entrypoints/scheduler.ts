/**
 * Entry point of the scheduler process (`node dist/entrypoints/scheduler.js`).
 *
 * The role is set before anything else is imported, because the database pool
 * and the metrics registry read it when their modules load.
 */
process.env.MOTIONMEET_PROCESS_ROLE ??= "scheduler";
const { runScheduler } = await import("../runtime/scheduler.js");
await runScheduler();
