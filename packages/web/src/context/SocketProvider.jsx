import { useAuthContext } from "../context/AuthProvider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SocketContext } from "./socketContext";
import { SOCKET_URL } from "~/config/env";
import { createOperationId } from "@motionmeet/shared";

export const SocketProvider = ({ children }) => {
  const { getToken, userId } = useAuthContext();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());

  useEffect(() => {
    if (!userId || !SOCKET_URL) return undefined;

    let active = true;
    const connection = io(SOCKET_URL, {
        auth: async (callback) => {
          try {
            const token = await getToken();
            callback({ token: active ? token : null });
          } catch {
            callback({ token: null });
          }
        },
        transports: ["websocket", "polling"],
        reconnectionAttempts: 10,
        reconnectionDelay: 1500,
      });

    socketRef.current = connection;
    setSocket(connection);

    connection.on("connect", () => setConnected(true));
    connection.on("disconnect", () => setConnected(false));
    connection.on("connect_error", () => setConnected(false));
    connection.on("online_users", (ids = []) => setOnlineUsers(new Set(ids)));
    connection.on("user_online", ({ userId: onlineUserId }) => {
      setOnlineUsers((previous) => new Set([...previous, onlineUserId]));
    });
    connection.on("user_offline", ({ userId: offlineUserId }) => {
      setOnlineUsers((previous) => {
        const next = new Set(previous);
        next.delete(offlineUserId);
        return next;
      });
    });

    return () => {
      active = false;
      connection?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      setOnlineUsers(new Set());
    };
  }, [getToken, userId]);

  const sendMessage = useCallback((toUserId, text, operationId) => {
    if (!socketRef.current?.connected) return false;
    socketRef.current.emit("send_message", {
      to_user_id: toUserId,
      text,
      operationId: operationId || createOperationId("message"),
    });
    return true;
  }, []);

  const sendTypingStart = useCallback((toUserId) => {
    socketRef.current?.emit("typing_start", { to_user_id: toUserId });
  }, []);

  const sendTypingStop = useCallback((toUserId) => {
    socketRef.current?.emit("typing_stop", { to_user_id: toUserId });
  }, []);

  const value = useMemo(() => ({
    socket,
    socketRef,
    connected,
    onlineUsers,
    sendMessage,
    sendTypingStart,
    sendTypingStop,
  }), [connected, onlineUsers, sendMessage, sendTypingStart, sendTypingStop, socket]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
