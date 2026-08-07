import React, { useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { Surface, Text, TouchableRipple } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { followUser, unfollowUser } from '../api/endpoints';
import { fetchUser } from '../features/user/userSlice';
import type { PublicUser } from '@motionmeet/shared';
import { useAppDispatch } from '../store/hooks';

interface SuggestedUser extends PublicUser {
  isFollowing?: boolean;
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
  const dispatch = useAppDispatch();
  const { getToken } = useAuthContext();
  const [processing, setProcessing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(Boolean(user.isFollowing));

  const handleFollow = async () => {
    if (processing) return;
    try {
      setProcessing(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      if (isFollowing) await unfollowUser(user._id, token);
      else await followUser(user._id, token);
      setIsFollowing(!isFollowing);
      dispatch(fetchUser(token));
    } catch {
      Alert.alert(t('common.error'), t('feed.follow_failed'));
    } finally {
      setProcessing(false);
    }
  };

  const secondaryLine = caption ?? `${user.followers_count ?? 0} ${t('feed.followers', 'followers')}`;

  return (
    <Surface
      elevation={0}
      style={{
        width,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {user.profile_picture ? (
          <Image
            source={{ uri: user.profile_picture }}
            style={{ width: 46, height: 46, borderRadius: 23 }}
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
          onPress={handleFollow}
          disabled={processing}
          style={{
            flex: 1,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9,
            backgroundColor: isFollowing ? theme.surfaceLight : theme.primary,
          }}
        >
          <Text style={{ color: isFollowing ? theme.text : '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
            {isFollowing ? t('feed.following_status', 'Following') : t('feed.follow', 'Follow')}
          </Text>
        </TouchableRipple>
        <TouchableRipple
          onPress={() => onPress?.(user)}
          style={{
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9,
            borderWidth: 1,
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
