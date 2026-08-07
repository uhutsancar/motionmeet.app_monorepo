import express from "express";
import { getNotifications, getUnreadCount, markNotificationsRead } from "../controllers/notificationController.js";
import { protect } from "../middlewares/auth.js";

const notificationRouter = express.Router();

notificationRouter.get("/", protect, getNotifications);
notificationRouter.get("/unread-count", protect, getUnreadCount);
notificationRouter.post("/read", protect, markNotificationsRead);

export default notificationRouter;
