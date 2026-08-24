import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FlatList,
  Image,
  Alert,
  Pressable,
  Platform,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
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

import { Avatar, Text, IconButton, Surface, ActivityIndicator, useTheme as usePaperTheme, TouchableRipple } from 'react-native-paper';
import { getUserFacingError, showError } from '../utils/feedback';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { KeyboardResponsiveView } from '../components/KeyboardAwareScrollView';
import MediaViewer from '../components/MediaViewer';
import { ensureMediaLibraryPermission } from '../utils/permissions';
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

/**
 * Bubble geometry is measured in points, not percentages.
 *
 * A percentage `maxWidth` resolves against whichever box the parent happened to
 * measure the row with, and inside the nested auto-width rows of a chat list
 * that box is not the visible row - short messages were handed a few dozen
 * points and broke mid-word ("Nabe / rsin"). These constants mirror the list
 * styles below so the same numbers drive layout and maths on every screen.
 */
const MESSAGE_LIST_MAX_WIDTH = 720;
const MESSAGE_LIST_PADDING = 12;
/** Avatar column reserved on the partner's side, including its gutter. */
const AVATAR_SLOT_WIDTH = 34;
/**
 * A photo in a conversation is not put in a frame.
 *
 * The bubble used to pad the picture and draw a border round it, which read as
 * a card with a photo inside rather than as the photo itself. The picture now
 * runs to the bubble's own rounded edge, and the timestamp floats over the
 * corner of it the way every chat app does it.
 */
