import type { Story } from "@motionmeet/shared";
import { sql } from "kysely";
import { database, withTransaction } from "../configs/database.js";
import { publicUser } from "../repositories/postRepository.js";
import { toIsoString } from "../repositories/entities.js";
import type { Pagination } from "../utils/pagination.js";
import { extractS3Key } from "../utils/s3Utils.js";
import { queueMediaDeletions } from "./mediaDeletionService.js";
import { commitReservedUploads } from "./mediaUploadService.js";
import * as quotaService from "./quotaService.js";

interface StoryAccess { id: string; _id: string; user: string; media_url: string; media_key: string }
interface NewStory { user: string; operationId: string; content: string; media_url: string; media_key: string; media_type: "text" | "image" | "video"; background_color: string }

const hydrate = async (rows: Array<{ id: string; user_id: string; operation_id: string | null; content: string; media_url: string; media_key: string; media_type: "text" | "image" | "video"; background_color: string; expires_at: Date; created_at: Date; updated_at: Date }>): Promise<Story[]> => {
  const ids = [...new Set(rows.map((row) => row.user_id))];
  const users = ids.length ? await database.selectFrom("users").select(["id", "full_name", "username", "profile_picture_url"]).where("id", "in", ids).execute() : [];
  const byId = new Map(users.map((user) => [user.id, publicUser(user.id, user.full_name, user.username, user.profile_picture_url)]));
  return rows.map((row) => ({ id: row.id, _id: row.id, operationId: row.operation_id, user: byId.get(row.user_id) ?? row.user_id, content: row.content, media_url: row.media_url, media_type: row.media_type, background_color: row.background_color, expiresAt: toIsoString(row.expires_at) ?? new Date(0).toISOString(), createdAt: toIsoString(row.created_at) ?? new Date(0).toISOString(), updatedAt: toIsoString(row.updated_at) ?? new Date(0).toISOString() }));
};

export const findStoryByOperation = async (userId: string, operationId: string): Promise<Story | null> => {
  const row = await database.selectFrom("stories").selectAll().where("user_id", "=", userId).where("operation_id", "=", operationId).executeTakeFirst();
  return row ? (await hydrate([row]))[0] ?? null : null;
};

export const createStory = async (input: NewStory, { quotaLimit = -1, reservationKeys = [] }: { quotaLimit?: number; reservationKeys?: string[] } = {}): Promise<Story> => {
  try {
    return await withTransaction(async (transaction) => {
      const existing = await transaction.selectFrom("stories").selectAll().where("user_id", "=", input.user).where("operation_id", "=", input.operationId).executeTakeFirst();
      if (existing) return (await hydrate([existing]))[0]!;
      if (quotaLimit !== -1) {
        const now = new Date(); const dayStart = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
        const reserved = await quotaService.reserveQuota({ userId: input.user, bucket: quotaService.dailyBucket("stories", now), limit: quotaLimit, getCurrentCount: async () => Number((await transaction.selectFrom("stories").select((expression) => expression.fn.countAll<number>().as("count")).where("user_id", "=", input.user).where("created_at", ">=", dayStart).executeTakeFirst())?.count ?? 0), transaction, expiresAt: quotaService.shortLivedUsageExpiry(now) });
        if (!reserved) throw Object.assign(new Error(`Daily story limit reached (${quotaLimit})`), { status: 403 });
      }
      const row = await transaction.insertInto("stories").values({ legacy_mongo_id: null, user_id: input.user, operation_id: input.operationId, content: input.content, media_url: input.media_url, media_key: input.media_key, media_type: input.media_type, background_color: input.background_color, expires_at: new Date(Date.now() + 86_400_000) }).returningAll().executeTakeFirstOrThrow();
      await commitReservedUploads(reservationKeys, { transaction, userId: input.user });
      return (await hydrate([row]))[0]!;
    });
  } catch (error: unknown) {
    const unique = Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
    if (!unique) throw error;
    const existing = await findStoryByOperation(input.user, input.operationId); if (!existing) throw error; return existing;
  }
};

export const getStoriesForUser = async (userId: string, pagination: Pagination): Promise<{ items: Story[]; nextCursor: string | null }> => {
  let query = database.selectFrom("stories").selectAll().where("expires_at", ">", new Date()).where((expression) => expression.or([
    expression("user_id", "=", userId),
    sql<boolean>`exists (select 1 from user_follows uf where uf.follower_id = ${userId} and uf.followee_id = stories.user_id)`,
    sql<boolean>`exists (select 1 from connections c where c.status = 'accepted' and ((c.from_user_id = ${userId} and c.to_user_id = stories.user_id) or (c.to_user_id = ${userId} and c.from_user_id = stories.user_id)))`,
  ]));
  if (pagination.cursor) query = query.where((expression) => expression.or([expression("created_at", "<", pagination.cursor!.date), expression.and([expression("created_at", "=", pagination.cursor!.date), expression("id", "<", pagination.cursor!.id)])]));
  const rows = await query.orderBy("created_at", "desc").orderBy("id", "desc").limit(pagination.limit + 1).execute();
  const hasMore = rows.length > pagination.limit; const selected = hasMore ? rows.slice(0, pagination.limit) : rows; const last = selected.at(-1);
  return { items: await hydrate(selected), nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ date: new Date(last.created_at).toISOString(), id: last.id })).toString("base64url") : null };
};

export const getStoryById = async (storyId: string): Promise<StoryAccess | null> => {
  const row = await database.selectFrom("stories").select(["id", "user_id", "media_url", "media_key"]).where("id", "=", storyId).executeTakeFirst();
  return row ? { id: row.id, _id: row.id, user: row.user_id, media_url: row.media_url, media_key: row.media_key } : null;
};

export const deleteStoryById = async (story: StoryAccess): Promise<void> => withTransaction(async (transaction) => {
  const key = story.media_key || extractS3Key(story.media_url); if (key) await queueMediaDeletions([key], { transaction });
  await transaction.deleteFrom("story_views").where("story_id", "=", story.id).execute();
  await transaction.deleteFrom("stories").where("id", "=", story.id).execute();
});
