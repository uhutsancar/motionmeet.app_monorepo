import mongoose from "mongoose";
import Post from "../models/Post.js";
import User from "../models/User.js";
import UserFollow from "../models/UserFollow.js";
import Connection from "../models/Connection.js";
import Workout from "../models/Workout.js";
import { cursorFilter, pageFromDocuments } from "../utils/pagination.js";
import {
  createPostComment,
  deleteInteractionsForPost,
  getPostComments,
  hydratePostInteractions,
  likePost,
  togglePostLike,
  unlikePost,
} from "./postInteractionService.js";
import * as quotaService from "./quotaService.js";
import { commitReservedUploads } from "./mediaUploadService.js";
import { queueMediaDeletions } from "./mediaDeletionService.js";
import { extractS3Key } from "../utils/s3Utils.js";

export const canAccessPost = async (post, requester) => {
  const ownerId = post.user.toString();
  if (ownerId === requester._id.toString() || post.visibility === "public") return true;
  if (post.visibility !== "followers") return false;

  const [isFollowing, isConnected] = await Promise.all([
    UserFollow.exists({ followerId: requester._id, followeeId: ownerId }),
    Connection.exists({
      status: "accepted",
      $or: [
        { from_user_id: requester._id, to_user_id: ownerId },
        { from_user_id: ownerId, to_user_id: requester._id }
      ]
    })
  ]);

  return Boolean(isFollowing || isConnected);
};

export const checkWorkoutExists = async (workoutId, userId) => {
  return await Workout.exists({ _id: workoutId, userId });
};

export const findPostByOperation = async (userId, operationId) =>
  Post.findOne({ user: userId, operationId });

export const createPost = async (
  postData,
  { quotaLimit = -1, reservationKeys = [] } = {}
) => {
  if (postData.operationId) {
    const existing = await findPostByOperation(
      postData.user,
      postData.operationId
    );
    if (existing) return existing;
  }
  const user = await User.findById(postData.user).select("full_name username profile_picture").lean();
  if (user) {
    postData.author_profile = {
      full_name: user.full_name,
      username: user.username,
      profile_picture: user.profile_picture || "",
    };
  }
  const session = await mongoose.startSession();
  let post = null;
  try {
    try {
      await session.withTransaction(async () => {
        if (quotaLimit !== -1) {
          const now = new Date();
          const bucket = quotaService.dailyBucket("posts", now);
          const dayStart = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
          const reserved = await quotaService.reserveQuota({
            userId: postData.user,
            bucket,
            limit: quotaLimit,
            getCurrentCount: () =>
              Post.countDocuments({
                user: postData.user,
                createdAt: { $gte: dayStart },
              }).session(session),
            session,
            expiresAt: quotaService.shortLivedUsageExpiry(now),
          });
          if (!reserved) {
            throw Object.assign(
              new Error(`Daily post limit reached (${quotaLimit})`),
              { status: 403 }
            );
          }
        }
        [post] = await Post.create([postData], { session });
        await commitReservedUploads(reservationKeys, {
          session,
          userId: postData.user,
        });
      });
    } catch (error) {
      if (error?.code !== 11000 || !postData.operationId) throw error;
      post = await findPostByOperation(postData.user, postData.operationId);
      if (!post) throw error;
    }
    return post;
  } finally {
    await session.endSession();
  }
};

