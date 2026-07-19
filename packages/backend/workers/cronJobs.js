import cron from "node-cron";
import Story from "../models/Story.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import sendEmail from "../configs/nodeMailer.js";
import { deleteFromS3, extractS3Key } from "../utils/s3Utils.js";

export const initCronJobs = () => {
  // Delete stories older than 24 hours every hour
  cron.schedule("0 * * * *", async () => {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const expiredStories = await Story.find({ createdAt: { $lt: oneDayAgo } });
      
      for (const story of expiredStories) {
        const key = extractS3Key(story.media_url);
        if (key) {
          await deleteFromS3(key);
        }
        await Story.findByIdAndDelete(story._id);
      }
      if (expiredStories.length > 0) {
        console.log(`Deleted ${expiredStories.length} expired stories.`);
      }
    } catch (error) {
      console.error("Error in story deletion cron:", error.message);
    }
  });

  // Send daily notification for unseen messages at 09:00 AM (Istanbul time)
  cron.schedule("0 9 * * *", async () => {
    try {
      const messages = await Message.find({ seen: false }).populate("to_user_id");
      const unseenCount = {};

      messages.forEach((message) => {
        if (message.to_user_id) {
          const recipient = /** @type {any} */ (message.to_user_id);
          const recipientId = recipient?._id?.toString();
          if (recipientId) unseenCount[recipientId] = (unseenCount[recipientId] || 0) + 1;
        }
      });

      for (const userId in unseenCount) {
        const user = await User.findById(userId);
        if (!user) continue;

        await sendEmail({
          to: user.email,
          subject: `You have ${unseenCount[userId]} unseen messages`,
          body: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Hi ${user.full_name},</h2>
              <p>You have ${unseenCount[userId]} unseen messages waiting for you.</p>
              <p>Click <a href="${process.env.FRONTEND_URL}/messages">here</a> to view them.</p>
              <p>Thanks,<br/>MotionMeet</p>
            </div>`,
        });
      }
    } catch (error) {
      console.error("Error in unseen messages cron:", error.message);
    }
  }, {
    timezone: "Europe/Istanbul"
  });
  
  console.log("Background cron jobs initialized successfully.");
};
