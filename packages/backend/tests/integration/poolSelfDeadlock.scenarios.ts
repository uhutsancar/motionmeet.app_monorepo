import "./testDatabase.js";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { createStory } from "../../services/storyService.js";
import { createPost } from "../../services/postService.js";
import { createMessage } from "../../services/messageService.js";
import { createWorkoutWithStatistics } from "../../services/workoutService.js";
import { createRoutine } from "../../services/routineService.js";
import { updateUser } from "../../services/userService.js";
import { deleteAccountData } from "../../services/accountService.js";
import { acceptFollowRequest, requestFollow } from "../../services/relationshipService.js";
import { createPostComment, likePost } from "../../services/postInteractionService.js";

/**
 * Run by poolSelfDeadlock.test.ts in a child process started with
 * DATABASE_POOL_MAX=1. Not a test file itself (the integration glob only picks
 * up `*.test.ts`).
 *
 * With one pooled connection, a transaction that asks the global `database`
 * for a second connection waits for itself until the connection timeout. Each
 * write path below runs once and reports how long it took and whether it
 * failed; the parent asserts on the report.
 */
if (process.env.DATABASE_POOL_MAX !== "1") throw new Error("Run through poolSelfDeadlock.test.ts (DATABASE_POOL_MAX=1)");

const runId = randomUUID().slice(0, 8);
const userIds: string[] = [];
const newUser = async (name: string): Promise<string> => {
  const row = await database.insertInto("users").values({
    legacy_mongo_id: null, email: `${name}-${runId}@example.test`, full_name: `${name} member`, username: `${name}_${runId}`, password_hash: "test-hash",
  }).returning("id").executeTakeFirstOrThrow();
  userIds.push(row.id);
  return row.id;
};

interface Outcome { name: string; ms: number; error?: string }
const outcomes: Outcome[] = [];
const timed = async (name: string, run: () => Promise<unknown>): Promise<void> => {
  const started = Date.now();
  try {
    await run();
    outcomes.push({ name, ms: Date.now() - started });
  } catch (error: unknown) {
    outcomes.push({ name, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) });
  }
};

await connectDatabase();
try {
  const author = await newUser("poolauthor");
  const reader = await newUser("poolreader");
  const locked = await newUser("poollocked");
  const leaving = await newUser("poolleaving");
  const now = Date.now();

  await timed("createStory", () => createStory({ user: author, operationId: randomUUID(), content: "hello", media_url: "", media_key: "", media_type: "text", background_color: "#000000", overlays: [] }));
  let postId = "";
  await timed("createPost", async () => { postId = (await createPost({ user: author, operationId: randomUUID(), content: "post", media: [], post_type: "text", visibility: "public" })).id; });
  await timed("createMessage", () => createMessage({ from_user_id: author, to_user_id: reader, operationId: randomUUID(), text: "hi", message_type: "text", media_url: "", media_key: "" }));
  await timed("createWorkout", () => createWorkoutWithStatistics({ userId: author, operationId: randomUUID(), name: "Pool", startTime: new Date(now - 60_000), endTime: new Date(now), durationMinutes: 1, volumeKg: 0, totalSets: 0, totalReps: 0, metricsVersion: 1, exercises: [] }));
  await timed("createRoutine", () => createRoutine({ userId: author, operationId: randomUUID(), name: "Pool routine", folder: "", exercises: [] }));
  await timed("updateUser", () => updateUser(author, { bio: "pool test" }));
  await updateUser(locked, { "privacy.publicProfile": false });
  await requestFollow(reader, locked);
  await timed("acceptFollowRequest", () => acceptFollowRequest(locked, reader));
  await timed("likePost", () => likePost(postId, reader));
  await timed("createPostComment", () => createPostComment(postId, reader, "nice"));
  await timed("deleteAccountData", () => deleteAccountData(leaving));
} finally {
  await database.deleteFrom("users").where("id", "in", userIds).execute().catch(() => undefined);
  await disconnectDatabase();
}

process.stdout.write(`\nPOOL_RESULTS ${JSON.stringify(outcomes)}\n`);
