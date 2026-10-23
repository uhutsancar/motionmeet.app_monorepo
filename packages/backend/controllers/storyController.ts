import { USAGE_LIMITS, usageLimitFor } from "../configs/usageLimits.js";
import imagekit from "../configs/imageKit.js";
import type { RequestHandler } from "express";

import { isOptionalString, isUuid } from "../utils/validation.js";
import { hasValidMediaSignature } from "../utils/mediaValidation.js";
import * as storyService from "../services/storyService.js";
import * as notificationService from "../services/notificationService.js";
import { canViewStoriesOf } from "../services/accessControlService.js";
import {
  discardReservedUploads,
  resolveReservedUploads,
  uploadAndReserve,
} from "../services/mediaUploadService.js";
import { parsePagination } from "../utils/pagination.js";
import { parseStoryOverlays } from "../utils/storyOverlays.js";

export const addUserStory: RequestHandler = async (req, res, next) => {
  try {
    const { content, media_type, background_color } = req.body || {};
    const media = req.file;
    const operationId = req.get("Idempotency-Key") || req.body?.operationId;
    if (
      typeof operationId !== "string" ||
      operationId.length < 8 ||
      operationId.length > 128
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid Idempotency-Key header is required",
      });
    }
    const existingStory = await storyService.findStoryByOperation(
      req.userId,
      operationId
    );
    if (existingStory) {
      return res.json({
        success: true,
        story: existingStory,
        idempotentReplay: true,
      });
    }
    const reservedUploads = await resolveReservedUploads(
      req.userId,
      "stories",
      req.body?.uploadedKey
    );
    if (media && reservedUploads.length) {
      return res.status(400).json({ success: false, message: "Supply only one story upload" });
    }
    const reservedMedia = reservedUploads[0];

    if (!isOptionalString(content, 2000) || !isOptionalString(background_color, 32)) {
      return res.status(400).json({ success: false, message: "Invalid story content" });
    }

    // Multipart bodies arrive as strings, so the overlays field is parsed and
    // re-derived here rather than trusted; see parseStoryOverlays.
    const overlays = parseStoryOverlays(req.body?.overlays);
    if (!overlays) {
      return res.status(400).json({ success: false, message: "Invalid story overlays" });
    }

    const inferredMediaType = media
      ? media.mimetype.startsWith("video/") ? "video" : "image"
      : reservedMedia
        ? reservedMedia.contentType.startsWith("video/") ? "video" : "image"
        : "text";
    const resolvedMediaType = media_type || inferredMediaType;
    if (!["text", "image", "video"].includes(resolvedMediaType) || resolvedMediaType !== inferredMediaType) {
      return res.status(400).json({ success: false, message: "Story media type does not match the upload" });
    }
    if (resolvedMediaType === "text" && !content?.trim()) {
      return res.status(400).json({ success: false, message: "Story content is required" });
    }
    if (media && !hasValidMediaSignature(media)) {
      return res.status(415).json({ success: false, message: "Uploaded media content is invalid" });
    }
    if (media && !imagekit) {
      return res.status(503).json({ success: false, message: "Media service is not configured" });
    }

    let mediaUrl = reservedMedia?.url || "";
    let mediaKey = reservedMedia?.key || "";
    if (media) {
      const { key } = await uploadAndReserve({
        file: media.buffer,
        fileName: media.originalname,
        userId: req.userId,
        purpose: "stories",
        contentType: media.mimetype,
      });
      mediaKey = key;
      const cleanKey = key.startsWith('/') ? key.slice(1) : key;
      mediaUrl = imagekit!.url({
        path: cleanKey,
        ...(resolvedMediaType === "image"
          ? { transformation: [{ quality: "auto" }, { format: "webp" }] }
          : {}),
        transformationPosition: "query",
      });
    }

    let story;
    try {
      const quotaLimit = usageLimitFor(req.dbUser, USAGE_LIMITS.storiesPerDay);
      story = await storyService.createStory(
        {
          user: req.userId,
          operationId,
          content: content?.trim() || "",
          media_url: mediaUrl,
          media_key: mediaKey,
          media_type: resolvedMediaType,
          background_color: background_color?.trim() || "",
          overlays,
        },
        {
          quotaLimit,
          reservationKeys: mediaKey ? [mediaKey] : [],
        }
      );
    } catch (error) {
      if (mediaKey) await discardReservedUploads([mediaKey]);
      throw error;
    }
    return res.json({ success: true, story });
  } catch (error) {
    return next(error);
  }
};

