import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import StoryViewer from './StoryViewer';

const StoriesBar = ({ onAddStory }) => {
  const { stories } = useSelector((state) => state.stories);
  const user = useSelector((state) => state.user.value);
  const [selectedStory, setSelectedStory] = useState(null);

  const handleStoryPress = (story) => {
    setSelectedStory(story);
  };

  return (
    <>
      <View style={styles.container}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Create Story Button */}
          <TouchableOpacity 
            style={styles.createStoryCard}
            onPress={onAddStory}
          >
            <View style={styles.createStoryImageContainer}>
              {user?.profile_picture ? (
                <>
                  <Image 
                    source={{ uri: user.profile_picture }}
                    style={styles.createStoryBg}
                  />
                  <View style={styles.createStoryOverlay}>
                    <View style={styles.addButton}>
                      <Ionicons name="add" size={24} color="#fff" />
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.createStoryOverlay}>
                  <Ionicons name="add" size={32} color="#fff" />
                </View>
              )}
            </View>
            <Text style={styles.createStoryText}>Your Story</Text>
          </TouchableOpacity>

          {/* Story Cards */}
          {stories
            .filter(story => story && story._id && story.user && story.user._id)
            .map((story) => (
            <TouchableOpacity 
              key={story._id}
              style={styles.storyCard}
              onPress={() => handleStoryPress(story)}
            >
              <View style={styles.storyImageContainer}>
                {story.media_type === 'text' ? (
                  <View style={[styles.textStory, { backgroundColor: story.background_color }]}>
                    <Text style={styles.textStoryContent} numberOfLines={3}>
                      {story.content}
                    </Text>
                  </View>
                ) : (
                  <Image 
                    source={{ uri: story.media_url }}
                    style={styles.storyImage}
                    resizeMode="cover"
                  />
                )}
                
                {/* User Avatar with Ring */}
                <View style={styles.avatarRing}>
                  <Image 
                    source={{ uri: story.user.profile_picture }}
                    style={styles.avatar}
                  />
                </View>
              </View>
              
              {/* Username */}
              <Text style={styles.username} numberOfLines={1}>
                {story.user.full_name?.split(' ')[0] || story.user.username}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Story Viewer */}
      <StoryViewer 
        visible={!!selectedStory}
        story={selectedStory}
        onClose={() => setSelectedStory(null)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  createStoryCard: {
    width: 110,
    alignItems: 'center',
  },
  createStoryImageContainer: {
    width: 110,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  createStoryBg: {
    width: '100%',
    height: '100%',
  },
  createStoryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  createStoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
  storyCard: {
    width: 110,
    alignItems: 'center',
  },
  storyImageContainer: {
    width: 110,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  textStory: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textStoryContent: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  avatarRing: {
    position: 'absolute',
    top: 8,
    left: 8,
    padding: 3,
    borderRadius: 22,
    background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)',
    borderWidth: 2,
    borderColor: '#4f46e5',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  username: {
    fontSize: 11,
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
  timestamp: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
});

export default StoriesBar;
