import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-expo';
import { fetchConnections } from '../features/connections/connectionsSlice';
import { getUserRecentMessages } from '../api/endpoints';
import moment from 'moment';

const Messages = ({ navigation }) => {
  const dispatch = useDispatch();
  const { getToken } = useAuth();
  const { connections, loading } = useSelector((state) => state.connections);
  const [recentMessages, setRecentMessages] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    
    // Poll for new messages every 10 seconds
    const pollInterval = setInterval(() => {
      loadRecentMessages();
    }, 10000);

    return () => clearInterval(pollInterval);
  }, []);

  const loadData = async () => {
    await Promise.all([
      loadConnections(),
      loadRecentMessages(),
    ]);
  };

  const loadConnections = async () => {
    try {
      const token = await getToken();
      dispatch(fetchConnections(token));
    } catch (error) {
      console.error('Failed to load connections');
    }
  };

  const loadRecentMessages = async () => {
    try {
      const token = await getToken();
      const data = await getUserRecentMessages(token);
      if (data.success) {
        // Group by sender and get latest
        const grouped = data.messages.reduce((acc, msg) => {
          const senderId = msg.from_user_id._id;
          if (!acc[senderId] || new Date(msg.createdAt) > new Date(acc[senderId].createdAt)) {
            acc[senderId] = msg;
          }
          return acc;
        }, {});
        
        const sorted = Object.values(grouped).sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setRecentMessages(sorted);
      }
    } catch (error) {
      console.error('Failed to load recent messages');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleMessagePress = (user) => {
    navigation.navigate('ChatBox', { userId: user._id, user });
  };

  const handleProfilePress = (user) => {
    navigation.navigate('Profile', { screen: 'ProfileMain', params: { userId: user._id } });
  };

  const renderMessageItem = ({ item: message }) => (
    <TouchableOpacity 
      style={styles.messageCard}
      onPress={() => handleMessagePress(message.from_user_id)}
    >
      <Image 
        source={{ uri: message.from_user_id.profile_picture }}
        style={styles.avatar}
      />
      
      <View style={styles.messageInfo}>
        <View style={styles.messageHeader}>
          <Text style={styles.fullName}>{message.from_user_id.full_name}</Text>
          <Text style={styles.timestamp}>{moment(message.createdAt).fromNow()}</Text>
        </View>
        <Text style={styles.messagePreview} numberOfLines={1}>
          {message.text || message.image_url ? '📷 Photo' : 'No message'}
        </Text>
      </View>

      {!message.seen && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>1</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderUserItem = ({ item: user }) => (
    <View style={styles.userCard}>
      <Image 
        source={{ uri: user.profile_picture }}
        style={styles.avatar}
      />
      
      <View style={styles.userInfo}>
        <Text style={styles.fullName}>{user.full_name}</Text>
        <Text style={styles.username}>@{user.username}</Text>
        {user.bio && (
          <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleMessagePress(user)}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#4f46e5" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleProfilePress(user)}
        >
          <Ionicons name="eye-outline" size={20} color="#4f46e5" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>Talk to your friends and family</Text>
        </View>
      </View>

      {/* Empty State */}
      {!loading && connections.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>No connections yet</Text>
          <Text style={styles.emptySubtext}>Connect with people to start messaging</Text>
        </View>
      )}

      {/* Connections List */}
      {connections.length > 0 && (
        <FlatList
          data={connections}
          renderItem={renderUserItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fullName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  bio: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  actions: {
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
  },
});

export default Messages;