const MEDIA_BUBBLE_PADDING = 0;
/** The composer grows to roughly five lines, then scrolls inside its pill. */
const COMPOSER_MIN_HEIGHT = 42;
const COMPOSER_MAX_HEIGHT = 124;

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
  const { usableWidth } = useResponsiveLayout();
  const rowWidth = Math.max(
    220,
    Math.min(usableWidth, MESSAGE_LIST_MAX_WIDTH) - MESSAGE_LIST_PADDING * 2,
  );
  const bubbleMaxWidth = Math.round((rowWidth - AVATAR_SLOT_WIDTH) * 0.92);
  const messageMediaWidth = Math.min(264, bubbleMaxWidth - MEDIA_BUBBLE_PADDING * 2);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
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
    // Refusing once never disables the button: it asks again the next time, and
    // only a permanent block sends the member to the OS settings instead.
    const permission = await ensureMediaLibraryPermission();
    if (!permission.granted) {
      if (permission.outcome === 'denied') {
        showError(
          t('common.error', 'Error'),
          t('feed.permission_required_media', 'We need permission to access your media'),
        );
      }
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
    } catch (error) {
      // A private account that requires a mutual follow answers 403 with a
      // reason, and saying so beats a flat "message could not be sent".
      showError(
        t('common.error', 'Hata'),
        getUserFacingError(error, t('messages.send_failed', 'Mesaj gönderilemedi')),
      );
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

    const hasMedia = msg.message_type === 'image' && Boolean(msg.media_url);

    return (
      // Plain views on purpose: Paper's Surface splits a style across two nested
      // layers on iOS, so `maxWidth` and `alignItems` land on different boxes and
      // the bubble ends up measured against the wrong parent.
      <View style={[s.msgRow, mine ? s.msgRowRight : s.msgRowLeft]}>
        {!mine && (
          <View style={s.avatarSlot}>
            {showAvatar && user?.profile_picture
              ? <Avatar.Image source={{ uri: user.profile_picture }} size={28} />
              : null}
          </View>
        )}
        <TouchableRipple
          style={[
            s.bubble,
            { maxWidth: bubbleMaxWidth },
            hasMedia ? s.bubbleMedia : s.bubblePlain,
            mine ? s.bubbleMine : s.bubbleTheirs,
            // A photo is the message. It keeps the bubble's rounded corner but
            // loses its outline, and with no caption to sit on it loses the
            // plate behind it too.
            hasMedia && s.bubbleMediaFrameless,
            hasMedia && !msg.text && s.bubbleMediaBare,
          ]}
          onLongPress={mine ? () => handleDeleteMessage(msg._id) : undefined}
          rippleColor="rgba(0, 0, 0, .1)"
        >
          <View>
            {hasMedia && msg.media_url ? (
              <Pressable
                onPress={() => setViewerUri(msg.media_url)}
                accessibilityRole="imagebutton"
                accessibilityLabel={t('common.photo', 'Fotoğraf')}
              >
                <Image
                  source={{ uri: msg.media_url }}
                  style={[
                    s.msgImage,
                    { width: messageMediaWidth, height: Math.round(messageMediaWidth * 0.82) },
                  ]}
                  resizeMode="cover"
                />
                {/* A picture with no caption carries its own stamp, so the
                    bubble does not have to grow a strip underneath it just to
                    hold the time. */}
                {!msg.text && (
                  <View style={s.mediaStamp}>
                    <Text style={s.mediaStampText}>
                      {dayjs(msg.createdAt).format('HH:mm')}
                      {mine ? (msg.seen ? ' ✓✓' : ' ✓') : ''}
                    </Text>
                  </View>
                )}
              </Pressable>
            ) : null}
            {/* Text and stamp share one wrapping row. A short message keeps the
                stamp beside it on a single line; a long one pushes the stamp to
                its own line, which is how the chat apps people know behave. */}
            <View
              style={[
                s.bubbleBody,
                hasMedia && s.bubbleBodyWithMedia,
                hasMedia && !msg.text && s.bubbleBodyHidden,
              ]}
            >
              {msg.text ? (
                <Text
                  style={[
                    s.bubbleText,
                    // With an image above, the bubble is already as wide as the
                    // photo, so the caption fills the line and keeps the stamp
                    // pinned right instead of both floating over there together.
                    hasMedia && s.bubbleTextWithMedia,
                    { color: mine ? '#FFFFFF' : theme.text },
                  ]}
                >
                  {msg.text}
                </Text>
              ) : null}
              <Text
                style={[
                  s.bubbleMeta,
                  { color: mine ? 'rgba(255,255,255,0.72)' : theme.textMuted },
                ]}
              >
                {dayjs(msg.createdAt).format('HH:mm')}
                {mine ? (msg.seen ? ' ✓✓' : ' ✓') : ''}
              </Text>
            </View>
          </View>
        </TouchableRipple>
      </View>
    );
  };

  const renderTyping = () => (
    <View style={[s.msgRow, s.msgRowLeft]}>
      <View style={s.avatarSlot}>
        {user?.profile_picture
          ? <Avatar.Image source={{ uri: user.profile_picture }} size={28} />
          : null}
      </View>
      <View style={[s.bubble, s.bubblePlain, s.bubbleTheirs, { paddingVertical: 12 }]}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[s.typingDot, { opacity: 0.5 + i * 0.2 }]} />
          ))}
        </View>
      </View>
    </View>
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

      {/* A plain row rather than Appbar.Header.
          Appbar.Content lays its title out against whatever sits on either
          side of it, so with a back button and an avatar on the left and
          nothing on the right the name drifted off centre while its subtitle
          lined up against a different edge again. Here the avatar and the name
          are one group that starts where the back button ends, which is also
          where every messaging app people already use puts them. */}
      <View style={s.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={s.headerBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Geri')}
        >
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>

        <View style={s.headerIdentity}>
          <View style={s.headerAvContainer}>
            {user.profile_picture
              ? <Avatar.Image source={{ uri: user.profile_picture }} size={38} />
              : <Avatar.Text
                  label={(user.full_name || user.username || '?').charAt(0).toUpperCase()}
                  size={38}
                  style={{ backgroundColor: theme.primarySoft }}
                  labelStyle={{ color: theme.primary, fontWeight: '800' }}
                />
            }
            {isOnline && <View style={s.onlineDot} />}
          </View>
          <View style={s.headerText}>
            <Text numberOfLines={1} style={s.headerName}>{user.full_name || user.username}</Text>
            <Text numberOfLines={1} style={s.headerStatus}>
              {isOnline ? t('status.online') : t('status.offline')}
            </Text>
          </View>
        </View>
      </View>

      <KeyboardResponsiveView
        style={{ flex: 1 }}
        avoidOnAndroid
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
            <View style={s.imagePreview}>
              <View style={s.previewMedia}>
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
              </View>
            </View>
          )}
          <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom || 0, 10) }]}>
            {/* A plain RN input inside our own pill. Paper's outlined field
                manages its own height and ignored maxHeight once multiline, so
                a long draft grew the field instead of scrolling inside it. */}
            <View style={s.inputPill}>
              <IconButton
                icon="image-outline"
                iconColor={theme.textMuted}
                size={22}
                onPress={pickImage}
                disabled={sending}
                style={s.attachBtn}
                accessibilityLabel={t('feed.select_media', 'Select media')}
              />
              <TextInput
                style={s.input}
                placeholder={t('messages.type_message', 'Message...')}
                placeholderTextColor={theme.textMuted}
                value={text}
                onChangeText={handleTextChange}
                editable={!sending}
                multiline
                scrollEnabled
                maxLength={CONTENT_LIMITS.message}
                keyboardAppearance={isDark ? 'dark' : 'light'}
                underlineColorAndroid="transparent"
                accessibilityLabel={t('messages.type_message', 'Message...')}
              />
            </View>
            <IconButton
              icon="send"
              iconColor="#fff"
              size={20}
              onPress={handleSend}
              disabled={sending || (!text.trim() && !image)}
              style={[s.sendBtn, (sending || (!text.trim() && !image)) && { opacity: 0.4 }]}
              containerColor={theme.primary}
            />
          </View>
        </Surface>
      </KeyboardResponsiveView>

      <MediaViewer uri={viewerUri} onClose={() => setViewerUri(null)} />
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme, _paperTheme: MD3Theme, _insets: EdgeInsets) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingRight: 12,
    backgroundColor: theme.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  headerBack: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  // Avatar and name travel together, so the two lines share one left edge.
  headerIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvContainer: { position: 'relative' },
  headerText: { flex: 1, minWidth: 0 },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: theme.success, borderColor: theme.background, borderWidth: 2,
  },
  headerName: { fontSize: 16, fontWeight: '800', color: theme.text, letterSpacing: -0.3 },
  headerStatus: { fontSize: 12, color: theme.textMuted, marginTop: 1, fontWeight: '500' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageList: { width: '100%', maxWidth: MESSAGE_LIST_MAX_WIDTH, alignSelf: 'center' },
  msgList: {
    width: '100%',
    paddingHorizontal: MESSAGE_LIST_PADDING,
    paddingVertical: 16,
    flexGrow: 1,
  },
  msgRow: { marginBottom: 8, flexDirection: 'row', alignItems: 'flex-end' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  avatarSlot: { width: 28, marginRight: AVATAR_SLOT_WIDTH - 28 },
  bubble: {
    flexShrink: 1,
    borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  bubblePlain: { paddingHorizontal: 12, paddingVertical: 7 },
  bubbleMedia: { padding: MEDIA_BUBBLE_PADDING },
  bubbleMediaFrameless: { borderWidth: 0, overflow: 'hidden' },
  bubbleMediaBare: { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 },
  bubbleMine: {
    backgroundColor: theme.primary,
    borderBottomRightRadius: 5,
  },
  bubbleTheirs: {
    backgroundColor: theme.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border,
    borderBottomLeftRadius: 5,
  },
  // flexWrap keeps the stamp beside a short message and drops it below a long
  // one; flexShrink on the text is what lets the line break instead of the row.
  bubbleBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  bubbleBodyWithMedia: { paddingHorizontal: 10, paddingTop: 5, paddingBottom: 4 },
  bubbleBodyHidden: { display: 'none' },
  bubbleText: { flexShrink: 1, fontSize: 15.5, lineHeight: 21, fontWeight: '500' },
  bubbleTextWithMedia: { flexGrow: 1 },
  bubbleMeta: { fontSize: 10.5, lineHeight: 18, marginLeft: 8, fontWeight: '600' },
  msgImage: { borderRadius: 18 },
  /* The stamp rides on the photo rather than under it, over a soft scrim so it
     stays readable on a light picture without needing a bar of its own. */
  mediaStamp: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  mediaStampText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.textMuted, marginHorizontal: 2 },
  imagePreview: {
    width: '100%', maxWidth: MESSAGE_LIST_MAX_WIDTH, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  previewMedia: { width: 60, height: 60, position: 'relative' },
  previewImg: { width: 60, height: 60, borderRadius: 12 },
  removeImg: { position: 'absolute', top: -14, right: -14, backgroundColor: theme.surface, borderRadius: 12 },
  inputBar: {
    width: '100%', maxWidth: MESSAGE_LIST_MAX_WIDTH, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: MESSAGE_LIST_PADDING, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border,
    gap: 8,
  },
  inputPill: {
    // minWidth:0 lets the pill shrink inside the row instead of pushing the
    // send button off narrow screens.
    flex: 1, minWidth: 0,
    flexDirection: 'row', alignItems: 'flex-end',
    minHeight: COMPOSER_MIN_HEIGHT + 4,
    paddingLeft: 2, paddingRight: 8,
    borderRadius: (COMPOSER_MIN_HEIGHT + 4) / 2,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border,
    backgroundColor: theme.background,
  },
  attachBtn: { width: 34, height: 34, margin: 0, marginBottom: 4, marginLeft: 2 },
  input: {
    flex: 1, minWidth: 0,
    color: theme.text,
    fontSize: 15.5,
    minHeight: COMPOSER_MIN_HEIGHT,
    maxHeight: COMPOSER_MAX_HEIGHT,
    paddingTop: 11, paddingBottom: 11, paddingHorizontal: 4,
    ...Platform.select({ android: { textAlignVertical: 'top' as const } }),
  },
  sendBtn: {
    width: COMPOSER_MIN_HEIGHT + 4, height: COMPOSER_MIN_HEIGHT + 4,
    borderRadius: (COMPOSER_MIN_HEIGHT + 4) / 2,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
    margin: 0,
  },
});

export default ChatBox;
