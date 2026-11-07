import type { Response } from "express";
import { sql, type RawBuilder } from "kysely";
import { createMaintenanceDatabase, database, withTransaction, type DatabaseTransaction } from "../configs/database.js";
import { invalidateCacheOwners, markSessionsRevoked } from "../configs/redis.js";
import { exerciseListOwner } from "./exerciseService.js";
import { feedCacheOwner, profileCacheOwner, retractAuthor } from "./feedCache.js";
import { queueMediaDeletions } from "./mediaDeletionService.js";

/**
 * Account export, format 4 (docs/ACCOUNT_EXPORT_FORMAT.md).
 *
 * The previous version streamed each section with Kysely's `.stream()`, which
 * needs a `pg-cursor` the dialect was never given, so every export failed
 * after the first 711 bytes - with a 200 already on the wire, which left the
 * member holding a truncated file that looked like a successful download
 * (R5 in the 2026-11 audit).
 *
 * Each section is now read in keyset pages instead: `where <key> > <last key>
 * order by <key> limit n`. A page holds a pooled connection only for its own
 * query and gives it back before the next one, so a slow client never pins a
 * connection, `statement_timeout` still applies per page, and no new
 * dependency is needed. Sections are not one consistent snapshot - a row
 * written while the export runs may or may not appear - which is acceptable
 * for a personal data download and stated in the format document.
 *
 * The file ends with `"complete": true`. A reader that does not find it knows
 * the download was cut short.
 */
export const EXPORT_FORMAT_VERSION = 4;
const PAGE_SIZE = 500;

const writeChunk = async (response: Response, chunk: string): Promise<void> => {
  if (response.destroyed) throw new Error("Account export connection closed");
  if (response.write(chunk)) return;
  await new Promise<void>((resolve, reject) => {
    const onDrain = (): void => { response.off("close", onClose); resolve(); };
    const onClose = (): void => { response.off("drain", onDrain); reject(new Error("Account export connection closed")); };
    response.once("drain", onDrain); response.once("close", onClose);
  });
};

/**
 * Reads rows in key order, `batchSize` at a time, releasing the connection
 * between batches. `fetch` must order by a unique key and return rows that
 * still carry it, since the last row of one page is where the next starts.
 */
export async function* keysetBatches<Row>(fetch: (after: Row | null, limit: number) => Promise<Row[]>, batchSize = PAGE_SIZE): AsyncGenerator<Row> {
  let after: Row | null = null;
  for (;;) {
    const rows = await fetch(after, batchSize);
    for (const row of rows) yield row;
    if (rows.length < batchSize) return;
    after = rows[rows.length - 1] ?? null;
  }
}

interface ExportSection { name: string; rows: () => AsyncGenerator<unknown> }
const section = <Row>(name: string, fetch: (after: Row | null, limit: number) => Promise<Row[]>): ExportSection =>
  ({ name, rows: () => keysetBatches(fetch) });
/** A section that is at most one row, such as the member's nearby settings. */
const singleRow = <Row>(name: string, load: () => Promise<Row | undefined>): ExportSection =>
  section<Row>(name, async (after) => {
    if (after) return [];
    const row = await load();
    return row ? [row] : [];
  });

