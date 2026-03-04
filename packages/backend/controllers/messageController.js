import fs from "fs";
import imagekit from "../configs/imageKit.js";
import Message from "../models/Message.js";

// Lazily imported to avoid circular deps — server exports io after modules load
let _io, _userSockets;
const getIO = async () => {
  if (!_io) {
    const mod = await import("../server.js");
    _io = mod.io;
    _userSockets = mod.userSockets;
  }
  return { io: _io, userSockets: _userSockets };
};

// Helper: push a message to the recipient's open sockets
const notifyRecipient = async (toUserId, message) => {
  try {
    const { io, userSockets } = await getIO();
    const recipientSockets = userSockets.get(toUserId);
    if (recipientSockets) {
      recipientSockets.forEach((sid) => {
        io.to(sid).emit("message_received", message);
      });
    }
  } catch (err) {
    console.error("notifyRecipient error:", err.message);
  }
};

// ── HTTP: send message (supports images via multipart) ──────────────────────
export const sendMessage = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { to_user_id, text } = req.body;
    const image = req.file;

    let media_url = "";
    let message_type = image ? "image" : "text";

    if (image) {
      const fileBuffer = fs.readFileSync(image.path);
      const uploadRes = await imagekit.upload({
        file: fileBuffer,
        fileName: image.originalname,
      });
      media_url = imagekit.url({
        path: uploadRes.filePath,
        transformation: [{ quality: "auto" }, { format: "webp" }, { width: "1280" }],
      });
    }

    const message = await Message.create({
      from_user_id: userId,
      to_user_id,
      text,
      message_type,
      media_url,
      seen: false,
    });

    res.json({ success: true, message });

    // Emit to recipient via socket (non-blocking)
    const populated = await Message.findById(message._id).populate("from_user_id");
    await notifyRecipient(to_user_id, populated);
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// ── HTTP: get messages between two users ────────────────────────────────────
export const getChatMessages = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { to_user_id } = req.body;

    const messages = await Message.find({
      $or: [
        { from_user_id: userId, to_user_id },
        { from_user_id: to_user_id, to_user_id: userId },
      ],
    })
      .populate("from_user_id", "full_name username profile_picture")
      .sort({ created_at: 1 });

    // Mark received messages as seen
    await Message.updateMany(
      { from_user_id: to_user_id, to_user_id: userId, seen: false },
      { seen: true }
    );

    res.json({ success: true, messages });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// ── HTTP: get recent conversations list ─────────────────────────────────────
export const getUserConversations = async (req, res) => {
  try {
    const { userId } = await req.auth();

    // Get all messages involving this user
    const messages = await Message.find({
      $or: [{ from_user_id: userId }, { to_user_id: userId }],
    })
      .populate("from_user_id", "full_name username profile_picture")
      .populate("to_user_id", "full_name username profile_picture")
      .sort({ createdAt: -1 });

    // Group by conversation partner, keep latest message per conversation
    const conversationMap = new Map();
    messages.forEach((msg) => {
      // Use the String IDs directly from the message object if populated structure differs
      const fromId = msg.from_user_id?._id || msg.from_user_id;
      const toId = msg.to_user_id?._id || msg.to_user_id;

      const partnerId = fromId.toString() === userId ? toId.toString() : fromId.toString();

      if (!partnerId || conversationMap.has(partnerId)) return;

      const partner = fromId.toString() === userId ? msg.to_user_id : msg.from_user_id;

      conversationMap.set(partnerId, {
        partner,
        lastMessage: msg,
        unreadCount: 0,
      });
    });

    // Count unread messages per partner
    const unreadCounts = await Message.aggregate([
      { $match: { to_user_id: userId, seen: false } },
      { $group: { _id: "$from_user_id", count: { $sum: 1 } } },
    ]);
    unreadCounts.forEach(({ _id, count }) => {
      const id = _id.toString();
      if (conversationMap.has(id)) {
        conversationMap.get(id).unreadCount = count;
      }
    });

    const conversations = Array.from(conversationMap.values());
    res.json({ success: true, conversations });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// ── Legacy: get messages received by user (kept for compatibility) ───────────
export const getUserRecentMessages = async (req, res) => {
  try {
    const { userId } = await req.auth();

    const messages = await Message.find({ to_user_id: userId })
      .populate("from_user_id to_user_id")
      .sort({ createdAt: -1 });

    res.json({ success: true, messages });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// ── Mark messages as seen ────────────────────────────────────────────────────
export const markSeen = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { from_user_id } = req.body;

    await Message.updateMany(
      { from_user_id, to_user_id: userId, seen: false },
      { seen: true }
    );

    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// ── HTTP: delete a specific message ──────────────────────────────────────────
export const deleteMessage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.json({ success: false, message: "Message not found" });
    }

    // Only allow sender to delete their messages
    if (message.from_user_id.toString() !== userId) {
      return res.json({ success: false, message: "Not authorized to delete this message" });
    }

    await Message.findByIdAndDelete(messageId);

    // Note: To make it disappear on recipient in real-time, you could emit a delete event here
    const { io, userSockets } = await getIO();
    const recipientSockets = userSockets.get(message.to_user_id.toString());
    if (recipientSockets) {
      recipientSockets.forEach((sid) => {
        io.to(sid).emit("message_deleted", { messageId });
      });
    }

    res.json({ success: true, messageId });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
