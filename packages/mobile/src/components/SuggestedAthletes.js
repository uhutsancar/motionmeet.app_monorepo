import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import UserCard from './UserCard';
import api from '../api/client';

const SuggestedAthletes = ({ navigation }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSuggested = async () => {
    try {
      const { data } = await api.get('/api/user/suggested');
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Suggested fetch error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggested();
  }, []);

  if (loading || users.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{t('feed.suggested_athletes')}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {users.map((user) => (
          <UserCard
            key={user._id}
            user={user}
            onPress={() => navigation.navigate('Profile', { userId: user._id })}
          />
        ))}
      </ScrollView>
    </View>
  );
};

// ✅ NO theme references here - styles are static (theme applied inline in JSX above)
const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    borderRadius: 32,
    paddingVertical: 24,
    borderWidth: 1,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
});

export default SuggestedAthletes;
