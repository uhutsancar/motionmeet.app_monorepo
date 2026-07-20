import React, { useEffect, useState, memo } from 'react';
import { ScrollView } from 'react-native';
import { Surface, TouchableRipple, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import UserCard from './UserCard';
import api from '../api/client';
import { useAuthContext } from '../context/AuthProvider';
import { getSuggestedUsers } from '../api/endpoints';

const SuggestedAthletes = ({ navigation }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuthContext();

  const fetchSuggested = async () => {
    try {
      const token = await getToken();
      const data = await getSuggestedUsers(token);
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
    <Surface elevation={0} style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Surface elevation={0} style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{t('feed.suggested_athletes')}</Text>
      </Surface>
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
    </Surface>
  );
};

// ✅ NO theme references here - styles are static (theme applied inline in JSX above)
const styles = {
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
};

export default memo(SuggestedAthletes);
