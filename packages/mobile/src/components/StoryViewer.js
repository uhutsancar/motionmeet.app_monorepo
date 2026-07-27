import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Image, Pressable, View } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';
import 'moment/locale/tr';

const STORY_DURATION = 5000; // 5 seconds per story

const StoryVideo = ({ source, onEnded }) => {
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
const StoryViewer = ({ visible, stories = [], startIndex = 0, onClose }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);
  const nextFrameRef = useRef(null);
  const currentIndexRef = useRef(startIndex);
  const closingRef = useRef(false);

  const currentStory = stories[currentIndex];

  const clearPlaybackTimers = useCallback(() => {
    clearInterval(intervalRef.current);
    clearTimeout(nextFrameRef.current);
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

  // Progress timer per story
  useEffect(() => {
    if (!visible || !currentStory || currentStory.media_type === 'video') return;

    setProgress(0);
    clearPlaybackTimers();

    const step = 100 / (STORY_DURATION / 50); // how much to increment each 50ms
    intervalRef.current = setInterval(() => {
      setProgress(prev => Math.min(prev + step, 100));
    }, 50);

    return clearPlaybackTimers;
  }, [clearPlaybackTimers, currentIndex, currentStory, visible]);

  useEffect(() => {
    if (!visible || progress < 100 || currentStory?.media_type === 'video') return;
    clearInterval(intervalRef.current);
    nextFrameRef.current = setTimeout(goNext, 0);
    return () => clearTimeout(nextFrameRef.current);
  }, [currentStory?.media_type, goNext, progress, visible]);

  if (!visible || !currentStory) return null;

  const backgroundColor = currentStory.background_color || '#4f46e5';
  const mediaUrl =
    typeof currentStory.media_url === 'string'
      ? currentStory.media_url.trim()
      : '';
  const profilePicture =
    typeof currentStory.user?.profile_picture === 'string'
      ? currentStory.user.profile_picture.trim()
      : '';
  const displayName =
    currentStory.user?.full_name || currentStory.user?.username || 'MotionMeet';
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
              resizeMode="cover"
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
            <Text style={styles.storyText}>{currentStory.content}</Text>
          )}
        </Surface>

        {/* Progress Bars — one per story */}
        <Surface
          elevation={0}
          style={[styles.progressBarsRow, { top: Math.max(insets.top + 8, 16) }]}
        >
          {stories.map((_, i) => (
            <Surface elevation={0} key={i} style={[styles.progressBarBg, { flex: 1 }]}>
              <Surface elevation={0}
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
        <View style={styles.tapAreas} pointerEvents="box-none">
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
            <View>
              <Text style={styles.userName}>{displayName}</Text>
              <Text style={styles.timeAgo}>{moment(currentStory.createdAt).fromNow()}</Text>
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

const styles = {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
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
};

export default StoryViewer;
