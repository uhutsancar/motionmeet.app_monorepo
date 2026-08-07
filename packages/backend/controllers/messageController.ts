import imagekit from "../configs/imageKit.js";
import type { RequestHandler } from "express";
import { emitToUser } from "../realtime/socketRegistry.js";
import { isOptionalString, isUserId, isUuid } from "../utils/validation.js";
import { hasValidMediaSignature } from "../utils/mediaValidation.js";
import * as messageService from "../services/messageService.js";
import { parsePagination } from "../utils/pagination.js";
import {
  discardReservedUploads,
  resolveReservedUploads,
  uploadAndReserve,
} from "../services/mediaUploadService.js";

export const sendMessage: RequestHandler = async (req, res, next) => {
  try {
    const { to_user_id: recipientId, text } = req.body || {};
    const image = req.file;
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
    const existingMessage = await messageService.findMessageByOperation(
      req.userId,
      operationId
    );
    if (existingMessage) {
      return res.json({
        success: true,
        message: existingMessage,
        idempotentReplay: true,
      });
    }

    const permission = await messageService.describeSendPermission(req.dbUser, recipientId);
    if (!permission.allowed) {
      // The reason is returned so the app can explain *why* - a locked account
      // needing a mutual follow reads very differently from one that has turned
      // messages off entirely.
      return res.status(403).json({
        success: false,
        reason: permission.reason,
        message: permission.reason === "needs_mutual_follow"
          ? "This account is private; you both need to follow each other to chat"
          : "You cannot message this user",
      });
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
      const { key } = await uploadAndReserve({
        file: image.buffer,
        fileName: image.originalname,
        userId: req.userId,
        purpose: "messages",
        contentType: image.mimetype,
      });
      mediaKey = key;
      mediaUrl = imagekit!.url({
        path: key,
        transformation: [{ quality: "auto" }, { format: "webp" }, { width: "1280" }],
        transformationPosition: "query",
      });
    }

    let populated;
    try {
      populated = await messageService.createMessage(
        {
          from_user_id: req.userId,
          to_user_id: recipientId,
          operationId,
          text: text?.trim() || "",
          message_type: image || reservedImage ? "image" : "text",
          media_url: mediaUrl,
          media_key: mediaKey,
          seen: false,
        },
        { reservationKeys: mediaKey ? [mediaKey] : [] }
      );
    } catch (error) {
      if (mediaKey) await discardReservedUploads([mediaKey]);
      throw error;
    }
    emitToUser(recipientId, "message_received", populated);
    emitToUser(req.userId, "message_sent", populated);
    return res.json({ success: true, message: populated });
  } catch (error) {
    return next(error);
  }
};

export const getChatMessages: RequestHandler = async (req, res, next) => {
  try {
    const recipientId = req.body?.to_user_id;
    if (!isUserId(recipientId) || recipientId === req.userId) {
      return res.status(400).json({ success: false, message: "Invalid conversation user" });
    }

    const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const { items: messages, nextCursor } =
      await messageService.getChatMessagesList(req.userId, recipientId, pagination);
    emitToUser(recipientId, "messages_seen", { by_user_id: req.userId });

    return res.json({ success: true, messages, nextCursor });
  } catch (error) {
    return next(error);
  }
};

export const getUserConversations: RequestHandler = async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100,
    });
    const { items: conversations, nextCursor } =
      await messageService.getUserConversationsList(req.userId, pagination);
    return res.json({ success: true, conversations, nextCursor });
  } catch (error) {
    return next(error);
  }
};

export const getUserRecentMessages: RequestHandler = async (req, res, next) => {
  try {
    const messages = await messageService.getRecentMessages(req.userId);
    return res.json({ success: true, messages });
  } catch (error) {
    return next(error);
  }
};

export const markSeen: RequestHandler = async (req, res, next) => {
  try {
    const senderId = req.body?.from_user_id;
    if (!isUserId(senderId)) {
      return res.status(400).json({ success: false, message: "Invalid conversation user" });
    }

    await messageService.markMessagesSeen(req.userId, senderId);
    emitToUser(senderId, "messages_seen", { by_user_id: req.userId });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};

export const deleteMessage: RequestHandler = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    if (!isUuid(messageId)) {
      return res.status(400).json({ success: false, message: "Invalid message id" });
    }

    const message = await messageService.getMessageById(messageId);
    if (!message) return res.json({ success: false, message: "Message not found" });
    if (message.from_user_id !== req.userId) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this message" });
    }

    await messageService.deleteMessageById(message);

    emitToUser(message.to_user_id, "message_deleted", { messageId });
    emitToUser(req.userId, "message_deleted", { messageId });
    return res.json({ success: true, messageId });
  } catch (error) {
    return next(error);
  }
};
