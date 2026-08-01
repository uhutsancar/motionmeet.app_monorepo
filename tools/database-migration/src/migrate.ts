import type { Db } from "mongodb";
import type { PoolClient } from "pg";
import {
  asArray,
  asBoolean,
  asDate,
  asInteger,
  asNullableDate,
  asNullableString,
  asNumber,
  asRecord,
  asString,
  connectSources,
  disconnectSources,
  idFor,
  legacyId,
  migrateCollection,
  postgresPool,
  upsert,
  type JsonRecord,
  type MigrationStats,
  type SourceRecord,
} from "./common.js";

const enumValue = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => {
  const normalized = asString(value);
  return allowed.includes(normalized as T) ? normalized as T : fallback;
};

const timestamps = (document: SourceRecord): { created_at: Date; updated_at: Date } => ({
  created_at: asDate(document.createdAt, new Date()),
  updated_at: asDate(document.updatedAt, asDate(document.createdAt, new Date())),
});

const referenceId = (domain: string, value: unknown): string | null =>
  value === null || value === undefined || asString(value) === "" ? null : idFor(domain, value);

const embeddedLegacyId = (parent: SourceRecord, kind: string, position: number, value: unknown): string => {
  const explicit = legacyId(asRecord(value)._id);
  return explicit || `${legacyId(parent._id)}:${kind}:${position}`;
};

const migratePlans = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "plans", async (document, client) => {
  const features = asRecord(document.features);
  const planId = idFor("plans", document._id);
  await upsert(client, "plans", {
    id: planId,
    legacy_mongo_id: legacyId(document._id),
    name: asString(document.name, "Unnamed plan").trim(),
    slug: asString(document.slug, legacyId(document._id)).trim().toLowerCase(),
    description: asString(document.description),
    display_order: asInteger(document.displayOrder),
    trial_days: Math.max(0, asInteger(document.trialDays)),
    price: Math.max(0, asNumber(document.price)),
    currency: asString(document.currency, "TRY").slice(0, 8),
    max_workouts_per_month: Math.max(-1, asInteger(features.max_workouts_per_month, 5)),
    max_routines: Math.max(-1, asInteger(features.max_routines, 2)),
    max_posts_per_day: Math.max(-1, asInteger(features.max_posts_per_day, -1)),
    max_stories_per_day: Math.max(-1, asInteger(features.max_stories_per_day, -1)),
    max_media_upload_mb: Math.max(0, asInteger(features.max_media_upload_mb, 20)),
    can_message_anyone: asBoolean(features.can_message_anyone),
    premium_content_access: asBoolean(features.premium_content_access),
    ad_free: asBoolean(features.ad_free),
    priority_support: asBoolean(features.priority_support),
    can_access_analytics: asBoolean(features.can_access_analytics),
    can_create_custom_exercises: asBoolean(features.can_create_custom_exercises, true),
    is_active: asBoolean(document.isActive, true),
    ...timestamps(document),
  }, ["legacy_mongo_id"]);

  for (const cycleValue of asArray(document.billingCycles)) {
    const cycle = asRecord(cycleValue);
    const interval = enumValue(cycle.interval, ["monthly", "yearly"] as const, "monthly");
    await upsert(client, "plan_billing_cycles", {
      plan_id: planId,
      interval,
      price: Math.max(0, asNumber(cycle.price)),
      currency: asString(cycle.currency, "TRY").slice(0, 8),
      stripe_price_id: asString(cycle.stripePriceId),
    }, ["plan_id", "interval"]);
  }
});

const migrateLookup = (mongo: Db, source: "equipment" | "musclegroups", target: "equipment" | "muscle_groups"): Promise<MigrationStats> =>
  migrateCollection(mongo, source, async (document, client) => {
    await upsert(client, target, {
      id: idFor(target, document._id), legacy_mongo_id: legacyId(document._id),
      code: asString(document.code, legacyId(document._id)).trim().toLowerCase(),
      name: asString(document.name, "Unknown").trim(), is_active: asBoolean(document.isActive, true),
      display_order: asInteger(document.order), ...timestamps(document),
    }, ["legacy_mongo_id"]);
  });

