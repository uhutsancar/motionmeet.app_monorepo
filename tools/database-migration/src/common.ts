import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { MongoClient, ObjectId, type Db, type Document } from "mongodb";
import { Pool, type PoolClient } from "pg";

export type SourceRecord = Document & { _id: ObjectId | string };
export type JsonRecord = Record<string, unknown>;
export type SqlValue = string | number | boolean | Date | null | string[] | JsonRecord;

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(toolDirectory, "../../../packages/backend/.env") });

const requiredEnvironment = (name: "MONGODB_URL" | "MONGODB_DB_NAME" | "DATABASE_URL"): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the offline migration tool`);
  return value;
};

export const mongoClient = new MongoClient(requiredEnvironment("MONGODB_URL"), {
  appName: "motionmeet-postgresql-migration",
  maxPoolSize: 5,
  serverSelectionTimeoutMS: 10_000,
});

export const postgresPool = new Pool({
  connectionString: requiredEnvironment("DATABASE_URL"),
  application_name: "motionmeet-postgresql-migration",
  max: 5,
});

export const connectSources = async (): Promise<Db> => {
  await mongoClient.connect();
  const db = mongoClient.db(requiredEnvironment("MONGODB_DB_NAME"));
  await postgresPool.query("select 1");
  return db;
};

export const disconnectSources = async (): Promise<void> => {
  await Promise.allSettled([mongoClient.close(), postgresPool.end()]);
};

export const asRecord = (value: unknown): JsonRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries()) as JsonRecord;
  return value as JsonRecord;
};

export const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : value === null || value === undefined ? fallback : String(value);
export const asNullableString = (value: unknown): string | null => {
  const result = asString(value).trim();
  return result || null;
};
export const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
export const asInteger = (value: unknown, fallback = 0): number => Math.trunc(asNumber(value, fallback));
export const asBoolean = (value: unknown, fallback = false): boolean => typeof value === "boolean" ? value : fallback;
export const asDate = (value: unknown, fallback = new Date(0)): Date => {
  const date = value instanceof Date ? value : new Date(asString(value));
  return Number.isNaN(date.getTime()) ? fallback : date;
};
export const asNullableDate = (value: unknown): Date | null => value === null || value === undefined ? null : asDate(value);
export const legacyId = (value: unknown): string => value instanceof ObjectId ? value.toHexString() : asString(value);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const idFor = (domain: string, value: unknown): string => {
  const legacy = legacyId(value);
  if (domain === "users" && UUID_PATTERN.test(legacy)) return legacy.toLowerCase();
  const bytes = createHash("sha256").update(`motionmeet:${domain}:${legacy}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const IDENTIFIER = /^[a-z][a-z0-9_]*$/;

const assertIdentifier = (value: string): string => {
  if (!IDENTIFIER.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value}"`;
};

export const upsert = async (
  client: PoolClient,
  table: string,
  row: Record<string, SqlValue>,
  conflictColumns: string[],
): Promise<void> => {
  const columns = Object.keys(row);
  if (!columns.length) throw new Error(`Cannot insert an empty ${table} row`);
  const quotedTable = assertIdentifier(table);
  const quotedColumns = columns.map(assertIdentifier);
  const conflict = conflictColumns.map(assertIdentifier).join(", ");
  const updates = columns
    .filter((column) => !conflictColumns.includes(column) && column !== "id" && column !== "created_at")
    .map((column) => `${assertIdentifier(column)} = EXCLUDED.${assertIdentifier(column)}`)
    .join(", ");
  const values = columns.map((column) => row[column]);
  const placeholders = values.map((_value, index) => `$${index + 1}`).join(", ");
  const action = updates ? `DO UPDATE SET ${updates}` : "DO NOTHING";
  await client.query(
    `INSERT INTO ${quotedTable} (${quotedColumns.join(", ")}) VALUES (${placeholders}) ON CONFLICT (${conflict}) ${action}`,
    values,
  );
};

export interface MigrationStats {
  read: number;
  migrated: number;
  skipped: number;
  errors: Array<{ legacyId: string; message: string }>;
}

export type RecordMigrator = (document: SourceRecord, client: PoolClient) => Promise<void>;

export const migrateCollection = async (
  mongo: Db,
  collectionName: string,
  migrateRecord: RecordMigrator,
  batchSize = 200,
): Promise<MigrationStats> => {
  const stats: MigrationStats = { read: 0, migrated: 0, skipped: 0, errors: [] };
  const cursor = mongo.collection<SourceRecord>(collectionName).find({}).sort({ _id: 1 }).batchSize(batchSize);
  let batch: SourceRecord[] = [];

  const migrateSingle = async (document: SourceRecord): Promise<void> => {
    const client = await postgresPool.connect();
    try {
      await client.query("BEGIN");
      await migrateRecord(document, client);
      await client.query("COMMIT");
      stats.migrated += 1;
    } catch (error) {
      await client.query("ROLLBACK");
      stats.errors.push({
        legacyId: legacyId(document._id),
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      client.release();
    }
  };

  const flush = async (): Promise<void> => {
    if (!batch.length) return;
    const client = await postgresPool.connect();
    try {
      await client.query("BEGIN");
      for (const document of batch) await migrateRecord(document, client);
      await client.query("COMMIT");
      stats.migrated += batch.length;
    } catch {
      await client.query("ROLLBACK");
      for (const document of batch) await migrateSingle(document);
    } finally {
      client.release();
      batch = [];
    }
  };

  for await (const document of cursor) {
    stats.read += 1;
    batch.push(document);
    if (batch.length >= batchSize) await flush();
  }
  await flush();
  return stats;
};
