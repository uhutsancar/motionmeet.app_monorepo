import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { followUser, unfollowUser, sendConnectionRequest } from '../api/endpoints';
import { fetchUser } from '../features/user/userSlice';

const UserCard = ({ user, onPress, onMessagePress }) => {
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.user.value);
  const { connections } = useSelector((state) => state.connections);
  const { getToken } = useAuth();
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
      
      // Reload user data to update following list
      dispatch(fetchUser(token));
    } catch (error) {
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setProcessing(false);
    }
  };

  const handleConnect = async () => {
    if (processing) return;
    
    try {
      setProcessing(true);
      const token = await getToken();
      await sendConnectionRequest(user._id, token);
      Alert.alert('Success', 'Connection request sent');
    } catch (error) {
      Alert.alert('Error', 'Failed to send connection request');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* User Info */}
      <View style={styles.infoSection}>
        <Image 
          source={{ uri: user.profile_picture }}
          style={styles.avatar}
        />
        <Text style={styles.fullName}>{user.full_name}</Text>
        {user.username && (
          <Text style={styles.username}>@{user.username}</Text>
        )}
        {user.bio && (
          <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text>
        )}
      </View>

      {/* Meta Info */}
      <View style={styles.metaContainer}>
        {user.location && (
          <View style={styles.metaBadge}>
            <Ionicons name="location-outline" size={14} color="#6b7280" />
            <Text style={styles.metaText}>{user.location}</Text>
          </View>
        )}
        <View style={styles.metaBadge}>
          <Text style={styles.metaText}>{user.followers?.length || 0} Followers</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[
            styles.followButton,
            isFollowing && styles.followingButton
          ]}
          onPress={handleFollow}
          disabled={processing}
        >
          <Ionicons 
            name={isFollowing ? "checkmark" : "person-add-outline"} 
            size={16} 
            color="#fff" 
          />
          <Text style={styles.followButtonText}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>

        {isFollowing ? (
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => onMessagePress?.(user)}
          >
            <Ionicons 
              name="chatbubble-outline"
              size={20} 
              color="#6b7280" 
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => onPress?.(user)}
          >
            <Ionicons 
              name="eye-outline"
              size={20} 
              color="#6b7280" 
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 280,
    padding: 16,
    paddingTop: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  infoSection: {
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 12,
  },
  fullName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  bio: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 16,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  followButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#4f46e5',
    borderRadius: 8,
  },
  followingButton: {
    backgroundColor: '#6366f1',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  iconButton: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
  },
});

export default UserCard;
