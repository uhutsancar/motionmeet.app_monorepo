import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import moment from 'moment';
import 'moment/locale/tr';

const UserProfileInfo = ({ 
  user, 
  posts, 
  isOwnProfile, 
  onEditPress,
  onConnectionsPress 
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  // ALL hooks must be called before any conditional returns
  const connections = useSelector((state) => state.connections);

  // Don't render if user is not loaded
  if (!user) {
    return null;
  }

  const followers = connections.followers?.length || user.followers?.length || 0;
  const following = connections.following?.length || user.following?.length || 0;

  return (
    <View style={styles.container}>
      {/* Profile Picture - Positioned over cover */}
      <View style={styles.avatarContainer}>
        <Image 
          source={{ uri: user.profile_picture }}
          style={styles.avatar}
        />
      </View>

      {/* User Info */}
      <View style={styles.infoContainer}>
        {/* Name and Edit Button Row */}
        <View style={styles.topRow}>
          <View style={styles.nameContainer}>
            <View style={styles.nameRow}>
              <Text style={[styles.fullName, { color: theme.text }]}>{user.full_name}</Text>
              {user.is_verified && (
                <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
              )}
            </View>
            <Text style={[styles.username, { color: theme.textMuted }]}>
              @{user.username || t('profile.add_username')}
            </Text>
          </View>

          {isOwnProfile && (
            <TouchableOpacity 
              style={[styles.editButton, { borderColor: theme.border }]}
              onPress={onEditPress}
            >
              <Ionicons name="create-outline" size={18} color={theme.primary} />
              <Text style={[styles.editButtonText, { color: theme.text }]}>{t('profile.edit_profile')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bio */}
        {user.bio && (
          <Text style={[styles.bio, { color: theme.text }]}>{user.bio}</Text>
        )}

        {/* Location and Join Date */}
        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={16} color={theme.textMuted} />
            <Text style={[styles.metaText, { color: theme.textMuted }]}>
              {user.location || t('profile.add_location')}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={16} color={theme.textMuted} />
            <Text style={[styles.metaText, { color: theme.textMuted }]}>
              {t('profile.joined')} {moment(user.createdAt).fromNow()}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.text }]}>{posts.length}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>{t('feed.post')}</Text>
          </TouchableOpacity>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <TouchableOpacity 
            style={styles.statItem}
            onPress={onConnectionsPress}
          >
            <Text style={[styles.statNumber, { color: theme.text }]}>{followers}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>{t('profile.followers')}</Text>
          </TouchableOpacity>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <TouchableOpacity 
            style={styles.statItem}
            onPress={onConnectionsPress}
          >
            <Text style={[styles.statNumber, { color: theme.text }]}>{following}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>{t('profile.following')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 0,
  },
  avatarContainer: {
    position: 'absolute',
    top: -64,
    left: 24,
    zIndex: 10,
  },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: theme.surface,
  },
  infoContainer: {
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  nameContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  fullName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  username: {
    fontSize: 16,
    color: '#6b7280',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  bio: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  metaContainer: {
    gap: 8,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#6b7280',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#e5e7eb',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
});

export default UserProfileInfo;
