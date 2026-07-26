import mongoose from "mongoose";
import Connection from "../models/Connection.js";
import Exercise from "../models/Exercise.js";
import Message from "../models/Message.js";
import Post from "../models/Post.js";
import PostComment from "../models/PostComment.js";
import PostLike from "../models/PostLike.js";
import Routine from "../models/Routine.js";
import Session from "../models/Session.js";
import Story from "../models/Story.js";
import User from "../models/User.js";
import Usage from "../models/Usage.js";
import UploadReservation from "../models/UploadReservation.js";
import Workout from "../models/Workout.js";
import PasswordResetToken from "../models/PasswordResetToken.js";
import { extractS3Key } from "../utils/s3Utils.js";
import {
  deleteMediaOrQueue,
  queueMediaDeletions,
} from "./mediaDeletionService.js";

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
  const [user, posts, stories, messages, reservations] = await Promise.all([
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
  ]);

  if (!user) return false;
  const ownedPostIds = posts.map((post) => post._id);

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
        {
          user: { $ne: userId },
          $or: [{ likes_count: userId }, { "comments.user": userId }],
        },
        {
          $pull: {
            likes_count: userId,
            comments: { user: userId },
          },
        },
        { session }
      );
      await Story.deleteMany({ user: userId }, { session });
      await Routine.deleteMany({ userId }, { session });
      await Workout.deleteMany({ userId }, { session });
      await User.updateMany(
        { followers: userId },
        { $pull: { followers: userId } },
        { session }
      );
      await User.updateMany(
        { following: userId },
        { $pull: { following: userId } },
        { session }
      );
      await User.updateMany(
        { connections: userId },
        { $pull: { connections: userId } },
        { session }
      );
      await User.deleteOne({ _id: userId }, { session });
    });
  } finally {
    await session.endSession();
  }

  await deleteMediaOrQueue(mediaKeys);
  return true;
};
