import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { Image, Dimensions, Alert, TextInput, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useAuthContext } from "../context/AuthProvider";
import { Ionicons } from '@expo/vector-icons';
import { likePost, followUser, unfollowUser } from '../api/endpoints';
import { fetchUser } from '../features/user/userSlice';
import api from '../api/client';
import moment from 'moment';
import 'moment/locale/tr';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { Surface, TouchableRipple, Text } from 'react-native-paper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POST_PADDING = 16;
const CAROUSEL_WIDTH = SCREEN_WIDTH;

const PostCard = ({ post, onComment, onShare, onUserPress, navigation, onDelete, showDelete = false }) => {
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const currentUser = useSelector((state) => state.user.value);
  const dispatch = useDispatch();
  const { getToken } = useAuthContext();
  
  const [likes, setLikes] = useState(post.likes_count || []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [followProcessing, setFollowProcessing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(post.comments || []);
  const [activeSlide, setActiveSlide] = useState(0);

  // Memoize styles
  const s = useMemo(() => ({
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
      marginBottom: 8,
      backgroundColor: 'transparent'
    },
    userInfoLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
    },
    userInfo: {
      marginLeft: 12,
      backgroundColor: 'transparent'
    },
    nameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'transparent'
    },
    username: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    timestamp: {
      fontSize: 12,
      color: theme.textMuted,
      fontWeight: '600',
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
    postHeaderTexts: {
      paddingHorizontal: POST_PADDING,
      marginBottom: 12,
      gap: 6,
      backgroundColor: 'transparent'
    },
    workoutTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
    },
    content: {
      fontSize: 15,
      color: theme.textMuted,
      lineHeight: 22,
    },
    statsHeaderRow: {
      flexDirection: 'row',
      paddingHorizontal: POST_PADDING,
      marginBottom: 16,
      gap: 20,
      backgroundColor: 'transparent'
    },
    statBox: {
      justifyContent: 'center',
      backgroundColor: 'transparent'
    },
    statLabel: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '600',
      marginBottom: 4,
    },
    statValue: {
      color: theme.text,
      fontSize: 15,
      fontWeight: 'bold',
    },
    statSmall: {
      fontSize: 12,
      fontWeight: 'normal',
      color: theme.textMuted,
    },
    carouselWrapper: {
      position: 'relative',
      marginBottom: 0,
      backgroundColor: 'transparent'
    },
    carouselSlide: {
      width: CAROUSEL_WIDTH,
      height: CAROUSEL_WIDTH * 1.1,
    },
    videoContainer: {
      width: CAROUSEL_WIDTH,
      height: CAROUSEL_WIDTH * 1.1,
      backgroundColor: '#000',
      justifyContent: 'center',
    },
    playOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent'
    },
    workoutSlideContainer: {
      width: CAROUSEL_WIDTH,
      height: CAROUSEL_WIDTH * 1.1,
      backgroundColor: theme.background, 
      paddingHorizontal: POST_PADDING,
      justifyContent: 'center',
      gap: 20,
    },
    workoutSlideItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      backgroundColor: 'transparent'
    },
    workoutSlideIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.surfaceLight,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    workoutSlideTextContainer: {
      flex: 1,
      backgroundColor: 'transparent'
    },
    workoutSlideText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '500',
      lineHeight: 20,
    },
    moreExercisesText: {
      textAlign: 'center',
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '500',
      marginTop: 8,
    },
    dotsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
      gap: 6,
      backgroundColor: 'transparent'
    },
    dot: {
      height: 6,
      borderRadius: 3,
    },
    dotActive: {
      width: 14,
      backgroundColor: theme.primary, 
    },
    dotInactive: {
      width: 6,
      backgroundColor: 'rgba(255,255,255,0.4)',
    },
    actionsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: POST_PADDING,
      paddingTop: 16,
      paddingBottom: 8,
      backgroundColor: 'transparent'
    },
    actionLeftGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      backgroundColor: 'transparent'
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionText: {
      fontSize: 15,
      color: theme.text,
      fontWeight: '600',
    },
    likedByContainer: {
      paddingHorizontal: POST_PADDING,
      paddingBottom: 16,
      backgroundColor: 'transparent'
    },
    likedByText: {
      color: theme.textMuted,
      fontSize: 13,
    },
    commentsSection: {
      paddingHorizontal: POST_PADDING,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      marginHorizontal: 4,
      backgroundColor: 'transparent'
    },
    commentItem: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
      backgroundColor: 'transparent'
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
      backgroundColor: 'transparent'
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
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 2,
    },
    commentText: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 18,
    },
    commentTime: {
      color: theme.textMuted,
      fontSize: 11,
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
  }), [theme]);

  moment.locale(i18n.language.startsWith('tr') ? 'tr' : 'en');

  if (!post || !post.user || !post.user._id) return null;

  const handleLike = async () => {
    if (isProcessing) return;
    try {
      setIsProcessing(true);
      const token = await getToken();
      const data = await likePost(post._id, token);
      if (data.success) {
        setLikes(prevLikes => prevLikes.includes(currentUser._id) ? prevLikes.filter(id => id !== currentUser._id) : [...prevLikes, currentUser._id]);
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
      const { data } = await api.post('/api/post/comment/add', { postId: post._id, content: commentText });
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

  const hasWorkout = post.post_type === 'workout' && post.workout && typeof post.workout === 'object';
  const isVideo = post.post_type === 'video';
  const imageUrls = post.image_urls || [];
  
  const carouselData = [];

  // 1) Add photos/videos so they appear first
  if (isVideo && imageUrls.length > 0) {
    carouselData.push({ type: 'video', url: imageUrls[0] });
  } else {
    imageUrls.forEach(url => carouselData.push({ type: 'image', url }));
  }

  // 2) Append Workout exercise card so it's a swipe away
  if (hasWorkout) {
    carouselData.push({ type: 'workout', data: post.workout });
  }

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveSlide(viewableItems[0].index);
    }
  }).current;
  
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderCarouselItem = ({ item }) => {
    if (item.type === 'video') {
      return (
        <Surface elevation={0} style={s.videoContainer}>
           <Image source={{ uri: item.url }} style={s.carouselSlide} blurRadius={10} />
           <Surface elevation={0} style={s.playOverlay}>
              <Ionicons name="play" size={50} color="#fff" />
           </Surface>
        </Surface>
      );
    } else if (item.type === 'image') {
      return (
        <Image source={{ uri: item.url }} style={s.carouselSlide} resizeMode="cover" />
      );
    } else if (item.type === 'workout') {
      const exercises = item.data.exercises || [];
      const displayCount = Math.min(exercises.length, 4);
      const remainingCount = exercises.length - displayCount;
      
      return (
        <TouchableRipple 
          style={s.workoutSlideContainer} 
          onPress={() => navigation.navigate('WorkoutDetailScreen', { workout: item.data })}
        >
          <Surface elevation={0} style={{ backgroundColor: 'transparent' }}>
             {exercises.slice(0, displayCount).map((ex, idx) => (
               <Surface elevation={0} key={idx} style={s.workoutSlideItem}>
                 <Surface elevation={0} style={s.workoutSlideIcon}>
                   <Ionicons name="barbell" size={24} color={theme.text} />
                 </Surface>
                 <Surface elevation={0} style={s.workoutSlideTextContainer}>
                   <Text style={s.workoutSlideText} numberOfLines={2}>
                     {ex.sets?.length || 0} set {ex.exerciseId?.name || t('routines.exercise', 'Egzersiz')}
                   </Text>
                 </Surface>
               </Surface>
             ))}
             {remainingCount > 0 && (
               <Text style={s.moreExercisesText}>
                 {remainingCount} {t('feed.more_exercises', 'egzersiz daha görün')}
               </Text>
             )}
          </Surface>
        </TouchableRipple>
      );
    }
    return null;
  };

  return (
    <Surface elevation={0} style={s.card}>
      {/* User Info & Follow Button */}
      <Surface elevation={0} style={s.userSection}>
        <TouchableRipple style={s.userInfoLeft} onPress={() => onUserPress?.(post.user?._id)}>
          <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' }}>
            <Image source={{ uri: post.user?.profile_picture }} style={s.avatar} />
            <Surface elevation={0} style={s.userInfo}>
              <Surface elevation={0} style={s.nameContainer}>
                <Text style={s.username}>{post.user?.full_name}</Text>
                {post.user?.is_verified && <Ionicons name="checkmark-circle" size={14} color={theme.primary} />}
              </Surface>
              <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'transparent' }}>
                <Text style={s.timestamp}>@{post.user?.username} • {moment(post.createdAt).fromNow()}</Text>
                {post.visibility === 'private' && (
                  <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'transparent' }}>
                    <Ionicons name="lock-closed" size={10} color={theme.textMuted} />
                    <Text style={{ fontSize: 10, color: theme.textMuted }}>Sadece siz</Text>
                  </Surface>
                )}
                {post.visibility === 'followers' && (
                  <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'transparent' }}>
                    <Ionicons name="people" size={10} color={theme.textMuted} />
                    <Text style={{ fontSize: 10, color: theme.textMuted }}>Takipçiler</Text>
                  </Surface>
                )}
              </Surface>
            </Surface>
          </Surface>
        </TouchableRipple>

        {currentUser?._id !== post.user?._id && (
          <TouchableRipple 
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
          </TouchableRipple>
        )}
      </Surface>

      {/* Post Context & Title */}
      <Surface elevation={0} style={s.postHeaderTexts}>
        {hasWorkout && post.workout?.name && (
          <Text style={s.workoutTitle}>{post.workout.name}</Text>
        )}
        {post.content ? (
          <Text style={s.content}>{post.content}</Text>
        ) : null}
      </Surface>

      {/* Workout Stat Row */}
      {hasWorkout && (
        <Surface elevation={0} style={s.statsHeaderRow}>
          <Surface elevation={0} style={s.statBox}>
             <Text style={s.statLabel}>{t('feed.duration', 'Süre')}</Text>
             <Text style={s.statValue}>
               {post.workout?.durationMinutes > 0
                 ? `${Math.floor(post.workout.durationMinutes / 60) > 0 ? `${Math.floor(post.workout.durationMinutes / 60)}s ` : ''}${post.workout.durationMinutes % 60}dk`
                 : '0min'
               }
             </Text>
          </Surface>
          <Surface elevation={0} style={s.statBox}>
             <Text style={s.statLabel}>{t('feed.volume', 'Hacim')}</Text>
             <Text style={s.statValue}>{(post.workout?.volumeKg || 0).toLocaleString()} <Text style={s.statSmall}>kg</Text></Text>
          </Surface>
        </Surface>
      )}

      {/* Carousel */}
      {carouselData.length > 0 && (
        <Surface elevation={0} style={s.carouselWrapper}>
          <FlatList 
            data={carouselData}
            renderItem={renderCarouselItem}
            keyExtractor={(item, idx) => `slide-${idx}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />
          {carouselData.length > 1 && (
            <Surface elevation={0} style={s.dotsContainer}>
              {carouselData.map((_, idx) => (
                <Surface elevation={0} 
                  key={idx} 
                  style={[s.dot, activeSlide === idx ? s.dotActive : s.dotInactive]} 
                />
              ))}
            </Surface>
          )}
        </Surface>
      )}

      {/* Actions Bar */}
      <Surface elevation={0} style={s.actionsBar}>
        <Surface elevation={0} style={s.actionLeftGroup}>
          <TouchableRipple style={s.actionButton} onPress={handleLike} borderless>
            <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
              <Ionicons 
                name={likes.includes(currentUser?._id) ? "heart" : "heart-outline"} 
                size={24} 
                color={likes.includes(currentUser?._id) ? '#ef4444' : theme.text} 
              />
              <Text style={[s.actionText, likes.includes(currentUser?._id) && { color: '#ef4444' }]}>{likes.length}</Text>
            </Surface>
          </TouchableRipple>

          <TouchableRipple style={s.actionButton} onPress={() => setShowComments(!showComments)} borderless>
            <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
              <Ionicons name="chatbubble-outline" size={24} color={theme.text} />
              <Text style={[s.actionText, showComments && { color: theme.primary }]}>{comments.length}</Text>
            </Surface>
          </TouchableRipple>

          <TouchableRipple style={s.actionButton} onPress={() => onShare?.(post)} borderless>
            <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
              <Ionicons name="arrow-redo-outline" size={24} color={theme.text} style={{ transform: [{rotateY: '180deg'}] }} />
            </Surface>
          </TouchableRipple>
        </Surface>
      </Surface>

      {/* Interaction Summary */}
      {likes.length > 0 && (
        <Surface elevation={0} style={s.likedByContainer}>
            <Text style={s.likedByText}>
              {t('feed.liked_by', 'Liked by')} <Text style={{fontWeight: 'bold'}}>{likes.length}</Text> {t('feed.people', 'people')}
            </Text>
        </Surface>
      )}

      {/* Comments Section */}
      {showComments && (
        <Surface elevation={0} style={s.commentsSection}>
          {comments.map((comment, i) => (
            <Surface elevation={0} key={i} style={s.commentItem}>
              <Image source={{ uri: comment.user?.profile_picture }} style={s.commentAvatar} />
              <Surface elevation={0} style={s.commentContent}>
                <Surface elevation={0} style={s.commentBubble}>
                  <Text style={s.commentUser}>{comment.user?.full_name}</Text>
                  <Text style={s.commentText}>{comment.content}</Text>
                </Surface>
                <Text style={s.commentTime}>{moment(comment.createdAt).fromNow()}</Text>
              </Surface>
            </Surface>
          ))}

          <Surface elevation={0} style={s.commentInputContainer}>
            <TextInput
              style={s.commentInput}
              placeholder={t('feed.write_comment')}
              placeholderTextColor={theme.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              keyboardAppearance={isDark ? 'dark' : 'light'}
            />
            <TouchableRipple 
              onPress={handleAddComment}
              disabled={!commentText.trim() || isProcessing}
              style={[s.commentSendBtn, !commentText.trim() && { opacity: 0.5 }]}
              borderless
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableRipple>
          </Surface>
        </Surface>
      )}
    </Surface>
  );
};

export default memo(PostCard);
