import mongoose from "mongoose";
import "../models/modelRegistry.js";
import Connection from "../models/Connection.js";
import Conversation from "../models/Conversation.js";
import DatabaseMigration from "../models/DatabaseMigration.js";
import Message from "../models/Message.js";
import Post from "../models/Post.js";
import PostComment from "../models/PostComment.js";
import PostLike from "../models/PostLike.js";
import Story from "../models/Story.js";
import User from "../models/User.js";
import UserFollow from "../models/UserFollow.js";

const MIGRATION_ID = "001-integrity-index-contract";
const MIGRATION_CHECKSUM = "2026-07-29-v5";
const BATCH_SIZE = 500;

const duplicateContracts = [
  ["users.email", "users", ["email"]],
  ["users.username", "users", ["username"]],
  ["plans.name", "plans", ["name"]],
  ["plans.slug", "plans", ["slug"]],
  ["exercises.externalId", "exercises", ["externalId"]],
  ["postlikes.edge", "postlikes", ["postId", "userId"]],
  ["userfollows.edge", "userfollows", ["followerId", "followeeId"]],
  ["storyviews.edge", "storyviews", ["storyId", "userId"]],
  ["usages.bucket", "usages", ["userId", "bucket"]],
  ["equipment.code", "equipment", ["code"]],
  ["musclegroups.code", "musclegroups", ["code"]],
  ["mediadeletionjobs.key", "mediadeletionjobs", ["key"]],
  ["uploadreservations.key", "uploadreservations", ["key"]],
  ["passwordresettokens.tokenHash", "passwordresettokens", ["tokenHash"]],
];

