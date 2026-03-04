import fs from "fs";
import imagekit from "../configs/imageKit.js";
import Story from "../models/Story.js";
import User from "../models/User.js";
import { inngest } from "../inngest/index.js";

// Add User Story
export const addUserStory = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { content, media_type, background_color } = req.body;

    const media = req.file;

    let media_url = "";

    // upload media to imagekit
    if (media_type === "image" || media_type === "video") {
      const fileBuffer = fs.readFileSync(media.path);
      const response = await imagekit.upload({
        file: fileBuffer,
        fileName: media.originalname,
      });
      media_url = response.url;
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