const migrateUsers = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "users", async (document, client) => {
  const privacy = asRecord(document.privacy);
  const statistics = asRecord(document.statistics);
  await upsert(client, "users", {
    id: idFor("users", document._id), legacy_mongo_id: legacyId(document._id),
    email: asString(document.email).trim().toLowerCase(), full_name: asString(document.full_name, "MotionMeet User").trim(),
    username: asString(document.username).trim().toLowerCase(), password_hash: asString(document.password),
    bio: asString(document.bio, "Athlete on MotionMeet"), profile_picture_url: asString(document.profile_picture),
    profile_picture_key: asString(document.profile_picture_key), cover_photo_url: asString(document.cover_photo),
    cover_photo_key: asString(document.cover_photo_key), location: asString(document.location),
    role: enumValue(document.role, ["user", "admin", "superadmin"] as const, "user"),
    plan_id: referenceId("plans", document.plan),
    plan_status: enumValue(document.planStatus, ["free", "active", "trialing", "cancelled", "expired"] as const, "free"),
    plan_start_date: asNullableDate(document.planStartDate), plan_end_date: asNullableDate(document.planEndDate),
    plan_cancelled_at: asNullableDate(document.planCancelledAt), stripe_customer_id: asString(document.stripeCustomerId),
    stripe_subscription_id: asString(document.stripeSubscriptionId), weight: Math.max(0, asNumber(document.weight)),
    height: Math.max(0, asNumber(document.height)), followers_count: Math.max(0, asInteger(document.followers_count)),
    following_count: Math.max(0, asInteger(document.following_count)), connections_count: Math.max(0, asInteger(document.connections_count)),
    privacy_public_profile: asBoolean(privacy.publicProfile, true), privacy_show_workouts_on_feed: asBoolean(privacy.showWorkoutsOnFeed, true),
    privacy_allow_followers: asBoolean(privacy.allowFollowers, true), privacy_show_in_search: asBoolean(privacy.showInSearch, true),
    privacy_allow_messages: asBoolean(privacy.allowMessages, true), total_workouts: Math.max(0, asInteger(statistics.totalWorkouts)),
    total_duration_minutes: Math.max(0, asInteger(statistics.totalDurationMinutes)), total_volume_kg: Math.max(0, asNumber(statistics.totalVolumeKg)),
    ...timestamps(document),
  }, ["legacy_mongo_id"]);
});

const migrateExercises = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "exercises", async (document, client) => {
  const exerciseId = idFor("exercises", document._id);
  const name = asString(document.name, "Exercise").trim();
  await upsert(client, "exercises", {
    id: exerciseId, legacy_mongo_id: legacyId(document._id), external_id: asNullableString(document.externalId), name,
    name_normalized: asString(document.nameNormalized, name.toLocaleLowerCase("en-US")), muscle_group: asString(document.muscleGroup, "Other"),
    target: asString(document.target), category: asString(document.category), equipment: asString(document.equipment, "Body Weight"),
    image_url: asString(document.imageUrl), image_key: asString(document.imageKey), gif_url: asString(document.gifUrl), gif_key: asString(document.gifKey),
    is_custom: asBoolean(document.isCustom), created_by: referenceId("users", document.createdBy), ...timestamps(document),
  }, ["legacy_mongo_id"]);
  await client.query("DELETE FROM exercise_secondary_muscles WHERE exercise_id = $1", [exerciseId]);
  for (const [position, muscle] of asArray(document.secondary_muscles).entries()) {
    const nameValue = asString(muscle).trim();
    if (nameValue) await upsert(client, "exercise_secondary_muscles", { exercise_id: exerciseId, muscle: nameValue, position }, ["exercise_id", "position"]);
  }
  const instructions = asRecord(document.instructions);
  const steps = asRecord(document.instructionSteps);
  const languages = new Set([...Object.keys(instructions), ...Object.keys(steps)]);
  for (const language of languages) {
    await upsert(client, "exercise_instructions", {
      exercise_id: exerciseId, language: language.slice(0, 16), summary: asString(instructions[language]),
      steps: asArray(steps[language]).map((step) => asString(step)),
    }, ["exercise_id", "language"]);
  }
});

