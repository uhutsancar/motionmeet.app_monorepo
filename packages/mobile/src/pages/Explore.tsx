import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Keyboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { discoverUsers, getPosts } from '../api/endpoints';
import { logHandledError } from '../utils/feedback';
import PostViewerModal from '../components/PostViewerModal';
import type { Post, PublicUser } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';

/** Instagram's grid, and the one people already know how to read. */
const COLUMNS = 3;
const GRID_GAP = 2;
/** Long enough that a fast typist makes one request, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 280;

const firstMedia = (post: Post): { url: string; isVideo: boolean } | null => {
  const entry = post.media?.find((item) => typeof item.url === 'string' && item.url.trim());
  if (entry) return { url: entry.url.trim(), isVideo: entry.mediaType === 'video' };
  const legacy = post.image_urls?.find((url) => typeof url === 'string' && url.trim());
  return legacy ? { url: legacy.trim(), isVideo: false } : null;
};

/**
 * Keşfet: a grid of what the community is posting, and the way to find people.
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

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [openPost, setOpenPost] = useState<Post | null>(null);

  // Only the newest search may write to the list: a slow request for "uh" must
  // not land on top of the results for "uhut".
  const searchSequence = useRef(0);

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

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      searchSequence.current += 1;
      setResults([]);
      setSearching(false);
      return;
    }

    const sequence = (searchSequence.current += 1);
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const token = await getToken();
          if (!token) return;
          const data = await discoverUsers(term, token);
          if (sequence !== searchSequence.current) return;
          setResults(data.success ? data.users || [] : []);
        } catch (error) {
          logHandledError('explore-search', error);
          if (sequence === searchSequence.current) setResults([]);
        } finally {
          if (sequence === searchSequence.current) setSearching(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [getToken, query]);

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
          height: 42,
          paddingHorizontal: 13,
          borderRadius: 21,
          backgroundColor: theme.surfaceLight,
        },
        searchInput: {
          flex: 1,
          minWidth: 0,
          color: theme.text,
          fontSize: 15,
          padding: 0,
        },
        cancel: {
          color: theme.primary,
          fontSize: 14,
          fontWeight: '700',
        },
        tile: {
          width: tileSize,
          height: tileSize,
          marginRight: GRID_GAP,
          marginBottom: GRID_GAP,
          backgroundColor: theme.surfaceLight,
        },
        tileLast: { marginRight: 0 },
        tileBadge: {
          position: 'absolute',
          top: 6,
          right: 6,
        },
        resultRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 10,
        },
        resultAvatar: {
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: theme.surfaceLight,
        },
        resultAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
        resultAvatarLetter: { color: theme.text, fontSize: 18, fontWeight: '800' },
        resultName: { color: theme.text, fontSize: 14.5, fontWeight: '700' },
        resultHandle: { color: theme.textMuted, fontSize: 12.5, marginTop: 1 },
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

  const renderTile: ListRenderItem<Post> = useCallback(
    ({ item, index }) => {
      const media = firstMedia(item);
      if (!media) return null;
      return (
        <Pressable
          onPress={() => setOpenPost(item)}
          style={[styles.tile, (index + 1) % COLUMNS === 0 && styles.tileLast]}
          accessibilityRole="button"
          accessibilityLabel={item.content || t('explore.open_post', 'Gonderiyi ac')}
        >
          <Image source={{ uri: media.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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

  const renderResult: ListRenderItem<PublicUser> = useCallback(
    ({ item }) => {
      const picture =
        typeof item.profile_picture === 'string' ? item.profile_picture.trim() : '';
      return (
        <Pressable
          style={styles.resultRow}
          onPress={() => {
            Keyboard.dismiss();
            navigation.navigate('Profile', { userId: item._id });
          }}
          accessibilityRole="button"
          accessibilityLabel={item.full_name || item.username}
        >
          {picture ? (
            <Image source={{ uri: picture }} style={styles.resultAvatar} />
          ) : (
            <View style={[styles.resultAvatar, styles.resultAvatarFallback]}>
              <Text style={styles.resultAvatarLetter}>
                {(item.full_name || item.username || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.resultName}>
              {item.full_name || item.username}
            </Text>
            <Text numberOfLines={1} style={styles.resultHandle}>
              @{item.username}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
        </Pressable>
      );
    },
    [navigation, styles, theme.textMuted],
  );

  const searchMode = query.trim().length > 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={17} color={theme.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('explore.search_placeholder', 'Ara')}
            placeholderTextColor={theme.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            maxLength={60}
          />
          {searchMode && (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.clear', 'Temizle')}
            >
              <Ionicons name="close-circle" size={17} color={theme.textMuted} />
            </Pressable>
          )}
        </View>
        {searchMode && (
          <Pressable
            onPress={() => {
              setQuery('');
              Keyboard.dismiss();
            }}
            accessibilityRole="button"
          >
            <Text style={styles.cancel}>{t('common.cancel', 'Vazgec')}</Text>
          </Pressable>
        )}
      </View>

      {/* The two lists carry distinct keys on purpose. Without them React
          reuses one FlatList across the switch, and changing `numColumns` on a
          mounted list is a hard invariant violation rather than a re-layout. */}
      {searchMode ? (
        <FlatList
          key="people"
          data={results}
          renderItem={renderResult}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            searching ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
            ) : query.trim().length < 2 ? (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={26} color={theme.textMuted} />
                <Text style={styles.emptyHint}>
                  {t('explore.search_hint', 'Aramak icin en az iki harf yaz.')}
                </Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="person-outline" size={26} color={theme.textMuted} />
                <Text style={styles.emptyTitle}>
                  {t('explore.no_results', 'Sonuc bulunamadi')}
                </Text>
                <Text style={styles.emptyHint}>
                  {t('explore.no_results_hint', 'Kullanici adini ya da ismi kontrol et.')}
                </Text>
              </View>
            )
          }
        />
      ) : (
        <FlatList
          key="grid"
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
          onEndReached={() => {
            if (nextCursor && !loadingMore && !loading) void loadPosts(nextCursor);
          }}
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
      )}

      <PostViewerModal
        post={openPost}
        navigation={navigation}
        onClose={() => setOpenPost(null)}
      />
    </SafeAreaView>
  );
};

export default Explore;
