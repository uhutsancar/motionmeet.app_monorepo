import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import PostCard from './PostCard';
import type { Post } from '@motionmeet/shared';
import type { NavigationLike } from '../navigation/types';

interface PostViewerModalProps {
  post: Post | null;
  navigation: NavigationLike;
  onClose: () => void;
}

/**
 * Opens one grid tile as the full post.
 *
 * It reuses the feed's own card rather than a second, simplified renderer, so
 * liking, commenting and following behave exactly the same whether a post was
 * reached from Keşfet or from the feed.
 */
const PostViewerModal = ({ post, navigation, onClose }: PostViewerModalProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={Boolean(post)}
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
            {t('explore.post_title', 'Gonderi')}
          </Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {post && (
            <PostCard
              post={post}
              navigation={navigation}
              onUserPress={(userId) => {
                onClose();
                navigation.navigate('Profile', { userId });
              }}
            />
          )}
        </ScrollView>
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
});

export default PostViewerModal;
