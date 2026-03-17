import fs from "fs";
import Story from "../models/Story.js";
import User from "../models/User.js";
import imagekit from "../configs/imageKit.js";
import { inngest } from "../inngest/index.js";
import { uploadToS3 } from "../utils/s3Utils.js";

// Add User Story
export const addUserStory = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { content, media_type, background_color } = req.body;

    const media = req.file;

    let media_url = "";

    // upload media to S3
    if (media_type === "image" || media_type === "video") {
      const stream = fs.createReadStream(media.path);
      const { key } = await uploadToS3(stream, media.originalname, "stories");
      
      try { fs.unlinkSync(media.path); } catch (e) {}

      // ImageKit URL with path as S3 key
      media_url = imagekit.url({
        path: key,
        transformation: [{ quality: "auto" }, { format: "webp" }]
      });
    }

    //create story
    const story = await Story.create({
      user: userId,
      content,
      media_url,
      media_type,
      background_color,
    });

    // schedule story deletion after 24 hours via inngest
    try {
      await inngest.send({
        name: 'app/story.delete',
        data: { storyId: story._id }
      });
    } catch (inngestError) {
      console.error("Inngest error (Ignoring for story creation):", inngestError.message);
    }

    res.json({ success: true });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Get User Stories — only return stories created within the last 24 hours
export const getStories = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const user = await User.findById(userId);

    // 24h cutoff — any story older than this is expired
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // User connections and followings
    const userIds = [userId, ...user.connections, ...user.following];
    const stories = await Story.find({
      user: { $in: userIds },
      createdAt: { $gte: cutoff }, // ← KEY FIX: only stories from the last 24h
    })
      .populate("user")
      .sort({ createdAt: -1 });

    res.json({ success: true, stories });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};