const migrateExerciseContainer = async (
  document: SourceRecord,
  client: PoolClient,
  kind: "routine" | "workout",
): Promise<void> => {
  const parentTable = kind === "routine" ? "routines" : "workouts";
  const parentDomain = parentTable;
  const parentId = idFor(parentDomain, document._id);
  if (kind === "routine") {
    await upsert(client, parentTable, {
      id: parentId, legacy_mongo_id: legacyId(document._id), user_id: idFor("users", document.userId),
      operation_id: asNullableString(document.operationId), name: asString(document.name, "Routine").trim(),
      folder: asString(document.folder), ...timestamps(document),
    }, ["legacy_mongo_id"]);
  } else {
    await upsert(client, parentTable, {
      id: parentId, legacy_mongo_id: legacyId(document._id), user_id: idFor("users", document.userId),
      operation_id: asNullableString(document.operationId), name: asString(document.name, "Workout").trim(),
      start_time: asDate(document.startTime, asDate(document.createdAt, new Date())), end_time: asNullableDate(document.endTime),
      duration_minutes: Math.max(0, asInteger(document.durationMinutes)), volume_kg: Math.max(0, asNumber(document.volumeKg)),
      total_sets: Math.max(0, asInteger(document.totalSets)), total_reps: Math.max(0, asNumber(document.totalReps)),
      metrics_version: asInteger(document.metricsVersion, 2), ...timestamps(document),
    }, ["legacy_mongo_id"]);
  }
  const exerciseTable = kind === "routine" ? "routine_exercises" : "workout_exercises";
  const setTable = kind === "routine" ? "routine_sets" : "workout_sets";
  await client.query(`DELETE FROM ${exerciseTable} WHERE ${kind}_id = $1`, [parentId]);
  for (const [position, exerciseValue] of asArray(document.exercises).entries()) {
    const exercise = asRecord(exerciseValue);
    const exerciseLegacy = embeddedLegacyId(document, `${kind}-exercise`, position, exerciseValue);
    const childId = idFor(exerciseTable, exerciseLegacy);
    const exerciseReference = asRecord(exercise.exerciseId)._id ?? exercise.exerciseId;
    await upsert(client, exerciseTable, {
      id: childId, legacy_mongo_id: exerciseLegacy.slice(0, 64), [`${kind}_id`]: parentId,
      exercise_id: idFor("exercises", exerciseReference), position, exercise_name: asString(exercise.exerciseName),
      muscle_group: asString(exercise.muscleGroup), equipment: asString(exercise.equipment), ...timestamps(document),
    }, [`${kind}_id`, "position"]);
    for (const [setPosition, setValue] of asArray(exercise.sets).entries()) {
      const set = asRecord(setValue);
      const setLegacy = embeddedLegacyId(document, `${kind}-set-${position}`, setPosition, setValue);
      await upsert(client, setTable, {
        id: idFor(setTable, setLegacy), legacy_mongo_id: setLegacy.slice(0, 64), [`${kind}_exercise_id`]: childId,
        position: setPosition, set_type: enumValue(set.setType, ["normal", "warmup", "drop", "failure"] as const, "normal"),
        reps: Math.max(0, asInteger(set.reps)), weight: Math.max(0, asNumber(set.weight)), completed: asBoolean(set.completed),
        ...timestamps(document),
      }, [`${kind}_exercise_id`, "position"]);
    }
  }
};

const migrateRoutines = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "routines", (document, client) => migrateExerciseContainer(document, client, "routine"), 100);
const migrateWorkouts = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "workouts", (document, client) => migrateExerciseContainer(document, client, "workout"), 100);

