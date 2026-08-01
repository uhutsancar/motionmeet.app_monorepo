import imagekit from "../configs/imageKit.js";
import type { RequestHandler } from "express";
import { isOptionalString, isUuid } from "../utils/validation.js";
import { hasValidMediaSignature } from "../utils/mediaValidation.js";
import * as postService from "../services/postService.js";
import { parsePagination } from "../utils/pagination.js";
import {
  discardReservedUploads,
  resolveReservedUploads,
  uploadAndReserve,
} from "../services/mediaUploadService.js";

const POST_TYPES = new Set(["text", "image", "text_with_image", "video", "workout"]);
const VISIBILITIES = new Set(["public", "followers", "private"]);

export const addPost: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { content, post_type, workout, visibility } = req.body || {};
    const images = Array.isArray(req.files) ? req.files : [];
    const operationId = req.get("Idempotency-Key") || req.body?.operationId;
    if (
      typeof operationId !== "string" ||
      operationId.length < 8 ||
      operationId.length > 128
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid Idempotency-Key header is required",
      });
    }
    const existingPost = await postService.findPostByOperation(
      userId,
      operationId
    );
    if (existingPost) {
      return res.json({ success: true, post: existingPost, idempotentReplay: true });
    }

    if (!isOptionalString(content, 5000)) {
      return res.status(400).json({ success: false, message: "Post content is too long" });
    }
    if (post_type && !POST_TYPES.has(post_type)) {
      return res.status(400).json({ success: false, message: "Invalid post type" });
    }
    if (visibility && !VISIBILITIES.has(visibility)) {
      return res.status(400).json({ success: false, message: "Invalid post visibility" });
    }
    if (workout && !isUuid(workout)) {
      return res.status(400).json({ success: false, message: "Invalid workout id" });
    }
    if (post_type === "workout" && !workout) {
      return res.status(400).json({ success: false, message: "Workout post requires a workout" });
    }
    if (workout && !(await postService.checkWorkoutExists(workout, userId))) {
      return res.status(403).json({ success: false, message: "Workout not found or not owned by user" });
    }
    if (!content?.trim() && images.length === 0 && !workout) {
      return res.status(400).json({ success: false, message: "Post content is required" });
    }
    if (images.some((image) => !hasValidMediaSignature(image))) {
      return res.status(415).json({ success: false, message: "Uploaded image content is invalid" });
    }
    if (images.length > 0 && !imagekit) {
      return res.status(503).json({ success: false, message: "Media service is not configured" });
    }

    const reservedImages = await resolveReservedUploads(
      userId,
      "posts",
      req.body?.uploadedKeys
    );
    if (images.length + reservedImages.length > 4) {
      return res.status(400).json({ success: false, message: "A post can contain at most four images" });
    }

    const uploadedImages = [...reservedImages];
    try {
      for (const image of images) {
        const { key } = await uploadAndReserve({
          file: image.buffer,
          fileName: image.originalname,
          userId,
          purpose: "posts",
          contentType: image.mimetype,
        });
        const cleanKey = key.startsWith('/') ? key.slice(1) : key;
        uploadedImages.push({
          key,
          url: imagekit!.url({
            path: cleanKey,
            ...(image.mimetype.startsWith("image/")
              ? { transformation: [{ quality: "auto" }, { format: "webp" }] }
              : {}),
            transformationPosition: "query",
          }),
          contentType: image.mimetype,
        });
      }
    } catch (error) {
      await discardReservedUploads(uploadedImages.map(({ key }) => key));
      throw error;
    }
    const imageUrls = uploadedImages.map(({ url }) => url);

    let resolvedType = post_type;
    if (!resolvedType) {
      if (workout) resolvedType = "workout";
      else if (uploadedImages.some(({ contentType }) => contentType?.startsWith("video/"))) {
        resolvedType = "video";
      }
      else if (imageUrls.length > 0) resolvedType = content?.trim() ? "text_with_image" : "image";
      else resolvedType = "text";
    }

    let post;
    try {
      const quotaLimit =
        req.dbUser?.role === "superadmin"
          ? -1
          : req.dbUser?.plan && typeof req.dbUser.plan === "object"
            ? req.dbUser.plan.features.max_posts_per_day
            : -1;
      post = await postService.createPost(
        {
          user: userId,
          operationId,
          content: content?.trim() || "",
          image_urls: imageUrls,
          image_keys: uploadedImages.map(({ key }) => key),
          post_type: resolvedType,
          visibility: visibility || "public",
          workout: workout || undefined,
        },
        {
          quotaLimit,
          reservationKeys: uploadedImages.map(({ key }) => key),
        }
      );
    } catch (error) {
      await discardReservedUploads(uploadedImages.map(({ key }) => key));
      throw error;
    }
    return res.json({ success: true, post, message: "Post created successfully" });
  } catch (error) {
    return next(error);
  }
};

