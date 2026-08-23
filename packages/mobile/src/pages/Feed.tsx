import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Avatar,
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
import { logHandledError } from '../utils/feedback';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { AVATAR, CARD } from '../config/layout';
import { MESSAGE_ICON } from '../config/icons';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { Post, PublicUser } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';

type FeedMode = 'discover' | 'following';
type FeedRow =
  | { type: 'post'; item: Post }
  | { type: 'suggested'; id: string }
  | { type: 'nearby'; id: string };

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
      <Ionicons name={icon} size={23} color={theme.text} />
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
          <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '900' }}>
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
  const dispatch = useAppDispatch();
  const { getToken } = useAuthContext();
  const {
    posts,
    nextCursor,
    loading: postsLoading,
    loadingMore,
  } = useAppSelector((state) => state.posts);
  const user = useAppSelector((state) => state.user.value);
  // Kept live by the socket, so a like or follow request badges the bell without
  // the screen polling for it.
  const unreadCount = useAppSelector((state) => state.notifications.unreadCount);
  const { unreadMessages, clear: clearUnreadMessages } = useUnreadMessages();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FeedMode>('discover');
  const [feedMenuVisible, setFeedMenuVisible] = useState(false);

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
    return rows;
  }, [posts]);

  const renderItem: ListRenderItem<FeedRow> = useCallback(({ item: row }) => {
    if (row.type === 'suggested') return <SuggestedAthletes navigation={navigation} />;
    if (row.type === 'nearby') return <NearbyAthletes navigation={navigation} />;
    return (
      <PostCard
        post={row.item}
        onUserPress={handleUserPress}
        navigation={navigation}
      />
    );
  }, [handleUserPress, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <Surface
        elevation={0}
        style={{
          minHeight: 58,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          backgroundColor: theme.surface,
        }}
      >
        <MotionMark size={28} />
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
                  style={{ flexShrink: 1, color: theme.text, fontSize: 17, fontWeight: '800' }}
                >
                  {activeTab === 'following' ? t('feed.home_title', 'Ana Sayfa') : t('feed.home_discover', 'Keşfet')}
                </Text>
                <Ionicons name="chevron-down" size={15} color={theme.text} />
              </TouchableOpacity>
            }
          >
            <Menu.Item
              onPress={() => { setActiveTab('following'); setFeedMenuVisible(false); }}
              title={t('feed.home_following', 'Ana Sayfa (Takip edilenler)')}
              leadingIcon="home-outline"
              trailingIcon={activeTab === 'following' ? 'check' : undefined}
            />
            <Menu.Item
              onPress={() => { setActiveTab('discover'); setFeedMenuVisible(false); }}
              title={t('feed.home_discover', 'Keşfet')}
              leadingIcon="earth"
              trailingIcon={activeTab === 'discover' ? 'check' : undefined}
            />
          </Menu>
        </View>
        {/* Activity and messages sit together at the top right. Messages left
            the tab bar, so this is now the one place either is opened from. */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
        data={listData}
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
          <View style={{ paddingTop: 8, paddingBottom: 2 }}>
            <Surface
              elevation={0}
              style={{
                marginHorizontal: 12,
                padding: CARD.padding,
                borderRadius: CARD.radius,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surface,
              }}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.energySoft,
                  }}
                >
                  <Ionicons name="barbell" size={20} color={theme.text} />
                </View>
                <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 11 }}>
                  <Text numberOfLines={2} style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}>
                    {t('feed.next_session', 'Your next session')}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
                    {t('feed.next_session_hint', 'Choose a routine and start logging.')}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate('Routines')}
                  accessibilityRole="button"
                  accessibilityLabel={t('feed.next_session', 'Start your next session')}
                  style={{
                    flexBasis: isNarrow ? '100%' : undefined,
                    minHeight: 38,
                    marginTop: isNarrow ? 10 : 0,
                    paddingHorizontal: 13,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 9,
                    backgroundColor: theme.primary,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
                    {t('common.start', 'Start')}
                  </Text>
                </TouchableOpacity>
              </View>
            </Surface>

            <StoriesBar
              onAddStory={() => setShowStoryComposer(true)}
              navigation={navigation}
              onStoryDeleted={() => void loadStaticData()}
            />

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setShowCreatePost(true)}
              accessibilityRole="button"
              accessibilityLabel={t('feed.create_post', 'Create post')}
              style={{
                minHeight: 50,
                // The stories rail ends on a hairline. Without a fixed gap the
                // composer sat right on top of it, and how stuck it looked
                // depended on the device, so the spacing is a constant rather
                // than whatever the rail happened to leave behind.
                marginTop: CARD.gap,
                marginHorizontal: 12,
                marginBottom: CARD.gap,
                paddingHorizontal: 10,
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: CARD.radius,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surface,
              }}
            >
              {user?.profile_picture ? (
                <Avatar.Image source={{ uri: user.profile_picture }} size={AVATAR.small} />
              ) : (
                <Avatar.Text
                  label={user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  size={AVATAR.small}
                  style={{ backgroundColor: theme.primary }}
                />
              )}
              <Text numberOfLines={2} style={{ flex: 1, minWidth: 0, color: theme.textMuted, fontSize: 13, marginHorizontal: 11 }}>
                {t('feed.share_progress', 'Share an update with your community')}
              </Text>
              <Ionicons name="image-outline" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
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
            <Surface
              elevation={0}
              style={{
                marginHorizontal: 16,
                padding: 24,
                alignItems: 'center',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surface,
              }}
            >
              <Ionicons name="people-outline" size={28} color={theme.textMuted} />
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700', marginTop: 9 }}>
                {t('feed.no_posts', 'No posts yet')}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 }}>
                {t('feed.no_posts_hint', 'Follow athletes or share the first update.')}
              </Text>
            </Surface>
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
        contentContainerStyle={{ paddingBottom: 24 }}
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

export default Feed;
