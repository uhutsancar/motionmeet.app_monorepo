import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import UserCard from '../components/UserCard';
import { discoverUsers } from '../api/endpoints';
import { fetchUser } from '../features/user/userSlice';

const Discover = ({ navigation }) => {
  const { getToken } = useAuth();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await getToken();
      dispatch(fetchUser(token));
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert(t('common.error', 'Hata'), t('common.search_query_error', 'Lütfen arama kelimesi girin'));
      return;
    }

    try {
      setLoading(true);
      const token = await getToken();
      const data = await discoverUsers(searchQuery, token);
      if (data.success) {
        setUsers(data.users);
      } else {
        Alert.alert(t('common.error', 'Hata'), data.message);
      }
    } catch (error) {
      Alert.alert(t('common.error', 'Hata'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = (user) => {
    navigation.navigate('Profile', { userId: user._id });
  };

  const handleMessagePress = (user) => {
    navigation.navigate('ChatBox', { userId: user._id, user });
  };

  const renderUserCard = ({ item }) => (
    <View style={styles.cardWrapper}>
      <UserCard 
        user={item}
        onPress={() => handleUserPress(item)}
        onMessagePress={() => handleMessagePress(item)}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {/* Empty State */}
      {!loading && users.length === 0 && searchQuery.length > 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>No users found</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </View>
      )}

      {/* Initial State */}
      {!loading && users.length === 0 && searchQuery.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyText}>Discover new connections</Text>
          <Text style={styles.emptySubtext}>Search for people to connect with</Text>
        </View>
      )}

      {/* Users Grid */}
      {!loading && users.length > 0 && (
        <FlatList
          data={users}
          renderItem={renderUserCard}
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
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
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
  },
  cardWrapper: {
    marginBottom: 16,
  },
});

export default Discover;
