import type { ClientToServerEvents, ServerToClientEvents } from "@motionmeet/shared";
import type { Server, Socket } from "socket.io";
import type { InternalUser } from "../repositories/entities.js";

export interface SocketData {
  userId: string;
  user: InternalUser;
  connectionIds?: string[];
  messagePermissionCache?: Map<string, { allowed: boolean; expiresAt: number }>;
}
/** Events the API instances send each other through the adapter. */
export interface InterServerEvents {
  /** Forget cached "may this sender message `recipientId`" answers; `senderIds` null means every sender. */
  invalidate_message_permissions: (recipientId: string, senderIds: string[] | null) => void;
}
export type MotionServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type MotionSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export const userSockets = new Map<string, Set<string>>();
let socketServer: MotionServer | null = null;
const roomForUser = (userId: string): string => `user:${userId}`;
export const setSocketServer = (io: MotionServer): void => {
  socketServer = io;
  io.on("invalidate_message_permissions", dropLocalMessagePermissions);
};

const dropLocalMessagePermissions = (recipientId: string, senderIds: string[] | null): void => {
  if (!socketServer) return;
  const senders = senderIds ? new Set(senderIds) : null;
  for (const socket of socketServer.sockets.sockets.values()) {
    if (!senders || senders.has(socket.data.userId)) socket.data.messagePermissionCache?.delete(recipientId);
  }
};

/**
 * Drops cached messaging decisions about `recipientId`, on every instance.
 *
 * A socket caches "may I message this member" for a short while; a follow
 * removed or a privacy setting tightened has to take effect at once rather
 * than after that window. The adapter only relays to *other* instances, so
 * this one is cleared directly; a single instance on the in-memory adapter has
 * no relay at all, which is not an error.
 */
export const invalidateMessagePermissions = (recipientId: string, senderIds: string[] | null = null): void => {
  dropLocalMessagePermissions(recipientId, senderIds);
  try {
    socketServer?.serverSideEmit("invalidate_message_permissions", recipientId, senderIds);
  } catch {
    // In-memory adapter: there are no other instances to tell.
  }
};
export const joinUserRoom = async (socket: MotionSocket, userId: string): Promise<void> => { await socket.join(roomForUser(userId)); const sockets = userSockets.get(userId) ?? new Set<string>(); sockets.add(socket.id); userSockets.set(userId, sockets); };
export const leaveLocalUser = (socket: MotionSocket, userId: string): void => { const sockets = userSockets.get(userId); sockets?.delete(socket.id); if (!sockets?.size) userSockets.delete(userId); };
export const isUserOnline = async (userId: string): Promise<boolean> => Boolean(socketServer && (await socketServer.in(roomForUser(userId)).fetchSockets()).length);
export const getOnlineUserIds = async (userIds: string[]): Promise<Set<string>> => {
  if (!socketServer || !userIds.length) return new Set(); const requested = new Set(userIds);
  const sockets = await socketServer.in(userIds.map(roomForUser)).fetchSockets(); return new Set(sockets.map((socket) => socket.data.userId).filter((id) => requested.has(id)));
};
export const emitToUser = <E extends keyof ServerToClientEvents>(userId: string, eventName: E, ...args: Parameters<ServerToClientEvents[E]>): void => { socketServer?.to(roomForUser(userId)).emit(eventName, ...args); };
export const emitToUsers = <E extends keyof ServerToClientEvents>(userIds: string[], eventName: E, ...args: Parameters<ServerToClientEvents[E]>): void => { const rooms = [...new Set(userIds)].map(roomForUser); if (rooms.length) socketServer?.to(rooms).emit(eventName, ...args); };
