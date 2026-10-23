import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  TouchableOpacity,
  View,
  type ListRenderItem,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Menu,
  Surface,
  Text,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { fetchPosts } from '../features/posts/postsSlice';
import { fetchStories } from '../features/stories/storiesSlice';
import { fetchUser } from '../features/user/userSlice';
import { fetchUnreadCount } from '../features/notifications/notificationsSlice';
import { setAuthToken } from '../api/client';
import StoriesBar from '../components/StoriesBar';
import PostCard from '../components/PostCard';
import CreatePostModal from '../components/CreatePostModal';
import StoryComposer from '../components/StoryComposer';
import SuggestedAthletes from '../components/SuggestedAthletes';
import NearbyAthletes from '../components/NearbyAthletes';
import MotionMark from '../components/MotionMark';
import NativeAdCard from '../components/ads/NativeAdCard';
import { useAdEntitlement } from '../hooks/useAdEntitlement';
import { createAdGapSequence, newAdSeed } from '../config/ads';
import { logHandledError } from '../utils/feedback';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useScrollToTopOnTabPress } from '../hooks/useScrollToTopOnTabPress';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import { useActiveWorkoutDraft } from '../features/workout/useActiveWorkoutDraft';
import { ICON, TYPE } from '../config/layout';
import SoftButton from '../components/ui/SoftButton';
import { MESSAGE_ICON } from '../config/icons';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { Post, PublicUser } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';

type FeedMode = 'discover' | 'following';
type FeedRow =
  | { type: 'post'; item: Post }
  | { type: 'suggested'; id: string }
  | { type: 'nearby'; id: string }
  | { type: 'ad'; id: string };

/**
 * Inserts one sponsored row every 10-15 posts, with gaps drawn from `seed` so
 * appending a page never moves an ad that is already on screen.
 *
 * An ad only goes between two posts: never next to a people rail, and never
 * as the last row, because what follows the last row is not known until the
 * next page arrives and an ad placed there would have to move. Client-side
 * only - the backend cursor never sees these rows.
 */
const insertAdRows = (rows: FeedRow[], seed: number): FeedRow[] => {
  const nextGap = createAdGapSequence(seed);
  const result: FeedRow[] = [];
  let postsSinceAd = 0;
  let adIndex = 0;
  let gap = nextGap();
  rows.forEach((row, index) => {
    result.push(row);
    if (row.type !== 'post') return;
    postsSinceAd += 1;
    const next = rows[index + 1];
    if (postsSinceAd >= gap && next?.type === 'post') {
      result.push({ type: 'ad', id: `ad-${seed}-${adIndex++}` });
      postsSinceAd = 0;
      gap = nextGap();
    }
  });
  return result;
};

interface HeaderActionProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  badge: number;
  label: string;
  onPress: () => void;
}

