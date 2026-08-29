import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View, type ListRenderItem } from 'react-native';
import { Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import PostCard from './PostCard';
import type { Post } from '@motionmeet/shared';
import type { NavigationLike } from '../navigation/types';

interface PostViewerModalProps {
  /**
   * The post that was opened, followed by everything after it in the grid.
   *
   * Not one post: opening a tile puts the reader into the feed at that point
   * rather than in a dead end, so the list carries the rest of Keşfet behind
   * it. `null` closes the sheet.
   */
  posts: Post[] | null;
  navigation: NavigationLike;
  onClose: () => void;
  /** Asks the grid for the next page when the reader nears the end. */
  onEndReached?: () => void;
  loadingMore?: boolean;
}

/**
 * Opens one grid tile, and keeps going.
 *
 * It used to show exactly the post that was tapped and nothing else: reaching
 * the next one meant backing out to the grid and finding it, which is not how
 * anybody reads a feed. Now the tapped post is simply where the list starts —
 * scrolling on carries into the rest of Keşfet, and the same paging that fills
 * the grid fills this.
 *
 * It reuses the feed's own card rather than a second, simplified renderer, so
 * liking, commenting and following behave exactly the same whether a post was
 * reached from Keşfet or from the feed.
 */
const PostViewerModal = ({ posts, navigation, onClose, onEndReached, loadingMore }: PostViewerModalProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const handleUserPress = useCallback(
    (userId: string) => {
      onClose();
      navigation.navigate('Profile', { userId });
    },
    [navigation, onClose],
  );

  const renderPost: ListRenderItem<Post> = useCallback(
    ({ item }) => <PostCard post={item} navigation={navigation} onUserPress={handleUserPress} />,
    [handleUserPress, navigation],
  );

  return (
    <Modal
      visible={Boolean(posts?.length)}
      animationType="slide"
      transparent={false}
      presentationStyle="fullScreen"
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + 6, borderBottomColor: theme.border, backgroundColor: theme.surface },
          ]}
        >
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.back', 'Geri')}
          >
            <Ionicons name="arrow-back" size={23} color={theme.text} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>
            {t('explore.post_title', 'Gönderi')}
          </Text>
          <View style={styles.backButton} />
        </View>

        <FlatList
          data={posts ?? []}
          renderItem={renderPost}
          keyExtractor={(item, index) => item._id || String(index)}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={5}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          style={styles.list}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={theme.primary} style={styles.footer} /> : null
          }
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
  },
  list: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  footer: { marginVertical: 18 },
});

export default PostViewerModal;
