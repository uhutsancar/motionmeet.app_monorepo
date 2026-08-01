import { consumeDistributedLimit } from "../configs/redis.js";
import * as messageService from "../services/messageService.js";
import * as userService from "../services/userService.js";
import { isUserId } from "../utils/validation.js";
import { emitToUser, emitToUsers, getOnlineUserIds, isUserOnline, joinUserRoom, leaveLocalUser, type MotionSocket } from "./socketRegistry.js";

export const emitPresenceToConnections = async (userId: string, eventName: "user_online" | "user_offline", payload: { userId: string }): Promise<void> => {
  const recipients = await userService.getAcceptedConnectionUserIds(userId);
  if (eventName === "user_online") emitToUsers(recipients, "user_online", payload);
  else emitToUsers(recipients, "user_offline", payload);
};

export const handleSocketConnection = async (socket: MotionSocket): Promise<void> => {
  const userId = socket.data.userId; const wasOffline = !(await isUserOnline(userId)); await joinUserRoom(socket, userId);
  const connectionIds = await userService.getAcceptedConnectionUserIds(userId); socket.data.connectionIds = connectionIds;
  socket.emit("online_users", [...await getOnlineUserIds(connectionIds)]);
  if (wasOffline) await emitPresenceToConnections(userId, "user_online", { userId });

  socket.on("send_message", async (payload) => {
    const operationId = typeof payload?.operationId === "string" ? payload.operationId : "";
    const fail = (message: string): void => { socket.emit("message_error", { message, operationId }); };
    try {
      const recipientId = payload?.to_user_id; const text = typeof payload?.text === "string" ? payload.text.trim() : "";
      if (!isUserId(recipientId) || recipientId === userId || !text || text.length > 2000 || operationId.length < 8 || operationId.length > 128) return fail("Invalid message");
      if (!(await consumeDistributedLimit(`messages:${userId}`, 30, 60))) return fail("Message rate limit reached");
      const sender = await userService.getUserById(userId); if (!sender || !(await messageService.canSendToUser(sender, recipientId))) return fail("You cannot message this user");
      const message = await messageService.createMessage({ from_user_id: userId, to_user_id: recipientId, operationId, text, message_type: "text", media_url: "", media_key: "", seen: false });
      emitToUser(recipientId, "message_received", message); emitToUser(userId, "message_sent", message);
    } catch (error: unknown) { console.error("Socket message error:", error); fail("Message could not be sent"); }
  });

  const emitTyping = async (eventName: "typing_start" | "typing_stop", payload: { to_user_id: string }): Promise<void> => {
    const recipientId = payload?.to_user_id; if (!isUserId(recipientId) || recipientId === userId) return;
    try {
      if (!(await consumeDistributedLimit(`typing:${userId}`, 60, 60))) return;
      const cache = socket.data.messagePermissionCache ?? new Map<string, { allowed: boolean; expiresAt: number }>(); socket.data.messagePermissionCache = cache;
      const cached = cache.get(recipientId); let allowed = cached && cached.expiresAt > Date.now() ? cached.allowed : null;
      if (allowed === null) { allowed = await messageService.canSendToUser(socket.data.user, recipientId); cache.set(recipientId, { allowed, expiresAt: Date.now() + 30_000 }); }
      if (allowed) emitToUser(recipientId, eventName, { from_user_id: userId });
    } catch (error: unknown) { console.error("Socket typing event error:", error instanceof Error ? error.message : error); }
  };
  socket.on("typing_start", (payload) => { void emitTyping("typing_start", payload); }); socket.on("typing_stop", (payload) => { void emitTyping("typing_stop", payload); });
  socket.on("disconnect", async () => { leaveLocalUser(socket, userId); if (!(await isUserOnline(userId))) await emitPresenceToConnections(userId, "user_offline", { userId }); });
};