const findDuplicates = async (collectionName, fields) => {
  const collection = mongoose.connection.collection(collectionName);
  const id = Object.fromEntries(fields.map((field) => [field, `$${field}`]));
  return collection
    .aggregate([
      {
        $match: Object.fromEntries(
          fields.map((field) => [field, { $exists: true, $ne: null }])
        ),
      },
      { $group: { _id: id, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 },
    ])
    .toArray();
};

export const inspectUnsafeDuplicates = async () => {
  const problems = [];
  for (const [name, collection, fields] of duplicateContracts) {
    const duplicates = await findDuplicates(collection, fields);
    if (duplicates.length) {
      problems.push({ name, collection, fields, duplicates });
    }
  }
  return problems;
};

const relationContracts = [
  ["userfollows.follower", "userfollows", "followerId", "users"],
  ["userfollows.followee", "userfollows", "followeeId", "users"],
  ["connections.sender", "connections", "from_user_id", "users"],
  ["connections.recipient", "connections", "to_user_id", "users"],
  ["postlikes.post", "postlikes", "postId", "posts"],
  ["postlikes.user", "postlikes", "userId", "users"],
  ["postcomments.post", "postcomments", "postId", "posts"],
  ["postcomments.user", "postcomments", "userId", "users"],
  ["storyviews.story", "storyviews", "storyId", "stories"],
  ["storyviews.user", "storyviews", "userId", "users"],
  ["messages.sender", "messages", "from_user_id", "users"],
  ["messages.recipient", "messages", "to_user_id", "users"],
  ["posts.user", "posts", "user", "users"],
  ["posts.workout", "posts", "workout", "workouts"],
  ["stories.user", "stories", "user", "users"],
  ["workouts.user", "workouts", "userId", "users"],
  ["routines.user", "routines", "userId", "users"],
  ["sessions.user", "sessions", "userId", "users"],
  ["passwordresettokens.user", "passwordresettokens", "userId", "users"],
  ["usages.user", "usages", "userId", "users"],
  ["uploadreservations.user", "uploadreservations", "userId", "users"],
  ["personalrecords.user", "personalrecords", "userId", "users"],
  ["personalrecords.exercise", "personalrecords", "exerciseId", "exercises"],
  ["userdailyworkoutstats.user", "userdailyworkoutstats", "userId", "users"],
  ["userexercisedailystats.user", "userexercisedailystats", "userId", "users"],
  [
    "userexercisedailystats.exercise",
    "userexercisedailystats",
    "exerciseId",
    "exercises",
  ],
];

export const inspectUnsafeRelations = async () => {
  const problems = [];
  const selfEdges = [
    ["userfollows.self", "userfollows", "followerId", "followeeId"],
    ["connections.self", "connections", "from_user_id", "to_user_id"],
    ["messages.self", "messages", "from_user_id", "to_user_id"],
  ];
  for (const [name, collectionName, left, right] of selfEdges) {
    const documents = await mongoose.connection
      .collection(collectionName)
      .find({ $expr: { $eq: [`$${left}`, `$${right}`] } })
      .project({ [left]: 1, [right]: 1 })
      .limit(20)
      .toArray();
    if (documents.length) {
      problems.push({ name, collection: collectionName, documents });
    }
  }

  for (const [name, collectionName, localField, foreignCollection] of
    relationContracts) {
    const documents = await mongoose.connection
      .collection(collectionName)
      .aggregate([
        { $match: { [localField]: { $exists: true, $ne: null } } },
        {
          $lookup: {
            from: foreignCollection,
            localField,
            foreignField: "_id",
            as: "relatedDocument",
          },
        },
        { $match: { relatedDocument: { $eq: [] } } },
        { $project: { relatedDocument: 0 } },
        { $limit: 20 },
      ])
      .toArray();
    if (documents.length) {
      problems.push({
        name,
        collection: collectionName,
        localField,
        foreignCollection,
        documents,
      });
    }
  }
  return problems;
};

const mergeConnectionDuplicates = async () => {
  /** @type {any[]} */
  const pipeline = [
    {
      $set: {
        canonicalPairKey: {
          $cond: [
            { $lte: ["$from_user_id", "$to_user_id"] },
            { $concat: ["$from_user_id", ":", "$to_user_id"] },
            { $concat: ["$to_user_id", ":", "$from_user_id"] },
          ],
        },
        statusPriority: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] },
      },
    },
    {
      $sort: {
        canonicalPairKey: 1,
        statusPriority: -1,
        updatedAt: -1,
        _id: -1,
      },
    },
    {
      $group: {
        _id: "$canonicalPairKey",
        keepId: { $first: "$_id" },
        accepted: { $max: "$statusPriority" },
        ids: { $push: "$_id" },
      },
    },
  ];

  for await (const entry of Connection.aggregate(pipeline)
    .allowDiskUse(true)
    .cursor()) {
    await Connection.updateOne(
      { _id: entry.keepId },
      {
        $set: {
          pairKey: entry._id,
          status: entry.accepted ? "accepted" : "pending",
        },
      }
    );
    if (entry.ids.length > 1) {
      await Connection.deleteMany({
        _id: { $in: entry.ids.filter((id) => !id.equals(entry.keepId)) },
      });
    }
  }
};

const rebuildConversations = async () => {
  await Conversation.collection.deleteMany({});

  /** @type {any[]} */
  const pipeline = [
    {
      $project: {
        pairKey: {
          $cond: [
            { $lte: ["$from_user_id", "$to_user_id"] },
            { $concat: ["$from_user_id", ":", "$to_user_id"] },
            { $concat: ["$to_user_id", ":", "$from_user_id"] },
          ],
        },
        participants: {
          $cond: [
            { $lte: ["$from_user_id", "$to_user_id"] },
            ["$from_user_id", "$to_user_id"],
            ["$to_user_id", "$from_user_id"],
          ],
        },
        from_user_id: 1,
        to_user_id: 1,
        seen: 1,
        createdAt: 1,
      },
    },
    { $sort: { pairKey: 1, createdAt: 1, _id: 1 } },
    {
      $group: {
        _id: "$pairKey",
        participants: { $first: "$participants" },
        lastMessage: { $last: "$_id" },
        lastMessageAt: { $last: "$createdAt" },
        firstUnread: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$seen", false] },
                  { $eq: ["$to_user_id", { $arrayElemAt: ["$participants", 0] }] },
                ],
              },
              1,
              0,
            ],
          },
        },
        secondUnread: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$seen", false] },
                  { $eq: ["$to_user_id", { $arrayElemAt: ["$participants", 1] }] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ];

  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const created = await Conversation.insertMany(
      batch.map((entry) => ({
        pairKey: entry._id,
        participants: entry.participants,
        lastMessage: entry.lastMessage,
        lastMessageAt: entry.lastMessageAt,
        unreadByUser: {
          [entry.participants[0]]: entry.firstUnread,
          [entry.participants[1]]: entry.secondUnread,
        },
      })),
      { ordered: true }
    );
    for (let index = 0; index < created.length; index += 1) {
      const conversation = created[index];
      const [left, right] = batch[index].participants;
      await Message.updateMany(
        {
          $or: [
            { from_user_id: left, to_user_id: right },
            { from_user_id: right, to_user_id: left },
          ],
        },
        { $set: { conversationId: conversation._id } }
      );
    }
    batch = [];
  };

  for await (const entry of Message.aggregate(pipeline).allowDiskUse(true).cursor()) {
    batch.push(entry);
    if (batch.length === BATCH_SIZE) await flush();
  }
  await flush();
};

