import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { connectDatabase, database, disconnectDatabase } from "../configs/database.js";
import { canSendToUser, createMessage } from "../services/messageService.js";
import { likePost } from "../services/postInteractionService.js";
import { deletePostById, getPostById } from "../services/postService.js";
import { acceptConnection, createConnection, getUserById } from "../services/userService.js";
import { acceptFollowRequest, requestFollow } from "../services/relationshipService.js";
import { createWorkoutWithStatistics } from "../services/workoutService.js";

test("PostgreSQL transactions remain idempotent under concurrent writes", { timeout: 120_000 }, async () => {
  await connectDatabase();
  const runId = randomUUID().slice(0, 8);
  const deletionKey = `posts/integration-${runId}.png`;
  const userIds: string[] = [];
  try {
    const sender = await database.insertInto("users").values({ legacy_mongo_id: null, email: `sender-${runId}@example.test`, full_name: "Sender User", username: `sender_${runId}`, password_hash: "test-hash", plan_id: null, plan_start_date: null, plan_end_date: null, plan_cancelled_at: null }).returning("id").executeTakeFirstOrThrow();
    const recipient = await database.insertInto("users").values({ legacy_mongo_id: null, email: `recipient-${runId}@example.test`, full_name: "Recipient User", username: `recipient_${runId}`, password_hash: "test-hash", plan_id: null, plan_start_date: null, plan_end_date: null, plan_cancelled_at: null }).returning("id").executeTakeFirstOrThrow();
    userIds.push(sender.id, recipient.id);
    const exercise = await database.insertInto("exercises").values({ legacy_mongo_id: null, external_id: `integration-${runId}`, name: "Integration Bench Press", name_normalized: `integration bench press ${runId}`, muscle_group: "chest", equipment: "barbell", created_by: sender.id }).returning("id").executeTakeFirstOrThrow();
    const post = await database.insertInto("posts").values({ legacy_mongo_id: null, user_id: sender.id, operation_id: `post-${runId}`, author_full_name: "Sender User", author_username: `sender_${runId}`, content: "test", workout_id: null }).returning("id").executeTakeFirstOrThrow();

    await Promise.all(Array.from({ length: 20 }, () => likePost(post.id, recipient.id)));
    assert.equal(Number((await database.selectFrom("post_likes").select((expression) => expression.fn.countAll<number>().as("count")).where("post_id", "=", post.id).where("user_id", "=", recipient.id).executeTakeFirstOrThrow()).count), 1);
    assert.equal((await database.selectFrom("posts").select("like_count").where("id", "=", post.id).executeTakeFirstOrThrow()).like_count, 1);

    const connection = await createConnection(sender.id, recipient.id);
    await Promise.all(Array.from({ length: 20 }, () => acceptConnection(recipient.id, sender.id)));
    assert.equal(Number((await database.selectFrom("outbox_events").select((expression) => expression.fn.countAll<number>().as("count")).where("type", "=", "connection.requested").where("aggregate_id", "=", connection.id).executeTakeFirstOrThrow()).count), 1);
    const usersAfterConnection = await database.selectFrom("users").select(["id", "connections_count"]).where("id", "in", userIds).execute();
    assert.deepEqual(usersAfterConnection.map((row) => row.connections_count).sort(), [1, 1]);
    assert.equal(await canSendToUser((await getUserById(sender.id)) ?? undefined, recipient.id), true);

    // The recipient is an open account, so twenty concurrent follow taps must
    // settle on exactly one edge and one increment per counter.
    await Promise.allSettled(Array.from({ length: 20 }, () => requestFollow(sender.id, recipient.id)));
    assert.equal(Number((await database.selectFrom("user_follows").select((expression) => expression.fn.countAll<number>().as("count")).where("follower_id", "=", sender.id).where("followee_id", "=", recipient.id).executeTakeFirstOrThrow()).count), 1);
    assert.equal(Number((await database.selectFrom("follow_requests").select((expression) => expression.fn.countAll<number>().as("count")).where("requester_id", "=", sender.id).where("target_id", "=", recipient.id).executeTakeFirstOrThrow()).count), 0);
    const senderCounts = await database.selectFrom("users").select("following_count").where("id", "=", sender.id).executeTakeFirstOrThrow();
    const recipientCounts = await database.selectFrom("users").select("followers_count").where("id", "=", recipient.id).executeTakeFirstOrThrow();
    assert.equal(senderCounts.following_count, 1); assert.equal(recipientCounts.followers_count, 1);

    // The private half of the same rule: a locked account only collects a
    // request, and twenty concurrent approvals still produce one edge.
    await database.updateTable("users").set({ privacy_public_profile: false }).where("id", "=", sender.id).execute();
    await Promise.allSettled(Array.from({ length: 20 }, () => requestFollow(recipient.id, sender.id)));
    assert.equal(Number((await database.selectFrom("follow_requests").select((expression) => expression.fn.countAll<number>().as("count")).where("requester_id", "=", recipient.id).where("target_id", "=", sender.id).executeTakeFirstOrThrow()).count), 1);
    assert.equal(Number((await database.selectFrom("user_follows").select((expression) => expression.fn.countAll<number>().as("count")).where("follower_id", "=", recipient.id).where("followee_id", "=", sender.id).executeTakeFirstOrThrow()).count), 0);

    await Promise.allSettled(Array.from({ length: 20 }, () => acceptFollowRequest(sender.id, recipient.id)));
    assert.equal(Number((await database.selectFrom("follow_requests").select((expression) => expression.fn.countAll<number>().as("count")).where("requester_id", "=", recipient.id).where("target_id", "=", sender.id).executeTakeFirstOrThrow()).count), 0);
    assert.equal(Number((await database.selectFrom("user_follows").select((expression) => expression.fn.countAll<number>().as("count")).where("follower_id", "=", recipient.id).where("followee_id", "=", sender.id).executeTakeFirstOrThrow()).count), 1);
    assert.equal((await database.selectFrom("users").select("followers_count").where("id", "=", sender.id).executeTakeFirstOrThrow()).followers_count, 1);
    await database.updateTable("users").set({ privacy_public_profile: true }).where("id", "=", sender.id).execute();

    await Promise.all(Array.from({ length: 10 }, (_, index) => createMessage({ from_user_id: sender.id, to_user_id: recipient.id, operationId: `message-${runId}-${index}`, text: `message ${index}`, message_type: "text", media_url: "", media_key: "" })));
    assert.equal(Number((await database.selectFrom("conversations").select((expression) => expression.fn.countAll<number>().as("count")).where("pair_key", "=", [sender.id, recipient.id].sort().join(":")).executeTakeFirstOrThrow()).count), 1);
    const participant = await database.selectFrom("conversation_participants").select("unread_count").where("user_id", "=", recipient.id).executeTakeFirstOrThrow();
    assert.equal(participant.unread_count, 10);

    const workoutInput = { userId: sender.id, operationId: `workout-${runId}`, name: "Workout", startTime: new Date(), endTime: new Date(), durationMinutes: 30, volumeKg: 100, totalSets: 1, totalReps: 10, metricsVersion: 2, exercises: [{ exerciseId: exercise.id, exerciseName: "Integration Bench Press", muscleGroup: "chest", equipment: "barbell", sets: [{ setType: "normal" as const, reps: 10, weight: 10, completed: true }] }] };
    await Promise.all([createWorkoutWithStatistics(workoutInput, { quotaLimit: 5 }), createWorkoutWithStatistics(workoutInput, { quotaLimit: 5 })]);
    assert.equal(Number((await database.selectFrom("workouts").select((expression) => expression.fn.countAll<number>().as("count")).where("user_id", "=", sender.id).executeTakeFirstOrThrow()).count), 1);
    assert.equal((await database.selectFrom("users").select("total_workouts").where("id", "=", sender.id).executeTakeFirstOrThrow()).total_workouts, 1);

    const quotaRace = await Promise.allSettled(Array.from({ length: 8 }, (_, index) => createWorkoutWithStatistics({ ...workoutInput, operationId: `quota-${runId}-${index}`, name: `Quota ${index}` }, { quotaLimit: 5 })));
    assert.equal(quotaRace.filter((result) => result.status === "fulfilled").length, 4);
    assert.equal(Number((await database.selectFrom("workouts").select((expression) => expression.fn.countAll<number>().as("count")).where("user_id", "=", sender.id).executeTakeFirstOrThrow()).count), 5);

    const deletable = await database.insertInto("posts").values({ legacy_mongo_id: null, user_id: sender.id, operation_id: `delete-${runId}`, author_full_name: "Sender User", author_username: `sender_${runId}`, content: "", post_type: "image", workout_id: null }).returning("id").executeTakeFirstOrThrow();
    await database.insertInto("post_media").values({ legacy_mongo_id: null, post_id: deletable.id, position: 0, url: "https://example.invalid/post.png", object_key: deletionKey, media_type: "image", mime_type: "image/png", file_size: null, width: null, height: null, duration_seconds: null }).execute();
    const access = await getPostById(deletable.id); assert.ok(access); await deletePostById(access);
    assert.ok(await database.selectFrom("media_deletion_jobs").select("id").where("object_key", "=", deletionKey).executeTakeFirst());
  } finally {
    if (userIds.length) await database.deleteFrom("users").where("id", "in", userIds).execute();
    await database.deleteFrom("media_deletion_jobs").where("object_key", "=", deletionKey).execute();
    await disconnectDatabase();
  }
});
