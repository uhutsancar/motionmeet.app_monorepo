import type { Response } from "express";
import { sql } from "kysely";
import { database, withTransaction } from "../configs/database.js";
import { invalidateCacheOwners } from "../configs/redis.js";
import { exerciseListOwner } from "./exerciseService.js";
import { feedCacheOwner, profileCacheOwner } from "./feedCache.js";
import { queueMediaDeletions } from "./mediaDeletionService.js";

const writeChunk = async (response: Response, chunk: string): Promise<void> => {
  if (response.destroyed) throw new Error("Account export connection closed");
  if (response.write(chunk)) return;
  await new Promise<void>((resolve, reject) => {
    const onDrain = (): void => { response.off("close", onClose); resolve(); };
    const onClose = (): void => { response.off("drain", onDrain); reject(new Error("Account export connection closed")); };
    response.once("drain", onDrain); response.once("close", onClose);
  });
};

const streamRows = async (response: Response, rows: AsyncIterable<unknown>): Promise<void> => {
  await writeChunk(response, "["); let first = true;
  for await (const row of rows) { await writeChunk(response, `${first ? "" : ","}${JSON.stringify(row)}`); first = false; }
  await writeChunk(response, "]");
};

export const streamAccountData = async (userId: string, response: Response): Promise<boolean> => {
  const user = await database.selectFrom("users").select([
    "id", "email", "full_name", "username", "bio", "profile_picture_url", "cover_photo_url", "location", "role", "plan_id", "plan_status",
    "weight", "height", "followers_count", "following_count", "connections_count", "privacy_public_profile", "privacy_show_workouts_on_feed",
    "privacy_allow_followers", "privacy_show_in_search", "privacy_allow_messages", "total_workouts", "total_duration_minutes", "total_volume_kg", "created_at", "updated_at",
  ]).where("id", "=", userId).executeTakeFirst();
  if (!user) return false;
  await writeChunk(response, `{"exportedAt":${JSON.stringify(new Date().toISOString())},"formatVersion":3,"user":${JSON.stringify(user)}`);
  const sections: Array<[string, () => AsyncIterable<unknown>]> = [
    ["workouts", () => database.selectFrom("workouts").selectAll().where("user_id", "=", userId).orderBy("id").stream(200)],
    ["routines", () => database.selectFrom("routines").selectAll().where("user_id", "=", userId).orderBy("id").stream(200)],
    ["posts", () => database.selectFrom("posts").selectAll().where("user_id", "=", userId).orderBy("id").stream(200)],
    ["stories", () => database.selectFrom("stories").selectAll().where("user_id", "=", userId).orderBy("id").stream(200)],
    ["messages", () => database.selectFrom("messages").selectAll().where((expression) => expression.or([expression("from_user_id", "=", userId), expression("to_user_id", "=", userId)])).orderBy("id").stream(200)],
    ["connections", () => database.selectFrom("connections").selectAll().where((expression) => expression.or([expression("from_user_id", "=", userId), expression("to_user_id", "=", userId)])).orderBy("id").stream(200)],
    ["conversations", () => database.selectFrom("conversations").innerJoin("conversation_participants", "conversation_participants.conversation_id", "conversations.id").selectAll("conversations").where("conversation_participants.user_id", "=", userId).orderBy("conversations.id").stream(200)],
    ["likes", () => database.selectFrom("post_likes").selectAll().where("user_id", "=", userId).stream(200)],
    ["comments", () => database.selectFrom("post_comments").selectAll().where("user_id", "=", userId).orderBy("id").stream(200)],
    ["customExercises", () => database.selectFrom("exercises").selectAll().where("created_by", "=", userId).orderBy("id").stream(200)],
    ["sessions", () => database.selectFrom("sessions").select(["id", "expires_at", "revoked_at", "last_used_at", "user_agent", "ip_address", "created_at", "updated_at"]).where("user_id", "=", userId).orderBy("id").stream(200)],
    ["usage", () => database.selectFrom("usage_counters").selectAll().where("user_id", "=", userId).orderBy("id").stream(200)],
    ["uploadReservations", () => database.selectFrom("upload_reservations").select(["id", "object_key", "purpose", "content_type", "max_bytes", "expires_at", "created_at"]).where("user_id", "=", userId).orderBy("id").stream(200)],
    ["personalRecords", () => database.selectFrom("personal_records").selectAll().where("user_id", "=", userId).orderBy("id").stream(200)],
    ["dailyWorkoutStats", () => database.selectFrom("user_daily_workout_stats").selectAll().where("user_id", "=", userId).orderBy("id").stream(200)],
    ["exerciseDailyStats", () => database.selectFrom("user_exercise_daily_stats").selectAll().where("user_id", "=", userId).orderBy("id").stream(200)],
  ];
  for (const [name, rows] of sections) { await writeChunk(response, `,${JSON.stringify(name)}:`); await streamRows(response, rows()); }
  await writeChunk(response, "}"); response.end(); return true;
};

