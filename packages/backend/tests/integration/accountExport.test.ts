import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { Writable } from "node:stream";
import test from "node:test";
import express from "express";
import { sql } from "kysely";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { streamAccountData } from "../../services/accountService.js";
import { createExercise } from "../../services/exerciseService.js";
import { createWorkoutWithStatistics } from "../../services/workoutService.js";
import { createRoutine } from "../../services/routineService.js";
import { createPost } from "../../services/postService.js";
import { createStory } from "../../services/storyService.js";
import { createMessage } from "../../services/messageService.js";
import { requestFollow } from "../../services/relationshipService.js";
import { updateUser } from "../../services/userService.js";
import { saveMeasurement } from "../../services/measurementService.js";
import { savePosition } from "../../services/nearbyService.js";
import { exportAccount } from "../../controllers/userController.js";
import { errorHandler } from "../../middlewares/errorHandler.js";

/**
 * The account export (WP-04 of the 2026-11 audit) against a real PostgreSQL:
 * a complete, parseable file with every section the member owns; nothing that
 * is ours rather than theirs; bounded memory; and a failure that breaks the
 * download instead of handing over a short file with a 200.
 */
const runId = randomUUID().slice(0, 8);
const userIds: string[] = [];
const newUser = async (name: string): Promise<string> => {
  const row = await database.insertInto("users").values({
    legacy_mongo_id: null, email: `${name}-${runId}@example.test`, full_name: `${name} member`,
    username: `${name}_${runId}`, password_hash: "test-hash-should-never-be-exported",
  }).returning("id").executeTakeFirstOrThrow();
  userIds.push(row.id);
  return row.id;
};

interface ExportFile { complete?: boolean; formatVersion?: number; user: Record<string, unknown>; [section: string]: unknown }
const memorySink = (): { sink: Writable; body: () => string } => {
  const chunks: string[] = [];
  return { sink: new Writable({ write(chunk, _encoding, callback) { chunks.push(chunk.toString()); callback(); } }), body: () => chunks.join("") };
};
const exportOf = async (userId: string): Promise<{ text: string; file: ExportFile }> => {
  const { sink, body } = memorySink();
  assert.equal(await streamAccountData(userId, sink as never), true);
  const text = body();
  return { text, file: JSON.parse(text) as ExportFile };
};
const activeAppQueries = async (): Promise<number> => Number((await sql<{ count: string }>`
  select count(*)::text as count from pg_stat_activity
  where application_name like 'motionmeet-%' and state = 'active' and pid <> pg_backend_pid()`.execute(database)).rows[0]?.count ?? 0);

test.before(async () => { await connectDatabase(); });
test.after(async () => {
  if (userIds.length) await database.deleteFrom("users").where("id", "in", userIds).execute();
  await disconnectDatabase();
});

test("an empty account exports as complete, valid JSON in format 4", async () => {
  const user = await newUser("emptyexp");
  const { file } = await exportOf(user);
  assert.equal(file.complete, true);
  assert.equal(file.formatVersion, 4);
  assert.equal(file.user.id, user);
  for (const name of ["workouts", "routines", "posts", "messages", "followers", "following", "notifications", "bodyMeasurements", "nearby", "customExercises", "dailyMuscleStats"]) {
    assert.deepEqual(file[name], [], name);
  }
});

