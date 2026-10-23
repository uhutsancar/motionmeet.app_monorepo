import React, { useCallback, useEffect, useState, memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import UserCard, { PEOPLE_CARD_WIDTH } from './UserCard';
import { useAuthContext } from '../context/AuthProvider';
import { getSuggestedUsers } from '../api/endpoints';
import { logHandledError } from '../utils/feedback';
import { FEED_GUTTER } from '../config/layout';
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
    // Full bleed like the posts around it. The section used to be a bordered
    // card that carried more bordered cards, which read as a card inside a card.
    <View style={[styles.section, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>{t('feed.suggested_athletes')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {users.map((user) => (
          <UserCard
            key={user._id}
            user={user}
            width={PEOPLE_CARD_WIDTH}
            onPress={() => navigation.navigate('Profile', { userId: user._id })}
            onDismiss={(dismissed) => setUsers((current) => current.filter((item) => item._id !== dismissed._id))}
          />
        ))}
      </ScrollView>
    </View>
  );
};

// Theme colours are applied inline above; these stay static.
const styles = StyleSheet.create({
  section: {
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    paddingHorizontal: FEED_GUTTER,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  // Padding lives on the content, not the ScrollView, so the row still scrolls
  // edge to edge while the first card lines up with the posts above it.
  scrollContent: {
    paddingHorizontal: FEED_GUTTER,
    gap: 8,
  },
});

export default memo(SuggestedAthletes);
