import * as userService from "../services/userService.js";
import * as messageService from "../services/messageService.js";
import {
  emitToUser,
  emitToUsers,
  getOnlineUserIds,
  isUserOnline,
  joinUserRoom,
  leaveLocalUser,
} from "./socketRegistry.js";
import { isUserId } from "../utils/validation.js";
import { consumeDistributedLimit } from "../configs/redis.js";

export const emitPresenceToConnections = async (userId, eventName, payload) => {
  const connectionIds = await userService.getAcceptedConnectionUserIds(userId);
  emitToUsers(connectionIds, eventName, payload);
};

export const handleSocketConnection = async (socket) => {
  const userId = socket.data.userId;
  const wasOffline = !(await isUserOnline(userId));
  await joinUserRoom(socket, userId);
  const connectionIds = await userService.getAcceptedConnectionUserIds(userId);
  socket.data.connectionIds = connectionIds;
  const onlineConnections = [
    ...(await getOnlineUserIds(connectionIds)),
  ];
  socket.emit(
    "online_users",
    onlineConnections
  );
  if (wasOffline) {
    await emitPresenceToConnections(userId, "user_online", { userId });
  }

  socket.on("send_message", async (payload = {}) => {
    const operationId =
      typeof payload.operationId === "string" ? payload.operationId : "";
    const emitMessageError = (message) =>
      socket.emit("message_error", { message, operationId });
    try {
      const recipientId = payload.to_user_id;
      const text = typeof payload.text === "string" ? payload.text.trim() : "";
      if (
        !isUserId(recipientId) ||
        recipientId === userId ||
        !text ||
        text.length > 2000 ||
        operationId.length < 8 ||
        operationId.length > 128
      ) {
        return emitMessageError("Invalid message");
      }

      if (!(await consumeDistributedLimit(`messages:${userId}`, 30, 60))) {
        return emitMessageError("Message rate limit reached");
      }

      const sender = /** @type {any} */ (await userService.getUserById(userId));
      if (!sender || !(await messageService.canSendToUser(sender, recipientId))) {
        return emitMessageError("You cannot message this user");
      }

      const populated = await messageService.createMessage({
        from_user_id: userId,
        to_user_id: recipientId,
        operationId,
        text,
        message_type: "text",
        media_url: "",
        seen: false,
      });

      emitToUser(recipientId, "message_received", populated);
      emitToUser(userId, "message_sent", populated);
    } catch (error) {
      console.error("Socket message error:", error);
      emitMessageError("Message could not be sent");
    }
  });

  const emitTyping = async (eventName, payload = {}) => {
    const recipientId = payload.to_user_id;
    if (!isUserId(recipientId) || recipientId === userId) return;

    try {
      if (!(await consumeDistributedLimit(`typing:${userId}`, 60, 60))) {
        return;
      }
      const cache = socket.data.messagePermissionCache || new Map();
      socket.data.messagePermissionCache = cache;
      const cached = cache.get(recipientId);
      let allowed = cached?.expiresAt > Date.now() ? cached.allowed : null;
      if (allowed === null) {
        allowed = await messageService.canSendToUser(
          socket.data.user,
          recipientId
        );
        cache.set(recipientId, {
          allowed,
          expiresAt: Date.now() + 30_000,
        });
      }
      if (allowed) {
        emitToUser(recipientId, eventName, { from_user_id: userId });
      }
    } catch (error) {
      console.error("Socket typing event error:", error.message);
    }
  };
  socket.on("typing_start", (payload) => void emitTyping("typing_start", payload));
  socket.on("typing_stop", (payload) => void emitTyping("typing_stop", payload));

  socket.on("disconnect", async () => {
    leaveLocalUser(socket, userId);
    if (!(await isUserOnline(userId))) {
      await emitPresenceToConnections(userId, "user_offline", { userId });
    }
  });
};
