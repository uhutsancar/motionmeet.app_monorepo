import mongoose from "mongoose";
import Post from "../models/Post.js";
import PostComment from "../models/PostComment.js";
import PostLike from "../models/PostLike.js";
import User from "../models/User.js";
import UserFollow from "../models/UserFollow.js";
import {
  createCursor,
  cursorFilter,
  pageFromDocuments,
} from "../utils/pagination.js";

const PUBLIC_USER_FIELDS = "_id full_name username profile_picture";
const COMMENT_PREVIEW_LIMIT = 20;

const asPlainObject = (value) =>
  value?.toObject ? value.toObject() : { ...value };

export const hydratePostInteractions = async (
  documents,
  requesterId,
  previewLimit = COMMENT_PREVIEW_LIMIT
) => {
  const posts = documents.map(asPlainObject);
  const postIds = posts.map((post) => post._id).filter(Boolean);
  if (!postIds.length) return posts;
  const authorIds = [
    ...new Set(
      posts
        .map((post) => post.user?._id || post.user)
        .filter(Boolean)
        .map(String)
    ),
  ];

  const [requesterLikes, requesterFollows, commentPreviews] =
    await Promise.all([
      requesterId
        ? PostLike.find({
            postId: { $in: postIds },
            userId: requesterId,
          })
            .select("postId")
            .lean()
        : [],
      requesterId && authorIds.length
        ? UserFollow.find({
            followerId: String(requesterId),
            followeeId: { $in: authorIds },
          })
            .select("followeeId")
            .lean()
        : [],
      PostComment.aggregate([
        { $match: { postId: { $in: postIds } } },
        {
          $setWindowFields: {
            partitionBy: "$postId",
            sortBy: { createdAt: -1 },
            output: {
              postRank: { $documentNumber: {} },
            },
          },
        },
        { $match: { postRank: { $lte: previewLimit } } },
        { $project: { postRank: 0 } },
      ]),
    ]);

  const commentUserIds = [
    ...new Set(commentPreviews.map((comment) => comment.userId)),
  ];
  const commentUsers = commentUserIds.length
    ? await User.find({ _id: { $in: commentUserIds } })
        .select(PUBLIC_USER_FIELDS)
        .lean()
    : [];

  const likedPostIds = new Set(
    requesterLikes.map((entry) => entry.postId.toString())
  );
  const followedAuthorIds = new Set(
    requesterFollows.map((entry) => String(entry.followeeId))
  );
  const userById = new Map(commentUsers.map((user) => [user._id, user]));
  const commentsByPost = new Map();

  for (const comment of commentPreviews) {
    const postId = comment.postId.toString();
    const comments = commentsByPost.get(postId) || [];
    comments.push({
      _id: comment._id,
      content: comment.content,
      createdAt: comment.createdAt,
      user: userById.get(comment.userId) || null,
    });
    commentsByPost.set(postId, comments);
  }

  for (const comments of commentsByPost.values()) {
    comments.sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
  }

  return posts.map((post) => {
    const postId = post._id.toString();
    const authorId = String(post.user?._id || post.user || "");
    const comments = commentsByPost.get(postId) || [];
    const commentCount = post.comment_count || 0;
    return {
      ...post,
      like_count: post.like_count || 0,
      liked_by_me: likedPostIds.has(postId),
      author_followed_by_me: followedAuthorIds.has(authorId),
      comment_count: commentCount,
      comment_next_cursor:
        commentCount > comments.length ? createCursor(comments[0]) : null,
      comments,
    };
  });
};

/**
 * @deprecated Use idempotent likePost / unlikePost instead.
 * Kept for backward compatibility with older mobile clients.
 */
