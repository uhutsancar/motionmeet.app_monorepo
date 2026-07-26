import imagekit from "../configs/imageKit.js";
import { extractS3Key, uploadToS3 } from "../utils/s3Utils.js";
import { isObjectId, isOptionalString } from "../utils/validation.js";
import { hasValidMediaSignature } from "../utils/mediaValidation.js";
import * as postService from "../services/postService.js";
import { parsePagination } from "../utils/pagination.js";
import {
  commitReservedUploads,
  discardReservedUploads,
  resolveReservedUploads,
} from "../services/mediaUploadService.js";
import { deleteMediaOrQueue } from "../services/mediaDeletionService.js";

const POST_TYPES = new Set(["text", "image", "text_with_image", "video", "workout"]);
const VISIBILITIES = new Set(["public", "followers", "private"]);

export const addPost = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { content, post_type, workout, visibility } = req.body || {};
    const images = req.files || [];

    if (!isOptionalString(content, 5000)) {
      return res.status(400).json({ success: false, message: "Post content is too long" });
    }
    if (post_type && !POST_TYPES.has(post_type)) {
      return res.status(400).json({ success: false, message: "Invalid post type" });
    }
    if (visibility && !VISIBILITIES.has(visibility)) {
      return res.status(400).json({ success: false, message: "Invalid post visibility" });
    }
    if (workout && !isObjectId(workout)) {
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
        const { key } = await uploadToS3(image.buffer, image.originalname, "posts", image.mimetype);
        const cleanKey = key.startsWith('/') ? key.slice(1) : key;
        uploadedImages.push({
          key,
          url: imagekit.url({
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
      post = await postService.createPost({
        user: userId,
        content: content?.trim() || "",
        image_urls: imageUrls,
        image_keys: uploadedImages.map(({ key }) => key),
        post_type: resolvedType,
        visibility: visibility || "public",
        workout: workout || undefined,
      });
    } catch (error) {
      await discardReservedUploads(uploadedImages.map(({ key }) => key));
      throw error;
    }
    await commitReservedUploads(reservedImages.map(({ key }) => key));

    return res.json({ success: true, post, message: "Post created successfully" });
  } catch (error) {
    return next(error);
  }
};

export const getFeedPost = async (req, res, next) => {
  try {
    const mode = req.query?.mode || "discover";
    if (!["discover", "following"].includes(mode)) {
      return res.status(400).json({ success: false, message: "Invalid feed mode" });
    }
    const pagination = parsePagination(req.query, { defaultLimit: 30, maxLimit: 50 });
    const page = await postService.getFeedPostsForUser(req.userId, pagination, mode);
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

export const likePost = async (req, res, next) => {
  try {
    const postId = req.body?.postId;
    if (!isObjectId(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }

    const post = await postService.getPostForLike(postId);
    if (!post) return res.json({ success: false, message: "Post not found" });
    if (!postService.canAccessPost(post, req.dbUser)) {
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

export const addComment = async (req, res, next) => {
  try {
    const { postId, content } = req.body || {};
    if (!isObjectId(postId) || typeof content !== "string" || !content.trim() || content.trim().length > 1000) {
      return res.status(400).json({ success: false, message: "Invalid comment" });
    }

    const existingPost = await postService.getPostForComment(postId);
    if (!existingPost) return res.json({ success: false, message: "Post not found" });
    if (!postService.canAccessPost(existingPost, req.dbUser)) {
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

export const getComments = async (req, res, next) => {
  try {
    const { postId } = req.params;
    if (!isObjectId(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }

    const post = await postService.getPostForComment(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    if (!postService.canAccessPost(post, req.dbUser)) {
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

export const deletePost = async (req, res, next) => {
  try {
    const postId = req.params.postId || req.body?.postId;
    if (!isObjectId(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }

    const post = await postService.getPostById(postId);
    if (!post) return res.json({ success: false, message: "Post not found" });
    if (post.user.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this post" });
    }

    const mediaKeys = (post.image_urls || [])
      .map((url, index) => post.image_keys?.[index] || extractS3Key(url))
      .filter(Boolean);
    await postService.deletePostById(post);
    await deleteMediaOrQueue(mediaKeys);

    return res.json({ success: true, postId, message: "Post deleted successfully" });
  } catch (error) {
    return next(error);
  }
};
