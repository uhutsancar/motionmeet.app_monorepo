import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POST_PADDING = 16;
const IMAGE_CONTAINER_WIDTH = SCREEN_WIDTH - (POST_PADDING * 2);

const PostCard = ({ post, onLike, onComment, onShare, onUserPress }) => {
  const isLiked = Array.isArray(post.likes_count) && post.likes_count.length > 0;
  const likesCount = Array.isArray(post.likes_count) ? post.likes_count.length : 0;

  // Process content to highlight hashtags
  const renderContent = () => {
    const parts = post.content.split(/(#\w+)/g);
    return (
      <Text style={styles.content}>
        {parts.map((part, index) => {
          if (part.startsWith('#')) {
            return (
              <Text key={index} style={styles.hashtag}>
                {part}
              </Text>
            );
          }
          return <Text key={index}>{part}</Text>;
        })}
      </Text>
    );
  };

  // Render images in grid layout
  const renderImages = () => {
    if (!post.image_urls || post.image_urls.length === 0) return null;

    const imageCount = post.image_urls.length;

    if (imageCount === 1) {
      return (
        <Image 
          source={{ uri: post.image_urls[0] }}
          style={styles.singleImage}
          resizeMode="cover"
        />
      );
    }

    if (imageCount === 2) {
      return (
        <View style={styles.twoImagesContainer}>
          {post.image_urls.map((url, index) => (
            <Image 
              key={index}
              source={{ uri: url }}
              style={styles.halfImage}
              resizeMode="cover"
            />
          ))}
        </View>
      );
    }

    if (imageCount === 3) {
      return (
        <View style={styles.threeImagesContainer}>
          <Image 
            source={{ uri: post.image_urls[0] }}
            style={styles.threeImagesMain}
            resizeMode="cover"
          />
          <View style={styles.threeImagesSide}>
            <Image 
              source={{ uri: post.image_urls[1] }}
              style={styles.threeImagesSideItem}
              resizeMode="cover"
            />
            <Image 
              source={{ uri: post.image_urls[2] }}
              style={styles.threeImagesSideItem}
              resizeMode="cover"
            />
          </View>
        </View>
      );
    }

    if (imageCount >= 4) {
      return (
        <View style={styles.gridContainer}>
          {post.image_urls.slice(0, 4).map((url, index) => (
            <View key={index} style={styles.gridImageWrapper}>
              <Image 
                source={{ uri: url }}
                style={styles.gridImage}
                resizeMode="cover"
              />
              {index === 3 && imageCount > 4 && (
                <View style={styles.moreOverlay}>
                  <Text style={styles.moreText}>+{imageCount - 4}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      );
    }
  };

  return (
    <View style={styles.card}>
      {/* User Info */}
      <TouchableOpacity 
        style={styles.userSection}
        onPress={() => onUserPress(post.user)}
      >
        <Image 
          source={{ uri: post.user.profile_picture }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <View style={styles.nameContainer}>
            <Text style={styles.fullName}>{post.user.full_name}</Text>
            {post.user.is_verified && (
              <Ionicons name="checkmark-circle" size={16} color="#4f46e5" />
            )}
          </View>
          <Text style={styles.username}>@{post.user.username}</Text>
        </View>
        <Text style={styles.timestamp}>
          {moment(post.createdAt).fromNow()}
        </Text>
      </TouchableOpacity>

      {/* Post Content */}
      {post.content && (
        <View style={styles.contentContainer}>
          {renderContent()}
        </View>
      )}

      {/* Post Images */}
      {renderImages()}

      {/* Actions */}
      <View style={styles.actionsBar}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onLike(post._id)}
        >
          <Ionicons 
            name={isLiked ? "heart" : "heart-outline"} 
            size={22} 
            color={isLiked ? "#ef4444" : "#6b7280"} 
          />
          <Text style={[styles.actionText, isLiked && styles.likedText]}>
            {likesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onComment(post._id)}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#6b7280" />
          <Text style={styles.actionText}>0</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onShare(post)}
        >
          <Ionicons name="share-outline" size={20} color="#6b7280" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: POST_PADDING,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fullName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  username: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
  },
  contentContainer: {
    paddingHorizontal: POST_PADDING,
    paddingBottom: 12,
  },
  content: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  hashtag: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  singleImage: {
    width: IMAGE_CONTAINER_WIDTH,
    height: IMAGE_CONTAINER_WIDTH * 0.75,
    marginHorizontal: POST_PADDING,
    borderRadius: 12,
  },
  twoImagesContainer: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: POST_PADDING,
  },
  halfImage: {
    width: (IMAGE_CONTAINER_WIDTH - 4) / 2,
    height: IMAGE_CONTAINER_WIDTH * 0.6,
    borderRadius: 8,
  },
  threeImagesContainer: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: POST_PADDING,
  },
  threeImagesMain: {
    width: (IMAGE_CONTAINER_WIDTH - 4) / 2,
    height: IMAGE_CONTAINER_WIDTH * 0.6,
    borderRadius: 8,
  },
  threeImagesSide: {
    flex: 1,
    gap: 4,
  },
  threeImagesSideItem: {
    width: '100%',
    height: (IMAGE_CONTAINER_WIDTH * 0.6 - 4) / 2,
    borderRadius: 8,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: POST_PADDING,
  },
  gridImageWrapper: {
    width: (IMAGE_CONTAINER_WIDTH - 4) / 2,
    height: IMAGE_CONTAINER_WIDTH * 0.3,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  moreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: POST_PADDING,
    paddingVertical: 12,
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  likedText: {
    color: '#ef4444',
  },
});

export default PostCard;
