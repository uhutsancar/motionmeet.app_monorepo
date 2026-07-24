import Message from "../models/Message.js";
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

export const getUserConversationsList = async (userId) => {
  const rows = await Message.aggregate([
    {
      $match: {
        $or: [{ from_user_id: userId }, { to_user_id: userId }],
      },
    },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $set: {
        partnerId: {
          $cond: [
            { $eq: ["$from_user_id", userId] },
            "$to_user_id",
            "$from_user_id",
          ],
        },
      },
    },
    {
      $group: {
        _id: "$partnerId",
        lastMessage: { $first: "$$ROOT" },
      },
    },
    { $sort: { "lastMessage.createdAt": -1 } },
    { $limit: 100 },
  ]);

  const messages = rows.map((row) => row.lastMessage);
  await Message.populate(messages, [
    { path: "from_user_id", select: PUBLIC_USER_FIELDS },
    { path: "to_user_id", select: PUBLIC_USER_FIELDS },
  ]);

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
  return await Message.findById(messageId).select("+media_key");
};

export const deleteMessageById = async (message) => {
  await message.deleteOne();
};
