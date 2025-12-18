import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-expo';
import { fetchPosts } from '../features/posts/postsSlice';
import { fetchStories } from '../features/stories/storiesSlice';
import { fetchUser } from '../features/user/userSlice';
import { fetchConnections } from '../features/connections/connectionsSlice';
import StoriesBar from '../components/StoriesBar';
import PostCard from '../components/PostCard';
import CreatePostModal from '../components/CreatePostModal';
import StoryModal from '../components/StoryModal';
import Loading from '../components/Loading';

const Feed = ({ navigation }) => {
  const dispatch = useDispatch();
  const { getToken } = useAuth();
  const { stories, loading: storiesLoading } = useSelector((state) => state.stories);
  const { posts, loading: postsLoading } = useSelector((state) => state.posts);
  const user = useSelector((state) => state.user.value);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = await getToken();
      dispatch(fetchUser(token));
      dispatch(fetchStories(token));
      dispatch(fetchPosts(token));
      dispatch(fetchConnections(token));
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load feed');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleComment = (postId) => {
    Alert.alert('Comments', 'Comment feature coming soon!');
  };

  const handleShare = (post) => {
    Alert.alert('Share', `Share post by ${post.user.full_name}`);
  };

  const handleUserPress = (userId) => {
    navigation.navigate('Profile', { userId });
  };

  const handleCreatePost = () => {
    if (!user) {
      Alert.alert('Please wait', 'Loading user data...');
      return;
    }
    setShowCreatePost(true);
  };

  const handleCreateStory = () => {
    if (!user) {
      Alert.alert('Please wait', 'Loading user data...');
      return;
    }
    setShowStoryModal(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MotionMeet</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleCreatePost}
            disabled={!user}
          >
            <Ionicons name="add-circle-outline" size={24} color={user ? "#4f46e5" : "#9ca3af"} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stories Bar */}
        <StoriesBar onAddStory={handleCreateStory} />

        {/* Posts Feed */}
        <View style={styles.postsContainer}>
          {postsLoading && posts.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading posts...</Text>
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>Follow people to see their posts</Text>
            </View>
          ) : (
            posts
              .filter(post => post && post._id && post.user && post.user._id)
              .map((post) => (
                <PostCard 
                  key={post._id}
                  post={post}
                  onComment={handleComment}
                  onShare={handleShare}
                  onUserPress={handleUserPress}
                  navigation={navigation}
                />
              ))
          )}
        </View>
      </ScrollView>

      {/* Create Post Modal */}
      {showCreatePost && (
        <CreatePostModal 
          visible={showCreatePost}
          onClose={() => setShowCreatePost(false)}
          onSuccess={() => {
            setShowCreatePost(false);
            loadData();
          }}
        />
      )}

      {/* Story Modal */}
      <StoryModal 
        visible={showStoryModal}
        onClose={() => setShowStoryModal(false)}
        onSuccess={() => {
          setShowStoryModal(false);
          loadData();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 60,
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
    padding: 8,
    borderRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  postsContainer: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
  },
});

export default Feed;