const reconcileGroupedCount = async ({
  source,
  groupField,
  target,
  targetField,
}) => {
  await target.updateMany({}, { $set: { [targetField]: 0 } });
  let operations = [];
  for await (const entry of source.aggregate([
    { $group: { _id: `$${groupField}`, count: { $sum: 1 } } },
  ]).cursor()) {
    if (entry._id === null || entry._id === undefined) continue;
    operations.push({
      updateOne: {
        filter: { _id: entry._id },
        update: { $set: { [targetField]: entry.count } },
      },
    });
    if (operations.length === BATCH_SIZE) {
      await target.bulkWrite(operations);
      operations = [];
    }
  }
  if (operations.length) await target.bulkWrite(operations);
};

export const reconcileDerivedCounts = async () => {
  await Promise.all([
    reconcileGroupedCount({
      source: UserFollow,
      groupField: "followerId",
      target: User,
      targetField: "following_count",
    }),
    reconcileGroupedCount({
      source: UserFollow,
      groupField: "followeeId",
      target: User,
      targetField: "followers_count",
    }),
    reconcileGroupedCount({
      source: PostLike,
      groupField: "postId",
      target: Post,
      targetField: "like_count",
    }),
    reconcileGroupedCount({
      source: PostComment,
      groupField: "postId",
      target: Post,
      targetField: "comment_count",
    }),
  ]);

  await User.updateMany({}, { $set: { connections_count: 0 } });
  const connectionCounts = await Connection.aggregate([
    { $match: { status: "accepted" } },
    { $project: { users: ["$from_user_id", "$to_user_id"] } },
    { $unwind: "$users" },
    { $group: { _id: "$users", count: { $sum: 1 } } },
  ]);
  if (connectionCounts.length) {
    await User.bulkWrite(
      connectionCounts.map((entry) => ({
        updateOne: {
          filter: { _id: entry._id },
          update: { $set: { connections_count: entry.count } },
        },
      }))
    );
  }
};

const removeObsoleteIndexes = async () => {
  const storyIndexes = await Story.collection.indexes();
  if (storyIndexes.some((index) => index.name === "StoryTTLIndex")) {
    await Story.collection.dropIndex("StoryTTLIndex");
  }
};

export const createApplicationIndexes = async () => {
  for (const modelName of mongoose.modelNames().sort()) {
    await mongoose.model(modelName).createIndexes();
  }
};

const synchronizeApplicationIndexes = async () => {
  for (const modelName of mongoose.modelNames().sort()) {
    await mongoose.model(modelName).syncIndexes();
  }
};

