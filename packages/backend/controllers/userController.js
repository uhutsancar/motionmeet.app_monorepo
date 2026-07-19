import imagekit from "../configs/imageKit.js";
import { deleteFromS3, extractS3Key, uploadToS3 } from "../utils/s3Utils.js";
import { isFiniteNumber, isNonEmptyString, isOptionalString, isUserId } from "../utils/validation.js";
import { hasValidMediaSignature } from "../utils/mediaValidation.js";
import * as userService from "../services/userService.js";

import sendEmail from "../configs/nodeMailer.js";

export const getUserData = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.userId);
    if (!user) return res.json({ success: false, message: "User not found" });
    return res.json({ success: true, user });
  } catch (error) {
    return next(error);
  }
};

export const updateUserData = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { username, bio, location, full_name, weight, height } = req.body || {};
    const user = await userService.getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (username !== undefined && (!isNonEmptyString(username, 30) || !/^[A-Za-z0-9._-]{3,30}$/.test(username.trim()))) {
      return res.status(400).json({ success: false, message: "Invalid username" });
    }
    if (!isOptionalString(bio, 500) || !isOptionalString(location, 100) || !isOptionalString(full_name, 100)) {
      return res.status(400).json({ success: false, message: "Invalid profile data" });
    }
    if (weight !== undefined && !isFiniteNumber(weight, { min: 0, max: 1000 })) {
      return res.status(400).json({ success: false, message: "Invalid weight" });
    }
    if (height !== undefined && !isFiniteNumber(height, { min: 0, max: 300 })) {
      return res.status(400).json({ success: false, message: "Invalid height" });
    }

    if (username !== undefined && username.trim() !== user.username) {
      const usernameTaken = await userService.checkUsernameTaken(username.trim(), userId);
      if (usernameTaken) return res.status(409).json({ success: false, message: "Username is already taken" });
    }

    const updatedData = {};
    if (username !== undefined) updatedData.username = username.trim();
    if (bio !== undefined) updatedData.bio = bio.trim();
    if (location !== undefined) updatedData.location = location.trim();
    if (full_name !== undefined) updatedData.full_name = full_name.trim();
    if (weight !== undefined) updatedData.weight = Number(weight);
    if (height !== undefined) updatedData.height = Number(height);

    const profile = req.files?.profile?.[0];
    const cover = req.files?.cover?.[0];
    if ((profile && !hasValidMediaSignature(profile)) || (cover && !hasValidMediaSignature(cover))) {
      return res.status(415).json({ success: false, message: "Uploaded image content is invalid" });
    }
    if ((profile || cover) && !imagekit) {
      return res.status(503).json({ success: false, message: "Media service is not configured" });
    }

    const oldMediaKeys = [];
    if (profile) {
      const { key } = await uploadToS3(profile.buffer, profile.originalname, "profiles", profile.mimetype);
      updatedData.profile_picture = imagekit.url({
        path: key,
        transformation: [{ width: "512" }, { quality: "auto" }, { format: "webp" }],
      });
      const oldKey = extractS3Key(user.profile_picture);
      if (oldKey) oldMediaKeys.push(oldKey);
    }

    if (cover) {
      const { key } = await uploadToS3(cover.buffer, cover.originalname, "covers", cover.mimetype);
      updatedData.cover_photo = imagekit.url({
        path: key,
        transformation: [{ width: "1280" }, { quality: "auto" }, { format: "webp" }],
      });
      const oldKey = extractS3Key(user.cover_photo);
      if (oldKey) oldMediaKeys.push(oldKey);
    }

    const updatedUser = await userService.updateUser(userId, updatedData);
    await Promise.all(oldMediaKeys.map((key) => deleteFromS3(key)));
    return res.json({ success: true, user: updatedUser, message: "Profile updated successfully" });
  } catch (error) {
    return next(error);
  }
};

export const discoverUsers = async (req, res, next) => {
  try {
    const input = req.body?.input;
    if (!isNonEmptyString(input, 100)) {
      return res.status(400).json({ success: false, message: "A search term is required" });
    }

    const users = await userService.searchUsers(input.trim(), req.userId);
    return res.json({ success: true, users: users.map(userService.withRelationshipCounts) });
  } catch (error) {
    return next(error);
  }
};

