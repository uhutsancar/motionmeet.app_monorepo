import imagekit from "../configs/imageKit.js";
import type { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { extractS3Key } from "../utils/s3Utils.js";
import { isFiniteNumber, isNonEmptyString, isOptionalString, isUserId } from "../utils/validation.js";
import { hasValidMediaSignature } from "../utils/mediaValidation.js";
import * as userService from "../services/userService.js";
import * as accountService from "../services/accountService.js";
import * as locationService from "../services/locationService.js";
import { parsePagination } from "../utils/pagination.js";
import {
  discardReservedUploads,
  resolveReservedUploads,
  uploadAndReserve,
} from "../services/mediaUploadService.js";
import { PRIVACY_KEYS } from "@motionmeet/shared";
import { deleteMediaOrQueue } from "../services/mediaDeletionService.js";
import { runWithRedisLock } from "../configs/redis.js";

export const getUserData: RequestHandler = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.userId);
    if (!user) return res.json({ success: false, message: "User not found" });
    return res.json({ success: true, user });
  } catch (error) {
    return next(error);
  }
};

const PRIVACY_KEY_SET = new Set(PRIVACY_KEYS);

export const getPrivacySettings: RequestHandler = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.json({ success: true, privacy: user.privacy });
  } catch (error) {
    return next(error);
  }
};

export const updatePrivacySettings: RequestHandler = async (req, res, next) => {
  try {
    const updates = Object.entries(req.body || {});
    if (
      updates.length === 0 ||
      updates.some(([key, value]) => !PRIVACY_KEY_SET.has(key as typeof PRIVACY_KEYS[number]) || typeof value !== "boolean")
    ) {
      return res.status(400).json({
        success: false,
        message: "Privacy settings must contain supported boolean values",
      });
    }

    const update = Object.fromEntries(
      updates.map(([key, value]) => [`privacy.${key}`, value])
    );
    const user = await userService.updateUser(req.userId, update);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.json({ success: true, privacy: user.privacy });
  } catch (error) {
    return next(error);
  }
};

export const exportAccount: RequestHandler = async (req, res, next) => {
  try {
    res.set({
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="motionmeet-export-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
      "Content-Type": "application/json; charset=utf-8",
    });
    let streamed = false;
    const acquired = await runWithRedisLock(
      `account-export:${req.userId}`,
      15 * 60,
      async () => {
        streamed = await accountService.streamAccountData(req.userId, res);
      }
    );
    if (!acquired) {
      return res.status(409).json({
        success: false,
        message: "An account export is already in progress",
      });
    }
    if (!streamed) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return undefined;
  } catch (error) {
    return next(error);
  }
};

export const deleteAccount: RequestHandler = async (req, res, next) => {
  try {
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!password || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ success: false, message: "Password is required" });
    }

    const user = await userService.getUserByIdWithPassword(req.userId);
    if (!user?.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Password is incorrect" });
    }

    await accountService.deleteAccountData(req.userId);
    return res.json({ success: true, message: "Account permanently deleted" });
  } catch (error) {
    return next(error);
  }
};

