import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image,
  TouchableOpacity,
  Alert,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { setAuthToken } from '../api/client';
import moment from 'moment';
import 'moment/locale/tr'; // static import required by Metro bundler
import ProfileModal from '../components/ProfileModal';
import SuggestedAthletes from '../components/SuggestedAthletes';

const { width } = Dimensions.get('window');

const Profile = ({ route, navigation }) => {
  const { signOut, getToken } = useAuth();
  const currentUser = useSelector((state) => state.user.value);
  const loading = useSelector((state) => state.user.loading);
  const [activeStatTab, setActiveStatTab] = useState('duration');
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme);
  const { t, i18n } = useTranslation();

  const [workouts, setWorkouts] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);

  const user = currentUser;

  useEffect(() => {
    moment.locale(i18n.language.startsWith('tr') ? 'tr' : 'en');
  }, [i18n.language]);

  useEffect(() => {
    const fetchUserWorkouts = async () => {
      try {
        const token = await getToken();
        if (token) setAuthToken(token);
        const { data } = await api.get('/api/workout');
        if (data.success) {
          const fetchedWorkouts = data.workouts || [];
          setWorkouts(fetchedWorkouts);

          if (fetchedWorkouts.length > 0) {
            const grouped = {};
            fetchedWorkouts.forEach(w => {
              const week = moment(w.createdAt || w.startTime).format("MMM DD");
              if (!grouped[week]) {
                grouped[week] = { duration: 0, volume: 0, reps: 0 };
              }
              grouped[week].duration += (w.durationMinutes || Math.floor((w.duration || 0) / 60) || 0); 
              grouped[week].volume += (w.volumeKg || w.totalVolume || 0);
              
              // Calculate total reps from exercises and sets
              let totalReps = 0;
              if (w.exercises) {
                w.exercises.forEach(ex => {
                  if (ex.sets) {
                    ex.sets.forEach(s => {
                      if (s.completed !== false) { // count completed or undefined (old data)
                        totalReps += (s.reps || 0);
                      }
                    });
                  }
                });
              }
              grouped[week].reps += (totalReps || 0);
            });

            const weeks = Object.keys(grouped).slice(-5);
            const datasets = weeks.map(week => grouped[week][activeStatTab] || 0);
            const hasData = datasets.some(d => d > 0);

            setChartData({
              labels: weeks,
              datasets: [{ data: hasData ? datasets : [0] }] 
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch workouts on mobile", error);
      }
    };
    if (user) {
      fetchUserWorkouts();
    }
  }, [activeStatTab, user]);

  if (!user && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('common.saving', 'Loading...')}</Text>
        </View>
      </SafeAreaView>
    );
  }

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      
        {/* User Header */}
        <View style={styles.headerTop}>
          <View style={styles.avatarContainer}>
            {user?.profile_picture ? (
              <Image source={{ uri: user.profile_picture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user?.full_name?.charAt(0).toUpperCase() || "U"}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.nameText}>{user?.full_name || user?.username}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('profile.workouts')}</Text>
                <Text style={styles.statNumber}>{workouts.length}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('profile.followers')}</Text>
                <Text style={styles.statNumber}>{user?.followers?.length || 0}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{t('profile.following')}</Text>
                <Text style={styles.statNumber}>{user?.following?.length || 0}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.surface }]} onPress={() => setShowEditProfile(true)}>
            <Ionicons name="pencil" size={18} color={theme.primary} />
            <Text style={[styles.actionBtnText, { color: theme.primary }]}>{t('profile.edit_profile', 'Edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.surface }]} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Statistics Chart Card */}
        <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.chartHeaderInfo}>
             <Text style={[styles.chartTitle, { color: theme.text }]}>{t('profile.weekly_activity', 'Weekly Activity')}</Text>
             <Text style={[styles.chartValue, { color: theme.primary }]}>
                {chartData ? chartData.datasets[0].data[chartData.datasets[0].data.length - 1] : 0} 
                <Text style={{ fontSize: 12, color: theme.textMuted }}> {activeStatTab === 'duration' ? t('common.min', 'min') : activeStatTab === 'volume' ? t('common.kg', 'kg') : t('routines.reps', 'Tekrar')}</Text>
             </Text>
          </View>

          {chartData && chartData.datasets[0].data.some(d => d > 0) ? (
            <View style={{ paddingVertical: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6, paddingHorizontal: 4 }}>
                {chartData.datasets[0].data.map((val, i) => {
                  const maxVal = Math.max(...chartData.datasets[0].data, 1);
                  const barH = Math.max(4, (val / maxVal) * 100);
                  return (
                    <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                      <Text style={{ color: theme.textMuted, fontSize: 9, fontWeight: 'bold' }}>{val > 0 ? val : ''}</Text>
                      <View style={{ width: '100%', height: barH, backgroundColor: theme.primary, borderRadius: 6, opacity: 0.8 + (i / chartData.datasets[0].data.length) * 0.2 }} />
                      <Text style={{ color: theme.textMuted, fontSize: 9 }} numberOfLines={1}>{chartData.labels[i]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={{ height: 140, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="stats-chart" size={40} color={theme.border} />
                <Text style={{ color: theme.textMuted, marginTop: 8 }}>{t('common.no_data', 'No data yet')}</Text>
            </View>
          )}

          <View style={styles.metricTabs}>
              {['duration', 'volume', 'reps'].map(tab => (
                  <TouchableOpacity 
                    key={tab}
                    onPress={() => setActiveStatTab(tab)}
                    style={[styles.metricTab, { backgroundColor: theme.background }, activeStatTab === tab && { backgroundColor: theme.primary }]}
                  >
                      <Text style={[styles.metricTabText, { color: theme.textMuted }, activeStatTab === tab && { color: '#fff' }]}>
                          {t(`profile.${tab}`)}
                      </Text>
                  </TouchableOpacity>
              ))}
          </View>
        </View>

        {/* Dashboard Grid */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{t('profile.insights', 'INSIGHTS').toUpperCase()}</Text>
          <View style={styles.panoGrid}>
            <TouchableOpacity style={[styles.panoItem, { backgroundColor: theme.surface }]}>
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceLight }]}>
                  <Ionicons name="trending-up" size={18} color={theme.primary} />
              </View>
              <Text style={[styles.panoItemText, { color: theme.text }]}>{t('profile.statistics', 'Stats')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.panoItem, { backgroundColor: theme.surface }]}>
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceLight }]}>
                  <Ionicons name="barbell" size={18} color={theme.primary} />
              </View>
              <Text style={[styles.panoItemText, { color: theme.text }]}>{t('menu.exercises')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Workouts */}
        <View style={styles.sectionContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted, marginBottom: 0 }]}>{t('profile.workouts').toUpperCase()}</Text>
            <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 12 }}>{workouts.length}</Text>
          </View>
          
          {workouts.length > 0 ? (
             <View style={{ gap: 12 }}>
                {workouts.map(w => (
                  <View key={w._id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View>
                           <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16 }}>{w.name}</Text>
                           <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>{moment(w.createdAt).format("MMM DD, YYYY")}</Text>
                        </View>
                        <TouchableOpacity style={[styles.shareBtn, { backgroundColor: theme.surfaceLight }]}>
                           <Ionicons name="share-social-outline" size={18} color={theme.text} />
                        </TouchableOpacity>
                     </View>
                     <View style={styles.cardFooter}>
                        <View style={styles.footerItem}>
                            <Ionicons name="time-outline" size={14} color={theme.primary} />
                            <Text style={[styles.footerText, { color: theme.text }]}>{w.durationMinutes || 0} {t('common.min', 'min')}</Text>
                        </View>
                        <View style={styles.footerItem}>
                            <Ionicons name="barbell-outline" size={14} color={theme.primary} />
                            <Text style={[styles.footerText, { color: theme.text }]}>{w.volumeKg || 0} {t('common.kg', 'kg')}</Text>
                        </View>
                     </View>
                  </View>
                ))}
             </View>
          ) : (
            <View style={[styles.card, styles.emptyWorkouts, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="barbell-outline" size={48} color={theme.border} />
              <Text style={[styles.emptyWorkoutsTitle, { color: theme.textMuted }]}>{t('profile.no_workouts_yet', 'No workouts yet')}</Text>
            </View>
          )}
        </View>

        {/* Suggested Athletes Section */}
        <View style={styles.sectionContainer}>
          <SuggestedAthletes navigation={navigation} />
        </View>
      </ScrollView>

      {/* Profile Edit Modal */}
      <ProfileModal visible={showEditProfile} onClose={() => setShowEditProfile(false)} />
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: theme.surface,
    marginRight: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: theme.text,
    fontSize: 28,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  nameText: {
    color: theme.text,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'flex-start',
  },
  statLabel: {
    color: theme.textMuted,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statNumber: {
    color: theme.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    flex: 1,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  chartCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  chartHeaderInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
  },
  chartTitle: {
      fontSize: 14,
      fontWeight: 'bold',
  },
  chartValue: {
      fontSize: 20,
      fontWeight: 'bold',
  },
  metricTabs: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
    backgroundColor: theme.background,
    padding: 4,
    borderRadius: 16,
  },
  metricTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricTabText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 16,
  },
  panoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  panoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
  },
  iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
  },
  panoItemText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  shareBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
  },
  cardFooter: {
      flexDirection: 'row',
      marginTop: 16,
      gap: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 12,
  },
  footerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
  },
  footerText: {
      fontSize: 13,
      fontWeight: 'bold',
  },
  emptyWorkouts: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyWorkoutsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
  },
});

export default Profile;
