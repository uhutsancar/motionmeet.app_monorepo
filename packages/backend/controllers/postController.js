import imagekit from "../configs/imageKit.js";
import { deleteFromS3, extractS3Key, uploadToS3 } from "../utils/s3Utils.js";
import { isObjectId, isOptionalString } from "../utils/validation.js";
import { hasValidMediaSignature } from "../utils/mediaValidation.js";
import * as postService from "../services/postService.js";

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

    const imageUrls = await Promise.all(
      images.map(async (image) => {
        const { key } = await uploadToS3(image.buffer, image.originalname, "posts", image.mimetype);
        return imagekit.url({
          path: key,
          transformation: [{ quality: "auto" }, { format: "webp" }],
        });
      })
    );

    let resolvedType = post_type;
    if (!resolvedType) {
      if (workout) resolvedType = "workout";
      else if (imageUrls.length > 0) resolvedType = content?.trim() ? "text_with_image" : "image";
      else resolvedType = "text";
    }

    const post = await postService.createPost({
      user: userId,
      content: content?.trim() || "",
      image_urls: imageUrls,
      post_type: resolvedType,
      visibility: visibility || "public",
      workout: workout || undefined,
    });

    return res.json({ success: true, post, message: "Post created successfully" });
  } catch (error) {
    return next(error);
  }
};

export const getFeedPost = async (req, res, next) => {
  try {
    const posts = await postService.getFeedPostsForUser(req.userId);
    if (!posts) return res.status(404).json({ success: false, message: "User not found" });

    return res.json({ success: true, posts });
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

    const liked = post.likes_count.includes(req.userId);
    const updatedPost = await postService.toggleLikePost(postId, req.userId, liked);

    return res.json({
      success: true,
      message: liked ? "Post unliked" : "Post liked",
      likes_count: updatedPost.likes_count,
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

    const post = await postService.addCommentToPost(postId, req.userId, content);
    return res.json({ success: true, comments: post.comments });
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

    await Promise.all(
      (post.image_urls || []).map(async (url) => {
        const key = extractS3Key(url);
        if (key) await deleteFromS3(key);
      })
    );
    await postService.deletePostById(post);

    return res.json({ success: true, postId, message: "Post deleted successfully" });
  } catch (error) {
    return next(error);
  }
};
