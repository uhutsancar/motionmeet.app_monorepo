import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { dummyConnectionsData } from '../assets/dummyData';

const Messages = ({ navigation }) => {
  const [connections, setConnections] = useState(dummyConnectionsData);

  const handleMessagePress = (user) => {
    navigation.navigate('ChatBox', { userId: user._id, user });
  };

  const handleProfilePress = (user) => {
    Alert.alert('Profile', `View profile of ${user.username}`);
  };

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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>Talk to your friends and family</Text>
        </View>
      </View>

      {/* Connections List */}
      <FlatList
        data={connections}
        renderItem={renderUserItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
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
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
});

export default Messages;
