import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContext } from "../context/AuthProvider";
import { useTranslation } from 'react-i18next';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import { useSocket } from '../hooks/useSocket';
import { setConnections } from '../features/connections/connectionsSlice';
import { getUserConnections, getUserConversations } from '../api/endpoints';
import dayjs, { setDayjsLocale } from '../utils/dayjs';

import { ActivityIndicator, Avatar, Text, TouchableRipple } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MESSAGE_ICON } from '../config/icons';
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

/** Instagram's inbox avatar: big enough to recognise, small enough for a list. */
const AVATAR_SIZE = 56;

const entityId = (entity: PublicUser | string): string =>
  typeof entity === 'string' ? entity : entity._id;

const Messages = ({ navigation }: NavigationOnlyProps) => {
  const dispatch = useAppDispatch();
  const { getToken } = useAuthContext();
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const s = React.useMemo(() => getStyles(theme), [theme]);

  const { connections } = useAppSelector((state) => state.connections);
  const { socket } = useSocket();

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
      // Search has to reach everyone the app lets you message. Mutual
      // connections alone miss the people you only follow, which left the
      // results empty for accounts with no accepted connection requests.
      const [connectionsPage, followingPage] = await Promise.all([
        getUserConnections(token, 'connections', cursor),
        cursor ? Promise.resolve(null) : getUserConnections(token, 'following', null),
      ]);
      if (!connectionsPage.success && !followingPage?.success) return;
      const previous = cursor ? connectionsRef.current : [];
      const knownIds = new Set(previous.map((connection) => connection._id));
      const incoming = [
        ...(connectionsPage.success ? connectionsPage.items || [] : []),
        ...(followingPage?.success ? followingPage.items || [] : []),
      ];
      const nextConnections = [...previous];
      for (const connection of incoming) {
        if (!connection?._id || knownIds.has(connection._id)) continue;
        knownIds.add(connection._id);
        nextConnections.push(connection);
      }
      connectionsRef.current = nextConnections;
      dispatch(setConnections(nextConnections));
      setConnectionCursor(connectionsPage.success ? connectionsPage.nextCursor || null : null);
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

  /**
   * One conversation, edge to edge.
   *
   * The row used to be a bordered card inset from both sides, which turned the
   * inbox into a column of boxes with the screen showing through between them.
   * It is a plain row now: avatar, name, and one line that carries the message
   * and its age together, the way every inbox people already use reads.
   */
  const renderConversation: ListRenderItem<ConversationItem> = ({ item: conv }) => {
    const hasUnread = (conv.unread || 0) > 0;
    const msgText = conv.lastMessage?.text
      || (conv.lastMessage?.message_type === 'image' ? `📷 ${t('common.photo', 'Fotoğraf')}` : '');
    const timeLabel = conv.lastMessage?.createdAt ? dayjs(conv.lastMessage.createdAt).fromNow() : '';
    const preview = conv.isNew
      ? t('messages.start_new_chat', 'Start a new chat')
      : (msgText || t('messages.no_message', 'No message yet'));

    return (
      <TouchableRipple
        style={s.convRow}
        onPress={() => handleOpen(conv)}
        accessibilityRole="button"
        accessibilityLabel={conv.user?.full_name || conv.user?.username}
      >
        <View style={s.convRowInner}>
          <View style={s.avatarContainer}>
            {conv.user?.profile_picture
              ? <Avatar.Image source={{ uri: conv.user.profile_picture }} size={AVATAR_SIZE} />
              : <Avatar.Text
                  label={(conv.user?.full_name || conv.user?.username || '?').charAt(0).toUpperCase()}
                  size={AVATAR_SIZE}
                  style={{ backgroundColor: theme.primarySoft }}
                  labelStyle={{ color: theme.primary, fontWeight: '800' }}
                />
            }
          </View>

          <View style={s.convContent}>
            <Text
              numberOfLines={1}
              style={[s.convName, hasUnread && s.convNameUnread]}
            >
              {conv.user?.full_name || conv.user?.username}
            </Text>
            {/* Message and age share one line: two lines of grey under every
                name is what made the list feel twice as tall as it needed. */}
            <Text numberOfLines={1} style={[s.convPreview, hasUnread && s.convPreviewUnread]}>
              {preview}
              {timeLabel ? <Text style={s.convTime}>{`  ·  ${timeLabel}`}</Text> : null}
            </Text>
          </View>

          {hasUnread ? <View style={s.unreadDot} /> : null}
        </View>
      </TouchableRipple>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* A plain header rather than Appbar: its Content block centres a title
          against whatever happens to be on either side, which is what left the
          name off-centre once an icon was added on one side only. */}
      <View style={s.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={s.headerButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Geri')}
        >
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <Text numberOfLines={1} style={s.headerTitle}>
          {t('messages.title', 'Messages')}
        </Text>
        <Pressable
          onPress={handleNewChat}
          hitSlop={10}
          style={s.headerButton}
          accessibilityRole="button"
          accessibilityLabel={t('messages.start_new_chat', 'Yeni sohbet')}
        >
          <Ionicons name="create-outline" size={24} color={theme.text} />
        </Pressable>
      </View>

      {/* The search field is the only inset thing on the screen; the people
          below it run the full width. */}
      <View style={s.searchContainer}>
        <View style={s.searchField}>
          <Ionicons name="search" size={17} color={theme.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('messages.search', 'Search conversations')}
            placeholderTextColor={theme.textMuted}
            style={s.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel={t('messages.search', 'Search conversations')}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common.clear', 'Temizle')}
            >
              <Ionicons name="close-circle" size={17} color={theme.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={displayedConvs}
        renderItem={renderConversation}
        keyExtractor={(item, i) => item.user?._id || String(i)}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={s.list}
        contentContainerStyle={{ paddingTop: 2, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        onEndReached={searchQuery ? loadMoreConnections : loadMoreConversations}
        onEndReachedThreshold={0.35}
        ListFooterComponent={
          (searchQuery ? loadingMoreConnections : loadingMore) ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 18 }} />
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 48 }} />
          ) : (
            <View style={s.emptyState}>
              <Ionicons name={MESSAGE_ICON} size={30} color={theme.textMuted} />
              <Text style={s.emptyTitle}>{t('messages.no_messages', 'No messages yet')}</Text>
              <Text style={s.emptySubtitle}>{t('messages.connect_hint', 'Connect with athletes to start chatting')}</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 6,
  },
  // Both sides reserve the same width, so the title is centred by geometry
  // rather than by whatever is placed beside it.
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    color: theme.text,
    fontSize: 17,
    fontWeight: '800',
  },
  searchContainer: { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 10 },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: theme.surfaceLight,
  },
  searchInput: { flex: 1, minWidth: 0, color: theme.text, fontSize: 15, padding: 0 },
  list: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  // No card, no border, no side margin: the row is the full width of the list
  // and the only inset is the text gutter.
  convRow: { paddingHorizontal: 14, paddingVertical: 9 },
  convRowInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarContainer: { position: 'relative' },
  convContent: { flex: 1, minWidth: 0, gap: 3 },
  convName: { color: theme.text, fontSize: 15, fontWeight: '600' },
  convNameUnread: { fontWeight: '800' },
  convPreview: { color: theme.textMuted, fontSize: 13.5 },
  convPreviewUnread: { color: theme.text, fontWeight: '600' },
  convTime: { color: theme.textMuted, fontSize: 13.5, fontWeight: '400' },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.primary },
  emptyState: { alignItems: 'center', gap: 6, paddingTop: 70, paddingHorizontal: 40 },
  emptyTitle: { color: theme.text, fontSize: 15, fontWeight: '700', marginTop: 8 },
  emptySubtitle: { color: theme.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});

export default Messages;
