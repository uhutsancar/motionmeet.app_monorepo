import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
// expo-image: these rows scroll past many remote avatars, and it recycles
// views and keeps a memory + disk cache where React Native's Image does not.
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Avatar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import dayjs, { setDayjsLocale } from '../utils/dayjs';

import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { setAuthToken } from '../api/client';
import { logHandledError, showInfo } from '../utils/feedback';
import { getUserProfile, getWorkouts } from '../api/endpoints';
import ScreenHeader from '../components/ScreenHeader';
import { useFollowAction } from '../hooks/useFollowAction';
import { useScrollToTopOnTabPress } from '../hooks/useScrollToTopOnTabPress';
import { useScrollEdge } from '../hooks/useScrollEdge';
import { AVATAR, CONTROL, EXERCISE_THUMB, TYPE, exerciseThumbStyle } from '../config/layout';
import { API_URL, WEB_URL } from '../config/environment';
import { useAppSelector } from '../store/hooks';
import WeeklyActivity from '../components/stats/WeeklyActivity';
import SoftButton from '../components/ui/SoftButton';
import { formatDuration, formatNumber } from '../utils/format';
import { mediaVariantUrl, resolvePublicMediaUrl, type UserProfile, type Workout } from '@motionmeet/shared';
import type { NavigationProp, ParamListBase, RouteProp } from '@react-navigation/native';

interface ProfileProps {
  route: RouteProp<ParamListBase>;
  navigation: NavigationProp<ParamListBase>;
}
interface ProfileStat {
  label: string;
  value: number;
  /** Connections tab opened when the counter is tapped. */
  section?: string;
}
interface Shortcut {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  route: string;
}

/**
 * Artwork for a session row: the first exercise in it that ships media.
 *
 * A row of identical dumbbells told the member nothing about which session they
 * were looking at, and the backend already hydrates each exercise, so the real
 * movement's artwork is available without another request. The generic icon
 * stays as the fallback for custom exercises, which have no media.
 */
const workoutArtwork = (workout: Workout): string | null => {
  for (const entry of workout.exercises ?? []) {
    const exercise = typeof entry.exerciseId === 'object' ? entry.exerciseId : null;
    const media = resolvePublicMediaUrl(exercise?.gifUrl || exercise?.imageUrl, API_URL);
    if (media) return media;
  }
  return null;
};

/** Total kilograms lifted in a session, from the sets that were completed. */
const workoutVolume = (workout: Workout): number =>
  (workout.exercises ?? []).reduce(
    (sum, entry) => sum + (entry.sets ?? []).reduce(
      (inner, set) => inner + (set.completed === false ? 0 : (Number(set.weight) || 0) * (Number(set.reps) || 0)),
      0,
    ),
    0,
  );

/**
 * A profile in Instagram's order - the username in the header with the
 * settings menu at its edge, picture and counts on one line, who this is, two
 * short buttons - and the member's own training in Hevy's: twelve weeks of
 * bars, a two-by-two dashboard of the places people go next, then the last
 * workouts.
 */
