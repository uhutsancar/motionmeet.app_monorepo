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
  clearProfileLocation,
  getProfileLocation,
  saveProfileLocation,
  updateProfileLocationVisibility,
} from "../controllers/userController.js";
import {
  acceptFollowRequest as acceptFollowRequestHandler,
  cancelFollowRequest,
  declineFollowRequest,
  getIncomingFollowRequests,
  getOutgoingFollowRequests,
  getRelationship,
  sendFollowRequest,
} from "../controllers/followRequestController.js";
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
// Profile location is a separate resource from the profile form: it is written
// by reference to a dataset record, never as text. See locationService.ts.
userRouter.get("/location", protect, getProfileLocation);
userRouter.put("/location", protect, saveProfileLocation);
userRouter.patch("/location", protect, updateProfileLocationVisibility);
userRouter.delete("/location", protect, clearProfileLocation);
userRouter.post("/discover", protect, discoverUsers);
// Follow requests. The literal segments are declared before `/:userId/...` so a
// path like /follow-requests/incoming can never be read as a user id.
userRouter.get("/follow-requests/incoming", protect, getIncomingFollowRequests);
userRouter.get("/follow-requests/outgoing", protect, getOutgoingFollowRequests);
userRouter.post("/follow-requests", protect, sendFollowRequest);
userRouter.post("/follow-requests/:requesterId/accept", protect, acceptFollowRequestHandler);
userRouter.post("/follow-requests/:requesterId/decline", protect, declineFollowRequest);
userRouter.delete("/follow-requests/:targetId", protect, cancelFollowRequest);
// `/follow` now sends a request rather than creating the edge outright; the
// route name is kept so older installs keep working instead of failing silently.
userRouter.post("/follow", protect, followUser);
userRouter.post("/unfollow", protect, unfollowUser);
userRouter.post("/connect", protect, sendConnectionRequest);
userRouter.post("/accept", protect, acceptConnectionRequest);
userRouter.delete("/connection", protect, removeConnection);
userRouter.get("/connections", protect, getUserConnection);
userRouter.post("/profiles", protect, getUserProfile);
userRouter.get("/recent-messages", protect, getUserRecentMessages);
userRouter.get("/suggested", protect, getSuggestedUsers);
userRouter.get("/:userId/relationship", protect, getRelationship);

export default userRouter;
