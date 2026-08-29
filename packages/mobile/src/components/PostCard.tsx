import React, { useState, useRef, memo, useMemo, useCallback } from 'react';
import {
  Alert,
  Animated,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
  type ListRenderItem,
  type StyleProp,
  type ViewStyle,
  type ViewToken,
} from 'react-native';
// expo-image, not React Native's Image: the feed is the one screen where a
// member scrolls past dozens of remote photographs, and this one recycles
// views, keeps a memory and a disk cache, and fades a placeholder in rather
// than flashing an empty box on every cell that comes back into the window.
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuthContext } from "../context/AuthProvider";
import Ionicons from '@expo/vector-icons/Ionicons';
import { likePostIdempotent, unlikePostIdempotent, addComment, getPostComments } from '../api/endpoints';
import { useFollowAction } from '../hooks/useFollowAction';
import dayjs, { setDayjsLocale } from '../utils/dayjs';

import { useTranslation } from 'react-i18next';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { AVATAR, EXERCISE_THUMB, POST_MEDIA_ASPECT, exerciseThumbStyle } from '../config/layout';
import { useTheme } from '../context/ThemeContext';
import { Surface, TouchableRipple, Text } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { getUserFacingError, logHandledError, showError, showInfo, showSuccess } from '../utils/feedback';
import { WEB_URL } from '../config/environment';
import {
  CONTENT_LIMITS,
  buildPostShareUrl,
  mediaVariantUrl,
  type Comment,
  type Exercise,
  type Post,
  type Workout,
} from '@motionmeet/shared';
import { useAppSelector } from '../store/hooks';
import type { NavigationLike } from '../navigation/types';

const POST_PADDING = 16;
const normalizeUri = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

interface PostVideoProps {
  source: string;
  style: StyleProp<ViewStyle>;
}

interface PostCardProps {
  post: Post;
  onComment?: (post: Post) => void;
  onShare?: (post: Post) => void | Promise<void>;
  onUserPress?: (userId: string) => void;
  navigation: NavigationLike;
  onDelete?: (postId: string) => void;
  showDelete?: boolean;
}

type CarouselItem =
  | { type: 'video' | 'image'; url: string }
  | { type: 'workout'; data: Workout };

const PostVideo = ({ source, style }: PostVideoProps) => {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="contain"
      nativeControls
      accessibilityLabel="Video"
    />
  );
};

