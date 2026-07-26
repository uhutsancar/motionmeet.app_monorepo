import React, { useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { Surface, Text, TouchableRipple } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { followUser, unfollowUser } from '../api/endpoints';
import { fetchUser } from '../features/user/userSlice';

const UserCard = ({ user, onPress }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.user.value);
  const { connections } = useSelector((state) => state.connections);
  const { getToken } = useAuthContext();
  const [processing, setProcessing] = useState(false);
  const isFollowing = currentUser?.following?.includes(user._id);
  const isConnected = connections?.some((connection) => connection._id === user._id);

  const handleFollow = async () => {
    if (processing) return;
    try {
      setProcessing(true);
      const token = await getToken();
      if (isFollowing) await unfollowUser(user._id, token);
      else await followUser(user._id, token);
      dispatch(fetchUser(token));
    } catch {
      Alert.alert(t('common.error'), t('feed.follow_failed'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Surface
      elevation={0}
      style={{
        width: 220,
        padding: 12,
        marginRight: 10,
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
          <Text style={{ color: theme.textMuted, fontSize: 10, marginTop: 3 }} numberOfLines={1}>
            {user.followers_count ?? user.followers?.length ?? 0} {t('feed.followers', 'followers')}
            {isConnected ? ` · ${t('feed.connected', 'connected')}` : ''}
          </Text>
        </View>
      </View>

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
