import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Appbar,
  Avatar,
  Button,
  Divider,
  Surface,
  Text,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import dayjs, { setDayjsLocale } from '../utils/dayjs';

import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { setAuthToken } from '../api/client';
import { logHandledError, showInfo } from '../utils/feedback';
import { getUserProfile, getWorkouts } from '../api/endpoints';
import { useFollowAction } from '../hooks/useFollowAction';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { AVATAR, CARD, EXERCISE_THUMB, exerciseThumbStyle } from '../config/layout';
import { API_URL } from '../config/environment';
import { useAppSelector } from '../store/hooks';
import { resolvePublicMediaUrl } from '@motionmeet/shared';
import type { UserProfile, Workout } from '@motionmeet/shared';
import type { NavigationProp, ParamListBase, RouteProp } from '@react-navigation/native';

type ProfileStatTab = 'duration' | 'volume' | 'reps';
type ProfileMetric = Record<ProfileStatTab, number>;
interface ProfileChartData { labels: string[]; values: number[] }
interface ProfileProps {
  route: RouteProp<ParamListBase>;
  navigation: NavigationProp<ParamListBase>;
}
interface ProfileShortcut {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  route: string;
  color?: string;
}
interface ProfileStat {
  label: string;
  value: number;
  /** Connections tab opened when the counter is tapped. */
  section?: string;
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

const Profile = ({ route, navigation }: ProfileProps) => {
  const { signOut, getToken } = useAuthContext();
  const currentUser = useAppSelector((state) => state.user.value);
  const loading = useAppSelector((state) => state.user.loading);
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const { isNarrow } = useResponsiveLayout();
  const profileParams = route.params as { userId?: string } | undefined;
  const profileId = profileParams?.userId;
  const isOwnProfile = !profileId || profileId === currentUser?._id;
  const [activeStatTab, setActiveStatTab] = useState<ProfileStatTab>('duration');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [chartData, setChartData] = useState<ProfileChartData | null>(null);
  const [publicProfile, setPublicProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(!isOwnProfile);
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

  useEffect(() => {
    if (!workouts.length) {
      setChartData(null);
      return;
    }
    const grouped: Record<string, ProfileMetric> = {};
    workouts.forEach((workout) => {
      const week = dayjs(workout.createdAt || workout.startTime).format('MMM DD');
      if (!grouped[week]) grouped[week] = { duration: 0, volume: 0, reps: 0 };
      grouped[week].duration += workout.durationMinutes || 0;
      grouped[week].volume += workout.volumeKg || 0;
      workout.exercises.forEach((exercise) => {
        exercise.sets.forEach((set) => {
          if (set.completed !== false) grouped[week].reps += set.reps || 0;
        });
      });
    });
    const labels = Object.keys(grouped).slice(-5);
    const values = labels.map((label) => grouped[label][activeStatTab] || 0);
    setChartData({ labels, values });
  }, [activeStatTab, workouts]);

  const handleSignOut = () => {
    Alert.alert(
      t('settings.logout'),
      t('common.confirm_logout', 'Are you sure you want to sign out?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('settings.logout'), style: 'destructive', onPress: signOut },
      ],
    );
  };

  if ((!user && loading) || profileLoading) {
    return (
      <SafeAreaView
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}
      >
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  const followersCount = user?.followers_count ?? 0;
  const followingCount = user?.following_count ?? 0;
  const latestValue = chartData?.values?.[chartData.values.length - 1] || 0;
  const unit = activeStatTab === 'duration'
    ? t('common.min', 'min')
    : activeStatTab === 'volume'
      ? t('common.kg', 'kg')
      : t('routines.reps', 'reps');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <Appbar.Header
        statusBarHeight={0}
        style={{
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          elevation: 0,
        }}
      >
        {!isOwnProfile && <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />}
        <Appbar.Content
          title={isOwnProfile ? t('tabs.profile', 'Profile') : user?.username || t('tabs.profile', 'Profile')}
          titleStyle={{ color: theme.text, fontSize: 23, fontWeight: '800' }}
        />
        {isOwnProfile && (
          <Appbar.Action icon="cog-outline" color={theme.text} onPress={() => navigation.navigate('Settings')} />
        )}
      </Appbar.Header>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          paddingTop: 0,
          paddingBottom: 28,
        }}
      >
        <Surface
          elevation={0}
          style={{
            backgroundColor: theme.background,
            overflow: 'hidden',
          }}
        >
          <View style={{ height: 92, backgroundColor: theme.primarySoft }}>
            {user?.cover_photo ? (
              <Image source={{ uri: user.cover_photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <View style={{ flex: 1, backgroundColor: theme.primarySoft }} />
            )}
            <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(8,10,14,.12)' }} />
          </View>

          <View style={{ padding: CARD.padding, paddingTop: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -30 }}>
            {user?.profile_picture ? (
              <Avatar.Image
                source={{ uri: user.profile_picture }}
                size={AVATAR.large}
                style={{ borderWidth: 3, borderColor: theme.surface, backgroundColor: theme.surface }}
              />
            ) : (
              <Avatar.Text
                label={user?.full_name?.charAt(0).toUpperCase() || 'U'}
                size={AVATAR.large}
                style={{ backgroundColor: theme.primary, borderWidth: 3, borderColor: theme.surface }}
              />
            )}
            <View style={{ flex: 1, minWidth: 0, marginLeft: 12, paddingTop: 30 }}>
              <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800' }} numberOfLines={1}>
                {user?.full_name || user?.username}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                @{user?.username || 'member'}
              </Text>
              {!!user?.bio && (
                <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 6 }} numberOfLines={2}>
                  {user.bio}
                </Text>
              )}
              {/* The backend already withholds this label from anyone the
                  member did not open it to, so an empty string here means
                  "not shared" and the row simply disappears. */}
              {!!user?.location && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <Ionicons name="location-outline" size={12} color={theme.textMuted} />
                  <Text style={{ color: theme.textMuted, fontSize: 11.5, flex: 1 }} numberOfLines={1}>
                    {user.location}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Divider style={{ marginVertical: 16, backgroundColor: theme.border }} />
          <View style={{ flexDirection: 'row' }}>
            {([
              {
                label: isOwnProfile ? t('profile.workouts', 'Workouts') : t('feed.post', 'Posts'),
                value: user?.statistics?.totalWorkouts ?? workouts.length,
              },
              // The connections API only serves the signed-in user, so the
              // lists stay tappable on the own profile only.
              { label: t('profile.followers', 'Followers'), value: followersCount, section: 'Followers' },
              { label: t('profile.following', 'Following'), value: followingCount, section: 'Following' },
            ] satisfies ProfileStat[]).map((stat, index) => {
              const openable = isOwnProfile && Boolean(stat.section);
              return (
              <React.Fragment key={stat.label}>
                {index > 0 && <Divider style={{ width: 1, height: 38, backgroundColor: theme.border }} />}
                <TouchableOpacity
                  activeOpacity={openable ? 0.72 : 1}
                  disabled={!openable}
                  accessibilityRole={openable ? 'button' : undefined}
                  accessibilityLabel={openable ? `${stat.label}: ${stat.value}` : undefined}
                  onPress={() => {
                    if (openable) navigation.navigate('Connections', { section: stat.section });
                  }}
                  style={{ flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 4 }}
                >
                  <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>{stat.value}</Text>
                  <Text
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    style={{
                      color: openable ? theme.textSecondary : theme.textMuted,
                      fontSize: 11,
                      marginTop: 3,
                      textAlign: 'center',
                    }}
                  >
                    {stat.label}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
              );
            })}
          </View>

          {isOwnProfile ? (
            <Button
              mode="outlined"
              icon="pencil-outline"
              onPress={() => navigation.navigate('ProfileEdit')}
              style={{ marginTop: 16, borderRadius: 10, borderColor: theme.border }}
              contentStyle={{ minHeight: 42 }}
              labelStyle={{ color: theme.text, fontWeight: '700' }}
            >
              {t('profile.edit_profile', 'Edit profile')}
            </Button>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button
                mode={follow.state === 'following' || follow.state === 'requested' ? 'outlined' : 'contained'}
                onPress={() => { void follow.toggle(); }}
                loading={follow.busy}
                disabled={follow.busy}
                style={{ flex: 1, borderRadius: 10, borderColor: theme.border }}
                contentStyle={{ minHeight: 42 }}
                labelStyle={{ fontWeight: '700' }}
              >
                {follow.label}
              </Button>
              <Button
                mode="outlined"
                icon="message-outline"
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
                style={{ flex: 1, borderRadius: 10, borderColor: theme.border, opacity: canMessage ? 1 : 0.55 }}
                contentStyle={{ minHeight: 42 }}
                labelStyle={{ color: theme.text, fontWeight: '700' }}
              >
                {t('messages.message', 'Mesaj')}
              </Button>
            </View>
          )}
          </View>
        </Surface>

        {/* A locked account keeps its header - name, avatar and counts - and
            swaps only the content for an explanation, the way Instagram does. */}
        {contentHidden && (
          <Surface
            elevation={0}
            style={{
              marginTop: 16,
              marginHorizontal: CARD.padding,
              padding: 28,
              alignItems: 'center',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.surface,
            }}
          >
            <Ionicons name="lock-closed-outline" size={30} color={theme.textMuted} />
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800', marginTop: 10 }}>
              {t('profile.private_title', 'Bu hesap gizli')}
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 5 }}>
              {follow.state === 'requested'
                ? t('profile.private_requested', 'İsteğin onaylandığında gönderilerini ve hikâyelerini görebilirsin.')
                : t('profile.private_body', 'Gönderilerini ve hikâyelerini görmek için takip isteği gönder.')}
            </Text>
          </Surface>
        )}

