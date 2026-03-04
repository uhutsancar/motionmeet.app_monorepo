import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-expo';
import { fetchPosts } from '../features/posts/postsSlice';
import { fetchStories } from '../features/stories/storiesSlice';
import { fetchUser } from '../features/user/userSlice';
import { fetchConnections } from '../features/connections/connectionsSlice';
import StoriesBar from '../components/StoriesBar';
import PostCard from '../components/PostCard';
import CreatePostModal from '../components/CreatePostModal';
import StoryModal from '../components/StoryModal';
import SuggestedAthletes from '../components/SuggestedAthletes';
import Loading from '../components/Loading';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { setAuthToken } from '../api/client';

const Feed = ({ navigation }) => {
  const { theme } = useTheme();
  // Memoize styles
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = 78;
  const fabBottom = TAB_BAR_HEIGHT + insets.bottom + 16;
  const dispatch = useDispatch();
  const { getToken } = useAuth();
  const { stories, loading: storiesLoading } = useSelector((state) => state.stories);
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'discover' && styles.tabButtonActive]}
            onPress={() => setActiveTab('discover')}
          >
            <Text style={[styles.tabText, activeTab === 'discover' && { color: theme.text }]}>
              {t('feed.discover')}
            </Text>
            {activeTab === 'discover' && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'following' && styles.tabButtonActive]}
            onPress={() => setActiveTab('following')}
          >
            <Text style={[styles.tabText, activeTab === 'following' && { color: theme.text }]}>
              {t('feed.following')}
            </Text>
            {activeTab === 'following' && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
          </TouchableOpacity>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.headerButton, { backgroundColor: theme.surface }]}>
            <Ionicons name="search-outline" size={20} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerButton, { backgroundColor: theme.surface }]}>
            <Ionicons name="notifications-outline" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

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
            <View style={styles.loadingContainer}>
              <Text style={{ color: theme.textMuted }}>{t('common.loading', 'Loading...')}</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color={theme.border} />
              <Text style={[styles.emptyText, { color: theme.text }]}>{t('feed.no_posts', 'No posts yet')}</Text>
            </View>
          )
        }
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Floating Action Button for Create Post */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: theme.primary, bottom: fabBottom }]}
        onPress={() => setShowCreatePost(true)}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

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

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.background,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  tabButton: {
    paddingVertical: 4,
    position: 'relative',
  },
  tabText: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.textMuted,
    letterSpacing: -0.5,
  },
  activeIndicator: {
      position: 'absolute',
      bottom: -4,
      left: 0,
      right: 0,
      height: 3,
      borderRadius: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  scrollView: {
    flex: 1,
  },
  postsContainer: {
    paddingBottom: 100,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 80,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  fab: {
      position: 'absolute',
      right: 24,
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
  }
});

export default Feed;
