import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
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
import moment from 'moment';
import 'moment/locale/tr';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { setAuthToken } from '../api/client';
import { logHandledError } from '../utils/feedback';
import { getUserProfile, getWorkouts } from '../api/endpoints';

const Profile = ({ route, navigation }) => {
  const { signOut, getToken } = useAuthContext();
  const currentUser = useSelector((state) => state.user.value);
  const loading = useSelector((state) => state.user.loading);
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const profileId = route?.params?.userId;
  const isOwnProfile = !profileId || profileId === currentUser?._id;
  const [activeStatTab, setActiveStatTab] = useState('duration');
  const [workouts, setWorkouts] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [publicProfile, setPublicProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(!isOwnProfile);
  const user = isOwnProfile ? currentUser : publicProfile;

  useEffect(() => {
    moment.locale(i18n.language.startsWith('tr') ? 'tr' : 'en');
  }, [i18n.language]);

  useEffect(() => {
    if (isOwnProfile) return;
    const fetchProfile = async () => {
      try {
        setProfileLoading(true);
        const token = await getToken();
        if (token) setAuthToken(token);
        const data = await getUserProfile(profileId, token);
        if (data.success) {
          setPublicProfile(data.profile);
          setWorkouts(
            (data.posts || [])
              .filter((post) => post.post_type === 'workout' && post.workout)
              .map((post) => post.workout),
          );
        }
      } catch (error) {
        logHandledError('load-public-profile', error);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [getToken, isOwnProfile, profileId]);

  useEffect(() => {
    if (!isOwnProfile) return;
    const fetchUserWorkouts = async () => {
      try {
        const token = await getToken();
        if (token) setAuthToken(token);
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
    const grouped = {};
    workouts.forEach((workout) => {
      const week = moment(workout.createdAt || workout.startTime).format('MMM DD');
      if (!grouped[week]) grouped[week] = { duration: 0, volume: 0, reps: 0 };
      grouped[week].duration += workout.durationMinutes || Math.floor((workout.duration || 0) / 60) || 0;
      grouped[week].volume += workout.volumeKg || workout.totalVolume || 0;
      (workout.exercises || []).forEach((exercise) => {
        (exercise.sets || []).forEach((set) => {
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

  const followersCount = user?.followers_count ?? user?.followers?.length ?? 0;
  const followingCount = user?.following_count ?? user?.following?.length ?? 0;
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
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 32,
        }}
      >
        <Surface
          elevation={0}
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            overflow: 'hidden',
          }}
        >
          <View style={{ height: 126, backgroundColor: theme.primarySoft }}>
            {user?.cover_photo ? (
              <Image source={{ uri: user.cover_photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <View style={{ flex: 1, backgroundColor: theme.primarySoft }} />
            )}
            <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(8,10,14,.12)' }} />
          </View>

          <View style={{ padding: 16, paddingTop: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -34 }}>
            {user?.profile_picture ? (
              <Avatar.Image
                source={{ uri: user.profile_picture }}
                size={76}
                style={{ borderWidth: 4, borderColor: theme.surface, backgroundColor: theme.surface }}
              />
            ) : (
              <Avatar.Text
                label={user?.full_name?.charAt(0).toUpperCase() || 'U'}
                size={76}
                style={{ backgroundColor: theme.primary, borderWidth: 4, borderColor: theme.surface }}
              />
            )}
            <View style={{ flex: 1, marginLeft: 14, paddingTop: 34 }}>
              <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800' }} numberOfLines={1}>
                {user?.full_name || user?.username}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                @{user?.username || 'member'}
              </Text>
              {!!(user?.bio || user?.biography) && (
                <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 6 }} numberOfLines={2}>
                  {user.bio || user.biography}
                </Text>
              )}
            </View>
          </View>

          <Divider style={{ marginVertical: 16, backgroundColor: theme.border }} />
          <View style={{ flexDirection: 'row' }}>
            {[
              {
                label: isOwnProfile ? t('profile.workouts', 'Workouts') : t('feed.post', 'Posts'),
                value: user?.statistics?.totalWorkouts ?? workouts.length,
              },
              { label: t('profile.followers', 'Followers'), value: followersCount },
              { label: t('profile.following', 'Following'), value: followingCount },
            ].map((stat, index) => (
              <React.Fragment key={stat.label}>
                {index > 0 && <Divider style={{ width: 1, height: 38, backgroundColor: theme.border }} />}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>{stat.value}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 3 }}>{stat.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          {isOwnProfile && (
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
          )}
          </View>
        </Surface>

        {isOwnProfile && (
          <Surface
            elevation={0}
            style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.surface,
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
              <View style={{ flex: 1, paddingHorizontal: 11 }}>
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

            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
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
              ].map(item => (
                <TouchableOpacity
                  key={item.route}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => navigation.navigate(item.route)}
                  style={{
                    flex: 1,
                    minHeight: 78,
                    paddingHorizontal: 6,
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
              marginTop: 16,
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.surface,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>
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
              {['duration', 'volume', 'reps'].map((tab) => {
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

        <View style={{ marginTop: 24, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>
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
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
          }}
        >
          {workouts.length ? (
            workouts.slice(0, 3).map((workout, index) => (
              <TouchableOpacity
                key={workout._id || index}
                activeOpacity={0.72}
                onPress={() => navigation.navigate('WorkoutDetailScreen', { workout })}
                style={{
                  minHeight: 76,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderBottomWidth: index < Math.min(workouts.length, 3) - 1 ? 1 : 0,
                  borderBottomColor: theme.border,
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 9,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.primarySoft,
                  }}
                >
                  <Ionicons name="barbell-outline" size={20} color={theme.primary} />
                </View>
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                    {workout.name || t('workout.my_workout', 'Workout')}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 3 }}>
                    {moment(workout.createdAt || workout.startTime).fromNow()} · {workout.exercises?.length || 0} {t('workout.exercises', 'exercises')}
                  </Text>
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
                  {workout.durationMinutes || 0} {t('common.min', 'min')}
                </Text>
              </TouchableOpacity>
            ))
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
            {[
              { icon: 'shield-checkmark-outline', label: t('settings.privacy_security'), route: 'PrivacyScreen' },
              { icon: 'help-circle-outline', label: t('settings.help_support'), route: 'SupportScreen' },
            ].map((item, index) => (
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
