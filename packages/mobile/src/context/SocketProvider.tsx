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
  const { getToken, isLoaded, isSignedIn, userId } = useAuthContext();
  const getTokenRef = useRef(getToken);
  const socketRef = useRef<MotionSocket | null>(null);
  const [socket, setSocket] = useState<MotionSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return undefined;

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
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
      timeout: 15000,
    }) as MotionSocket;

    socketRef.current = client;
    setSocket(client);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = (error: Error) => {
      setConnected(false);
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

    client.on('connect', onConnect);
    client.on('disconnect', onDisconnect);
    client.on('connect_error', onConnectError);
    client.on('online_users', onOnlineUsers);
    client.on('user_online', onUserOnline);
    client.on('user_offline', onUserOffline);
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
  }, [isLoaded, isSignedIn, userId]);

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
