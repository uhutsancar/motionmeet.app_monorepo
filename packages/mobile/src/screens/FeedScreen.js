import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';

// Mock posts data - will be replaced with API data
const mockPosts = [
  {
    id: '1',
    author: {
      name: 'Sarah Johnson',
      avatar: null,
      username: '@sarah_fit',
    },
    content: 'Just completed my first marathon! 🏃‍♀️ 26.2 miles in 4:15:32. What an incredible journey!',
    image: null,
    likes: 245,
    comments: 32,
    shares: 12,
    createdAt: '2 hours ago',
    isLiked: false,
  },
  {
    id: '2',
    author: {
      name: 'Mike Chen',
      avatar: null,
      username: '@mike_lifts',
    },
    content: 'New PR on deadlift today! 💪 Hit 405lbs for the first time. Hard work pays off!',
    image: null,
    likes: 189,
    comments: 45,
    shares: 8,
    createdAt: '5 hours ago',
    isLiked: true,
  },
  {
    id: '3',
    author: {
      name: 'Emma Davis',
      avatar: null,
      username: '@yoga_emma',
    },
    content: 'Morning yoga session by the beach 🧘‍♀️ There\'s nothing like starting the day with mindfulness and movement.',
    image: null,
    likes: 312,
    comments: 28,
    shares: 15,
    createdAt: '8 hours ago',
    isLiked: false,
  },
  {
    id: '4',
    author: {
      name: 'James Wilson',
      avatar: null,
      username: '@james_crossfit',
    },
    content: 'WOD complete! Today\'s workout: 21-15-9 Thrusters and Pull-ups. Time: 8:42. Who else is training today?',
    image: null,
    likes: 156,
    comments: 67,
    shares: 5,
    createdAt: '1 day ago',
    isLiked: false,
  },
];

const PostCard = ({ post, onLike, onComment, onShare }) => (
  <View style={styles.card}>
    {/* Author Header */}
    <View style={styles.authorRow}>
      <View style={styles.avatarSmall}>
        <Text style={styles.avatarSmallText}>{post.author.name.charAt(0)}</Text>
      </View>
      <View style={styles.authorInfo}>
        <Text style={styles.authorName}>{post.author.name}</Text>
        <Text style={styles.authorUsername}>{post.author.username} • {post.createdAt}</Text>
      </View>
      <TouchableOpacity style={styles.moreButton}>
        <Text style={styles.moreButtonText}>•••</Text>
      </TouchableOpacity>
    </View>

    {/* Content */}
    <Text style={styles.content}>{post.content}</Text>

    {/* Image (if exists) */}
    {post.image && (
      <Image source={{ uri: post.image }} style={styles.postImage} />
    )}

    {/* Stats */}
    <View style={styles.statsRow}>
      <Text style={styles.statsText}>{post.likes} likes</Text>
      <Text style={styles.statsText}>{post.comments} comments</Text>
      <Text style={styles.statsText}>{post.shares} shares</Text>
    </View>

    {/* Actions */}
    <View style={styles.actionsRow}>
      <TouchableOpacity 
        style={styles.actionButton} 
        onPress={() => onLike(post.id)}
      >
        <Text style={styles.actionIcon}>{post.isLiked ? '❤️' : '🤍'}</Text>
        <Text style={[styles.actionText, post.isLiked && styles.actionTextActive]}>
          Like
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.actionButton}
        onPress={() => onComment(post.id)}
      >
        <Text style={styles.actionIcon}>💬</Text>
        <Text style={styles.actionText}>Comment</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.actionButton}
        onPress={() => onShare(post.id)}
      >
        <Text style={styles.actionIcon}>🔄</Text>
        <Text style={styles.actionText}>Share</Text>
      </TouchableOpacity>
    </View>
  </View>
);

export default function FeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPosts = async () => {
    try {
      // TODO: Replace with actual API call
      // const data = await api.getPosts();
      await new Promise(resolve => setTimeout(resolve, 500));
      setPosts(mockPosts);
    } catch (err) {
      console.log('Fetch posts failed:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchPosts();
  };

  const handleLike = (postId) => {
    setPosts(posts.map(post => 
      post.id === postId 
        ? { 
            ...post, 
            isLiked: !post.isLiked,
            likes: post.isLiked ? post.likes - 1 : post.likes + 1
          }
        : post
    ));
  };

  const handleComment = (postId) => {
    // TODO: Navigate to comments screen or open comment modal
    console.log('Comment on post:', postId);
  };

  const handleShare = (postId) => {
    // TODO: Implement share functionality
    console.log('Share post:', postId);
  };

  const handleCreatePost = () => {
    // TODO: Navigate to create post screen
    console.log('Create post pressed');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
        <TouchableOpacity style={styles.createButton} onPress={handleCreatePost}>
          <Text style={styles.createButtonText}>+ Post</Text>
        </TouchableOpacity>
      </View>

      {/* Posts List */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard 
            post={item} 
            onLike={handleLike}
            onComment={handleComment}
            onShare={handleShare}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📱</Text>
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share something!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  createButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSmallText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  authorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  authorUsername: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
  },
  moreButtonText: {
    color: '#6b7280',
    fontWeight: 'bold',
  },
  content: {
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#e5e7eb',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  statsText: {
    fontSize: 13,
    color: '#6b7280',
    marginRight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  actionIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  actionTextActive: {
    color: '#ef4444',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
});
