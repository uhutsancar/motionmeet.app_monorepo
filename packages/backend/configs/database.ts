import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";
import { Pool } from "pg";
import { loadEnvironment } from "./environment.js";
import type { Database } from "../db/types.js";

const environment = loadEnvironment();
const pool = new Pool({
  connectionString: environment.databaseUrl,
  min: environment.databasePoolMin,
  max: environment.databasePoolMax,
  connectionTimeoutMillis: environment.databaseConnectionTimeoutMs,
  idleTimeoutMillis: environment.databaseIdleTimeoutMs,
  allowExitOnIdle: environment.nodeEnv !== "production",
  application_name: "motionmeet-api",
});

pool.on("error", (error: Error) => {
  console.error("PostgreSQL pool error:", error.message);
});

export const database = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
  log(event) {
    if (event.level === "error") console.error("PostgreSQL query error:", event.error);
  },
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