const migratePosts = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "posts", async (document, client) => {
  const postId = idFor("posts", document._id);
  const author = asRecord(document.author_profile);
  await upsert(client, "posts", {
    id: postId, legacy_mongo_id: legacyId(document._id), user_id: idFor("users", document.user),
    operation_id: asNullableString(document.operationId), author_full_name: asString(author.full_name), author_username: asString(author.username),
    author_profile_picture: asString(author.profile_picture), content: asString(document.content),
    post_type: enumValue(document.post_type, ["text", "image", "text_with_image", "video", "workout"] as const, "text"),
    visibility: enumValue(document.visibility, ["public", "followers", "private"] as const, "public"),
    like_count: Math.max(0, asInteger(document.like_count)), comment_count: Math.max(0, asInteger(document.comment_count)),
    share_count: Math.max(0, asInteger(document.share_count)), download_count: Math.max(0, asInteger(document.download_count)),
    workout_id: referenceId("workouts", document.workout), ...timestamps(document),
  }, ["legacy_mongo_id"]);
  await client.query("DELETE FROM post_media WHERE post_id = $1", [postId]);
  const urls = asArray(document.image_urls);
  const keys = asArray(document.image_keys);
  for (const [position, urlValue] of urls.entries()) {
    const url = asString(urlValue);
    await upsert(client, "post_media", {
      id: idFor("post_media", `${legacyId(document._id)}:${position}`), legacy_mongo_id: null, post_id: postId, position, url,
      object_key: asString(keys[position]), media_type: url.match(/\.(mp4|webm|mov)(\?|$)/i) ? "video" : "image",
      mime_type: "", file_size: null, width: null, height: null, duration_seconds: null, ...timestamps(document),
    }, ["post_id", "position"]);
  }
});

const migrateStories = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "stories", async (document, client) => {
  await upsert(client, "stories", {
    id: idFor("stories", document._id), legacy_mongo_id: legacyId(document._id), user_id: idFor("users", document.user),
    operation_id: asNullableString(document.operationId), content: asString(document.content), media_url: asString(document.media_url),
    media_key: asString(document.media_key), media_type: enumValue(document.media_type, ["text", "image", "video"] as const, asString(document.media_url) ? "image" : "text"),
    background_color: asString(document.background_color), expires_at: asDate(document.expiresAt, new Date(Date.now() + 86_400_000)), ...timestamps(document),
  }, ["legacy_mongo_id"]);
});

const migrateFollows = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "userfollows", async (document, client) => {
  await upsert(client, "user_follows", {
    follower_id: idFor("users", document.followerId), followee_id: idFor("users", document.followeeId), ...timestamps(document),
  }, ["follower_id", "followee_id"]);
});

const migrateConnections = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "connections", async (document, client) => {
  const from = idFor("users", document.from_user_id);
  const to = idFor("users", document.to_user_id);
  await upsert(client, "connections", {
    id: idFor("connections", document._id), legacy_mongo_id: legacyId(document._id), from_user_id: from, to_user_id: to,
    pair_key: [from, to].sort().join(":"), status: enumValue(document.status, ["pending", "accepted"] as const, "pending"),
    ...timestamps(document),
  }, ["legacy_mongo_id"]);
});

const migrateConversations = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "conversations", async (document, client) => {
  const participants = asArray(document.participants).map((value) => idFor("users", value));
  if (participants.length !== 2 || participants[0] === participants[1]) throw new Error("Conversation participants must contain two distinct users");
  participants.sort();
  const conversationId = idFor("conversations", document._id);
  await upsert(client, "conversations", {
    id: conversationId, legacy_mongo_id: legacyId(document._id), pair_key: participants.join(":"),
    last_message_id: null, last_message_at: asNullableDate(document.lastMessageAt), ...timestamps(document),
  }, ["legacy_mongo_id"]);
  const unread = asRecord(document.unreadByUser);
  for (const userId of participants) {
    const legacyUser = asArray(document.participants).find((value) => idFor("users", value) === userId);
    await upsert(client, "conversation_participants", {
      conversation_id: conversationId, user_id: userId, unread_count: Math.max(0, asInteger(unread[legacyId(legacyUser)])), joined_at: asDate(document.createdAt, new Date()),
    }, ["conversation_id", "user_id"]);
  }
});

const ensureConversationForMessage = async (document: SourceRecord, client: PoolClient): Promise<string> => {
  if (document.conversationId) return idFor("conversations", document.conversationId);
  const from = idFor("users", document.from_user_id);
  const to = idFor("users", document.to_user_id);
  const pair = [from, to].sort();
  const syntheticLegacy = `pair:${pair.join(":")}`;
  const conversationId = idFor("conversations", syntheticLegacy);
  await upsert(client, "conversations", {
    id: conversationId, legacy_mongo_id: syntheticLegacy.slice(0, 64), pair_key: pair.join(":"), last_message_id: null,
    last_message_at: asDate(document.createdAt, new Date()), ...timestamps(document),
  }, ["pair_key"]);
  for (const userId of pair) await upsert(client, "conversation_participants", { conversation_id: conversationId, user_id: userId, unread_count: 0, joined_at: asDate(document.createdAt, new Date()) }, ["conversation_id", "user_id"]);
  return conversationId;
};

