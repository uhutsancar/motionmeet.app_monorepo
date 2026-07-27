import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import { isUserId } from "../utils/validation.js";
import { cursorFilter, pageFromDocuments } from "../utils/pagination.js";

const PUBLIC_USER_FIELDS = "_id full_name username profile_picture";

export const canSendToUser = async (sender, recipientId) => {
  if (!isUserId(recipientId) || recipientId === sender._id.toString()) return false;
  if (!(await User.exists({
    _id: recipientId,
    "privacy.allowMessages": { $ne: false },
  }))) return false;
  if (sender.role === "superadmin" || sender.plan?.features?.can_message_anyone) return true;
  return sender.connections?.includes(recipientId) || false;
};

export const createMessage = async (data) => {
  const message = await Message.create(data);
  
  // Mesaj gönderildiğinde Conversation modelini güncelle veya oluştur
  await Conversation.findOneAndUpdate(
    { participants: { $all: [data.from_user_id, data.to_user_id] } },
    {
      $set: { lastMessage: message._id, updatedAt: new Date() },
      $setOnInsert: { participants: [data.from_user_id, data.to_user_id] }
    },
    { upsert: true, new: true }
  );

  return await Message.findById(message._id).populate("from_user_id", PUBLIC_USER_FIELDS);
};

export const getChatMessagesList = async (userId, recipientId, pagination) => {
  const messages = await Message.find({
    $and: [
      {
        $or: [
          { from_user_id: userId, to_user_id: recipientId },
          { from_user_id: recipientId, to_user_id: userId },
        ],
      },
      cursorFilter(pagination.cursor, "createdAt"),
    ],
  })
    .populate("from_user_id", PUBLIC_USER_FIELDS)
    .sort({ createdAt: -1, _id: -1 })
    .limit(pagination.limit + 1);

  const page = pageFromDocuments(messages, pagination.limit, "createdAt");
  page.items.reverse();

  await Message.updateMany(
    { from_user_id: recipientId, to_user_id: userId, seen: false },
    { seen: true }
  );

  return page;
};

export const getUserConversationsList = async (userId, limit = 50) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  
  // 1. Conversation tablosundan doğrudan çekiyoruz (Önceden Message tablosundan $group aggregation yapılıyordu ve bu çok pahalıydı)
  const conversations = await Conversation.find({ participants: userId })
    .populate({
      path: "lastMessage",
      populate: [
        { path: "from_user_id", select: PUBLIC_USER_FIELDS },
        { path: "to_user_id", select: PUBLIC_USER_FIELDS }
      ]
    })
    .sort({ updatedAt: -1 })
    .limit(safeLimit)
    .lean();

  const conversationMap = new Map();
  
  conversations.forEach((conv) => {
    const message = conv.lastMessage;
    if (!message) return;
    
    const msgAny = /** @type {any} */ (message);
    const fromId = msgAny.from_user_id?._id?.toString();
    const toId = msgAny.to_user_id?._id?.toString();
    if (!fromId || !toId) return;

    const partnerId = fromId === userId ? toId : fromId;
    if (!conversationMap.has(partnerId)) {
      conversationMap.set(partnerId, {
        partner: fromId === userId ? msgAny.to_user_id : msgAny.from_user_id,
        lastMessage: message,
        unreadCount: 0,
      });
    }
  });

  // 2. Sadece okunmamış mesaj sayısını bulmak için aggregate (Bu da çok daha ucuzdur)
  const unreadCounts = await Message.aggregate([
    { $match: { to_user_id: userId, seen: false } },
    { $group: { _id: "$from_user_id", count: { $sum: 1 } } },
  ]);
  
  unreadCounts.forEach(({ _id, count }) => {
    const conversation = conversationMap.get(_id.toString());
    if (conversation) conversation.unreadCount = count;
  });

  return Array.from(conversationMap.values());
};

export const getRecentMessages = async (userId) => {
  return await Message.find({ to_user_id: userId })
    .populate("from_user_id", PUBLIC_USER_FIELDS)
    .populate("to_user_id", PUBLIC_USER_FIELDS)
    .sort({ createdAt: -1 })
    .limit(100);
};

export const markMessagesSeen = async (userId, senderId) => {
  await Message.updateMany(
    { from_user_id: senderId, to_user_id: userId, seen: false },
    { seen: true }
  );
};

export const getMessageById = async (messageId) => {
  return await Message.findById(messageId).select("+media_key");
};

export const deleteMessageById = async (message) => {
  await message.deleteOne();
};