export const getFeedPostsForUser = async (userId, pagination, mode = "discover") => {
  if (mode === "following") {
    const relationshipCounts = await User.findById(userId)
      .select("following_count connections_count")
      .lean();
    const sourceCount =
      Number(relationshipCounts?.following_count || 0) +
      Number(relationshipCounts?.connections_count || 0);
    if (sourceCount <= 2_000) {
      const [followingEdges, connectionEdges] = await Promise.all([
        UserFollow.find({ followerId: userId }).select("followeeId").lean(),
        Connection.find({
          status: "accepted",
          $or: [{ from_user_id: userId }, { to_user_id: userId }],
        })
          .select("from_user_id to_user_id")
          .lean(),
      ]);
      const socialIds = [
        ...new Set([
          ...followingEdges.map((edge) => edge.followeeId.toString()),
          ...connectionEdges.map((connection) =>
            connection.from_user_id.toString() === userId.toString()
              ? connection.to_user_id.toString()
              : connection.from_user_id.toString()
          ),
        ]),
      ];
      const hiddenWorkoutOwners = await User.find({
        _id: { $in: socialIds },
        "privacy.showWorkoutsOnFeed": false,
      }).distinct("_id");
      const posts = await Post.find({
        $and: [
          {
            $or: [
              { user: userId },
              { user: { $in: socialIds }, visibility: "public" },
              { user: { $in: socialIds }, visibility: "followers" },
            ],
          },
          cursorFilter(pagination.cursor, "createdAt"),
        ],
        $nor: [
          {
            user: { $in: hiddenWorkoutOwners },
            post_type: "workout",
          },
        ],
      })
        .populate({
          path: "workout",
          populate: {
            path: "exercises.exerciseId",
            select: "name muscleGroup equipment imageUrl gifUrl",
          },
        })
        .sort({ createdAt: -1, _id: -1 })
        .limit(pagination.limit + 1);
      const page = pageFromDocuments(posts, pagination.limit, "createdAt");
      page.items = await hydratePostInteractions(page.items, userId);
      page.items = page.items.map((post) => {
        const postObject = post.toObject ? post.toObject() : post;
        if (postObject.author_profile?.username) {
          postObject.user = {
            _id: postObject.user,
            ...postObject.author_profile,
          };
        }
        return postObject;
      });
      return page;
    }

    const cursorMatch = pagination.cursor
      ? {
          $or: [
            { createdAt: { $lt: pagination.cursor.date } },
            {
              createdAt: pagination.cursor.date,
              _id: { $lt: new mongoose.Types.ObjectId(pagination.cursor.id) },
            },
          ],
        }
      : {};
    const documents = await Post.aggregate([
      {
        $match: {
          ...cursorMatch,
          $or: [
            { user: userId },
            { visibility: { $in: ["public", "followers"] } },
          ],
        },
      },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $lookup: {
          from: UserFollow.collection.name,
          let: { authorId: "$user" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$followerId", userId] },
                    { $eq: ["$followeeId", "$$authorId"] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: "followAccess",
        },
      },
      {
        $set: {
          feedPairKey: {
            $cond: [
              { $lte: ["$user", userId] },
              { $concat: ["$user", ":", userId] },
              { $concat: [userId, ":", "$user"] },
            ],
          },
        },
      },
      {
        $lookup: {
          from: Connection.collection.name,
          localField: "feedPairKey",
          foreignField: "pairKey",
          pipeline: [
            { $match: { status: "accepted" } },
            { $limit: 1 },
          ],
          as: "connectionAccess",
        },
      },
      {
        $lookup: {
          from: User.collection.name,
          localField: "user",
          foreignField: "_id",
          pipeline: [{ $project: { "privacy.showWorkoutsOnFeed": 1 } }],
          as: "feedAuthor",
        },
      },
      {
        $match: {
          $expr: {
            $and: [
              {
                $or: [
                  { $eq: ["$user", userId] },
                  { $gt: [{ $size: "$followAccess" }, 0] },
                  { $gt: [{ $size: "$connectionAccess" }, 0] },
                ],
              },
              {
                $or: [
                  { $ne: ["$post_type", "workout"] },
                  { $eq: ["$user", userId] },
                  {
                    $ne: [
                      {
                        $arrayElemAt: [
                          "$feedAuthor.privacy.showWorkoutsOnFeed",
                          0,
                        ],
                      },
                      false,
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      { $limit: pagination.limit + 1 },
      {
        $unset: [
          "followAccess",
          "connectionAccess",
          "feedPairKey",
          "feedAuthor",
        ],
      },
    ]).allowDiskUse(true);
    const hydrated = documents.map((document) => Post.hydrate(document));
    await Post.populate(hydrated, {
      path: "workout",
      populate: {
        path: "exercises.exerciseId",
        select: "name muscleGroup equipment imageUrl gifUrl",
      },
    });
    const page = pageFromDocuments(
      hydrated,
      pagination.limit,
      "createdAt"
    );
    page.items = await hydratePostInteractions(page.items, userId);
    page.items = page.items.map((post) => {
      const postObject = post.toObject ? post.toObject() : post;
      if (postObject.author_profile?.username) {
        postObject.user = {
          _id: postObject.user,
          ...postObject.author_profile,
        };
      }
      return postObject;
    });
    return page;
  }

  const accessFilter = {
    $or: [
      { user: userId },
      { visibility: "public", post_type: { $ne: "workout" } },
    ],
  };
  const posts = await Post.find({
    $and: [
      accessFilter,
      cursorFilter(pagination.cursor, "createdAt"),
    ],
  })
    .select("-likes_count -comments")
    .populate({
      path: "workout",
      populate: {
        path: "exercises.exerciseId",
        select: "name muscleGroup equipment imageUrl gifUrl",
      },
    })
    .sort({ createdAt: -1, _id: -1 })
    .limit(pagination.limit + 1);

  const page = pageFromDocuments(posts, pagination.limit, "createdAt");
  page.items = await hydratePostInteractions(page.items, userId);
  
  // Map denormalized author_profile back to user object for frontend compatibility
  page.items = page.items.map((post) => {
    const postObj = post.toObject ? post.toObject() : post;
    if (postObj.author_profile && postObj.author_profile.username) {
      postObj.user = {
        _id: postObj.user,
        ...postObj.author_profile
      };
    }
    return postObj;
  });

  return page;
};

export const getPostById = async (postId) => {
  return await Post.findById(postId).select("+image_keys");
};

export const getPostForLike = async (postId) => {
  return await Post.findById(postId).select("user visibility");
};

/** @deprecated Use idempotentLikePost / idempotentUnlikePost instead */
export const toggleLikePost = togglePostLike;
export const idempotentLikePost = likePost;
export const idempotentUnlikePost = unlikePost;

export const getPostForComment = async (postId) => {
  return await Post.findById(postId).select("user visibility");
};

export const addCommentToPost = createPostComment;
export const getCommentsForPost = getPostComments;

export const deletePostById = async (post) => {
  const mediaKeys = (post.image_urls || [])
    .map((url, index) => post.image_keys?.[index] || extractS3Key(url))
    .filter(Boolean);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await queueMediaDeletions(mediaKeys, { session });
      await deleteInteractionsForPost(post._id, { session });
      await post.deleteOne({ session });
    });
  } finally {
    await session.endSession();
  }
};