export const getFeedPost: RequestHandler = async (req, res, next) => {
  try {
    const mode = req.query?.mode;
    if (mode !== undefined && mode !== "discover" && mode !== "following") {
      return res.status(400).json({ success: false, message: "Invalid feed mode" });
    }
    const pagination = parsePagination(req.query, { defaultLimit: 30, maxLimit: 50 });
    const page = await postService.getFeedPostsForUser(req.userId, pagination, mode ?? "discover");
    if (!page) return res.status(404).json({ success: false, message: "User not found" });

    return res.json({
      success: true,
      posts: page.items,
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    return next(error);
  }
};

/** @deprecated Kept for backward compatibility with older mobile clients. */
export const likePost: RequestHandler = async (req, res, next) => {
  try {
    const postId = req.body?.postId;
    if (!isUuid(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }

    const post = await postService.getPostForLike(postId);
    if (!post) return res.json({ success: false, message: "Post not found" });
    if (!(await postService.canAccessPost(post, { _id: req.userId }))) {
      return res.status(403).json({ success: false, message: "Post is not accessible" });
    }

    const result = await postService.toggleLikePost(postId, req.userId);

    return res.json({
      success: true,
      message: result.liked ? "Post liked" : "Post unliked",
      liked: result.liked,
      like_count: result.likeCount,
    });
  } catch (error) {
    return next(error);
  }
};

export const likePostIdempotent: RequestHandler = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!isUuid(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }

    const post = await postService.getPostForLike(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    if (!(await postService.canAccessPost(post, { _id: req.userId }))) {
      return res.status(403).json({ success: false, message: "Post is not accessible" });
    }

    const result = await postService.idempotentLikePost(postId, req.userId);

    return res.json({
      success: true,
      message: "Post liked",
      liked: result.liked,
      like_count: result.likeCount,
    });
  } catch (error) {
    return next(error);
  }
};

export const unlikePost: RequestHandler = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!isUuid(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }

    const post = await postService.getPostForLike(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    if (!(await postService.canAccessPost(post, { _id: req.userId }))) {
      return res.status(403).json({ success: false, message: "Post is not accessible" });
    }

    const result = await postService.idempotentUnlikePost(postId, req.userId);

    return res.json({
      success: true,
      message: "Post unliked",
      liked: result.liked,
      like_count: result.likeCount,
    });
  } catch (error) {
    return next(error);
  }
};

export const addComment: RequestHandler = async (req, res, next) => {
  try {
    const { postId, content } = req.body || {};
    if (!isUuid(postId) || typeof content !== "string" || !content.trim() || content.trim().length > 1000) {
      return res.status(400).json({ success: false, message: "Invalid comment" });
    }

    const existingPost = await postService.getPostForComment(postId);
    if (!existingPost) return res.json({ success: false, message: "Post not found" });
    if (!(await postService.canAccessPost(existingPost, { _id: req.userId }))) {
      return res.status(403).json({ success: false, message: "Post is not accessible" });
    }

    const result = await postService.addCommentToPost(postId, req.userId, content);
    return res.json({
      success: true,
      comment: result.comment,
      comment_count: result.commentCount,
    });
  } catch (error) {
    return next(error);
  }
};

export const getComments: RequestHandler = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!isUuid(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }

    const post = await postService.getPostForComment(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    if (!(await postService.canAccessPost(post, { _id: req.userId }))) {
      return res.status(403).json({ success: false, message: "Post is not accessible" });
    }

    const pagination = parsePagination(req.query, { defaultLimit: 30, maxLimit: 50 });
    const page = await postService.getCommentsForPost(postId, pagination);
    return res.json({
      success: true,
      comments: page.items,
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    return next(error);
  }
};

export const deletePost: RequestHandler = async (req, res, next) => {
  try {
    const postId = req.params.postId || req.body?.postId;
    if (!isUuid(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }

    const post = await postService.getPostById(postId);
    if (!post) return res.json({ success: false, message: "Post not found" });
    if (post.user !== req.userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this post" });
    }

    await postService.deletePostById(post);

    return res.json({ success: true, postId, message: "Post deleted successfully" });
  } catch (error) {
    return next(error);
  }
};
