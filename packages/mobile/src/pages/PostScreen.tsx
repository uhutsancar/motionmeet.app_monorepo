import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator as RNActivityIndicator, FlatList, StatusBar, StyleSheet, View, type ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { Post } from '@motionmeet/shared';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { getPost, getPosts } from '../api/endpoints';
import PostCard from '../components/PostCard';
import ScreenHeader from '../components/ScreenHeader';
import { logHandledError } from '../utils/feedback';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import type { NavigationScreenProps } from '../navigation/types';

type PostScreenProps = NavigationScreenProps<{ postId?: string; post?: Post }>;

/**
 * One post on a screen of its own — and then the rest of the feed under it.
 *
 * This is where a shared link lands once the app is installed: tapping a
 * MotionMeet URL in a chat opens the post here rather than dropping the reader
 * on the feed and leaving them to find it. The post can also be handed over
 * directly, which is what the feed does when it already has it — there is no
 * reason to fetch something that is on screen a moment earlier.
 *
 * What follows it is Keşfet. A screen that ends after one post is a dead end:
 * the reader arrives, reads it, and the only thing left to do is press back.
 * Everything below the post is the discover feed with that post filtered out,
 * paged the same way the feed itself is, so scrolling on keeps working.
 *
 * A post the reader is not allowed to see is a 404 from the server, and is
 * shown the same way a deleted one is: nothing about the link tells them which
 * of the two it was.
 */
const PostScreen = ({ navigation, route }: PostScreenProps) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { getToken } = useAuthContext();
  const passedPost = route.params?.post ?? null;
  const postId = route.params?.postId ?? passedPost?._id ?? '';

  const [post, setPost] = useState<Post | null>(passedPost);
  const [loading, setLoading] = useState(!passedPost);
  const [missing, setMissing] = useState(false);
  const [more, setMore] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Guards the first page: `onEndReached` fires while the list is still short.
  const feedStartedRef = useRef(false);

  const load = useCallback(async () => {
    if (!postId) {
      setMissing(true);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;
      const result = await getPost(postId, token);
      if (result.success && result.post) setPost(result.post);
      else setMissing(true);
    } catch (error) {
      logHandledError('load-shared-post', error);
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [getToken, postId]);

  useEffect(() => {
    if (passedPost) return;
    void load();
  }, [load, passedPost]);

  const loadMore = useCallback(async (cursor?: string) => {
    if (loadingMore) return;
    if (!cursor && feedStartedRef.current) return;
    feedStartedRef.current = true;
    try {
      setLoadingMore(true);
      const token = await getToken();
      if (!token) return;
      const data = await getPosts(token, cursor, 'discover');
      if (!data.success) return;
      setMore((current) => {
        const known = new Set([postId, ...current.map((entry) => entry._id)]);
        return [...current, ...(data.posts || []).filter((entry) => !known.has(entry._id))];
      });
      setNextCursor(data.nextCursor ?? null);
    } catch (error) {
      logHandledError('load-post-screen-feed', error);
    } finally {
      setLoadingMore(false);
    }
  }, [getToken, loadingMore, postId]);

  // The first page is fetched as soon as there is a post to sit above it, so
  // the reader never reaches the bottom of a one-post screen.
  useEffect(() => {
    if (!post) return;
    void loadMore();
    // `loadMore` is guarded against a second first page; depending on it here
    // would re-run this effect every time its own state changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post]);

  const data = useMemo(() => (post ? [post, ...more] : []), [more, post]);
  const listRef = useRef<FlatList<Post>>(null);
  const { keyboardPadding, requestFocusedInputScroll } = useKeyboardAwareScroll(listRef, { onlyWhenRequested: true });

  const renderPost: ListRenderItem<Post> = useCallback(
    ({ item }) => (
      <PostCard
        post={item}
        navigation={navigation}
        onUserPress={(userId) => navigation.navigate('Profile', { userId })}
        onInputFocus={requestFocusedInputScroll}
      />
    ),
    [navigation, requestFocusedInputScroll],
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScreenHeader title={t('explore.post_title', 'Gönderi')} onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : post ? (
        <FlatList
          ref={listRef}
          data={data}
          renderItem={renderPost}
          keyExtractor={(item, index) => item._id || String(index)}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={5}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (nextCursor && !loadingMore) void loadMore(nextCursor);
          }}
          style={styles.list}
          contentContainerStyle={[styles.content, keyboardPadding > 0 && { paddingBottom: 32 + keyboardPadding }]}
          ListFooterComponent={
            loadingMore ? <RNActivityIndicator color={theme.primary} style={styles.footer} /> : null
          }
        />
      ) : missing ? (
        <View style={styles.centre}>
          <Ionicons name="alert-circle-outline" size={30} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {t('post.unavailable_title', 'Bu gönderi artık mevcut değil')}
          </Text>
          <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
            {t('post.unavailable_body', 'Bağlantı kaldırılmış olabilir ya da gönderi herkese açık değil.')}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  content: { paddingBottom: 32 },
  footer: { marginVertical: 18 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});

export default PostScreen;