const PostCard = ({ post, onComment: _onComment, onShare, onUserPress, navigation, onDelete: _onDelete, showDelete: _showDelete = false }: PostCardProps) => {
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const { usableWidth, isNarrow, height: screenHeight } = useResponsiveLayout();
  // The feed list is capped at 720, so the media fills the same usable width.
  const carouselWidth = Math.max(1, Math.min(usableWidth, 720));
  const workout = post.workout && typeof post.workout === 'object' ? post.workout : null;
  const postUser = typeof post.user === 'object' ? post.user : null;
  const hasWorkout = post.post_type === 'workout' && workout !== null;
  const isVideo = post.post_type === 'video';
  const imageUrls = (Array.isArray(post.image_urls) ? post.image_urls : [])
    .map(normalizeUri)
    .filter(Boolean);
  const postProfilePicture = normalizeUri(postUser?.profile_picture);
  // Media keeps an Instagram-like portrait ratio but never grows past the
  // screen so a post always fits without the actions bar being pushed away.
  // Every photo is rendered in the same box regardless of its own dimensions,
  // so a feed of mixed portrait/landscape uploads scrolls at one rhythm.
  const mediaSlideHeight = Math.round(
    Math.min(carouselWidth * POST_MEDIA_ASPECT, screenHeight * 0.62, 620),
  );
  const workoutExerciseCount = Math.min(workout?.exercises.length || 0, 4);
  /*
   * A workout slide matches the media beside it, and only then.
   *
   * Sharing the media height unconditionally is what put two exercise rows in
   * the middle of a 600pt panel with nothing above or below them — a workout
   * logged without a photo is not a picture and has no reason to be as tall as
   * one. Alongside media it still has to match, or the carousel would jump
   * between slides.
   */
  const hasMediaSlide = imageUrls.length > 0;
  const workoutRowsHeight = 44 + workoutExerciseCount * 52;
  const workoutSlideHeight = hasMediaSlide
    ? mediaSlideHeight
    : Math.round(Math.min(Math.max(workoutRowsHeight, 132), mediaSlideHeight));
  // Rows are centred only when they are sharing a taller box with media.
  const centerWorkoutRows = hasMediaSlide && workoutExerciseCount <= 2;
  const durationMinutes = Math.max(0, Math.round(workout?.durationMinutes ?? 0));
  const durationHours = Math.floor(durationMinutes / 60);
  const durationLabel = durationHours > 0
    ? `${durationHours}${t('common.hours_short', 'h')} ${durationMinutes % 60}${t('common.min', 'min')}`
    : `${durationMinutes} ${t('common.min', 'min')}`;
  const currentUser = useAppSelector((state) => state.user.value);
  const { getToken } = useAuthContext();
  // Seeded from the feed payload so the button is correct on first paint, then
  // kept in step with every other follow button through the shared store.
  const follow = useFollowAction(postUser?._id, {
    isFollowing: Boolean(post.author_followed_by_me),
    requestSent: Boolean(post.author_follow_requested),
    isFollowedBy: Boolean(post.author_follows_me),
  });
  // "Following" and "Requested" are both settled states, so they share the
  // quiet styling; "Follow" and "Follow back" are the calls to action.
  const isMutedFollowState = follow.state === 'following' || follow.state === 'requested';

  const [likeCount, setLikeCount] = useState(post.like_count ?? 0);
  const [isLiked, setIsLiked] = useState(Boolean(post.liked_by_me));
  const [isProcessing, setIsProcessing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>(post.comments || []);
  const [commentCount, setCommentCount] = useState(
    post.comment_count ?? post.comments?.length ?? 0
  );
  const [commentCursor, setCommentCursor] = useState<string | null>(post.comment_next_cursor || null);
  const [olderCommentsLoading, setOlderCommentsLoading] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  /* Double tap on the picture is how liking works everywhere else, and the
     heart button was the only way to do it here. The two share one code path,
     with one difference: a double tap only ever likes. Tapping twice to undo a
     like is not a gesture anyone makes on purpose, and losing a like to a
     mistimed scroll is worse than needing the button to take one back. */
  const lastMediaTapRef = useRef(0);
  const burst = useRef(new Animated.Value(0)).current;

  const playBurst = useCallback(() => {
    burst.setValue(0);
    Animated.sequence([
      Animated.spring(burst, { toValue: 1, useNativeDriver: true, friction: 4, tension: 90 }),
      Animated.delay(420),
      Animated.timing(burst, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [burst]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<CarouselItem>[] }) => {
    if (viewableItems.length > 0) {
      setActiveSlide(viewableItems[0]?.index ?? 0);
    }
  }).current;
  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  // Memoize styles
  const s = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: theme.background,
      marginBottom: 8,
      paddingTop: 12,
      paddingBottom: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      overflow: 'hidden',
    },
    userSection: {
      flexDirection: 'row',
      flexWrap: isNarrow ? 'wrap' : 'nowrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: POST_PADDING,
      marginBottom: 8,
      backgroundColor: 'transparent'
    },
    userInfoLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: isNarrow ? undefined : 1,
      width: isNarrow ? '100%' : undefined,
      minWidth: 0,
    },
    avatar: {
      width: AVATAR.medium,
      height: AVATAR.medium,
      borderRadius: AVATAR.medium / 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    avatarPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.primarySoft,
    },
    avatarPlaceholderText: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: '900',
    },
    userInfo: {
      flex: 1,
      minWidth: 0,
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
      flexShrink: 1,
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    timestamp: {
      flexShrink: 1,
      fontSize: 12,
      color: theme.textMuted,
      fontWeight: '600',
      marginTop: 2,
    },
    followBtn: {
      flexShrink: 0,
      alignSelf: isNarrow ? 'flex-end' : 'center',
      maxWidth: 104,
      minHeight: 34,
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 12,
      marginTop: isNarrow ? 8 : 0,
      borderRadius: 9,
      backgroundColor: theme.primarySoft,
    },
    followBtnText: {
      color: theme.primary,
      fontWeight: '800',
      fontSize: 12,
    },
    followingBtn: {
      backgroundColor: theme.surfaceLight,
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
      marginBottom: 12,
      gap: 8,
      flexWrap: 'wrap',
      backgroundColor: 'transparent'
    },
    /* Two short facts do not need a 50pt block each.
       The old box padded 8 above and below a 4pt gap between two lines, so a
       post that says "0 dk" and "360 kg" carried a band as tall as a button
       before the picture even started. Same information, two thirds the
       height: the label is a caption over the number rather than a line of its
       own, and the plate is only just bigger than the type it holds. */
    statBox: {
      justifyContent: 'center',
      backgroundColor: theme.surfaceLight,
      borderRadius: 8,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    statLabel: {
      color: theme.textMuted,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    statValue: {
      color: theme.text,
      fontSize: 14.5,
      lineHeight: 19,
      fontWeight: '800',
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
      width: carouselWidth,
      height: mediaSlideHeight,
      // Keeps an unloaded photo on the theme colour instead of flashing white.
      backgroundColor: theme.surfaceLight,
    },
    videoContainer: {
      width: carouselWidth,
      height: mediaSlideHeight,
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
      width: carouselWidth,
      height: workoutSlideHeight,
      backgroundColor: theme.surfaceLight,
      paddingHorizontal: POST_PADDING,
      paddingVertical: 16,
      // A workout slide next to media has to match the media height, so the
      // exercise rows start at the top instead of floating in empty space.
      justifyContent: centerWorkoutRows ? 'center' : 'flex-start',
      gap: 12,
    },
    workoutSlideList: {
      backgroundColor: 'transparent',
      gap: 10,
    },
    workoutSlideItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 2,
      backgroundColor: 'transparent'
    },
    workoutSlideIcon: {
      // The medium thumbnail: at the small size the artwork was unreadable and
      // two rows of it read as one block of noise.
      ...exerciseThumbStyle(EXERCISE_THUMB.medium),
      backgroundColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    workoutSlideTextContainer: {
      flex: 1,
      backgroundColor: 'transparent'
    },
    workoutSlideText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 19,
    },
    /* Lined up with the exercise names above it, not centred on the slide.
       Centred, "2 egzersiz daha" sat a little left of the names and a long way
       right of the artwork — belonging to neither column and reading as a
       caption that had slipped. It is the last row of the same list, so it
       starts where the other rows' text starts. */
    moreExercisesText: {
      color: theme.textMuted,
      fontSize: 13.5,
      fontWeight: '600',
      marginTop: 6,
      marginLeft: EXERCISE_THUMB.medium + 12,
    },
    burst: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      // A white heart is invisible over a bright photo without something under
      // it; the shadow is what keeps it readable on any picture.
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 2 },
    },
    dotsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      position: 'absolute',
      bottom: 12,
      alignSelf: 'center',
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 12,
      // Keeps the indicator readable on both bright photos and light surfaces.
      backgroundColor: 'rgba(0,0,0,0.38)',
    },
    dot: {
      height: 6,
      borderRadius: 3,
    },
    dotActive: {
      width: 14,
      backgroundColor: '#FFFFFF',
    },
    dotInactive: {
      width: 6,
      backgroundColor: 'rgba(255,255,255,0.45)',
    },
    actionsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: POST_PADDING,
      paddingTop: 12,
      paddingBottom: 8,
      backgroundColor: 'transparent'
    },
    actionLeftGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'transparent'
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 42,
      minHeight: 40,
      justifyContent: 'center',
      borderRadius: 8,
      paddingHorizontal: 7,
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
      width: AVATAR.small,
      height: AVATAR.small,
      borderRadius: AVATAR.small / 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    commentContent: {
      flex: 1,
      minWidth: 0,
      backgroundColor: 'transparent'
    },
    commentBubble: {
      backgroundColor: theme.surfaceLight,
      borderRadius: 16,
      padding: 10,
      borderWidth: StyleSheet.hairlineWidth,
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
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginTop: 8,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    commentInput: {
      flex: 1,
      minWidth: 0,
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
  }), [carouselWidth, centerWorkoutRows, isNarrow, mediaSlideHeight, theme, workoutSlideHeight]);

  setDayjsLocale(i18n.language);


  if (!postUser) return null;

  const handleLike = async () => {
    if (isProcessing) return;
    const willLike = !isLiked;
    // Optimistic update
    setIsLiked(willLike);
    setLikeCount((prev) => prev + (willLike ? 1 : -1));
    try {
      setIsProcessing(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const data = willLike
        ? await likePostIdempotent(post._id, token)
        : await unlikePostIdempotent(post._id, token);
      if (data.success) {
        setIsLiked(data.liked);
        setLikeCount(data.like_count);
      } else {
        // Revert optimistic update
        setIsLiked(!willLike);
        setLikeCount((prev) => prev + (willLike ? -1 : 1));
      }
    } catch (error) {
      // Revert optimistic update
      setIsLiked(!willLike);
      setLikeCount((prev) => prev + (willLike ? -1 : 1));
      logHandledError('like-post', error);
      // A private account's post can be refused server-side even when the card
      // is still on screen, so the reason is surfaced rather than a generic one.
      showError(
        t('common.error', 'Hata'),
        getUserFacingError(error, t('feed.failed_like', 'Gönderi beğenilemedi')),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * One tap does nothing, two tap likes.
   *
   * 280ms is the window: long enough that a deliberate double tap is never
   * missed, short enough that two separate taps a beat apart are not mistaken
   * for one. The counter is reset on a match so a triple tap does not register
   * as two likes.
   */
  const handleMediaTap = () => {
    const now = Date.now();
    if (now - lastMediaTapRef.current < 280) {
      lastMediaTapRef.current = 0;
      // The heart plays either way. Double tapping something already liked has
      // to answer "did that do anything?", and a silent no-op does not.
      playBurst();
      if (!isLiked) void handleLike();
      return;
    }
    lastMediaTapRef.current = now;
  };

  const handleAddComment = async () => {
    const content = commentText.trim();
    if (!content || isProcessing) return;
    try {
      setIsProcessing(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const data = await addComment(post._id, content, token);
      if (data.success) {
        setComments((currentComments) => [...currentComments, data.comment]);
        setCommentCount(data.comment_count);
        setCommentText("");
      } else {
        Alert.alert(t('common.error'), data.message);
      }
    } catch (error) {
      logHandledError('add-comment', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadOlderComments = async () => {
    if (!commentCursor || olderCommentsLoading) return;
    setOlderCommentsLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const data = await getPostComments(post._id, token, commentCursor);
      if (data.success) {
        setComments((currentComments) => {
          const knownIds = new Set(currentComments.map((comment) => comment._id));
          return [
            ...(data.comments || [])
              .filter((comment) => !knownIds.has(comment._id))
              .reverse(),
            ...currentComments,
          ];
        });
        setCommentCursor(data.nextCursor);
      }
    } catch (error) {
      logHandledError('load-comments', error);
    } finally {
      setOlderCommentsLoading(false);
    }
  };

  /**
   * Hands the post to whatever the phone can share with.
   *
   * The message carries a real link rather than a copy of the caption.
   * Sharing text alone produced a paste with nowhere to go: the recipient read
   * a sentence and had no way back to the post, the author or the app. With
   * the URL in it, WhatsApp, Telegram, Instagram and the rest render a preview
   * card, and tapping it opens the post — in the app if it is installed, on
   * the web if it is not.
   *
   * The OS sheet is used rather than a menu of our own. It already lists every
   * app the member actually has, in the order they actually use them, and it
   * includes Copy — so a custom row of brand buttons would be a worse version
   * of something the platform already does better.
   *
   * A post that is not public has no shareable URL: the link would resolve to
   * a privacy notice for everyone it reached, so the caption goes on its own
   * and the member is told why.
   */
  /**
   * Copies the post's link, for when someone wants the URL and not the sheet.
   *
   * Hung off a long press rather than given a button of its own: the OS sheet
   * already offers Copy, and a second visible control for the same thing is
   * exactly the kind of UI this app has too much of.
   */
  const handleCopyLink = async () => {
    if ((post.visibility ?? 'public') !== 'public') {
      showInfo(
        t('feed.share', 'Paylaş'),
        t('feed.share_private_hint', 'Bu gönderi herkese açık olmadığı için bağlantı paylaşılamaz.'),
      );
      return;
    }
    try {
      await Clipboard.setStringAsync(buildPostShareUrl(WEB_URL, post._id || post.id));
      showSuccess(t('common.success', 'Başarılı'), t('feed.link_copied', 'Bağlantı kopyalandı'));
    } catch (error) {
      logHandledError('copy-post-link', error);
    }
  };

  const handleShare = async () => {
    try {
      if (onShare) {
        await onShare(post);
        return;
      }

      const isPublic = (post.visibility ?? 'public') === 'public';
      const url = isPublic ? buildPostShareUrl(WEB_URL, post._id || post.id) : null;
      const caption = [post.content, workout?.name].filter(Boolean).join('\n').trim();

      await Share.share(
        Platform.OS === 'ios' && url
          ? { message: caption || 'MotionMeet', url }
          : { message: [caption, url].filter(Boolean).join('\n\n') || 'MotionMeet' },
      );

      if (!isPublic) {
        showInfo(
          t('feed.share', 'Paylaş'),
          t('feed.share_private_hint', 'Bu gönderi herkese açık olmadığı için bağlantı paylaşılamaz.'),
        );
      }
    } catch (error) {
      logHandledError('share-post', error);
      Alert.alert(t('common.error', 'Error'), t('feed.share_failed', 'Could not share this post'));
    }
  };

  const carouselData: CarouselItem[] = [];

  // 1) Add photos/videos so they appear first
  if (isVideo && imageUrls.length > 0) {
    carouselData.push({ type: 'video', url: imageUrls[0] });
  } else {
    imageUrls.forEach(url => carouselData.push({ type: 'image', url }));
  }

  // 2) Append Workout exercise card so it's a swipe away
  if (hasWorkout) {
    carouselData.push({ type: 'workout', data: workout });
  }

  const renderCarouselItem: ListRenderItem<CarouselItem> = ({ item }) => {
    if (item.type === 'video') {
      return (
        <Surface elevation={0} style={s.videoContainer}>
          <PostVideo source={item.url} style={s.carouselSlide} />
        </Surface>
      );
    } else if (item.type === 'image') {
      if (!item.url) return null;
      return (
        <Pressable
          onPress={handleMediaTap}
          // A Pressable inside a paging list must not eat the swipe: with no
          // press handler of its own for a single tap, the horizontal gesture
          // still reaches the carousel underneath.
          style={s.carouselSlide}
          accessibilityRole="imagebutton"
          accessibilityLabel={post.content || t('feed.post', 'Post')}
          accessibilityHint={t('feed.double_tap_like', 'Beğenmek için iki kez dokun')}
        >
          <Image
            source={{ uri: mediaVariantUrl(item.url, 'feed') }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={120}
            cachePolicy="memory-disk"
            recyclingKey={item.url}
          />
        </Pressable>
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
          {/* The rows carry their own spacing. The gap on the slide container
              only ever applied to this one wrapper, so every exercise sat flush
              against the next with its artwork touching. */}
          <Surface elevation={0} style={s.workoutSlideList}>
             {exercises.slice(0, displayCount).map((ex, idx) => {
               const exerciseName = typeof ex.exerciseId === 'object'
                 ? (ex.exerciseId as Exercise).name
                 : ex.exerciseName;
               return (
               <Surface elevation={0} key={idx} style={s.workoutSlideItem}>
                 <Surface elevation={0} style={s.workoutSlideIcon}>
                   {typeof ex.exerciseId === 'object' && ((ex.exerciseId as Exercise).imageUrl || (ex.exerciseId as Exercise).gifUrl) ? (
                     <Image source={{ uri: mediaVariantUrl((ex.exerciseId as Exercise).imageUrl || (ex.exerciseId as Exercise).gifUrl, 'thumb') }} style={{ width: '100%', height: '100%', borderRadius: 10 }} contentFit="cover" cachePolicy="memory-disk" />
                   ) : (
                     <Ionicons name="barbell" size={24} color={theme.text} />
                   )}
                 </Surface>
                 <Surface elevation={0} style={s.workoutSlideTextContainer}>
                   <Text style={s.workoutSlideText} numberOfLines={2}>
                     {ex.sets.length} set {exerciseName || t('routines.exercise', 'Egzersiz')}
                   </Text>
                 </Surface>
               </Surface>
             )})}
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
        <TouchableRipple style={s.userInfoLeft} onPress={() => onUserPress?.(postUser._id)} accessibilityLabel={postUser.full_name}>
          <Surface elevation={0} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' }}>
            {postProfilePicture ? (
              <Image source={{ uri: mediaVariantUrl(postProfilePicture, 'avatar') }} style={s.avatar} contentFit="cover" cachePolicy="memory-disk" recyclingKey={postUser._id} />
            ) : (
              <Surface elevation={0} style={[s.avatar, s.avatarPlaceholder]}>
                <Text style={s.avatarPlaceholderText}>
                  {postUser.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </Surface>
            )}
            <Surface elevation={0} style={s.userInfo}>
              <Surface elevation={0} style={s.nameContainer}>
                <Text numberOfLines={1} style={s.username}>{postUser.full_name}</Text>
              </Surface>
              <Surface elevation={0} style={{ minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'transparent' }}>
                <Text numberOfLines={1} style={s.timestamp}>@{postUser.username} • {dayjs(post.createdAt).fromNow()}</Text>
                {post.visibility === 'private' && (
                  <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'transparent' }}>
                    <Ionicons name="lock-closed" size={10} color={theme.textMuted} />
                    <Text style={{ fontSize: 10, color: theme.textMuted }}>{t('privacy.only_me', 'Only you')}</Text>
                  </Surface>
                )}
                {post.visibility === 'followers' && (
                  <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'transparent' }}>
                    <Ionicons name="people" size={10} color={theme.textMuted} />
                    <Text style={{ fontSize: 10, color: theme.textMuted }}>{t('feed.followers', 'Followers')}</Text>
                  </Surface>
                )}
              </Surface>
            </Surface>
          </Surface>
        </TouchableRipple>

        {currentUser?._id !== postUser._id && (
          <TouchableRipple
            style={[s.followBtn, isMutedFollowState && s.followingBtn]}
            onPress={() => { void follow.toggle(); }}
            disabled={follow.busy}
            accessibilityLabel={follow.label}
          >
            {follow.busy ? (
               <ActivityIndicator size="small" color={theme.primary} />
            ) : (
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  style={[s.followBtnText, isMutedFollowState && s.followingBtnText]}
                >
                {follow.label}
                </Text>
            )}
          </TouchableRipple>
        )}
      </Surface>

      {/* Post Context & Title */}
      <Surface elevation={0} style={s.postHeaderTexts}>
        {hasWorkout && workout?.name && (
          <Text style={s.workoutTitle}>{workout.name}</Text>
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
             <Text style={s.statValue}>{durationLabel}</Text>
          </Surface>
          <Surface elevation={0} style={s.statBox}>
             <Text style={s.statLabel}>{t('feed.volume', 'Hacim')}</Text>
             <Text style={s.statValue}>{(workout?.volumeKg || 0).toLocaleString()} <Text style={s.statSmall}>kg</Text></Text>
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
          {/* Over the whole carousel rather than inside a slide, so it lands in
              the middle of the picture whichever one is showing, and never
              takes a touch away from it. */}
          <Animated.View
            pointerEvents="none"
            style={[
              s.burst,
              {
                opacity: burst,
                transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
              },
            ]}
          >
            <Ionicons name="heart" size={96} color="#FFFFFF" />
          </Animated.View>

          {carouselData.length > 1 && (
            <Surface elevation={0} style={s.dotsContainer}>
              {carouselData.map((_, idx) => (
                <View
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
          <TouchableRipple style={s.actionButton} onPress={handleLike} accessibilityLabel={t('feed.like', 'Like')} accessibilityState={{ selected: isLiked }} borderless>
            <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
              <Ionicons 
                name={isLiked ? "heart" : "heart-outline"}
                size={24} 
                color={isLiked ? '#ef4444' : theme.text}
              />
              <Text style={[s.actionText, isLiked && { color: '#ef4444' }]}>{likeCount}</Text>
            </Surface>
          </TouchableRipple>

          <TouchableRipple style={s.actionButton} onPress={() => setShowComments(!showComments)} accessibilityLabel={t('feed.comments', 'Comments')} accessibilityState={{ expanded: showComments }} borderless>
            <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
              <Ionicons name="chatbubble-outline" size={24} color={theme.text} />
              <Text style={[s.actionText, showComments && { color: theme.primary }]}>{commentCount}</Text>
            </Surface>
          </TouchableRipple>

          <TouchableRipple
            style={s.actionButton}
            onPress={handleShare}
            onLongPress={() => void handleCopyLink()}
            accessibilityLabel={t('feed.share', 'Share')}
            borderless
          >
            <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
              <Ionicons name="paper-plane-outline" size={24} color={theme.text} />
            </Surface>
          </TouchableRipple>
        </Surface>
      </Surface>

      {/* Interaction Summary */}
      {likeCount > 0 && (
        <Surface elevation={0} style={s.likedByContainer}>
            <Text style={s.likedByText}>
              {t('feed.liked_by', 'Liked by')} <Text style={{fontWeight: 'bold'}}>{likeCount}</Text> {t('feed.people', 'people')}
            </Text>
        </Surface>
      )}

      {/* Comments Section */}
      {showComments && (
        <Surface elevation={0} style={s.commentsSection}>
          {commentCursor && (
            <TouchableRipple
              onPress={loadOlderComments}
              disabled={olderCommentsLoading}
              style={{ alignSelf: 'center', padding: 10, marginBottom: 8 }}
            >
              {olderCommentsLoading
                ? <ActivityIndicator size="small" color={theme.primary} />
                : <Text style={{ color: theme.primary }}>{t('common.load_more', 'Load older comments')}</Text>
              }
            </TouchableRipple>
          )}
          {comments.map((comment, i) => (
            <Surface
              elevation={0}
              key={comment._id || `${comment.user?._id}-${comment.createdAt}-${i}`}
              style={s.commentItem}
            >
              {normalizeUri(comment.user?.profile_picture) ? (
                <Image source={{ uri: mediaVariantUrl(normalizeUri(comment.user?.profile_picture), 'avatar') }} style={s.commentAvatar} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <Surface elevation={0} style={[s.commentAvatar, s.avatarPlaceholder]}>
                  <Text style={[s.avatarPlaceholderText, { fontSize: 12 }]}>
                    {comment.user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </Surface>
              )}
              <Surface elevation={0} style={s.commentContent}>
                <Surface elevation={0} style={s.commentBubble}>
                  <Text style={s.commentUser}>{comment.user?.full_name}</Text>
                  <Text style={s.commentText}>{comment.content}</Text>
                </Surface>
                <Text style={s.commentTime}>{dayjs(comment.createdAt).fromNow()}</Text>
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
              maxLength={CONTENT_LIMITS.comment}
              keyboardAppearance={isDark ? 'dark' : 'light'}
            />
            <TouchableRipple 
              onPress={handleAddComment}
              disabled={!commentText.trim() || isProcessing}
              accessibilityLabel={t('feed.send_comment', 'Send comment')}
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
