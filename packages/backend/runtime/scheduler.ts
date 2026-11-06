import "dotenv/config";
import { checkDatabaseHealth, connectDatabase, disconnectDatabase } from "../configs/database.js";
import { loadEnvironment } from "../configs/environment.js";
import { startOpsServer } from "../observability/opsServer.js";
import { logger } from "../utils/logger.js";
import { initCronJobs } from "../workers/cronJobs.js";
import { installShutdownHandlers } from "./lifecycle.js";

/**
 * The scheduler process: the recurring housekeeping in workers/cronJobs.ts,
 * moved out of the API so an HTTP replica restart never cuts a sweep short and
 * a long sweep never shares an event loop with requests. Running two
 * schedulers is safe - each task takes a PostgreSQL advisory lock - so a
 * rolling deploy may overlap old and new.
 */
export const runScheduler = async (): Promise<void> => {
  const environment = loadEnvironment();
  await connectDatabase();
  const cron = initCronJobs();
  const opsServer = environment.metricsPort
    ? startOpsServer(environment.metricsPort, async () => {
      const database = await checkDatabaseHealth();
      return { ready: database, database };
    })
    : null;
  installShutdownHandlers("scheduler", async () => {
    await cron.stop();
    await new Promise<void>((resolve) => (opsServer ? opsServer.close(() => resolve()) : resolve()));
    await disconnectDatabase();
  });
  logger.info("scheduler_started");
};
