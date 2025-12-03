import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import StoriesBar from '../components/StoriesBar';
import PostCard from '../components/PostCard';
import CreatePostModal from '../components/CreatePostModal';
import { dummyStoriesData, dummyPostsData } from '../assets/dummyData';

const Feed = () => {
  const [stories, setStories] = useState(dummyStoriesData);
  const [posts, setPosts] = useState(dummyPostsData);
  const [showCreatePost, setShowCreatePost] = useState(false);

  const handleCreateStory = () => {
    Alert.alert('Create Story', 'Story creation feature coming soon!');
  };

  const handleStoryPress = (story) => {
    Alert.alert('Story Viewer', `Viewing story by ${story.user.username}`);
  };

  const handleLike = (postId) => {
    setPosts(prevPosts => 
      prevPosts.map(post => {
        if (post._id === postId) {
          const isLiked = post.likes_count.includes('current_user');
          return {
            ...post,
            likes_count: isLiked 
              ? post.likes_count.filter(id => id !== 'current_user')
              : [...post.likes_count, 'current_user']
          };
        }
        return post;
      })
    );
  };

  const handleComment = (postId) => {
    Alert.alert('Comments', 'Comment feature coming soon!');
  };

  const handleShare = (post) => {
    Alert.alert('Share', `Share post by ${post.user.username}`);
  };

  const handleUserPress = (user) => {
    Alert.alert('Profile', `View profile of ${user.username}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MotionMeet</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowCreatePost(true)}
          >
            <Ionicons name="add-circle-outline" size={24} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="search" size={24} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="notifications-outline" size={24} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Stories Bar */}
        <StoriesBar 
          stories={stories}
          onCreateStory={handleCreateStory}
          onStoryPress={handleStoryPress}
        />

        {/* Posts Feed */}
        <View style={styles.postsContainer}>
          {posts.map((post) => (
            <PostCard 
              key={post._id}
              post={post}
              onLike={handleLike}
              onComment={handleComment}
              onShare={handleShare}
              onUserPress={handleUserPress}
            />
          ))}
        </View>
      </ScrollView>

      {/* Create Post Modal */}
      <CreatePostModal 
        visible={showCreatePost}
        onClose={() => setShowCreatePost(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4f46e5',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  postsContainer: {
    paddingTop: 8,
  },
});

export default Feed;
