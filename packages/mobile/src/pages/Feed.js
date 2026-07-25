import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import {
  ActivityIndicator,
  Avatar,
  IconButton,
  Surface,
  Text,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { fetchPosts } from '../features/posts/postsSlice';
import { fetchStories } from '../features/stories/storiesSlice';
import { fetchUser } from '../features/user/userSlice';
import { fetchConnections } from '../features/connections/connectionsSlice';
import { setAuthToken } from '../api/client';
import StoriesBar from '../components/StoriesBar';
import PostCard from '../components/PostCard';
import CreatePostModal from '../components/CreatePostModal';
import StoryModal from '../components/StoryModal';
import SuggestedAthletes from '../components/SuggestedAthletes';
import MotionMark from '../components/MotionMark';

const Feed = ({ navigation }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { getToken } = useAuthContext();
  const {
    posts,
    nextCursor,
    loading: postsLoading,
    loadingMore,
  } = useSelector((state) => state.posts);
  const user = useSelector((state) => state.user.value);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('discover');

  const loadData = useCallback(async () => {
    try {
      const token = await getToken();
      if (token) setAuthToken(token);
      await Promise.all([
        dispatch(fetchUser(token)),
        dispatch(fetchStories(token)),
        dispatch(fetchPosts({ token })),
        dispatch(fetchConnections(token)),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, [dispatch, getToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || postsLoading) return;
    const token = await getToken();
    await dispatch(fetchPosts({ token, cursor: nextCursor }));
  }, [dispatch, getToken, loadingMore, nextCursor, postsLoading]);

  const handleUserPress = useCallback((userId) => {
    navigation.navigate('Profile', { userId });
  }, [navigation]);

  const validPosts = (posts || []).filter((post) => post?._id && post.user?._id);
  const listData = [
    ...validPosts.slice(0, 2).map((post) => ({ type: 'post', item: post })),
    ...(validPosts.length ? [{ type: 'suggested', id: 'suggested' }] : []),
    ...validPosts.slice(2).map((post) => ({ type: 'post', item: post })),
  ];

  const renderItem = useCallback(({ item: row }) => {
    if (row.type === 'suggested') return <SuggestedAthletes navigation={navigation} />;
    return (
      <PostCard
        post={row.item}
        onComment={() => {}}
        onShare={() => {}}
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
        <MotionMark size={30} />
        <View style={{ flex: 1, flexDirection: 'row', alignSelf: 'stretch', marginLeft: 14, gap: 18 }}>
          {[
            { key: 'discover', label: t('feed.discover', 'Discover') },
            { key: 'following', label: t('feed.following', 'Following') },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  justifyContent: 'center',
                  borderBottomWidth: active ? 2 : 0,
                  borderBottomColor: theme.primary,
                }}
              >
                <Text style={{ color: active ? theme.text : theme.textMuted, fontSize: 15, fontWeight: '800' }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <IconButton
          icon="bell-outline"
          size={20}
          iconColor={theme.text}
          style={{ margin: 0 }}
          onPress={() => navigation.navigate('NotificationsScreen')}
        />
      </Surface>

      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={(row, index) => row.id || row.item?._id || String(index)}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        windowSize={5}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={50}
        initialNumToRender={3}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        ListHeaderComponent={
          <View style={{ paddingTop: 12, paddingBottom: 4 }}>
            <Surface
              elevation={0}
              style={{
                marginHorizontal: 16,
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surface,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.energySoft,
                  }}
                >
                  <Ionicons name="barbell-outline" size={21} color={theme.text} />
                </View>
                <View style={{ flex: 1, paddingHorizontal: 11 }}>
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}>
                    {t('feed.next_session', 'Your next session')}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
                    {t('feed.next_session_hint', 'Choose a routine and start logging.')}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate('Routines')}
                  style={{
                    minHeight: 38,
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

            <StoriesBar onAddStory={() => setShowStoryModal(true)} />

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setShowCreatePost(true)}
              style={{
                minHeight: 58,
                marginHorizontal: 16,
                marginBottom: 10,
                paddingHorizontal: 12,
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surface,
              }}
            >
              {user?.profile_picture ? (
                <Avatar.Image source={{ uri: user.profile_picture }} size={36} />
              ) : (
                <Avatar.Text
                  label={user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  size={36}
                  style={{ backgroundColor: theme.primary }}
                />
              )}
              <Text style={{ flex: 1, color: theme.textMuted, fontSize: 13, marginHorizontal: 11 }}>
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
          loadData();
        }}
      />
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

export default Feed;
