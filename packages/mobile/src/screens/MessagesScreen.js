import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';

// Mock conversations data
const mockConversations = [
  {
    id: '1',
    user: {
      name: 'Sarah Johnson',
      avatar: null,
      online: true,
    },
    lastMessage: 'Hey! Want to join our workout group tomorrow?',
    timestamp: '2 min ago',
    unread: 2,
  },
  {
    id: '2',
    user: {
      name: 'Mike Chen',
      avatar: null,
      online: false,
    },
    lastMessage: 'Great job on your PR! 🎉',
    timestamp: '1 hour ago',
    unread: 0,
  },
  {
    id: '3',
    user: {
      name: 'Emma Davis',
      avatar: null,
      online: true,
    },
    lastMessage: 'Thanks for the yoga tips!',
    timestamp: '3 hours ago',
    unread: 0,
  },
  {
    id: '4',
    user: {
      name: 'James Wilson',
      avatar: null,
      online: false,
    },
    lastMessage: 'See you at the CrossFit box!',
    timestamp: '1 day ago',
    unread: 0,
  },
  {
    id: '5',
    user: {
      name: 'Fitness Group Chat',
      avatar: null,
      online: false,
      isGroup: true,
    },
    lastMessage: 'Alex: Who\'s up for a run this weekend?',
    timestamp: '2 days ago',
    unread: 5,
  },
];

const ConversationItem = ({ conversation, onPress }) => (
  <TouchableOpacity 
    style={[styles.conversationItem, conversation.unread > 0 && styles.unreadItem]}
    onPress={() => onPress(conversation)}
  >
    <View style={styles.avatarContainer}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {conversation.user.name.charAt(0)}
        </Text>
      </View>
      {conversation.user.online && <View style={styles.onlineIndicator} />}
    </View>

    <View style={styles.conversationContent}>
      <View style={styles.conversationHeader}>
        <Text style={[styles.userName, conversation.unread > 0 && styles.unreadText]}>
          {conversation.user.name}
        </Text>
        <Text style={styles.timestamp}>{conversation.timestamp}</Text>
      </View>
      <Text 
        style={[styles.lastMessage, conversation.unread > 0 && styles.unreadMessage]}
        numberOfLines={1}
      >
        {conversation.lastMessage}
      </Text>
    </View>

    {conversation.unread > 0 && (
      <View style={styles.unreadBadge}>
        <Text style={styles.unreadCount}>{conversation.unread}</Text>
      </View>
    )}
  </TouchableOpacity>
);

export default function MessagesScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchConversations = async () => {
    try {
      // TODO: Replace with actual API call
      // const data = await api.getMessages();
      await new Promise(resolve => setTimeout(resolve, 500));
      setConversations(mockConversations);
    } catch (err) {
      console.log('Fetch conversations failed:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const handleConversationPress = (conversation) => {
    // TODO: Navigate to chat screen
    console.log('Open conversation:', conversation.user.name);
  };

  const handleNewMessage = () => {
    // TODO: Navigate to new message screen
    console.log('New message pressed');
  };

  const filteredConversations = conversations.filter(conv =>
    conv.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity style={styles.newButton} onPress={handleNewMessage}>
          <Text style={styles.newButtonText}>✏️</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Online Users */}
      <View style={styles.onlineUsersSection}>
        <Text style={styles.sectionTitle}>Online Now</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={conversations.filter(c => c.user.online)}
          keyExtractor={(item) => `online-${item.id}`}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.onlineUser} onPress={() => handleConversationPress(item)}>
              <View style={styles.onlineAvatar}>
                <Text style={styles.onlineAvatarText}>{item.user.name.charAt(0)}</Text>
              </View>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineUserName} numberOfLines={1}>
                {item.user.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.onlineUsersList}
        />
      </View>

      {/* Conversations */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConversationItem 
            conversation={item} 
            onPress={handleConversationPress}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>No conversations</Text>
            <Text style={styles.emptySubtext}>Start a chat with fellow athletes</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  newButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newButtonText: {
    fontSize: 18,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  onlineUsersSection: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  onlineUsersList: {
    paddingHorizontal: 12,
  },
  onlineUser: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 60,
  },
  onlineAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  onlineAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
    position: 'absolute',
    bottom: 20,
    right: 6,
  },
  onlineUserName: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 4,
  },
  listContent: {
    paddingVertical: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  unreadItem: {
    backgroundColor: '#f0f9ff',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6b7280',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  conversationContent: {
    flex: 1,
    marginLeft: 12,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  unreadText: {
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
  },
  lastMessage: {
    fontSize: 14,
    color: '#6b7280',
  },
  unreadMessage: {
    color: '#1f2937',
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
});
