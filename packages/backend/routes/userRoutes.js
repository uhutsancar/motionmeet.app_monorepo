import express from "express";
import rateLimit from "express-rate-limit";
import {
  deleteAccount,
  exportAccount,
  getPrivacySettings,
  getUserData,
  acceptConnectionRequest,
  discoverUsers,
  followUser,
  getUserConnection,
  getUserProfile,
  sendConnectionRequest,
  unfollowUser,
  updateUserData,
  updatePrivacySettings,
  getSuggestedUsers,
  removeConnection,
} from "../controllers/userController.js";
import { protect } from "../middlewares/auth.js";
import { imageUpload } from "../configs/multer.js";
import { getUserRecentMessages } from "../controllers/messageController.js";
import { createRateLimitStore } from "../configs/redis.js";

const userRouter = express.Router();

const sensitiveAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("account"),
  message: {
    success: false,
    message: "Too many account requests; please try again later",
  },
});

userRouter.get("/data", protect, getUserData);
userRouter.get("/privacy", protect, getPrivacySettings);
userRouter.patch("/privacy", protect, updatePrivacySettings);
userRouter.get("/export", protect, sensitiveAccountLimiter, exportAccount);
userRouter.delete("/account", protect, sensitiveAccountLimiter, deleteAccount);
userRouter.post(
  "/update",
  protect,
  imageUpload.fields([
    { name: "profile", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  updateUserData
);
userRouter.post("/discover", protect, discoverUsers);
userRouter.post("/follow", protect, followUser);
userRouter.post("/unfollow", protect, unfollowUser);
userRouter.post("/connect", protect, sendConnectionRequest);
userRouter.post("/accept", protect, acceptConnectionRequest);
userRouter.delete("/connection", protect, removeConnection);
userRouter.get("/connections", protect, getUserConnection);
userRouter.post("/profiles", protect, getUserProfile);
userRouter.get("/recent-messages", protect, getUserRecentMessages);
userRouter.get("/suggested", protect, getSuggestedUsers);

export default userRouter;
