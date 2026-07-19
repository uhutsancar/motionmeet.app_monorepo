import express from "express";
import {
  getUserData,
  acceptConnectionRequest,
  discoverUsers,
  followUser,
  getUserConnection,
  getUserProfile,
  sendConnectionRequest,
  unfollowUser,
  updateUserData,
  getSuggestedUsers,
} from "../controllers/userController.js";
import { attachDbUser, protect } from "../middlewares/auth.js";
import { imageUpload } from "../configs/multer.js";
import { getUserRecentMessages } from "../controllers/messageController.js";

const userRouter = express.Router();

userRouter.get("/data", protect, getUserData);
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
userRouter.post("/follow", protect, attachDbUser, followUser);
userRouter.post("/unfollow", protect, attachDbUser, unfollowUser);
userRouter.post("/connect", protect, attachDbUser, sendConnectionRequest);
userRouter.post("/accept", protect, attachDbUser, acceptConnectionRequest);
userRouter.get("/connections", protect, getUserConnection);
userRouter.post("/profiles", protect, getUserProfile);
userRouter.get("/recent-messages", protect, getUserRecentMessages);
userRouter.get("/suggested", protect, getSuggestedUsers);

export default userRouter;
