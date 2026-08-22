import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// React Native's Image is used on purpose: expo-image's native view fails to
// instantiate on some Android devices and would leave stories blank.
import {
  Image,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dayjs from '../utils/dayjs';
import { useAuthContext } from '../context/AuthProvider';
import { deleteStory, getStoryViewers, markStoryViewed, sendMessage } from '../api/endpoints';
import { logHandledError, showError, showSuccess } from '../utils/feedback';
import { useAppSelector } from '../store/hooks';
import { useStoryFrame } from '../hooks/useStoryFrame';
import StoryOverlayAnchor from './story/StoryOverlayAnchor';
import { MESSAGE_ICON } from '../config/icons';
import type { PublicUser, Story, StoryViewer as StoryViewerEntry } from '@motionmeet/shared';
import type { NavigationLike } from '../navigation/types';

/** How long a photo stays on screen before the viewer advances. */
const STORY_DURATION = 5000;
const PROGRESS_TICK = 50;

interface StoryVideoProps {
  source: string;
  paused: boolean;
  onEnded: () => void;
}

interface StoryViewerProps {
  visible: boolean;
  stories?: Story[];
  startIndex?: number;
  onClose: () => void;
  navigation?: NavigationLike;
  /** Called after the author deletes the story that is on screen. */
  onDeleted?: (storyId: string) => void;
}

const StoryVideo = ({ source, paused, onEnded }: StoryVideoProps) => {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
    instance.play();
  });

  useEffect(() => {
    const subscription = player.addListener('playToEnd', onEnded);
    return () => subscription.remove();
  }, [onEnded, player]);

  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      // Cover, not contain: a story fills the screen edge to edge on every
      // aspect ratio rather than sitting inside letterbox bars.
      contentFit="cover"
      nativeControls={false}
      surfaceType="textureView"
      accessibilityLabel="Story video"
    />
  );
};

/**
 * The story viewer.
 *
 * Playback pauses whenever something is layered over the story — the audience
 * sheet, the reply box, a long press — so the frame never advances out from
 * under whatever the viewer is reading or typing.
 */
