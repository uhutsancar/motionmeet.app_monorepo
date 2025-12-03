import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';

const UserProfileInfo = ({ user, posts, isOwnProfile, onEditPress }) => {
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
              <Text style={styles.fullName}>{user.full_name}</Text>
              {user.is_verified && (
                <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
              )}
            </View>
            <Text style={styles.username}>
              @{user.username || 'Add a username'}
            </Text>
          </View>

          {isOwnProfile && (
            <TouchableOpacity 
              style={styles.editButton}
              onPress={onEditPress}
            >
              <Ionicons name="create-outline" size={18} color="#374151" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bio */}
        {user.bio && (
          <Text style={styles.bio}>{user.bio}</Text>
        )}

        {/* Location and Join Date */}
        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={16} color="#6b7280" />
            <Text style={styles.metaText}>
              {user.location || 'Add location'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={16} color="#6b7280" />
            <Text style={styles.metaText}>
              Joined {moment(user.createdAt).fromNow()}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{posts.length}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{user.followers?.length || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{user.following?.length || 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
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
    borderColor: '#fff',
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
    borderTopColor: '#e5e7eb',
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
