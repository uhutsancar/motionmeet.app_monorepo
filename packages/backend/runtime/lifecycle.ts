import { errorDiagnostics, logger } from "../utils/logger.js";

/**
 * SIGTERM/SIGINT handling shared by the worker and the scheduler: run
 * `shutdown` once, give it `graceMs` to drain, then exit regardless. Fatal
 * process errors take the same path with a failing exit code, so the
 * orchestrator restarts the process instead of leaving it half-alive.
 */
export const installShutdownHandlers = (role: string, shutdown: () => Promise<void>, graceMs = 25_000): void => {
  let shuttingDown = false;
  const run = (signal: string, exitCode: number): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("shutdown_started", { role, signal });
    const forceExit = setTimeout(() => {
      logger.error("shutdown_timed_out", { role, graceMs });
      process.exit(1);
    }, graceMs);
    forceExit.unref();
    shutdown().then(
      () => { logger.info("shutdown_completed", { role }); process.exit(exitCode); },
      (error: unknown) => { logger.error("shutdown_failed", { role, ...errorDiagnostics(error) }); process.exit(1); },
    );
  };
  process.once("SIGTERM", () => run("SIGTERM", 0));
  process.once("SIGINT", () => run("SIGINT", 0));
  process.once("uncaughtException", (error) => { logger.error("uncaught_exception", { role, ...errorDiagnostics(error) }); run("uncaughtException", 1); });
  process.once("unhandledRejection", (error) => { logger.error("unhandled_rejection", { role, ...errorDiagnostics(error) }); run("unhandledRejection", 1); });
};