const applyCollectionValidators = async () => {
  const validators = {
    users: {
      bsonType: "object",
      required: ["_id", "email", "username", "full_name", "password"],
      properties: {
        _id: { bsonType: "string" },
        email: { bsonType: "string", maxLength: 254 },
        username: { bsonType: "string", minLength: 3, maxLength: 30 },
        followers_count: { bsonType: ["double", "int", "long"], minimum: 0 },
        following_count: { bsonType: ["double", "int", "long"], minimum: 0 },
        connections_count: { bsonType: ["double", "int", "long"], minimum: 0 },
      },
    },
    connections: {
      bsonType: "object",
      required: ["from_user_id", "to_user_id", "pairKey", "status"],
      properties: {
        from_user_id: { bsonType: "string" },
        to_user_id: { bsonType: "string" },
        pairKey: { bsonType: "string", maxLength: 128 },
        status: { enum: ["pending", "accepted"] },
      },
    },
    conversations: {
      bsonType: "object",
      required: ["pairKey", "participants"],
      properties: {
        pairKey: { bsonType: "string", maxLength: 128 },
        participants: {
          bsonType: "array",
          minItems: 2,
          maxItems: 2,
          items: { bsonType: "string" },
        },
      },
    },
    workouts: {
      bsonType: "object",
      required: ["userId", "name", "startTime", "exercises"],
      properties: {
        userId: { bsonType: "string" },
        name: { bsonType: "string", maxLength: 120 },
        exercises: {
          bsonType: "array",
          minItems: 1,
          maxItems: 50,
          items: {
            bsonType: "object",
            required: ["exerciseId", "sets"],
            properties: {
              sets: { bsonType: "array", minItems: 1, maxItems: 30 },
            },
          },
        },
      },
    },
    routines: {
      bsonType: "object",
      required: ["userId", "name", "exercises"],
      properties: {
        userId: { bsonType: "string" },
        name: { bsonType: "string", maxLength: 120 },
        exercises: {
          bsonType: "array",
          maxItems: 50,
          items: {
            bsonType: "object",
            required: ["exerciseId", "sets"],
            properties: {
              sets: { bsonType: "array", maxItems: 30 },
            },
          },
        },
      },
    },
    messages: {
      bsonType: "object",
      required: ["from_user_id", "to_user_id", "message_type", "seen"],
      properties: {
        from_user_id: { bsonType: "string" },
        to_user_id: { bsonType: "string" },
        message_type: { enum: ["text", "image"] },
        text: { bsonType: "string", maxLength: 2000 },
      },
    },
    userfollows: {
      bsonType: "object",
      required: ["followerId", "followeeId"],
      properties: {
        followerId: { bsonType: "string" },
        followeeId: { bsonType: "string" },
      },
    },
    postlikes: {
      bsonType: "object",
      required: ["postId", "userId"],
      properties: {
        postId: { bsonType: "objectId" },
        userId: { bsonType: "string" },
      },
    },
    storyviews: {
      bsonType: "object",
      required: ["storyId", "userId"],
      properties: {
        storyId: { bsonType: "objectId" },
        userId: { bsonType: "string" },
      },
    },
    usages: {
      bsonType: "object",
      required: ["userId", "bucket", "count"],
      properties: {
        userId: { bsonType: "string" },
        bucket: { bsonType: "string", maxLength: 64 },
        count: { bsonType: ["double", "int", "long"], minimum: 0 },
      },
    },
  };

  for (const [collection, schema] of Object.entries(validators)) {
    const distinctEdgeFields = {
      connections: ["from_user_id", "to_user_id"],
      messages: ["from_user_id", "to_user_id"],
      userfollows: ["followerId", "followeeId"],
    }[collection];
    const validator = { $jsonSchema: schema };
    if (distinctEdgeFields) {
      validator.$expr = {
        $ne: [
          `$${distinctEdgeFields[0]}`,
          `$${distinctEdgeFields[1]}`,
        ],
      };
    } else if (collection === "conversations") {
      validator.$expr = {
        $ne: [
          { $arrayElemAt: ["$participants", 0] },
          { $arrayElemAt: ["$participants", 1] },
        ],
      };
    }
    await mongoose.connection.db.command({
      collMod: collection,
      validator,
      validationLevel: "moderate",
      validationAction: "error",
    });
  }
};