export const updateUserData: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.userId;
    // `location` is intentionally not read here. It is derived from a dataset
    // record chosen through /api/user/location, so accepting a string on this
    // endpoint would reopen the free-text path the picker exists to close.
    const { username, bio, full_name, weight, height } = req.body || {};
    const user = await userService.getUserByIdWithPassword(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (username !== undefined && (!isNonEmptyString(username, 30) || !/^[A-Za-z0-9._-]{3,30}$/.test(username.trim()))) {
      return res.status(400).json({ success: false, message: "Invalid username" });
    }
    if (!isOptionalString(bio, 500) || !isOptionalString(full_name, 100)) {
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

    const updatedData: Record<string, string | number> = {};
    if (username !== undefined) updatedData.username = username.trim();
    if (bio !== undefined) updatedData.bio = bio?.trim() ?? "";
    if (full_name !== undefined) updatedData.full_name = full_name?.trim() ?? "";
    if (weight !== undefined) updatedData.weight = Number(weight);
    if (height !== undefined) updatedData.height = Number(height);

    const uploadFields = req.files && !Array.isArray(req.files) ? req.files : undefined;
    const profile = uploadFields?.profile?.[0];
    const cover = uploadFields?.cover?.[0];
    if ((profile && !hasValidMediaSignature(profile)) || (cover && !hasValidMediaSignature(cover))) {
      return res.status(415).json({ success: false, message: "Uploaded image content is invalid" });
    }
    if ((profile || cover) && !imagekit) {
      return res.status(503).json({ success: false, message: "Media service is not configured" });
    }
    const [reservedProfiles, reservedCovers] = await Promise.all([
      resolveReservedUploads(userId, "profiles", req.body?.uploadedProfileKey),
      resolveReservedUploads(userId, "covers", req.body?.uploadedCoverKey),
    ]);
    if ((profile && reservedProfiles.length) || (cover && reservedCovers.length)) {
      return res.status(400).json({ success: false, message: "Supply one upload for each profile field" });
    }

    const oldMediaKeys: string[] = [];
    const reservedUploads = [...reservedProfiles, ...reservedCovers];
    const newMediaKeys = reservedUploads.map(({ key }) => key);
    if (reservedProfiles[0]) {
      updatedData.profile_picture = reservedProfiles[0].url;
      updatedData.profile_picture_key = reservedProfiles[0].key;
      const oldKey = user.profile_picture_key || extractS3Key(user.profile_picture);
      if (oldKey) oldMediaKeys.push(oldKey);
    }
    if (reservedCovers[0]) {
      updatedData.cover_photo = reservedCovers[0].url;
      updatedData.cover_photo_key = reservedCovers[0].key;
      const oldKey = user.cover_photo_key || extractS3Key(user.cover_photo);
      if (oldKey) oldMediaKeys.push(oldKey);
    }
    try {
      if (profile) {
        const { key } = await uploadAndReserve({
          file: profile.buffer,
          fileName: profile.originalname,
          userId,
          purpose: "profiles",
          contentType: profile.mimetype,
        });
        newMediaKeys.push(key);
        updatedData.profile_picture = imagekit!.url({
          path: key,
          transformation: [{ width: "512" }, { quality: "auto" }, { format: "webp" }],
          transformationPosition: "query",
        });
        updatedData.profile_picture_key = key;
        const oldKey = user.profile_picture_key || extractS3Key(user.profile_picture);
        if (oldKey) oldMediaKeys.push(oldKey);
      }

      if (cover) {
        const { key } = await uploadAndReserve({
          file: cover.buffer,
          fileName: cover.originalname,
          userId,
          purpose: "covers",
          contentType: cover.mimetype,
        });
        newMediaKeys.push(key);
        updatedData.cover_photo = imagekit!.url({
          path: key,
          transformation: [{ width: "1280" }, { quality: "auto" }, { format: "webp" }],
          transformationPosition: "query",
        });
        updatedData.cover_photo_key = key;
        const oldKey = user.cover_photo_key || extractS3Key(user.cover_photo);
        if (oldKey) oldMediaKeys.push(oldKey);
      }
    } catch (error) {
      await discardReservedUploads(newMediaKeys);
      throw error;
    }

    let updatedUser;
    try {
      updatedUser = await userService.updateUser(userId, updatedData, {
        reservationKeys: newMediaKeys,
      });
    } catch (error) {
      await discardReservedUploads(newMediaKeys);
      throw error;
    }
    await deleteMediaOrQueue(oldMediaKeys);
    return res.json({ success: true, user: updatedUser, message: "Profile updated successfully" });
  } catch (error) {
    return next(error);
  }
};

export const discoverUsers: RequestHandler = async (req, res, next) => {
  try {
    const input = req.body?.input;
    if (!isNonEmptyString(input, 100)) {
      return res.status(400).json({ success: false, message: "A search term is required" });
    }

    const users = await userService.searchUsers(input.trim(), req.userId);
    return res.json({ success: true, users });
  } catch (error) {
    return next(error);
  }
};

/**
 * Kept at its original path for clients that still call it. An open account is
 * followed immediately; a private one gets a request it has to approve. The
 * response carries the resulting relationship so a caller can render the right
 * button without a second round trip.
 */
export const followUser: RequestHandler = async (req, res, next) => {
  try {
    const targetId = req.body?.id;
    if (!(await userService.validateTargetUser(req.userId, targetId, "allowFollowers"))) {
      return res.status(403).json({ success: false, message: "This user does not allow followers" });
    }

    const action = await userService.requestFollow(req.userId, targetId);
    const relationship = await userService.getRelationshipState(req.userId, targetId);
    return res.json({
      success: true,
      action,
      relationship,
      message: relationship.isFollowing ? "You are now following this user" : "Follow request sent",
    });
  } catch (error) {
    return next(error);
  }
};

/** Stops following, and withdraws a request that was never approved. */
export const unfollowUser: RequestHandler = async (req, res, next) => {
  try {
    const targetId = req.body?.id;
    if (!isUserId(targetId) || targetId === req.userId) {
      return res.status(400).json({ success: false, message: "Invalid user" });
    }

    await userService.unfollowUser(req.userId, targetId);
    const relationship = await userService.getRelationshipState(req.userId, targetId);
    return res.json({ success: true, relationship, message: "You are no longer following this user" });
  } catch (error) {
    return next(error);
  }
};

