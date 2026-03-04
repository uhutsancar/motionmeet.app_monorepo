import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  TextInput, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../hooks/useSocket';
import { fetchConnections } from '../features/connections/connectionsSlice';
import { getUserRecentMessages } from '../api/endpoints';
import moment from 'moment';
import 'moment/locale/tr';

const Messages = ({ navigation }) => {
  const dispatch = useDispatch();
  const { getToken } = useAuth();
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  // Memoize styles
  const s = React.useMemo(() => getStyles(theme), [theme]);

  const { connections } = useSelector((state) => state.connections);
  const { socketRef, onlineUsers } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const conversationsRef = useRef(conversations);

  useEffect(() => {
    moment.locale(i18n.language.startsWith('tr') ? 'tr' : 'en');
  }, [i18n.language]);

  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  useEffect(() => {
    loadAll();
  }, []);

  // Socket.io: append new message to conversation list
  useEffect(() => {
    const socket = socketRef.current;
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
          };
          return [updated[exists], ...updated.filter((_, i) => i !== exists)];
        }
        // New conversation
        return [{
          user: msg.from_user_id,
          lastMessage: msg,
          unread: 1,
        }, ...prev];
      });
    };

    socket.on('message_received', onMsg);
    return () => socket.off('message_received', onMsg);
  }, [socketRef.current]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      dispatch(fetchConnections(token));
      await loadConversations(token);
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async (token) => {
    try {
      const data = await getUserRecentMessages(token);
      if (data.success) {
        // Group by sender, keep latest per sender
        const grouped = {};
        data.messages.forEach(msg => {
          const sid = msg.from_user_id?._id;
          if (!sid) return;
          if (!grouped[sid] || new Date(msg.createdAt) > new Date(grouped[sid].createdAt)) {
            grouped[sid] = msg;
          }
        });
        const convs = Object.values(grouped)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map(msg => ({
            user: msg.from_user_id,
            lastMessage: msg,
            unread: msg.seen ? 0 : 1,
          }));
        setConversations(convs);
      }
    } catch {}
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleOpen = (conv) => {
    // Mark as read locally
    setConversations(prev => prev.map(c => c.user?._id === conv.user?._id ? { ...c, unread: 0 } : c));
    navigation.navigate('ChatBox', { userId: conv.user?._id, user: conv.user });
  };

  const handleNewChat = () => {
    // Navigate to Connections / Discover to pick someone
    navigation.navigate('Connections');
  };

  const filtered = searchQuery
    ? conversations.filter(c =>
        c.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.user?.username?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const renderConversation = ({ item: conv }) => {
    const isOnline = onlineUsers.has(conv.user?._id);
    const hasUnread = (conv.unread || 0) > 0;
    const msgText = conv.lastMessage?.text || (conv.lastMessage?.message_type === 'image' ? '📷 Fotoğraf' : '');
    const timeLabel = conv.lastMessage?.createdAt ? moment(conv.lastMessage.createdAt).fromNow() : '';

    return (
      <TouchableOpacity style={s.convRow} onPress={() => handleOpen(conv)} activeOpacity={0.7}>
        {/* Avatar with online dot */}
        <View style={s.avatarContainer}>
          {conv.user?.profile_picture
            ? <Image source={{ uri: conv.user.profile_picture }} style={s.avatar} />
            : <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarText}>{conv.user?.full_name?.charAt(0)?.toUpperCase() || '?'}</Text>
              </View>
          }
          {isOnline && <View style={s.onlineDot} />}
        </View>

        {/* Content */}
        <View style={s.convContent}>
          <View style={s.convTop}>
            <Text style={[s.convName, hasUnread && { color: theme.text, fontWeight: '700' }]} numberOfLines={1}>
              {conv.user?.full_name || conv.user?.username}
            </Text>
            <Text style={s.convTime}>{timeLabel}</Text>
          </View>
          <Text style={[s.convPreview, hasUnread && { color: theme.text, fontWeight: '500' }]} numberOfLines={1}>
            {msgText || t('messages.no_message', 'No message yet')}
          </Text>
        </View>

        {/* Unread badge */}
        {hasUnread && (
          <View style={s.unreadBadge}>
            <View style={s.unreadDot} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>{t('messages.title', 'Messages')}</Text>
        <TouchableOpacity onPress={handleNewChat} style={s.newChatBtn}>
          <Ionicons name="create-outline" size={22} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchContainer}>
        <View style={s.searchBar}>
          <Ionicons name="search" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder={t('messages.search', 'Ara...')}
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        renderItem={renderConversation}
        keyExtractor={(item, i) => item.user?._id || String(i)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Ionicons name="chatbubbles-outline" size={52} color={theme.border} />
            <Text style={s.emptyTitle}>{t('messages.no_messages', 'No messages yet')}</Text>
            <Text style={s.emptySubtitle}>{t('messages.connect_hint', 'Connect with athletes to start chatting')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: theme.text },
  newChatBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
  searchContainer: { paddingHorizontal: 16, marginBottom: 8 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.text },
  convRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: theme.border,
  },
  avatarContainer: { position: 'relative', marginRight: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: '#22c55e', borderWidth: 2, borderColor: theme.background,
  },
  convContent: { flex: 1, marginRight: 8 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  convName: { fontSize: 15, fontWeight: '600', color: theme.textMuted, flex: 1, marginRight: 8 },
  convTime: { fontSize: 11, color: theme.textMuted, flexShrink: 0 },
  convPreview: { fontSize: 13, color: theme.textMuted },
  unreadBadge: { justifyContent: 'center', alignItems: 'center' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.primary },
  emptyState: { flex: 1, paddingTop: 80, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginTop: 8 },
  emptySubtitle: { fontSize: 13, color: theme.textMuted, textAlign: 'center', maxWidth: 220 },
});

export default Messages;
