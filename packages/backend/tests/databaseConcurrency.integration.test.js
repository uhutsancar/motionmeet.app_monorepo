import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import "../models/modelRegistry.js";
import Conversation from "../models/Conversation.js";
import Exercise from "../models/Exercise.js";
import Message from "../models/Message.js";
import MediaDeletionJob from "../models/MediaDeletionJob.js";
import OutboxEvent from "../models/OutboxEvent.js";
import Post from "../models/Post.js";
import PostLike from "../models/PostLike.js";
import UploadReservation from "../models/UploadReservation.js";
import Usage from "../models/Usage.js";
import User from "../models/User.js";
import UserDailyWorkoutStat from "../models/UserDailyWorkoutStat.js";
import UserExerciseDailyStat from "../models/UserExerciseDailyStat.js";
import Workout from "../models/Workout.js";
import { applyIntegrityMigration } from "../services/databaseMigrationService.js";
import {
  canSendToUser,
  createMessage,
} from "../services/messageService.js";
import { likePost } from "../services/postInteractionService.js";
import { deletePostById, getPostById } from "../services/postService.js";
import { discardReservedUploads } from "../services/mediaUploadService.js";
import { createWorkoutWithStatistics } from "../services/workoutService.js";
import {
  acceptConnection,
  createConnection,
  followUser,
} from "../services/userService.js";

const databaseUrl = process.env.MONGODB_TEST_URL;
const enabled = Boolean(databaseUrl);
const databaseName = `motionmeet_test_${process.pid}`;