const migrateMessages = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "messages", async (document, client) => {
  const conversationId = await ensureConversationForMessage(document, client);
  await upsert(client, "messages", {
    id: idFor("messages", document._id), legacy_mongo_id: legacyId(document._id), conversation_id: conversationId,
    operation_id: asNullableString(document.operationId), from_user_id: idFor("users", document.from_user_id), to_user_id: idFor("users", document.to_user_id),
    text: asString(document.text), message_type: enumValue(document.message_type, ["text", "image"] as const, asString(document.media_url) ? "image" : "text"),
    media_url: asString(document.media_url), media_key: asString(document.media_key), seen: asBoolean(document.seen), ...timestamps(document),
  }, ["legacy_mongo_id"]);
});

const migrateSimpleEdge = (
  mongo: Db,
  collection: "postlikes" | "postcomments" | "storyviews",
): Promise<MigrationStats> => migrateCollection(mongo, collection, async (document, client) => {
  if (collection === "postlikes") {
    await upsert(client, "post_likes", { post_id: idFor("posts", document.postId), user_id: idFor("users", document.userId), created_at: asDate(document.createdAt, new Date()) }, ["post_id", "user_id"]);
  } else if (collection === "postcomments") {
    await upsert(client, "post_comments", { id: idFor("post_comments", document._id), legacy_mongo_id: legacyId(document._id), post_id: idFor("posts", document.postId), user_id: idFor("users", document.userId), content: asString(document.content).trim(), ...timestamps(document) }, ["legacy_mongo_id"]);
  } else {
    await upsert(client, "story_views", { story_id: idFor("stories", document.storyId), user_id: idFor("users", document.userId), created_at: asDate(document.createdAt, new Date()) }, ["story_id", "user_id"]);
  }
});

const migrateSessions = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "sessions", async (document, client) => {
  await upsert(client, "sessions", { id: idFor("sessions", document._id), legacy_mongo_id: legacyId(document._id), user_id: idFor("users", document.userId), token_hash: asString(document.tokenHash), expires_at: asDate(document.expiresAt), revoked_at: asNullableDate(document.revokedAt), last_used_at: asDate(document.lastUsedAt, asDate(document.createdAt, new Date())), user_agent: asString(document.userAgent), ip_address: asString(document.ipAddress), ...timestamps(document) }, ["legacy_mongo_id"]);
});

const migrateResetTokens = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "passwordresettokens", async (document, client) => {
  await upsert(client, "password_reset_tokens", { id: idFor("password_reset_tokens", document._id), legacy_mongo_id: legacyId(document._id), user_id: idFor("users", document.userId), token_hash: asString(document.tokenHash), expires_at: asDate(document.expiresAt), consumed_at: asNullableDate(document.consumedAt), ...timestamps(document) }, ["legacy_mongo_id"]);
});

const migrateReservations = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "uploadreservations", async (document, client) => {
  await upsert(client, "upload_reservations", { id: idFor("upload_reservations", document._id), legacy_mongo_id: legacyId(document._id), object_key: asString(document.key), user_id: idFor("users", document.userId), purpose: enumValue(document.purpose, ["profiles", "covers", "posts", "stories", "messages"] as const, "posts"), content_type: asString(document.contentType), max_bytes: Math.max(1, asInteger(document.maxBytes, 1)), expires_at: asDate(document.expiresAt), ...timestamps(document) }, ["legacy_mongo_id"]);
});

const migrateUsage = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "usages", async (document, client) => {
  await upsert(client, "usage_counters", { id: idFor("usage_counters", document._id), legacy_mongo_id: legacyId(document._id), user_id: idFor("users", document.userId), bucket: asString(document.bucket).slice(0, 64), count: Math.max(0, asInteger(document.count)), expires_at: asNullableDate(document.expiresAt), ...timestamps(document) }, ["legacy_mongo_id"]);
});

