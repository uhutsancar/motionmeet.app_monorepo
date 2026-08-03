import React, { useCallback, useEffect, useState, useRef } from 'react';
import { FlatList, StatusBar, RefreshControl, StyleSheet, type ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContext } from "../context/AuthProvider";
import { useTranslation } from 'react-i18next';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import { useSocket } from '../hooks/useSocket';
import { setConnections } from '../features/connections/connectionsSlice';
import { getUserConnections, getUserConversations } from '../api/endpoints';
import dayjs, { setDayjsLocale } from '../utils/dayjs';

import { Appbar, Avatar, Text, Searchbar, TouchableRipple, Badge, Surface } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { logHandledError } from '../utils/feedback';
import { useFocusEffect } from '@react-navigation/native';
import type { Message, PublicUser } from '@motionmeet/shared';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { NavigationOnlyProps } from '../navigation/types';

interface ConversationItem {
  user: PublicUser;
  lastMessage: Message | null;
  unread: number;
  isNew?: boolean;
}

const entityId = (entity: PublicUser | string): string =>
  typeof entity === 'string' ? entity : entity._id;

const Messages = ({ navigation }: NavigationOnlyProps) => {
  const dispatch = useAppDispatch();
  const { getToken } = useAuthContext();
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const s = React.useMemo(() => getStyles(theme), [theme]);

  const { connections } = useAppSelector((state) => state.connections);
  const { socket, onlineUsers } = useSocket();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [connectionCursor, setConnectionCursor] = useState<string | null>(null);
  const [loadingMoreConnections, setLoadingMoreConnections] = useState(false);
  const connectionsRef = useRef(connections);

  useEffect(() => {
    setDayjsLocale(i18n.language);
  }, [i18n.language]);


  useEffect(() => { connectionsRef.current = connections; }, [connections]);

  useEffect(() => {
    if (!socket) return;

    const onMsg = (msg: Message) => {
      const senderId = entityId(msg.from_user_id);
      setConversations(prev => {
        const exists = prev.findIndex(c => c.user?._id === senderId);
        if (exists >= 0) {
          const updated = [...prev];
          updated[exists] = {
            ...updated[exists],
            lastMessage: msg,
            unread: (updated[exists].unread || 0) + 1,
            isNew: false
          };
          return [updated[exists], ...updated.filter((_, i) => i !== exists)];
        }
        if (typeof msg.from_user_id === 'string') return prev;
        return [{
          user: msg.from_user_id,
          lastMessage: msg,
          unread: 1,
          isNew: false
        }, ...prev];
      });
    };

    const onSent = (msg: Message) => {
      const recipientId = entityId(msg.to_user_id);
      setConversations(prev => {
        const exists = prev.findIndex(c => c.user?._id === recipientId);
        if (exists >= 0) {
          const updated = [...prev];
          updated[exists] = {
            ...updated[exists],
            lastMessage: msg,
            isNew: false
          };
          return [updated[exists], ...updated.filter((_, i) => i !== exists)];
        }
        const recipient = typeof msg.to_user_id === 'object'
          ? msg.to_user_id
          : connectionsRef.current.find((item) => item._id === recipientId);
        if (!recipient) return prev;
        return [{
          user: recipient,
          lastMessage: msg,
          unread: 0,
          isNew: false
        }, ...prev];
      });
    };

    socket.on('message_received', onMsg);
    socket.on('message_sent', onSent);
    const onSeen = ({ by_user_id: byUserId }: { by_user_id: string }) => {
      if (!byUserId) return;
      setConversations((current) => current.map((conversation) => (
        conversation.user?._id === byUserId
          ? { ...conversation, unread: 0 }
          : conversation
      )));
    };
    socket.on('messages_seen', onSeen);
    return () => {
      socket.off('message_received', onMsg);
      socket.off('message_sent', onSent);
      socket.off('messages_seen', onSeen);
    };
  }, [socket]);

  const loadConversations = useCallback(async (token: string, cursor: string | null = null) => {
    try {
      if (cursor) setLoadingMore(true);
      const data = await getUserConversations(token, cursor);
      if (data.success) {
        const convs = (data.conversations || []).map((conversation) => ({
          user: conversation.partner,
          lastMessage: conversation.lastMessage,
          unread: conversation.unreadCount || 0,
        }));
        setConversations((current) => {
          if (!cursor) return convs;
          const knownIds = new Set(current.map((conversation) => conversation.user?._id));
          return [
            ...current,
            ...convs.filter((conversation) => !knownIds.has(conversation.user?._id)),
          ];
        });
        setNextCursor(data.nextCursor || null);
      }
    } catch (error) {
      logHandledError('load-conversation-request', error);
    } finally {
      if (cursor) setLoadingMore(false);
    }
  }, []);

  const loadConnectionPage = useCallback(async (token: string, cursor: string | null = null) => {
    try {
      if (cursor) setLoadingMoreConnections(true);
      const data = await getUserConnections(token, 'connections', cursor);
      if (!data.success) return;
      const previous = cursor ? connectionsRef.current : [];
      const knownIds = new Set(previous.map((connection) => connection._id));
      const nextConnections = [
        ...previous,
        ...(data.items || []).filter((connection) => !knownIds.has(connection._id)),
      ];
      connectionsRef.current = nextConnections;
      dispatch(setConnections(nextConnections));
      setConnectionCursor(data.nextCursor || null);
    } catch (error) {
      logHandledError('load-message-connections', error);
    } finally {
      if (cursor) setLoadingMoreConnections(false);
    }
  }, [dispatch]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      await Promise.all([
        connectionsRef.current.length === 0
          ? loadConnectionPage(token)
          : Promise.resolve(),
        loadConversations(token),
      ]);
    } catch (error) {
      logHandledError('load-conversations', error);
    } finally {
      setLoading(false);
    }
  }, [getToken, loadConnectionPage, loadConversations]);

  useFocusEffect(useCallback(() => {
    void loadAll();
    return undefined;
  }, [loadAll]));

  const loadMoreConversations = useCallback(async () => {
    if (!nextCursor || loading || loadingMore) return;
    try {
      const token = await getToken();
      if (token) await loadConversations(token, nextCursor);
    } catch (error) {
      logHandledError('load-more-conversations', error);
    }
  }, [getToken, loadConversations, loading, loadingMore, nextCursor]);

  const loadMoreConnections = useCallback(async () => {
    if (!connectionCursor || loadingMoreConnections) return;
    try {
      const token = await getToken();
      if (token) await loadConnectionPage(token, connectionCursor);
    } catch (error) {
      logHandledError('load-more-message-connections', error);
    }
  }, [connectionCursor, getToken, loadConnectionPage, loadingMoreConnections]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpen = (conv: ConversationItem) => {
    setConversations(prev => prev.map(c => c.user?._id === conv.user?._id ? { ...c, unread: 0 } : c));
    navigation.navigate('ChatBox', { userId: conv.user?._id, user: conv.user });
  };

  const handleNewChat = () => {
    navigation.navigate('Connections');
  };

  const displayedConvs = React.useMemo(() => {
    if (!searchQuery) return conversations;
    
    const lowerQ = searchQuery.toLowerCase();
    const filtered = conversations.filter(c =>
      c.user?.full_name?.toLowerCase().includes(lowerQ) ||
      c.user?.username?.toLowerCase().includes(lowerQ)
    );

    const convUserIds = new Set(conversations.map(c => c.user?._id));
    const matchingConnections = connections.filter(conn => 
      !convUserIds.has(conn._id) && 
      (conn.full_name?.toLowerCase().includes(lowerQ) || conn.username?.toLowerCase().includes(lowerQ))
    );
    
    const connConvs = matchingConnections.map(conn => ({
      user: conn,
      lastMessage: null,
      unread: 0,
      isNew: true
    }));

    return [...filtered, ...connConvs];
  }, [conversations, connections, searchQuery]);

  const renderConversation: ListRenderItem<ConversationItem> = ({ item: conv }) => {
    const isOnline = onlineUsers.has(conv.user?._id);
    const hasUnread = (conv.unread || 0) > 0;
    const msgText = conv.lastMessage?.text || (conv.lastMessage?.message_type === 'image' ? '📷 Fotoğraf' : '');
    const timeLabel = conv.lastMessage?.createdAt ? dayjs(conv.lastMessage.createdAt).fromNow() : '';

    return (
      <TouchableRipple style={s.convRow} onPress={() => handleOpen(conv)}>
        <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Surface elevation={0} style={s.avatarContainer}>
            {conv.user?.profile_picture
              ? <Avatar.Image source={{ uri: conv.user.profile_picture }} size={52} />
              : <Avatar.Text label={conv.user?.full_name?.charAt(0)?.toUpperCase() || '?'} size={52} style={{ backgroundColor: theme.primary }} />
            }
            {isOnline && <Badge size={13} style={s.onlineDot} />}
          </Surface>

          <Surface elevation={0} style={s.convContent}>
            <Surface elevation={0} style={s.convTop}>
              <Text variant="titleMedium" style={[s.convName, hasUnread && { color: theme.text, fontWeight: '700' }]} numberOfLines={1}>
                {conv.user?.full_name || conv.user?.username}
              </Text>
              <Text
                variant="labelSmall"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={s.convTime}
              >
                {timeLabel}
              </Text>
            </Surface>
            <Text variant="bodyMedium" style={[s.convPreview, hasUnread && { color: theme.text, fontWeight: '500' }]} numberOfLines={1}>
              {conv.isNew ? t('messages.start_new_chat', 'Start a new chat') : (msgText || t('messages.no_message', 'No message yet'))}
            </Text>
          </Surface>

          {hasUnread && (
            <Surface elevation={0} style={s.unreadBadge}>
              <Badge size={10} style={{ backgroundColor: theme.primary }} />
            </Surface>
          )}
        </Surface>
      </TouchableRipple>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Appbar.Header style={s.header} statusBarHeight={0}>
        <Appbar.Content title={t('messages.title', 'Messages')} titleStyle={s.headerTitle} />
        <Appbar.Action icon="square-edit-outline" onPress={handleNewChat} color={theme.primary} />
      </Appbar.Header>

      <Surface elevation={0} style={s.searchContainer}>
        <Searchbar
          placeholder={t('messages.search', 'Search conversations')}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={s.searchBar}
          inputStyle={{ color: theme.text, minHeight: 0 }}
          iconColor={theme.textMuted}
          placeholderTextColor={theme.textMuted}
          elevation={0}
          theme={{ colors: { background: theme.surface } }}
        />
      </Surface>

      <FlatList
        data={displayedConvs}
        renderItem={renderConversation}
        keyExtractor={(item, i) => item.user?._id || String(i)}
        showsVerticalScrollIndicator={false}
        style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        onEndReached={searchQuery ? loadMoreConnections : loadMoreConversations}
        onEndReachedThreshold={0.35}
        ListFooterComponent={
          (searchQuery ? loadingMoreConnections : loadingMore) ? (
            <Surface elevation={0} style={{ paddingVertical: 18 }}>
              <Text style={{ color: theme.textMuted, textAlign: 'center' }}>
                {t('common.loading', 'Loading…')}
              </Text>
            </Surface>
          ) : null
        }
        ListEmptyComponent={
          <Surface elevation={0} style={s.emptyState}>
            <Ionicons name="chatbubbles-outline" size={28} color={theme.textMuted} />
            <Text variant="titleMedium" style={s.emptyTitle}>{t('messages.no_messages', 'No messages yet')}</Text>
            <Text variant="bodyMedium" style={s.emptySubtitle}>{t('messages.connect_hint', 'Connect with athletes to start chatting')}</Text>
          </Surface>
        }
      />
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.surface,
    elevation: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: { fontSize: 23, fontWeight: '800', color: theme.text },
  searchContainer: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 14, marginBottom: 8, backgroundColor: 'transparent' },
  searchBar: {
    backgroundColor: theme.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.border,
    height: 46,
  },
  convRow: {
    paddingHorizontal: 16, paddingVertical: 12,
    marginHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  avatarContainer: { position: 'relative', marginRight: 12 },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    backgroundColor: theme.success, borderWidth: 2, borderColor: theme.surface,
  },
  convContent: { flex: 1, minWidth: 0, marginRight: 8, justifyContent: 'center' },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  convName: { fontWeight: '600', color: theme.textMuted, flex: 1, marginRight: 8 },
  convTime: { color: theme.textMuted, flexShrink: 1, maxWidth: '42%', textAlign: 'right' },
  convPreview: { color: theme.textMuted },
  unreadBadge: { justifyContent: 'center', alignItems: 'center' },
  emptyState: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    backgroundColor: theme.surface,
  },
  emptyTitle: { fontWeight: '700', color: theme.text, marginTop: 8 },
  emptySubtitle: { color: theme.textMuted, textAlign: 'center', maxWidth: 220 },
});

export default Messages;
