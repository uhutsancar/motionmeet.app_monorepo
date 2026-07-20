import * as userService from "../services/userService.js";
import * as messageService from "../services/messageService.js";
import { emitToUser, userSockets } from "./socketRegistry.js";
import { isUserId } from "../utils/validation.js";

export const emitPresenceToConnections = (user, eventName, payload) => {
  user.connections?.forEach((connectionId) => {
    emitToUser(connectionId.toString(), eventName, payload);
  });
};

export const handleSocketConnection = (socket) => {
  const userId = socket.data.userId;
  const wasOffline = !userSockets.get(userId)?.size;
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socket.id);
  socket.emit(
    "online_users",
    (socket.data.user.connections || [])
      .map((connectionId) => connectionId.toString())
      .filter((connectionId) => userSockets.has(connectionId))
  );
  if (wasOffline) emitPresenceToConnections(socket.data.user, "user_online", { userId });

  const recentMessageTimes = [];
  socket.on("send_message", async (payload = {}) => {
    try {
      const recipientId = payload.to_user_id;
      const text = typeof payload.text === "string" ? payload.text.trim() : "";
      if (!isUserId(recipientId) || recipientId === userId || !text || text.length > 2000) {
        return socket.emit("message_error", { message: "Invalid message" });
      }

      const now = Date.now();
      while (recentMessageTimes.length && recentMessageTimes[0] < now - 60_000) recentMessageTimes.shift();
      if (recentMessageTimes.length >= 30) {
        return socket.emit("message_error", { message: "Message rate limit reached" });
      }
      recentMessageTimes.push(now);

      const sender = /** @type {any} */ (await userService.getUserById(userId));
      const recipientExists = await userService.userExists(recipientId);
      const canMessageAnyone = sender?.role === "superadmin" || sender?.plan?.features?.can_message_anyone;
      const isConnected = sender?.connections?.includes(recipientId);
      if (!sender || !recipientExists || (!canMessageAnyone && !isConnected)) {
        return socket.emit("message_error", { message: "You cannot message this user" });
      }

      const populated = await messageService.createMessage({
        from_user_id: userId,
        to_user_id: recipientId,
        text,
        message_type: "text",
        media_url: "",
        seen: false,
      });

      emitToUser(recipientId, "message_received", populated);
      emitToUser(userId, "message_sent", populated);
    } catch (error) {
      console.error("Socket message error:", error);
      socket.emit("message_error", { message: "Message could not be sent" });
    }
  });

  const emitTyping = async (eventName, payload = {}) => {
    const recipientId = payload.to_user_id;
    if (!isUserId(recipientId) || recipientId === userId) return;

    try {
      const sender = /** @type {any} */ (await userService.getUserById(userId));
      const canMessageAnyone = sender?.role === "superadmin" || sender?.plan?.features?.can_message_anyone;
      const isConnected = sender?.connections?.includes(recipientId);
      if (sender && (canMessageAnyone || isConnected)) {
        emitToUser(recipientId, eventName, { from_user_id: userId });
      }
    } catch (error) {
      console.error("Socket typing event error:", error.message);
    }
  };
  socket.on("typing_start", (payload) => void emitTyping("typing_start", payload));
  socket.on("typing_stop", (payload) => void emitTyping("typing_stop", payload));

  socket.on("disconnect", () => {
    userSockets.get(userId)?.delete(socket.id);
    if (!userSockets.get(userId)?.size) {
      userSockets.delete(userId);
      emitPresenceToConnections(socket.data.user, "user_offline", { userId });
    }
  });
};
