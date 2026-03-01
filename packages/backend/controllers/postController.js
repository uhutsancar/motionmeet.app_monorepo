import fs from "fs";
import imagekit from "../configs/imageKit.js";
import Post from "../models/Post.js";
import User from "../models/User.js";

//Add Post
export const addPost = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { content, post_type, workout } = req.body;
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

          // Clean up temp file
          try { fs.unlinkSync(image.path); } catch (e) {}

          // Use the direct URL from ImageKit
          return response.url;
        })
      );
    }

    await Post.create({
      user: userId,
      content,
      image_urls,
      post_type,
      workout: workout || undefined,
    });

    res.json({ success: true, message: "Post created successfully" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Get Posts
export const getFeedPost = async (req, res) => {
  try {
    const { userId } = req.auth();
    const user = await User.findById(userId);

    // User connections and following
    const userIds = [userId, ...user.connections, ...user.following];
    const posts = await Post.find({ user: { $in: userIds } })
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
    const { userId } = req.auth();
    const { postId } = req.body;

    const post = await Post.findById(postId);

    if (post.likes_count.includes(userId)) {
      post.likes_count = post.likes_count.filter((user) => user !== userId);
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
    const { userId } = req.auth();
    const { postId, content } = req.body;

    if (!content) {
      return res.json({ success: false, message: "Comment content is required" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.json({ success: false, message: "Post not found" });
    }

    post.comments.push({
      user: userId,
      content,
    });

    await post.save();

    // Re-populate and return the whole post or just the comments? 
    // Usually, returning the updated comment or total comments is sufficient.
    const updatedPost = await Post.findById(postId).populate("comments.user");

    res.json({ success: true, comments: updatedPost.comments });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};
