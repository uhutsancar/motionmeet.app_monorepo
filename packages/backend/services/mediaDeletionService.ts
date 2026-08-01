import crypto from "node:crypto";
import { database, withTransaction, type DatabaseTransaction } from "../configs/database.js";
import type { Row } from "../db/types.js";
import { deleteFromS3 } from "../utils/s3Utils.js";

const validKeys = (keys: readonly unknown[]): string[] => [...new Set(keys.filter((key): key is string => typeof key === "string" && key.length > 0))];

export const queueMediaDeletions = async (keys: readonly unknown[], { transaction }: { transaction?: DatabaseTransaction } = {}): Promise<void> => {
  const executor = transaction ?? database;
  for (const objectKey of validKeys(keys)) await executor.insertInto("media_deletion_jobs").values({
    legacy_mongo_id: null, object_key: objectKey, attempts: 0, next_attempt_at: new Date(), last_error: "", claim_token: null, claim_until: null,
  }).onConflict((conflict) => conflict.column("object_key").doNothing()).execute();
};

const claimJob = async (keys?: string[]): Promise<Row<"media_deletion_jobs"> | null> => withTransaction(async (transaction) => {
  let query = transaction.selectFrom("media_deletion_jobs").selectAll().where("next_attempt_at", "<=", new Date())
    .where((expression) => expression.or([expression("claim_until", "is", null), expression("claim_until", "<=", new Date())]));
  if (keys?.length) query = query.where("object_key", "in", keys);
  const job = await query.orderBy("next_attempt_at").orderBy("id").forUpdate().skipLocked().executeTakeFirst();
  if (!job) return null;
  const claimToken = crypto.randomUUID();
  const claimed = await transaction.updateTable("media_deletion_jobs").set({ claim_token: claimToken, claim_until: new Date(Date.now() + 60_000) })
    .where("id", "=", job.id).returningAll().executeTakeFirst();
  return claimed ?? null;
});

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : "S3 deletion failed";
const errorCode = (error: unknown): string | null => error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : null;

const recordFailure = async (job: Row<"media_deletion_jobs">, error: unknown): Promise<void> => {
  if (errorCode(error) === "INVALID_S3_KEY") { await database.deleteFrom("media_deletion_jobs").where("id", "=", job.id).where("claim_token", "=", job.claim_token).execute(); return; }
  const attempts = job.attempts + 1;
  await database.updateTable("media_deletion_jobs").set({ attempts, next_attempt_at: new Date(Date.now() + Math.min(86_400_000, 2 ** attempts * 60_000)), last_error: errorMessage(error).slice(0, 500), claim_token: null, claim_until: null })
    .where("id", "=", job.id).where("claim_token", "=", job.claim_token).execute();
};

export const processMediaDeletionJobs = async ({ limit = 200, keys }: { limit?: number; keys?: string[] } = {}): Promise<number> => {
  let processed = 0;
  while (processed < limit) {
    const job = await claimJob(keys);
    if (!job) break;
    try {
      await deleteFromS3(job.object_key);
      await database.deleteFrom("media_deletion_jobs").where("id", "=", job.id).where("claim_token", "=", job.claim_token).execute();
    } catch (error: unknown) { await recordFailure(job, error); }
    processed += 1;
  }
  return processed;
};

export const deleteMediaOrQueue = async (keys: readonly unknown[]): Promise<void> => {
  const values = validKeys(keys);
  if (!values.length) return;
  await queueMediaDeletions(values);
  await processMediaDeletionJobs({ limit: values.length, keys: values });
};
