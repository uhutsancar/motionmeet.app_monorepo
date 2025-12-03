import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import UserCard from '../components/UserCard';
import { dummyConnectionsData } from '../assets/dummyData';

const Discover = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState(dummyConnectionsData);
  const [loading, setLoading] = useState(false);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setLoading(true);
      // Simulate search
      setTimeout(() => {
        setUsers(dummyConnectionsData);
        setLoading(false);
      }, 1000);
    }
  };

  const handleFollow = (user) => {
    Alert.alert('Follow', `Following ${user.username}`);
  };

  const handleMessage = (user) => {
    navigation.navigate('Messages', {
      screen: 'ChatBox',
      params: { userId: user._id, user }
    });
  };

  const handleConnect = (user) => {
    Alert.alert('Connect', `Sending connection request to ${user.username}`);
  };

  const renderUserCard = ({ item }) => (
    <View style={styles.cardWrapper}>
      <UserCard 
        user={item}
        onFollow={handleFollow}
        onMessage={handleMessage}
        onConnect={handleConnect}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover People</Text>
        <Text style={styles.headerSubtitle}>
          Connect with amazing people and grow your network
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, username, bio, or location..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      )}

      {/* Users Grid */}
      {!loading && (
        <FlatList
          data={users}
          renderItem={renderUserCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          numColumns={1}
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
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  listContent: {
    padding: 16,
    alignItems: 'center',
    gap: 16,
  },
  cardWrapper: {
    marginBottom: 4,
  },
});

export default Discover;