test("a full account exports every section with its nested details and nothing that is not the member's", async () => {
  const owner = await newUser("fullexp");
  const friend = await newUser("friendexp");
  const locked = await newUser("lockedexp");
  const fan = await newUser("fanexp");
  await updateUser(locked, { "privacy.publicProfile": false });

  const exercise = await createExercise({ name: `Audit press ${runId}`, muscleGroup: "Chest", equipment: "Barbell", secondary_muscles: ["Triceps"], userId: owner });
  const sets = [{ reps: 8, weight: 60, completed: true }, { reps: 8, weight: 62.5, completed: true }, { reps: 6, weight: 65, completed: true }];
  const now = Date.now();
  await createWorkoutWithStatistics({
    userId: owner, operationId: randomUUID(), name: "Push day", startTime: new Date(now - 3_600_000), endTime: new Date(now),
    durationMinutes: 60, volumeKg: 1_000, totalSets: 6, totalReps: 44, metricsVersion: 1,
    exercises: [
      { exerciseId: exercise.id, exerciseName: "Audit press", muscleGroup: "Chest", equipment: "Barbell", sets },
      { exerciseId: exercise.id, exerciseName: "Audit press", muscleGroup: "Chest", equipment: "Barbell", sets },
    ],
  });
  await createRoutine({ userId: owner, operationId: randomUUID(), name: "Routine A", folder: "", exercises: [{ exerciseId: exercise.id, exerciseName: "Audit press", muscleGroup: "Chest", equipment: "Barbell", sets }] });
  await createPost({
    user: owner, operationId: randomUUID(), content: "with photos", post_type: "image", visibility: "public",
    media: [
      { url: "https://ik.imagekit.io/test/posts/a.jpg", key: `posts/${owner}/a.jpg`, contentType: "image/jpeg", sizeBytes: 1_000 },
      { url: "https://ik.imagekit.io/test/posts/b.jpg", key: `posts/${owner}/b.jpg`, contentType: "image/jpeg", sizeBytes: 2_000 },
    ],
  } as never);
  await createStory({ user: owner, operationId: randomUUID(), content: "story", media_url: "", media_key: "", media_type: "text", background_color: "#000000", overlays: [] });
  await createMessage({ from_user_id: owner, to_user_id: friend, operationId: randomUUID(), text: "hello", message_type: "text", media_url: "", media_key: "" });
  await requestFollow(owner, friend); // public: a follow edge
  await requestFollow(fan, owner); // public: a follower, and a "follow" notification for the owner
  await requestFollow(owner, locked); // private: a request, and a notification for `locked`
  await saveMeasurement(owner, { measuredOn: "2026-11-01", weight_kg: 80.5 });
  await savePosition(owner, { latitude: 41.01, longitude: 28.97, accuracy: 12 });

  const { text, file } = await exportOf(owner);
  assert.equal(file.complete, true);

  const workouts = file.workouts as Array<{ exercises: Array<{ sets: Array<{ reps: number }> }> }>;
  assert.equal(workouts.length, 1);
  assert.equal(workouts[0]!.exercises.length, 2);
  assert.equal(workouts[0]!.exercises[0]!.sets.length, 3);
  assert.equal(workouts[0]!.exercises[0]!.sets[0]!.reps, 8);
  const routines = file.routines as Array<{ exercises: Array<{ sets: unknown[] }> }>;
  assert.equal(routines.length, 1);
  assert.equal(routines[0]!.exercises[0]!.sets.length, 3);
  const posts = file.posts as Array<{ media: Array<{ url: string }> }>;
  assert.equal(posts.length, 1);
  assert.equal(posts[0]!.media.length, 2);
  assert.equal((file.stories as unknown[]).length, 1);
  assert.equal((file.messages as unknown[]).length, 1);
  assert.equal((file.conversations as unknown[]).length, 1);
  assert.deepEqual((file.following as Array<{ user_id: string }>).map((row) => row.user_id), [friend]);
  assert.deepEqual((file.followers as Array<{ user_id: string }>).map((row) => row.user_id), [fan]);
  assert.deepEqual((file.followRequestsSent as Array<{ user_id: string }>).map((row) => row.user_id), [locked]);
  assert.equal((file.notifications as unknown[]).length, 1);
  assert.equal((file.bodyMeasurements as unknown[]).length, 1);
  const nearby = file.nearby as Array<{ latitude: number }>;
  assert.equal(nearby.length, 1, "the member's own location is theirs to export (D-05)");
  assert.equal(nearby[0]!.latitude, 41.01);
  const custom = file.customExercises as Array<{ secondary_muscles: string[] }>;
  assert.equal(custom.length, 1);
  assert.deepEqual(custom[0]!.secondary_muscles, ["Triceps"]);
  assert.ok((file.personalRecords as unknown[]).length >= 1);
  assert.ok((file.dailyMuscleStats as unknown[]).length >= 1);

  for (const secret of ["password_hash", "test-hash-should-never-be-exported", "token_hash", "media_key", "object_key", "profile_picture_key", "cover_photo_key", `posts/${owner}/a.jpg`]) {
    assert.ok(!text.includes(secret), `the export must not contain ${secret}`);
  }
  // Other members appear by id and username only.
  assert.ok(!text.includes(`friendexp-${runId}@example.test`));
});