const groupBy = <T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> => {
  const groups = new Map<K, T[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
};

/** Workouts and routines carry their exercises and sets, one query per level per page. */
const nestWorkouts = async <W extends { id: string }>(workouts: W[]) => {
  if (!workouts.length) return [];
  const exercises = await database.selectFrom("workout_exercises")
    .select(["id", "workout_id", "exercise_id", "position", "exercise_name", "muscle_group", "equipment"])
    .where("workout_id", "in", workouts.map((row) => row.id)).orderBy("workout_id").orderBy("position").execute();
  const sets = exercises.length ? await database.selectFrom("workout_sets")
    .select(["workout_exercise_id", "position", "set_type", "reps", "weight", "completed"])
    .where("workout_exercise_id", "in", exercises.map((row) => row.id)).orderBy("position").execute() : [];
  const setsByExercise = groupBy(sets, (row) => row.workout_exercise_id);
  const exercisesByWorkout = groupBy(exercises, (row) => row.workout_id);
  return workouts.map((workout) => ({
    ...workout,
    exercises: (exercisesByWorkout.get(workout.id) ?? []).map(({ workout_id: _workout, ...exercise }) => ({
      ...exercise,
      sets: (setsByExercise.get(exercise.id) ?? []).map(({ workout_exercise_id: _exercise, ...set }) => set),
    })),
  }));
};

const nestRoutines = async <R extends { id: string }>(routines: R[]) => {
  if (!routines.length) return [];
  const exercises = await database.selectFrom("routine_exercises")
    .select(["id", "routine_id", "exercise_id", "position", "exercise_name", "muscle_group", "equipment"])
    .where("routine_id", "in", routines.map((row) => row.id)).orderBy("routine_id").orderBy("position").execute();
  const sets = exercises.length ? await database.selectFrom("routine_sets")
    .select(["routine_exercise_id", "position", "set_type", "reps", "weight", "completed"])
    .where("routine_exercise_id", "in", exercises.map((row) => row.id)).orderBy("position").execute() : [];
  const setsByExercise = groupBy(sets, (row) => row.routine_exercise_id);
  const exercisesByRoutine = groupBy(exercises, (row) => row.routine_id);
  return routines.map((routine) => ({
    ...routine,
    exercises: (exercisesByRoutine.get(routine.id) ?? []).map(({ routine_id: _routine, ...exercise }) => ({
      ...exercise,
      sets: (setsByExercise.get(exercise.id) ?? []).map(({ routine_exercise_id: _exercise, ...set }) => set),
    })),
  }));
};

/** A post's files, without the storage key: the URL is the member's, the key is ours. */
const nestPostMedia = async <P extends { id: string }>(posts: P[]) => {
  if (!posts.length) return [];
  const media = await database.selectFrom("post_media")
    .select(["post_id", "position", "url", "media_type", "mime_type", "file_size", "width", "height", "duration_seconds", "created_at"])
    .where("post_id", "in", posts.map((row) => row.id)).orderBy("position").execute();
  const byPost = groupBy(media, (row) => row.post_id);
  return posts.map((post) => ({ ...post, media: (byPost.get(post.id) ?? []).map(({ post_id: _post, ...entry }) => entry) }));
};

const nestCustomExercises = async <E extends { id: string }>(exercises: E[]) => {
  if (!exercises.length) return [];
  const ids = exercises.map((row) => row.id);
  const [muscles, instructions] = await Promise.all([
    database.selectFrom("exercise_secondary_muscles").select(["exercise_id", "muscle", "position"]).where("exercise_id", "in", ids).orderBy("position").execute(),
    database.selectFrom("exercise_instructions").select(["exercise_id", "language", "summary", "steps"]).where("exercise_id", "in", ids).execute(),
  ]);
  const musclesBy = groupBy(muscles, (row) => row.exercise_id);
  const instructionsBy = groupBy(instructions, (row) => row.exercise_id);
  return exercises.map((exercise) => ({
    ...exercise,
    secondary_muscles: (musclesBy.get(exercise.id) ?? []).map((row) => row.muscle),
    instructions: (instructionsBy.get(exercise.id) ?? []).map(({ exercise_id: _exercise, ...entry }) => entry),
  }));
};

const readExportUser = (userId: string) => database.selectFrom("users").select([
  "id", "email", "full_name", "username", "bio", "profile_picture_url", "cover_photo_url", "role",
  "location", "location_country_id", "location_state_id", "location_city_id", "location_visibility", "location_source", "location_selected_at",
  "weight", "height", "followers_count", "following_count", "connections_count",
  "privacy_public_profile", "privacy_show_workouts_on_feed", "privacy_allow_followers", "privacy_show_in_search", "privacy_allow_messages",
  "total_workouts", "total_duration_minutes", "total_volume_kg", "created_at", "updated_at",
]).where("id", "=", userId).executeTakeFirst();

/**
 * Every section of the file, in order. What is deliberately left out, here
 * and in every section: password and session token hashes, password reset
 * tokens, storage object keys, outbox/processed events, media deletion jobs,
 * and other members' email addresses.
 */
const exportSections = (userId: string): ExportSection[] => [
  section<{ id: string }>("workouts", async (after, limit) => {
    let query = database.selectFrom("workouts").select(["id", "operation_id", "name", "start_time", "end_time", "duration_minutes", "volume_kg", "total_sets", "total_reps", "metrics_version", "created_at", "updated_at"]).where("user_id", "=", userId);
    if (after) query = query.where("id", ">", after.id);
    return nestWorkouts(await query.orderBy("id").limit(limit).execute());
  }),
  section<{ id: string }>("routines", async (after, limit) => {
    let query = database.selectFrom("routines").selectAll().where("user_id", "=", userId);
    if (after) query = query.where("id", ">", after.id);
    return nestRoutines(await query.orderBy("id").limit(limit).execute());
  }),
  section<{ id: string }>("posts", async (after, limit) => {
    let query = database.selectFrom("posts").selectAll().where("user_id", "=", userId);
    if (after) query = query.where("id", ">", after.id);
    return nestPostMedia(await query.orderBy("id").limit(limit).execute());
  }),
  // Expired stories are deleted by the scheduler; whatever is still live is exported.
  section<{ id: string }>("stories", async (after, limit) => {
    let query = database.selectFrom("stories").select(["id", "operation_id", "content", "media_url", "media_type", "background_color", "overlays", "expires_at", "created_at", "updated_at"])
      .where("user_id", "=", userId).where("expires_at", ">", new Date());
    if (after) query = query.where("id", ">", after.id);
    return query.orderBy("id").limit(limit).execute();
  }),
  section<{ story_id: string }>("storyViewsGiven", async (after, limit) => {
    let query = database.selectFrom("story_views").select(["story_id", "created_at"]).where("user_id", "=", userId);
    if (after) query = query.where("story_id", ">", after.story_id);
    return query.orderBy("story_id").limit(limit).execute();
  }),
  section<{ story_id: string }>("storyLikesGiven", async (after, limit) => {
    let query = database.selectFrom("story_likes").select(["story_id", "created_at"]).where("user_id", "=", userId);
    if (after) query = query.where("story_id", ">", after.story_id);
    return query.orderBy("story_id").limit(limit).execute();
  }),
  section<{ id: string }>("messages", async (after, limit) => {
    let query = database.selectFrom("messages").select(["id", "conversation_id", "operation_id", "from_user_id", "to_user_id", "text", "message_type", "media_url", "seen", "created_at", "updated_at"])
      .where((expression) => expression.or([expression("from_user_id", "=", userId), expression("to_user_id", "=", userId)]));
    if (after) query = query.where("id", ">", after.id);
    return query.orderBy("id").limit(limit).execute();
  }),
  section<{ id: string }>("conversations", async (after, limit) => {
    let query = database.selectFrom("conversations").innerJoin("conversation_participants", "conversation_participants.conversation_id", "conversations.id")
      .select(["conversations.id", "conversations.last_message_at", "conversations.created_at", "conversations.updated_at", "conversation_participants.unread_count"])
      .where("conversation_participants.user_id", "=", userId);
    if (after) query = query.where("conversations.id", ">", after.id);
    return query.orderBy("conversations.id").limit(limit).execute();
  }),
  section<{ id: string }>("connections", async (after, limit) => {
    let query = database.selectFrom("connections").select(["id", "from_user_id", "to_user_id", "status", "created_at", "updated_at"])
      .where((expression) => expression.or([expression("from_user_id", "=", userId), expression("to_user_id", "=", userId)]));
    if (after) query = query.where("id", ">", after.id);
    return query.orderBy("id").limit(limit).execute();
  }),
  section<{ user_id: string }>("followers", async (after, limit) => {
    let query = database.selectFrom("user_follows").innerJoin("users", "users.id", "user_follows.follower_id")
      .select(["user_follows.follower_id as user_id", "users.username", "user_follows.created_at"]).where("user_follows.followee_id", "=", userId);
    if (after) query = query.where("user_follows.follower_id", ">", after.user_id);
    return query.orderBy("user_follows.follower_id").limit(limit).execute();
  }),
  section<{ user_id: string }>("following", async (after, limit) => {
    let query = database.selectFrom("user_follows").innerJoin("users", "users.id", "user_follows.followee_id")
      .select(["user_follows.followee_id as user_id", "users.username", "user_follows.created_at"]).where("user_follows.follower_id", "=", userId);
    if (after) query = query.where("user_follows.followee_id", ">", after.user_id);
    return query.orderBy("user_follows.followee_id").limit(limit).execute();
  }),
  section<{ id: string }>("followRequestsSent", async (after, limit) => {
    let query = database.selectFrom("follow_requests").innerJoin("users", "users.id", "follow_requests.target_id")
      .select(["follow_requests.id", "follow_requests.target_id as user_id", "users.username", "follow_requests.created_at"]).where("follow_requests.requester_id", "=", userId);
    if (after) query = query.where("follow_requests.id", ">", after.id);
    return query.orderBy("follow_requests.id").limit(limit).execute();
  }),
  section<{ id: string }>("followRequestsReceived", async (after, limit) => {
    let query = database.selectFrom("follow_requests").innerJoin("users", "users.id", "follow_requests.requester_id")
      .select(["follow_requests.id", "follow_requests.requester_id as user_id", "users.username", "follow_requests.created_at"]).where("follow_requests.target_id", "=", userId);
    if (after) query = query.where("follow_requests.id", ">", after.id);
    return query.orderBy("follow_requests.id").limit(limit).execute();
  }),
  section<{ id: string }>("notifications", async (after, limit) => {
    let query = database.selectFrom("notifications").select(["id", "actor_id", "type", "post_id", "story_id", "read_at", "created_at", "updated_at"]).where("user_id", "=", userId);
    if (after) query = query.where("id", ">", after.id);
    return query.orderBy("id").limit(limit).execute();
  }),
  section<{ post_id: string }>("likes", async (after, limit) => {
    let query = database.selectFrom("post_likes").select(["post_id", "created_at"]).where("user_id", "=", userId);
    if (after) query = query.where("post_id", ">", after.post_id);
    return query.orderBy("post_id").limit(limit).execute();
  }),
  section<{ id: string }>("comments", async (after, limit) => {
    let query = database.selectFrom("post_comments").select(["id", "post_id", "content", "created_at", "updated_at"]).where("user_id", "=", userId);
    if (after) query = query.where("id", ">", after.id);
    return query.orderBy("id").limit(limit).execute();
  }),
  section<{ id: string }>("customExercises", async (after, limit) => {
    let query = database.selectFrom("exercises").select(["id", "name", "muscle_group", "equipment", "target", "category", "image_url", "gif_url", "created_at", "updated_at"]).where("created_by", "=", userId);
    if (after) query = query.where("id", ">", after.id);
    return nestCustomExercises(await query.orderBy("id").limit(limit).execute());
  }),
  section<{ id: string }>("bodyMeasurements", async (after, limit) => {
    let query = database.selectFrom("body_measurements").selectAll().where("user_id", "=", userId);
    if (after) query = query.where("id", ">", after.id);
    return query.orderBy("id").limit(limit).execute();
  }),
  // The member's own last fix, coordinates included: it is their data (D-05).
  singleRow("nearby", () => database.selectFrom("user_locations")
    .select(["latitude", "longitude", "accuracy_meters", "source", "city_id", "enabled", "visible", "distance_visibility", "scope", "permission_status", "location_updated_at", "created_at", "updated_at"])
    .where("user_id", "=", userId).executeTakeFirst()),
  section<{ id: string }>("personalRecords", async (after, limit) => {
    let query = database.selectFrom("personal_records").selectAll().where("user_id", "=", userId);
    if (after) query = query.where("id", ">", after.id);
    return query.orderBy("id").limit(limit).execute();
  }),
  section<{ id: string }>("dailyWorkoutStats", async (after, limit) => {
    let query = database.selectFrom("user_daily_workout_stats").selectAll().where("user_id", "=", userId);
    if (after) query = query.where("id", ">", after.id);
    return query.orderBy("id").limit(limit).execute();
  }),
  section<{ daily_stat_id: string; muscle: string }>("dailyMuscleStats", async (after, limit) => {
    let query = database.selectFrom("user_daily_muscle_stats").innerJoin("user_daily_workout_stats", "user_daily_workout_stats.id", "user_daily_muscle_stats.daily_stat_id")
      .select(["user_daily_muscle_stats.daily_stat_id", "user_daily_workout_stats.date_key", "user_daily_muscle_stats.muscle", "user_daily_muscle_stats.set_count"])
      .where("user_daily_workout_stats.user_id", "=", userId);
    if (after) query = query.where(sql<boolean>`(user_daily_muscle_stats.daily_stat_id, user_daily_muscle_stats.muscle) > (${after.daily_stat_id}::uuid, ${after.muscle})`);
    return query.orderBy("user_daily_muscle_stats.daily_stat_id").orderBy("user_daily_muscle_stats.muscle").limit(limit).execute();
  }),
  section<{ id: string }>("exerciseDailyStats", async (after, limit) => {
    let query = database.selectFrom("user_exercise_daily_stats").selectAll().where("user_id", "=", userId);
    if (after) query = query.where("id", ">", after.id);
    return query.orderBy("id").limit(limit).execute();
  }),
  section<{ id: string }>("sessions", async (after, limit) => {
    let query = database.selectFrom("sessions").select(["id", "expires_at", "revoked_at", "last_used_at", "user_agent", "ip_address", "created_at", "updated_at"]).where("user_id", "=", userId);
    if (after) query = query.where("id", ">", after.id);
    return query.orderBy("id").limit(limit).execute();
  }),
  section<{ id: string }>("usage", async (after, limit) => {
    let query = database.selectFrom("usage_counters").select(["id", "bucket", "count", "expires_at", "created_at", "updated_at"]).where("user_id", "=", userId);
    if (after) query = query.where("id", ">", after.id);
    return query.orderBy("id").limit(limit).execute();
  }),
  section<{ id: string }>("uploadReservations", async (after, limit) => {
    let query = database.selectFrom("upload_reservations").select(["id", "purpose", "content_type", "max_bytes", "expires_at", "created_at"]).where("user_id", "=", userId);
    if (after) query = query.where("id", ">", after.id);
    return query.orderBy("id").limit(limit).execute();
  }),
];

const writeSection = async (response: Response, name: string, rows: AsyncIterable<unknown>): Promise<void> => {
  await writeChunk(response, `,${JSON.stringify(name)}:[`);
  let first = true;
  for await (const row of rows) { await writeChunk(response, `${first ? "" : ","}${JSON.stringify(row)}`); first = false; }
  await writeChunk(response, "]");
};

/** Replays an already-read first step before the rest of a generator. */
async function* resume<T>(step: IteratorResult<T>, rest: AsyncGenerator<T>): AsyncGenerator<T> {
  if (step.done) return;
  yield step.value;
  yield* rest;
}

/**
 * Writes the export to `response`. Returns false (nothing written) when the
 * account does not exist.
 *
 * The account row and the first page of the first section are read before
 * the first byte is written, so the failures that happen up front - database
 * unreachable, a timeout - still become an ordinary error response. A failure
 * after that rejects; the caller must then destroy the response rather than
 * end it, so the client sees a broken download instead of a short file.
 */
export const streamAccountData = async (userId: string, response: Response): Promise<boolean> => {
  const user = await readExportUser(userId);
  if (!user) return false;
  const [first, ...rest] = exportSections(userId);
  const firstRows = first!.rows();
  const firstStep = await firstRows.next();
  await writeChunk(response, `{"exportedAt":${JSON.stringify(new Date().toISOString())},"formatVersion":${EXPORT_FORMAT_VERSION},"user":${JSON.stringify(user)}`);
  await writeSection(response, first!.name, resume(firstStep, firstRows));
  for (const next of rest) await writeSection(response, next.name, next.rows());
  await writeChunk(response, `,"complete":true}`);
  response.end();
  return true;
};

const PURGE_BATCH = 1_000;
/** PostgreSQL's deadlock and serialization failures: the batch is simply run again. */
const RETRYABLE = new Set(["40P01", "40001"]);

/**
 * Runs `step` - one batch, in its own short transaction - until a batch
 * removes fewer than `PURGE_BATCH` rows. Each batch commits on its own, so a
 * deletion that stops half-way is continued, not repeated, by the next try.
 */
const purgeInBatches = async (step: (transaction: DatabaseTransaction) => Promise<number>): Promise<void> => {
  for (let attempt = 0; ;) {
    try {
      if (await withTransaction(step) < PURGE_BATCH) return;
      attempt = 0;
    } catch (error: unknown) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (!RETRYABLE.has(code) || ++attempt > 3) throw error;
    }
  }
};