/** One of the two round buttons at the top right of the feed. */
const HeaderAction = ({ icon, badge, label, onPress }: HeaderActionProps) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label} (${badge})` : label}
      style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={ICON.header} color={theme.text} />
      {badge > 0 && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 2,
            right: 0,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 4,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.danger,
            borderWidth: 1.5,
            borderColor: theme.surface,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const Feed = ({ navigation }: NavigationOnlyProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { isNarrow } = useResponsiveLayout();
  const activeWorkout = useActiveWorkoutDraft();
  const dispatch = useAppDispatch();
  const { getToken } = useAuthContext();
  const {
    posts,
    nextCursor,
    loading: postsLoading,
    loadingMore,
  } = useAppSelector((state) => state.posts);
  const { shouldShowAds } = useAdEntitlement();
  // Kept live by the socket, so a like or follow request badges the bell without
  // the screen polling for it.
  const unreadCount = useAppSelector((state) => state.notifications.unreadCount);
  const { unreadMessages, clear: clearUnreadMessages } = useUnreadMessages();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FeedMode>('discover');
  const [feedMenuVisible, setFeedMenuVisible] = useState(false);
  // One per list generation: a refresh or a new feed reshuffles ad slots,
  // loading the next page does not.
  const [adSeed, setAdSeed] = useState(newAdSeed);
  const listRef = useRef<FlatList<FeedRow>>(null);
  useScrollToTopOnTabPress(listRef);
  // A post's comment box sits inside the list; without this the keyboard
  // covered it and comments were typed blind. Only the rows' own inputs are
  // followed - the composers opened from here bring their own keyboards.
  const { keyboardPadding, requestFocusedInputScroll } = useKeyboardAwareScroll(listRef, { onlyWhenRequested: true });

  /*
   * Switching feeds starts at the top of the new one.
   *
   * The two modes share one list, so picking Keşfet while halfway down Ana
   * Sayfa left the scroll offset exactly where it was and dropped the reader
   * into the middle of a feed they had not seen — and, until the new posts
   * arrived, into the middle of the old one. Jumping without animating is
   * deliberate: there is nothing between here and the top worth watching go by.
   */
  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const selectTab = useCallback((mode: FeedMode) => {
    setFeedMenuVisible(false);
    scrollToTop();
    setActiveTab(mode);
    setAdSeed(newAdSeed());
  }, [scrollToTop]);

  const loadStaticData = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      setAuthToken(token);
      await Promise.all([
        dispatch(fetchUser(token)),
        dispatch(fetchStories(token)),
        // One small call seeds the bell badge; every later change arrives over
        // the socket rather than by polling.
        dispatch(fetchUnreadCount(token)),
      ]);
    } catch (error) {
      logHandledError('load-feed-static-data', error);
    }
  }, [dispatch, getToken]);

  useEffect(() => {
    void loadStaticData();
  }, [loadStaticData]);

  const loadPosts = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      setAuthToken(token);
      await dispatch(fetchPosts({ token, mode: activeTab }));
    } catch (error) {
      logHandledError('load-feed-posts', error);
    }
  }, [activeTab, dispatch, getToken]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const onRefresh = async () => {
    setRefreshing(true);
    setAdSeed(newAdSeed());
    try {
      await Promise.all([loadStaticData(), loadPosts()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || postsLoading) return;
    const token = await getToken();
    if (!token) return;
    await dispatch(fetchPosts({ token, cursor: nextCursor, mode: activeTab }));
  }, [activeTab, dispatch, getToken, loadingMore, nextCursor, postsLoading]);

  const handleUserPress = useCallback((userId: string) => {
    navigation.navigate('Profile', { userId });
  }, [navigation]);

  // Memoised on `posts` alone. Rebuilt inline, this array was a new object on
  // every render of the screen - and the screen re-renders whenever the socket
  // moves the bell badge, whenever the feed picker opens, whenever a pull to
  // refresh starts. Each of those handed `FlatList` a `data` prop it had never
  // seen and made it re-diff the whole list for a change to the header.
  const listData = useMemo<FeedRow[]>(() => {
    const validPosts = posts.filter((post) => {
      const author: PublicUser | null = typeof post.user === 'object' ? post.user : null;
      return Boolean(post._id && author?._id);
    });
    if (!validPosts.length) return [];

    /*
     * Two people carousels, never next to each other.
     *
     * Both rails used to be spliced in at fixed offsets - suggested after the
     * second post, nearby after the fifth - which only reads as two sections on
     * an account whose feed is long enough. With three posts the slice between
     * them came back empty and the two rails landed back to back, which is the
     * one arrangement that makes them look like one confused block.
     *
     * Suggested keeps its place near the top, because finding people to follow
     * is what a thin feed needs. Nearby waits until there is a real run of posts
     * after it, and drops to the bottom of the list when there is not - below
     * the posts either way, and always with something between the two.
     */
    const asRow = (post: Post): FeedRow => ({ type: 'post', item: post });
    const suggestedAfter = Math.min(2, validPosts.length);
    const nearbyAfter = 6;
    const rows: FeedRow[] = [
      ...validPosts.slice(0, suggestedAfter).map(asRow),
      { type: 'suggested', id: 'suggested' },
    ];
    if (validPosts.length > nearbyAfter) {
      rows.push(
        ...validPosts.slice(suggestedAfter, nearbyAfter).map(asRow),
        { type: 'nearby', id: 'nearby' },
        ...validPosts.slice(nearbyAfter).map(asRow),
      );
    } else {
      rows.push(
        ...validPosts.slice(suggestedAfter).map(asRow),
        { type: 'nearby', id: 'nearby' },
      );
    }
    return shouldShowAds ? insertAdRows(rows, adSeed) : rows;
  }, [adSeed, posts, shouldShowAds]);

  const renderItem: ListRenderItem<FeedRow> = useCallback(({ item: row }) => {
    if (row.type === 'suggested') return <SuggestedAthletes navigation={navigation} />;
    if (row.type === 'nearby') return <NearbyAthletes navigation={navigation} />;
    if (row.type === 'ad') return <NativeAdCard />;
    return (
      <PostCard
        post={row.item}
        onUserPress={handleUserPress}
        navigation={navigation}
        onInputFocus={requestFocusedInputScroll}
      />
    );
  }, [handleUserPress, navigation, requestFocusedInputScroll]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <Surface
        elevation={0}
        style={{
          // Compact, and with no rule under it: the stories rail reads as the
          // top of the page rather than as a second band under a header bar.
          minHeight: 48,
          paddingLeft: 14,
          paddingRight: 6,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.background,
        }}
      >
        <MotionMark size={24} />
        {/* One title that opens the feed picker, instead of two competing tabs. */}
        <View style={{ flex: 1, minWidth: 0, marginLeft: isNarrow ? 8 : 12 }}>
          <Menu
            visible={feedMenuVisible}
            onDismiss={() => setFeedMenuVisible(false)}
            anchorPosition="bottom"
            anchor={
              <TouchableOpacity
                onPress={() => setFeedMenuVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={t('feed.home_title', 'Home')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{ flexShrink: 1, color: theme.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.2 }}
                >
                  {activeTab === 'following' ? t('feed.home_title', 'Ana Sayfa') : t('feed.home_discover', 'Keşfet')}
                </Text>
                <Ionicons name="chevron-down" size={14} color={theme.text} />
              </TouchableOpacity>
            }
          >
            <Menu.Item
              onPress={() => selectTab('following')}
              title={t('feed.home_following', 'Ana Sayfa (Takip edilenler)')}
              leadingIcon="home-outline"
              trailingIcon={activeTab === 'following' ? 'check' : undefined}
            />
            <Menu.Item
              onPress={() => selectTab('discover')}
              title={t('feed.home_discover', 'Keşfet')}
              leadingIcon="earth"
              trailingIcon={activeTab === 'discover' ? 'check' : undefined}
            />
          </Menu>
        </View>
        {/* Activity and messages sit together at the top right. Messages left
            the tab bar, so this is now the one place either is opened from. */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Creating a post lives in the header, as Instagram's "+" does,
              instead of a boxed "share an update" bar on top of the feed. */}
          <HeaderAction
            icon="add-circle-outline"
            badge={0}
            label={t('feed.create_post', 'Gönderi oluştur')}
            onPress={() => setShowCreatePost(true)}
          />
          <HeaderAction
            icon="heart-outline"
            badge={unreadCount}
            label={t('activity.title', 'Bildirimler')}
            onPress={() => navigation.navigate('ActivityScreen')}
          />
          <HeaderAction
            icon={MESSAGE_ICON}
            badge={unreadMessages}
            label={t('tabs.messages', 'Mesajlar')}
            onPress={() => {
              clearUnreadMessages();
              navigation.navigate('Messages');
            }}
          />
        </View>
      </Surface>

      <FlatList
        ref={listRef}
        /* Emptied only while a *different* feed is being fetched, so switching
           to Keşfet shows it loading rather than leaving Ana Sayfa's posts
           under a title that no longer describes them. A pull to refresh keeps
           what is on screen: the spinner in the control already says it is
           working, and blanking the list there would be a flash of nothing. */
        data={postsLoading && !refreshing ? [] : listData}
        renderItem={renderItem}
        keyExtractor={(row, index) => row.type === 'post' ? row.item._id || String(index) : row.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        removeClippedSubviews
        windowSize={5}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={50}
        initialNumToRender={3}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        ListHeaderComponent={
          <View>
            <StoriesBar
              onAddStory={() => setShowStoryComposer(true)}
              navigation={navigation}
              onStoryDeleted={() => void loadStaticData()}
            />

            {/* The next session as one quiet line with a short button, not a
                boxed card with a tinted icon tile. */}
            <View style={[feedStyles.nextRow, { borderBottomColor: theme.border }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: theme.text, fontSize: TYPE.body, fontWeight: '600' }}>
                  {activeWorkout
                    ? t('active_workout.in_progress', 'Devam eden antrenman')
                    : t('feed.next_session', 'Your next session')}
                </Text>
                <Text numberOfLines={1} style={{ color: theme.textMuted, fontSize: TYPE.meta, marginTop: 1 }}>
                  {activeWorkout
                    ? activeWorkout.name
                    : t('feed.next_session_hint', 'Choose a routine and start logging.')}
                </Text>
              </View>
              <SoftButton
                primary
                fill={false}
                icon={activeWorkout ? 'play' : undefined}
                label={activeWorkout ? t('active_workout.resume', 'Devam et') : t('common.start', 'Start')}
                onPress={() => navigation.navigate(activeWorkout ? 'ActiveWorkoutScreen' : 'Routines')}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          postsLoading ? (
            <View style={{ padding: 36, alignItems: 'center' }}>
              <ActivityIndicator color={theme.primary} />
              <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 10 }}>
                {t('common.loading', 'Loading...')}
              </Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 32, paddingVertical: 40, alignItems: 'center' }}>
              <Ionicons name="people-outline" size={26} color={theme.textMuted} />
              <Text style={{ color: theme.text, fontSize: TYPE.section, fontWeight: '600', marginTop: 10 }}>
                {t('feed.no_posts', 'No posts yet')}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 }}>
                {t('feed.no_posts_hint', 'Follow athletes or share the first update.')}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ padding: 18, alignItems: 'center' }}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}
        contentContainerStyle={{ paddingBottom: 24 + keyboardPadding }}
      />

      <CreatePostModal
        visible={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onSuccess={() => {
          setShowCreatePost(false);
          void loadPosts();
        }}
      />
      <StoryComposer
        visible={showStoryComposer}
        onClose={() => setShowStoryComposer(false)}
        onSuccess={() => {
          setShowStoryComposer(false);
          void loadStaticData();
        }}
      />
    </SafeAreaView>
  );
};

const feedStyles = StyleSheet.create({
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

export default Feed;