export const followUser = async (req, res, next) => {
  try {
    const targetId = req.body?.id;
    if (!(await userService.validateTargetUser(req.userId, targetId))) {
      return res.status(400).json({ success: false, message: "Invalid user" });
    }

    await userService.followUser(req.userId, targetId);
    return res.json({ success: true, message: "Follow relationship synchronized" });
  } catch (error) {
    return next(error);
  }
};

export const unfollowUser = async (req, res, next) => {
  try {
    const targetId = req.body?.id;
    if (!isUserId(targetId) || targetId === req.userId) {
      return res.status(400).json({ success: false, message: "Invalid user" });
    }

    await userService.unfollowUser(req.userId, targetId);
    return res.json({ success: true, message: "You are no longer following this user" });
  } catch (error) {
    return next(error);
  }
};

export const sendConnectionRequest = async (req, res, next) => {
  try {
    const targetId = req.body?.id;
    if (!(await userService.validateTargetUser(req.userId, targetId))) {
      return res.status(400).json({ success: false, message: "Invalid user" });
    }

    const recentRequestCount = await userService.checkRecentConnectionRequests(req.userId);
    if (recentRequestCount >= 20) {
      return res.status(429).json({ success: false, message: "Daily connection request limit reached" });
    }

    const connection = await userService.getConnectionBetweenUsers(req.userId, targetId);

    if (connection?.status === "accepted") {
      return res.json({ success: false, message: "You are already connected with this user" });
    }
    if (connection) return res.json({ success: false, message: "Connection request pending" });

    const newConnection = await userService.createConnection(req.userId, targetId);
    
    const recipient = await userService.getUserById(targetId);
    const sender = await userService.getUserById(req.userId);
    if (recipient && sender) {
      await sendEmail({
        to: recipient.email,
        subject: "New Connection Request",
        body: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Hi ${recipient.full_name},</h2>
            <p>You have a new connection request from ${sender.full_name} - @${sender.username}</p>
            <p>Click <a href="${process.env.FRONTEND_URL}/connections">here</a> to review it.</p>
            <p>Thanks,<br/>MotionMeet</p>
          </div>`,
      });
    }

    return res.json({ success: true, message: "Connection request sent successfully" });
  } catch (error) {
    return next(error);
  }
};

export const getUserConnection = async (req, res, next) => {
  try {
    const connectionData = await userService.getUserConnectionsData(req.userId);
    if (!connectionData) return res.json({ success: false, message: "User not found" });

    return res.json({ success: true, ...connectionData });
  } catch (error) {
    return next(error);
  }
};

export const acceptConnectionRequest = async (req, res, next) => {
  try {
    const senderId = req.body?.id;
    if (!(await userService.validateTargetUser(req.userId, senderId))) {
      return res.status(400).json({ success: false, message: "Invalid user" });
    }

    const connection = await userService.acceptConnection(req.userId, senderId);
    if (!connection) return res.json({ success: false, message: "Connection not found" });

    return res.json({ success: true, message: "Connection accepted successfully" });
  } catch (error) {
    return next(error);
  }
};

export const getUserProfile = async (req, res, next) => {
  try {
    const profileId = req.body?.profileId;
    if (!isUserId(profileId)) {
      return res.status(400).json({ success: false, message: "Invalid profile id" });
    }

    const result = await userService.getUserProfileAndPosts(profileId, req.userId);
    if (!result) return res.json({ success: false, message: "Profile not found" });

    return res.json({ success: true, profile: result.profile, posts: result.posts });
  } catch (error) {
    return next(error);
  }
};

export const getSuggestedUsers = async (req, res, next) => {
  try {
    const users = await userService.getSuggestedUsersList(req.userId);
    if (!users) return res.json({ success: false, message: "User not found" });

    return res.json({ success: true, users: users.map(userService.withRelationshipCounts) });
  } catch (error) {
    return next(error);
  }
};
