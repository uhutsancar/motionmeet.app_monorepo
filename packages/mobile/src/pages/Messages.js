import React, { useCallback, useEffect, useState, useRef } from 'react';
import { FlatList, StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useAuthContext } from "../context/AuthProvider";
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../hooks/useSocket';
import { fetchConnections } from '../features/connections/connectionsSlice';
import { getUserConversations } from '../api/endpoints';
import moment from 'moment';
import 'moment/locale/tr';
import { Appbar, Avatar, Text, Searchbar, TouchableRipple, Badge, Surface } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

const Messages = ({ navigation }) => {
  const dispatch = useDispatch();
  const { getToken } = useAuthContext();
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const s = React.useMemo(() => getStyles(theme), [theme]);

  const { connections } = useSelector((state) => state.connections);
  const { socket, onlineUsers } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const connectionsRef = useRef(connections);

  useEffect(() => {
    moment.locale(i18n.language.startsWith('tr') ? 'tr' : 'en');
  }, [i18n.language]);

  useEffect(() => { connectionsRef.current = connections; }, [connections]);

  useEffect(() => {
    if (!socket) return;

    const onMsg = (msg) => {
      const senderId = msg.from_user_id?._id || msg.from_user_id;
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
        return [{
          user: msg.from_user_id,
          lastMessage: msg,
          unread: 1,
          isNew: false
        }, ...prev];
      });
    };

    const onSent = (msg) => {
      const recipientId = msg.to_user_id?._id || msg.to_user_id;
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
    return () => {
      socket.off('message_received', onMsg);
      socket.off('message_sent', onSent);
    };
  }, [socket]);

  const loadConversations = useCallback(async (token) => {
    try {
      const data = await getUserConversations(token);
      if (data.success) {
        const convs = (data.conversations || []).map((conversation) => ({
          user: conversation.partner,
          lastMessage: conversation.lastMessage,
          unread: conversation.unreadCount || 0,
        }));
        setConversations(convs);
      }
    } catch (error) {
      console.warn('Conversation request failed:', error.message);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      await dispatch(fetchConnections(token));
      await loadConversations(token);
    } catch (error) {
      console.warn('Conversation list could not be loaded:', error.message);
    } finally {
      setLoading(false);
    }
  }, [dispatch, getToken, loadConversations]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpen = (conv) => {
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

  const renderConversation = ({ item: conv }) => {
    const isOnline = onlineUsers.has(conv.user?._id);
    const hasUnread = (conv.unread || 0) > 0;
    const msgText = conv.lastMessage?.text || (conv.lastMessage?.message_type === 'image' ? '📷 Fotoğraf' : '');
    const timeLabel = conv.lastMessage?.createdAt ? moment(conv.lastMessage.createdAt).fromNow() : '';

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
              <Text variant="labelSmall" style={s.convTime}>{timeLabel}</Text>
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

      <Appbar.Header style={s.header}>
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

const getStyles = (theme) => ({
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
  convContent: { flex: 1, marginRight: 8, justifyContent: 'center' },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  convName: { fontWeight: '600', color: theme.textMuted, flex: 1, marginRight: 8 },
  convTime: { color: theme.textMuted, flexShrink: 0 },
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
