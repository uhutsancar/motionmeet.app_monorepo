import React, { useState, useEffect, useRef, useCallback } from 'react';
// React Native's Image is used on purpose: expo-image's native view fails to
// instantiate on some Android devices and would leave stories blank.
import {
  Modal,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  View,
  StyleSheet,
} from 'react-native';
import { ActivityIndicator, Surface, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import dayjs from '../utils/dayjs';
import { useAuthContext } from '../context/AuthProvider';
import { getStoryViewers, markStoryViewed } from '../api/endpoints';
import { logHandledError } from '../utils/feedback';
import { AVATAR } from '../config/layout';
import { useAppSelector } from '../store/hooks';

import type { PublicUser, Story, StoryViewer as StoryViewerEntry } from '@motionmeet/shared';

const STORY_DURATION = 5000; // 5 seconds per story

interface StoryVideoProps { source: string; onEnded: () => void }
interface StoryViewerProps {
  visible: boolean;
  stories?: Story[];
  startIndex?: number;
  onClose: () => void;
}

const StoryVideo = ({ source, onEnded }: StoryVideoProps) => {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
    instance.play();
  });

  useEffect(() => {
    const subscription = player.addListener('playToEnd', onEnded);
    return () => subscription.remove();
  }, [onEnded, player]);

  return (
    <VideoView
      player={player}
      style={styles.mediaImage}
      contentFit="contain"
      nativeControls={false}
      surfaceType="textureView"
      accessibilityLabel="Story video"
    />
  );
};

/**
 * Instagram-style StoryViewer
 * Props:
 *   visible: boolean
 *   stories: array of story objects from same user (or all stories)
 *   startIndex: which index to start from
 *   onClose: () => void
 */
