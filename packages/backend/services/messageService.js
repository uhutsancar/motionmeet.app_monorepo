import Message from "../models/Message.js";
import User from "../models/User.js";
import { isUserId } from "../utils/validation.js";

const PUBLIC_USER_FIELDS = "_id full_name username profile_picture";

export const canSendToUser = async (sender, recipientId) => {
  if (!isUserId(recipientId) || recipientId === sender._id.toString()) return false;
  if (!(await User.exists({ _id: recipientId }))) return false;
  if (sender.role === "superadmin" || sender.plan?.features?.can_message_anyone) return true;
  return sender.connections?.includes(recipientId) || false;
};

export const createMessage = async (data) => {
  const message = await Message.create(data);
  return await Message.findById(message._id).populate("from_user_id", PUBLIC_USER_FIELDS);
};

export const getChatMessagesList = async (userId, recipientId) => {
  const messages = await Message.find({
    $or: [
      { from_user_id: userId, to_user_id: recipientId },
      { from_user_id: recipientId, to_user_id: userId },
    ],
  })
    .populate("from_user_id", PUBLIC_USER_FIELDS)
    .sort({ createdAt: -1 })
    .limit(1000);

  messages.reverse();

  await Message.updateMany(
    { from_user_id: recipientId, to_user_id: userId, seen: false },
    { seen: true }
  );

  return messages;
};

export const getUserConversationsList = async (userId) => {
  const messages = await Message.find({
    $or: [{ from_user_id: userId }, { to_user_id: userId }],
  })
    .populate("from_user_id", PUBLIC_USER_FIELDS)
    .populate("to_user_id", PUBLIC_USER_FIELDS)
    .sort({ createdAt: -1 })
    .limit(2000);

  const conversationMap = new Map();
  messages.forEach((message) => {
    const fromUser = /** @type {any} */ (message.from_user_id);
    const toUser = /** @type {any} */ (message.to_user_id);
    const fromId = fromUser?._id?.toString();
    const toId = toUser?._id?.toString();
    if (!fromId || !toId) return;

    const partnerId = fromId === userId ? toId : fromId;
    if (!conversationMap.has(partnerId)) {
      conversationMap.set(partnerId, {
        partner: fromId === userId ? toUser : fromUser,
        lastMessage: message,
        unreadCount: 0,
      });
    }
  });

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
  return await Message.findById(messageId);
};

export const deleteMessageById = async (message) => {
  await message.deleteOne();
};
