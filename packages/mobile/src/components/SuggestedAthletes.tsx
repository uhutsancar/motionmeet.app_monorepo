import React, { useCallback, useEffect, useState, memo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import UserCard from './UserCard';
import { useAuthContext } from '../context/AuthProvider';
import { getSuggestedUsers } from '../api/endpoints';
import { logHandledError } from '../utils/feedback';
import type { PublicUser } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';

const SuggestedAthletes = ({ navigation }: NavigationOnlyProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuthContext();

  const fetchSuggested = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const data = await getSuggestedUsers(token);
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      logHandledError('load-suggested-athletes', error);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchSuggested();
  }, [fetchSuggested]);

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
const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 6,
    marginBottom: 12,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
  },
  header: {
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
});

export default memo(SuggestedAthletes);
