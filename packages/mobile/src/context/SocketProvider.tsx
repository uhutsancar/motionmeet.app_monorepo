import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import { useAuthContext } from "../context/AuthProvider";
import { io, type Socket } from 'socket.io-client';
import { createOperationId, type ClientToServerEvents, type ServerToClientEvents } from '@motionmeet/shared';
import { SOCKET_URL } from '../config/environment';
import { logHandledError } from '../utils/feedback';
import { store } from '../store/store';
import { followRequestResolved, notificationReceived } from '../features/notifications/notificationsSlice';
import { setRelationship } from '../features/relationships/relationshipsSlice';

type MotionSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
interface SocketContextValue {
  socket: MotionSocket | null;
  socketRef: MutableRefObject<MotionSocket | null>;
  connected: boolean;
  onlineUsers: Set<string>;
  sendMessage: (toUserId: string, text: string, operationId?: string) => boolean;
  emitTypingStart: (toUserId: string) => void;
  emitTypingStop: (toUserId: string) => void;
}

export const SocketContext = createContext<SocketContextValue | null>(null);

export const SocketProvider = ({ children }: PropsWithChildren) => {
  const { getToken, isLoaded, isSignedIn } = useAuthContext();
  const getTokenRef = useRef(getToken);
  const socketRef = useRef<MotionSocket | null>(null);
  const [socket, setSocket] = useState<MotionSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return undefined;

    const client = io(SOCKET_URL, {
      autoConnect: false,
      auth: async (callback) => {
        try {
          const token = await getTokenRef.current({ skipCache: true });
          callback({ token: token || '' });
        } catch (error) {
          logHandledError('refresh-socket-token', error);
          callback({ token: '' });
        }
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
      timeout: 15000,
    }) as MotionSocket;

    socketRef.current = client;
    setSocket(client);

    /*
     * A failed connection is reported once per outage, not once per retry.
     *
     * socket.io retries fifteen times, so a backend that is simply not running
     * printed fifteen identical "timeout" lines and buried everything else in
     * the log. The first failure is the informative one; the rest say the same
     * thing. A successful connect re-arms the report, so the next real outage
     * is still visible.
     */
    let outageReported = false;

    const onConnect = () => {
      outageReported = false;
      setConnected(true);
    };
    const onDisconnect = () => setConnected(false);
    const onConnectError = (error: Error) => {
      setConnected(false);
      if (outageReported) return;
      outageReported = true;
      logHandledError('connect-socket', error);
    };
    const onOnlineUsers = (userIds: string[]) => {
      setOnlineUsers(new Set(Array.isArray(userIds) ? userIds : []));
    };
    const onUserOnline = ({ userId: onlineUserId }: { userId: string }) => {
      if (!onlineUserId) return;
      setOnlineUsers((previous) => new Set([...previous, onlineUserId]));
    };
    const onUserOffline = ({ userId: offlineUserId }: { userId: string }) => {
      if (!offlineUserId) return;
      setOnlineUsers((previous) => {
        const next = new Set(previous);
        next.delete(offlineUserId);
        return next;
      });
    };

    // Activity and follow state are dispatched straight to the store rather
    // than held in context: the bell badge, the activity list and every follow
    // button read the same slices, so one event updates all of them at once.
    const onNotification = (payload: Parameters<ServerToClientEvents['notification_received']>[0]) => {
      if (payload?.notification) store.dispatch(notificationReceived(payload));
    };
    const onRelationshipChanged = (payload: Parameters<ServerToClientEvents['relationship_changed']>[0]) => {
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
    };

    client.on('connect', onConnect);
    client.on('disconnect', onDisconnect);
    client.on('connect_error', onConnectError);
    client.on('online_users', onOnlineUsers);
    client.on('user_online', onUserOnline);
    client.on('user_offline', onUserOffline);
    client.on('notification_received', onNotification);
    client.on('relationship_changed', onRelationshipChanged);
    client.connect();

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (!client.connected) client.connect();
      } else {
        client.disconnect();
        setConnected(false);
      }
    });

    return () => {
      appStateSubscription.remove();
      client.removeAllListeners();
      client.disconnect();
      if (socketRef.current === client) socketRef.current = null;
      setSocket((current) => current === client ? null : current);
      setConnected(false);
      setOnlineUsers(new Set());
    };
  }, [isLoaded, isSignedIn]);

  const sendMessage = useCallback((toUserId: string, text: string, operationId?: string) => {
    const normalizedText = typeof text === 'string' ? text.trim() : '';
    if (!socketRef.current?.connected || !toUserId || !normalizedText) return false;
    socketRef.current.emit('send_message', {
      to_user_id: toUserId,
      text: normalizedText,
      operationId: operationId || createOperationId('message'),
    });
    return true;
  }, []);

  const emitTypingStart = useCallback((toUserId: string) => {
    if (socketRef.current?.connected && toUserId) {
      socketRef.current.emit('typing_start', { to_user_id: toUserId });
    }
  }, []);

  const emitTypingStop = useCallback((toUserId: string) => {
    if (socketRef.current?.connected && toUserId) {
      socketRef.current.emit('typing_stop', { to_user_id: toUserId });
    }
  }, []);

  const value = useMemo(() => ({
    socket,
    socketRef,
    connected,
    onlineUsers,
    sendMessage,
    emitTypingStart,
    emitTypingStop,
  }), [socket, connected, onlineUsers, sendMessage, emitTypingStart, emitTypingStop]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
