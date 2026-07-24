// Kept as a local diagnostic view; cross-instance delivery uses Socket.IO rooms.
export const userSockets = new Map();

let socketServer;

const roomForUser = (userId) => `user:${userId}`;

export const setSocketServer = (io) => {
  socketServer = io;
};

export const joinUserRoom = async (socket, userId) => {
  await socket.join(roomForUser(userId));
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socket.id);
};

export const leaveLocalUser = (socket, userId) => {
  userSockets.get(userId)?.delete(socket.id);
  if (!userSockets.get(userId)?.size) userSockets.delete(userId);
};

export const isUserOnline = async (userId) => {
  if (!socketServer) return false;
  const sockets = await socketServer.in(roomForUser(userId)).fetchSockets();
  return sockets.length > 0;
};

export const getOnlineUserIds = async (userIds) => {
  if (!socketServer || !userIds.length) return new Set();
  const requestedIds = new Set(userIds.map(String));
  const sockets = await socketServer
    .in([...requestedIds].map(roomForUser))
    .fetchSockets();
  return new Set(
    sockets
      .map((socket) => socket.data.userId)
      .filter((userId) => requestedIds.has(userId))
  );
};

export const emitToUser = (userId, eventName, payload) => {
  socketServer?.to(roomForUser(userId)).emit(eventName, payload);
};

export const emitToUsers = (userIds, eventName, payload) => {
  const rooms = [...new Set(userIds.map(String))].map(roomForUser);
  if (rooms.length) socketServer?.to(rooms).emit(eventName, payload);
};
