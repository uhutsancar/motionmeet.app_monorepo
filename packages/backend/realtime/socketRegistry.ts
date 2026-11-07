import type { ClientToServerEvents, ServerToClientEvents } from "@motionmeet/shared";
import type { Server, Socket } from "socket.io";
import type { InternalUser } from "../repositories/entities.js";
import { PRESENCE_HEARTBEAT_MS, presenceAdd, presenceOnline, presenceRefresh, presenceRemove } from "../configs/redis.js";
import { observeOpenSockets } from "../observability/metrics.js";

/**
 * What a socket carries in `socket.data`: its identity and nothing more.
 *
 * With the Redis adapter, `fetchSockets()` - which every presence lookup uses
 * - serialises `socket.data` on every replica and sends it over pub/sub. It
 * used to hold the member's full record, email included, plus per-socket
 * caches, so each "who is online" question shipped all of that between
 * replicas (NEW-14 in the 2026-11 audit). The rest now lives in
 * `LocalSocketState`, in the process that owns the socket.
 */
export interface SocketData {
  userId: string;
  /** The login session the socket authenticated under; revoking it disconnects the socket. */
  sessionId: string;
  role: InternalUser["role"];
}

/** Per-socket state that never leaves this process. */
export interface LocalSocketState {
  /** The sender's record, refreshed on a timer by the socket handlers. */
  user: InternalUser;
  messagePermissionCache: Map<string, { allowed: boolean; expiresAt: number }>;
  /** Accepted connections when the socket opened; told when the member goes offline. */
  connectionIds: string[];
}
const localSockets = new Map<string, LocalSocketState>();
observeOpenSockets(() => localSockets.size);

/** Called once the handshake has authenticated the socket. */
export const bindSocketIdentity = (socket: MotionSocket, identity: { userId: string; sessionId: string }, user: InternalUser): void => {
  socket.data.userId = identity.userId;
  socket.data.sessionId = identity.sessionId;
  socket.data.role = user.role;
  localSockets.set(socket.id, { user, messagePermissionCache: new Map(), connectionIds: [] });
};

export const localSocketState = (socket: MotionSocket): LocalSocketState | undefined => localSockets.get(socket.id);
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
const roomForSession = (sessionId: string): string => `session:${sessionId}`;

/**
 * Closes every socket of one login session, or of one member, on every
 * instance - the adapter relays the room operation - so a logout, a password
 * reset or an account deletion takes the live connection with it instead of
 * leaving it subscribed to the member's messages.
 */
export const disconnectSessionSockets = (sessionId: string): void => { socketServer?.in(roomForSession(sessionId)).disconnectSockets(true); };
export const disconnectUserSockets = (userId: string): void => { socketServer?.in(roomForUser(userId)).disconnectSockets(true); };
export const setSocketServer = (io: MotionServer): void => {
  socketServer = io;
  io.on("invalidate_message_permissions", dropLocalMessagePermissions);
};

const dropLocalMessagePermissions = (recipientId: string, senderIds: string[] | null): void => {
  if (!socketServer) return;
  const senders = senderIds ? new Set(senderIds) : null;
  for (const socket of socketServer.sockets.sockets.values()) {
    if (!senders || senders.has(socket.data.userId)) localSockets.get(socket.id)?.messagePermissionCache.delete(recipientId);
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
export const joinUserRoom = async (socket: MotionSocket, userId: string): Promise<void> => { await socket.join([roomForUser(userId), roomForSession(socket.data.sessionId)]); const sockets = userSockets.get(userId) ?? new Set<string>(); sockets.add(socket.id); userSockets.set(userId, sockets); };
export const leaveLocalUser = (socket: MotionSocket, userId: string): void => { localSockets.delete(socket.id); const sockets = userSockets.get(userId); sockets?.delete(socket.id); if (!sockets?.size) userSockets.delete(userId); };
/** Sockets a member may hold open on one replica; a reconnect loop or a script opening more is refused. */
export const MAX_SOCKETS_PER_MEMBER = 10;
export const localSocketCount = (userId: string): number => userSockets.get(userId)?.size ?? 0;

/**
 * Presence lives in Redis (configs/redis.ts): one round trip per connect and
 * disconnect, instead of `fetchSockets()` asking every replica and waiting for
 * the slowest. Without Redis this process is all there is, so its own map
 * answers.
 */

/** Records the socket; true when it is the member's first anywhere (call after `joinUserRoom`). */
export const markSocketOnline = async (socket: MotionSocket, userId: string): Promise<boolean> => {
  const others = await presenceAdd(userId, socket.id);
  return others === null ? localSocketCount(userId) <= 1 : others === 0;
};

/** Forgets the socket; true when the member has none left anywhere (call after `leaveLocalUser`). */
export const markSocketOffline = async (socket: MotionSocket, userId: string): Promise<boolean> => {
  const remaining = await presenceRemove(userId, socket.id);
  return remaining === null ? localSocketCount(userId) === 0 : remaining === 0;
};

export const getOnlineUserIds = async (userIds: string[]): Promise<Set<string>> => {
  if (!userIds.length) return new Set();
  return await presenceOnline(userIds) ?? new Set(userIds.filter((id) => userSockets.has(id)));
};

/**
 * Keeps this replica's sockets counted. Unreferenced: it never holds a
 * stopping process open, and a replica that dies simply stops refreshing.
 */
export const startPresenceHeartbeat = (): (() => void) => {
  const timer = setInterval(() => {
    const entries = [...userSockets].flatMap(([userId, sockets]) => [...sockets].map((socketId) => ({ userId, socketId })));
    if (entries.length) void presenceRefresh(entries);
  }, PRESENCE_HEARTBEAT_MS);
  timer.unref();
  return () => clearInterval(timer);
};
export const emitToUser = <E extends keyof ServerToClientEvents>(userId: string, eventName: E, ...args: Parameters<ServerToClientEvents[E]>): void => { socketServer?.to(roomForUser(userId)).emit(eventName, ...args); };
export const emitToUsers = <E extends keyof ServerToClientEvents>(userIds: string[], eventName: E, ...args: Parameters<ServerToClientEvents[E]>): void => { const rooms = [...new Set(userIds)].map(roomForUser); if (rooms.length) socketServer?.to(rooms).emit(eventName, ...args); };