/** Runs a `... select count(*)::int as removed from doomed` statement and returns that count. */
const removed = async (statement: RawBuilder<{ removed: number }>, transaction: DatabaseTransaction): Promise<number> =>
  Number((await statement.execute(transaction)).rows[0]?.removed ?? 0);

/**
 * The bulk of an account, removed in batches before the account row itself.
 *
 * Deleting the account used to be one transaction: every like, comment and
 * follow counter it touched updated, then one `DELETE FROM users` cascading
 * into everything the member ever wrote. A long history ran past the 15 s
 * statement timeout and the deletion failed - and while it ran, it held locks
 * on other members' posts and profiles. Now each batch takes a thousand rows
 * and fixes the counters for exactly those rows, in its own transaction.
 *
 * Messages are not batched: deleting a message writes a sync tombstone and
 * bumps its conversation (migration 016), which is right for one message and
 * pure waste when the conversation goes too. Conversations go whole in the
 * final step, where the cascade skips both.
 */
const purgeAccountContent = async (userId: string): Promise<void> => {
  // Likes and comments the member gave, with the counters of the posts they were on.
  await purgeInBatches((transaction) => removed(sql<{ removed: number }>`
    with doomed as (delete from post_likes where ctid = any(array(select ctid from post_likes where user_id = ${userId} limit ${PURGE_BATCH})) returning post_id),
    counted as (select post_id, count(*)::int as amount from doomed group by post_id),
    fixed as (update posts p set like_count = greatest(0, p.like_count - counted.amount) from counted where p.id = counted.post_id and p.user_id <> ${userId} returning 1)
    select count(*)::int as removed from doomed`, transaction));
  await purgeInBatches((transaction) => removed(sql<{ removed: number }>`
    with doomed as (delete from post_comments where ctid = any(array(select ctid from post_comments where user_id = ${userId} limit ${PURGE_BATCH})) returning post_id),
    counted as (select post_id, count(*)::int as amount from doomed group by post_id),
    fixed as (update posts p set comment_count = greatest(0, p.comment_count - counted.amount) from counted where p.id = counted.post_id and p.user_id <> ${userId} returning 1)
    select count(*)::int as removed from doomed`, transaction));
  // Other members' reactions to the member's own posts: one popular post can
  // carry more than any single statement should cascade into.
  await purgeInBatches((transaction) => removed(sql<{ removed: number }>`
    with doomed as (delete from post_likes where ctid = any(array(
      select pl.ctid from posts p join post_likes pl on pl.post_id = p.id where p.user_id = ${userId} limit ${PURGE_BATCH})) returning 1)
    select count(*)::int as removed from doomed`, transaction));
  await purgeInBatches((transaction) => removed(sql<{ removed: number }>`
    with doomed as (delete from post_comments where ctid = any(array(
      select pc.ctid from posts p join post_comments pc on pc.post_id = p.id where p.user_id = ${userId} limit ${PURGE_BATCH})) returning 1)
    select count(*)::int as removed from doomed`, transaction));
  // The posts themselves, their files queued for deletion first.
  await purgeInBatches(async (transaction) => {
    const posts = (await transaction.selectFrom("posts").select("id").where("user_id", "=", userId).limit(PURGE_BATCH).execute()).map((row) => row.id);
    if (!posts.length) return 0;
    await sql`insert into media_deletion_jobs (object_key) select object_key from post_media where post_id = any(${posts}::uuid[]) and object_key <> '' on conflict (object_key) do nothing`.execute(transaction);
    await transaction.deleteFrom("posts").where("id", "in", posts).execute();
    return posts.length;
  });
  // Workouts cascade into their exercises, sets and personal records.
  await purgeInBatches(async (transaction) => Number((await transaction.deleteFrom("workouts")
    .where("id", "in", transaction.selectFrom("workouts").select("id").where("user_id", "=", userId).limit(PURGE_BATCH)).executeTakeFirst()).numDeletedRows));
  await purgeInBatches((transaction) => removed(sql<{ removed: number }>`
    with doomed as (delete from notifications where ctid = any(array(
      select ctid from notifications where user_id = ${userId} union all select ctid from notifications where actor_id = ${userId} limit ${PURGE_BATCH})) returning 1)
    select count(*)::int as removed from doomed`, transaction));
  // Follows in both directions, with the other member's counter.
  await purgeInBatches((transaction) => removed(sql<{ removed: number }>`
    with doomed as (delete from user_follows where ctid = any(array(select ctid from user_follows where followee_id = ${userId} limit ${PURGE_BATCH})) returning follower_id),
    fixed as (update users u set following_count = greatest(0, u.following_count - 1) from doomed where u.id = doomed.follower_id returning 1)
    select count(*)::int as removed from doomed`, transaction));
  await purgeInBatches((transaction) => removed(sql<{ removed: number }>`
    with doomed as (delete from user_follows where ctid = any(array(select ctid from user_follows where follower_id = ${userId} limit ${PURGE_BATCH})) returning followee_id),
    fixed as (update users u set followers_count = greatest(0, u.followers_count - 1) from doomed where u.id = doomed.followee_id returning 1)
    select count(*)::int as removed from doomed`, transaction));
  await purgeInBatches((transaction) => removed(sql<{ removed: number }>`
    with doomed as (delete from connections where id = any(array(
      select id from connections where from_user_id = ${userId} union all select id from connections where to_user_id = ${userId} limit ${PURGE_BATCH}))
      returning status, case when from_user_id = ${userId} then to_user_id else from_user_id end as other_id),
    fixed as (update users u set connections_count = greatest(0, u.connections_count - 1) from doomed where doomed.status = 'accepted' and u.id = doomed.other_id returning 1)
    select count(*)::int as removed from doomed`, transaction));
};

