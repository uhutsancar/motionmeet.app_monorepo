import type { Db } from "mongodb";
import { connectSources, disconnectSources, idFor, legacyId, postgresPool, type SourceRecord } from "./common.js";

interface CountComparison {
  sourceCollection: string;
  targetTable: string;
  mongoCount: number;
  postgresCount: number;
  matches: boolean;
}

interface IntegrityCheck {
  name: string;
  count: number;
  valid: boolean;
}

const countMappings: Array<[string, string]> = [
  ["plans", "plans"], ["users", "users"], ["equipment", "equipment"], ["musclegroups", "muscle_groups"],
  ["exercises", "exercises"], ["routines", "routines"], ["workouts", "workouts"], ["posts", "posts"],
  ["postlikes", "post_likes"], ["postcomments", "post_comments"], ["stories", "stories"], ["storyviews", "story_views"],
  ["userfollows", "user_follows"], ["connections", "connections"], ["conversations", "conversations"], ["messages", "messages"],
  ["sessions", "sessions"], ["passwordresettokens", "password_reset_tokens"], ["uploadreservations", "upload_reservations"],
  ["mediadeletionjobs", "media_deletion_jobs"], ["usages", "usage_counters"], ["outboxevents", "outbox_events"],
  ["personalrecords", "personal_records"], ["userdailyworkoutstats", "user_daily_workout_stats"],
  ["userexercisedailystats", "user_exercise_daily_stats"],
];

const tablesWithoutLegacyId = new Set(["post_likes", "story_views", "user_follows"]);
const tablesWithSyntheticRows = new Set(["conversations"]);

