import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { io } from 'socket.io-client';
import { AppState } from 'react-native';

// Use same IP as the axios client so device can reach the server
const BASE_URL = 'http://192.168.1.146:4000';

/**
 * Mobile Socket.io hook — manages connection with Clerk auth token.
 * Disconnects on background, reconnects on foreground.
 */
export const useSocket = () => {
  const { getToken, userId } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  useEffect(() => {
    if (!userId) return;

    let socket = null;
    let appStateSub = null;

    const connect = async () => {
      // Disconnect any existing socket first
      if (socketRef.current?.connected) return;

      try {
        const token = await getToken();
        if (!token) return;

        socket = io(BASE_URL, {
          auth: { token },
          transports: ['polling', 'websocket'], // polling first for React Native compatibility
          reconnectionAttempts: 15,
          reconnectionDelay: 2000,
          timeout: 15000,
          forceNew: false,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('[Socket] Connected:', socket.id);
          setConnected(true);
        });

        socket.on('disconnect', (reason) => {
          console.log('[Socket] Disconnected:', reason);
          setConnected(false);
        });

        socket.on('connect_error', (err) => {
          // Only log once in 5 seconds to avoid spam
          console.log('[Socket] Error:', err.message);
          setConnected(false);
        });

        socket.on('user_online', ({ userId: uid }) =>
          setOnlineUsers(prev => new Set([...prev, uid]))
        );

        socket.on('user_offline', ({ userId: uid }) =>
          setOnlineUsers(prev => { const n = new Set(prev); n.delete(uid); return n; })
        );
      } catch (err) {
        console.log('[Socket] Init error:', err.message);
      }
    };

    connect();

    // Disconnect on background, reconnect on foreground
    appStateSub = AppState.addEventListener('change', async (state) => {
      if (state === 'background' || state === 'inactive') {
        socketRef.current?.disconnect();
        setConnected(false);
      } else if (state === 'active') {
        if (!socketRef.current?.connected) {
          await connect();
        }
      }
    });

    return () => {
      appStateSub?.remove();
      socket?.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [userId]);

  const sendMessage = useCallback((toUserId, text) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('send_message', { to_user_id: toUserId, text });
    } else {
      console.warn('[Socket] Cannot send — not connected');
    }
  }, []);

  const emitTypingStart = useCallback((toUserId) => {
    socketRef.current?.emit('typing_start', { to_user_id: toUserId });
  }, []);

  const emitTypingStop = useCallback((toUserId) => {
    socketRef.current?.emit('typing_stop', { to_user_id: toUserId });
  }, []);

  return { socketRef, connected, onlineUsers, sendMessage, emitTypingStart, emitTypingStop };
};
