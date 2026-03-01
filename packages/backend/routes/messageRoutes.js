import express from "express";
import {
  getChatMessages,
  sendMessage,
  getUserConversations,
  getUserRecentMessages,
  markSeen,
} from "../controllers/messageController.js";
import { upload } from "../configs/multer.js";
import { protect } from "../middlewares/auth.js";

const messageRouter = express.Router();

messageRouter.post("/send", upload.single("image"), protect, sendMessage);
messageRouter.post("/get", protect, getChatMessages);
messageRouter.get("/conversations", protect, getUserConversations);
messageRouter.get("/recent", protect, getUserRecentMessages);
messageRouter.post("/seen", protect, markSeen);

export default messageRouter;
