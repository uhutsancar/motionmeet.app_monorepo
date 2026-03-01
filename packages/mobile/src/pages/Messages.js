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
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { fetchConnections } from '../features/connections/connectionsSlice';
import { getUserRecentMessages } from '../api/endpoints';
import moment from 'moment';
import 'moment/locale/tr';

const Messages = ({ navigation }) => {
  const dispatch = useDispatch();
  const { getToken } = useAuth();
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme);
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
          {message.text || (message.image_url ? `📷 ${t('common.photo', 'Photo')}` : t('messages.no_message', 'No message'))}
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
          <Text style={styles.headerTitle}>{t('messages.title', 'Messages')}</Text>
          <Text style={styles.headerSubtitle}>{t('messages.subtitle', 'Talk to your friends and family')}</Text>
        </View>
      </View>

      {/* Empty State */}
      {!loading && connections.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={theme.border} />
          <Text style={styles.emptyText}>{t('messages.no_connections', 'No connections yet')}</Text>
          <Text style={styles.emptySubtext}>{t('messages.connect_to_start', 'Connect with people to start messaging')}</Text>
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

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    minHeight: 80,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.textMuted,
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
    color: theme.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.textMuted,
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
    backgroundColor: theme.surface,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.border,
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
    fontWeight: 'bold',
    color: theme.text,
  },
  username: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 2,
  },
  bio: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.surface,
    borderRadius: 12,
    marginBottom: 8,
  },
  messageInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: theme.textMuted,
  },
  messagePreview: {
    fontSize: 14,
    color: theme.textMuted,
  },
  unreadBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});

export default Messages;
