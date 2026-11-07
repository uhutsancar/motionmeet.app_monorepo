import express from "express";
import {
  getChatMessages,
  syncMessages,
  sendMessage,
  getUserConversations,
  getUserRecentMessages,
  markSeen,
  deleteMessage,
} from "../controllers/messageController.js";
import { imageUpload } from "../configs/multer.js";
import { attachDbUser, protect } from "../middlewares/auth.js";
import { reserveUploadMemory } from "../middlewares/uploadBudget.js";

const messageRouter = express.Router();

// Text messages come here too, so only the memory budget applies, not the upload limiter.
messageRouter.post("/send", protect, reserveUploadMemory(6 * 1024 * 1024), attachDbUser, imageUpload.single("image"), sendMessage);
messageRouter.post("/get", protect, getChatMessages);
messageRouter.post("/sync", protect, syncMessages);
messageRouter.get("/conversations", protect, getUserConversations);
messageRouter.get("/recent", protect, getUserRecentMessages);
messageRouter.post("/seen", protect, markSeen);
messageRouter.delete("/delete/:messageId", protect, deleteMessage);

export default messageRouter;
