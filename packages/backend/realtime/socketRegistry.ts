import type { ClientToServerEvents, ServerToClientEvents } from "@motionmeet/shared";
import type { Server, Socket } from "socket.io";
import type { InternalUser } from "../repositories/entities.js";

export interface SocketData {
  userId: string;
  user: InternalUser;
  connectionIds?: string[];
  messagePermissionCache?: Map<string, { allowed: boolean; expiresAt: number }>;
}
export type MotionServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type MotionSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export const userSockets = new Map<string, Set<string>>();
let socketServer: MotionServer | null = null;
const roomForUser = (userId: string): string => `user:${userId}`;
export const setSocketServer = (io: MotionServer): void => { socketServer = io; };
export const joinUserRoom = async (socket: MotionSocket, userId: string): Promise<void> => { await socket.join(roomForUser(userId)); const sockets = userSockets.get(userId) ?? new Set<string>(); sockets.add(socket.id); userSockets.set(userId, sockets); };
export const leaveLocalUser = (socket: MotionSocket, userId: string): void => { const sockets = userSockets.get(userId); sockets?.delete(socket.id); if (!sockets?.size) userSockets.delete(userId); };
export const isUserOnline = async (userId: string): Promise<boolean> => Boolean(socketServer && (await socketServer.in(roomForUser(userId)).fetchSockets()).length);
export const getOnlineUserIds = async (userIds: string[]): Promise<Set<string>> => {
  if (!socketServer || !userIds.length) return new Set(); const requested = new Set(userIds);
  const sockets = await socketServer.in(userIds.map(roomForUser)).fetchSockets(); return new Set(sockets.map((socket) => socket.data.userId).filter((id) => requested.has(id)));
};
export const emitToUser = <E extends keyof ServerToClientEvents>(userId: string, eventName: E, ...args: Parameters<ServerToClientEvents[E]>): void => { socketServer?.to(roomForUser(userId)).emit(eventName, ...args); };
export const emitToUsers = <E extends keyof ServerToClientEvents>(userIds: string[], eventName: E, ...args: Parameters<ServerToClientEvents[E]>): void => { const rooms = [...new Set(userIds)].map(roomForUser); if (rooms.length) socketServer?.to(rooms).emit(eventName, ...args); };