/** The ceiling for the final step, which runs on its own connection without the request pool's 15 s cap. */
const FINAL_STEP_TIMEOUT = "300s";

/**
 * Deletes an account and everything it owns.
 *
 * 1. Its sessions are revoked first, so nothing it still holds can act while
 *    the rest goes (access tokens through the Redis marker).
 * 2. The bulk goes in short batches (`purgeAccountContent`).
 * 3. One last transaction queues the remaining files, settles any counter a
 *    write during step 2 added, and removes the conversations and the
 *    account. The conversations can still be large, so it runs on a
 *    maintenance connection with a five-minute ceiling rather than the
 *    request pool's 15 s.
 *
 * Every step is idempotent: if the request fails part-way, the account still
 * exists, and signing in and deleting again finishes the job.
 */
export const deleteAccountData = async (userId: string): Promise<boolean> => {
  const exists = await database.selectFrom("users").select("id").where("id", "=", userId).executeTakeFirst(); if (!exists) return false;
  const revokedFirst = (await database.updateTable("sessions").set({ revoked_at: new Date() })
    .where("user_id", "=", userId).where("revoked_at", "is", null).returning("id").execute()).map((row) => row.id);
  await markSessionsRevoked(revokedFirst);

  await purgeAccountContent(userId);

  let sessionIds: string[] = [];
  const maintenance = createMaintenanceDatabase();
  try {
    await maintenance.transaction().execute(async (transaction) => {
      await sql`set local statement_timeout = ${sql.lit(FINAL_STEP_TIMEOUT)}`.execute(transaction);
      // Read before the cascade removes them: their access tokens must stop
      // working when the account is gone (NEW-11). A sign-in during step 2
      // opened one of these.
      sessionIds = (await transaction.selectFrom("sessions").select("id").where("user_id", "=", userId).where("revoked_at", "is", null).execute()).map((row) => row.id);
      const user = await transaction.selectFrom("users").select(["profile_picture_key", "cover_photo_key"]).where("id", "=", userId).forUpdate().executeTakeFirst();
      if (!user) return;
      await queueMediaDeletions([user.profile_picture_key, user.cover_photo_key], { transaction });
      await sql`insert into media_deletion_jobs (object_key) select pm.object_key from post_media pm join posts p on p.id = pm.post_id where p.user_id = ${userId} and pm.object_key <> '' on conflict (object_key) do nothing`.execute(transaction);
      await sql`insert into media_deletion_jobs (object_key) select media_key from stories where user_id = ${userId} and media_key <> '' on conflict (object_key) do nothing`.execute(transaction);
      await sql`insert into media_deletion_jobs (object_key) select media_key from messages where (from_user_id = ${userId} or to_user_id = ${userId}) and media_key <> '' on conflict (object_key) do nothing`.execute(transaction);
      await sql`insert into media_deletion_jobs (object_key) select object_key from upload_reservations where user_id = ${userId} on conflict (object_key) do nothing`.execute(transaction);
      // Whatever a write during step 2 added - normally nothing.
      await sql`update posts p set like_count = greatest(0, p.like_count - x.amount) from (select post_id, count(*)::int amount from post_likes where user_id = ${userId} group by post_id) x where p.id = x.post_id and p.user_id <> ${userId}`.execute(transaction);
      await sql`update posts p set comment_count = greatest(0, p.comment_count - x.amount) from (select post_id, count(*)::int amount from post_comments where user_id = ${userId} group by post_id) x where p.id = x.post_id and p.user_id <> ${userId}`.execute(transaction);
      await sql`update users u set followers_count = greatest(0, u.followers_count - 1) where u.id in (select followee_id from user_follows where follower_id = ${userId})`.execute(transaction);
      await sql`update users u set following_count = greatest(0, u.following_count - 1) where u.id in (select follower_id from user_follows where followee_id = ${userId})`.execute(transaction);
      await sql`update users u set connections_count = greatest(0, u.connections_count - 1) where u.id in (select case when from_user_id = ${userId} then to_user_id else from_user_id end from connections where status = 'accepted' and (from_user_id = ${userId} or to_user_id = ${userId}))`.execute(transaction);
      await transaction.deleteFrom("conversations").where("id", "in", transaction.selectFrom("conversation_participants").select("conversation_id").where("user_id", "=", userId)).execute();
      await transaction.deleteFrom("users").where("id", "=", userId).execute();
    });
  } finally {
    await maintenance.destroy();
  }
  // The account's own cached surfaces go directly: its profile, its feed pages
  // and its exercise list (custom exercises went with the cascade). Its posts
  // may sit in any other member's cached feed page, and a deleted account must
  // not keep appearing there, so the author is retracted from all of them.
  await Promise.all([
    invalidateCacheOwners(profileCacheOwner(userId), feedCacheOwner(userId), exerciseListOwner(userId)),
    retractAuthor(userId, "all"),
    markSessionsRevoked(sessionIds),
  ]);
  return true;
};
