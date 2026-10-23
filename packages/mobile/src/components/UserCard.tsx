import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
// expo-image: these rows scroll past many remote avatars, and it recycles
// views and keeps a memory + disk cache where React Native's Image does not.
import { Image } from 'expo-image';
import { ActivityIndicator, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useFollowAction } from '../hooks/useFollowAction';
import { mediaVariantUrl, type PublicUser } from '@motionmeet/shared';

interface SuggestedUser extends PublicUser {
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  requestSent?: boolean;
  requestReceived?: boolean;
  followers_count?: number;
}

interface UserCardProps {
  user: SuggestedUser;
  onPress?: (user: SuggestedUser) => void;
  /** Hides the card from the row it sits in. */
  onDismiss?: (user: SuggestedUser) => void;
  /** Set by carousels so every card matches the screen it is rendered on. */
  width?: number;
  /** A short fact under the name, e.g. the nearby distance band. */
  badge?: string;
  /**
   * Replaces the follower count, e.g. an approximate area. Pass an empty string
   * to drop the line entirely - callers whose users carry no follower count
   * must not fall through to a hardcoded "0 followers".
   */
  caption?: string;
}

/** Wide enough for a 72pt picture and a two-word name; the next card peeks in. */
export const PEOPLE_CARD_WIDTH = 150;
const PICTURE = 72;

/**
 * A person in a horizontal row, as Instagram's "Suggested for you" draws one:
 * a picture large enough to recognise someone by, the name under it, and one
 * small Follow button at the foot. The whole card opens the profile; the old
 * card squeezed a 46pt avatar beside the name and spent its width on a
 * full-size Follow button and a separate arrow button.
 */
const UserCard = ({ user, onPress, onDismiss, width = PEOPLE_CARD_WIDTH, badge, caption }: UserCardProps) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const follow = useFollowAction(user._id, {
    isFollowing: Boolean(user.isFollowing),
    isFollowedBy: Boolean(user.isFollowedBy),
    requestSent: Boolean(user.requestSent),
    requestReceived: Boolean(user.requestReceived),
  });
  // "Following" and "Requested" are settled; the other two are calls to action.
  const settled = follow.state === 'following' || follow.state === 'requested';
  const followers = user.followers_count ?? 0;
  const secondaryLine = caption ?? (followers > 0
    ? t('feed.followers_count', { count: followers, defaultValue: '{{count}} takipçi' })
    : t('feed.suggested_for_you', 'Senin için önerildi'));

  return (
    <Pressable
      onPress={() => onPress?.(user)}
      accessibilityRole="button"
      accessibilityLabel={user.full_name || user.username}
      style={({ pressed }) => [
        styles.card,
        {
          width,
          backgroundColor: isDark ? theme.surface : theme.background,
          borderColor: theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {onDismiss ? (
        <Pressable
          onPress={() => onDismiss(user)}
          hitSlop={8}
          style={styles.dismiss}
          accessibilityRole="button"
          accessibilityLabel={t('common.hide', 'Gizle')}
        >
          <Ionicons name="close" size={16} color={theme.textMuted} />
        </Pressable>
      ) : null}

      {user.profile_picture ? (
        <Image
          source={{ uri: mediaVariantUrl(user.profile_picture, 'avatar') }}
          style={[styles.picture, { backgroundColor: theme.surfaceLight }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={user._id}
        />
      ) : (
        <View style={[styles.picture, styles.initialWrap, { backgroundColor: theme.surfaceLight }]}>
          <Text style={{ color: theme.textSecondary, fontSize: 26, fontWeight: '500' }}>
            {(user.full_name || user.username || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
        {user.full_name || user.username}
      </Text>
      <Text style={[styles.caption, { color: theme.textMuted }]} numberOfLines={1}>
        {badge ? [badge, secondaryLine].filter(Boolean).join(' · ') : secondaryLine || `@${user.username}`}
      </Text>

      <Pressable
        onPress={() => { void follow.toggle(); }}
        disabled={follow.busy}
        accessibilityRole="button"
        accessibilityLabel={follow.label}
        style={({ pressed }) => [
          styles.follow,
          { backgroundColor: settled ? theme.surfaceLight : theme.primary, opacity: pressed ? 0.75 : 1 },
        ]}
      >
        {follow.busy ? (
          <ActivityIndicator size="small" color={settled ? theme.text : '#FFFFFF'} />
        ) : (
          <Text numberOfLines={1} style={[styles.followLabel, { color: settled ? theme.text : '#FFFFFF' }]}>
            {follow.label}
          </Text>
        )}
      </Pressable>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dismiss: { position: 'absolute', top: 6, right: 6, padding: 2, zIndex: 1 },
  picture: { width: PICTURE, height: PICTURE, borderRadius: PICTURE / 2 },
  initialWrap: { alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: 10, fontSize: 13.5, fontWeight: '600', textAlign: 'center' },
  caption: { marginTop: 2, fontSize: 12, textAlign: 'center' },
  follow: {
    alignSelf: 'stretch',
    height: 30,
    marginTop: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  followLabel: { fontSize: 13, fontWeight: '600' },
});

export default UserCard;
