import imagekit from "../configs/imageKit.js";
import { extractS3Key, uploadToS3 } from "../utils/s3Utils.js";
import { emitToUser } from "../realtime/socketRegistry.js";
import { isObjectId, isOptionalString, isUserId } from "../utils/validation.js";
import { hasValidMediaSignature } from "../utils/mediaValidation.js";
import * as messageService from "../services/messageService.js";
import { deleteMediaOrQueue } from "../services/mediaDeletionService.js";
import { parsePagination } from "../utils/pagination.js";
import {
  commitReservedUploads,
  discardReservedUploads,
  resolveReservedUploads,
} from "../services/mediaUploadService.js";

export const sendMessage = async (req, res, next) => {
  try {
    const { to_user_id: recipientId, text } = req.body || {};
    const image = req.file;

    if (!(await messageService.canSendToUser(req.dbUser, recipientId))) {
      return res.status(403).json({ success: false, message: "You cannot message this user" });
    }
    const reservedUploads = await resolveReservedUploads(
      req.userId,
      "messages",
      req.body?.uploadedKey
    );
    if (image && reservedUploads.length) {
      return res.status(400).json({ success: false, message: "Supply only one message image" });
    }
    const reservedImage = reservedUploads[0];
    if (!isOptionalString(text, 2000) || (!text?.trim() && !image && !reservedImage)) {
      return res.status(400).json({ success: false, message: "Message content is required" });
    }
    if (image && !hasValidMediaSignature(image)) {
      return res.status(415).json({ success: false, message: "Uploaded image content is invalid" });
    }
    if (image && !imagekit) {
      return res.status(503).json({ success: false, message: "Media service is not configured" });
    }

    let mediaUrl = reservedImage?.url || "";
    let mediaKey = reservedImage?.key || "";
    if (image) {
      const { key } = await uploadToS3(image.buffer, image.originalname, "messages", image.mimetype);
      mediaKey = key;
      mediaUrl = imagekit.url({
        path: key,
        transformation: [{ quality: "auto" }, { format: "webp" }, { width: "1280" }],
        transformationPosition: "query",
      });
    }

    let populated;
    try {
      populated = await messageService.createMessage({
        from_user_id: req.userId,
        to_user_id: recipientId,
        text: text?.trim() || "",
        message_type: image || reservedImage ? "image" : "text",
        media_url: mediaUrl,
        media_key: mediaKey,
        seen: false,
      });
    } catch (error) {
      if (mediaKey) await discardReservedUploads([mediaKey]);
      throw error;
    }
    await commitReservedUploads(reservedUploads.map(({ key }) => key));

    emitToUser(recipientId, "message_received", populated);
    emitToUser(req.userId, "message_sent", populated);
    return res.json({ success: true, message: populated });
  } catch (error) {
    return next(error);
  }
};

export const getChatMessages = async (req, res, next) => {
  try {
    const recipientId = req.body?.to_user_id;
    if (!isUserId(recipientId) || recipientId === req.userId) {
      return res.status(400).json({ success: false, message: "Invalid conversation user" });
    }

    const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const { items: messages, nextCursor } =
      await messageService.getChatMessagesList(req.userId, recipientId, pagination);

    return res.json({ success: true, messages, nextCursor });
  } catch (error) {
    return next(error);
  }
};

export const getUserConversations = async (req, res, next) => {
  try {
    const conversations = await messageService.getUserConversationsList(req.userId);
    return res.json({ success: true, conversations });
  } catch (error) {
    return next(error);
  }
};

export const getUserRecentMessages = async (req, res, next) => {
  try {
    const messages = await messageService.getRecentMessages(req.userId);
    return res.json({ success: true, messages });
  } catch (error) {
    return next(error);
  }
};

export const markSeen = async (req, res, next) => {
  try {
    const senderId = req.body?.from_user_id;
    if (!isUserId(senderId)) {
      return res.status(400).json({ success: false, message: "Invalid conversation user" });
    }

    await messageService.markMessagesSeen(req.userId, senderId);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};

export const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    if (!isObjectId(messageId)) {
      return res.status(400).json({ success: false, message: "Invalid message id" });
    }

    const message = await messageService.getMessageById(messageId);
    if (!message) return res.json({ success: false, message: "Message not found" });
    if (message.from_user_id.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this message" });
    }

    const key = message.media_key || extractS3Key(message.media_url);
    await messageService.deleteMessageById(message);
    if (key) await deleteMediaOrQueue([key]);

    emitToUser(message.to_user_id.toString(), "message_deleted", { messageId });
    emitToUser(req.userId, "message_deleted", { messageId });
    return res.json({ success: true, messageId });
  } catch (error) {
    return next(error);
  }
};
