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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useSelector, useDispatch } from 'react-redux';
import { fetchPosts } from '../features/posts/postsSlice';
import UserProfileInfo from '../components/UserProfileInfo';
import PostCard from '../components/PostCard';
import ProfileEditModal from '../components/ProfileEditModal';
import moment from 'moment';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const Profile = () => {
  const { signOut } = useAuth();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.value);
  const allPosts = useSelector((state) => state.posts.posts);
  const [activeTab, setActiveTab] = useState('post');
  const [showEditModal, setShowEditModal] = useState(false);

  // Filter posts for current user
  const posts = allPosts.filter(post => post.user?._id === user?._id);

  useEffect(() => {
    dispatch(fetchPosts());
  }, [dispatch]);

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

  const handleLike = (postId) => {
    console.log('Like post:', postId);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Photo */}
        <View style={styles.coverContainer}>
          {user.cover_photo ? (
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
          isOwnProfile={true}
          onEditPress={handleEditProfile}
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
          <TouchableOpacity 
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.contentContainer}>
          {/* Posts Tab */}
          {activeTab === 'post' && (
            <View style={styles.postsContainer}>
              {posts.length > 0 ? (
                posts.map((post) => (
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
                  <Text style={styles.emptyText}>No posts yet</Text>
                </View>
              )}
            </View>
          )}

          {/* Media Tab */}
          {activeTab === 'media' && (
            <View style={styles.mediaGrid}>
              {allImages.length > 0 ? (
                allImages.map((item, index) => (
                  <View key={index} style={[styles.mediaItem, { width: imageSize, height: imageSize }]}>
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
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No media yet</Text>
                </View>
              )}
            </View>
          )}

          {/* Likes Tab */}
          {activeTab === 'likes' && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Liked posts will appear here</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <ProfileEditModal 
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
      />
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
    padding: 12,
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
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
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