test("a large account exports page by page instead of holding it all in memory", async () => {
  const owner = await newUser("bigexp");
  const other = await newUser("bigother");
  const pair = [owner, other].sort().join(":");
  const conversation = await database.insertInto("conversations").values({ pair_key: pair }).returning("id").executeTakeFirstOrThrow();
  await database.insertInto("conversation_participants").values([{ conversation_id: conversation.id, user_id: owner }, { conversation_id: conversation.id, user_id: other }]).execute();
  await sql`insert into messages (conversation_id, from_user_id, to_user_id, text, message_type)
    select ${conversation.id}::uuid, ${owner}::uuid, ${other}::uuid, repeat('x', 400) || g, 'text' from generate_series(1, 5000) g`.execute(database);
  await sql`insert into posts (user_id, author_full_name, author_username, content, post_type, visibility)
    select ${other}::uuid, 'bigother member', 'bigother', 'p' || g, 'text', 'public' from generate_series(1, 2000) g`.execute(database);
  await sql`insert into post_likes (post_id, user_id) select id, ${owner}::uuid from posts where user_id = ${other}::uuid`.execute(database);

  global.gc?.();
  const baseline = process.memoryUsage().heapUsed;
  let peak = baseline;
  let bytes = 0;
  let tail = "";
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      bytes += chunk.length;
      tail = (tail + chunk.toString()).slice(-64);
      peak = Math.max(peak, process.memoryUsage().heapUsed);
      callback();
    },
  });
  assert.equal(await streamAccountData(owner, sink as never), true);
  assert.ok(bytes > 2_000_000, "the export carries the messages");
  assert.ok(tail.endsWith(`"complete":true}`));
  assert.ok(peak - baseline < 50 * 1024 * 1024, `heap grew by ${Math.round((peak - baseline) / 1024 / 1024)} MB`);
});

test("a client that goes away mid-export stops it and leaves no query running", async () => {
  const owner = await newUser("cancelexp");
  const other = await newUser("cancelother");
  await sql`insert into posts (user_id, author_full_name, author_username, content, post_type, visibility)
    select ${other}::uuid, 'cancelother member', 'cancelother', 'p' || g, 'text', 'public' from generate_series(1, 1500) g`.execute(database);
  await sql`insert into post_likes (post_id, user_id) select id, ${owner}::uuid from posts where user_id = ${other}::uuid`.execute(database);
  let writes = 0;
  const sink = new Writable({
    write(_chunk, _encoding, callback) {
      writes += 1;
      if (writes === 3) this.destroy();
      callback();
    },
  });
  await assert.rejects(streamAccountData(owner, sink as never), /closed/);
  assert.equal(await activeAppQueries(), 0, "every pooled connection is back and idle");
});

test("a failure after the download started breaks the connection instead of finishing a short file", async () => {
  const owner = await newUser("failexp");
  const app = express();
  app.get("/export", (request, _response, next) => { request.userId = owner; next(); }, exportAccount);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  // `routines` is the second section: the first is written, then its query fails.
  await sql`alter table routines rename to routines_audit_hidden`.execute(database);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/export`);
    assert.equal(response.status, 200, "headers were already sent when the failure happened");
    await assert.rejects(response.text(), "the body must end in a network error, not a clean end of file");
  } finally {
    await sql`alter table routines_audit_hidden rename to routines`.execute(database);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("a failure before anything was written is an ordinary error response", async () => {
  const owner = await newUser("earlyexp");
  const app = express();
  app.get("/export", (request, _response, next) => { request.userId = owner; next(); }, exportAccount);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  // `workouts` is the first section, read before the first byte goes out.
  await sql`alter table workouts rename to workouts_audit_hidden`.execute(database);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/export`);
    assert.equal(response.status, 500);
    const body = await response.json() as { success: boolean };
    assert.equal(body.success, false);
  } finally {
    await sql`alter table workouts_audit_hidden rename to workouts`.execute(database);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
