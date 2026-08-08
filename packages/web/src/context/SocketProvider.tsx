import { useAuthContext } from "../context/AuthProvider";
import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { io } from "socket.io-client";
import { SocketContext, type MotionMeetSocket, type SocketContextValue } from "./socketContext";
import { SOCKET_URL } from "~/config/env";
import { createOperationId, type ServerToClientEvents } from "@motionmeet/shared";
import { store } from "~/app/store";
import { followRequestResolved, notificationReceived } from "~/features/notifications/notificationsSlice";
import { setRelationship } from "~/features/relationships/relationshipsSlice";

export const SocketProvider = ({ children }: PropsWithChildren) => {
  const { getToken, userId } = useAuthContext();
  const socketRef = useRef<MotionMeetSocket | null>(null);
  const [socket, setSocket] = useState<MotionMeetSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!userId || !SOCKET_URL) return undefined;

    let active = true;
    const connection = io(SOCKET_URL, {
        auth: async (callback) => {
          try {
            const token = await getToken();
            callback({ token: active ? token : "" });
          } catch {
            callback({ token: "" });
          }
        },
        transports: ["websocket", "polling"],
        reconnectionAttempts: 10,
        reconnectionDelay: 1500,
      }) as MotionMeetSocket;

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

    // Activity and follow state are dispatched straight to the store rather
    // than held in context: the bell badge, the activity list and every follow
    // button read the same slices, so one event updates all of them at once.
    connection.on("notification_received", (payload: Parameters<ServerToClientEvents["notification_received"]>[0]) => {
      if (payload?.notification) store.dispatch(notificationReceived(payload));
    });
    connection.on("relationship_changed", (payload: Parameters<ServerToClientEvents["relationship_changed"]>[0]) => {
      if (!payload?.userId) return;
      store.dispatch(setRelationship({
        userId: payload.userId,
        relationship: {
          isFollowing: payload.isFollowing,
          isFollowedBy: payload.isFollowedBy,
          requestSent: payload.requestSent,
          requestReceived: payload.requestReceived,
        },
      }));
      if (!payload.requestReceived) store.dispatch(followRequestResolved({ userId: payload.userId }));
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

  const sendMessage = useCallback((toUserId: string, text: string, operationId?: string | null) => {
    if (!socketRef.current?.connected) return false;
    socketRef.current.emit("send_message", {
      to_user_id: toUserId,
      text,
      operationId: operationId || createOperationId("message"),
    });
    return true;
  }, []);

  const sendTypingStart = useCallback((toUserId: string) => {
    socketRef.current?.emit("typing_start", { to_user_id: toUserId });
  }, []);

  const sendTypingStop = useCallback((toUserId: string) => {
    socketRef.current?.emit("typing_stop", { to_user_id: toUserId });
  }, []);

  const value = useMemo<SocketContextValue>(() => ({
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
