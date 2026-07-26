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
import Session from "../models/Session.js";
import UploadReservation from "../models/UploadReservation.js";
import Routine from "../models/Routine.js";
import Usage from "../models/Usage.js";
import User from "../models/User.js";
import Workout from "../models/Workout.js";

const applyChanges = process.argv.includes("--apply");
const MAX_RELATIONSHIPS = 10_000;

const duplicatesBy = (items, getKey) => {
  const groups = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()].filter(([, values]) => values.length > 1);
};

const main = async () => {
  await connectDB();

  const users = await User.find({})
    .select("_id email username followers following connections")
    .lean();
  const normalizedUsers = users.map((user) => ({
    ...user,
    email: user.email.trim().toLowerCase(),
    username: user.username.trim().toLowerCase(),
  }));
  const emailConflicts = duplicatesBy(normalizedUsers, (user) => user.email);
  const usernameConflicts = duplicatesBy(normalizedUsers, (user) => user.username);

  const connections = await Connection.find({})
    .select("_id from_user_id to_user_id status")
    .lean();
  const connectionPairs = connections.map((connection) => ({
    ...connection,
    pairKey: [connection.from_user_id, connection.to_user_id].sort().join(":"),
  }));
  const connectionConflicts = duplicatesBy(
    connectionPairs,
    (connection) => connection.pairKey
  );
  const validUserIds = new Set(normalizedUsers.map((user) => user._id));
  const relationships = new Map(
    normalizedUsers.map((user) => [
      user._id,
      {
        followers: new Set(
          (user.followers || []).filter(
            (id) => id !== user._id && validUserIds.has(id)
          )
        ),
        following: new Set(
          (user.following || []).filter(
            (id) => id !== user._id && validUserIds.has(id)
          )
        ),
        connections: new Set(
          (user.connections || []).filter(
            (id) => id !== user._id && validUserIds.has(id)
          )
        ),
      },
    ])
  );

  for (const [userId, relation] of relationships) {
    for (const targetId of relation.following) {
      relationships.get(targetId).followers.add(userId);
    }
    for (const sourceId of relation.followers) {
      relationships.get(sourceId).following.add(userId);
    }
    for (const connectionId of relation.connections) {
      relationships.get(connectionId).connections.add(userId);
    }
  }

  const orphanConnectionIds = [];
  for (const connection of connectionPairs) {
    const fromId = connection.from_user_id;
    const toId = connection.to_user_id;
    if (
      fromId === toId ||
      !validUserIds.has(fromId) ||
      !validUserIds.has(toId)
    ) {
      orphanConnectionIds.push(connection._id);
    } else if (connection.status === "accepted") {
      relationships.get(fromId).connections.add(toId);
      relationships.get(toId).connections.add(fromId);
    }
  }

  const relationshipLimitConflicts = [];
  for (const [userId, relation] of relationships) {
    for (const field of ["followers", "following", "connections"]) {
      if (relation[field].size > MAX_RELATIONSHIPS) {
        relationshipLimitConflicts.push({
          userId,
          field,
          count: relation[field].size,
          limit: MAX_RELATIONSHIPS,
        });
      }
    }
  }

  const acceptedConnectionPairs = new Set();
  for (const [userId, relation] of relationships) {
    for (const connectionId of relation.connections) {
      acceptedConnectionPairs.add([userId, connectionId].sort().join(":"));
    }
  }
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
    users: users.length,
    connections: connections.length,
    legacyInteractions: legacyInteractionStats,
    unownedCustomExercises,
    orphanConnections: orphanConnectionIds,
    conflicts: {
      emails: emailConflicts.map(([value, matches]) => ({
        value,
        ids: matches.map((match) => match._id),
      })),
      usernames: usernameConflicts.map(([value, matches]) => ({
        value,
        ids: matches.map((match) => match._id),
      })),
      connectionPairs: connectionConflicts.map(([value, matches]) => ({
        value,
        ids: matches.map((match) => match._id),
      })),
      relationshipLimits: relationshipLimitConflicts,
    },
  }, null, 2));

  if (!applyChanges) {
    console.log("Dry run complete. Re-run with --apply after resolving conflicts.");
    return;
  }
  if (
    emailConflicts.length ||
    usernameConflicts.length ||
    connectionConflicts.length ||
    relationshipLimitConflicts.length
  ) {
    throw new Error(
      "Migration aborted because reported identity, relationship, or connection conflicts must be resolved manually"
    );
  }

  if (normalizedUsers.length) {
    await User.bulkWrite(
      normalizedUsers.map((user) => ({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: {
              email: user.email,
              username: user.username,
              followers: [...relationships.get(user._id).followers],
              following: [...relationships.get(user._id).following],
              connections: [...relationships.get(user._id).connections],
            },
          },
        },
      }))
    );
  }
  if (connectionPairs.length) {
    await Connection.bulkWrite(
      connectionPairs.map((connection) => ({
        updateOne: {
          filter: { _id: connection._id },
          update: { $set: { pairKey: connection.pairKey } },
        },
      }))
    );
  }
  if (orphanConnectionIds.length) {
    await Connection.deleteMany({ _id: { $in: orphanConnectionIds } });
  }
  if (acceptedConnectionPairs.size) {
    await Connection.bulkWrite(
      [...acceptedConnectionPairs].map((pairKey) => {
        const [fromUserId, toUserId] = pairKey.split(":");
        return {
          updateOne: {
            filter: { pairKey },
            update: {
              $set: {
                pairKey,
                from_user_id: fromUserId,
                to_user_id: toUserId,
                status: "accepted",
              },
            },
            upsert: true,
          },
        };
      })
    );
  }

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
      { $unset: { likes_count: "", comments: "" } }
    );
  }

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
    await User.bulkWrite(
      statistics.map((entry) => ({
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
      }))
    );
  }

  await Story.updateMany(
    { views_count: { $exists: true } },
    { $unset: { views_count: "" } }
  );

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
