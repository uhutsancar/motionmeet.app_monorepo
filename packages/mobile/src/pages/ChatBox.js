import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FlatList, Image, Alert, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthContext } from "../context/AuthProvider";
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../hooks/useSocket';
import { getMessages, sendMessage as sendMessageHTTP, deleteMessage } from '../api/endpoints';
import { uploadMedia } from '../api/mediaUpload';
import { setMessages, addMessage, prependMessages, removeMessage } from '../features/messages/messagesSlice';
import moment from 'moment';
import { Appbar, Avatar, Text, TextInput, IconButton, Surface, ActivityIndicator, Badge, useTheme as usePaperTheme, TouchableRipple } from 'react-native-paper';
import { showError } from '../utils/feedback';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { KeyboardResponsiveView } from '../components/KeyboardAwareScrollView';

const ChatBox = ({ route, navigation }) => {
  const { userId, user: routeUser } = route?.params || {};
  const { getToken } = useAuthContext();
  const { user: authUser } = useAuthContext();
  const dispatch = useDispatch();
  const { theme, isDark } = useTheme();
  const paperTheme = usePaperTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { contentWidth } = useResponsiveLayout();
  const messageMediaWidth = Math.max(80, Math.min(220, contentWidth * 0.72));
  const s = getStyles(theme, paperTheme, insets);

  const currentUser = useSelector((state) => state.user.value);
  const connections = useSelector((state) => state.connections.connections);
  const { messages } = useSelector((state) => state.messages);

  const { socket, connected, onlineUsers, sendMessage: socketSend, emitTypingStart, emitTypingStop } = useSocket();

  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [user, setUser] = useState(routeUser);

  const flatListRef = useRef(null);
  const typingRef = useRef(null);
  const skipAutoScrollRef = useRef(false);

  useEffect(() => {
    if (!user && connections.length > 0) {
      setUser(connections.find(c => c._id === userId));
    }
  }, [connections, userId, user]);

  useEffect(() => {
    if (!userId) {
      setInitialLoading(false);
      return undefined;
    }

    dispatch(setMessages([]));
    setNextCursor(null);
    let cancelled = false;
    const load = async () => {
      try {
        const token = await getToken();
        const data = await getMessages(userId, token);
        if (!cancelled && data.success) {
          dispatch(setMessages(data.messages));
          setNextCursor(data.nextCursor);
        }
      } catch (error) {
        if (!cancelled) {
          showError(t('common.error', 'Error'), t('messages.load_failed', 'Messages could not be loaded'));
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [dispatch, getToken, t, userId]);

  useEffect(() => {
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
    const onDeleted = ({ messageId }) => dispatch(removeMessage(messageId));
    const onMessageError = ({ message } = {}) => {
      showError(t('common.error', 'Error'), message || t('messages.send_failed', 'Failed to send message'));
    };

    socket.on('message_received', onMsg);
    socket.on('message_sent', onSent);
    socket.on('typing_start', onTypStart);
    socket.on('typing_stop', onTypStop);
    socket.on('message_deleted', onDeleted);
    socket.on('message_error', onMessageError);

    return () => {
      socket.off('message_received', onMsg);
      socket.off('message_sent', onSent);
      socket.off('typing_start', onTypStart);
      socket.off('typing_stop', onTypStop);
      socket.off('message_deleted', onDeleted);
      socket.off('message_error', onMessageError);
    };
  }, [dispatch, socket, t, userId]);

  useEffect(() => () => {
    clearTimeout(typingRef.current);
    if (userId) emitTypingStop(userId);
  }, [emitTypingStop, userId]);

  useEffect(() => {
    if (messages.length > 0) {
      if (skipAutoScrollRef.current) {
        skipAutoScrollRef.current = false;
        return;
      }
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, partnerTyping]);

  const loadOlderMessages = useCallback(async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const token = await getToken();
      const data = await getMessages(userId, token, nextCursor);
      if (data.success) {
        skipAutoScrollRef.current = true;
        dispatch(prependMessages(data.messages || []));
        setNextCursor(data.nextCursor);
      }
    } catch {
      showError(t('common.error', 'Error'), t('messages.load_failed', 'Messages could not be loaded'));
    } finally {
      setLoadingOlder(false);
    }
  }, [dispatch, getToken, loadingOlder, nextCursor, t, userId]);

  const handleTextChange = (val) => {
    setText(val);
    emitTypingStart(userId);
    clearTimeout(typingRef.current);
    typingRef.current = setTimeout(() => emitTypingStop(userId), 1500);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showError(t('common.error', 'Error'), t('feed.permission_required_media', 'We need permission to access your media'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8,
    });
    if (!result.canceled) setImage(result.assets[0]);
  };

  const handleSend = useCallback(async () => {
    if (!text.trim() && !image) return;
    emitTypingStop(userId);

    if (!image && connected && socketSend(userId, text.trim())) {
      setText('');
      return;
    }

    try {
      const token = await getToken();
      const uploadedKey = image
        ? await uploadMedia(image, 'messages', token)
        : undefined;
      const data = await sendMessageHTTP({
        to_user_id: userId,
        text: text.trim(),
        uploadedKey,
      }, token);
      if (data.success) {
        dispatch(addMessage(data.message));
        setText('');
        setImage(null);
      }
    } catch {
      showError(t('common.error', 'Error'), t('messages.send_failed', 'Failed to send message'));
    }
  }, [connected, dispatch, emitTypingStop, getToken, image, socketSend, text, t, userId]);

  const isMine = (msg) => {
    const fromId = msg.from_user_id?._id || msg.from_user_id;
    return fromId === (currentUser?._id || authUser?.id);
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
                showError(t('common.error', 'Error'), data.message);
              }
            } catch (err) {
              showError(t('common.error', 'Error'), t('messages.delete_failed', 'Failed to delete message'));
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
      <Surface elevation={0} style={[s.msgRow, mine ? s.msgRowRight : s.msgRowLeft]}>
        {!mine && (
          <Surface elevation={0} style={{ width: 28, marginRight: 6 }}>
            {showAvatar && user?.profile_picture
              ? <Avatar.Image source={{ uri: user.profile_picture }} size={28} />
              : <Surface elevation={0} style={{ width: 28 }} />
            }
          </Surface>
        )}
        <Surface elevation={0} style={{ maxWidth: '75%' }}>
          {msg.message_type === 'image' && msg.media_url && (
            <Image
              source={{ uri: msg.media_url }}
              style={[
                s.msgImage,
                { width: messageMediaWidth, height: messageMediaWidth * 0.9 },
              ]}
              resizeMode="cover"
            />
          )}
          {msg.text ? (
            <TouchableRipple 
              style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}
              onLongPress={() => mine && handleDeleteMessage(msg._id)}
              rippleColor="rgba(0, 0, 0, .1)"
            >
              <Text style={[s.bubbleText, { color: mine ? '#fff' : theme.text }]}>{msg.text}</Text>
            </TouchableRipple>
          ) : null}
          <Text variant="labelSmall" style={[s.msgTime, { textAlign: mine ? 'right' : 'left' }]}>
            {moment(msg.createdAt).format('HH:mm')}
            {mine && (msg.seen ? '  ✓✓' : '  ✓')}
          </Text>
        </Surface>
      </Surface>
    );
  };

  const renderTyping = () => (
    <Surface elevation={0} style={[s.msgRow, s.msgRowLeft]}>
      <Surface elevation={0} style={{ width: 28, marginRight: 6 }}>
        {user?.profile_picture && <Avatar.Image source={{ uri: user.profile_picture }} size={28} />}
      </Surface>
      <Surface style={[s.bubble, s.bubbleTheirs, { paddingVertical: 10 }]} elevation={0}>
        <Surface elevation={0} style={{ flexDirection: 'row', gap: 4 }}>
          {[0, 1, 2].map(i => (
            <Surface elevation={0} key={i} style={[s.typingDot, { opacity: 0.5 + i * 0.2 }]} />
          ))}
        </Surface>
      </Surface>
    </Surface>
  );

  if (!userId) {
    return (
      <SafeAreaView style={s.container}>
        <Surface elevation={0} style={s.loader}>
          <Text style={{ color: theme.textMuted }}>{t('messages.invalid_conversation', 'Invalid conversation')}</Text>
          <TouchableRipple onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
            <Text style={{ color: theme.primary }}>{t('common.back', 'Back')}</Text>
          </TouchableRipple>
        </Surface>
      </SafeAreaView>
    );
  }

  if (!user) return <SafeAreaView style={s.container}><ActivityIndicator color={theme.primary} /></SafeAreaView>;

  const isOnline = onlineUsers.has(userId);

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Appbar.Header style={s.header} statusBarHeight={0}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Surface elevation={0} style={s.headerAvContainer}>
          {user.profile_picture
            ? <Avatar.Image source={{ uri: user.profile_picture }} size={40} />
            : <Avatar.Text label={user.full_name?.charAt(0) || '?'} size={40} style={{ backgroundColor: theme.primary }} />
          }
          {isOnline && <Badge size={12} style={s.onlineDot} />}
        </Surface>
        <Appbar.Content 
          title={user.full_name} 
          titleStyle={s.headerName} 
          subtitle={
            <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Surface elevation={0} style={[s.statusDot, { backgroundColor: isOnline ? '#22c55e' : '#94a3b8' }]} />
              <Text style={s.headerStatus}>
                {isOnline ? t('status.online') : t('status.offline')}
              </Text>
            </Surface>
          }
        />
        <Surface style={[s.connBadge, { backgroundColor: connected ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }]} elevation={0}>
          <Surface elevation={0} style={[s.connDot, { backgroundColor: connected ? '#22c55e' : '#ef4444' }]} />
          <Text style={[s.connText, { color: connected ? '#22c55e' : '#ef4444' }]}>
            {connected ? 'LIVE' : 'OFF'}
          </Text>
        </Surface>
      </Appbar.Header>

      <KeyboardResponsiveView
        style={{ flex: 1 }}
      >
        {initialLoading ? (
          <Surface elevation={0} style={s.loader}><ActivityIndicator color={theme.primary} /></Surface>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item, i) => item._id || String(i)}
            contentContainerStyle={s.msgList}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              nextCursor ? (
                <TouchableRipple
                  onPress={loadOlderMessages}
                  disabled={loadingOlder}
                  style={{ alignSelf: 'center', padding: 12, marginBottom: 8 }}
                >
                  {loadingOlder
                    ? <ActivityIndicator size="small" color={theme.primary} />
                    : <Text style={{ color: theme.primary }}>{t('common.load_more', 'Load older messages')}</Text>
                  }
                </TouchableRipple>
              ) : null
            }
            ListFooterComponent={partnerTyping ? renderTyping : null}
          />
        )}

        <Surface style={{ backgroundColor: theme.surface }} elevation={2}>
          {image && (
            <Surface elevation={0} style={s.imagePreview}>
              <Image source={{ uri: image.uri }} style={s.previewImg} />
              <IconButton 
                icon="close-circle" 
                iconColor="#ef4444" 
                size={24} 
                onPress={() => setImage(null)} 
                style={s.removeImg} 
              />
            </Surface>
          )}
          <Surface elevation={0} style={[s.inputBar, { paddingBottom: Math.max(insets.bottom || 0, 12) }]}>
            <IconButton 
              icon="image-outline" 
              iconColor={theme.textMuted} 
              size={24} 
              onPress={pickImage} 
              style={s.attachBtn} 
            />
            <TextInput
              mode="outlined"
              style={s.input}
              placeholder={t('messages.type_message', 'Message...')}
              placeholderTextColor={theme.textMuted}
              value={text}
              onChangeText={handleTextChange}
              multiline
              maxLength={1000}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              outlineStyle={{ borderRadius: 24, borderColor: theme.border }}
              textColor={theme.text}
              theme={{ colors: { background: theme.background } }}
            />
            <IconButton
              icon="send"
              iconColor="#fff"
              size={20}
              onPress={handleSend}
              disabled={!text.trim() && !image}
              style={[s.sendBtn, (!text.trim() && !image) && { opacity: 0.4 }]}
              containerColor={theme.primary}
            />
          </Surface>
        </Surface>
      </KeyboardResponsiveView>
    </SafeAreaView>
  );
};

