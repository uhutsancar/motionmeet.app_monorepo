import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '@clerk/clerk-react';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

/**
 * useSocket — manages a Socket.io connection authenticated with Clerk token.
 * Returns: { socket, connected, onlineUsers }
 */
export const useSocket = () => {
    const { getToken, userId } = useAuth();
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(new Set());

    useEffect(() => {
        if (!userId) return;

        let socket = null;

        const connect = async () => {
            const token = await getToken();
            if (!token) return;

            socket = io(SOCKET_URL, {
                auth: { token },
                transports: ['websocket', 'polling'],
                reconnectionAttempts: 10,
                reconnectionDelay: 1500,
            });

            socketRef.current = socket;

            socket.on('connect', () => {
                console.log('[Socket] Connected:', socket.id);
                setConnected(true);
            });

            socket.on('disconnect', () => {
                console.log('[Socket] Disconnected');
                setConnected(false);
            });

            socket.on('user_online', ({ userId: uid }) => {
                setOnlineUsers(prev => new Set([...prev, uid]));
            });

            socket.on('user_offline', ({ userId: uid }) => {
                setOnlineUsers(prev => {
                    const next = new Set(prev);
                    next.delete(uid);
                    return next;
                });
            });
        };

        connect();

        return () => {
            socket?.disconnect();
            socketRef.current = null;
            setConnected(false);
        };
    }, [userId]);

    const sendMessage = useCallback((toUserId, text) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('send_message', { to_user_id: toUserId, text });
        }
    }, []);

    const sendTypingStart = useCallback((toUserId) => {
        socketRef.current?.emit('typing_start', { to_user_id: toUserId });
    }, []);

    const sendTypingStop = useCallback((toUserId) => {
        socketRef.current?.emit('typing_stop', { to_user_id: toUserId });
    }, []);

    return {
        socket: socketRef.current,
        socketRef,
        connected,
        onlineUsers,
        sendMessage,
        sendTypingStart,
        sendTypingStop,
    };
};