        {isOwnProfile && (
          <Surface
            elevation={0}
            style={{
              marginTop: 10,
              paddingHorizontal: CARD.padding,
              paddingVertical: CARD.padding,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderColor: theme.border,
              backgroundColor: theme.background,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.72}
              onPress={() => navigation.navigate('Statistics')}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.primarySoft,
                }}
              >
                <Ionicons name="stats-chart-outline" size={20} color={theme.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 11 }}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>
                  {t('statistics.title', 'Statistics')}
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 }}>
                  {t('profile.statistics_hint', 'Reports, muscle distribution and personal records')}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={theme.primary} />
            </TouchableOpacity>

            <Divider style={{ marginVertical: 14, backgroundColor: theme.border }} />

            {/* Four shortcuts share the row, so the gap and inner padding stay
                tight enough for the longest label to still fit on two lines. */}
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {([
                {
                  icon: 'calendar-outline',
                  label: t('statistics.monthly_report', 'Monthly report'),
                  route: 'MonthlyReportScreen',
                  color: '#8B5CF6',
                },
                {
                  icon: 'body-outline',
                  label: t('statistics.muscle_dist', 'Muscle distribution'),
                  route: 'MuscleDistribution',
                  color: '#3B82F6',
                },
                {
                  icon: 'analytics-outline',
                  label: t('statistics.advanced', 'Advanced'),
                  route: 'AdvancedStatisticsScreen',
                  color: '#22A06B',
                },
                {
                  icon: 'resize-outline',
                  label: t('measurements.title', 'Measurements'),
                  route: 'MeasurementsScreen',
                  color: '#D98A12',
                },
              ] satisfies ProfileShortcut[]).map(item => (
                <TouchableOpacity
                  key={item.route}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => navigation.navigate(item.route)}
                  style={{
                    flex: 1,
                    minHeight: isNarrow ? 90 : 78,
                    paddingHorizontal: 4,
                    paddingVertical: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceLight,
                  }}
                >
                  <Ionicons name={item.icon} size={19} color={item.color} />
                  <Text
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                    style={{
                      color: theme.textSecondary,
                      fontSize: 9.5,
                      lineHeight: 13,
                      textAlign: 'center',
                      fontWeight: '800',
                      marginTop: 7,
                    }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Surface>
        )}

        {isOwnProfile && (
          <Surface
            elevation={0}
            style={{
              marginTop: 10,
              paddingHorizontal: CARD.padding,
              paddingVertical: CARD.padding,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderColor: theme.border,
              backgroundColor: theme.background,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                <Text numberOfLines={2} style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>
                  {t('profile.weekly_activity', 'Training activity')}
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 3 }}>
                  {t('profile.last_five_weeks', 'Last five weeks')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Statistics')}>
                <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '800' }}>
                  {t('profile.statistics', 'Details')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 16 }}>
              <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>{latestValue}</Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700', marginLeft: 5 }}>
                {unit}
              </Text>
            </View>

            {chartData?.values.some((value) => value > 0) ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 96, gap: 8, marginTop: 12 }}>
                {chartData.values.map((value, index) => {
                  const maxValue = Math.max(...chartData.values, 1);
                  return (
                    <View key={`${chartData.labels[index]}-${index}`} style={{ flex: 1, alignItems: 'center' }}>
                      <View
                        style={{
                          width: '100%',
                          maxWidth: 34,
                          height: Math.max(4, (value / maxValue) * 66),
                          borderRadius: 4,
                          backgroundColor: index === chartData.values.length - 1 ? theme.primary : theme.primarySoft,
                        }}
                      />
                      <Text style={{ color: theme.textMuted, fontSize: 8, marginTop: 5 }} numberOfLines={1}>
                        {chartData.labels[index]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={{ height: 88, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                  {t('common.no_data', 'No activity recorded yet')}
                </Text>
              </View>
            )}

            <View
              style={{
                flexDirection: 'row',
                marginTop: 14,
                padding: 3,
                borderRadius: 10,
                backgroundColor: theme.surfaceLight,
              }}
            >
              {(['duration', 'volume', 'reps'] as const).map((tab) => {
                const active = activeStatTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveStatTab(tab)}
                    style={{
                      flex: 1,
                      minHeight: 34,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      backgroundColor: active ? theme.surface : 'transparent',
                    }}
                  >
                    <Text style={{ color: active ? theme.text : theme.textMuted, fontSize: 11, fontWeight: '700' }}>
                      {t(`profile.${tab}`, tab)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Surface>
        )}

        {/* Same gutter as every card on this screen. Without it the heading sat
            on the screen edge and the counter was clipped off the right side. */}
        {!contentHidden && <>
        <View
          style={{
            marginTop: 24,
            marginBottom: 10,
            paddingHorizontal: CARD.padding,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Text numberOfLines={1} style={{ flexShrink: 1, color: theme.text, fontSize: 17, fontWeight: '800' }}>
            {t('profile.recent_workouts', 'Recent workouts')}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700' }}>
            {Math.min(workouts.length, 3)}
          </Text>
        </View>

        <Surface
          elevation={0}
          style={{
            overflow: 'hidden',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
            backgroundColor: theme.background,
          }}
        >
          {workouts.length ? (
            workouts.slice(0, 3).map((workout, index) => {
              const artwork = workoutArtwork(workout);
              return (
              <TouchableOpacity
                key={workout._id || index}
                activeOpacity={0.72}
                onPress={() => navigation.navigate('WorkoutDetailScreen', { workout })}
                style={{
                  minHeight: 76,
                  paddingHorizontal: CARD.padding,
                  paddingVertical: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderBottomWidth: index < Math.min(workouts.length, 3) - 1 ? 1 : 0,
                  borderBottomColor: theme.border,
                }}
              >
                <View
                  style={{
                    ...exerciseThumbStyle(EXERCISE_THUMB.large),
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: artwork ? '#FFFFFF' : theme.primarySoft,
                  }}
                >
                  {artwork ? (
                    <Image
                      source={{ uri: artwork }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="barbell-outline" size={20} color={theme.primary} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 12 }}>
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                    {workout.name || t('workout.my_workout', 'Workout')}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 3 }}>
                    {dayjs(workout.createdAt || workout.startTime).fromNow()} · {workout.exercises?.length || 0} {t('workout.exercises', 'exercises')}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  style={{ maxWidth: '32%', color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}
                >
                  {workout.durationMinutes || 0} {t('common.min', 'min')}
                </Text>
              </TouchableOpacity>
              );
            })
          ) : (
            <View style={{ alignItems: 'center', padding: 24 }}>
              <Ionicons name="barbell-outline" size={26} color={theme.textMuted} />
              <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700', marginTop: 9 }}>
                {t('profile.no_workouts_yet', 'No workouts yet')}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 3, textAlign: 'center' }}>
                {t('profile.no_workouts_hint', 'Your completed sessions will appear here.')}
              </Text>
            </View>
          )}
        </Surface>
        </>}

        {isOwnProfile && (
          <Surface
            elevation={0}
            style={{
              marginTop: 16,
              overflow: 'hidden',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.surface,
            }}
          >
            {([
              { icon: 'shield-checkmark-outline', label: t('settings.privacy_security'), route: 'PrivacyScreen' },
              { icon: 'help-circle-outline', label: t('settings.help_support'), route: 'SupportScreen' },
            ] satisfies ProfileShortcut[]).map((item, index) => (
              <TouchableOpacity
                key={item.route}
                onPress={() => navigation.navigate(item.route)}
                style={{
                  minHeight: 52,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderBottomWidth: index === 0 ? 1 : 0,
                  borderBottomColor: theme.border,
                }}
              >
                <Ionicons name={item.icon} size={19} color={theme.textSecondary} />
                <Text style={{ flex: 1, color: theme.text, fontSize: 14, fontWeight: '600', marginLeft: 11 }}>
                  {item.label}
                </Text>
                <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
              </TouchableOpacity>
            ))}
          </Surface>
        )}

        {isOwnProfile && (
          <Button
            mode="text"
            icon="logout"
            textColor={theme.danger}
            onPress={handleSignOut}
            style={{ marginTop: 12, borderRadius: 10 }}
            labelStyle={{ fontWeight: '700' }}
          >
            {t('settings.logout')}
          </Button>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
