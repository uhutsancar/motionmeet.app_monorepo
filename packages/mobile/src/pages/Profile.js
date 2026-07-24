import React, { useState, useEffect } from 'react';
import { ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContext } from "../context/AuthProvider";
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { Appbar, Avatar, Button, Surface, Text, ActivityIndicator, Divider, Chip } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { setAuthToken } from '../api/client';
import { getUserProfile, getWorkouts } from '../api/endpoints';
import moment from 'moment';
import 'moment/locale/tr';

const Profile = ({ route, navigation }) => {
  const { signOut, getToken } = useAuthContext();
  const currentUser = useSelector((state) => state.user.value);
  const loading = useSelector((state) => state.user.loading);
  const { theme, isDark } = useTheme();
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
          // extract workouts from posts
          const profileWorkouts = data.posts
            ?.filter(p => p.post_type === 'workout' && p.workout)
            .map(p => p.workout);
          setWorkouts(profileWorkouts || []);
        }
      } catch (err) {
        console.error("Failed to fetch public profile", err);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [getToken, isOwnProfile, profileId]);

  useEffect(() => {
    if (!isOwnProfile) return; // public profile handles workouts via posts
    const fetchUserWorkouts = async () => {
      try {
        const token = await getToken();
        if (token) setAuthToken(token);
        const data = await getWorkouts(token);
        if (data.success) {
          setWorkouts(data.workouts || []);
        }
      } catch (error) {
        console.error("Failed to fetch workouts on mobile", error);
      }
    };
    if (currentUser) fetchUserWorkouts();
  }, [currentUser, getToken, isOwnProfile]);

  useEffect(() => {
    if (!workouts || workouts.length === 0) {
      setChartData(null);
      return;
    }
    const grouped = {};
    workouts.forEach(w => {
      const week = moment(w.createdAt || w.startTime).format("MMM DD");
      if (!grouped[week]) grouped[week] = { duration: 0, volume: 0, reps: 0 };
      grouped[week].duration += (w.durationMinutes || Math.floor((w.duration || 0) / 60) || 0); 
      grouped[week].volume += (w.volumeKg || w.totalVolume || 0);
      
      let totalReps = 0;
      if (w.exercises) {
        w.exercises.forEach(ex => {
          if (ex.sets) {
            ex.sets.forEach(s => {
              if (s.completed !== false) totalReps += (s.reps || 0);
            });
          }
        });
      }
      grouped[week].reps += totalReps;
    });

    const weeks = Object.keys(grouped).slice(-5);
    const datasets = weeks.map(week => grouped[week][activeStatTab] || 0);
    const hasData = datasets.some(d => d > 0);

    setChartData({
      labels: weeks,
      datasets: [{ data: hasData ? datasets : [0] }] 
    });
  }, [workouts, activeStatTab]);

  const handleSignOut = () => {
    Alert.alert(
      t('settings.logout'),
      t('common.confirm_logout', 'Are you sure you want to sign out?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('settings.logout'), style: 'destructive', onPress: async () => await signOut() },
      ]
    );
  };

  if ((!user && loading) || profileLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  const followersCount = user?.followers_count ?? user?.followers?.length ?? 0;
  const followingCount = user?.following_count ?? user?.following?.length ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      {!isOwnProfile && (
        <Appbar.Header style={{ backgroundColor: theme.surface, elevation: 0 }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
          <Appbar.Content title={user?.username || 'Profile'} titleStyle={{ color: theme.text, fontWeight: '700' }} />
        </Appbar.Header>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 28 }}
      >
        {/* User Header */}
        <Surface style={{
          margin: 12,
          padding: 18,
          backgroundColor: theme.surface,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: theme.shadow,
          shadowOpacity: theme.dark ? 0.2 : 0.06,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
        }} elevation={2}>
          <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: 'transparent' }}>
            {user?.profile_picture ? (
              <Avatar.Image source={{ uri: user.profile_picture }} size={80} />
            ) : (
              <Avatar.Text label={user?.full_name?.charAt(0).toUpperCase() || "U"} size={80} style={{ backgroundColor: theme.primary }} />
            )}
            
            <Surface elevation={0} style={{ flex: 1, backgroundColor: 'transparent' }}>
              <Text variant="titleLarge" style={{ color: theme.text, fontWeight: 'bold' }}>{user?.full_name || user?.username}</Text>
              
              <Surface elevation={0} style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, justifyContent: 'space-between', backgroundColor: 'transparent' }}>
                <Surface elevation={0} style={{ alignItems: 'center', backgroundColor: 'transparent' }}>
                  <Text variant="labelSmall" style={{ color: theme.textMuted }}>{isOwnProfile ? t('profile.workouts') : t('feed.post', 'Posts')}</Text>
                  <Text variant="titleMedium" style={{ color: theme.text, fontWeight: 'bold' }}>
                    {user?.statistics?.totalWorkouts ?? workouts.length}
                  </Text>
                </Surface>
                <Surface elevation={0} style={{ alignItems: 'center', backgroundColor: 'transparent' }}>
                  <Text variant="labelSmall" style={{ color: theme.textMuted }}>{t('profile.followers')}</Text>
                  <Text variant="titleMedium" style={{ color: theme.text, fontWeight: 'bold' }}>{followersCount}</Text>
                </Surface>
                <Surface elevation={0} style={{ alignItems: 'center', backgroundColor: 'transparent' }}>
                  <Text variant="labelSmall" style={{ color: theme.textMuted }}>{t('profile.following')}</Text>
                  <Text variant="titleMedium" style={{ color: theme.text, fontWeight: 'bold' }}>{followingCount}</Text>
                </Surface>
              </Surface>
            </Surface>
          </Surface>

          {isOwnProfile && (
            <Surface elevation={0} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24, backgroundColor: 'transparent' }}>
              <Button mode="outlined" style={{ flex: 1, borderColor: theme.primary }} textColor={theme.primary} onPress={() => navigation.navigate('Settings')}>
                {t('profile.edit_profile', 'Edit Profile')}
              </Button>
              <Button mode="contained" style={{ flex: 1 }} onPress={() => navigation.navigate('Settings')}>
                <Ionicons name="settings-outline" size={16} /> {t('settings.title')}
              </Button>
            </Surface>
          )}
        </Surface>

        {/* Statistics Chart Card */}
        {isOwnProfile && (
          <Surface style={{ marginHorizontal: 12, marginVertical: 4, borderRadius: 22, padding: 18, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }} elevation={1}>
            <Surface elevation={0} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'transparent' }}>
              <Text variant="titleMedium" style={{ color: theme.text, fontWeight: 'bold' }}>{t('profile.weekly_activity', 'Weekly Activity')}</Text>
              <Button compact mode="text" onPress={() => navigation.navigate('Statistics')}>{t('profile.statistics', 'Stats')}</Button>
            </Surface>
            
            <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 8, backgroundColor: 'transparent' }}>
              <Text variant="displaySmall" style={{ color: theme.primary, fontWeight: '900' }}>
                {chartData ? chartData.datasets[0].data[chartData.datasets[0].data.length - 1] : 0} 
              </Text>
              <Text variant="labelMedium" style={{ color: theme.textMuted, fontWeight: 'bold', textTransform: 'uppercase' }}>
                {activeStatTab === 'duration' ? t('common.min', 'min') : activeStatTab === 'volume' ? t('common.kg', 'kg') : t('routines.reps', 'Reps')}
              </Text>
            </Surface>

            {chartData && chartData.datasets[0].data.some(d => d > 0) ? (
              <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6, marginTop: 16, backgroundColor: 'transparent' }}>
                {chartData.datasets[0].data.map((val, i) => {
                  const maxVal = Math.max(...chartData.datasets[0].data, 1);
                  const barH = Math.max(4, (val / maxVal) * 100);
                  return (
                    <Surface elevation={0} key={i} style={{ flex: 1, alignItems: 'center', gap: 4, backgroundColor: 'transparent' }}>
                      <Text style={{ color: theme.textMuted, fontSize: 9, fontWeight: 'bold' }}>{val > 0 ? val : ''}</Text>
                      <Surface elevation={0} style={{ width: '100%', height: barH, backgroundColor: theme.primary, borderRadius: 6, opacity: 0.8 + (i / chartData.datasets[0].data.length) * 0.2 }} />
                      <Text style={{ color: theme.textMuted, fontSize: 9 }} numberOfLines={1}>{chartData.labels[i]}</Text>
                    </Surface>
                  );
                })}
              </Surface>
            ) : (
              <Surface elevation={0} style={{ height: 120, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }}>
                <Ionicons name="stats-chart" size={32} color={theme.border} />
                <Text style={{ color: theme.textMuted, marginTop: 8 }}>{t('common.no_data', 'No data yet')}</Text>
              </Surface>
            )}

            <Surface elevation={0} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, backgroundColor: 'transparent' }}>
              {['duration', 'volume', 'reps'].map(tab => (
                <Chip 
                  key={tab}
                  selected={activeStatTab === tab} 
                  onPress={() => setActiveStatTab(tab)}
                  style={{ flex: 1, backgroundColor: activeStatTab === tab ? theme.primary : theme.background }}
                  textStyle={{ color: activeStatTab === tab ? '#fff' : theme.textMuted, textAlign: 'center', fontSize: 11 }}
                >
                  {t(`profile.${tab}`)}
                </Chip>
              ))}
            </Surface>
          </Surface>
        )}

        {/* Recent Workouts */}
        <Surface elevation={0} style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: 'transparent' }}>
          <Text variant="titleMedium" style={{ color: theme.textMuted, fontWeight: 'bold', marginBottom: 12 }}>{t('profile.recent_workouts', 'RECENT WORKOUTS')}</Text>
          
          {workouts.length > 0 ? (
             workouts.slice(0, 3).map((w, i) => (
              <Surface key={i} style={{ borderRadius: 16, padding: 16, marginBottom: 12, backgroundColor: theme.surfaceLight }} elevation={1}>
                <Surface elevation={0} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: 'transparent' }}>
                  <Surface elevation={0} style={{ flex: 1, backgroundColor: 'transparent' }}>
                    <Text variant="titleMedium" style={{ color: theme.text, fontWeight: 'bold' }}>{w.name || t('workout.my_workout')}</Text>
                    <Text variant="bodySmall" style={{ color: theme.textMuted, marginTop: 4 }}>
                      {moment(w.createdAt || w.startTime).fromNow()}
                    </Text>
                  </Surface>
                  <Surface elevation={0} style={{ backgroundColor: theme.primary + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                    <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 12 }}>{w.exercises?.length || 0} {t('workout.exercises')}</Text>
                  </Surface>
                </Surface>
                <Divider style={{ marginVertical: 12, backgroundColor: theme.border }} />
                <Surface elevation={0} style={{ flexDirection: 'row', gap: 16, backgroundColor: 'transparent' }}>
                  <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'transparent' }}>
                      <Ionicons name="time-outline" size={16} color={theme.primary} />
                      <Text variant="bodyMedium" style={{ color: theme.text, fontWeight: '600' }}>{w.durationMinutes || 0} {t('common.min', 'min')}</Text>
                  </Surface>
                  <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'transparent' }}>
                      <Ionicons name="barbell-outline" size={16} color={theme.primary} />
                      <Text variant="bodyMedium" style={{ color: theme.text, fontWeight: '600' }}>{w.volumeKg || 0} {t('common.kg', 'kg')}</Text>
                  </Surface>
                </Surface>
              </Surface>
            ))
          ) : (
            <Surface style={{ padding: 32, alignItems: 'center', borderRadius: 16, backgroundColor: theme.surfaceLight }} elevation={0}>
              <Ionicons name="barbell-outline" size={48} color={theme.border} />
              <Text variant="bodyLarge" style={{ color: theme.textMuted, marginTop: 12, fontWeight: '500' }}>{t('profile.no_workouts_yet', 'No workouts yet')}</Text>
            </Surface>
          )}
        </Surface>

        {/* Settings / Sign out */}
        {isOwnProfile && (
          <Surface elevation={0} style={{ marginHorizontal: 16, marginTop: 24, gap: 12, backgroundColor: 'transparent' }}>
            <Button mode="contained-tonal" icon="shield-outline" style={{ borderRadius: 12 }} onPress={() => navigation.navigate('PrivacyScreen')}>
              {t('settings.privacy_security')}
            </Button>
            <Button mode="contained-tonal" icon="help-circle-outline" style={{ borderRadius: 12 }} onPress={() => navigation.navigate('SupportScreen')}>
              {t('settings.help_support')}
            </Button>
            <Button mode="contained-tonal" buttonColor="#ef444420" textColor="#ef4444" icon="log-out-outline" style={{ borderRadius: 12 }} onPress={handleSignOut}>
              {t('settings.logout')}
            </Button>
          </Surface>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
