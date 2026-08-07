import React, { memo, useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import { getNearbySettings, getNearbyUsers } from '../api/endpoints';
import { logHandledError } from '../utils/feedback';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { FEED_GUTTER, feedCarouselCardWidth } from '../config/layout';
import { BAND_LABELS } from '../config/nearbyLabels';
import { useAppSelector } from '../store/hooks';
import UserCard from './UserCard';
import type { NearbyUser } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';

/**
 * Nearby athletes, as a carousel on the feed.
 *
 * It only ever reads what the backend already stored. Asking for a GPS fix here
 * would fire the OS permission prompt at someone who opened the app to read
 * their feed, so the section simply stays hidden until the member has turned
 * Nearby on from its own screen, where the ask is explained.
 */
const NEARBY_FEED_LIMIT = 12;

/**
 * The feed windows its rows, so scrolling past this section and back unmounts
 * and remounts it. Without a cache that is two requests - one of them a
 * proximity query - every time it comes back into view.
 */
const CACHE_TTL_MS = 60_000;
/** Keyed by account so a sign-out never leaves one member's list on another's feed. */
let cache: { at: number; userId: string; users: NearbyUser[] } | null = null;

const cachedFor = (userId: string | undefined): NearbyUser[] | null =>
  userId && cache && cache.userId === userId && Date.now() - cache.at < CACHE_TTL_MS
    ? cache.users
    : null;

const NearbyAthletes = ({ navigation }: NavigationOnlyProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { usableWidth } = useResponsiveLayout();
  const { getToken } = useAuthContext();
  const currentUserId = useAppSelector((state) => state.user.value?._id);
  const [users, setUsers] = useState<NearbyUser[]>(() => cachedFor(currentUserId) ?? []);

  const load = useCallback(async () => {
    if (!currentUserId) return;
    const cached = cachedFor(currentUserId);
    if (cached) {
      setUsers(cached);
      return;
    }
    try {
      const token = await getToken();
      if (!token) return;
      const settings = await getNearbySettings(token);
      // A stale fix would put people in front of a distance that is no longer
      // true, so the section waits for the member to refresh it on Nearby.
      const found = !settings.success || !settings.settings?.enabled || settings.settings.stale
        ? []
        : (await getNearbyUsers(token, NEARBY_FEED_LIMIT)).users ?? [];
      cache = { at: Date.now(), userId: currentUserId, users: found };
      setUsers(found);
    } catch (error) {
      logHandledError('load-feed-nearby-athletes', error);
    }
  }, [currentUserId, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (users.length === 0) return null;

  const cardWidth = feedCarouselCardWidth(usableWidth);

  return (
    <View style={[styles.section, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {t('nearby.section', 'Nearby')}
        </Text>
        <TouchableOpacity
          activeOpacity={0.72}
          accessibilityRole="button"
          onPress={() => navigation.navigate('NearbyScreen')}
          style={styles.seeAll}
        >
          <Text style={{ color: theme.primary, fontSize: 12.5, fontWeight: '800' }}>
            {t('nearby.see_all', 'See all')}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.primary} />
        </TouchableOpacity>
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
            width={cardWidth}
            badge={t(BAND_LABELS[user.distanceBand].key, BAND_LABELS[user.distanceBand].fallback)}
            caption={user.approximateArea || user.location || ''}
            onPress={() => navigation.navigate('Profile', { userId: user._id })}
          />
        ))}
      </ScrollView>
    </View>
  );
};

// Theme colours are applied inline above; these stay static.
const styles = StyleSheet.create({
  section: {
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: FEED_GUTTER,
    marginBottom: 10,
  },
  title: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 2 },
  // Padding lives on the content, not the ScrollView, so the row still scrolls
  // edge to edge while the first card lines up with the posts above it.
  scrollContent: {
    paddingHorizontal: FEED_GUTTER,
    gap: 10,
  },
});

export default memo(NearbyAthletes);
