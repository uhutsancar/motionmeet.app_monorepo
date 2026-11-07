import express from "express";
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
  removeFollowerHandler,
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
import { protect, requireActiveSession } from "../middlewares/auth.js";
import { imageUpload } from "../configs/multer.js";
import { getUserRecentMessages } from "../controllers/messageController.js";
import { createLimiter, memberKey, multipartUploadLimiter } from "../middlewares/rateLimits.js";
import { reserveUploadMemory } from "../middlewares/uploadBudget.js";

const userRouter = express.Router();

const sensitiveAccountLimiter = createLimiter({
  name: "account",
  windowMs: 60 * 60 * 1000,
  limit: 10,
  key: memberKey,
  message: {
    success: false,
    message: "Too many account requests; please try again later",
  },
});

userRouter.get("/data", protect, getUserData);
userRouter.get("/privacy", protect, getPrivacySettings);
// Sensitive routes also check the session in PostgreSQL (D-09): a revoked
// session is refused here even when Redis, and with it `protect`'s revocation
// check, is unavailable.
userRouter.patch("/privacy", protect, requireActiveSession, updatePrivacySettings);
userRouter.get("/export", protect, requireActiveSession, sensitiveAccountLimiter, exportAccount);
userRouter.delete("/account", protect, requireActiveSession, sensitiveAccountLimiter, deleteAccount);
userRouter.post(
  "/update",
  protect,
  requireActiveSession,
  multipartUploadLimiter,
  // A profile and a cover picture of up to 5 MB each, plus the form fields.
  reserveUploadMemory(11 * 1024 * 1024),
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
userRouter.delete("/followers/:followerId", protect, removeFollowerHandler);
userRouter.post("/connect", protect, sendConnectionRequest);
userRouter.post("/accept", protect, acceptConnectionRequest);
userRouter.delete("/connection", protect, removeConnection);
userRouter.get("/connections", protect, getUserConnection);
userRouter.post("/profiles", protect, getUserProfile);
userRouter.get("/recent-messages", protect, getUserRecentMessages);
userRouter.get("/suggested", protect, getSuggestedUsers);
userRouter.get("/:userId/relationship", protect, getRelationship);

export default userRouter;
