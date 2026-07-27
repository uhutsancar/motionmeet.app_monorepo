import "dotenv/config";
import connectDB, { disconnectDB } from "../configs/db.js";
import Connection from "../models/Connection.js";
import Exercise from "../models/Exercise.js";
import Equipment from "../models/Equipment.js";
import MediaDeletionJob from "../models/MediaDeletionJob.js";
import Message from "../models/Message.js";
import MuscleGroup from "../models/MuscleGroup.js";
import Plan from "../models/Plan.js";
import PasswordResetToken from "../models/PasswordResetToken.js";
import Post from "../models/Post.js";
import PostComment from "../models/PostComment.js";
import PostLike from "../models/PostLike.js";
import Story from "../models/Story.js";
import StoryView from "../models/StoryView.js";
import Session from "../models/Session.js";
import UploadReservation from "../models/UploadReservation.js";
import Routine from "../models/Routine.js";
import Usage from "../models/Usage.js";
import User from "../models/User.js";
import UserFollow from "../models/UserFollow.js";
import Workout from "../models/Workout.js";

const applyChanges = process.argv.includes("--apply");
const MAX_RELATIONSHIPS = 10_000;

const main = async () => {
  await connectDB();

  console.log("Analyzing database for conflicts...");

  const emailConflictsRaw = await User.aggregate([
    { $group: { _id: { $toLower: { $trim: { input: "$email" } } }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  const emailConflicts = emailConflictsRaw.map(c => ({ value: c._id, ids: c.ids }));

  const usernameConflictsRaw = await User.aggregate([
    { $group: { _id: { $toLower: { $trim: { input: "$username" } } }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  const usernameConflicts = usernameConflictsRaw.map(c => ({ value: c._id, ids: c.ids }));

  const connectionConflictsRaw = await Connection.aggregate([
    { $group: { _id: "$pairKey", count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  const connectionConflicts = connectionConflictsRaw.map(c => ({ value: c._id, ids: c.ids }));

  const [legacyInteractionStats = { likes: 0, comments: 0, posts: 0 }] =
    await Post.aggregate([
      {
        $match: {
          $or: [
            { "likes_count.0": { $exists: true } },
            { "comments.0": { $exists: true } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          posts: { $sum: 1 },
          likes: { $sum: { $size: { $ifNull: ["$likes_count", []] } } },
          comments: { $sum: { $size: { $ifNull: ["$comments", []] } } },
        },
      },
    ]);
  const unownedCustomExercises = await Exercise.countDocuments({
    isCustom: true,
    $or: [{ createdBy: null }, { createdBy: { $exists: false } }],
  });

  console.log(JSON.stringify({
    mode: applyChanges ? "apply" : "dry-run",
    legacyInteractions: legacyInteractionStats,
    unownedCustomExercises,
    conflicts: {
      emails: emailConflicts,
      usernames: usernameConflicts,
      connectionPairs: connectionConflicts,
    },
  }, null, 2));

  if (!applyChanges) {
    console.log("Dry run complete. Re-run with --apply after resolving conflicts.");
    return;
  }
  if (
    emailConflicts.length ||
    usernameConflicts.length ||
    connectionConflicts.length
  ) {
    throw new Error(
      "Migration aborted because reported identity or connection conflicts must be resolved manually"
    );
  }

  console.log("Migrating Users...");
  const userCursor = User.find({}).select("_id email username followers following connections").lean().cursor();
  let userUpdates = [];
  let userFollowOps = [];
  
  for await (const user of userCursor) {
    const email = user.email.trim().toLowerCase();
    const username = user.username.trim().toLowerCase();
    const followerIds = Array.isArray(user.followers) ? user.followers.filter(id => id !== user._id.toString()) : [];
    const followingIds = Array.isArray(user.following) ? user.following.filter(id => id !== user._id.toString()) : [];
    const connectionIds = Array.isArray(user.connections) ? user.connections.filter(id => id !== user._id.toString()) : [];

    for (const targetId of followingIds) {
      userFollowOps.push({
        updateOne: {
          filter: { followerId: user._id, followeeId: targetId },
          update: { $setOnInsert: { followerId: user._id, followeeId: targetId } },
          upsert: true
        }
      });
    }

    userUpdates.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            email,
            username,
            followers_count: followerIds.length,
            following_count: followingIds.length,
            connections_count: connectionIds.length,
          },
          $unset: { followers: "", following: "", connections: "" }
        }
      }
    });

    if (userUpdates.length >= 1000) {
      if (userFollowOps.length) await UserFollow.bulkWrite(userFollowOps);
      await User.bulkWrite(userUpdates);
      userUpdates = [];
      userFollowOps = [];
    }
  }

  if (userUpdates.length > 0) {
    if (userFollowOps.length) await UserFollow.bulkWrite(userFollowOps);
    await User.bulkWrite(userUpdates);
  }

  console.log("Migrating Connections...");
  const connCursor = Connection.find({}).lean().cursor();
  let connUpdates = [];
  for await (const conn of connCursor) {
    const pairKey = [conn.from_user_id, conn.to_user_id].sort().join(":");
    if (pairKey !== conn.pairKey) {
      connUpdates.push({
        updateOne: {
          filter: { _id: conn._id },
          update: { $set: { pairKey } }
        }
      });
    }
    if (connUpdates.length >= 1000) {
      await Connection.bulkWrite(connUpdates);
      connUpdates = [];
    }
  }
  if (connUpdates.length > 0) {
    await Connection.bulkWrite(connUpdates);
  }

  console.log("Migrating Posts...");
  for await (const post of Post.find({
    $or: [
      { "likes_count.0": { $exists: true } },
      { "comments.0": { $exists: true } },
    ],
  })
    .select("+likes_count +comments")
    .cursor()) {
    if (post.likes_count?.length) {
      await PostLike.bulkWrite(
        post.likes_count.map((userId) => ({
          updateOne: {
            filter: { postId: post._id, userId },
            update: {
              $setOnInsert: {
                postId: post._id,
                userId,
                createdAt: post.createdAt,
                updatedAt: post.createdAt,
              },
            },
            upsert: true,
          },
        }))
      );
    }
    if (post.comments?.length) {
      await PostComment.bulkWrite(
        post.comments.map((comment) => ({
          updateOne: {
            filter: { _id: comment._id },
            update: {
              $setOnInsert: {
                _id: comment._id,
                postId: post._id,
                userId: comment.user,
                content: comment.content,
                createdAt: comment.createdAt || post.createdAt,
                updatedAt: comment.createdAt || post.createdAt,
              },
            },
            upsert: true,
          },
        }))
      );
    }
    await Post.updateOne(
      { _id: post._id },
      { 
        $unset: { likes_count: "", comments: "" },
        $set: { 
          like_count: post.likes_count?.length || 0, 
          comment_count: post.comments?.length || 0 
        } 
      }
    );
  }

  console.log("Aggregating Usage Statistics...");
  const [workoutCounts, routineCounts, statistics] = await Promise.all([
    Workout.aggregate([
      {
        $group: {
          _id: {
            userId: "$userId",
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    Routine.aggregate([
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]),
    Workout.aggregate([
      {
        $group: {
          _id: "$userId",
          totalWorkouts: { $sum: 1 },
          totalDurationMinutes: { $sum: "$durationMinutes" },
          totalVolumeKg: { $sum: "$volumeKg" },
        },
      },
    ]),
  ]);

  const usageOperations = [
    ...workoutCounts.map((entry) => ({
      updateOne: {
        filter: {
          userId: entry._id.userId,
          bucket: `workouts:${entry._id.year}-${String(entry._id.month).padStart(2, "0")}`,
        },
        update: { $set: { count: entry.count } },
        upsert: true,
      },
    })),
    ...routineCounts.map((entry) => ({
      updateOne: {
        filter: { userId: entry._id, bucket: "routines:lifetime" },
        update: { $set: { count: entry.count } },
        upsert: true,
      },
    })),
  ];
  await Usage.deleteMany({
    $or: [
      { bucket: /^workouts:/ },
      { bucket: "routines:lifetime" },
    ],
  });
  if (usageOperations.length) await Usage.bulkWrite(usageOperations);

  await User.updateMany({}, {
    $set: {
      statistics: {
        totalWorkouts: 0,
        totalDurationMinutes: 0,
        totalVolumeKg: 0,
      },
    },
  });
  
  if (statistics.length) {
    let statUpdates = [];
    for (const entry of statistics) {
      statUpdates.push({
        updateOne: {
          filter: { _id: entry._id },
          update: {
            $set: {
              statistics: {
                totalWorkouts: entry.totalWorkouts,
                totalDurationMinutes: entry.totalDurationMinutes,
                totalVolumeKg: entry.totalVolumeKg,
              },
            },
          },
        },
      });
      if (statUpdates.length >= 1000) {
        await User.bulkWrite(statUpdates);
        statUpdates = [];
      }
    }
    if (statUpdates.length > 0) {
      await User.bulkWrite(statUpdates);
    }
  }

  console.log("Migrating Stories...");
  for await (const story of Story.find({ views_count: { $exists: true } }).cursor()) {
    if (story.views_count?.length) {
      await StoryView.bulkWrite(story.views_count.map(userId => ({
        updateOne: {
          filter: { storyId: story._id, userId },
          update: { $setOnInsert: { storyId: story._id, userId } },
          upsert: true
        }
      })));
    }
    await Story.updateOne({ _id: story._id }, { $unset: { views_count: "" } });
  }

  console.log("Creating Indexes...");
  await Promise.all([
    Connection.createIndexes(),
    Exercise.createIndexes(),
    Equipment.createIndexes(),
    MediaDeletionJob.createIndexes(),
    Message.createIndexes(),
    MuscleGroup.createIndexes(),
    Plan.createIndexes(),
    PasswordResetToken.createIndexes(),
    Post.createIndexes(),
    PostComment.createIndexes(),
    PostLike.createIndexes(),
    Routine.createIndexes(),
    Session.createIndexes(),
    Story.createIndexes(),
    UploadReservation.createIndexes(),
    Usage.createIndexes(),
    User.createIndexes(),
    Workout.createIndexes(),
  ]);

  console.log("Data integrity migration completed.");
};

try {
  await main();
} catch (error) {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
