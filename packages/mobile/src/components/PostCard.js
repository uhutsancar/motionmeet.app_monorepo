import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Alert, TextInput } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { likePost, followUser, unfollowUser } from '../api/endpoints';
import { fetchUser } from '../features/user/userSlice';
import api from '../api/client';
import moment from 'moment';
import 'moment/locale/tr'; // static import required by Metro bundler
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POST_PADDING = 16;
const IMAGE_CONTAINER_WIDTH = SCREEN_WIDTH - (POST_PADDING * 2);

const PostCard = ({ post, onComment, onShare, onUserPress, navigation, onDelete, showDelete = false }) => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const currentUser = useSelector((state) => state.user.value);
  const dispatch = useDispatch();
  const { getToken } = useAuth();
  const [likes, setLikes] = useState(post.likes_count || []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [followProcessing, setFollowProcessing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(post.comments || []);
  const s = styles(theme);

  // Set moment locale
  moment.locale(i18n.language.startsWith('tr') ? 'tr' : 'en');

  // Don't render if post or post.user is invalid
  if (!post || !post.user || !post.user._id) {
    return null;
  }

  const isLiked = likes.includes(currentUser?._id);
  const likesCount = likes.length;
  
  const workoutData = post.workout;

  const handleLike = async () => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      const token = await getToken();
      const data = await likePost(post._id, token);
      
      if (data.success) {
        setLikes(prevLikes => {
          if (prevLikes.includes(currentUser._id)) {
            return prevLikes.filter(id => id !== currentUser._id);
          } else {
            return [...prevLikes, currentUser._id];
          }
        });
      }
    } catch (error) {
      console.error('Like error:', error);
      Alert.alert(t('common.error', 'Error'), t('feed.failed_like', 'Failed to like post'));
    } finally {
      setIsProcessing(false);
    }
  };

  const isFollowing = currentUser?.following?.includes(post.user?._id);

  const handleFollow = async () => {
    if (followProcessing) return;
    try {
      setFollowProcessing(true);
      const token = await getToken();
      if (isFollowing) {
        await unfollowUser(post.user?._id, token);
      } else {
        await followUser(post.user?._id, token);
      }
      dispatch(fetchUser(token));
    } catch (error) {
      console.error('Follow error:', error);
      Alert.alert(t('common.error'), t('feed.follow_failed'));
    } finally {
      setFollowProcessing(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || isProcessing) return;
    
    try {
      setIsProcessing(true);
      const { data } = await api.post('/api/post/comment/add', {
        postId: post._id,
        content: commentText
      });
      
      if (data.success) {
        setComments(data.comments);
        setCommentText("");
      } else {
        Alert.alert(t('common.error'), data.message);
      }
    } catch (error) {
      console.error('Comment error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Render images/videos in grid layout
  const renderMedia = (urls) => {
    if (!urls || urls.length === 0) return null;

    const count = urls.length;

    if (count === 1) {
      return (
        <Image 
          source={{ uri: urls[0] }}
          style={s.singleImage}
          resizeMode="cover"
        />
      );
    }

    if (count === 2) {
      return (
        <View style={s.twoImagesContainer}>
          {urls.map((url, index) => (
            <Image 
              key={index}
              source={{ uri: url }}
              style={s.halfImage}
              resizeMode="cover"
            />
          ))}
        </View>
      );
    }

    if (count >= 3) {
      return (
        <View style={s.threeImagesContainer}>
          <Image 
            source={{ uri: urls[0] }}
            style={s.threeImagesMain}
            resizeMode="cover"
          />
          <View style={s.threeImagesSide}>
            <Image 
              source={{ uri: urls[1] }}
              style={s.threeImagesSideItem}
              resizeMode="cover"
            />
            <Image 
              source={{ uri: urls[2] }}
              style={s.threeImagesSideItem}
              resizeMode="cover"
            />
          </View>
        </View>
      );
    }
  };

  return (
    <View style={s.card}>
      {/* User Info & Follow Button */}
      <View style={s.userSection}>
        <TouchableOpacity style={s.userInfoLeft} onPress={() => onUserPress?.(post.user?._id)}>
          <Image source={{ uri: post.user?.profile_picture }} style={s.avatar} />
          <View style={s.userInfo}>
            <View style={s.nameContainer}>
              <Text style={s.username}>{post.user?.full_name}</Text>
              {post.user?.is_verified && <Ionicons name="checkmark-circle" size={14} color={theme.primary} />}
            </View>
            <Text style={s.timestamp}>{moment(post.createdAt).fromNow()}</Text>
          </View>
        </TouchableOpacity>

        {currentUser?._id !== post.user?._id && (
          <TouchableOpacity 
            style={[s.followBtn, currentUser?.following?.includes(post.user?._id) && s.followingBtn]} 
            onPress={handleFollow}
            disabled={followProcessing}
          >
            {followProcessing ? (
               <ActivityIndicator size="small" color={theme.primary} />
            ) : (
                <Text style={[s.followBtnText, currentUser?.following?.includes(post.user?._id) && s.followingBtnText]}>
                {currentUser?.following?.includes(post.user?._id) ? t('feed.following_status', 'Following') : t('feed.follow')}
                </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {post.content && (
        <View style={s.contentContainer}>
          <Text style={s.content}>{post.content}</Text>
        </View>
      )}

      {/* Workout Info */}
      {post.type === 'workout' && post.workout_id && (
        <TouchableOpacity 
          style={s.workoutContainer}
          onPress={() => navigation.navigate('WorkoutDetail', { workoutId: post.workout_id._id })}
        >
          <View style={s.workoutStatsRow}>
            <View style={s.workoutStatCol}>
              <Text style={s.workoutStatLabel}>{t('feed.duration')}</Text>
              <Text style={s.workoutStatValue}>{post.workout_id.duration || '0'}m</Text>
            </View>
            <View style={s.workoutStatCol}>
              <Text style={s.workoutStatLabel}>{t('feed.volume')}</Text>
              <Text style={s.workoutStatValue}>{post.workout_id.volume || '0'}kg</Text>
            </View>
            <View style={s.workoutStatCol}>
              <Text style={s.workoutStatLabel}>{t('feed.exercises')}</Text>
              <Text style={s.workoutStatValue}>{post.workout_id.exercises?.length || '0'}</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Media Rendering */}
      {post.image_urls && post.image_urls.length > 0 && (
        <View style={s.mediaContainer}>
          {post.post_type === 'video' ? (
            <View style={s.videoContainer}>
               <Image source={{ uri: post.image_urls[0] }} style={s.singleImage} blurRadius={10} />
               <View style={s.playOverlay}>
                  <Ionicons name="play" size={50} color="#fff" />
               </View>
            </View>
          ) : (
            renderMedia(post.image_urls)
          )}
        </View>
      )}

      {/* Actions Bar */}
      <View style={s.actionsBar}>
        <View style={s.actionLeftGroup}>
          <TouchableOpacity style={s.actionButton} onPress={handleLike}>
            <Ionicons 
              name={likes.includes(currentUser?._id) ? "heart" : "heart-outline"} 
              size={24} 
              color={likes.includes(currentUser?._id) ? '#ef4444' : '#fff'} 
            />
            <Text style={s.actionText}>{likes.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionButton} onPress={() => setShowComments(!showComments)}>
            <Ionicons name="chatbubble-outline" size={24} color="#fff" />
            <Text style={s.actionText}>{comments.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={s.actionButton} 
            onPress={() => onShare?.(post)}
            >
            <Ionicons name="arrow-redo-outline" size={24} color="#fff" style={{ transform: [{rotateY: '180deg'}] }} />
            </TouchableOpacity>
        </View>
      </View>

      {/* Interaction Summary */}
      {likes.length > 0 && (
        <View style={s.likedByContainer}>
            <Text style={s.likedByText}>
              {t('feed.liked_by', 'Liked by')} <Text style={{fontWeight: 'bold'}}>{likes.length}</Text> {t('feed.people', 'people')}
            </Text>
        </View>
      )}

      {/* Comments Section */}
      {showComments && (
        <View style={s.commentsSection}>
          {comments.map((comment, i) => (
            <View key={i} style={s.commentItem}>
              <Image source={{ uri: comment.user?.profile_picture }} style={s.commentAvatar} />
              <View style={s.commentContent}>
                <View style={s.commentBubble}>
                  <Text style={s.commentUser}>{comment.user?.full_name}</Text>
                  <Text style={s.commentText}>{comment.content}</Text>
                </View>
                <Text style={s.commentTime}>{moment(comment.createdAt).fromNow()}</Text>
              </View>
            </View>
          ))}

          <View style={s.commentInputContainer}>
            <TextInput
              style={s.commentInput}
              placeholder={t('feed.write_comment')}
              placeholderTextColor={theme.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity 
              onPress={handleAddComment}
              disabled={!commentText.trim() || isProcessing}
              style={[s.commentSendBtn, !commentText.trim() && { opacity: 0.5 }]}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  card: {
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingVertical: 12,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: POST_PADDING,
    marginBottom: 12,
  },
  userInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  userInfo: {
    marginLeft: 12,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  timestamp: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  followBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  followBtnText: {
    color: theme.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  followingBtn: {
    backgroundColor: 'transparent',
  },
  followingBtnText: {
    color: theme.textMuted,
  },
  contentContainer: {
    paddingHorizontal: POST_PADDING,
    marginBottom: 12,
  },
  content: {
    fontSize: 15,
    color: theme.text,
    lineHeight: 22,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  workoutContainer: {
    marginBottom: 12,
  },
  workoutStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: POST_PADDING,
    marginBottom: 16,
  },
  workoutStatCol: {
    marginRight: 24,
  },
  workoutStatLabel: {
    color: theme.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  workoutStatValue: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '500',
  },
  workoutCenterBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    marginBottom: 8,
  },
  workoutCenterIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  workoutCenterText: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  singleImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.9,
  },
  twoImagesContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  halfImage: {
    width: (SCREEN_WIDTH - 2) / 2,
    height: SCREEN_WIDTH * 0.7,
  },
  threeImagesContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  threeImagesMain: {
    width: (SCREEN_WIDTH - 2) / 2,
    height: SCREEN_WIDTH * 0.7,
  },
  threeImagesSide: {
    flex: 1,
    gap: 2,
  },
  threeImagesSideItem: {
    width: '100%',
    height: (SCREEN_WIDTH * 0.7 - 2) / 2,
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: POST_PADDING,
    paddingTop: 12,
    paddingBottom: 8,
  },
  actionLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  likedByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: POST_PADDING,
    paddingBottom: 16,
  },
  likedByAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likedByAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.background,
  },
  likedByText: {
    color: theme.textSecondary,
    fontSize: 13,
    marginLeft: -8, // compensate for last overlapping avatar
  },
  videoContainer: {
    position: 'relative',
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.9,
    backgroundColor: '#000',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsSection: {
    paddingHorizontal: POST_PADDING,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    marginHorizontal: 4,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: theme.surfaceLight,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  commentUser: {
    color: theme.text,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  commentText: {
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  commentTime: {
    color: theme.textMuted,
    fontSize: 10,
    marginTop: 4,
    marginLeft: 4,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: theme.surfaceLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  commentInput: {
    flex: 1,
    color: theme.text,
    fontSize: 14,
    paddingTop: 0,
    paddingBottom: 0,
    minHeight: 24,
  },
  commentSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PostCard;
