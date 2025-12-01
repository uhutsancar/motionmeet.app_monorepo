import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';

const StoriesBar = ({ stories, onCreateStory, onStoryPress }) => {
  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Create Story Button */}
        <TouchableOpacity 
          style={styles.createStoryCard}
          onPress={onCreateStory}
        >
          <View style={styles.createStoryImageContainer}>
            <View style={styles.createStoryOverlay}>
              <Ionicons name="add" size={32} color="#fff" />
            </View>
          </View>
          <Text style={styles.createStoryText}>Create Story</Text>
        </TouchableOpacity>

        {/* Story Cards */}
        {stories.map((story) => (
          <TouchableOpacity 
            key={story._id}
            style={styles.storyCard}
            onPress={() => onStoryPress(story)}
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
              
              {/* User Avatar */}
              <View style={styles.avatarContainer}>
                <Image 
                  source={{ uri: story.user.profile_picture }}
                  style={styles.avatar}
                />
              </View>
            </View>
            
            {/* Username */}
            <Text style={styles.username} numberOfLines={1}>
              {story.user.username}
            </Text>
            
            {/* Timestamp */}
            <Text style={styles.timestamp}>
              {moment(story.createdAt).fromNow()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
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
  },
  createStoryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(79, 70, 229, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
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
  avatarContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderWidth: 3,
    borderColor: '#4f46e5',
    borderRadius: 20,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  username: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 6,
    textAlign: 'center',
  },
  timestamp: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
});

export default StoriesBar;
