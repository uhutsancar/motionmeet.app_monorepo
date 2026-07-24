import PostComment from "../models/PostComment.js";
import PostLike from "../models/PostLike.js";
import User from "../models/User.js";
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

  const [likeCounts, requesterLikes, commentCounts, commentPreviews] =
    await Promise.all([
      PostLike.aggregate([
        { $match: { postId: { $in: postIds } } },
        { $group: { _id: "$postId", count: { $sum: 1 } } },
      ]),
      requesterId
        ? PostLike.find({
            postId: { $in: postIds },
            userId: requesterId,
          })
            .select("postId")
            .lean()
        : [],
      PostComment.aggregate([
        { $match: { postId: { $in: postIds } } },
        { $group: { _id: "$postId", count: { $sum: 1 } } },
      ]),
      PostComment.aggregate([
        { $match: { postId: { $in: postIds } } },
        {
          $setWindowFields: {
            partitionBy: "$postId",
            sortBy: { createdAt: -1, _id: -1 },
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

  const likeCountByPost = new Map(
    likeCounts.map((entry) => [entry._id.toString(), entry.count])
  );
  const likedPostIds = new Set(
    requesterLikes.map((entry) => entry.postId.toString())
  );
  const commentCountByPost = new Map(
    commentCounts.map((entry) => [entry._id.toString(), entry.count])
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
    const comments = commentsByPost.get(postId) || [];
    const commentCount = commentCountByPost.get(postId) || 0;
    return {
      ...post,
      like_count: likeCountByPost.get(postId) || 0,
      liked_by_me: likedPostIds.has(postId),
      comment_count: commentCount,
      comment_next_cursor:
        commentCount > comments.length ? createCursor(comments[0]) : null,
      comments,
    };
  });
};

export const togglePostLike = async (postId, userId) => {
  const removed = await PostLike.findOneAndDelete({ postId, userId });
  let liked = false;

  if (!removed) {
    try {
      await PostLike.create({ postId, userId });
      liked = true;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      liked = true;
    }
  }

  const likeCount = await PostLike.countDocuments({ postId });
  return { liked, likeCount };
};

export const createPostComment = async (postId, userId, content) => {
  const comment = await PostComment.create({
    postId,
    userId,
    content: content.trim(),
  });
  const [user, commentCount] = await Promise.all([
    User.findById(userId).select(PUBLIC_USER_FIELDS).lean(),
    PostComment.countDocuments({ postId }),
  ]);

  return {
    comment: {
      _id: comment._id,
      content: comment.content,
      createdAt: comment.createdAt,
      user,
    },
    commentCount,
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
