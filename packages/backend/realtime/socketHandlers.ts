import { consumeDistributedLimit } from "../configs/redis.js";
import * as messageService from "../services/messageService.js";
import * as userService from "../services/userService.js";
import { isUserId } from "../utils/validation.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";
import { emitToUser, emitToUsers, getOnlineUserIds, isUserOnline, joinUserRoom, leaveLocalUser, type MotionSocket } from "./socketRegistry.js";

export const emitPresenceToConnections = async (userId: string, eventName: "user_online" | "user_offline", payload: { userId: string }): Promise<void> => {
  const recipients = await userService.getAcceptedConnectionUserIds(userId);
  if (eventName === "user_online") emitToUsers(recipients, "user_online", payload);
  else emitToUsers(recipients, "user_offline", payload);
};

/** How long a socket may reuse the sender record it authenticated with. */
const SENDER_REFRESH_MS = 300_000;
/** How long a socket may reuse a decided "may I message this person" answer. */
const PERMISSION_CACHE_MS = 30_000;

export const handleSocketConnection = async (socket: MotionSocket): Promise<void> => {
  const userId = socket.data.userId; const wasOffline = !(await isUserOnline(userId)); await joinUserRoom(socket, userId);
  const connectionIds = await userService.getAcceptedConnectionUserIds(userId); socket.data.connectionIds = connectionIds;
  socket.emit("online_users", [...await getOnlineUserIds(connectionIds)]);
  if (wasOffline) await emitPresenceToConnections(userId, "user_online", { userId });

  /**
   * The handshake already loaded this user with their plan, and messaging
   * permission only depends on the plan's `can_message_anyone` flag plus the
   * privacy settings behind `evaluateMessagePermission`. Re-reading both on
   * every keystroke-sized event cost four queries per message in a conversation
   * where nothing about either side had changed.
   *
   * The record is refreshed on a timer rather than pinned for the life of the
   * socket, so a plan or role change reaches a long-lived connection.
   */
  let senderLoadedAt = Date.now();
  const currentSender = async (): Promise<typeof socket.data.user | null> => {
    if (Date.now() - senderLoadedAt < SENDER_REFRESH_MS) return socket.data.user;
    const refreshed = await userService.getUserById(userId);
    if (!refreshed) return null;
    socket.data.user = refreshed;
    senderLoadedAt = Date.now();
    // A plan change can flip `can_message_anyone`, so decisions taken under the
    // old record must not outlive it.
    socket.data.messagePermissionCache?.clear();
    return refreshed;
  };

  const mayMessage = async (recipientId: string): Promise<boolean> => {
    const cache = socket.data.messagePermissionCache ?? new Map<string, { allowed: boolean; expiresAt: number }>();
    socket.data.messagePermissionCache = cache;
    const cached = cache.get(recipientId);
    if (cached && cached.expiresAt > Date.now()) return cached.allowed;
    const sender = await currentSender();
    const allowed = sender ? await messageService.canSendToUser(sender, recipientId) : false;
    cache.set(recipientId, { allowed, expiresAt: Date.now() + PERMISSION_CACHE_MS });
    return allowed;
  };

  socket.on("send_message", async (payload) => {
    const operationId = typeof payload?.operationId === "string" ? payload.operationId : "";
    const fail = (message: string): void => { socket.emit("message_error", { message, operationId }); };
    try {
      const recipientId = payload?.to_user_id; const text = typeof payload?.text === "string" ? payload.text.trim() : "";
      if (!isUserId(recipientId) || recipientId === userId || !text || text.length > 2000 || operationId.length < 8 || operationId.length > 128) return fail("Invalid message");
      if (!(await consumeDistributedLimit(`messages:${userId}`, 30, 60))) return fail("Message rate limit reached");
      if (!(await mayMessage(recipientId))) return fail("You cannot message this user");
      const message = await messageService.createMessage({ from_user_id: userId, to_user_id: recipientId, operationId, text, message_type: "text", media_url: "", media_key: "", seen: false });
      emitToUser(recipientId, "message_received", message); emitToUser(userId, "message_sent", message);
    } catch (error: unknown) { logger.error("socket_message_failed", safeErrorMetadata(error)); fail("Message could not be sent"); }
  });

  const emitTyping = async (eventName: "typing_start" | "typing_stop", payload: { to_user_id: string }): Promise<void> => {
    const recipientId = payload?.to_user_id; if (!isUserId(recipientId) || recipientId === userId) return;
    try {
      if (!(await consumeDistributedLimit(`typing:${userId}`, 60, 60))) return;
      if (await mayMessage(recipientId)) emitToUser(recipientId, eventName, { from_user_id: userId });
    } catch (error: unknown) { logger.error("socket_typing_failed", safeErrorMetadata(error)); }
  };
  socket.on("typing_start", (payload) => { void emitTyping("typing_start", payload); }); socket.on("typing_stop", (payload) => { void emitTyping("typing_stop", payload); });
  socket.on("disconnect", async () => { leaveLocalUser(socket, userId); if (!(await isUserOnline(userId))) await emitPresenceToConnections(userId, "user_offline", { userId }); });
};
