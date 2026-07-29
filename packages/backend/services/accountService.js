import mongoose from "mongoose";
import Connection from "../models/Connection.js";
import Conversation from "../models/Conversation.js";
import Exercise from "../models/Exercise.js";
import Message from "../models/Message.js";
import Post from "../models/Post.js";
import PostComment from "../models/PostComment.js";
import PostLike from "../models/PostLike.js";
import Routine from "../models/Routine.js";
import Session from "../models/Session.js";
import Story from "../models/Story.js";
import User from "../models/User.js";
import UserFollow from "../models/UserFollow.js";
import StoryView from "../models/StoryView.js";
import Usage from "../models/Usage.js";
import UploadReservation from "../models/UploadReservation.js";
import Workout from "../models/Workout.js";
import PasswordResetToken from "../models/PasswordResetToken.js";
import PersonalRecord from "../models/PersonalRecord.js";
import UserDailyWorkoutStat from "../models/UserDailyWorkoutStat.js";
import UserExerciseDailyStat from "../models/UserExerciseDailyStat.js";
import OutboxEvent from "../models/OutboxEvent.js";
import { extractS3Key } from "../utils/s3Utils.js";
import { queueMediaDeletions } from "./mediaDeletionService.js";

const uniqueMediaKeys = (values) => [
  ...new Set(
    values
      .map((value) =>
        typeof value === "string" && !value.includes("://")
          ? value
          : extractS3Key(value)
      )
      .filter(Boolean)
  ),
];

const writeChunk = async (response, chunk) => {
  if (response.destroyed) throw new Error("Account export connection closed");
  if (response.write(chunk)) return;
  await new Promise((resolve, reject) => {
    const onDrain = () => {
      response.off("close", onClose);
      resolve();
    };
    const onClose = () => {
      response.off("drain", onDrain);
      reject(new Error("Account export connection closed"));
    };
    response.once("drain", onDrain);
    response.once("close", onClose);
  });
};

const streamQueryArray = async (response, query) => {
  await writeChunk(response, "[");
  let first = true;
  for await (const document of query.lean().cursor()) {
    await writeChunk(
      response,
      `${first ? "" : ","}${JSON.stringify(document)}`
    );
    first = false;
  }
  await writeChunk(response, "]");
};

export const streamAccountData = async (userId, response) => {
  const user = await User.findById(userId).select("-password").lean();
  if (!user) return false;

  await writeChunk(
    response,
    `{"exportedAt":${JSON.stringify(new Date().toISOString())},"formatVersion":2,"user":${JSON.stringify(user)}`
  );

  const sections = [
    ["workouts", Workout.find({ userId })],
    ["routines", Routine.find({ userId })],
    ["posts", Post.find({ user: userId })],
    ["stories", Story.find({ user: userId })],
    [
      "messages",
      Message.find({
        $or: [{ from_user_id: userId }, { to_user_id: userId }],
      }),
    ],
    [
      "connections",
      Connection.find({
        $or: [{ from_user_id: userId }, { to_user_id: userId }],
      }),
    ],
    ["conversations", Conversation.find({ participants: userId })],
  ];

  for (const [name, query] of sections) {
    await writeChunk(response, `,${JSON.stringify(name)}:`);
    await streamQueryArray(response, query);
  }

  await writeChunk(response, ',"interactions":{"likes":');
  await streamQueryArray(response, PostLike.find({ userId }));
  await writeChunk(response, ',"comments":');
  await streamQueryArray(response, PostComment.find({ userId }));
  await writeChunk(response, "}");

  const privateSections = [
    ["customExercises", Exercise.find({ createdBy: userId })],
    ["sessions", Session.find({ userId })],
    ["passwordResetTokens", PasswordResetToken.find({ userId })],
    ["usage", Usage.find({ userId })],
    ["uploadReservations", UploadReservation.find({ userId })],
    ["personalRecords", PersonalRecord.find({ userId })],
    ["dailyWorkoutStats", UserDailyWorkoutStat.find({ userId })],
    ["exerciseDailyStats", UserExerciseDailyStat.find({ userId })],
  ];
  for (const [name, query] of privateSections) {
    await writeChunk(response, `,${JSON.stringify(name)}:`);
    await streamQueryArray(response, query);
  }

  await writeChunk(response, "}");
  response.end();
  return true;
};

