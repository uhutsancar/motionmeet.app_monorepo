import React, { useState, memo, useMemo } from 'react';
import { Image, ScrollView } from 'react-native';
import { useSelector } from 'react-redux';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import StoryViewer from './StoryViewer';
import { Surface, TouchableRipple, Text } from 'react-native-paper';

const StoriesBar = ({ onAddStory }) => {
  const { stories } = useSelector((state) => state.stories);
  const user = useSelector((state) => state.user.value);
  const { t } = useTranslation();
  const { theme } = useTheme();

  const styles = useMemo(() => ({
    container: {
      backgroundColor: theme.background,
      paddingVertical: 10,
    },
    scrollContent: {
      paddingHorizontal: 16,
      gap: 10,
      alignItems: 'center',
    },
    storyContainer: {
      alignItems: 'center',
      width: 66,
      borderRadius: 12,
    },
    createStoryRing: {
      width: 62,
      height: 62,
      borderRadius: 31,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      marginBottom: 5,
      backgroundColor: 'transparent'
    },
    storyRing: {
      width: 62,
      height: 62,
      borderRadius: 31,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 5,
      padding: 2,
      position: 'relative',
      backgroundColor: 'transparent'
    },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      borderWidth: 2,
      borderColor: theme.background,
    },
    placeholderAvatar: {
      backgroundColor: theme.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholderText: {
      color: theme.text,
      fontSize: 24,
      fontWeight: 'bold',
    },
    addButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.background,
    },
    countBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: theme.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: theme.background,
    },
    countText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: 'bold',
    },
    usernameText: {
      fontSize: 10.5,
      color: theme.textMuted,
      textAlign: 'center',
      maxWidth: 64,
    },
  }), [theme]);

  // viewerStories: all stories of selected user, in chronological order
  const [viewerStories, setViewerStories] = useState([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const userProfilePicture =
    typeof user?.profile_picture === 'string'
      ? user.profile_picture.trim()
      : '';

  // Group stories by user — keep all stories per user, show 1 bubble per user
  const groupedByUser = useMemo(() => {
    const valid = (stories || []).filter(s => s && s._id && s.user && s.user._id);
    const map = {};
    for (const story of valid) {
      const uid = story.user._id;
      if (!map[uid]) map[uid] = [];
      map[uid].push(story);
    }
    // Sort each user's stories chronologically
    for (const uid of Object.keys(map)) {
      map[uid].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }
    // Return array of { user, stories }, keep insertion order (most recent post first)
    const userOrder = [];
    const seen = {};
    for (const story of [...valid].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))) {
      if (!seen[story.user._id]) {
        seen[story.user._id] = true;
        userOrder.push({ user: story.user, stories: map[story.user._id] });
      }
    }
    return userOrder;
  }, [stories]);

  const handleStoryPress = (userStories) => {
    setViewerStories(userStories);
    setViewerVisible(true);
  };

  const handleClose = () => {
    setViewerVisible(false);
    setViewerStories([]);
  };

  return (
    <>
      <Surface elevation={0} style={styles.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Create Story Button */}
          <TouchableRipple
            style={styles.storyContainer}
            onPress={onAddStory}
            borderless
          >
            <Surface elevation={0} style={{ backgroundColor: 'transparent', alignItems: 'center' }}>
              <Surface elevation={0} style={styles.createStoryRing}>
                {userProfilePicture ? (
                  <Image
                    source={{ uri: userProfilePicture }}
                    style={styles.avatar}
                  />
                ) : (
                  <Surface elevation={0} style={[styles.avatar, styles.placeholderAvatar]}>
                    <Text style={styles.placeholderText}>
                      {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                  </Surface>
                )}
                <Surface elevation={0} style={styles.addButton}>
                  <Ionicons name="add" size={16} color="#fff" />
                </Surface>
              </Surface>
              <Text style={styles.usernameText} numberOfLines={1}>
                {t('feed.your_story', 'Hikayem')}
              </Text>
            </Surface>
          </TouchableRipple>

          {/* One bubble per user, contains all their stories */}
          {groupedByUser.map(({ user: storyUser, stories: userStories }) => {
            const storyProfilePicture =
              typeof storyUser.profile_picture === 'string'
                ? storyUser.profile_picture.trim()
                : '';
            return (
              <TouchableRipple
                key={storyUser._id}
                style={styles.storyContainer}
                onPress={() => handleStoryPress(userStories)}
                borderless
              >
                <Surface elevation={0} style={{ backgroundColor: 'transparent', alignItems: 'center' }}>
                  <Surface elevation={0} style={[styles.storyRing, { borderColor: theme.primary }]}>
                    {storyProfilePicture ? (
                      <Image
                        source={{ uri: storyProfilePicture }}
                        style={styles.avatar}
                      />
                    ) : (
                      <Surface elevation={0} style={[styles.avatar, styles.placeholderAvatar]}>
                        <Text style={styles.placeholderText}>
                          {storyUser?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                        </Text>
                      </Surface>
                    )}
                    {/* Story count badge if > 1 */}
                    {userStories.length > 1 && (
                      <Surface elevation={0} style={styles.countBadge}>
                        <Text style={styles.countText}>{userStories.length}</Text>
                      </Surface>
                    )}
                  </Surface>
                  <Text style={styles.usernameText} numberOfLines={1}>
                    {storyUser.full_name?.split(' ')[0] || storyUser.username}
                  </Text>
                </Surface>
              </TouchableRipple>
            );
          })}
        </ScrollView>
      </Surface>

      {/* Multi-story viewer */}
      <StoryViewer
        visible={viewerVisible}
        stories={viewerStories}
        startIndex={0}
        onClose={handleClose}
      />
    </>
  );
};

export default memo(StoriesBar);
