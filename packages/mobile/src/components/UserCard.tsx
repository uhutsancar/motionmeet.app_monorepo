import React from 'react';
import { StyleSheet, View } from 'react-native';
// expo-image: these rows scroll past many remote avatars, and it recycles
// views and keeps a memory + disk cache where React Native's Image does not.
import { Image } from 'expo-image';
import { ActivityIndicator, Surface, Text, TouchableRipple } from 'react-native-paper';
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
  /** Set by carousels so every card matches the screen it is rendered on. */
  width?: number;
  /** Optional chip under the name, e.g. the nearby distance band. */
  badge?: string;
  /**
   * Replaces the follower count, e.g. an approximate area. Pass an empty string
   * to drop the line entirely - callers whose users carry no follower count
   * must not fall through to a hardcoded "0 followers".
   */
  caption?: string;
}

const UserCard = ({ user, onPress, width = 220, badge, caption }: UserCardProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const follow = useFollowAction(user._id, {
    isFollowing: Boolean(user.isFollowing),
    isFollowedBy: Boolean(user.isFollowedBy),
    requestSent: Boolean(user.requestSent),
    requestReceived: Boolean(user.requestReceived),
  });
  // "Following" and "Requested" are settled; the other two are calls to action.
  const settled = follow.state === 'following' || follow.state === 'requested';

  const secondaryLine = caption ?? `${user.followers_count ?? 0} ${t('feed.followers', 'followers')}`;

  return (
    <Surface
      elevation={0}
      style={{
        width,
        padding: 12,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
        backgroundColor: theme.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {user.profile_picture ? (
          <Image
            source={{ uri: mediaVariantUrl(user.profile_picture, 'avatar') }}
            style={{ width: 46, height: 46, borderRadius: 23 }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={user._id}
          />
        ) : (
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.primarySoft,
            }}
          >
            <Text style={{ color: theme.primary, fontSize: 17, fontWeight: '800' }}>
              {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
            {user.full_name}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
            @{user.username || 'member'}
          </Text>
          {secondaryLine ? (
            <Text style={{ color: theme.textMuted, fontSize: 10, marginTop: 3 }} numberOfLines={1}>
              {secondaryLine}
            </Text>
          ) : null}
        </View>
      </View>

      {badge ? (
        <View
          style={{
            alignSelf: 'flex-start',
            marginTop: 10,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: theme.surfaceLight,
          }}
        >
          <Text style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '800' }} numberOfLines={1}>
            {badge}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TouchableRipple
          onPress={() => { void follow.toggle(); }}
          disabled={follow.busy}
          accessibilityLabel={follow.label}
          style={{
            flex: 1,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9,
            backgroundColor: settled ? theme.surfaceLight : theme.primary,
          }}
        >
          {follow.busy ? (
            <ActivityIndicator size="small" color={settled ? theme.text : '#FFFFFF'} />
          ) : (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{ color: settled ? theme.text : '#FFFFFF', fontSize: 12, fontWeight: '800', paddingHorizontal: 6 }}
            >
              {follow.label}
            </Text>
          )}
        </TouchableRipple>
        <TouchableRipple
          onPress={() => onPress?.(user)}
          style={{
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
          }}
        >
          <Ionicons name="arrow-forward" size={17} color={theme.textSecondary} />
        </TouchableRipple>
      </View>
    </Surface>
  );
};

export default UserCard;
