import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FlatList, Image, Alert, StatusBar, StyleSheet, View, type ListRenderItem } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthContext } from "../context/AuthProvider";
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../hooks/useSocket';
import {
  deleteMessage,
  getMessages,
  getUserProfile,
  markMessageSeen,
  sendMessage as sendMessageHTTP,
} from '../api/endpoints';
import { uploadMedia } from '../api/mediaUpload';
import {
  setMessages,
  addMessage,
  markMessagesSeenByUser,
  prependMessages,
  removeMessage,
} from '../features/messages/messagesSlice';
import dayjs from '../utils/dayjs';

import { Appbar, Avatar, Text, TextInput, IconButton, Surface, ActivityIndicator, Badge, useTheme as usePaperTheme, TouchableRipple } from 'react-native-paper';
import { showError } from '../utils/feedback';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { KeyboardResponsiveView } from '../components/KeyboardAwareScrollView';
import { CONTENT_LIMITS, createOperationId } from '@motionmeet/shared';
import type { Message, PublicUser, UserProfile } from '@motionmeet/shared';
import type { ImagePickerAsset } from 'expo-image-picker';
import type { MD3Theme } from 'react-native-paper';
import type { MotionTheme } from '../context/ThemeContext';
import { useAppDispatch, useAppSelector } from '../store/hooks';

interface ChatBoxProps {
  route?: { params?: { userId?: string; user?: PublicUser | UserProfile } };
  navigation: { goBack: () => void };
}
interface UploadCache { signature: string; key: string }

const entityId = (value: Message['from_user_id']): string =>
  typeof value === 'string' ? value : value._id;