const StoryViewer = ({ visible, stories = [], startIndex = 0, onClose }: StoryViewerProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextFrameRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIndexRef = useRef(startIndex);
  const closingRef = useRef(false);
  const { getToken } = useAuthContext();
  const currentUser = useAppSelector((state) => state.user.value);

  const currentStory = stories[currentIndex];
  const storyOwnerId = typeof currentStory?.user === 'object' ? currentStory.user._id : currentStory?.user;
  const isOwnStory = Boolean(currentUser?._id && storyOwnerId === currentUser._id);

  // Swipe-up audience sheet, shown to the author of the story only.
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerEntry[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const recordedViewsRef = useRef<Set<string>>(new Set());

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

  // The responder is created once, so it reads the latest handler from a ref.
  const openViewersRef = useRef(openViewers);
  openViewersRef.current = openViewers;
  const swipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_event, gesture) =>
        gesture.dy < -12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy < -28 || gesture.vy < -0.5) void openViewersRef.current();
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const clearPlaybackTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (nextFrameRef.current) clearTimeout(nextFrameRef.current);
    intervalRef.current = null;
    nextFrameRef.current = null;
  }, []);

  const closeViewer = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    clearPlaybackTimers();
    currentIndexRef.current = startIndex;
    setCurrentIndex(startIndex);
    setProgress(0);
    onClose?.();
  }, [clearPlaybackTimers, onClose, startIndex]);

  // Reset when opening
  useEffect(() => {
    if (visible) {
      const initialIndex = Math.min(
        Math.max(startIndex, 0),
        Math.max(stories.length - 1, 0),
      );
      closingRef.current = false;
      currentIndexRef.current = initialIndex;
      setCurrentIndex(initialIndex);
      setProgress(0);
    } else {
      clearPlaybackTimers();
    }
  }, [clearPlaybackTimers, startIndex, stories.length, visible]);

  const goNext = useCallback(() => {
    if (!visible || closingRef.current) return;
    clearPlaybackTimers();
    const nextIndex = currentIndexRef.current + 1;
    if (nextIndex < stories.length) {
      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
      setProgress(0);
    } else {
      closeViewer();
    }
  }, [clearPlaybackTimers, closeViewer, stories.length, visible]);

  const goPrev = useCallback(() => {
    if (!visible || closingRef.current) return;
    clearPlaybackTimers();
    const previousIndex = currentIndexRef.current - 1;
    if (previousIndex >= 0) {
      currentIndexRef.current = previousIndex;
      setCurrentIndex(previousIndex);
      setProgress(0);
    } else {
      // Instagram-style behavior: tapping left on the first story restarts it.
      setProgress(0);
    }
  }, [clearPlaybackTimers, visible]);

  // Progress timer per story. Reading the audience pauses playback so the
  // story does not advance out from under the list.
  useEffect(() => {
    if (!visible || viewersOpen || !currentStory || currentStory.media_type === 'video') return;

    setProgress(0);
    clearPlaybackTimers();

    const step = 100 / (STORY_DURATION / 50); // how much to increment each 50ms
    intervalRef.current = setInterval(() => {
      setProgress(prev => Math.min(prev + step, 100));
    }, 50);

    return clearPlaybackTimers;
  }, [clearPlaybackTimers, currentIndex, currentStory, viewersOpen, visible]);

  useEffect(() => {
    if (!visible || progress < 100 || currentStory?.media_type === 'video') return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    nextFrameRef.current = setTimeout(goNext, 0);
    return () => {
      if (nextFrameRef.current) clearTimeout(nextFrameRef.current);
    };
  }, [currentStory?.media_type, goNext, progress, visible]);

  if (!visible || !currentStory) return null;

  const backgroundColor = currentStory.background_color || '#4f46e5';
  const mediaUrl =
    typeof currentStory.media_url === 'string'
      ? currentStory.media_url.trim()
      : '';
  const storyUser: PublicUser | null = typeof currentStory.user === 'object'
    ? currentStory.user
    : null;
  const profilePicture =
    typeof storyUser?.profile_picture === 'string'
      ? storyUser.profile_picture.trim()
      : '';
  const displayName =
    storyUser?.full_name || storyUser?.username || 'MotionMeet';
  const avatarLabel = displayName.charAt(0).toUpperCase();

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
      <Surface elevation={0} style={styles.container}>
        {/* Story Background / Media */}
        <Surface elevation={0} style={[styles.storyContent, { backgroundColor }]}>
          {currentStory.media_type === 'image' && mediaUrl && (
            <Image
              source={{ uri: mediaUrl }}
              style={styles.mediaImage}
              // Matches the video behaviour: the whole frame stays visible on
              // every aspect ratio instead of being cropped or stretched.
              resizeMode="contain"
              accessibilityLabel={displayName}
            />
          )}
          {currentStory.media_type === 'video' && mediaUrl && (
            <StoryVideo
              key={currentStory._id || mediaUrl}
              source={mediaUrl}
              onEnded={goNext}
            />
          )}
          {(currentStory.media_type === 'text' || !mediaUrl) && currentStory.content && (
            <Text
              style={[
                styles.storyText,
                // Keeps text clear of the header row and the home indicator.
                { marginTop: insets.top + 44, marginBottom: insets.bottom + 16 },
              ]}
              numberOfLines={10}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
            >
              {currentStory.content}
            </Text>
          )}
        </Surface>

        {/* Progress Bars — one per story */}
        <Surface
          elevation={0}
          style={[styles.progressBarsRow, { top: Math.max(insets.top + 8, 16) }]}
        >
          {stories.map((_, i) => (
            <Surface elevation={0} key={i} style={[styles.progressBarBg, { flex: 1 }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width:
                      i < currentIndex
                        ? '100%'
                        : i === currentIndex
                        ? `${Math.min(progress, 100)}%`
                        : '0%',
                  },
                ]}
              />
            </Surface>
          ))}
        </Surface>

        {/* Tap Areas: left = previous/restart, right = next */}
        <View style={styles.tapAreas} pointerEvents="box-none" {...swipeResponder.panHandlers}>
          <Pressable
            style={styles.tapLeft}
            onPress={goPrev}
            accessibilityRole="button"
            accessibilityLabel="Previous story"
          />
          <Pressable
            style={styles.tapRight}
            onPress={goNext}
            accessibilityRole="button"
            accessibilityLabel="Next story"
          />
        </View>

        {/* Author-only: swipe-up handle showing how many people opened it */}
        {isOwnStory && !viewersOpen && (
          <Pressable
            onPress={openViewers}
            style={[styles.viewersHandle, { paddingBottom: Math.max(insets.bottom, 12) }]}
            accessibilityRole="button"
            accessibilityLabel={t('feed.story_viewers', 'Viewed by')}
          >
            <Ionicons name="chevron-up" size={18} color="#fff" />
            <Text style={styles.viewersHandleText}>
              {typeof currentStory.view_count === 'number'
                ? `${currentStory.view_count} ${t('feed.story_views_count', 'views')}`
                : t('feed.swipe_up_viewers', 'Swipe up for viewers')}
            </Text>
          </Pressable>
        )}

        {viewersOpen && (
          <View style={styles.viewersSheet}>
            <Pressable
              style={styles.viewersBackdrop}
              onPress={() => setViewersOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={t('common.close', 'Close')}
            />
            <Surface elevation={0} style={[styles.viewersPanel, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <View style={styles.viewersGrabber} />
              <Text style={styles.viewersTitle}>
                {t('feed.story_viewers', 'Viewed by')}
                {viewers.length ? ` · ${viewers.length}` : ''}
              </Text>

              {viewersLoading ? (
                <ActivityIndicator color="#fff" style={{ marginVertical: 24 }} />
              ) : viewers.length === 0 ? (
                <Text style={styles.viewersEmpty}>
                  {t('feed.story_no_viewers', 'No one has viewed this yet')}
                </Text>
              ) : (
                <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                  {viewers.map((entry) => {
                    const picture = typeof entry.user.profile_picture === 'string' ? entry.user.profile_picture.trim() : '';
                    return (
                      <View key={`${entry.user._id}-${entry.viewedAt}`} style={styles.viewerRow}>
                        {picture ? (
                          <Image source={{ uri: picture }} style={styles.viewerAvatar} />
                        ) : (
                          <View style={[styles.viewerAvatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarPlaceholderText}>
                              {(entry.user.full_name || entry.user.username || '?').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={styles.viewerName}>
                            {entry.user.full_name || entry.user.username}
                          </Text>
                          <Text numberOfLines={1} style={styles.viewerHandle}>
                            @{entry.user.username} · {dayjs(entry.viewedAt).fromNow()}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </Surface>
          </View>
        )}

        {/* Header */}
        <View
          style={[styles.header, { top: Math.max(insets.top + 20, 34) }]}
          pointerEvents="box-none"
        >
          <View style={styles.userInfo} pointerEvents="none">
            {profilePicture ? (
              <Image
                source={{ uri: profilePicture }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarPlaceholderText}>{avatarLabel}</Text>
              </View>
            )}
            <View style={styles.userText}>
              <Text numberOfLines={1} style={styles.userName}>{displayName}</Text>
              <Text style={styles.timeAgo}>{dayjs(currentStory.createdAt).fromNow()}</Text>
            </View>
          </View>
          <Pressable
            onPress={(event) => {
              event.stopPropagation?.();
              closeViewer();
            }}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Close')}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </View>
      </Surface>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  storyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  storyText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 36,
    lineHeight: 42,
    maxHeight: '72%',
  },
  // Progress bars row
  progressBarsRow: {
    position: 'absolute',
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  progressBarBg: {
    height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  // Header
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 30,
    elevation: 30,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 12,
  },
  userText: { flex: 1, minWidth: 0 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#312e81',
  },
  avatarPlaceholderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  timeAgo: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 40,
    elevation: 40,
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  // Tap areas
  tapAreas: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    zIndex: 20,
    elevation: 20,
  },
  tapLeft: {
    width: '35%',
    height: '100%',
  },
  tapRight: {
    flex: 1,
    height: '100%',
  },
  // Audience sheet
  viewersHandle: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    alignItems: 'center',
    gap: 2,
    zIndex: 25,
    elevation: 25,
  },
  viewersHandleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  viewersSheet: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 50,
    elevation: 50,
  },
  viewersBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  viewersPanel: {
    backgroundColor: '#14171B',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  viewersGrabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 10,
  },
  viewersTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  viewersEmpty: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 26,
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  viewerAvatar: {
    width: AVATAR.medium,
    height: AVATAR.medium,
    borderRadius: AVATAR.medium / 2,
  },
  viewerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  viewerHandle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 1,
  },
});

export default StoryViewer;
