// React Native's Image is used on purpose: Expo Go ships its own native
// expo-image build, and when it disagrees with the version installed here the
// view renders blank instead of erroring, so exercise photos and GIFs vanish.
import React, { useState, useEffect, useCallback } from 'react';
import { Image, ScrollView, ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { API_URL } from '../config/environment';
import { resolvePublicMediaUrl } from '@motionmeet/shared';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { getExerciseHistory, getExerciseStats } from '../api/endpoints';
import { useAuthContext } from '../context/AuthProvider';
import { Appbar, Text, Surface, Button } from 'react-native-paper';
import { logHandledError } from '../utils/feedback';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { CARD } from '../config/layout';
import dayjs from '../utils/dayjs';
import type { ExerciseSessionEntry, ExerciseStats } from '@motionmeet/shared';
import type { BaseNavigationScreenProps, ExerciseDetailRouteParams } from '../navigation/types';

type DetailTab = 'summary' | 'history' | 'instructions';

const ExerciseDetail = ({ route, navigation }: BaseNavigationScreenProps) => {
  const { exercise } = route.params as ExerciseDetailRouteParams;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { horizontalPadding, isNarrow } = useResponsiveLayout({
    minTwoColumnWidth: 420,
  });
  const styles = getStyles(theme);
  const { t, i18n } = useTranslation();

  const [activeTab, setActiveTab] = useState<DetailTab>('summary');
  const [stats, setStats] = useState<ExerciseStats | null>(null);
  const [history, setHistory] = useState<ExerciseSessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const { getToken } = useAuthContext();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const data = await getExerciseStats(exercise._id, token);
        if (data.success) {
          setStats(data);
        }
      } catch (error) {
        logHandledError('load-exercise-stats', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [exercise._id, getToken]);

  // History is only fetched when its tab is opened; opening the screen should
  // not pay for a query the athlete may never look at.
  const loadHistory = useCallback(async () => {
    if (historyLoaded || historyLoading) return;
    try {
      setHistoryLoading(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const data = await getExerciseHistory(exercise._id, token, 20);
      if (data.success) setHistory(data.history || []);
      setHistoryLoaded(true);
    } catch (error) {
      logHandledError('load-exercise-history', error);
    } finally {
      setHistoryLoading(false);
    }
  }, [exercise._id, getToken, historyLoaded, historyLoading]);

  useEffect(() => {
    if (activeTab === 'history') void loadHistory();
  }, [activeTab, loadHistory]);

  const language = i18n.resolvedLanguage?.split('-')[0] || 'en';
  const steps = exercise.instructionSteps?.[language] || exercise.instructionSteps?.en || [];
  const instruction = exercise.instructions?.[language] || exercise.instructions?.en || '';
  const mediaUrl = resolvePublicMediaUrl(exercise.gifUrl, API_URL);

  const startWorkout = () => {
    navigation.navigate('ActiveWorkoutScreen', {
      routine: {
        name: exercise.name,
        exercises: [{
          exerciseId: exercise,
          sets: [{ reps: '', weight: '', setType: 'normal' }],
        }],
      },
    });
  };

  const tabs: Array<{ key: DetailTab; label: string }> = [
    { key: 'summary', label: t('exercises.tab_summary', 'Özet') },
    { key: 'history', label: t('exercises.tab_history', 'Geçmiş') },
    { key: 'instructions', label: t('exercises.tab_instructions', 'Talimatlar') },
  ];

  const chartPoints = (stats?.history || []).slice(-12);
  const maxChartWeight = Math.max(...chartPoints.map((point) => point.maxWeight), 1);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Appbar.Header style={styles.header} statusBarHeight={0}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content
          title={exercise.name}
          titleStyle={{ color: theme.text, fontSize: 17, fontWeight: '800' }}
        />
      </Appbar.Header>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tabItem, active && { borderBottomColor: theme.primary }]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={{ color: active ? theme.primary : theme.textMuted, fontWeight: '700', fontSize: 14 }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontalPadding, paddingBottom: 24 + insets.bottom },
        ]}
      >
        {activeTab !== 'history' && (
          <Surface elevation={0} style={styles.mediaContainer}>
            {mediaUrl ? (
              <>
                <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="contain" accessibilityLabel={exercise.name} />
                {/* The exercise animations are Gym visual's property. Their
                    terms require this notice to stay with every use of the
                    media, so it renders next to the media itself rather than
                    only in a licences list. See docs/LICENSES.md. */}
                <Text style={{ color: theme.textMuted, fontSize: 9.5, textAlign: 'center', marginTop: 6 }}>
                  © Gym visual — https://gymvisual.com/
                </Text>
              </>
            ) : (
              <Surface style={[styles.placeholderMedia, { backgroundColor: theme.surface }]} elevation={0}>
                <Ionicons name="barbell" size={44} color={theme.textMuted} />
                <Text variant="bodyMedium" style={{ color: theme.textMuted, marginTop: 8 }}>
                  {t('exercises.media_unavailable', 'Media unavailable')}
                </Text>
              </Surface>
            )}
          </Surface>
        )}

        {activeTab === 'summary' && (
          <>
            <Surface elevation={0} style={styles.infoSection}>
              <Text variant="headlineSmall" style={styles.title}>{exercise.name}</Text>
              <Text variant="bodyMedium" style={styles.subtitle}>
                {t('exercises.primary_muscle', 'Birincil')}: {exercise.muscleGroup} • {exercise.equipment}
              </Text>
            </Surface>

            <Surface elevation={0} style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>{t('exercises.history', 'Geçmiş Rekorlar')}</Text>
              {loading ? (
                <ActivityIndicator color={theme.primary} style={{ marginTop: 16 }} />
              ) : (
                <>
                  <Surface elevation={0} style={[styles.statsGrid, isNarrow && styles.statsGridNarrow]}>
                    <Surface style={[styles.statBox, isNarrow && styles.statBoxNarrow]} elevation={0}>
                      <Text variant="labelMedium" style={styles.statLabel}>{t('exercises.personal_record', 'Personal Record')}</Text>
                      <Text variant="titleLarge" style={styles.statValue}>
                        {stats?.personalRecord || 0} <Text variant="bodySmall" style={{ color: theme.textMuted }}>kg</Text>
                      </Text>
                    </Surface>
                    <Surface style={[styles.statBox, isNarrow && styles.statBoxNarrow]} elevation={0}>
                      <Text variant="labelMedium" style={styles.statLabel}>{t('exercises.total_sessions', 'Total Sessions')}</Text>
                      <Text variant="titleLarge" style={styles.statValue}>{stats?.totalSessions || 0}</Text>
                    </Surface>
                  </Surface>

                  {chartPoints.length > 0 && (
                    <View style={styles.chartRow}>
                      {chartPoints.map((point) => (
                        <View key={point.date} style={styles.chartColumn}>
                          <View
                            style={[
                              styles.chartBar,
                              {
                                height: Math.max(4, (point.maxWeight / maxChartWeight) * 64),
                                backgroundColor: theme.primary,
                              },
                            ]}
                          />
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </Surface>
          </>
        )}

        {activeTab === 'history' && (
          <Surface elevation={0} style={{ marginTop: 12, backgroundColor: 'transparent' }}>
            {historyLoading ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: 28 }} />
            ) : history.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="barbell" size={30} color={theme.textMuted} />
                <Text style={{ color: theme.textMuted, marginTop: 10, textAlign: 'center' }}>
                  {t('exercises.no_history', 'Bu egzersiz için henüz kayıt yok')}
                </Text>
              </View>
            ) : (
              history.map((session) => (
                <Surface key={`${session.workoutId}-${session.performedAt}`} elevation={0} style={styles.historyCard}>
                  <Text style={styles.historyTitle} numberOfLines={1}>{session.workoutName}</Text>
                  <Text style={styles.historyDate}>{dayjs(session.performedAt).format('D MMM YYYY, HH:mm')}</Text>

                  <View style={styles.historyHeaderRow}>
                    <Text style={styles.historyColumnLabel}>{t('exercises.set_label', 'SET')}</Text>
                    <Text style={[styles.historyColumnLabel, { flex: 1, marginLeft: 12 }]}>
                      {t('exercises.weight_and_reps', 'AĞIRLIK VE TEKRAR')}
                    </Text>
                  </View>

                  {session.sets.map((set) => (
                    <View key={`${session.workoutId}-${set.position}`} style={styles.historySetRow}>
                      <Text style={styles.historySetIndex}>{set.position + 1}</Text>
                      <Text style={styles.historySetValue}>
                        {set.weight} kg x {set.reps}
                      </Text>
                    </View>
                  ))}
                </Surface>
              ))
            )}
          </Surface>
        )}

        {activeTab === 'instructions' && (
          <Surface elevation={0} style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>{exercise.name}</Text>
            <Text variant="bodyLarge" style={styles.bodyText}>
              {steps.length
                ? steps.map((step, index) => `${index + 1}. ${step}`).join('\n\n')
                : instruction || t('exercises.instructions_unavailable', 'Instructions are not available for this exercise yet.')}
            </Text>
          </Surface>
        )}

        <Button
          mode="contained"
          style={styles.logButton}
          contentStyle={{ height: 44 }}
          labelStyle={styles.logButtonText}
          buttonColor={theme.primary}
          onPress={startWorkout}
        >
          {t('exercises.log_workout', 'Antrenman Kaydet')}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { backgroundColor: theme.background, elevation: 0 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.background,
  },
  tabItem: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  scrollContent: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 24 },
  mediaContainer: { width: '100%', aspectRatio: 16 / 10, marginTop: 12 },
  media: { flex: 1, borderRadius: CARD.radius, backgroundColor: '#FFFFFF' },
  placeholderMedia: { flex: 1, borderRadius: CARD.radius, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  infoSection: { marginTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: 'transparent' },
  title: { fontWeight: 'bold', color: theme.text, marginBottom: 3 },
  subtitle: { color: theme.textMuted, fontWeight: '500' },
  section: { marginTop: 16, backgroundColor: 'transparent' },
  sectionTitle: { fontWeight: 'bold', color: theme.text, marginBottom: 10 },
  bodyText: { color: theme.text, lineHeight: 23, opacity: 0.9 },
  statsGrid: { flexDirection: 'row', gap: CARD.gap, marginTop: 4, backgroundColor: 'transparent' },
  statsGridNarrow: { flexDirection: 'column' },
  statBox: {
    flex: 1,
    borderRadius: CARD.radius,
    padding: CARD.padding,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  statBoxNarrow: { flex: 0, width: '100%' },
  statLabel: { fontWeight: '700', color: theme.textMuted, marginBottom: 4 },
  statValue: { fontWeight: '900', color: theme.text },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    height: 72,
    marginTop: 14,
  },
  chartColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartBar: { width: '100%', maxWidth: 20, borderRadius: 3 },
  historyCard: {
    borderRadius: CARD.radius,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: CARD.padding,
    marginBottom: CARD.gap,
  },
  historyTitle: { color: theme.text, fontSize: 15, fontWeight: '800' },
  historyDate: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  historyColumnLabel: { color: theme.textMuted, fontSize: 11, fontWeight: '700' },
  historySetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  historySetIndex: { color: theme.textMuted, fontSize: 13, fontWeight: '700', width: 26 },
  historySetValue: { color: theme.text, fontSize: 14, fontWeight: '600', marginLeft: 12 },
  logButton: { marginTop: 18, borderRadius: 100 },
  logButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});

export default ExerciseDetail;