const ChatBox = ({ route, navigation }: ChatBoxProps) => {
  const { userId, user: routeUser } = route?.params || {};
  const { getToken } = useAuthContext();

  const dispatch = useAppDispatch();
  const { theme, isDark } = useTheme();
  const paperTheme = usePaperTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { contentWidth } = useResponsiveLayout();
  const messageMediaWidth = Math.max(80, Math.min(220, contentWidth * 0.72));
  const s = getStyles(theme, paperTheme, insets);

  const currentUser = useAppSelector((state) => state.user.value);
  const connections = useAppSelector((state) => state.connections.connections);
  const { messages } = useAppSelector((state) => state.messages);

  const { socket, connected, onlineUsers, sendMessage: socketSend, emitTypingStart, emitTypingStop } = useSocket();

  const [text, setText] = useState('');
  const [image, setImage] = useState<ImagePickerAsset | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [user, setUser] = useState<PublicUser | UserProfile | null>(routeUser ?? null);
  const [partnerLoadFailed, setPartnerLoadFailed] = useState(false);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList<Message> | null>(null);
  const typingRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const skipAutoScrollRef = useRef(false);
  const typingActiveRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingDraftRef = useRef('');
  const pendingOperationIdRef = useRef<string | null>(null);
  const uploadCacheRef = useRef<UploadCache | null>(null);

  useEffect(() => {
    if (!user && connections.length > 0) {
      setUser(connections.find((connection) => connection._id === userId) ?? null);
    }
  }, [connections, userId, user]);

  useEffect(() => {
    if (user || !userId || partnerLoadFailed) return undefined;
    let cancelled = false;
    const loadPartner = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const data = await getUserProfile(userId, token);
        if (!cancelled && data.success) setUser(data.profile);
      } catch {
        if (!cancelled) {
          setPartnerLoadFailed(true);
          showError(
            t('common.error', 'Error'),
            t('messages.user_load_failed', 'Conversation user could not be loaded'),
          );
        }
      }
    };
    void loadPartner();
    return () => {
      cancelled = true;
    };
  }, [getToken, partnerLoadFailed, t, user, userId]);

  useEffect(() => {
    if (!userId) {
      setInitialLoading(false);
      return undefined;
    }

    setInitialLoading(true);
    dispatch(setMessages([]));
    setNextCursor(null);
    let cancelled = false;
    const load = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const data = await getMessages(userId, token);
        if (!cancelled && data.success) {
          dispatch(setMessages(data.messages));
          setNextCursor(data.nextCursor);
        }
      } catch (_error) {
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

    const onMsg = (msg: Message) => {
      const fromId = entityId(msg.from_user_id);
      if (fromId === userId) {
        dispatch(addMessage(msg));
        setPartnerTyping(false);
        getToken()
          .then((token) => token && userId ? markMessageSeen(userId, token) : null)
          .catch(() => undefined);
      }
    };

    const onSent = (msg: Message) => {
      const recipientId = entityId(msg.to_user_id);
      if (recipientId !== userId) return;
      clearTimeout(sendTimeoutRef.current);
      pendingDraftRef.current = '';
      pendingOperationIdRef.current = null;
      setSending(false);
      dispatch(addMessage(msg));
    };

    const onTypStart = ({ from_user_id }: { from_user_id: string }) => { if (from_user_id === userId) setPartnerTyping(true); };
    const onTypStop = ({ from_user_id }: { from_user_id: string }) => { if (from_user_id === userId) setPartnerTyping(false); };
    const onDeleted = ({ messageId }: { messageId: string }) => dispatch(removeMessage(messageId));
    const onMessageError = ({ message, operationId }: { message: string; operationId: string }) => {
      if (
        operationId &&
        operationId !== pendingOperationIdRef.current
      ) return;
      clearTimeout(sendTimeoutRef.current);
      setText((current) => current || pendingDraftRef.current);
      pendingDraftRef.current = '';
      setSending(false);
      showError(t('common.error', 'Error'), message || t('messages.send_failed', 'Failed to send message'));
    };
    const onMessagesSeen = ({ by_user_id: byUserId }: { by_user_id: string }) => {
      if (byUserId === userId) dispatch(markMessagesSeenByUser(byUserId));
    };

    socket.on('message_received', onMsg);
    socket.on('message_sent', onSent);
    socket.on('typing_start', onTypStart);
    socket.on('typing_stop', onTypStop);
    socket.on('message_deleted', onDeleted);
    socket.on('message_error', onMessageError);
    socket.on('messages_seen', onMessagesSeen);

    return () => {
      socket.off('message_received', onMsg);
      socket.off('message_sent', onSent);
      socket.off('typing_start', onTypStart);
      socket.off('typing_stop', onTypStop);
      socket.off('message_deleted', onDeleted);
      socket.off('message_error', onMessageError);
      socket.off('messages_seen', onMessagesSeen);
    };
  }, [dispatch, getToken, socket, t, userId]);

  useEffect(() => () => {
    clearTimeout(typingRef.current);
    clearTimeout(scrollTimeoutRef.current);
    clearTimeout(sendTimeoutRef.current);
    if (userId) emitTypingStop(userId);
  }, [emitTypingStop, userId]);

  useEffect(() => {
    if (messages.length > 0) {
      if (skipAutoScrollRef.current) {
        skipAutoScrollRef.current = false;
        return;
      }
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [messages, partnerTyping]);

  const loadOlderMessages = useCallback(async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const token = await getToken();
      if (!token || !userId) throw new Error('Authentication required');
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

  const handleTextChange = (val: string) => {
    setText(val);
    pendingOperationIdRef.current = null;
    if (val.trim() && !typingActiveRef.current) {
      typingActiveRef.current = true;
      if (userId) emitTypingStart(userId);
    }
    if (!val.trim() && typingActiveRef.current) {
      typingActiveRef.current = false;
      if (userId) emitTypingStop(userId);
    }
    clearTimeout(typingRef.current);
    if (val.trim()) {
      typingRef.current = setTimeout(() => {
        typingActiveRef.current = false;
        if (userId) emitTypingStop(userId);
      }, 1500);
    }
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
    if (!result.canceled) {
      setImage(result.assets[0]);
      pendingOperationIdRef.current = null;
      uploadCacheRef.current = null;
    }
  };

  const handleSend = useCallback(async () => {
    if ((!text.trim() && !image) || sending) return;
    if (!userId) return;
    emitTypingStop(userId);
    typingActiveRef.current = false;
    const operationId = pendingOperationIdRef.current ||= createOperationId('message');

    if (
      !image &&
      connected &&
      socketSend(userId, text.trim(), operationId)
    ) {
      pendingDraftRef.current = text.trim();
      setSending(true);
      setText('');
      clearTimeout(sendTimeoutRef.current);
      sendTimeoutRef.current = setTimeout(() => {
        setText((current) => current || pendingDraftRef.current);
        pendingDraftRef.current = '';
        setSending(false);
        showError(
          t('common.error', 'Error'),
          t('messages.send_failed', 'Failed to send message'),
        );
      }, 15_000);
      return;
    }

    try {
      setSending(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const mediaSignature = image
        ? `${image.assetId || image.uri}:${image.fileSize || 0}`
        : '';
      let uploadedKey = uploadCacheRef.current?.signature === mediaSignature
        ? uploadCacheRef.current.key
        : undefined;
      if (image && !uploadedKey) {
        const uploadedImageKey = await uploadMedia(image, 'messages', token);
        uploadedKey = uploadedImageKey;
        uploadCacheRef.current = { signature: mediaSignature, key: uploadedImageKey };
      }
      const data = await sendMessageHTTP({
        operationId,
        to_user_id: userId,
        text: text.trim(),
        uploadedKey,
      }, token);
      if (data.success) {
        dispatch(addMessage(data.message));
        setText('');
        setImage(null);
        pendingOperationIdRef.current = null;
        uploadCacheRef.current = null;
      } else {
        throw new Error(data.message || 'Failed to send message');
      }
    } catch {
      showError(t('common.error', 'Error'), t('messages.send_failed', 'Failed to send message'));
    }
    finally {
      setSending(false);
    }
  }, [connected, dispatch, emitTypingStop, getToken, image, sending, socketSend, text, t, userId]);

  const isMine = (msg: Message): boolean => {
    const fromId = entityId(msg.from_user_id);
    return fromId === currentUser?._id;
  };

  const handleDeleteMessage = (msgId: string) => {
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
              if (!token) throw new Error('Authentication required');
              const data = await deleteMessage(msgId, token);
              if (data.success) {
                dispatch(removeMessage(msgId));
              } else {
                showError(t('common.error', 'Error'), data.message || t('messages.delete_failed', 'Failed to delete message'));
              }
            } catch (_err) {
              showError(t('common.error', 'Error'), t('messages.delete_failed', 'Failed to delete message'));
            }
          } 
        }
      ]
    );
  };

  const renderMessage: ListRenderItem<Message> = ({ item: msg, index }) => {
    const mine = isMine(msg);
    const prevMsg = messages[index - 1];
    const showAvatar = !mine && (!prevMsg || isMine(prevMsg));

    return (
      <Surface elevation={0} style={[s.msgRow, mine ? s.msgRowRight : s.msgRowLeft]}>
        {!mine && (
          <Surface elevation={0} style={{ width: 28, marginRight: 6 }}>
            {showAvatar && user?.profile_picture
              ? <Avatar.Image source={{ uri: user.profile_picture }} size={28} />
              : <View style={{ width: 28 }} />
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
            {dayjs(msg.createdAt).format('HH:mm')}
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
            <View key={i} style={[s.typingDot, { opacity: 0.5 + i * 0.2 }]} />
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

  if (!user) {
    return (
      <SafeAreaView style={s.container}>
        <Surface elevation={0} style={s.loader}>
          {partnerLoadFailed ? (
            <>
              <Text style={{ color: theme.textMuted }}>
                {t('messages.user_load_failed', 'Conversation user could not be loaded')}
              </Text>
              <TouchableRipple onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
                <Text style={{ color: theme.primary }}>{t('common.back', 'Back')}</Text>
              </TouchableRipple>
            </>
          ) : (
            <ActivityIndicator color={theme.primary} />
          )}
        </Surface>
      </SafeAreaView>
    );
  }

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
              <View style={[s.statusDot, { backgroundColor: isOnline ? '#22c55e' : '#94a3b8' }]} />
              <Text style={s.headerStatus}>
                {isOnline ? t('status.online') : t('status.offline')}
              </Text>
            </Surface>
          }
        />
        <Surface style={[s.connBadge, { backgroundColor: connected ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }]} elevation={0}>
          <View style={[s.connDot, { backgroundColor: connected ? '#22c55e' : '#ef4444' }]} />
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
            style={s.messageList}
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
              <Surface elevation={0} style={s.previewMedia}>
                <Image source={{ uri: image.uri }} style={s.previewImg} />
                <IconButton
                  icon="close-circle"
                  iconColor="#ef4444"
                  size={24}
                  disabled={sending}
                  onPress={() => {
                    setImage(null);
                    pendingOperationIdRef.current = null;
                    uploadCacheRef.current = null;
                  }}
                  style={s.removeImg}
                />
              </Surface>
            </Surface>
          )}
          <Surface elevation={0} style={[s.inputBar, { paddingBottom: Math.max(insets.bottom || 0, 12) }]}>
            <IconButton 
              icon="image-outline" 
              iconColor={theme.textMuted} 
              size={24} 
              onPress={pickImage} 
              disabled={sending}
              style={s.attachBtn} 
            />
            <TextInput
              mode="outlined"
              dense
              style={s.input}
              contentStyle={{ paddingHorizontal: 12 }}
              placeholder={t('messages.type_message', 'Message...')}
              placeholderTextColor={theme.textMuted}
              value={text}
              onChangeText={handleTextChange}
              editable={!sending}
              multiline
              maxLength={CONTENT_LIMITS.message}
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
              disabled={sending || (!text.trim() && !image)}
              style={[s.sendBtn, (sending || (!text.trim() && !image)) && { opacity: 0.4 }]}
              containerColor={theme.primary}
            />
          </Surface>
        </Surface>
      </KeyboardResponsiveView>
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme, _paperTheme: MD3Theme, _insets: EdgeInsets) => StyleSheet.create({
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
  messageList: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  msgList: { width: '100%', paddingHorizontal: 16, paddingVertical: 20, flexGrow: 1 },
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
    width: '100%', maxWidth: 720, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  previewMedia: { width: 60, height: 60, position: 'relative' },
  previewImg: { width: 60, height: 60, borderRadius: 12 },
  removeImg: { position: 'absolute', top: -14, right: -14, backgroundColor: theme.surface, borderRadius: 12 },
  inputBar: {
    width: '100%', maxWidth: 720, alignSelf: 'center',
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
    // minWidth:0 lets the field shrink inside the row instead of pushing its
    // placeholder past the rounded outline on narrow screens.
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 42,
    paddingHorizontal: 4,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
    margin: 0, marginBottom: 4,
  },
});

export default ChatBox;