const StoryViewer = ({
  visible,
  stories = [],
  startIndex = 0,
  onClose,
  navigation,
  onDeleted,
}: StoryViewerProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { frameWidth, frameHeight, onFrameLayout } = useStoryFrame();
  const { getToken } = useAuthContext();
  const currentUser = useAppSelector((state) => state.user.value);

  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [heldDown, setHeldDown] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerEntry[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replyFocused, setReplyFocused] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIndexRef = useRef(startIndex);
  const closingRef = useRef(false);
  const recordedViewsRef = useRef<Set<string>>(new Set());

  const currentStory = stories[currentIndex];
  const storyUser: PublicUser | null =
    currentStory && typeof currentStory.user === 'object' ? currentStory.user : null;
  const storyOwnerId = storyUser?._id ?? (typeof currentStory?.user === 'string' ? currentStory.user : '');
  const isOwnStory = Boolean(currentUser?._id && storyOwnerId === currentUser._id);
  const paused = viewersOpen || replyFocused || heldDown || sendingReply;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const closeViewer = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    clearTimer();
    Keyboard.dismiss();
    setViewersOpen(false);
    setReply('');
    setReplyFocused(false);
    onClose?.();
  }, [clearTimer, onClose]);

  const goNext = useCallback(() => {
    if (!visible || closingRef.current) return;
    clearTimer();
    const nextIndex = currentIndexRef.current + 1;
    if (nextIndex < stories.length) {
      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
      setProgress(0);
    } else {
      closeViewer();
    }
  }, [clearTimer, closeViewer, stories.length, visible]);

  const goPrev = useCallback(() => {
    if (!visible || closingRef.current) return;
    clearTimer();
    const previousIndex = currentIndexRef.current - 1;
    if (previousIndex >= 0) {
      currentIndexRef.current = previousIndex;
      setCurrentIndex(previousIndex);
    }
    // Tapping back on the first story restarts it rather than closing.
    setProgress(0);
  }, [clearTimer, visible]);

  // Reset when the viewer opens on a new group.
  useEffect(() => {
    if (!visible) {
      clearTimer();
      return;
    }
    const initialIndex = Math.min(Math.max(startIndex, 0), Math.max(stories.length - 1, 0));
    closingRef.current = false;
    currentIndexRef.current = initialIndex;
    setCurrentIndex(initialIndex);
    setProgress(0);
    setViewersOpen(false);
    setReply('');
  }, [clearTimer, startIndex, stories.length, visible]);

  // Opening someone else's story counts as a view exactly once per session.
  useEffect(() => {
    const storyId = currentStory?._id;
    if (!visible || !storyId || isOwnStory || recordedViewsRef.current.has(storyId)) return;
    recordedViewsRef.current.add(storyId);
    void (async () => {
      try {
        const token = await getToken();
        if (token) await markStoryViewed(storyId, token);
      } catch (error) {
        logHandledError('mark-story-viewed', error);
      }
    })();
  }, [currentStory?._id, getToken, isOwnStory, visible]);

  // Photo timer. Videos advance on their own `playToEnd`.
  useEffect(() => {
    clearTimer();
    if (!visible || paused || !currentStory || currentStory.media_type === 'video') return;

    const step = 100 / (STORY_DURATION / PROGRESS_TICK);
    intervalRef.current = setInterval(() => {
      setProgress((previous) => {
        const next = previous + step;
        if (next >= 100) {
          clearTimer();
          // Advancing inside the tick would set state during another
          // component's render, so it is deferred to the next frame.
          setTimeout(goNext, 0);
          return 100;
        }
        return next;
      });
    }, PROGRESS_TICK);

    return clearTimer;
  }, [clearTimer, currentIndex, currentStory, goNext, paused, visible]);

  const openViewers = useCallback(async () => {
    const storyId = currentStory?._id;
    if (!storyId || !isOwnStory) return;
    setViewersOpen(true);
    setViewers([]);
    setViewersLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getStoryViewers(storyId, token);
      if (data.success) setViewers(data.viewers || []);
    } catch (error) {
      logHandledError('load-story-viewers', error);
    } finally {
      setViewersLoading(false);
    }
  }, [currentStory?._id, getToken, isOwnStory]);

  // The responder is built once, so it reads the latest handler from a ref.
  const openViewersRef = useRef(openViewers);
  openViewersRef.current = openViewers;
  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          gesture.dy < -12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy < -28 || gesture.vy < -0.5) void openViewersRef.current();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  const openProfile = useCallback(
    (userId?: string) => {
      if (!navigation || !userId) return;
      closeViewer();
      navigation.navigate('Profile', { userId });
    },
    [closeViewer, navigation],
  );

  /** Carries on the conversation in the inbox rather than in the story frame. */
  const openChat = useCallback(() => {
    if (!navigation || !storyOwnerId) return;
    closeViewer();
    navigation.navigate('ChatBox', { userId: storyOwnerId, user: storyUser });
  }, [closeViewer, navigation, storyOwnerId, storyUser]);

  /**
   * Replies to the story as a direct message.
   *
   * The heart passes its emoji straight in rather than typing it into the box:
   * a reaction is one tap in every story app, and making it a two-step edit
   * would be the odd behaviour here.
   */
  const sendReply = async (override?: string) => {
    const text = (override ?? reply).trim();
    if (!text || !storyOwnerId || sendingReply) return;
    try {
      setSendingReply(true);
      const token = await getToken();
      if (!token) return;
      const result = await sendMessage({ to_user_id: storyOwnerId, text }, token);
      if (result.success) {
        if (!override) setReply('');
        Keyboard.dismiss();
        showSuccess(t('common.success'), t('story.reply_sent', 'Yanitin gonderildi'));
      } else {
        showError(t('common.error'), t('story.reply_failed', 'Yanit gonderilemedi'));
      }
    } catch (error) {
      logHandledError('story-reply', error);
      showError(t('common.error'), t('story.reply_failed', 'Yanit gonderilemedi'));
    } finally {
      setSendingReply(false);
    }
  };

  const removeStory = async () => {
    const storyId = currentStory?._id;
    if (!storyId) return;
    try {
      const token = await getToken();
      if (!token) return;
      const data = await deleteStory(storyId, token);
      if (!data.success) {
        showError(t('common.error'), data.message || t('story.delete_failed', 'Hikaye silinemedi'));
        return;
      }
      onDeleted?.(storyId);
      closeViewer();
    } catch (error) {
      logHandledError('delete-story', error);
      showError(t('common.error'), t('story.delete_failed', 'Hikaye silinemedi'));
    }
  };

  if (!visible || !currentStory) return null;

  const mediaUrl = typeof currentStory.media_url === 'string' ? currentStory.media_url.trim() : '';
  const overlays = Array.isArray(currentStory.overlays) ? currentStory.overlays : [];
  const profilePicture =
    typeof storyUser?.profile_picture === 'string' ? storyUser.profile_picture.trim() : '';
  const displayName = storyUser?.full_name || storyUser?.username || 'MotionMeet';
  const backgroundColor = currentStory.background_color || '#101014';
  // Comfortably over half the story, so the audience list is a list rather
  // than a strip peeking above the bottom edge.
  const viewersSheetHeight = Math.round(frameHeight * 0.72);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      presentationStyle="fullScreen"
      hardwareAccelerated
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={closeViewer}
    >
      <View style={styles.container}>
        <View style={[styles.storyContent, { backgroundColor }]} onLayout={onFrameLayout}>
          {currentStory.media_type === 'image' && mediaUrl && (
            <Image
              source={{ uri: mediaUrl }}
              style={StyleSheet.absoluteFill}
              // Cover keeps the story full-bleed: no bars on the sides of a
              // wide phone, none above and below a tall one.
              resizeMode="cover"
              accessibilityLabel={displayName}
            />
          )}
          {currentStory.media_type === 'video' && mediaUrl && (
            <StoryVideo
              key={currentStory._id || mediaUrl}
              source={mediaUrl}
              paused={paused}
              onEnded={goNext}
            />
          )}
          {/* Text-only stories predate the overlay composer and still render. */}
          {(currentStory.media_type === 'text' || !mediaUrl) && Boolean(currentStory.content) && (
            <Text
              style={[
                styles.legacyText,
                { marginTop: insets.top + 44, marginBottom: insets.bottom + 16 },
              ]}
              numberOfLines={10}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              {currentStory.content}
            </Text>
          )}

          {overlays.map((overlay) => (
            <StoryOverlayAnchor
              key={overlay.id}
              overlay={overlay}
              frameWidth={frameWidth}
              frameHeight={frameHeight}
            />
          ))}
        </View>

        {/* Progress bars — one per story in the group */}
        <View style={[styles.progressRow, { top: Math.max(insets.top + 8, 16) }]} pointerEvents="none">
          {stories.map((story, index) => (
            <View key={story._id || index} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      index < currentIndex
                        ? '100%'
                        : index === currentIndex
                          ? `${Math.min(progress, 100)}%`
                          : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Tap zones: left restarts or steps back, right advances. Holding
            anywhere pauses, which is the gesture people already use. */}
        <View style={styles.tapAreas} pointerEvents="box-none" {...swipeResponder.panHandlers}>
          <Pressable
            style={styles.tapLeft}
            onPress={goPrev}
            onLongPress={() => setHeldDown(true)}
            onPressOut={() => setHeldDown(false)}
            delayLongPress={220}
            accessibilityRole="button"
            accessibilityLabel={t('story.previous', 'Onceki hikaye')}
          />
          <Pressable
            style={styles.tapRight}
            onPress={goNext}
            onLongPress={() => setHeldDown(true)}
            onPressOut={() => setHeldDown(false)}
            delayLongPress={220}
            accessibilityRole="button"
            accessibilityLabel={t('story.next', 'Sonraki hikaye')}
          />
        </View>

        {/* Header */}
        <View style={[styles.header, { top: Math.max(insets.top + 22, 34) }]} pointerEvents="box-none">
          <Pressable
            style={styles.userInfo}
            onPress={() => openProfile(storyOwnerId)}
            disabled={!navigation || !storyOwnerId}
            accessibilityRole="button"
            accessibilityLabel={displayName}
          >
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarPlaceholderText}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.userText}>
              <Text numberOfLines={1} style={styles.userName}>
                {displayName}
              </Text>
              <Text style={styles.timeAgo}>{dayjs(currentStory.createdAt).fromNow()}</Text>
            </View>
          </Pressable>

          {isOwnStory && (
            <Pressable
              onPress={removeStory}
              hitSlop={12}
              style={styles.headerAction}
              accessibilityRole="button"
              accessibilityLabel={t('story.delete', 'Hikayeyi sil')}
            >
              <Ionicons name="trash-outline" size={21} color="#FFFFFF" />
            </Pressable>
          )}

          <Pressable
            onPress={closeViewer}
            hitSlop={14}
            style={styles.headerAction}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Kapat')}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Author: how many people opened it. Everyone else: reply and react. */}
        {!viewersOpen && isOwnStory && (
          <Pressable
            onPress={openViewers}
            style={[styles.viewersHandle, { paddingBottom: Math.max(insets.bottom, 14) }]}
            accessibilityRole="button"
            accessibilityLabel={t('feed.story_viewers', 'Goruntuleyenler')}
          >
            <Ionicons name="chevron-up" size={18} color="#FFFFFF" />
            <Text style={styles.viewersHandleText}>
              {typeof currentStory.view_count === 'number'
                ? `${currentStory.view_count} ${t('feed.story_views_count', 'goruntulenme')}`
                : t('feed.swipe_up_viewers', 'Goruntuleyenler icin yukari kaydir')}
            </Text>
          </Pressable>
        )}

        {!viewersOpen && !isOwnStory && (
          <View
            style={[styles.replyBar, { paddingBottom: Math.max(insets.bottom, 12) }]}
            pointerEvents="box-none"
          >
            <View style={styles.replyField}>
              <TextInput
                value={reply}
                onChangeText={setReply}
                onFocus={() => setReplyFocused(true)}
                onBlur={() => setReplyFocused(false)}
                placeholder={t('story.reply_placeholder', 'Mesaj gonder...')}
                placeholderTextColor="rgba(255,255,255,0.65)"
                style={styles.replyInput}
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={() => void sendReply()}
                editable={!sendingReply}
              />
            </View>

            {reply.trim().length > 0 ? (
              <Pressable
                onPress={() => void sendReply()}
                disabled={sendingReply}
                style={styles.replyAction}
                accessibilityRole="button"
                accessibilityLabel={t('story.send_reply', 'Gonder')}
              >
                {sendingReply ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Ionicons name="paper-plane" size={22} color="#FFFFFF" />
                )}
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={() => void sendReply('❤️')}
                  disabled={sendingReply}
                  style={styles.replyAction}
                  accessibilityRole="button"
                  accessibilityLabel={t('story.react', 'Begen')}
                >
                  <Ionicons name="heart-outline" size={25} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  onPress={openChat}
                  style={styles.replyAction}
                  accessibilityRole="button"
                  accessibilityLabel={t('story.send_message', 'Mesaj gonder')}
                >
                  <Ionicons name={MESSAGE_ICON} size={23} color="#FFFFFF" />
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Audience sheet — deliberately over two thirds of the screen so the
            list is readable instead of a strip at the bottom. */}
        {viewersOpen && (
          <View style={styles.viewersSheet}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setViewersOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={t('common.close', 'Kapat')}
            />
            <View
              style={[
                styles.viewersPanel,
                { height: viewersSheetHeight, paddingBottom: Math.max(insets.bottom, 12) },
              ]}
            >
              <Pressable
                onPress={() => setViewersOpen(false)}
                hitSlop={12}
                style={styles.viewersGrabberHit}
                accessibilityRole="button"
                accessibilityLabel={t('common.close', 'Kapat')}
              >
                <View style={styles.viewersGrabber} />
              </Pressable>

              <Text style={styles.viewersTitle}>
                {t('feed.story_viewers', 'Bu hikayeyi goruntuleyenler')}
                {viewers.length ? ` · ${viewers.length}` : ''}
              </Text>

              {viewersLoading ? (
                <ActivityIndicator color="#FFFFFF" style={styles.viewersSpinner} />
              ) : viewers.length === 0 ? (
                <Text style={styles.viewersEmpty}>
                  {t('feed.story_no_viewers', 'Henuz kimse goruntulemedi')}
                </Text>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {viewers.map((entry) => {
                    const picture =
                      typeof entry.user.profile_picture === 'string'
                        ? entry.user.profile_picture.trim()
                        : '';
                    return (
                      <Pressable
                        key={`${entry.user._id}-${entry.viewedAt}`}
                        style={styles.viewerRow}
                        onPress={() => openProfile(entry.user._id)}
                        disabled={!navigation}
                        accessibilityRole="button"
                        accessibilityLabel={entry.user.full_name || entry.user.username}
                      >
                        {picture ? (
                          <Image source={{ uri: picture }} style={styles.viewerAvatar} />
                        ) : (
                          <View style={[styles.viewerAvatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarPlaceholderText}>
                              {(entry.user.full_name || entry.user.username || '?')
                                .charAt(0)
                                .toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.viewerText}>
                          <Text numberOfLines={1} style={styles.viewerName}>
                            {entry.user.full_name || entry.user.username}
                          </Text>
                          <Text numberOfLines={1} style={styles.viewerHandle}>
                            @{entry.user.username} · {dayjs(entry.viewedAt).fromNow()}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.35)" />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  storyContent: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  legacyText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    fontSize: 30,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingHorizontal: 36,
    lineHeight: 42,
  },
  progressRow: {
    position: 'absolute',
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  tapAreas: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 20,
  },
  tapLeft: { width: '32%', height: '100%' },
  tapRight: { flex: 1, height: '100%' },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 4,
    zIndex: 30,
    elevation: 30,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 10,
  },
  userText: { flex: 1, minWidth: 0 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#312E81',
  },
  avatarPlaceholderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timeAgo: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  headerAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewersHandle: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    alignItems: 'center',
    gap: 2,
    zIndex: 25,
  },
  viewersHandleText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  replyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 10,
    zIndex: 25,
  },
  replyField: {
    flex: 1,
    minWidth: 0,
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 23,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  replyInput: {
    color: '#FFFFFF',
    fontSize: 14.5,
    padding: 0,
  },
  replyAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewersSheet: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 50,
    elevation: 50,
  },
  viewersPanel: {
    backgroundColor: '#14171B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  viewersGrabberHit: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 30,
  },
  viewersGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  viewersTitle: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 10,
  },
  viewersSpinner: {
    marginVertical: 28,
  },
  viewersEmpty: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 30,
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 9,
  },
  viewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  viewerText: { flex: 1, minWidth: 0 },
  viewerName: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  viewerHandle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 1,
  },
});

export default StoryViewer;