const Profile = ({ route, navigation }: ProfileProps) => {
  const { getToken } = useAuthContext();
  const currentUser = useAppSelector((state) => state.user.value);
  const loading = useAppSelector((state) => state.user.loading);
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const profileParams = route.params as { userId?: string } | undefined;
  const profileId = profileParams?.userId;
  const isOwnProfile = !profileId || profileId === currentUser?._id;
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [publicProfile, setPublicProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(!isOwnProfile);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopOnTabPress(scrollRef);
  const headerEdge = useScrollEdge();
  const user = isOwnProfile ? currentUser : publicProfile;
  // Seeded from the profile payload, then kept in step with every other follow
  // button in the app through the shared relationship store.
  const follow = useFollowAction(isOwnProfile ? undefined : profileId, {
    isFollowing: Boolean(publicProfile?.isFollowing),
    isFollowedBy: Boolean(publicProfile?.isFollowedBy),
    requestSent: Boolean(publicProfile?.requestSent),
    requestReceived: Boolean(publicProfile?.requestReceived),
  });
  // The server is the authority on both of these; the UI only mirrors them.
  const contentHidden = !isOwnProfile && publicProfile?.canViewContent === false;
  const canMessage = isOwnProfile ? false : publicProfile?.canMessage !== false;

  useEffect(() => {
    setDayjsLocale(i18n.language);
  }, [i18n.language]);

  useEffect(() => {
    if (isOwnProfile) return;
    const fetchProfile = async () => {
      try {
        setProfileLoading(true);
        const token = await getToken();
        if (!token || !profileId) throw new Error('Authentication required');
        setAuthToken(token);
        const data = await getUserProfile(profileId, token);
        if (data.success) {
          setPublicProfile(data.profile);
          const profileWorkouts = (data.posts || [])
            .map((post) => post.workout)
            .filter((workout): workout is Workout => Boolean(workout && typeof workout === 'object'));
          setWorkouts(profileWorkouts);
        }
      } catch (error) {
        logHandledError('load-public-profile', error);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
    // Re-runs when the follow edge changes - including when the other side
    // accepts on their own device - because that is exactly what decides
    // whether this profile's posts are visible.
  }, [getToken, isOwnProfile, profileId, follow.relationship.isFollowing]);

  useEffect(() => {
    if (!isOwnProfile) return;
    const fetchUserWorkouts = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        setAuthToken(token);
        const data = await getWorkouts(token);
        if (data.success) setWorkouts(data.workouts || []);
      } catch (error) {
        logHandledError('load-profile-workouts', error);
      }
    };
    if (currentUser) fetchUserWorkouts();
  }, [currentUser, getToken, isOwnProfile]);

  const shareProfile = async () => {
    if (!user?._id) return;
    try {
      await Share.share({
        message: t('profile.share_message', {
          name: user.full_name || user.username,
          url: `${WEB_URL}/profile/${user._id}`,
          defaultValue: '{{name}} MotionMeet\'te: {{url}}',
        }),
      });
    } catch (error) {
      logHandledError('share-profile', error);
    }
  };

  if ((!user && loading) || profileLoading) {
    return (
      <SafeAreaView
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}
      >
        <ActivityIndicator color={theme.textMuted} />
      </SafeAreaView>
    );
  }

  const followersCount = user?.followers_count ?? 0;
  const followingCount = user?.following_count ?? 0;
  const shortcuts: Shortcut[] = [
    { icon: 'stats-chart-outline', label: t('statistics.title', 'İstatistikler'), route: 'Statistics' },
    { icon: 'calendar-outline', label: t('statistics.monthly_report', 'Aylık rapor'), route: 'MonthlyReportScreen' },
    { icon: 'resize-outline', label: t('measurements.title', 'Ölçümler'), route: 'MeasurementsScreen' },
    { icon: 'trophy-outline', label: t('statistics.records', 'Kişisel rekorlar'), route: 'LeaderboardScreen' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScreenHeader
        large={isOwnProfile}
        scrolled={headerEdge.scrolled}
        title={user?.username || t('tabs.profile', 'Profile')}
        onBack={isOwnProfile ? undefined : () => navigation.goBack()}
        actions={
          isOwnProfile
            ? [
                {
                  icon: 'add-circle-outline',
                  onPress: () => navigation.navigate('Routines'),
                  accessibilityLabel: t('routines.start_empty', 'Antrenmana başla'),
                },
                {
                  icon: 'menu-outline',
                  onPress: () => navigation.navigate('Settings'),
                  accessibilityLabel: t('settings.title', 'Ayarlar'),
                },
              ]
            : [
                {
                  icon: 'share-social-outline',
                  onPress: () => void shareProfile(),
                  accessibilityLabel: t('profile.share_profile', 'Profili paylaş'),
                },
              ]
        }
      />

      <ScrollView
        ref={scrollRef}
        onScroll={headerEdge.onScroll}
        scrollEventThrottle={headerEdge.scrollEventThrottle}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* A cover shows only when there is one; the purple band that stood in
            for a missing cover is gone. */}
        {user?.cover_photo ? (
          <Image
            source={{ uri: mediaVariantUrl(user.cover_photo, 'detail') }}
            style={styles.cover}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : null}

        <View style={styles.header}>
          <View style={styles.identityRow}>
            {user?.profile_picture ? (
              <Avatar.Image
                source={{ uri: user.profile_picture }}
                size={AVATAR.large}
                style={{ backgroundColor: theme.surfaceLight }}
              />
            ) : (
              <Avatar.Text
                label={user?.full_name?.charAt(0).toUpperCase() || 'U'}
                size={AVATAR.large}
                color={theme.textSecondary}
                labelStyle={{ fontSize: 30, fontWeight: '500' }}
                style={{ backgroundColor: theme.surfaceLight }}
              />
            )}
            <View style={styles.counts}>
              {([
                {
                  label: isOwnProfile ? t('profile.workouts', 'Workouts') : t('feed.post', 'Posts'),
                  value: user?.statistics?.totalWorkouts ?? workouts.length,
                },
                // The connections API only serves the signed-in user, so the
                // lists stay tappable on the own profile only.
                { label: t('profile.followers', 'Followers'), value: followersCount, section: 'Followers' },
                { label: t('profile.following', 'Following'), value: followingCount, section: 'Following' },
              ] satisfies ProfileStat[]).map((stat) => {
                const openable = isOwnProfile && Boolean(stat.section);
                return (
                  <Pressable
                    key={stat.label}
                    disabled={!openable}
                    accessibilityRole={openable ? 'button' : undefined}
                    accessibilityLabel={`${stat.label}: ${stat.value}`}
                    onPress={() => {
                      if (openable) navigation.navigate('Connections', { section: stat.section });
                    }}
                    style={({ pressed }) => [styles.count, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={[styles.countValue, { color: theme.text }]}>{formatNumber(stat.value, i18n.language)}</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.countLabel, { color: theme.text }]}>
                      {stat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {user?.full_name || user?.username}
          </Text>
          {!!user?.bio && (
            <Text style={[styles.bio, { color: theme.text }]} numberOfLines={3}>{user.bio}</Text>
          )}
          {/* The backend already withholds this label from anyone the member
              did not open it to, so an empty string here means "not shared"
              and the row simply disappears. */}
          {!!user?.location && (
            <View style={styles.location}>
              <Ionicons name="location-outline" size={13} color={theme.textMuted} />
              <Text style={{ color: theme.textMuted, fontSize: 13, flex: 1 }} numberOfLines={1}>{user.location}</Text>
            </View>
          )}

          <View style={styles.actions}>
            {isOwnProfile ? (
              <>
                <SoftButton label={t('profile.edit_profile', 'Profili düzenle')} onPress={() => navigation.navigate('ProfileEdit')} />
                <SoftButton label={t('profile.share_profile', 'Profili paylaş')} onPress={() => void shareProfile()} />
              </>
            ) : (
              <>
                <SoftButton
                  label={follow.label}
                  busy={follow.busy}
                  primary={!(follow.state === 'following' || follow.state === 'requested')}
                  onPress={() => { void follow.toggle(); }}
                />
                <SoftButton
                  label={t('messages.message', 'Mesaj')}
                  dimmed={!canMessage}
                  onPress={() => {
                    if (!canMessage) {
                      showInfo(
                        t('profile.private_title', 'Bu hesap gizli'),
                        t('profile.message_needs_mutual', 'Mesaj gönderebilmek için birbirinizi takip etmeniz gerekiyor.'),
                      );
                      return;
                    }
                    navigation.navigate('ChatBox', { userId: user?._id, user });
                  }}
                />
              </>
            )}
          </View>
        </View>

        {/* A locked account keeps its header - name, avatar and counts - and
            swaps only the content for an explanation, the way Instagram does. */}
        {contentHidden && (
          <View style={[styles.locked, { borderTopColor: theme.border }]}>
            <Ionicons name="lock-closed-outline" size={26} color={theme.textMuted} />
            <Text style={{ color: theme.text, fontSize: TYPE.section, fontWeight: '600', marginTop: 10 }}>
              {t('profile.private_title', 'Bu hesap gizli')}
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 4 }}>
              {follow.state === 'requested'
                ? t('profile.private_requested', 'İsteğin onaylandığında gönderilerini ve hikâyelerini görebilirsin.')
                : t('profile.private_body', 'Gönderilerini ve hikâyelerini görmek için takip isteği gönder.')}
            </Text>
          </View>
        )}

        {isOwnProfile && (
          <>
            <View style={styles.block}>
              <WeeklyActivity />
            </View>

            {/* Hevy's dashboard: the four places people go from a profile,
                as short soft buttons two by two instead of a list of rows
                with a sentence under each. */}
            <View style={styles.dashboard}>
              {shortcuts.map((shortcut) => (
                <Pressable
                  key={shortcut.route}
                  onPress={() => navigation.navigate(shortcut.route)}
                  accessibilityRole="button"
                  accessibilityLabel={shortcut.label}
                  style={({ pressed }) => [
                    styles.shortcut,
                    { backgroundColor: theme.surfaceLight, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name={shortcut.icon} size={17} color={theme.text} />
                  <Text numberOfLines={1} style={[styles.shortcutLabel, { color: theme.text }]}>{shortcut.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {!contentHidden && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t('profile.recent_workouts', 'Recent workouts')}
            </Text>

            {workouts.length ? (
              workouts.slice(0, 5).map((workout, index) => {
                const artwork = workoutArtwork(workout);
                const volume = workoutVolume(workout);
                return (
                  <Pressable
                    key={workout._id || index}
                    onPress={() => navigation.navigate('WorkoutDetailScreen', { workout })}
                    style={({ pressed }) => [styles.workoutRow, pressed && { backgroundColor: theme.surfaceLight }]}
                  >
                    <View
                      style={[
                        styles.thumb,
                        { backgroundColor: artwork ? '#FFFFFF' : theme.surfaceLight },
                      ]}
                    >
                      {artwork ? (
                        <Image
                          source={{ uri: mediaVariantUrl(artwork, 'thumb') }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <Ionicons name="barbell-outline" size={18} color={theme.textMuted} />
                      )}
                    </View>
                    <View style={[styles.workoutBody, { borderBottomColor: theme.border }]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.workoutName, { color: theme.text }]} numberOfLines={1}>
                          {workout.name || t('workout.my_workout', 'Workout')}
                        </Text>
                        <Text style={[styles.workoutMeta, { color: theme.textMuted }]} numberOfLines={1}>
                          {dayjs(workout.startTime || workout.createdAt).fromNow()}
                          {' · '}
                          {formatDuration(workout.durationMinutes || 0, i18n.language)}
                          {volume > 0 ? ` · ${formatNumber(Math.round(volume), i18n.language)} kg` : ''}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.empty}>
                <Text style={{ color: theme.text, fontSize: TYPE.row, fontWeight: '600' }}>
                  {t('profile.no_workouts_yet', 'No workouts yet')}
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 3, textAlign: 'center' }}>
                  {t('profile.no_workouts_hint', 'Your completed sessions will appear here.')}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 32 },
  cover: { width: '100%', height: 110 },
  header: { paddingHorizontal: 16, paddingTop: 6 },
  identityRow: { flexDirection: 'row', alignItems: 'center' },
  counts: { flex: 1, flexDirection: 'row', marginLeft: 16 },
  count: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 4 },
  countValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  countLabel: { fontSize: 13, marginTop: 1 },
  name: { fontSize: TYPE.body, fontWeight: '600', marginTop: 10 },
  bio: { fontSize: TYPE.body, lineHeight: 19, marginTop: 2 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 6, marginTop: 12 },
  locked: {
    marginTop: 20,
    paddingTop: 32,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  block: { marginTop: 24 },
  dashboard: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginTop: 20 },
  shortcut: {
    flexGrow: 1,
    flexBasis: '45%',
    height: CONTROL.large,
    borderRadius: CONTROL.radius,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shortcutLabel: { flex: 1, minWidth: 0, fontSize: TYPE.button, fontWeight: '600' },
  sectionTitle: { fontSize: TYPE.section, fontWeight: '700', paddingHorizontal: 16, marginTop: 28, marginBottom: 4 },
  workoutRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, minHeight: 62 },
  thumb: {
    ...exerciseThumbStyle(EXERCISE_THUMB.medium),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutBody: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  workoutName: { fontSize: TYPE.row, fontWeight: '600' },
  workoutMeta: { fontSize: TYPE.meta, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 32 },
});

export default Profile;