const migrateDeletionJobs = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "mediadeletionjobs", async (document, client) => {
  await upsert(client, "media_deletion_jobs", { id: idFor("media_deletion_jobs", document._id), legacy_mongo_id: legacyId(document._id), object_key: asString(document.key), attempts: Math.max(0, asInteger(document.attempts)), next_attempt_at: asDate(document.nextAttemptAt, new Date()), last_error: asString(document.lastError).slice(0, 500), claim_token: referenceId("claims", document.claimToken), claim_until: asNullableDate(document.claimUntil), ...timestamps(document) }, ["legacy_mongo_id"]);
});

const migrateOutbox = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "outboxevents", async (document, client) => {
  await upsert(client, "outbox_events", { id: idFor("outbox_events", document._id), legacy_mongo_id: legacyId(document._id), type: enumValue(document.type, ["user.profile.updated", "connection.requested"] as const, "user.profile.updated"), aggregate_id: asString(document.aggregateId).slice(0, 128), payload: asRecord(document.payload), status: enumValue(document.status, ["pending", "processing"] as const, "pending"), attempts: Math.max(0, asInteger(document.attempts)), next_attempt_at: asDate(document.nextAttemptAt, new Date()), claim_token: referenceId("claims", document.claimToken), claim_until: asNullableDate(document.claimUntil), last_error: asString(document.lastError).slice(0, 500), ...timestamps(document) }, ["legacy_mongo_id"]);
});

const migratePersonalRecords = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "personalrecords", async (document, client) => {
  await upsert(client, "personal_records", { id: idFor("personal_records", document._id), legacy_mongo_id: legacyId(document._id), user_id: idFor("users", document.userId), exercise_id: idFor("exercises", document.exerciseId), exercise_name: asString(document.exerciseName, "Exercise"), value: Math.max(0, asNumber(document.value)), reps: Math.max(0, asInteger(document.reps)), recorded_at: asDate(document.recordedAt), workout_id: idFor("workouts", document.workoutId), ...timestamps(document) }, ["legacy_mongo_id"]);
});

const migrateDailyWorkoutStats = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "userdailyworkoutstats", async (document, client) => {
  const statId = idFor("user_daily_workout_stats", document._id);
  await upsert(client, "user_daily_workout_stats", { id: statId, legacy_mongo_id: legacyId(document._id), user_id: idFor("users", document.userId), date_key: asString(document.dateKey).slice(0, 10), date: asDate(document.date), total_workouts: Math.max(0, asInteger(document.totalWorkouts)), total_duration_minutes: Math.max(0, asInteger(document.totalDurationMinutes)), total_volume_kg: Math.max(0, asNumber(document.totalVolumeKg)), total_sets: Math.max(0, asInteger(document.totalSets)), total_reps: Math.max(0, asNumber(document.totalReps)), ...timestamps(document) }, ["legacy_mongo_id"]);
  const muscles = asRecord(document.muscleSets);
  for (const [muscle, count] of Object.entries(muscles)) await upsert(client, "user_daily_muscle_stats", { daily_stat_id: statId, muscle, set_count: Math.max(0, asInteger(count)) }, ["daily_stat_id", "muscle"]);
});

const migrateExerciseDailyStats = (mongo: Db): Promise<MigrationStats> => migrateCollection(mongo, "userexercisedailystats", async (document, client) => {
  await upsert(client, "user_exercise_daily_stats", { id: idFor("user_exercise_daily_stats", document._id), legacy_mongo_id: legacyId(document._id), user_id: idFor("users", document.userId), date_key: asString(document.dateKey).slice(0, 10), date: asDate(document.date), exercise_id: idFor("exercises", document.exerciseId), exercise_name: asString(document.exerciseName, "Exercise"), muscle_group: asString(document.muscleGroup), total_volume_kg: Math.max(0, asNumber(document.totalVolumeKg)), total_reps: Math.max(0, asNumber(document.totalReps)), total_sets: Math.max(0, asInteger(document.totalSets)), total_sessions: Math.max(0, asInteger(document.totalSessions)), max_weight: Math.max(0, asNumber(document.maxWeight)), ...timestamps(document) }, ["legacy_mongo_id"]);
});