export const getStories: RequestHandler = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, {
      defaultLimit: 100,
      maxLimit: 200,
    });
    const { items: stories, nextCursor } =
      await storyService.getStoriesForUser(req.userId, pagination);

    return res.json({ success: true, stories, nextCursor });
  } catch (error) {
    return next(error);
  }
};

export const deleteStory: RequestHandler = async (req, res, next) => {
  try {
    const { storyId } = req.params;
    if (!isUuid(storyId)) {
      return res.status(400).json({ success: false, message: "Invalid story id" });
    }

    const story = await storyService.getStoryById(storyId);
    if (!story) return res.json({ success: false, message: "Story not found" });
    if (story.user !== req.userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this story" });
    }

    await storyService.deleteStoryById(story);

    return res.json({ success: true, storyId, message: "Story deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

export const viewStory: RequestHandler = async (req, res, next) => {
  try {
    const { storyId } = req.params;
    if (!isUuid(storyId)) {
      return res.status(400).json({ success: false, message: "Invalid story id" });
    }

    // A receipt this viewer already wrote needs none of the work below: not the
    // story read, not the three-query audience check, not the insert. Checking
    // it first is what keeps swiping back through a rail free.
    if (await storyService.storyViewAlreadyRecorded(storyId, req.userId)) {
      return res.json({ success: true });
    }

    // A story id is guessable in principle, so the audience is re-checked here
    // rather than trusting that the client only ever posts ids it was given.
    const story = await storyService.getStoryById(storyId);
    if (!story) return res.status(404).json({ success: false, message: "Story not found" });
    if (!(await canViewStoriesOf(req.userId, story.user))) {
      return res.status(403).json({ success: false, message: "Story is not accessible" });
    }

    await storyService.recordStoryView(storyId, req.userId, story.user);

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};

export const getStoryViewers: RequestHandler = async (req, res, next) => {
  try {
    const { storyId } = req.params;
    if (!isUuid(storyId)) {
      return res.status(400).json({ success: false, message: "Invalid story id" });
    }

    const story = await storyService.getStoryById(storyId);
    if (!story) return res.status(404).json({ success: false, message: "Story not found" });
    // Viewer lists are private to the author.
    if (story.user !== req.userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to view this story audience" });
    }

    const viewers = await storyService.getStoryViewers(storyId);

    return res.json({ success: true, viewers });
  } catch (error) {
    return next(error);
  }
};

/**
 * Reacts to a story, or takes the reaction back.
 *
 * A heart used to be posted into the author's inbox as a direct message, which
 * is why one tap could not be undone and why reactions were mixed in with
 * replies. It writes a like row and an activity row instead: tapping again
 * removes both sides of the state, and the conversation is left alone.
 */
export const setStoryLike: RequestHandler = async (req, res, next) => {
  try {
    const { storyId } = req.params;
    if (!isUuid(storyId)) {
      return res.status(400).json({ success: false, message: "Invalid story id" });
    }

    const story = await storyService.getStoryById(storyId);
    if (!story) return res.status(404).json({ success: false, message: "Story not found" });
    // Ids are guessable in principle, so the audience is re-checked rather than
    // trusting that the client only ever posts ids it was handed.
    if (!(await canViewStoriesOf(req.userId, story.user))) {
      return res.status(403).json({ success: false, message: "Story is not accessible" });
    }

    const liked = req.method !== "DELETE";
    const result = await storyService.setStoryLike(storyId, req.userId, liked);

    if (result.changed && liked) {
      // Best-effort, and outside the write: the like is already durable, and a
      // delivery hiccup must not undo it.
      void notificationService.recordAndPublish({
        userId: story.user,
        actorId: req.userId,
        type: "story_like",
        storyId,
      });
    }

    return res.json({ success: true, liked: result.liked });
  } catch (error) {
    return next(error);
  }
};
