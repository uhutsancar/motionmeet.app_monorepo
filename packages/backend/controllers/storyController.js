import imagekit from "../configs/imageKit.js";

import { extractS3Key, uploadToS3 } from "../utils/s3Utils.js";
import { isObjectId, isOptionalString } from "../utils/validation.js";
import { hasValidMediaSignature } from "../utils/mediaValidation.js";
import * as storyService from "../services/storyService.js";
import { deleteMediaOrQueue } from "../services/mediaDeletionService.js";
import {
  commitReservedUploads,
  discardReservedUploads,
  resolveReservedUploads,
} from "../services/mediaUploadService.js";

export const addUserStory = async (req, res, next) => {
  try {
    const { content, media_type, background_color } = req.body || {};
    const media = req.file;
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
      const { key } = await uploadToS3(media.buffer, media.originalname, "stories", media.mimetype);
      mediaKey = key;
      const cleanKey = key.startsWith('/') ? key.slice(1) : key;
      mediaUrl = imagekit.url({
        path: cleanKey,
        ...(resolvedMediaType === "image"
          ? { transformation: [{ quality: "auto" }, { format: "webp" }] }
          : {}),
        transformationPosition: "query",
      });
    }

    let story;
    try {
      story = await storyService.createStory({
        user: req.userId,
        content: content?.trim() || "",
        media_url: mediaUrl,
        media_key: mediaKey,
        media_type: resolvedMediaType,
        background_color: background_color?.trim() || "",
      });
    } catch (error) {
      if (mediaKey) await discardReservedUploads([mediaKey]);
      throw error;
    }
    await commitReservedUploads(reservedUploads.map(({ key }) => key));

    return res.json({ success: true, story });
  } catch (error) {
    return next(error);
  }
};

export const getStories = async (req, res, next) => {
  try {
    const stories = await storyService.getStoriesForUser(req.userId);
    if (!stories) return res.status(404).json({ success: false, message: "User not found" });

    return res.json({ success: true, stories });
  } catch (error) {
    return next(error);
  }
};

export const deleteStory = async (req, res, next) => {
  try {
    const { storyId } = req.params;
    if (!isObjectId(storyId)) {
      return res.status(400).json({ success: false, message: "Invalid story id" });
    }

    const story = await storyService.getStoryById(storyId);
    if (!story) return res.json({ success: false, message: "Story not found" });
    if (story.user.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this story" });
    }

    const key = story.media_key || extractS3Key(story.media_url);
    await storyService.deleteStoryById(story);
    if (key) await deleteMediaOrQueue([key]);

    return res.json({ success: true, storyId, message: "Story deleted successfully" });
  } catch (error) {
    return next(error);
  }
};
