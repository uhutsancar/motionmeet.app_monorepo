import express from "express";
import { presignMediaUpload } from "../controllers/mediaController.js";
import { createLimiter, memberKey } from "../middlewares/rateLimits.js";
import { attachDbUser, protect } from "../middlewares/auth.js";

const mediaRouter = express.Router();
const presignLimiter = createLimiter({
  name: "media-presign",
  windowMs: 15 * 60 * 1000,
  limit: 60,
  key: memberKey,
  message: { success: false, message: "Too many upload requests" },
});

mediaRouter.post(
  "/presign",
  protect,
  presignLimiter,
  attachDbUser,
  presignMediaUpload
);

export default mediaRouter;