export const sendConnectionRequest: RequestHandler = async (req, res, next) => {
  try {
    const targetId = req.body?.id;
    if (!(await userService.validateTargetUser(req.userId, targetId, "allowFollowers"))) {
      return res.status(403).json({ success: false, message: "This user does not allow connection requests" });
    }

    const connection = await userService.getConnectionBetweenUsers(req.userId, targetId);

    if (connection?.status === "accepted") {
      return res.json({ success: false, message: "You are already connected with this user" });
    }
    if (connection) return res.json({ success: false, message: "Connection request pending" });

    try {
      await userService.createConnection(req.userId, targetId);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "Connection request already exists",
        });
      }
      throw error;
    }
    
    return res.json({ success: true, message: "Connection request sent successfully" });
  } catch (error) {
    return next(error);
  }
};

export const getUserConnection: RequestHandler = async (req, res, next) => {
  try {
    const section = req.query?.section;
    if (section !== undefined) {
      if (
        typeof section !== "string" ||
        !["connections", "followers", "following", "pendingConnections"].includes(
          section
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid relationship section",
        });
      }
      const pagination = parsePagination(req.query, {
        defaultLimit: 50,
        maxLimit: 100,
      });
      const page = await userService.getUserRelationshipPage(
        req.userId,
        section as userService.RelationshipSection,
        pagination
      );
      return res.json({ success: true, section, ...page });
    }

    const connectionData = await userService.getUserConnectionsData(req.userId);
    if (!connectionData) return res.json({ success: false, message: "User not found" });

    return res.json({ success: true, ...connectionData });
  } catch (error) {
    return next(error);
  }
};

export const acceptConnectionRequest: RequestHandler = async (req, res, next) => {
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

export const removeConnection: RequestHandler = async (req, res, next) => {
  try {
    const targetId = req.body?.id;
    if (!isUserId(targetId) || targetId === req.userId) {
      return res.status(400).json({ success: false, message: "Invalid user" });
    }
    const removed = await userService.removeConnection(req.userId, targetId);
    if (!removed) {
      return res.status(404).json({ success: false, message: "Connection not found" });
    }
    return res.json({ success: true, message: "Connection removed" });
  } catch (error) {
    return next(error);
  }
};

export const getUserProfile: RequestHandler = async (req, res, next) => {
  try {
    const profileId = req.body?.profileId;
    if (!isUserId(profileId)) {
      return res.status(400).json({ success: false, message: "Invalid profile id" });
    }

    const pagination = parsePagination(req.query, { defaultLimit: 30, maxLimit: 50 });
    const result = await userService.getUserProfileAndPosts(
      profileId,
      req.userId,
      pagination
    );
    if (!result) return res.json({ success: false, message: "Profile not found" });
    return res.json({
      success: true,
      profile: result.profile,
      posts: result.posts,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Profile location is written through its own endpoints rather than the generic
 * profile update, because it is the one field a client may not author. The
 * request names a dataset record; the backend re-reads that record, rejects it
 * if it is unknown or deactivated, and renders the label itself.
 */
export const getProfileLocation: RequestHandler = async (req, res, next) => {
  try {
    return res.json({ success: true, location: await locationService.getProfileLocation(req.userId) });
  } catch (error) {
    return next(error);
  }
};

export const saveProfileLocation: RequestHandler = async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const candidates = (["city", "state", "country"] as const)
      .map((kind) => ({ kind, id: locationService.parseLocationId(body[`${kind}Id`]) }))
      .filter((candidate) => candidate.id !== null);

    if (candidates.length !== 1) {
      return res.status(400).json({ success: false, message: "Supply exactly one of cityId, stateId or countryId" });
    }
    if (body.visibility !== undefined && !locationService.parseVisibility(body.visibility)) {
      return res.status(400).json({ success: false, message: "Unsupported location visibility" });
    }

    const [selection] = candidates;
    const saved = await locationService.saveProfileLocation(
      req.userId,
      { kind: selection.kind, id: selection.id as number },
      {
        source: locationService.parseSource(body.source),
        visibility: locationService.parseVisibility(body.visibility),
        locale: locationService.parseLocale(req.query?.locale ?? req.get("accept-language")),
      },
    );
    if (!saved) return res.status(404).json({ success: false, message: "Location not found" });

    return res.json({ success: true, location: saved });
  } catch (error) {
    return next(error);
  }
};

export const updateProfileLocationVisibility: RequestHandler = async (req, res, next) => {
  try {
    const visibility = locationService.parseVisibility(req.body?.visibility);
    if (!visibility) return res.status(400).json({ success: false, message: "Unsupported location visibility" });
    return res.json({ success: true, location: await locationService.updateProfileLocationVisibility(req.userId, visibility) });
  } catch (error) {
    return next(error);
  }
};

export const clearProfileLocation: RequestHandler = async (req, res, next) => {
  try {
    return res.json({ success: true, location: await locationService.clearProfileLocation(req.userId) });
  } catch (error) {
    return next(error);
  }
};

export const getSuggestedUsers: RequestHandler = async (req, res, next) => {
  try {
    const users = await userService.getSuggestedUsersList(req.userId);
    if (!users) return res.json({ success: false, message: "User not found" });

    return res.json({ success: true, users });
  } catch (error) {
    return next(error);
  }
};
