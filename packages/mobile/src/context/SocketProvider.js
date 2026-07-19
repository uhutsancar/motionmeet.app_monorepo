import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { useAuthContext } from "../context/AuthProvider";
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/environment';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { getToken, isLoaded, isSignedIn, userId } = useAuthContext();
  const getTokenRef = useRef(getToken);
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());

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
          console.warn('[Socket] Clerk token could not be refreshed:', error.message);
          callback({ token: '' });
        }
      },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
      timeout: 15000,
    });

    socketRef.current = client;
    setSocket(client);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = (error) => {
      setConnected(false);
      console.warn('[Socket] Connection failed:', error.message);
    };
    const onOnlineUsers = (userIds) => {
      setOnlineUsers(new Set(Array.isArray(userIds) ? userIds : []));
    };
    const onUserOnline = ({ userId: onlineUserId } = {}) => {
      if (!onlineUserId) return;
      setOnlineUsers((previous) => new Set([...previous, onlineUserId]));
    };
    const onUserOffline = ({ userId: offlineUserId } = {}) => {
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

  const sendMessage = useCallback((toUserId, text) => {
    const normalizedText = typeof text === 'string' ? text.trim() : '';
    if (!socketRef.current?.connected || !toUserId || !normalizedText) return false;
    socketRef.current.emit('send_message', { to_user_id: toUserId, text: normalizedText });
    return true;
  }, []);

  const emitTypingStart = useCallback((toUserId) => {
    if (socketRef.current?.connected && toUserId) {
      socketRef.current.emit('typing_start', { to_user_id: toUserId });
    }
  }, []);

  const emitTypingStop = useCallback((toUserId) => {
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
