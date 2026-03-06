import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  Alert, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../hooks/useSocket';
import { getMessages, sendMessage as sendMessageHTTP, deleteMessage } from '../api/endpoints';
import { setMessages, addMessage, removeMessage } from '../features/messages/messagesSlice';
import moment from 'moment';

const ChatBox = ({ route, navigation }) => {
  const { userId, user: routeUser } = route.params;
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const dispatch = useDispatch();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const s = getStyles(theme, insets);

  const currentUser = useSelector((state) => state.user.value);
  const connections = useSelector((state) => state.connections.connections);
  const { messages } = useSelector((state) => state.messages);

  const { socketRef, connected, onlineUsers, sendMessage: socketSend, emitTypingStart, emitTypingStop } = useSocket();

  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [user, setUser] = useState(routeUser);

  const flatListRef = useRef(null);
  const typingRef = useRef(null);

  // Resolve user from connections if not directly provided
  useEffect(() => {
    if (!user && connections.length > 0) {
      setUser(connections.find(c => c._id === userId));
    }
  }, [connections, userId, user]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      const token = await getToken();
      const data = await getMessages(userId, token);
      if (data.success) dispatch(setMessages(data.messages));
      setInitialLoading(false);
    };
    load();
  }, [userId]);

  // Socket.io listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onMsg = (msg) => {
      const fromId = msg.from_user_id?._id || msg.from_user_id;
      if (fromId === userId) {
        dispatch(addMessage(msg));
        setPartnerTyping(false);
      }
    };

    const onSent = (msg) => { dispatch(addMessage(msg)); };

    const onTypStart = ({ from_user_id }) => { if (from_user_id === userId) setPartnerTyping(true); };
    const onTypStop = ({ from_user_id }) => { if (from_user_id === userId) setPartnerTyping(false); };

    socket.on('message_received', onMsg);
    socket.on('message_sent', onSent);
    socket.on('typing_start', onTypStart);
    socket.on('typing_stop', onTypStop);
    socket.on('message_deleted', ({ messageId }) => {
      dispatch(removeMessage(messageId));
    });

    return () => {
      socket.off('message_received', onMsg);
      socket.off('message_sent', onSent);
      socket.off('typing_start', onTypStart);
      socket.off('typing_stop', onTypStop);
      socket.off('message_deleted');
    };
  }, [socketRef.current, userId]);

  // Scroll to end when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, partnerTyping]);

  const handleTextChange = (val) => {
    setText(val);
    emitTypingStart(userId);
    clearTimeout(typingRef.current);
    typingRef.current = setTimeout(() => emitTypingStop(userId), 1500);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(t('common.error', 'Error'), t('feed.permission_required_media', 'We need permission to access your media')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8,
    });
    if (!result.canceled) setImage(result.assets[0]);
  };

  const handleSend = useCallback(async () => {
    if (!text.trim() && !image) return;
    emitTypingStop(userId);

    if (!image && connected) {
      // Use Socket.io for text-only messages
      socketSend(userId, text.trim());
      setText('');
      return;
    }

    // HTTP for image messages
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('to_user_id', userId);
      formData.append('text', text.trim());
      if (image) {
        formData.append('image', { uri: image.uri, type: 'image/jpeg', name: 'msg.jpg' });
      }
      const data = await sendMessageHTTP(formData, token);
      if (data.success) {
        dispatch(addMessage(data.message));
        setText('');
        setImage(null);
      }
    } catch {
      Alert.alert(t('common.error', 'Error'), t('messages.send_failed', 'Failed to send message'));
    }
  }, [text, image, connected, userId, socketSend]);

  const isMine = (msg) => {
    const fromId = msg.from_user_id?._id || msg.from_user_id;
    return fromId === clerkUser?.id || fromId !== userId;
  };

  const handleDeleteMessage = (msgId) => {
    Alert.alert(
      t('messages.delete_title', 'Delete Message'),
      t('messages.delete_confirm', 'Are you sure you want to delete this message?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { 
          text: t('common.delete', 'Delete'), 
          style: 'destructive', 
          onPress: async () => {
            try {
              const token = await getToken();
              const data = await deleteMessage(msgId, token);
              if (data.success) {
                dispatch(removeMessage(msgId));
              } else {
                Alert.alert(t('common.error', 'Error'), data.message);
              }
            } catch (err) {
              Alert.alert(t('common.error', 'Error'), t('messages.delete_failed', 'Failed to delete message'));
            }
          } 
        }
      ]
    );
  };

  const renderMessage = ({ item: msg, index }) => {
    const mine = isMine(msg);
    const prevMsg = messages[index - 1];
    const showAvatar = !mine && (!prevMsg || isMine(prevMsg));

    return (
      <View style={[s.msgRow, mine ? s.msgRowRight : s.msgRowLeft]}>
        {!mine && (
          <View style={{ width: 28, marginRight: 6 }}>
            {showAvatar && user?.profile_picture
              ? <Image source={{ uri: user.profile_picture }} style={s.miniAvatar} />
              : <View style={{ width: 28 }} />
            }
          </View>
        )}
        <View style={{ maxWidth: '75%' }}>
          {msg.message_type === 'image' && msg.media_url && (
            <Image source={{ uri: msg.media_url }} style={s.msgImage} resizeMode="cover" />
          )}
          {msg.text ? (
            <TouchableOpacity 
              style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}
              onLongPress={() => mine && handleDeleteMessage(msg._id)}
              activeOpacity={0.8}
            >
              <Text style={[s.bubbleText, { color: mine ? '#fff' : theme.text }]}>{msg.text}</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={[s.msgTime, { textAlign: mine ? 'right' : 'left' }]}>
            {moment(msg.createdAt).format('HH:mm')}
            {mine && (msg.seen ? '  ✓✓' : '  ✓')}
          </Text>
        </View>
      </View>
    );
  };

  const renderTyping = () => (
    <View style={[s.msgRow, s.msgRowLeft]}>
      <View style={{ width: 28, marginRight: 6 }}>
        {user?.profile_picture && <Image source={{ uri: user.profile_picture }} style={s.miniAvatar} />}
      </View>
      <View style={[s.bubble, s.bubbleTheirs, { paddingVertical: 10 }]}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[s.typingDot, { opacity: 0.5 + i * 0.2 }]} />
          ))}
        </View>
      </View>
    </View>
  );

  if (!user) return <SafeAreaView style={s.container}><ActivityIndicator color={theme.primary} /></SafeAreaView>;

  const isOnline = onlineUsers.has(userId);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={s.headerAvContainer}>
          {user.profile_picture
            ? <Image source={{ uri: user.profile_picture }} style={s.headerAvatar} />
            : <View style={[s.headerAvatar, { backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{user.full_name?.charAt(0)}</Text>
              </View>
          }
          {isOnline && <View style={s.onlineDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerName} numberOfLines={1}>{user.full_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[s.statusDot, { backgroundColor: isOnline ? '#22c55e' : '#94a3b8' }]} />
            <Text style={s.headerStatus}>
              {isOnline ? t('status.online') : t('status.offline')}
            </Text>
          </View>
        </View>
        <View style={[s.connBadge, { backgroundColor: connected ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }]}>
          <View style={[s.connDot, { backgroundColor: connected ? '#22c55e' : '#ef4444' }]} />
          <Text style={[s.connText, { color: connected ? '#22c55e' : '#ef4444' }]}>
            {connected ? 'LIVE' : 'OFF'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Messages */}
        {initialLoading ? (
          <View style={s.loader}><ActivityIndicator color={theme.primary} /></View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item, i) => item._id || String(i)}
            contentContainerStyle={s.msgList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={partnerTyping ? renderTyping : null}
          />
        )}

        {/* Input */}
        <View style={{ backgroundColor: theme.surface }}>
          {image && (
            <View style={s.imagePreview}>
              <Image source={{ uri: image.uri }} style={s.previewImg} />
              <TouchableOpacity onPress={() => setImage(null)} style={s.removeImg}>
                <Ionicons name="close-circle" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
          <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom || 0, 12) }]}>
            <TouchableOpacity onPress={pickImage} style={s.attachBtn}>
              <Ionicons name="image-outline" size={24} color={theme.textMuted} />
            </TouchableOpacity>
            <TextInput
              style={s.input}
              placeholder={t('messages.type_message', 'Message...')}
              placeholderTextColor={theme.textMuted}
              value={text}
              onChangeText={handleTextChange}
              multiline
              maxLength={1000}
              keyboardAppearance={isDark ? 'dark' : 'light'}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!text.trim() && !image}
              style={[s.sendBtn, (!text.trim() && !image) && { opacity: 0.4 }]}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const getStyles = (theme, insets) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerAvContainer: { position: 'relative', marginRight: 12 },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: theme.border },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: theme.surface,
  },
  statusDot: {
    width: 6, height: 6, borderRadius: 3,
  },
  headerName: { fontSize: 17, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
  headerStatus: { fontSize: 12, color: theme.textMuted, marginTop: 1, fontWeight: '500' },
  connBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  connDot: { width: 7, height: 7, borderRadius: 3.5 },
  connText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  msgList: { paddingHorizontal: 16, paddingVertical: 20, flexGrow: 1 },
  msgRow: { marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  miniAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: theme.border },
  bubble: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 22, maxWidth: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  bubbleMine: {
    backgroundColor: theme.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: theme.surface,
    borderWidth: 1, borderColor: theme.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  msgTime: { fontSize: 10, color: theme.textMuted, marginTop: 4, fontWeight: '600', paddingHorizontal: 8 },
  msgImage: { width: 220, height: 200, borderRadius: 18, marginBottom: 6 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.textMuted, marginHorizontal: 2 },
  imagePreview: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, py: 12,
    backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border,
  },
  previewImg: { width: 60, height: 60, borderRadius: 12 },
  removeImg: { position: 'absolute', top: -10, right: -10, backgroundColor: '#fff', borderRadius: 12 },
  inputBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border,
    gap: 12,
  },
  attachBtn: { 
    width: 44, height: 44, borderRadius: 22, 
    backgroundColor: theme.background, 
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: theme.border
  },
  input: {
    flex: 1, fontSize: 16, color: theme.text,
    backgroundColor: theme.background,
    borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12,
    maxHeight: 120, borderWidth: 1, borderColor: theme.border,
    fontWeight: '500'
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
});

export default ChatBox;