export const deleteAccountData = async (userId: string): Promise<boolean> => {
  const exists = await database.selectFrom("users").select("id").where("id", "=", userId).executeTakeFirst(); if (!exists) return false;
  await withTransaction(async (transaction) => {
    const user = await transaction.selectFrom("users").select(["profile_picture_key", "cover_photo_key"]).where("id", "=", userId).forUpdate().executeTakeFirstOrThrow();
    await queueMediaDeletions([user.profile_picture_key, user.cover_photo_key], { transaction });
    await sql`insert into media_deletion_jobs (object_key) select pm.object_key from post_media pm join posts p on p.id = pm.post_id where p.user_id = ${userId} and pm.object_key <> '' on conflict (object_key) do nothing`.execute(transaction);
    await sql`insert into media_deletion_jobs (object_key) select media_key from stories where user_id = ${userId} and media_key <> '' on conflict (object_key) do nothing`.execute(transaction);
    await sql`insert into media_deletion_jobs (object_key) select media_key from messages where (from_user_id = ${userId} or to_user_id = ${userId}) and media_key <> '' on conflict (object_key) do nothing`.execute(transaction);
    await sql`insert into media_deletion_jobs (object_key) select object_key from upload_reservations where user_id = ${userId} on conflict (object_key) do nothing`.execute(transaction);
    await sql`update posts p set like_count = greatest(0, p.like_count - x.amount) from (select post_id, count(*)::int amount from post_likes where user_id = ${userId} group by post_id) x where p.id = x.post_id and p.user_id <> ${userId}`.execute(transaction);
    await sql`update posts p set comment_count = greatest(0, p.comment_count - x.amount) from (select post_id, count(*)::int amount from post_comments where user_id = ${userId} group by post_id) x where p.id = x.post_id and p.user_id <> ${userId}`.execute(transaction);
    await sql`update users u set followers_count = greatest(0, u.followers_count - 1) where u.id in (select followee_id from user_follows where follower_id = ${userId})`.execute(transaction);
    await sql`update users u set following_count = greatest(0, u.following_count - 1) where u.id in (select follower_id from user_follows where followee_id = ${userId})`.execute(transaction);
    await sql`update users u set connections_count = greatest(0, u.connections_count - 1) where u.id in (select case when from_user_id = ${userId} then to_user_id else from_user_id end from connections where status = 'accepted' and (from_user_id = ${userId} or to_user_id = ${userId}))`.execute(transaction);
    await transaction.deleteFrom("conversations").where("id", "in", transaction.selectFrom("conversation_participants").select("conversation_id").where("user_id", "=", userId)).execute();
    await transaction.deleteFrom("users").where("id", "=", userId).execute();
  });
  // The account is gone, so only its own cached surfaces need dropping: its
  // profile, its feed pages and its exercise list (custom exercises went with
  // the cascade). Everyone else's copies age out on their own TTL.
  await invalidateCacheOwners(profileCacheOwner(userId), feedCacheOwner(userId), exerciseListOwner(userId));
  return true;
};
