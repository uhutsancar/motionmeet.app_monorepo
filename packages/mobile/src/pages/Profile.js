import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { fetchUser } from '../features/user/userSlice';
import { fetchPosts } from '../features/posts/postsSlice';
import { fetchConnections } from '../features/connections/connectionsSlice';
import UserProfileInfo from '../components/UserProfileInfo';
import PostCard from '../components/PostCard';
import ProfileEditModal from '../components/ProfileEditModal';
import Loading from '../components/Loading';
import { likePost, deletePost } from '../api/endpoints';
import moment from 'moment';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const Profile = ({ route }) => {
  const { signOut, getToken } = useAuth();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const currentUser = useSelector((state) => state.user.value);
  const allPosts = useSelector((state) => state.posts.posts);
  const loading = useSelector((state) => state.posts.loading);
  const [activeTab, setActiveTab] = useState('post');
  const [showEditModal, setShowEditModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [likedPosts, setLikedPosts] = useState([]);
  const [profileUser, setProfileUser] = useState(null);
  const [profilePosts, setProfilePosts] = useState([]);
  
  const userId = route?.params?.userId;
  const isOwnProfile = !userId || userId === currentUser?._id;
  const user = isOwnProfile ? currentUser : profileUser;
  const posts = isOwnProfile 
    ? allPosts.filter(post => post.user?._id === currentUser?._id)
    : profilePosts;

  // Show loading if user data is not loaded yet
  if (!user && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Loading />
      </SafeAreaView>
    );
  }

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    const token = await getToken();
    
    if (isOwnProfile) {
      dispatch(fetchUser(token));
      dispatch(fetchPosts(token));
      dispatch(fetchConnections(token));
    } else {
      // Load other user's profile
      try {
        const { getUserProfile } = await import('../api/endpoints');
        const data = await getUserProfile(userId);
        if (data.success) {
          setProfileUser(data.profile);
          setProfilePosts(data.posts);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to load profile');
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleEditProfile = () => {
    setShowEditModal(true);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleLike = async (postId) => {
    try {
      const token = await getToken();
      const data = await likePost(postId, token);
      
      if (data.success) {
        dispatch(fetchPosts(token));
        
        // Update liked posts list
        if (likedPosts.includes(postId)) {
          setLikedPosts(likedPosts.filter(id => id !== postId));
        } else {
          setLikedPosts([...likedPosts, postId]);
        }
      }
    } catch (error) {
      console.error('Like error:', error);
      Alert.alert('Error', 'Failed to like post');
    }
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

  const handleDeletePost = async (postId) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              const data = await deletePost(postId, token);
              
              if (data.success) {
                dispatch(fetchPosts(token));
                Alert.alert('Success', 'Post deleted successfully');
              }
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  // Get all images from posts
  const allImages = posts
    .filter(post => post.image_urls && post.image_urls.length > 0)
    .flatMap(post => 
      post.image_urls.map(url => ({
        url,
        postDate: post.createdAt
      }))
    );

  const imageSize = (SCREEN_WIDTH - 48) / 3;

  if (loading && !refreshing) {
    return <Loading />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Cover Photo */}
        <View style={styles.coverContainer}>
          {user?.cover_photo ? (
            <Image 
              source={{ uri: user.cover_photo }}
              style={styles.coverImage}
            />
          ) : (
            <View style={styles.coverGradient} />
          )}
        </View>

        {/* User Profile Info */}
        <UserProfileInfo 
          user={user}
          posts={posts}
          isOwnProfile={isOwnProfile}
          onEditPress={handleEditProfile}
          onConnectionsPress={() => navigation.navigate('Connections')}
        />

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <View style={styles.tabsWrapper}>
            {['post', 'media', 'likes'].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  activeTab === tab && styles.activeTab
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === tab && styles.activeTabText
                ]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sign Out Button */}
          {isOwnProfile && (
            <TouchableOpacity 
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Content */}
        <View style={styles.contentContainer}>
          {/* Posts Tab */}
          {activeTab === 'post' && (
            <View style={styles.postsContainer}>
              {posts.length > 0 ? (
                posts
                  .filter(post => post && post._id && post.user && post.user._id)
                  .map((post) => (
                    <PostCard 
                      key={post._id}
                      post={post}
                      onLike={handleLike}
                      onComment={handleComment}
                      onShare={handleShare}
                      onDelete={handleDeletePost}
                      showDelete={true}
                    />
                  ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={48} color="#d1d5db" />
                  <Text style={styles.emptyText}>No posts yet</Text>
                  <Text style={styles.emptySubtext}>Start sharing your thoughts!</Text>
                </View>
              )}
            </View>
          )}

          {/* Media Tab */}
          {activeTab === 'media' && (
            <View style={styles.mediaGrid}>
              {allImages.length > 0 ? (
                allImages.map((item, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={[styles.mediaItem, { width: imageSize, height: imageSize }]}
                  >
                    <Image 
                      source={{ uri: item.url }}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                    <View style={styles.mediaOverlay}>
                      <Text style={styles.mediaDate}>
                        {moment(item.postDate).fromNow()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="images-outline" size={48} color="#d1d5db" />
                  <Text style={styles.emptyText}>No media yet</Text>
                  <Text style={styles.emptySubtext}>Your photos and videos will appear here</Text>
                </View>
              )}
            </View>
          )}

          {/* Likes Tab */}
          {activeTab === 'likes' && (
            <View style={styles.postsContainer}>
              {likedPosts.length > 0 ? (
                allPosts
                  .filter(post => post && post._id && post.user && post.user._id && likedPosts.includes(post._id))
                  .map((post) => (
                    <PostCard 
                      key={post._id}
                      post={post}
                      onLike={handleLike}
                      onComment={handleComment}
                      onShare={handleShare}
                      onUserPress={handleUserPress}
                    />
                  ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="heart-outline" size={48} color="#d1d5db" />
                  <Text style={styles.emptyText}>No liked posts yet</Text>
                  <Text style={styles.emptySubtext}>Posts you like will appear here</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <ProfileEditModal 
          visible={showEditModal}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  coverContainer: {
    height: 160,
    backgroundColor: '#e5e7eb',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverGradient: {
    flex: 1,
    backgroundColor: '#a78bfa',
  },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    backgroundColor: '#fff',
  },
  tabsWrapper: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#4f46e5',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#fff',
  },
  contentContainer: {
    marginTop: 16,
  },
  postsContainer: {
    gap: 8,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 4,
  },
  mediaItem: {
    position: 'relative',
    borderRadius: 4,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopLeftRadius: 4,
  },
  mediaDate: {
    fontSize: 10,
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  signOutButton: {
    marginTop: 16,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
});

export default Profile;