const reconcileDerivedData = async (mongo: Db): Promise<void> => {
  await postgresPool.query("UPDATE users SET followers_count = counts.value FROM (SELECT followee_id AS id, count(*)::int AS value FROM user_follows GROUP BY followee_id) counts WHERE users.id = counts.id");
  await postgresPool.query("UPDATE users SET following_count = counts.value FROM (SELECT follower_id AS id, count(*)::int AS value FROM user_follows GROUP BY follower_id) counts WHERE users.id = counts.id");
  await postgresPool.query("UPDATE users SET connections_count = counts.value FROM (SELECT id, count(*)::int AS value FROM (SELECT from_user_id AS id FROM connections WHERE status = 'accepted' UNION ALL SELECT to_user_id AS id FROM connections WHERE status = 'accepted') edges GROUP BY id) counts WHERE users.id = counts.id");
  await postgresPool.query("UPDATE posts SET like_count = counts.value FROM (SELECT post_id, count(*)::int AS value FROM post_likes GROUP BY post_id) counts WHERE posts.id = counts.post_id");
  await postgresPool.query("UPDATE posts SET comment_count = counts.value FROM (SELECT post_id, count(*)::int AS value FROM post_comments GROUP BY post_id) counts WHERE posts.id = counts.post_id");
  const cursor = mongo.collection<SourceRecord>("conversations").find({ lastMessage: { $ne: null } });
  for await (const conversation of cursor) {
    await postgresPool.query("UPDATE conversations SET last_message_id = $1 WHERE legacy_mongo_id = $2", [idFor("messages", conversation.lastMessage), legacyId(conversation._id)]);
  }
};

const main = async (): Promise<void> => {
  const mongo = await connectSources();
  const report: Record<string, MigrationStats> = {};
  const stages: Array<[string, () => Promise<MigrationStats>]> = [
    ["plans", () => migratePlans(mongo)], ["equipment", () => migrateLookup(mongo, "equipment", "equipment")],
    ["musclegroups", () => migrateLookup(mongo, "musclegroups", "muscle_groups")], ["users", () => migrateUsers(mongo)],
    ["exercises", () => migrateExercises(mongo)], ["routines", () => migrateRoutines(mongo)], ["workouts", () => migrateWorkouts(mongo)],
    ["posts", () => migratePosts(mongo)], ["stories", () => migrateStories(mongo)], ["userfollows", () => migrateFollows(mongo)],
    ["connections", () => migrateConnections(mongo)], ["conversations", () => migrateConversations(mongo)], ["messages", () => migrateMessages(mongo)],
    ["postlikes", () => migrateSimpleEdge(mongo, "postlikes")], ["postcomments", () => migrateSimpleEdge(mongo, "postcomments")],
    ["storyviews", () => migrateSimpleEdge(mongo, "storyviews")], ["sessions", () => migrateSessions(mongo)],
    ["passwordresettokens", () => migrateResetTokens(mongo)], ["uploadreservations", () => migrateReservations(mongo)],
    ["usages", () => migrateUsage(mongo)], ["mediadeletionjobs", () => migrateDeletionJobs(mongo)], ["outboxevents", () => migrateOutbox(mongo)],
    ["personalrecords", () => migratePersonalRecords(mongo)], ["userdailyworkoutstats", () => migrateDailyWorkoutStats(mongo)],
    ["userexercisedailystats", () => migrateExerciseDailyStats(mongo)],
  ];
  for (const [name, migrate] of stages) {
    report[name] = await migrate();
    console.log(`${name}: read=${report[name].read} migrated=${report[name].migrated} errors=${report[name].errors.length}`);
  }
  await reconcileDerivedData(mongo);
  const errorCount = Object.values(report).reduce((sum, stats) => sum + stats.errors.length, 0);
  console.log(JSON.stringify({ completedAt: new Date().toISOString(), errorCount, collections: report }, null, 2));
  if (errorCount > 0) process.exitCode = 1;
};

try {
  await main();
} finally {
  await disconnectSources();
}
