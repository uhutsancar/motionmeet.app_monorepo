import React, { memo, useCallback, useMemo, useState } from 'react';
// expo-image's native view fails to instantiate on some Android devices
// ("Couldn't create view of type ExpoImageViewWrapper"), which leaves avatars
// blank, so the story bubbles stay on React Native's Image.
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useAppSelector } from '../store/hooks';
import StoryViewer from './StoryViewer';
import StoryRing from './story/StoryRing';
import type { PublicUser, Story } from '@motionmeet/shared';
import type { NavigationLike } from '../navigation/types';

interface StoriesBarProps {
  onAddStory: () => void;
  navigation?: NavigationLike;
  /** Lets the feed refresh the rail after the author deletes a story. */
  onStoryDeleted?: () => void;
}

interface StoryGroup {
  user: PublicUser;
  stories: Story[];
}

const byOldestFirst = (left: Story, right: Story): number =>
  new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

/**
 * The rail of story bubbles above the feed.
 *
 * The author's own bubble is the first one and it is the only one they get:
 * everything they have posted in the last day lives inside "Hikayem", and the
 * plus badge on it adds another. Their stories are never repeated as a separate
 * bubble further down the rail.
 */
const StoriesBar = ({ onAddStory, navigation, onStoryDeleted }: StoriesBarProps) => {
  const { stories } = useAppSelector((state) => state.stories);
  const user = useAppSelector((state) => state.user.value);
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isNarrow } = useResponsiveLayout();

  // Small phones keep the bubbles from touching; wide phones avoid huge gaps.
  const ringSize = isNarrow ? 62 : 70;
  const avatarSize = ringSize - 9;

  /* Which bubble the viewer opened on. It then walks the whole rail from
     there, so what it needs is the position, not one person's stories. */
  const [viewerGroup, setViewerGroup] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);

  const { ownStories, otherGroups } = useMemo(() => {
    const valid = stories.filter(
      (story): story is Story & { user: PublicUser } =>
        Boolean(story?._id && story.user && typeof story.user === 'object'),
    );

    const mine: Story[] = [];
    const byUser = new Map<string, Story[]>();
    for (const story of valid) {
      if (user?._id && story.user._id === user._id) {
        mine.push(story);
        continue;
      }
      const bucket = byUser.get(story.user._id);
      if (bucket) bucket.push(story);
      else byUser.set(story.user._id, [story]);
    }

    mine.sort(byOldestFirst);
    for (const bucket of byUser.values()) bucket.sort(byOldestFirst);

    // Rail order follows who posted most recently, while each bubble plays
    // that person's stories oldest first.
    const groups: StoryGroup[] = [];
    const seen = new Set<string>();
    for (const story of [...valid].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )) {
      if (user?._id && story.user._id === user._id) continue;
      if (seen.has(story.user._id)) continue;
      seen.add(story.user._id);
      groups.push({ user: story.user, stories: byUser.get(story.user._id) ?? [] });
    }

    return { ownStories: mine, otherGroups: groups };
  }, [stories, user?._id]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: theme.background,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        scrollContent: {
          paddingHorizontal: 14,
          gap: 14,
          alignItems: 'flex-start',
        },
        bubble: {
          alignItems: 'center',
          width: ringSize + 8,
        },
        ring: {
          width: ringSize,
          height: ringSize,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
        },
        avatar: {
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
          borderWidth: 2.5,
          borderColor: theme.background,
        },
        avatarFallback: {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.surfaceLight,
        },
        avatarLetter: {
          color: theme.text,
          fontSize: avatarSize * 0.4,
          fontWeight: '700',
        },
        addBadge: {
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.primary,
          borderWidth: 2.5,
          borderColor: theme.background,
        },
        label: {
          fontSize: 11,
          lineHeight: 14,
          color: theme.textMuted,
          textAlign: 'center',
          width: '100%',
          paddingHorizontal: 2,
        },
        labelOwn: {
          color: theme.text,
          fontWeight: '700',
        },
      }),
    [avatarSize, ringSize, theme],
  );

  /**
   * Every group the viewer can reach, in the order the rail shows them.
   *
   * The author's own stories come first, exactly as the bubbles do, so tapping
   * a bubble and then letting the viewer run through to the end covers the rail
   * left to right without ever going back to the feed.
   */
  const viewerGroups = useMemo(
    () => [
      ...(ownStories.length ? [{ stories: ownStories }] : []),
      ...otherGroups.map((group) => ({ stories: group.stories })),
    ],
    [otherGroups, ownStories],
  );

  const openStories = useCallback((index: number) => {
    if (index < 0) return;
    setViewerGroup(index);
    setViewerVisible(true);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerVisible(false);
  }, []);

  const renderAvatar = (picture: string, fallback: string) =>
    picture ? (
      <Image source={{ uri: picture }} style={styles.avatar} />
    ) : (
      <View style={[styles.avatar, styles.avatarFallback]}>
        <Text style={styles.avatarLetter}>{fallback}</Text>
      </View>
    );

  const ownPicture = typeof user?.profile_picture === 'string' ? user.profile_picture.trim() : '';
  const hasOwnStories = ownStories.length > 0;

  return (
    <>
      <View style={styles.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Own bubble: opens what is already posted, the badge adds more. */}
          <Pressable
            style={styles.bubble}
            onPress={() => (hasOwnStories ? openStories(0) : onAddStory())}
            accessibilityRole="button"
            accessibilityLabel={t('feed.your_story', 'Hikayem')}
          >
            <View style={styles.ring}>
              {hasOwnStories && <StoryRing size={ringSize} />}
              {renderAvatar(ownPicture, user?.full_name?.charAt(0)?.toUpperCase() || 'U')}
              <Pressable
                onPress={onAddStory}
                hitSlop={8}
                style={styles.addBadge}
                accessibilityRole="button"
                accessibilityLabel={t('feed.create_story', 'Hikaye olustur')}
              >
                <Ionicons name="add" size={15} color="#FFFFFF" />
              </Pressable>
            </View>
            <Text style={[styles.label, styles.labelOwn]} numberOfLines={1}>
              {t('feed.your_story', 'Hikayem')}
            </Text>
          </Pressable>

          {otherGroups.map(({ user: storyUser }, position) => {
            const picture =
              typeof storyUser.profile_picture === 'string' ? storyUser.profile_picture.trim() : '';
            return (
              <Pressable
                key={storyUser._id}
                style={styles.bubble}
                onPress={() => openStories((ownStories.length ? 1 : 0) + position)}
                accessibilityRole="button"
                accessibilityLabel={storyUser.full_name || storyUser.username}
              >
                <View style={styles.ring}>
                  <StoryRing size={ringSize} />
                  {renderAvatar(
                    picture,
                    (storyUser.full_name || storyUser.username || '?').charAt(0).toUpperCase(),
                  )}
                </View>
                <Text style={styles.label} numberOfLines={1}>
                  {storyUser.full_name?.split(' ')[0] || storyUser.username}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <StoryViewer
        visible={viewerVisible}
        groups={viewerGroups}
        startGroup={viewerGroup}
        startIndex={0}
        navigation={navigation}
        onClose={closeViewer}
        onDeleted={() => {
          closeViewer();
          onStoryDeleted?.();
        }}
      />
    </>
  );
};

export default memo(StoriesBar);
