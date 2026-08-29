import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
// expo-image: these tiles scroll past many remote images, and it recycles
// views and keeps a memory + disk cache where React Native's Image does not.
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { getPosts } from '../api/endpoints';
import { logHandledError } from '../utils/feedback';
import PostViewerModal from '../components/PostViewerModal';
import { mediaVariantUrl, type Post } from '@motionmeet/shared';
import { useScrollToTopOnTabPress } from '../hooks/useScrollToTopOnTabPress';
import type { NavigationOnlyProps } from '../navigation/types';

/** Instagram's grid, and the one people already know how to read. */
const COLUMNS = 3;
const GRID_GAP = 2;

const firstMedia = (post: Post): { url: string; isVideo: boolean } | null => {
  const entry = post.media?.find((item) => typeof item.url === 'string' && item.url.trim());
  if (entry) return { url: entry.url.trim(), isVideo: entry.mediaType === 'video' };
  const legacy = post.image_urls?.find((url) => typeof url === 'string' && url.trim());
  return legacy ? { url: legacy.trim(), isVideo: false } : null;
};

/**
 * Keşfet: a grid of what the community is posting.
 *
 * The field at the top is a doorway, not an input. Searching used to happen in
 * place here, which tore the grid down on every keystroke and left recent
 * searches nowhere to live; tapping the field pushes the search screen instead,
 * and coming back leaves the grid exactly where it was.
 *
 * The grid only carries posts that have a picture — a wall of text tiles reads
 * as broken — while text-only posts stay discoverable in the feed itself.
 */
const Explore = ({ navigation }: NavigationOnlyProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const { width } = useWindowDimensions();

  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /* The index the reader opened, not the post itself: the viewer needs
     everything from there on so it can keep scrolling into the grid. */
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const gridRef = useRef<FlatList<Post>>(null);
  useScrollToTopOnTabPress(gridRef);

  const tileSize = useMemo(
    () => Math.floor((width - GRID_GAP * (COLUMNS - 1)) / COLUMNS),
    [width],
  );

  const loadPosts = useCallback(
    async (cursor?: string) => {
      try {
        const token = await getToken();
        if (!token) return;
        if (cursor) setLoadingMore(true);
        const data = await getPosts(token, cursor, 'discover');
        if (!data.success) return;
        const withMedia = (data.posts || []).filter((post) => Boolean(firstMedia(post)));
        setPosts((current) => (cursor ? [...current, ...withMedia] : withMedia));
        setNextCursor(data.nextCursor ?? null);
      } catch (error) {
        logHandledError('load-explore-posts', error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [getToken],
  );

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadPosts();
    } finally {
      setRefreshing(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: theme.background },
        nearbyButton: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.surfaceLight,
        },
        searchRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
        },
        searchField: {
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          height: 40,
          paddingHorizontal: 13,
          borderRadius: 12,
          backgroundColor: theme.surfaceLight,
        },
        searchLabel: { flex: 1, minWidth: 0, color: theme.textMuted, fontSize: 15 },
        tile: {
          width: tileSize,
          height: tileSize,
          marginRight: GRID_GAP,
          marginBottom: GRID_GAP,
          backgroundColor: theme.surfaceLight,
        },
        tileLast: { marginRight: 0 },
        tileBadge: { position: 'absolute', top: 6, right: 6 },
        empty: {
          alignItems: 'center',
          gap: 8,
          paddingVertical: 60,
          paddingHorizontal: 32,
        },
        emptyTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },
        emptyHint: {
          color: theme.textMuted,
          fontSize: 12.5,
          lineHeight: 18,
          textAlign: 'center',
        },
      }),
    [theme, tileSize],
  );

  const loadMore = useCallback(() => {
    if (nextCursor && !loadingMore && !loading) void loadPosts(nextCursor);
  }, [loading, loadingMore, loadPosts, nextCursor]);

  /* Memoised: rebuilt inline this was a new array on every render, and the
     viewer's list would have re-diffed itself each time a page arrived. */
  const openedPosts = useMemo(
    () => (openIndex === null ? null : posts.slice(openIndex)),
    [openIndex, posts],
  );

  const renderTile: ListRenderItem<Post> = useCallback(
    ({ item, index }) => {
      const media = firstMedia(item);
      if (!media) return null;
      return (
        <Pressable
          onPress={() => setOpenIndex(index)}
          style={[styles.tile, (index + 1) % COLUMNS === 0 && styles.tileLast]}
          accessibilityRole="button"
          accessibilityLabel={item.content || t('explore.open_post', 'Gonderiyi ac')}
        >
          <Image
            source={{ uri: mediaVariantUrl(media.url, 'thumb') }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={item._id}
            transition={100}
          />
          {media.isVideo && (
            <Ionicons name="play" size={17} color="#FFFFFF" style={styles.tileBadge} />
          )}
          {(item.media?.length ?? item.image_urls?.length ?? 0) > 1 && !media.isVideo && (
            <Ionicons name="copy-outline" size={15} color="#FFFFFF" style={styles.tileBadge} />
          )}
        </Pressable>
      );
    },
    [styles, t],
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.searchRow}>
        <Pressable
          style={styles.searchField}
          onPress={() => navigation.navigate('SearchScreen')}
          accessibilityRole="search"
          accessibilityLabel={t('explore.search_placeholder', 'Ara')}
        >
          <Ionicons name="search" size={17} color={theme.textMuted} />
          <Text style={styles.searchLabel}>{t('explore.search_placeholder', 'Ara')}</Text>
        </Pressable>
        {/* Meeting people is what this app is for, and finding the ones nearby
            was three screens deep — inside Connections, or under a Location
            heading in Settings. It belongs next to the search field, on the
            screen people already open to look for someone. */}
        <Pressable
          style={styles.nearbyButton}
          onPress={() => navigation.navigate('NearbyScreen')}
          accessibilityRole="button"
          accessibilityLabel={t('nearby.title', 'Yakındakiler')}
        >
          <Ionicons name="location-outline" size={19} color={theme.text} />
        </Pressable>
      </View>

      <FlatList
        ref={gridRef}
        data={posts}
        renderItem={renderTile}
        keyExtractor={(item, index) => item._id || String(index)}
        numColumns={COLUMNS}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={18}
        maxToRenderPerBatch={18}
        windowSize={7}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        onEndReachedThreshold={0.5}
        onEndReached={loadMore}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 48 }} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="images-outline" size={28} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>
                {t('explore.empty', 'Henuz kesfedilecek bir sey yok')}
              </Text>
              <Text style={styles.emptyHint}>
                {t('explore.empty_hint', 'Ilk gorseli sen paylas ya da birilerini takip et.')}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 18 }} />
          ) : null
        }
      />

      <PostViewerModal
        posts={openedPosts}
        navigation={navigation}
        onClose={() => setOpenIndex(null)}
        onEndReached={loadMore}
        loadingMore={loadingMore}
      />
    </SafeAreaView>
  );
};

export default Explore;