export const verifyIndexContract = async () => {
  const missing = [];
  for (const modelName of mongoose.modelNames().sort()) {
    const model = mongoose.model(modelName);
    const difference = await model.diffIndexes({ indexOptionsToCreate: true });
    if (difference.toCreate.length) {
      missing.push({ model: modelName, indexes: difference.toCreate });
    }
  }
  return missing;
};

export const getIntegrityMigrationStatus = async () => {
  const applied = await DatabaseMigration.findById(MIGRATION_ID).lean();
  const unsafeDuplicates = await inspectUnsafeDuplicates();
  const unsafeRelations = await inspectUnsafeRelations();
  const missingIndexes = await verifyIndexContract();
  return {
    id: MIGRATION_ID,
    checksum: MIGRATION_CHECKSUM,
    applied: Boolean(applied),
    checksumMatches: !applied || applied.checksum === MIGRATION_CHECKSUM,
    unsafeDuplicates,
    unsafeRelations,
    missingIndexes,
  };
};

export const applyIntegrityMigration = async () => {
  const existing = await DatabaseMigration.findById(MIGRATION_ID).lean();
  if (existing?.checksum === MIGRATION_CHECKSUM) {
    return { alreadyApplied: true, ...(await getIntegrityMigrationStatus()) };
  }
  if (existing) {
    throw new Error(
      `Migration ${MIGRATION_ID} checksum mismatch; manual review is required`
    );
  }

  const unsafeDuplicates = await inspectUnsafeDuplicates();
  if (unsafeDuplicates.length) {
    const names = unsafeDuplicates.map((problem) => problem.name).join(", ");
    throw new Error(`Unsafe duplicate data blocks migration: ${names}`);
  }
  const unsafeRelations = await inspectUnsafeRelations();
  if (unsafeRelations.length) {
    const names = unsafeRelations.map((problem) => problem.name).join(", ");
    throw new Error(`Unsafe relationship data blocks migration: ${names}`);
  }

  await User.collection.updateMany({}, { $unset: { connections: "" } });
  await mongoose.connection.collection("exercises").updateMany(
    {},
    [
      {
        $set: {
          isCustom: { $eq: ["$isCustom", true] },
          nameNormalized: {
            $toLower: { $trim: { input: { $ifNull: ["$name", ""] } } },
          },
        },
      },
    ]
  );
  await mergeConnectionDuplicates();
  await rebuildConversations();
  await reconcileDerivedCounts();
  await removeObsoleteIndexes();
  await synchronizeApplicationIndexes();
  await applyCollectionValidators();
  const missingIndexes = await verifyIndexContract();
  if (missingIndexes.length) {
    throw new Error(
      `Index contract is incomplete after migration: ${missingIndexes
        .map((entry) => entry.model)
        .join(", ")}`
    );
  }

  await DatabaseMigration.create({
    _id: MIGRATION_ID,
    checksum: MIGRATION_CHECKSUM,
    appliedAt: new Date(),
  });
  return { alreadyApplied: false, ...(await getIntegrityMigrationStatus()) };
};

export const REQUIRED_INTEGRITY_MIGRATION = {
  id: MIGRATION_ID,
  checksum: MIGRATION_CHECKSUM,
};

export const assertDatabaseContract = async () => {
  const migration = await DatabaseMigration.findById(MIGRATION_ID).lean();
  if (!migration || migration.checksum !== MIGRATION_CHECKSUM) {
    throw new Error(
      `Required database migration ${MIGRATION_ID} is not applied; run migrate:integrity:apply`
    );
  }
  const missingIndexes = await verifyIndexContract();
  if (missingIndexes.length) {
    throw new Error(
      `Database index contract is incomplete: ${missingIndexes
        .map((entry) => entry.model)
        .join(", ")}`
    );
  }
  const storyIndexes = await Story.collection.indexes();
  if (storyIndexes.some((index) => index.name === "StoryTTLIndex")) {
    throw new Error(
      "Obsolete StoryTTLIndex is still active and can orphan external media"
    );
  }
};
