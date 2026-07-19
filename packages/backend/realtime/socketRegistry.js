export const userSockets = new Map();

let socketServer;

export const setSocketServer = (io) => {
  socketServer = io;
};

export const emitToUser = (userId, eventName, payload) => {
  if (!socketServer) return;

  const socketIds = userSockets.get(userId);
  socketIds?.forEach((socketId) => {
    socketServer.to(socketId).emit(eventName, payload);
  });
};

