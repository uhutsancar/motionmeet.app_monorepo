import fs from "fs";
import imagekit from "../configs/imageKit.js";
import Post from "../models/Post.js";
import User from "../models/User.js";

// Add Post
export const addPost = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { content, post_type, workout, visibility } = req.body;
    const images = req.files;

    let image_urls = [];
    if (images && images.length) {
      image_urls = await Promise.all(
        images.map(async (image) => {
          const fileBuffer = fs.readFileSync(image.path);
          const response = await imagekit.upload({
            file: fileBuffer,
            fileName: image.originalname,
            folder: "posts",
          });
          try { fs.unlinkSync(image.path); } catch (e) {}
          return response.url;
        })
      );
    }

    // Auto-detect post_type if not provided
    let resolvedType = post_type;
    if (!resolvedType) {
      if (workout) {
        resolvedType = image_urls.length > 0 ? "workout" : "workout";
      } else if (image_urls.length > 0) {
        resolvedType = content ? "text_with_image" : "image";
      } else {
        resolvedType = "text";
      }
    }

    await Post.create({
      user: userId,
      content,
      image_urls,
      post_type: resolvedType,
      visibility: visibility || "public",
      workout: workout || undefined,
    });

    res.json({ success: true, message: "Post created successfully" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Get Feed Posts — with visibility filtering
export const getFeedPost = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const user = await User.findById(userId);

    const connections = user.connections || [];
    const following = user.following || [];

    // Build visibility-aware query
    // - public posts from anyone in the social graph
    // - followers posts only from people I'm connected to / following
    // - private posts only from myself
    const socialIds = [...new Set([...connections, ...following])];

    const posts = await Post.find({
      $or: [
        // My own posts (all visibilities)
        { user: userId },
        // Public posts from social graph
        { user: { $in: socialIds }, visibility: "public" },
        // Followers-only posts from people I'm connected/following
        { user: { $in: socialIds }, visibility: "followers" },
      ]
    })
      .populate("user")
      .populate({
        path: "workout",
        populate: { path: "exercises.exerciseId" }
      })
      .populate("comments.user")
      .sort({ createdAt: -1 });

    res.json({ success: true, posts });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Like Post
export const likePost = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { postId } = req.body;

    const post = await Post.findById(postId);
    if (!post) return res.json({ success: false, message: "Post not found" });

    if (post.likes_count.includes(userId)) {
      post.likes_count = post.likes_count.filter((u) => u !== userId);
      await post.save();
      res.json({ success: true, message: "Post unliked" });
    } else {
      post.likes_count.push(userId);
      await post.save();
      res.json({ success: true, message: "Post liked" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Add Comment
export const addComment = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { postId, content } = req.body;

    if (!content) {
      return res.json({ success: false, message: "Comment content is required" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.json({ success: false, message: "Post not found" });
    }

    post.comments.push({ user: userId, content });
    await post.save();

    const updatedPost = await Post.findById(postId).populate("comments.user");
    res.json({ success: true, comments: updatedPost.comments });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};