export const togglePostLike = async (postId, userId) => {
  let liked = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const removed = await PostLike.findOneAndDelete(
        { postId, userId },
        { session }
      );
      if (removed) {
        await Post.updateOne(
          { _id: postId },
          [{ $set: { like_count: { $max: [0, { $subtract: [{ $ifNull: ["$like_count", 0] }, 1] }] } } }],
          { session }
        );
        return;
      }
      const post = await Post.exists({ _id: postId }).session(session);
      if (!post) {
        throw Object.assign(new Error("Post not found"), { status: 404 });
      }
      await PostLike.create([{ postId, userId }], { session });
      await Post.updateOne(
        { _id: postId },
        { $inc: { like_count: 1 } },
        { session }
      );
      liked = true;
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  } finally {
    await session.endSession();
  }

  const postDoc = await Post.findById(postId).select("like_count").lean();
  return { liked, likeCount: postDoc?.like_count || 0 };
};

/**
 * Idempotent like — always results in liked: true.
 * Uses a transaction to verify the post still exists before creating the like,
 * preventing orphaned likes when a post is concurrently deleted.
 */
export const likePost = async (postId, userId) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const post = await Post.exists({ _id: postId }).session(session);
      if (!post) {
        throw Object.assign(new Error("Post not found"), { status: 404 });
      }
      const edge = await PostLike.updateOne(
        { postId, userId },
        { $setOnInsert: { postId, userId } },
        { upsert: true, session }
      );
      if (edge.upsertedCount === 1) {
        await Post.updateOne(
          { _id: postId },
          { $inc: { like_count: 1 } },
          { session }
        );
      }
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  } finally {
    await session.endSession();
  }
  const postDoc = await Post.findById(postId).select("like_count").lean();
  return { liked: true, likeCount: postDoc?.like_count || 0 };
};

/**
 * Idempotent unlike — always results in liked: false.
 * Safe to call even if the like doesn't exist.
 */
export const unlikePost = async (postId, userId) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const removed = await PostLike.deleteOne({ postId, userId }, { session });
      if (removed.deletedCount) {
        await Post.updateOne(
          { _id: postId },
          [{ $set: { like_count: { $max: [0, { $subtract: [{ $ifNull: ["$like_count", 0] }, 1] }] } } }],
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }
  const postDoc = await Post.findById(postId).select("like_count").lean();
  return { liked: false, likeCount: postDoc?.like_count || 0 };
};

export const createPostComment = async (postId, userId, content) => {
  const session = await mongoose.startSession();
  /** @type {any} */
  let comment;
  try {
    await session.withTransaction(async () => {
      const post = await Post.exists({ _id: postId }).session(session);
      if (!post) {
        throw Object.assign(new Error("Post not found"), { status: 404 });
      }
      [comment] = await PostComment.create(
        [{ postId, userId, content: content.trim() }],
        { session }
      );
      await Post.updateOne(
        { _id: postId },
        { $inc: { comment_count: 1 } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  if (!comment) {
    throw new Error("Failed to create comment");
  }
  const [user, postDoc] = await Promise.all([
    User.findById(userId).select(PUBLIC_USER_FIELDS).lean(),
    Post.findById(postId).select("comment_count").lean(),
  ]);

  return {
    comment: {
      _id: comment._id,
      content: comment.content,
      createdAt: comment.createdAt,
      user,
    },
    commentCount: postDoc?.comment_count || 0,
  };
};

export const getPostComments = async (postId, pagination) => {
  const comments = await PostComment.find({
    postId,
    ...cursorFilter(pagination.cursor, "createdAt"),
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(pagination.limit + 1)
    .lean();
  const page = pageFromDocuments(comments, pagination.limit, "createdAt");
  const userIds = [...new Set(page.items.map((comment) => comment.userId))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select(PUBLIC_USER_FIELDS)
        .lean()
    : [];
  const userById = new Map(users.map((user) => [user._id, user]));

  return {
    ...page,
    items: page.items.map((comment) => ({
      _id: comment._id,
      content: comment.content,
      createdAt: comment.createdAt,
      user: userById.get(comment.userId) || null,
    })),
  };
};

export const deleteInteractionsForPost = async (postId, options = {}) => {
  await PostLike.deleteMany({ postId }, options);
  await PostComment.deleteMany({ postId }, options);
};
