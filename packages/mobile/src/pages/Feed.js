import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useAuthContext } from "../context/AuthProvider";
import { fetchPosts } from '../features/posts/postsSlice';
import { fetchStories } from '../features/stories/storiesSlice';
import { fetchUser } from '../features/user/userSlice';
import { fetchConnections } from '../features/connections/connectionsSlice';
import StoriesBar from '../components/StoriesBar';
import PostCard from '../components/PostCard';
import CreatePostModal from '../components/CreatePostModal';
import StoryModal from '../components/StoryModal';
import SuggestedAthletes from '../components/SuggestedAthletes';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { setAuthToken } from '../api/client';
import { Appbar, IconButton, Text, Surface, FAB, ActivityIndicator } from 'react-native-paper';

const Feed = ({ navigation }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 78;
  const fabBottom = TAB_BAR_HEIGHT + insets.bottom + 16;
  const dispatch = useDispatch();
  const { getToken } = useAuthContext();
  const { stories } = useSelector((state) => state.stories);
  const { posts, loading: postsLoading } = useSelector((state) => state.posts);
  const user = useSelector((state) => state.user.value);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('discover');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = await getToken();
      // Set global auth token for api interceptor (used by SuggestedAthletes, Profile, etc.)
      if (token) setAuthToken(token);
      dispatch(fetchUser(token));
      dispatch(fetchStories(token));
      dispatch(fetchPosts(token));
      dispatch(fetchConnections(token));
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleComment = useCallback(() => {}, []);
  const handleShare = useCallback(() => {}, []);
  const handleUserPress = useCallback((userId) => {
    navigation.navigate('Profile', { userId });
  }, [navigation]);

  // Build FlatList data: first 2 posts, then suggested athletes marker, then rest
  const validPosts = (posts || []).filter(post => post && post._id && post.user && post.user._id);
  const listData = [
    ...validPosts.slice(0, 2).map(p => ({ type: 'post', item: p })),
    ...(validPosts.length > 0 ? [{ type: 'suggested', id: 'suggested' }] : []),
    ...validPosts.slice(2).map(p => ({ type: 'post', item: p })),
  ];

  const renderItem = useCallback(({ item: row }) => {
    if (row.type === 'suggested') {
      return <SuggestedAthletes navigation={navigation} />;
    }
    return (
      <PostCard
        post={row.item}
        onComment={handleComment}
        onShare={handleShare}
        onUserPress={handleUserPress}
        navigation={navigation}
      />
    );
  }, [handleComment, handleShare, handleUserPress, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: theme.background }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity 
            style={{ paddingVertical: 4, position: 'relative' }}
            onPress={() => setActiveTab('discover')}
          >
            <Text style={{ fontSize: 22, fontWeight: '900', color: activeTab === 'discover' ? theme.text : theme.textMuted, letterSpacing: -0.5 }}>
              {t('feed.discover')}
            </Text>
            {activeTab === 'discover' && <View style={{ position: 'absolute', bottom: -4, left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: theme.primary }} />}
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ paddingVertical: 4, position: 'relative' }}
            onPress={() => setActiveTab('following')}
          >
            <Text style={{ fontSize: 22, fontWeight: '900', color: activeTab === 'following' ? theme.text : theme.textMuted, letterSpacing: -0.5 }}>
              {t('feed.following')}
            </Text>
            {activeTab === 'following' && <View style={{ position: 'absolute', bottom: -4, left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: theme.primary }} />}
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <IconButton icon="magnify" size={24} iconColor={theme.text} style={{ backgroundColor: theme.surface, margin: 0 }} />
          <IconButton icon="bell-outline" size={24} iconColor={theme.text} style={{ backgroundColor: theme.surface, margin: 0 }} />
        </View>
      </Surface>

      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={(row, i) => row.id || row.item?._id || String(i)}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        windowSize={5}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={50}
        initialNumToRender={3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        ListHeaderComponent={
          <View style={{ paddingVertical: 12 }}>
            <StoriesBar onAddStory={() => setShowStoryModal(true)} />
          </View>
        }
        ListEmptyComponent={
          postsLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator animating={true} color={theme.primary} />
              <Text style={{ color: theme.textMuted, marginTop: 16 }}>{t('common.loading', 'Loading...')}</Text>
            </View>
          ) : (
            <View style={{ padding: 80, alignItems: 'center' }}>
              <Ionicons name="document-text-outline" size={64} color={theme.border} />
              <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 16, textAlign: 'center', color: theme.text }}>{t('feed.no_posts', 'No posts yet')}</Text>
            </View>
          )
        }
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Floating Action Button for Create Post */}
      <FAB
        icon="plus"
        color="#fff"
        style={{ position: 'absolute', margin: 16, right: 0, bottom: fabBottom, backgroundColor: theme.primary, borderRadius: 30 }}
        onPress={() => setShowCreatePost(true)}
      />

      {/* Modals */}
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