export const deleteAccountData = async (userId) => {
  const [user, posts, stories, messages, reservations, followingDocs, followersDocs, connectionsDocs, postLikesDocs, postCommentsDocs] = await Promise.all([
    User.findById(userId)
      .select("profile_picture cover_photo +profile_picture_key +cover_photo_key")
      .lean(),
    Post.find({ user: userId }).select("image_urls +image_keys").lean(),
    Story.find({ user: userId }).select("media_url +media_key").lean(),
    Message.find({
      $or: [{ from_user_id: userId }, { to_user_id: userId }],
    })
      .select("media_url +media_key")
      .lean(),
    UploadReservation.find({ userId }).select("key").lean(),
    UserFollow.find({ followerId: userId }).select("followeeId").lean(),
    UserFollow.find({ followeeId: userId }).select("followerId").lean(),
    Connection.find({ $or: [{ from_user_id: userId }, { to_user_id: userId }], status: "accepted" }).lean(),
    PostLike.find({ userId }).select("postId").lean(),
    PostComment.find({ userId }).select("postId").lean(),
  ]);

  if (!user) return false;
  const ownedPostIds = posts.map((post) => post._id);
  const ownedStoryIds = stories.map((story) => story._id);
  const followeeIds = followingDocs?.map(f => f.followeeId) || [];
  const followerIds = followersDocs?.map(f => f.followerId) || [];
  const connectionUserIds = (connectionsDocs || []).map(c => c.from_user_id === userId ? c.to_user_id : c.from_user_id);
  const likedPostIds = (postLikesDocs || []).map(l => l.postId);
  const commentCountsByPost = new Map();
  for (const comment of postCommentsDocs || []) {
    const postId = comment.postId.toString();
    commentCountsByPost.set(postId, (commentCountsByPost.get(postId) || 0) + 1);
  }

  const mediaKeys = uniqueMediaKeys([
    user.profile_picture_key || user.profile_picture,
    user.cover_photo_key || user.cover_photo,
    ...posts.flatMap((post) =>
      post.image_keys?.length ? post.image_keys : post.image_urls || []
    ),
    ...stories.map((story) => story.media_key || story.media_url),
    ...messages.map((message) => message.media_key || message.media_url),
    ...reservations.map((reservation) => reservation.key),
  ]);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await queueMediaDeletions(mediaKeys, { session });
      await Session.deleteMany({ userId }, { session });
      await PasswordResetToken.deleteMany({ userId }, { session });
      await Usage.deleteMany({ userId }, { session });
      await UploadReservation.deleteMany({ userId }, { session });
      await Connection.deleteMany(
        { $or: [{ from_user_id: userId }, { to_user_id: userId }] },
        { session }
      );
      await Conversation.deleteMany({ participants: userId }, { session });
      await Message.deleteMany(
        { $or: [{ from_user_id: userId }, { to_user_id: userId }] },
        { session }
      );
      await PostLike.deleteMany(
        { $or: [{ userId }, { postId: { $in: ownedPostIds } }] },
        { session }
      );
      await PostComment.deleteMany(
        { $or: [{ userId }, { postId: { $in: ownedPostIds } }] },
        { session }
      );
      await Exercise.deleteMany({ createdBy: userId }, { session });
      await Post.deleteMany({ user: userId }, { session });
      await Post.updateMany(
        { _id: { $in: likedPostIds } },
        [{ $set: { like_count: { $max: [0, { $subtract: [{ $ifNull: ["$like_count", 0] }, 1] }] } } }],
        { session }
      );
      if (commentCountsByPost.size > 0) {
        await Post.bulkWrite(
          [...commentCountsByPost.entries()].map(([postId, count]) => ({
            updateOne: {
              filter: { _id: postId },
              update: [
                {
                  $set: {
                    comment_count: {
                      $max: [
                        0,
                        {
                          $subtract: [
                            { $ifNull: ["$comment_count", 0] },
                            count,
                          ],
                        },
                      ],
                    },
                  },
                },
              ],
            },
          })),
          { session }
        );
      }
      await Story.deleteMany({ user: userId }, { session });
      await StoryView.deleteMany(
        { $or: [{ userId }, { storyId: { $in: ownedStoryIds } }] },
        { session }
      );
      await Routine.deleteMany({ userId }, { session });
      await Workout.deleteMany({ userId }, { session });
      await PersonalRecord.deleteMany({ userId }, { session });
      await UserDailyWorkoutStat.deleteMany({ userId }, { session });
      await UserExerciseDailyStat.deleteMany({ userId }, { session });
      await OutboxEvent.deleteMany(
        {
          $or: [
            { aggregateId: userId },
            { "payload.senderId": userId },
            { "payload.recipientId": userId },
          ],
        },
        { session }
      );
      
      await UserFollow.deleteMany({ $or: [{ followerId: userId }, { followeeId: userId }] }, { session });
      
      if (followeeIds.length > 0) {
        await User.updateMany(
          { _id: { $in: followeeIds } },
          [{ $set: { followers_count: { $max: [0, { $subtract: [{ $ifNull: ["$followers_count", 0] }, 1] }] } } }],
          { session }
        );
      }
      if (followerIds.length > 0) {
        await User.updateMany(
          { _id: { $in: followerIds } },
          [{ $set: { following_count: { $max: [0, { $subtract: [{ $ifNull: ["$following_count", 0] }, 1] }] } } }],
          { session }
        );
      }
      if (connectionUserIds.length > 0) {
        await User.updateMany(
          { _id: { $in: connectionUserIds } },
          [{ $set: { connections_count: { $max: [0, { $subtract: [{ $ifNull: ["$connections_count", 0] }, 1] }] } } }],
          { session }
        );
      }
      await User.deleteOne({ _id: userId }, { session });
    });
  } finally {
    await session.endSession();
  }

  return true;
};
