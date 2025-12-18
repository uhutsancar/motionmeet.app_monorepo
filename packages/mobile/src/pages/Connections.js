import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-expo';
import { fetchConnections } from '../features/connections/connectionsSlice';
import { acceptConnectionRequest, unfollowUser } from '../api/endpoints';
import { Ionicons } from '@expo/vector-icons';

const Connections = ({ navigation }) => {
  const dispatch = useDispatch();
  const { getToken } = useAuth();
  const [currentTab, setCurrentTab] = useState('Followers');
  const [loading, setLoading] = useState(false);

  const { connections, pendingConnections, followers, following } = useSelector(
    (state) => state.connections
  );

  const dataArray = [
    { label: 'Followers', value: followers, icon: 'people' },
    { label: 'Following', value: following, icon: 'checkmark-circle' },
    { label: 'Pending', value: pendingConnections, icon: 'time' },
    { label: 'Connections', value: connections, icon: 'person-add' },
  ];

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const token = await getToken();
      dispatch(fetchConnections(token));
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleUnfollow = async (userId) => {
    try {
      setLoading(true);
      const token = await getToken();
      const data = await unfollowUser(userId, token);
      if (data.success) {
        Alert.alert('Success', data.message);
        loadConnections();
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptConnection = async (userId) => {
    try {
      setLoading(true);
      const token = await getToken();
      const data = await acceptConnectionRequest(userId, token);
      if (data.success) {
        Alert.alert('Success', data.message);
        loadConnections();
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentTabData = () => {
    const currentData = dataArray.find((item) => item.label === currentTab);
    return currentData?.value || [];
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Connections</Text>
        <Text style={styles.subtitle}>Manage your network</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        {dataArray.map((item, index) => (
          <View key={index} style={styles.statCard}>
            <Text style={styles.statNumber}>{item.value?.length || 0}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {dataArray.map((tab) => (
            <TouchableOpacity
              key={tab.label}
              onPress={() => setCurrentTab(tab.label)}
              style={[
                styles.tab,
                currentTab === tab.label && styles.activeTab,
              ]}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={currentTab === tab.label ? '#4f46e5' : '#6b7280'}
              />
              <Text
                style={[
                  styles.tabText,
                  currentTab === tab.label && styles.activeTabText,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Users List */}
      <ScrollView style={styles.listContainer}>
        {getCurrentTabData()
          .filter(user => user && user._id && user.profile_picture)
          .map((user) => (
          <View key={user._id} style={styles.userCard}>
            <Image
              source={{ uri: user.profile_picture }}
              style={styles.profileImage}
            />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.full_name}</Text>
              <Text style={styles.userUsername}>@{user.username}</Text>
              <Text style={styles.userBio} numberOfLines={2}>
                {user.bio}
              </Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.viewButton}
                onPress={() => navigation.navigate('Profile', { userId: user._id })}
              >
                <Text style={styles.viewButtonText}>View</Text>
              </TouchableOpacity>
              {currentTab === 'Following' && (
                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={() =>
                    navigation.navigate('ChatBox', { userId: user._id, user })
                  }
                >
                  <Ionicons name="chatbubble-outline" size={16} color="#fff" />
                </TouchableOpacity>
              )}
              {currentTab === 'Pending' && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => handleAcceptConnection(user._id)}
                  disabled={loading}
                >
                  <Text style={styles.secondaryButtonText}>Accept</Text>
                </TouchableOpacity>
              )}
              {currentTab === 'Connections' && (
                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={() =>
                    navigation.navigate('Messages', {
                      screen: 'ChatBox',
                      params: { userId: user._id },
                    })
                  }
                >
                  <Ionicons name="chatbubble-outline" size={16} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  tabsContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#eef2ff',
  },
  tabText: {
    fontSize: 14,
    color: '#6b7280',
  },
  activeTabText: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  userUsername: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  userBio: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  actions: {
    justifyContent: 'center',
    gap: 8,
  },
  viewButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '600',
  },
  messageButton: {
    backgroundColor: '#4f46e5',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Connections;
