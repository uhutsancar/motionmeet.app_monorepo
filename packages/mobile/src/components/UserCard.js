import React, { useState } from 'react';
import { Image, Alert } from 'react-native';
import { Surface, TouchableRipple, Text } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { useAuthContext } from "../context/AuthProvider";
import { Ionicons } from '@expo/vector-icons';
import { followUser, unfollowUser, sendConnectionRequest } from '../api/endpoints';
import { fetchUser } from '../features/user/userSlice';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

const UserCard = ({ user, onPress, onMessagePress }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = getStyles(theme);
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.user.value);
  const { connections } = useSelector((state) => state.connections);
  const { getToken } = useAuthContext();
  const [processing, setProcessing] = useState(false);

  const isFollowing = currentUser?.following?.includes(user._id);
  const isConnected = connections?.some(conn => conn._id === user._id);

  const handleFollow = async () => {
    if (processing) return;
    
    try {
      setProcessing(true);
      const token = await getToken();
      
      if (isFollowing) {
        await unfollowUser(user._id, token);
      } else {
        await followUser(user._id, token);
      }
      
      dispatch(fetchUser(token));
    } catch (error) {
      Alert.alert(t('common.error'), t('feed.follow_failed'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Surface elevation={0} style={styles.card}>
      <Surface elevation={0} style={styles.infoSection}>
        <Image 
          source={{ uri: user.profile_picture }}
          style={styles.avatar}
        />
        <Text style={styles.fullName}>{user.full_name}</Text>
        {user.username && (
          <Text style={styles.username}>@{user.username}</Text>
        )}
        {user.bio && (
          <Text style={styles.bio} numberOfLines={1}>{user.bio}</Text>
        )}
      </Surface>

      <Surface elevation={0} style={styles.metaContainer}>
        <Surface elevation={0} style={[styles.metaBadge, { borderColor: theme.border }]}>
          <Text style={styles.metaText}>{user.followers_count ?? user.followers?.length ?? 0} {t('feed.followers')}</Text>
        </Surface>
      </Surface>

      <Surface elevation={0} style={styles.actionsContainer}>
        <TouchableRipple borderless 
          style={[
            styles.followButton,
            { backgroundColor: isFollowing ? theme.surfaceLight : theme.primary }
          ]}
          onPress={handleFollow}
          disabled={processing}
        >
          <Text style={[styles.followButtonText, { color: isFollowing ? theme.text : '#fff' }]}>
            {isFollowing ? t('feed.following_status') : t('feed.follow')}
          </Text>
        </TouchableRipple>

        <TouchableRipple borderless 
          style={[styles.iconButton, { borderColor: theme.border }]}
          onPress={() => onPress?.(user)}
        >
          <Ionicons 
            name="eye-outline"
            size={18} 
            color={theme.textMuted} 
          />
        </TouchableRipple>
      </Surface>
    </Surface>
  );
};

const getStyles = (theme) => ({
  card: {
    width: 200,
    padding: 16,
    backgroundColor: theme.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.border,
    marginRight: 12,
  },
  infoSection: {
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: theme.background,
  },
  fullName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'center',
  },
  username: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  bio: {
    fontSize: 11,
    color: theme.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 12,
  },
  metaText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.textMuted,
    textTransform: 'uppercase',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  followButton: {
    flex: 1,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
});

export default UserCard;