const compareCounts = async (mongo: Db): Promise<CountComparison[]> => {
  const comparisons: CountComparison[] = [];
  for (const [sourceCollection, targetTable] of countMappings) {
    const countsLegacyRows = !tablesWithoutLegacyId.has(targetTable);
    const [mongoCount, postgresResult] = await Promise.all([
      mongo.collection(sourceCollection).countDocuments({}),
      postgresPool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM "${targetTable}"${countsLegacyRows ? " WHERE legacy_mongo_id IS NOT NULL" : ""}`,
      ),
    ]);
    const postgresCount = Number(postgresResult.rows[0]?.count ?? 0);
    const targetMayContainAdditionalRows = tablesWithoutLegacyId.has(targetTable) || tablesWithSyntheticRows.has(targetTable);
    comparisons.push({
      sourceCollection,
      targetTable,
      mongoCount,
      postgresCount,
      matches: targetMayContainAdditionalRows ? postgresCount >= mongoCount : mongoCount === postgresCount,
    });
  }
  return comparisons;
};

const orphanQueries: Array<[string, string]> = [
  ["users.plan", "SELECT count(*)::int AS count FROM users child LEFT JOIN plans parent ON parent.id = child.plan_id WHERE child.plan_id IS NOT NULL AND parent.id IS NULL"],
  ["exercises.created_by", "SELECT count(*)::int AS count FROM exercises child LEFT JOIN users parent ON parent.id = child.created_by WHERE child.created_by IS NOT NULL AND parent.id IS NULL"],
  ["routine_exercises.exercise", "SELECT count(*)::int AS count FROM routine_exercises child LEFT JOIN exercises parent ON parent.id = child.exercise_id WHERE parent.id IS NULL"],
  ["workout_exercises.exercise", "SELECT count(*)::int AS count FROM workout_exercises child LEFT JOIN exercises parent ON parent.id = child.exercise_id WHERE parent.id IS NULL"],
  ["posts.user", "SELECT count(*)::int AS count FROM posts child LEFT JOIN users parent ON parent.id = child.user_id WHERE parent.id IS NULL"],
  ["posts.workout", "SELECT count(*)::int AS count FROM posts child LEFT JOIN workouts parent ON parent.id = child.workout_id WHERE child.workout_id IS NOT NULL AND parent.id IS NULL"],
  ["post_likes.post", "SELECT count(*)::int AS count FROM post_likes child LEFT JOIN posts parent ON parent.id = child.post_id WHERE parent.id IS NULL"],
  ["post_likes.user", "SELECT count(*)::int AS count FROM post_likes child LEFT JOIN users parent ON parent.id = child.user_id WHERE parent.id IS NULL"],
  ["post_comments.post", "SELECT count(*)::int AS count FROM post_comments child LEFT JOIN posts parent ON parent.id = child.post_id WHERE parent.id IS NULL"],
  ["stories.user", "SELECT count(*)::int AS count FROM stories child LEFT JOIN users parent ON parent.id = child.user_id WHERE parent.id IS NULL"],
  ["messages.conversation", "SELECT count(*)::int AS count FROM messages child LEFT JOIN conversations parent ON parent.id = child.conversation_id WHERE parent.id IS NULL"],
  ["messages.sender", "SELECT count(*)::int AS count FROM messages child LEFT JOIN users parent ON parent.id = child.from_user_id WHERE parent.id IS NULL"],
  ["messages.recipient", "SELECT count(*)::int AS count FROM messages child LEFT JOIN users parent ON parent.id = child.to_user_id WHERE parent.id IS NULL"],
  ["user_follows.self", "SELECT count(*)::int AS count FROM user_follows WHERE follower_id = followee_id"],
  ["connections.self", "SELECT count(*)::int AS count FROM connections WHERE from_user_id = to_user_id"],
  ["messages.self", "SELECT count(*)::int AS count FROM messages WHERE from_user_id = to_user_id"],
];

const runIntegrityChecks = async (): Promise<IntegrityCheck[]> => {
  const checks: IntegrityCheck[] = [];
  for (const [name, query] of orphanQueries) {
    const result = await postgresPool.query<{ count: number }>(query);
    const count = Number(result.rows[0]?.count ?? 0);
    checks.push({ name, count, valid: count === 0 });
  }
  return checks;
};

const verifyUserFields = async (mongo: Db): Promise<IntegrityCheck[]> => {
  let emailMismatches = 0;
  let usernameMismatches = 0;
  let passwordMismatches = 0;
  for await (const user of mongo.collection<SourceRecord>("users").find({})) {
    const result = await postgresPool.query<{ email: string; username: string; password_hash: string }>(
      "SELECT email::text, username::text, password_hash FROM users WHERE id = $1",
      [idFor("users", user._id)],
    );
    const migrated = result.rows[0];
    if (!migrated || migrated.email !== String(user.email).toLowerCase()) emailMismatches += 1;
    if (!migrated || migrated.username !== String(user.username).toLowerCase()) usernameMismatches += 1;
    if (!migrated || migrated.password_hash !== String(user.password)) passwordMismatches += 1;
  }
  return [
    { name: "users.email", count: emailMismatches, valid: emailMismatches === 0 },
    { name: "users.username", count: usernameMismatches, valid: usernameMismatches === 0 },
    { name: "users.password_hash", count: passwordMismatches, valid: passwordMismatches === 0 },
  ];
};

const verifyLegacyMappings = async (mongo: Db): Promise<IntegrityCheck> => {
  let mismatches = 0;
  for (const [collection, table] of countMappings) {
    if (tablesWithoutLegacyId.has(table)) continue;
    const cursor = mongo.collection<SourceRecord>(collection).find({}).sort({ _id: 1 }).limit(25);
    for await (const document of cursor) {
      const result = await postgresPool.query<{ id: string }>(
        `SELECT id::text FROM "${table}" WHERE legacy_mongo_id = $1`,
        [legacyId(document._id)],
      );
      if (!result.rows[0] || result.rows[0].id !== idFor(table, document._id) && table !== "users") mismatches += 1;
    }
  }
  return { name: "legacy_id_samples", count: mismatches, valid: mismatches === 0 };
};

const verifyNaturalKeyEdges = async (mongo: Db): Promise<IntegrityCheck> => {
  let missing = 0;
  const mappings: Array<{
    collection: "postlikes" | "storyviews" | "userfollows";
    query: string;
    values: (document: SourceRecord) => [string, string];
  }> = [
    {
      collection: "postlikes",
      query: "SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2",
      values: (document) => [idFor("posts", document.postId), idFor("users", document.userId)],
    },
    {
      collection: "storyviews",
      query: "SELECT 1 FROM story_views WHERE story_id = $1 AND user_id = $2",
      values: (document) => [idFor("stories", document.storyId), idFor("users", document.userId)],
    },
    {
      collection: "userfollows",
      query: "SELECT 1 FROM user_follows WHERE follower_id = $1 AND followee_id = $2",
      values: (document) => [idFor("users", document.followerId), idFor("users", document.followeeId)],
    },
  ];
  for (const mapping of mappings) {
    for await (const document of mongo.collection<SourceRecord>(mapping.collection).find({})) {
      const result = await postgresPool.query(mapping.query, mapping.values(document));
      if (!result.rows[0]) missing += 1;
    }
  }
  return { name: "natural_key_edges", count: missing, valid: missing === 0 };
};

const verifyMediaKeys = async (mongo: Db): Promise<IntegrityCheck> => {
  let expected = 0;
  for await (const post of mongo.collection<SourceRecord>("posts").find({})) expected += Array.isArray(post.image_keys) ? post.image_keys.filter(Boolean).length : 0;
  for await (const story of mongo.collection<SourceRecord>("stories").find({})) if (story.media_key) expected += 1;
  for await (const message of mongo.collection<SourceRecord>("messages").find({})) if (message.media_key) expected += 1;
  const result = await postgresPool.query<{ count: string }>("SELECT ((SELECT count(*) FROM post_media media JOIN posts post ON post.id = media.post_id WHERE post.legacy_mongo_id IS NOT NULL AND media.object_key <> '') + (SELECT count(*) FROM stories WHERE legacy_mongo_id IS NOT NULL AND media_key <> '') + (SELECT count(*) FROM messages WHERE legacy_mongo_id IS NOT NULL AND media_key <> ''))::text AS count");
  const actual = Number(result.rows[0]?.count ?? 0);
  return { name: "s3_object_keys", count: Math.abs(expected - actual), valid: expected === actual };
};

const main = async (): Promise<void> => {
  const mongo = await connectSources();
  const counts = await compareCounts(mongo);
  const checks = [
    ...(await runIntegrityChecks()),
    ...(await verifyUserFields(mongo)),
    await verifyLegacyMappings(mongo),
    await verifyNaturalKeyEdges(mongo),
    await verifyMediaKeys(mongo),
  ];
  const failedCounts = counts.filter((entry) => !entry.matches);
  const failedChecks = checks.filter((entry) => !entry.valid);
  console.log(JSON.stringify({ verifiedAt: new Date().toISOString(), counts, integrity: checks, valid: failedCounts.length === 0 && failedChecks.length === 0 }, null, 2));
  if (failedCounts.length || failedChecks.length) process.exitCode = 1;
};

try {
  await main();
} finally {
  await disconnectSources();
}
