import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { Post } from '@motionmeet/shared';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { getPost } from '../api/endpoints';
import PostCard from '../components/PostCard';
import ScreenHeader from '../components/ScreenHeader';
import { logHandledError } from '../utils/feedback';
import type { NavigationScreenProps } from '../navigation/types';

type PostScreenProps = NavigationScreenProps<{ postId?: string; post?: Post }>;

/**
 * One post on a screen of its own.
 *
 * This is where a shared link lands once the app is installed: tapping a
 * MotionMeet URL in a chat opens the post here rather than dropping the reader
 * on the feed and leaving them to find it. The post can also be handed over
 * directly, which is what the feed does when it already has it — there is no
 * reason to fetch something that is on screen a moment earlier.
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <PostCard post={post} navigation={navigation} />
        </ScrollView>
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
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 32 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});

export default PostScreen;
