import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";
import { Pool } from "pg";
import { loadEnvironment } from "./environment.js";
import type { Database } from "../db/types.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";

const environment = loadEnvironment();
const pool = new Pool({
  connectionString: environment.databaseUrl,
  min: environment.databasePoolMin,
  max: environment.databasePoolMax,
  connectionTimeoutMillis: environment.databaseConnectionTimeoutMs,
  idleTimeoutMillis: environment.databaseIdleTimeoutMs,
  allowExitOnIdle: environment.nodeEnv !== "production",
  application_name: "motionmeet-api",
  // A query with no ceiling holds its pool slot for as long as it runs, so a
  // single pathological plan can starve every other request on the instance.
  // `statement_timeout` is the server-side cap and `query_timeout` the
  // client-side one; both are needed, because the server cannot end a query
  // that is stalled on the network rather than on CPU.
  statement_timeout: environment.databaseStatementTimeoutMs,
  query_timeout: environment.databaseStatementTimeoutMs,
  // Long-lived pooled connections otherwise die silently behind a load balancer
  // or NAT idle timeout and surface as a failed request rather than a reconnect.
  keepAlive: true,
});

pool.on("error", (error: Error) => {
  logger.error("database_pool_error", safeErrorMetadata(error));
});

export const database = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
  log(event) {
    if (event.level === "error") logger.error("database_query_failed", safeErrorMetadata(event.error));
  },
});

/**
 * A separate, short-lived connection for work that is legitimately slow.
 *
 * The request pool caps every statement at `statement_timeout`, which is what
 * keeps one bad plan from starving an instance. Schema migrations and dataset
 * imports run long by design - an index build over a large table is minutes,
 * not milliseconds - so they get their own pool with no cap rather than being
 * killed halfway through by a limit meant for HTTP traffic.
 *
 * Callers must `destroy()` what they create.
 */
export const createMaintenanceDatabase = (): Kysely<Database> => new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: environment.databaseUrl,
      max: 1,
      connectionTimeoutMillis: environment.databaseConnectionTimeoutMs,
      application_name: "motionmeet-maintenance",
    }),
  }),
});

let databaseReady = false;

export const connectDatabase = async (): Promise<void> => {
  await sql`select 1`.execute(database);
  databaseReady = true;
};

export const disconnectDatabase = async (): Promise<void> => {
  databaseReady = false;
  await database.destroy();
};

export const isDatabaseReady = (): boolean => databaseReady;

export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await sql`select 1`.execute(database);
    databaseReady = true;
    return true;
  } catch {
    databaseReady = false;
    return false;
  }
};

export type DatabaseTransaction = Transaction<Database>;

export const withTransaction = <T>(callback: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> =>
  database.transaction().execute(callback);
