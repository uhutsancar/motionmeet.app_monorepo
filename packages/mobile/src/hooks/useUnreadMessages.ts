import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../context/AuthProvider';
import { getUserConversations } from '../api/endpoints';
import { useSocket } from './useSocket';
import type { Message } from '@motionmeet/shared';

/**
 * How many conversations are waiting, for the message icon in the feed header.
 *
 * One request seeds the count when the screen mounts; everything after that
 * arrives over the socket, so the badge stays live without polling.
 */
export const useUnreadMessages = () => {
  const { getToken } = useAuthContext();
  const { socket } = useSocket();
  const [unreadMessages, setUnreadMessages] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getUserConversations(token);
      if (!data.success) return;
      setUnreadMessages(
        (data.conversations || []).reduce(
          (total, conversation) => total + Number(conversation.unreadCount || 0),
          0,
        ),
      );
    } catch {
      // The badge is decoration: the header still works without a count.
    }
  }, [getToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (_message: Message) => setUnreadMessages((current) => current + 1);
    socket.on('message_received', onMessage);
    return () => {
      socket.off('message_received', onMessage);
    };
  }, [socket]);

  const clear = useCallback(() => setUnreadMessages(0), []);

  return { unreadMessages, refresh, clear };
};
