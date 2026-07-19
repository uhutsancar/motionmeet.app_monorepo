import express from "express";
import {
  getChatMessages,
  sendMessage,
  getUserConversations,
  getUserRecentMessages,
  markSeen,
  deleteMessage,
} from "../controllers/messageController.js";
import { imageUpload } from "../configs/multer.js";
import { attachDbUser, protect } from "../middlewares/auth.js";

const messageRouter = express.Router();

messageRouter.post("/send", protect, attachDbUser, imageUpload.single("image"), sendMessage);
messageRouter.post("/get", protect, getChatMessages);
messageRouter.get("/conversations", protect, getUserConversations);
messageRouter.get("/recent", protect, getUserRecentMessages);
messageRouter.post("/seen", protect, markSeen);
messageRouter.delete("/delete/:messageId", protect, deleteMessage);

export default messageRouter;