const getStyles = (theme, paperTheme, insets) => ({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.surface,
    elevation: 2,
  },
  headerAvContainer: { position: 'relative', marginRight: 12 },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#22c55e', borderColor: theme.surface, borderWidth: 2,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  headerName: { fontSize: 17, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
  headerStatus: { fontSize: 12, color: theme.textMuted, marginTop: 1, fontWeight: '500' },
  connBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    marginRight: 16,
  },
  connDot: { width: 7, height: 7, borderRadius: 3.5 },
  connText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  msgList: { paddingHorizontal: 16, paddingVertical: 20, flexGrow: 1 },
  msgRow: { marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
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
  msgTime: { color: theme.textMuted, marginTop: 4, fontWeight: '600', paddingHorizontal: 8 },
  msgImage: { borderRadius: 18, marginBottom: 6 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.textMuted, marginHorizontal: 2 },
  imagePreview: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  previewImg: { width: 60, height: 60, borderRadius: 12 },
  removeImg: { position: 'absolute', top: -10, right: -10, backgroundColor: '#fff', borderRadius: 12 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: theme.border,
    gap: 12,
  },
  attachBtn: { 
    width: 44, height: 44, borderRadius: 22, 
    backgroundColor: theme.background, 
    borderWidth: 1, borderColor: theme.border,
    margin: 0, marginBottom: 4,
  },
  input: {
    flex: 1, fontSize: 16,
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
    margin: 0, marginBottom: 4,
  },
});

export default ChatBox;
