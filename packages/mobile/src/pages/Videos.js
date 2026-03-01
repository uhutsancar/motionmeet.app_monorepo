import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../api/client';

const Videos = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { t } = useTranslation();

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVideos = async () => {
    try {
      // Fetching stories with media_type === 'video' or posts with post_type === 'video'
      // For now, let's fetch both and filter or assume a dedicated endpoint exists/could be called.
      // We'll fetch posts feed and filter for videos as a proxy for a video discover feed.
      const { data } = await api.get('/api/post/feed');
      if (data.success) {
        const videoPosts = data.posts.filter(p => p.post_type === 'video');
        setVideos(videoPosts);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchVideos();
  };

  const renderVideoItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.videoCard}
      onPress={() => navigation.navigate('Feed')} // In a real app, go to a full screen player
    >
      <Image 
        source={{ uri: item.image_urls?.[0] || 'https://via.placeholder.com/400x225?text=Video+Thumbnail' }} 
        style={styles.thumbnail} 
      />
      <View style={styles.playIconContainer}>
        <Ionicons name="play" size={40} color="rgba(255,255,255,0.8)" />
      </View>
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>{item.content || 'Workout Video'}</Text>
        <Text style={styles.videoUser}>@{item.user?.username}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('menu.videos', 'Videos')}</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={videos}
          renderItem={renderVideoItem}
          keyExtractor={(item) => item._id}
          numColumns={1}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="videocam-off-outline" size={64} color={theme.textMuted} />
              <Text style={styles.emptyText}>No videos found</Text>
              <Text style={styles.emptySubtext}>Follow people who post workout videos!</Text>
            </View>
          }
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  videoCard: {
    backgroundColor: theme.surfaceLight,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  thumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
  },
  playIconContainer: {
    ...StyleSheet.absoluteFillObject,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoInfo: {
    padding: 12,
  },
  videoTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  videoUser: {
    color: theme.textMuted,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: theme.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtext: {
    color: theme.textMuted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  }
});

export default Videos;
