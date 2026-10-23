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

import { Avatar, Text, Surface, ActivityIndicator, useTheme as usePaperTheme, TouchableRipple } from 'react-native-paper';
import { getUserFacingError, showError } from '../utils/feedback';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { KeyboardResponsiveView } from '../components/KeyboardAwareScrollView';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
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
  navigation: { goBack: () => void; navigate?: (screen: string, params?: object) => void };
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
  // Instagram keeps a quarter of the row free beside the longest bubble, so a
  // reply never reads as a full-width block.
  const bubbleMaxWidth = Math.round((rowWidth - AVATAR_SLOT_WIDTH) * 0.78);
  const messageMediaWidth = Math.min(236, bubbleMaxWidth);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const s = getStyles(theme, paperTheme, insets);
  const keyboard = useKeyboardInset();

  const currentUser = useAppSelector((state) => state.user.value);
  const connections = useAppSelector((state) => state.connections.connections);
  const { messages } = useAppSelector((state) => state.messages);

  const { socket, connected, sendMessage: socketSend, emitTypingStart, emitTypingStop } = useSocket();

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

  // Opening the keyboard shrinks the list from the bottom; the latest messages
  // are brought back into view rather than left behind the composer.
  useEffect(() => {
    if (!keyboard.visible || messages.length === 0) return undefined;
    const timer = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(timer);
  }, [keyboard.visible, messages.length]);

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
    // Sent as it was taken, the way Instagram sends a photo: the forced 4:3
    // crop screen cut every portrait in half before it reached the chat.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: false, quality: 0.8,
    });
    if (!result.canceled) {
      setImage(result.assets[0]);
      pendingOperationIdRef.current = null;
      uploadCacheRef.current = null;
      // The preview row takes room above the field; keep the latest message
      // in view above it.
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
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

  /*
   * Messages are laid out the way Instagram's direct messages are: runs of
   * one sender sit 2pt apart with their inner corners tightened, a new sender
   * starts 10pt lower, and the time is a centred line between runs that are
   * half an hour apart rather than a stamp squeezed into every bubble. The
   * stamp is what broke long messages - it shared a wrapping row with the text,
   * so the text was measured against what the stamp left over.
   */
  const timeLabel = (iso: string | Date | undefined): string => {
    const at = dayjs(iso);
    if (at.isSame(dayjs(), 'day')) return `${t('messages.today', 'Bugün')} ${at.format('HH:mm')}`;
    if (at.isSame(dayjs().subtract(1, 'day'), 'day')) return `${t('messages.yesterday', 'Dün')} ${at.format('HH:mm')}`;
    return at.format(at.isSame(dayjs(), 'year') ? 'D MMM HH:mm' : 'D MMM YYYY HH:mm');
  };
  const lastMineIndex = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) if (isMine(messages[index])) return index;
    return -1;
  })();

  const renderMessage: ListRenderItem<Message> = ({ item: msg, index }) => {
    const mine = isMine(msg);
    const prevMsg = messages[index - 1];
    const nextMsg = messages[index + 1];
    const newTime = !prevMsg || dayjs(msg.createdAt).diff(dayjs(prevMsg.createdAt), 'minute') >= 30;
    const nextNewTime = !nextMsg || dayjs(nextMsg.createdAt).diff(dayjs(msg.createdAt), 'minute') >= 30;
    const joinsPrev = Boolean(prevMsg) && !newTime && isMine(prevMsg) === mine;
    const joinsNext = Boolean(nextMsg) && !nextNewTime && isMine(nextMsg) === mine;
    // The partner's picture sits beside the last message of their run.
    const showAvatar = !mine && !joinsNext;
    const hasMedia = msg.message_type === 'image' && Boolean(msg.media_url);
    const corners = mine
      ? { borderTopRightRadius: joinsPrev ? 6 : 20, borderBottomRightRadius: joinsNext ? 6 : 20 }
      : { borderTopLeftRadius: joinsPrev ? 6 : 20, borderBottomLeftRadius: joinsNext ? 6 : 20 };
    const onLongPress = mine ? () => handleDeleteMessage(msg._id) : undefined;

    return (
      <View>
        {newTime ? <Text style={s.timeDivider}>{timeLabel(msg.createdAt)}</Text> : null}
        <View style={[s.msgRow, mine ? s.msgRowRight : s.msgRowLeft, { marginTop: joinsPrev ? 2 : 10 }]}>
          {!mine && (
            <View style={s.avatarSlot}>
              {showAvatar ? <PartnerAvatar user={user} size={28} /> : null}
            </View>
          )}
          <View style={[s.msgColumn, { maxWidth: bubbleMaxWidth }, mine ? s.alignEnd : s.alignStart]}>
            {hasMedia && msg.media_url ? (
              <ChatPhoto
                uri={msg.media_url}
                width={messageMediaWidth}
                onPress={() => setViewerUri(msg.media_url)}
                onLongPress={onLongPress}
                label={t('common.photo', 'Fotoğraf')}
              />
            ) : null}
            {msg.text ? (
              <Pressable
                onLongPress={onLongPress}
                delayLongPress={350}
                style={({ pressed }) => [
                  s.bubble,
                  mine ? s.bubbleMine : s.bubbleTheirs,
                  corners,
                  hasMedia && { marginTop: 2 },
                  pressed && onLongPress ? { opacity: 0.85 } : null,
                ]}
              >
                <Text selectable style={[s.bubbleText, { color: mine ? '#FFFFFF' : theme.text }]}>
                  {msg.text}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        {index === lastMineIndex ? (
          <Text style={s.receipt}>
            {msg.seen ? t('messages.seen', 'Görüldü') : t('messages.sent', 'Gönderildi')}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderTyping = () => (
    <View style={[s.msgRow, s.msgRowLeft, { marginTop: 10 }]}>
      <View style={s.avatarSlot}>
        <PartnerAvatar user={user} size={28} />
      </View>
      <View style={[s.bubble, s.bubbleTheirs, { paddingVertical: 13 }]}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[s.typingDot, { opacity: 0.45 + i * 0.2 }]} />
          ))}
        </View>
      </View>
    </View>
  );

  const openProfile = () => {
    if (user?._id && navigation.navigate) navigation.navigate('Profile', { userId: user._id });
  };

  // An empty conversation introduces the person, as Instagram's does, instead
  // of leaving a blank screen above the composer.
  const renderEmpty = () => (
    <View style={s.emptyChat}>
      <PartnerAvatar user={user} size={88} />
      <Text style={s.emptyName} numberOfLines={1}>{user?.full_name || user?.username}</Text>
      <Text style={s.emptyHandle} numberOfLines={1}>@{user?.username} · MotionMeet</Text>
      {navigation.navigate ? (
        <Pressable onPress={openProfile} style={({ pressed }) => [s.emptyButton, pressed && { opacity: 0.7 }]} accessibilityRole="button">
          <Text style={s.emptyButtonLabel}>{t('messages.view_profile', 'Profili gör')}</Text>
        </Pressable>
      ) : null}
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
            <ActivityIndicator color={theme.textMuted} />
          )}
        </Surface>
      </SafeAreaView>
    );
  }

  const canSend = !sending && (Boolean(text.trim()) || Boolean(image));

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Back, then the person as one tappable group that opens their
          profile - where every messaging app people already use puts them. */}
      <View style={s.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={s.headerBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Geri')}
        >
          <Ionicons name="chevron-back" size={25} color={theme.text} />
        </Pressable>

        <Pressable
          onPress={openProfile}
          disabled={!navigation.navigate}
          style={({ pressed }) => [s.headerIdentity, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <PartnerAvatar user={user} size={32} />
          <View style={s.headerText}>
            <Text numberOfLines={1} style={s.headerName}>{user.full_name || user.username}</Text>
            {/* Presence is gone from here on purpose: a socket that reconnects
                a beat late made the header say "offline" while a message was
                still arriving. The handle is always true; typing is the only
                live state worth showing. */}
            <Text numberOfLines={1} style={s.headerStatus}>
              {partnerTyping ? t('messages.typing', 'yazıyor...') : `@${user.username}`}
            </Text>
          </View>
        </Pressable>
      </View>

      <KeyboardResponsiveView
        style={{ flex: 1 }}
        avoidOnAndroid
      >
        {initialLoading ? (
          <Surface elevation={0} style={s.loader}><ActivityIndicator color={theme.textMuted} /></Surface>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item, i) => item._id || String(i)}
            style={s.messageList}
            contentContainerStyle={s.msgList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            ListEmptyComponent={renderEmpty}
            ListHeaderComponent={
              nextCursor ? (
                <Pressable
                  onPress={loadOlderMessages}
                  disabled={loadingOlder}
                  style={{ alignSelf: 'center', padding: 10 }}
                  accessibilityRole="button"
                >
                  {loadingOlder
                    ? <ActivityIndicator size="small" color={theme.textMuted} />
                    : <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>{t('messages.load_older', 'Önceki mesajlar')}</Text>
                  }
                </Pressable>
              ) : null
            }
            ListFooterComponent={partnerTyping ? renderTyping : null}
          />
        )}

        {/* Instagram's composer: one soft pill holding the photo button, the
            field and a "Send" word that appears once there is something to
            send. The bottom padding clears the navigation bar only while the
            keyboard is down - with it up, that gap was a 48pt empty band
            between the field and the keys. */}
        <View style={[s.composer, { paddingBottom: keyboard.visible ? 8 : (insets.bottom || 0) + 8 }]}>
          {image && (
            <View style={s.previewRow}>
              <View>
                <Image source={{ uri: image.uri }} style={s.previewImg} />
                <Pressable
                  disabled={sending}
                  onPress={() => {
                    setImage(null);
                    pendingOperationIdRef.current = null;
                    uploadCacheRef.current = null;
                  }}
                  hitSlop={8}
                  style={s.removeImg}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.remove', 'Kaldır')}
                >
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          )}
          <View style={s.inputPill}>
            <Pressable
              onPress={pickImage}
              disabled={sending}
              style={({ pressed }) => [s.attachBtn, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityLabel={t('feed.select_media', 'Select media')}
            >
              <Ionicons name="image" size={17} color="#FFFFFF" />
            </Pressable>
            {/* A plain RN input: Paper's outlined field ignored maxHeight once
                multiline, so a long draft grew the field instead of scrolling. */}
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
            {sending ? (
              <ActivityIndicator size="small" color={theme.primary} style={s.sendSlot} />
            ) : canSend ? (
              <Pressable
                onPress={handleSend}
                hitSlop={6}
                style={({ pressed }) => [s.sendSlot, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={t('messages.send', 'Gönder')}
              >
                <Text style={s.sendLabel}>{t('messages.send', 'Gönder')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </KeyboardResponsiveView>

      <MediaViewer uri={viewerUri} onClose={() => setViewerUri(null)} />
    </SafeAreaView>
  );
};

/** The partner's picture, or their initial on a grey disc. */
const PartnerAvatar = ({ user, size }: { user: PublicUser | UserProfile | null; size: number }) => {
  const { theme } = useTheme();
  if (user?.profile_picture) return <Avatar.Image source={{ uri: user.profile_picture }} size={size} />;
  return (
    <Avatar.Text
      label={(user?.full_name || user?.username || '?').charAt(0).toUpperCase()}
      size={size}
      style={{ backgroundColor: theme.surfaceLight }}
      color={theme.textSecondary}
      labelStyle={{ fontWeight: '500', fontSize: Math.round(size * 0.42) }}
    />
  );
};

interface ChatPhotoProps {
  uri: string;
  width: number;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
}

/**
 * A photo in a conversation at its own shape. The old frame cropped every
 * picture to a fixed landscape box, so a portrait photo lost its top and
 * bottom; the ratio is read when the image loads and held between a tall
 * portrait and a wide panorama so one odd file cannot take over the thread.
 */
const ChatPhoto = ({ uri, width, label, onPress, onLongPress }: ChatPhotoProps) => {
  const { theme } = useTheme();
  const [ratio, setRatio] = useState(1.25);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
      style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
    >
      <Image
        source={{ uri }}
        onLoad={(event) => {
          const { width: w, height: h } = event.nativeEvent.source ?? {};
          if (w && h) setRatio(Math.min(1.6, Math.max(0.6, h / w)));
        }}
        style={{ width, height: Math.round(width * ratio), borderRadius: 18, backgroundColor: theme.surfaceLight }}
        resizeMode="cover"
      />
    </Pressable>
  );
};

const getStyles = (theme: MotionTheme, _paperTheme: MD3Theme, _insets: EdgeInsets) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingRight: 12,
    backgroundColor: theme.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  headerBack: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { fontSize: 15, fontWeight: '600', color: theme.text },
  headerStatus: { fontSize: 12, color: theme.textMuted },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  messageList: { width: '100%', maxWidth: MESSAGE_LIST_MAX_WIDTH, alignSelf: 'center' },
  msgList: {
    width: '100%',
    paddingHorizontal: MESSAGE_LIST_PADDING,
    paddingTop: 8,
    paddingBottom: 12,
    flexGrow: 1,
  },
  timeDivider: {
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 4,
    fontSize: 11.5,
    color: theme.textMuted,
    fontVariant: ['tabular-nums'],
  },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  avatarSlot: { width: AVATAR_SLOT_WIDTH, alignItems: 'flex-start' },
  msgColumn: { flexShrink: 1 },
  alignEnd: { alignItems: 'flex-end' },
  alignStart: { alignItems: 'flex-start' },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  bubbleMine: { backgroundColor: theme.primary },
  bubbleTheirs: { backgroundColor: theme.surfaceLight },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  receipt: {
    alignSelf: 'flex-end',
    marginTop: 3,
    marginRight: 4,
    fontSize: 11.5,
    color: theme.textMuted,
  },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.textMuted, marginHorizontal: 1 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 4 },
  emptyName: { marginTop: 10, fontSize: 17, fontWeight: '700', color: theme.text },
  emptyHandle: { fontSize: 13, color: theme.textMuted },
  emptyButton: {
    marginTop: 14,
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    backgroundColor: theme.surfaceLight,
  },
  emptyButtonLabel: { fontSize: 13.5, fontWeight: '600', color: theme.text },
  composer: {
    width: '100%',
    maxWidth: MESSAGE_LIST_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: MESSAGE_LIST_PADDING,
    paddingTop: 6,
    backgroundColor: theme.background,
  },
  previewRow: { flexDirection: 'row', paddingHorizontal: 4, paddingBottom: 8 },
  previewImg: { width: 56, height: 56, borderRadius: 10, backgroundColor: theme.surfaceLight },
  removeImg: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  inputPill: {
    // minWidth:0 lets the pill shrink inside the row on narrow screens.
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: COMPOSER_MIN_HEIGHT + 2,
    paddingLeft: 5,
    paddingRight: 6,
    borderRadius: (COMPOSER_MIN_HEIGHT + 2) / 2,
    backgroundColor: theme.surfaceLight,
  },
  attachBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginBottom: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
  },
  input: {
    flex: 1, minWidth: 0,
    color: theme.text,
    fontSize: 15,
    minHeight: COMPOSER_MIN_HEIGHT + 2,
    maxHeight: COMPOSER_MAX_HEIGHT,
    paddingTop: 12, paddingBottom: 12, paddingHorizontal: 10,
    ...Platform.select({ android: { textAlignVertical: 'top' as const } }),
  },
  sendSlot: { height: COMPOSER_MIN_HEIGHT + 2, justifyContent: 'center', paddingHorizontal: 8 },
  sendLabel: { fontSize: 15, fontWeight: '600', color: theme.primary },
});

export default ChatBox;