test(
  "MongoDB transaction and uniqueness contracts hold under concurrency",
  { skip: !enabled, timeout: 120_000 },
  async () => {
    await mongoose.connect(databaseUrl, {
      dbName: databaseName,
      autoIndex: false,
      serverSelectionTimeoutMS: 10_000,
    });
    try {
      await applyIntegrityMigration();
      const senderId = "11111111-1111-4111-8111-111111111111";
      const recipientId = "22222222-2222-4222-8222-222222222222";
      await User.create([
        {
          _id: senderId,
          email: "sender@example.com",
          full_name: "Sender User",
          username: "sender",
          password: "not-a-real-password-hash",
        },
        {
          _id: recipientId,
          email: "recipient@example.com",
          full_name: "Recipient User",
          username: "recipient",
          password: "not-a-real-password-hash",
        },
      ]);
      await assert.rejects(
        mongoose.connection.collection("userfollows").insertOne({
          followerId: senderId,
          followeeId: senderId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        (error) => (/** @type {any} */ (error))?.code === 121
      );

      const post = await Post.create({
        user: senderId,
        operationId: "post:test-concurrency",
        content: "test",
      });
      await Promise.all(
        Array.from({ length: 20 }, () => likePost(post._id, recipientId))
      );
      assert.equal(
        await PostLike.countDocuments({ postId: post._id, userId: recipientId }),
        1
      );
      assert.equal((await Post.findById(post._id).lean()).like_count, 1);

      const connection = await createConnection(senderId, recipientId);
      await Promise.all(
        Array.from({ length: 20 }, () =>
          acceptConnection(recipientId, senderId)
        )
      );
      assert.equal(
        await OutboxEvent.countDocuments({
          type: "connection.requested",
          aggregateId: connection._id.toString(),
        }),
        1
      );
      const sender = await User.findById(senderId);
      const recipient = await User.findById(recipientId);
      assert.equal(await canSendToUser(sender, recipientId), true);
      assert.equal(sender.connections_count, 1);
      assert.equal(recipient.connections_count, 1);

      await Promise.all(
        Array.from({ length: 20 }, () => followUser(senderId, recipientId))
      );
      assert.equal(
        (await User.findById(senderId).lean()).following_count,
        1
      );
      assert.equal(
        (await User.findById(recipientId).lean()).followers_count,
        1
      );

      await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          createMessage({
            from_user_id: senderId,
            to_user_id: recipientId,
            operationId: `message:test-${index}`,
            text: `message ${index}`,
            message_type: "text",
            seen: false,
          })
        )
      );
      assert.equal(await Conversation.countDocuments({}), 1);
      assert.equal(await Message.countDocuments({}), 10);
      const conversation = await Conversation.findOne({}).lean();
      assert.equal(conversation.unreadByUser[recipientId], 10);

      const reservedMessageKey = "messages/integration-reserved.png";
      await UploadReservation.create({
        key: reservedMessageKey,
        userId: senderId,
        purpose: "messages",
        contentType: "image/png",
        maxBytes: 1024,
        expiresAt: new Date(Date.now() + 60_000),
      });
      await createMessage(
        {
          from_user_id: senderId,
          to_user_id: recipientId,
          operationId: "message:reserved-upload",
          text: "",
          message_type: "image",
          media_url: "https://example.invalid/reserved.png",
          media_key: reservedMessageKey,
          seen: false,
        },
        { reservationKeys: [reservedMessageKey] }
      );
      assert.equal(
        await UploadReservation.countDocuments({ key: reservedMessageKey }),
        0
      );
      await discardReservedUploads([reservedMessageKey]);
      assert.equal(
        await MediaDeletionJob.countDocuments({ key: reservedMessageKey }),
        0
      );

      const abandonedKey = "messages/integration-abandoned.png";
      await UploadReservation.create({
        key: abandonedKey,
        userId: senderId,
        purpose: "messages",
        contentType: "image/png",
        maxBytes: 1024,
        expiresAt: new Date(Date.now() + 60_000),
      });
      await discardReservedUploads([abandonedKey]);
      assert.equal(
        await UploadReservation.countDocuments({ key: abandonedKey }),
        0
      );
      assert.equal(
        await MediaDeletionJob.countDocuments({ key: abandonedKey }),
        1
      );

      const deletablePost = await Post.create({
        user: senderId,
        operationId: "post:durable-media-delete",
        content: "",
        post_type: "image",
        image_urls: ["https://example.invalid/post.png"],
        image_keys: ["posts/integration-delete.png"],
      });
      await deletePostById(await getPostById(deletablePost._id));
      assert.equal(
        await MediaDeletionJob.countDocuments({
          key: "posts/integration-delete.png",
        }),
        1
      );

      const exercise = await Exercise.create({
        externalId: "integration-exercise",
        name: "Bench Press",
        nameNormalized: "bench press",
        muscleGroup: "chest",
        equipment: "barbell",
        isCustom: false,
      });
      const workoutData = {
        userId: senderId,
        operationId: "workout:test-idempotency",
        name: "Workout",
        startTime: new Date(),
        endTime: new Date(),
        durationMinutes: 30,
        volumeKg: 100,
        totalSets: 1,
        totalReps: 10,
        metricsVersion: 2,
        exercises: [
          {
            exerciseId: exercise._id,
            exerciseName: exercise.name,
            muscleGroup: exercise.muscleGroup,
            equipment: exercise.equipment,
            sets: [
              {
                setType: "normal",
                reps: 10,
                weight: 10,
                completed: true,
              },
            ],
          },
        ],
      };
      await Promise.all([
        createWorkoutWithStatistics(workoutData, { quotaLimit: 5 }),
        createWorkoutWithStatistics(workoutData, { quotaLimit: 5 }),
      ]);
      assert.equal(await Workout.countDocuments({ userId: senderId }), 1);
      assert.equal(
        (await User.findById(senderId).lean()).statistics.totalWorkouts,
        1
      );
      assert.equal(
        await Usage.countDocuments({
          userId: senderId,
          bucket: { $regex: /^workouts:/ },
          count: 1,
        }),
        1
      );
      assert.equal(
        await UserDailyWorkoutStat.countDocuments({ userId: senderId }),
        1
      );

      const quotaRace = await Promise.allSettled(
        Array.from({ length: 10 }, (_, index) =>
          createWorkoutWithStatistics(
            {
              ...workoutData,
              operationId: `workout:quota-race-${index}`,
              name: `Quota Race ${index}`,
            },
            { quotaLimit: 5 }
          )
        )
      );
      assert.equal(
        quotaRace.filter((result) => result.status === "fulfilled").length,
        4
      );
      assert.equal(await Workout.countDocuments({ userId: senderId }), 5);
      assert.equal(
        (
          await Usage.findOne({
            userId: senderId,
            bucket: { $regex: /^workouts:/ },
          }).lean()
        ).count,
        5
      );
      assert.equal(
        (await User.findById(senderId).lean()).statistics.totalWorkouts,
        5
      );
      assert.equal(
        (
          await UserExerciseDailyStat.findOne({
            userId: senderId,
            exerciseId: exercise._id,
          }).lean()
        ).totalSessions,
        5
      );
    } finally {
      const connectedName = mongoose.connection.name;
      if (connectedName === databaseName) {
        await mongoose.connection.dropDatabase();
      }
      await mongoose.disconnect();
    }
  }
);
