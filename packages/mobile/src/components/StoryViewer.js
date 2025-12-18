import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';

const { width, height } = Dimensions.get('window');

const StoryViewer = ({ visible, story, onClose }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!visible) return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          onClose();
          return 100;
        }
        return prev + 1;
      });
    }, 50); // 5 seconds total (100 * 50ms)

    return () => clearInterval(timer);
  }, [visible, onClose]);

  if (!story) return null;

  const backgroundColor = story.background_color || '#4f46e5';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Story Content */}
        <View style={[styles.storyContent, { backgroundColor }]}>
          {story.media_type === 'image' && story.media_url && (
            <Image
              source={{ uri: story.media_url }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          )}
          {story.media_type === 'video' && story.media_url && (
            <View style={styles.videoPlaceholder}>
              <Ionicons name="play-circle" size={64} color="#fff" />
            </View>
          )}
          {story.media_type === 'text' && (
            <Text style={styles.storyText}>{story.content}</Text>
          )}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Image
              source={{ uri: story.user.profile_picture }}
              style={styles.avatar}
            />
            <View>
              <Text style={styles.userName}>{story.user.full_name}</Text>
              <Text style={styles.timeAgo}>{moment(story.createdAt).fromNow()}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tap to Close/Navigate */}
        <View style={styles.tapAreas}>
          <TouchableOpacity
            style={styles.tapLeft}
            onPress={onClose}
            activeOpacity={1}
          />
          <TouchableOpacity
            style={styles.tapRight}
            onPress={onClose}
            activeOpacity={1}
          />
        </View>
      </View>
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
    width,
    height,
    position: 'absolute',
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  progressBarContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 8,
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  header: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  timeAgo: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  closeButton: {
    padding: 4,
  },
  tapAreas: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  tapLeft: {
    flex: 1,
  },
  tapRight: {
    flex: 1,
  },
});

export default StoryViewer;
