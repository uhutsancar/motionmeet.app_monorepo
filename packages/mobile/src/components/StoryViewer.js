import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Image, Dimensions, Animated } from 'react-native';
import { Surface, TouchableRipple, Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/tr';

const { width, height } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5 seconds per story

/**
 * Instagram-style StoryViewer
 * Props:
 *   visible: boolean
 *   stories: array of story objects from same user (or all stories)
 *   startIndex: which index to start from
 *   onClose: () => void
 */
const StoryViewer = ({ visible, stories = [], startIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);

  const currentStory = stories[currentIndex];

  // Reset when opening
  useEffect(() => {
    if (visible) {
      setCurrentIndex(startIndex);
      setProgress(0);
    }
  }, [visible, startIndex]);

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      // All stories done
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  // Progress timer per story
  useEffect(() => {
    if (!visible || !currentStory) return;

    setProgress(0);
    clearInterval(intervalRef.current);

    const step = 100 / (STORY_DURATION / 50); // how much to increment each 50ms
    intervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(intervalRef.current);
          goNext();
          return 0;
        }
        return prev + step;
      });
    }, 50);

    return () => clearInterval(intervalRef.current);
  }, [visible, currentIndex, currentStory]);

  if (!visible || !currentStory) return null;

  const backgroundColor = currentStory.background_color || '#4f46e5';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <Surface elevation={0} style={styles.container}>
        {/* Story Background / Media */}
        <Surface elevation={0} style={[styles.storyContent, { backgroundColor }]}>
          {currentStory.media_type === 'image' && currentStory.media_url && (
            <Image
              source={{ uri: currentStory.media_url }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          )}
          {currentStory.media_type === 'video' && currentStory.media_url && (
            <Surface elevation={0} style={styles.videoPlaceholder}>
              <Ionicons name="play-circle" size={72} color="#fff" />
            </Surface>
          )}
          {(currentStory.media_type === 'text' || !currentStory.media_url) && currentStory.content && (
            <Text style={styles.storyText}>{currentStory.content}</Text>
          )}
        </Surface>

        {/* Progress Bars — one per story */}
        <Surface elevation={0} style={styles.progressBarsRow}>
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

        {/* Header */}
        <Surface elevation={0} style={styles.header}>
          <Surface elevation={0} style={styles.userInfo}>
            <Image
              source={{ uri: currentStory.user?.profile_picture }}
              style={styles.avatar}
            />
            <Surface elevation={0}>
              <Text style={styles.userName}>{currentStory.user?.full_name}</Text>
              <Text style={styles.timeAgo}>{moment(currentStory.createdAt).fromNow()}</Text>
            </Surface>
          </Surface>
          <TouchableRipple borderless onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableRipple>
        </Surface>

        {/* Tap Areas: left = prev, right = next */}
        <Surface elevation={0} style={styles.tapAreas} pointerEvents="box-none">
          <TouchableRipple borderless
            style={styles.tapLeft}
            onPress={goPrev}
            activeOpacity={1}
          />
          <TouchableRipple borderless
            style={styles.tapRight}
            onPress={goNext}
            activeOpacity={1}
          />
        </Surface>
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
    width,
    height,
    position: 'absolute',
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
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
    top: 56,
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
    top: 68,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
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
    padding: 6,
  },
  // Tap areas
  tapAreas: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    zIndex: 5,
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
