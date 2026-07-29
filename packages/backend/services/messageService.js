import mongoose from "mongoose";
import Connection from "../models/Connection.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { isUserId } from "../utils/validation.js";
import { cursorFilter, pageFromDocuments } from "../utils/pagination.js";
import { extractS3Key } from "../utils/s3Utils.js";
import { queueMediaDeletions } from "./mediaDeletionService.js";
import { commitReservedUploads } from "./mediaUploadService.js";

const PUBLIC_USER_FIELDS = "_id full_name username profile_picture";

export const conversationPairKey = (left, right) =>
  [String(left), String(right)].sort().join(":");

export const canSendToUser = async (sender, recipientId) => {
  const senderId = sender?._id?.toString();
  if (!isUserId(recipientId) || recipientId === senderId) return false;
  if (
    !(await User.exists({
      _id: recipientId,
      "privacy.allowMessages": { $ne: false },
    }))
  ) {
    return false;
  }
  if (
    sender.role === "superadmin" ||
    sender.plan?.features?.can_message_anyone
  ) {
    return true;
  }
  return Boolean(
    await Connection.exists({
      pairKey: conversationPairKey(senderId, recipientId),
      status: "accepted",
    })
  );
};

export const findMessageByOperation = async (userId, operationId) =>
  Message.findOne({ from_user_id: userId, operationId }).populate(
    "from_user_id",
    PUBLIC_USER_FIELDS
  );

export const createMessage = async (data, { reservationKeys = [] } = {}) => {
  if (data.operationId) {
    const existing = await findMessageByOperation(
      data.from_user_id,
      data.operationId
    );
    if (existing) return existing;
  }
  const participants = [data.from_user_id, data.to_user_id].map(String).sort();
  const pairKey = participants.join(":");
  const session = await mongoose.startSession();
  let message = null;

  try {
    try {
      await session.withTransaction(async () => {
      const conversation = await Conversation.findOneAndUpdate(
        { pairKey },
        {
          $setOnInsert: {
            pairKey,
            participants,
            unreadByUser: {
              [participants[0]]: 0,
              [participants[1]]: 0,
            },
          },
        },
        { upsert: true, new: true, session, setDefaultsOnInsert: true }
      );

      [message] = await Message.create(
        [{ ...data, conversationId: conversation._id }],
        { session }
      );
      await commitReservedUploads(reservationKeys, {
        session,
        userId: data.from_user_id,
      });

      await Conversation.updateOne(
        { _id: conversation._id },
        {
          $set: {
            lastMessage: message._id,
            lastMessageAt: message.createdAt,
          },
          $inc: {
            [`unreadByUser.${data.to_user_id}`]: 1,
          },
        },
        { session }
      );
      });
    } catch (error) {
      if (error?.code !== 11000 || !data.operationId) throw error;
      message = await Message.findOne({
        from_user_id: data.from_user_id,
        operationId: data.operationId,
      });
      if (!message) throw error;
    }
  } finally {
    await session.endSession();
  }

  if (!message) throw new Error("Message transaction did not create a message");
  return Message.findById((/** @type {any} */ (message))._id).populate(
    "from_user_id",
    PUBLIC_USER_FIELDS
  );
};

export const markMessagesSeen = async (userId, senderId) => {
  const pairKey = conversationPairKey(userId, senderId);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const conversation = await Conversation.findOne({ pairKey })
        .select("_id")
        .session(session);
      if (!conversation) return;
      await Message.updateMany(
        {
          conversationId: conversation._id,
          to_user_id: userId,
          seen: false,
        },
        { $set: { seen: true } },
        { session }
      );
      await Conversation.updateOne(
        { _id: conversation._id },
        { $set: { [`unreadByUser.${userId}`]: 0 } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
};

export const getChatMessagesList = async (
  userId,
  recipientId,
  pagination
) => {
  const pairKey = conversationPairKey(userId, recipientId);
  const conversation = await Conversation.findOne({ pairKey })
    .select("_id")
    .lean();
  if (!conversation) return { items: [], nextCursor: null };

  const messages = await Message.find({
    conversationId: conversation._id,
    ...cursorFilter(pagination.cursor, "createdAt"),
  })
    .populate("from_user_id", PUBLIC_USER_FIELDS)
    .sort({ createdAt: -1, _id: -1 })
    .limit(pagination.limit + 1);

  const page = pageFromDocuments(messages, pagination.limit, "createdAt");
  page.items.reverse();
  await markMessagesSeen(userId, recipientId);
  return page;
};

export const getUserConversationsList = async (userId, pagination) => {
  const conversations = await Conversation.find({
    participants: userId,
    ...cursorFilter(pagination.cursor, "lastMessageAt"),
  })
    .populate({
      path: "lastMessage",
      populate: [
        { path: "from_user_id", select: PUBLIC_USER_FIELDS },
        { path: "to_user_id", select: PUBLIC_USER_FIELDS },
      ],
    })
    .sort({ lastMessageAt: -1, _id: -1 })
    .limit(pagination.limit + 1)
    .lean();

  const page = pageFromDocuments(
    conversations,
    pagination.limit,
    "lastMessageAt"
  );
  const items = page.items.flatMap((conversation) => {
    const conversationData = /** @type {any} */ (conversation);
    const message = conversationData.lastMessage;
    if (!message) return [];
    const fromId = message.from_user_id?._id?.toString();
    const toId = message.to_user_id?._id?.toString();
    if (!fromId || !toId) return [];
    return [
      {
        conversationId: conversationData._id,
        partner:
          fromId === userId ? message.to_user_id : message.from_user_id,
        lastMessage: message,
        unreadCount: Number(conversationData.unreadByUser?.[userId] || 0),
      },
    ];
  });
  return { items, nextCursor: page.nextCursor };
};

export const getRecentMessages = async (userId) => {
  return Message.find({ to_user_id: userId })
    .populate("from_user_id", PUBLIC_USER_FIELDS)
    .populate("to_user_id", PUBLIC_USER_FIELDS)
    .sort({ createdAt: -1, _id: -1 })
    .limit(50);
};

export const getMessageById = async (messageId) => {
  return Message.findById(messageId).select("+media_key");
};

export const deleteMessageById = async (message) => {
  const key = message.media_key || extractS3Key(message.media_url);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await Message.findById(message._id).session(session);
      if (!current) return;
      if (key) await queueMediaDeletions([key], { session });
      await Message.deleteOne({ _id: current._id }, { session });

      const conversationId = current.conversationId;
      if (!conversationId) return;
      const conversation = await Conversation.findById(conversationId)
        .select("lastMessage")
        .session(session);
      if (!conversation) return;

      const updates = {};
      if (current.seen === false) {
        updates[`unreadByUser.${current.to_user_id}`] = {
          $max: [
            0,
            {
              $subtract: [
                {
                  $ifNull: [
                    `$unreadByUser.${current.to_user_id}`,
                    0,
                  ],
                },
                1,
              ],
            },
          ],
        };
      }

      if (conversation.lastMessage?.toString() === current._id.toString()) {
        const previous = await Message.findOne({ conversationId })
          .sort({ createdAt: -1, _id: -1 })
          .select("_id createdAt")
          .session(session);
        if (!previous) {
          await Conversation.deleteOne({ _id: conversationId }, { session });
          return;
        }
        updates.lastMessage = previous._id;
        updates.lastMessageAt = previous.createdAt;
      }

      if (Object.keys(updates).length) {
        await Conversation.updateOne(
          { _id: conversationId },
          [{ $set: updates }],
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }
};
