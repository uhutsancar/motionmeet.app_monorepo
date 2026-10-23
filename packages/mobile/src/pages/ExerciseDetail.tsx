// React Native's Image is used on purpose: Expo Go ships its own native
// expo-image build, and when it disagrees with the version installed here the
// view renders blank instead of erroring, so exercise photos and GIFs vanish.
import React, { useState, useEffect, useCallback } from 'react';
import { Image, ScrollView, ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import SwipeablePager from '../components/SwipeablePager';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { API_URL } from '../config/environment';
import { resolvePublicMediaUrl } from '@motionmeet/shared';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { getExerciseHistory, getExerciseStats } from '../api/endpoints';
import { useAuthContext } from '../context/AuthProvider';
import { Text, Surface, Button } from 'react-native-paper';
import { logHandledError } from '../utils/feedback';
import { exerciseMeta, exerciseTitle } from '../utils/exerciseLabels';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { CARD } from '../config/layout';
import dayjs from '../utils/dayjs';
import LineChart from '../components/charts/LineChart';
import { formatWeight } from '../utils/format';
import ScreenHeader from '../components/ScreenHeader';
import type { ExerciseSessionEntry, ExerciseStats } from '@motionmeet/shared';
import type { BaseNavigationScreenProps, ExerciseDetailRouteParams } from '../navigation/types';

/** Pane order, shared by the tab strip and the pager so they cannot drift. */
const TAB_ORDER = ['summary', 'history', 'instructions'] as const;
type DetailTab = (typeof TAB_ORDER)[number];

const ExerciseDetail = ({ route, navigation }: BaseNavigationScreenProps) => {
  const { exercise } = route.params as ExerciseDetailRouteParams;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsiveLayout({
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
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const { getToken } = useAuthContext();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const data = await getExerciseStats(exercise._id, token);
        if (data.success) {
          setStats(data.stats ?? null);
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
  const pointIndex = selectedPoint ?? chartPoints.length - 1;
  const point = chartPoints[pointIndex];

  const pageContentStyle = [
    styles.scrollContent,
    { paddingHorizontal: horizontalPadding, paddingBottom: 24 + insets.bottom },
  ];

  // Two of the three panes open on the artwork, and all three end on the same
  // call to action, so both are built once here rather than repeated per pane.
  const renderMedia = () => (
    <Surface elevation={0} style={styles.mediaContainer}>
      {mediaUrl ? (
        <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="contain" accessibilityLabel={exercise.name} />
      ) : (
        <Surface style={[styles.placeholderMedia, { backgroundColor: theme.surface }]} elevation={0}>
          <Ionicons name="barbell" size={44} color={theme.textMuted} />
          <Text variant="bodyMedium" style={{ color: theme.textMuted, marginTop: 8 }}>
            {t('exercises.media_unavailable', 'Media unavailable')}
          </Text>
        </Surface>
      )}
    </Surface>
  );

  const renderLogButton = () => (
    <Button
      mode="contained"
      style={styles.logButton}
      contentStyle={{ height: 40 }}
      labelStyle={styles.logButtonText}
      buttonColor={theme.primary}
      onPress={startWorkout}
    >
      {t('exercises.log_workout', 'Antrenman Kaydet')}
    </Button>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title={exerciseTitle(exercise.name, i18n.language)} onBack={() => navigation.goBack()} />

      {/* Tabs. The underline follows the pager, and the pager follows a tap,
          so the three panes can also just be swiped through by hand. */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => {
                setActiveTab(tab.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tabItem, active && { borderBottomColor: theme.text }]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={{ color: active ? theme.text : theme.textMuted, fontWeight: '600', fontSize: 13.5 }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <SwipeablePager
        page={TAB_ORDER.indexOf(activeTab)}
        onPageChange={(index) => {
          const tab = TAB_ORDER[index];
          if (tab) setActiveTab(tab);
        }}
      >
        <View key="summary" collapsable={false}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pageContentStyle}>
            {renderMedia()}

            <Surface elevation={0} style={styles.infoSection}>
              <Text variant="headlineSmall" style={styles.title}>{exerciseTitle(exercise.name, i18n.language)}</Text>
              <Text variant="bodyMedium" style={styles.subtitle}>
                {t('exercises.primary_muscle', 'Birincil')}: {exerciseMeta(exercise, t, i18n.language)}
              </Text>
            </Surface>

            <Surface elevation={0} style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>{t('exercises.history', 'Geçmiş Rekorlar')}</Text>
              {loading ? (
                <ActivityIndicator color={theme.primary} style={{ marginTop: 16 }} />
              ) : (
                <>
                  {/* Two plain figures and the heaviest set of each session as
                      a line, the way Hevy charts a lift's progress: the boxed
                      tiles and the unlabelled mini bars said less with more. */}
                  <View style={styles.figures}>
                    <View style={styles.figure}>
                      <Text style={styles.figureValue}>
                        {formatWeight(stats?.personalRecord || 0, i18n.language)}
                        <Text style={styles.figureUnit}> kg</Text>
                      </Text>
                      <Text style={styles.figureLabel}>{t('exercises.personal_record', 'Personal Record')}</Text>
                    </View>
                    <View style={styles.figure}>
                      <Text style={styles.figureValue}>{stats?.totalSessions || 0}</Text>
                      <Text style={styles.figureLabel}>{t('exercises.total_sessions', 'Total Sessions')}</Text>
                    </View>
                  </View>

                  {chartPoints.length > 1 && point ? (
                    <View style={{ marginTop: 18 }}>
                      <Text style={styles.figureLabel}>
                        {t('exercises.heaviest_set', 'En ağır set')} · {dayjs(point.date).format('D MMM')}
                      </Text>
                      <Text style={[styles.figureValue, { marginBottom: 8 }]}>
                        {formatWeight(point.maxWeight, i18n.language)}
                        <Text style={styles.figureUnit}> kg</Text>
                      </Text>
                      <LineChart
                        data={chartPoints.map((item) => ({ key: item.date, label: dayjs(item.date).format('D MMM'), value: item.maxWeight }))}
                        selectedIndex={pointIndex}
                        onSelect={setSelectedPoint}
                        zeroBased={false}
                        formatTick={(value) => formatWeight(value, i18n.language)}
                        height={150}
                        accessibilityLabel={t('exercises.progress_chart', 'Seanslara göre en ağır set')}
                      />
                    </View>
                  ) : null}
                </>
              )}
            </Surface>

            {renderLogButton()}
          </ScrollView>
        </View>

        <View key="history" collapsable={false}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pageContentStyle}>
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

            {renderLogButton()}
          </ScrollView>
        </View>

        <View key="instructions" collapsable={false}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pageContentStyle}>
            {renderMedia()}

            <Surface elevation={0} style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>{exercise.name}</Text>
              <Text variant="bodyLarge" style={styles.bodyText}>
                {steps.length
                  ? steps.map((step, index) => `${index + 1}. ${step}`).join('\n\n')
                  : instruction || t('exercises.instructions_unavailable', 'Instructions are not available for this exercise yet.')}
              </Text>
            </Surface>

            {renderLogButton()}
          </ScrollView>
        </View>
      </SwipeablePager>
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { backgroundColor: theme.background, elevation: 0 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    backgroundColor: theme.background,
  },
  tabItem: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  scrollContent: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 24 },
  mediaContainer: { width: '100%', aspectRatio: 16 / 10, marginTop: 12 },
  media: { flex: 1, borderRadius: CARD.radius, backgroundColor: '#FFFFFF' },
  placeholderMedia: { flex: 1, borderRadius: CARD.radius, justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
  infoSection: { marginTop: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, backgroundColor: 'transparent' },
  title: { fontWeight: '700', color: theme.text, marginBottom: 2, fontSize: 19 },
  subtitle: { color: theme.textMuted, fontSize: 13 },
  section: { marginTop: 16, backgroundColor: 'transparent' },
  sectionTitle: { fontWeight: '700', color: theme.text, marginBottom: 8, fontSize: 15 },
  bodyText: { color: theme.text, lineHeight: 23, opacity: 0.9 },
  figures: { flexDirection: 'row', marginTop: 2 },
  figure: { flex: 1 },
  figureValue: { fontSize: 19, fontWeight: '700', color: theme.text, fontVariant: ['tabular-nums'] },
  figureUnit: { fontSize: 13, fontWeight: '500', color: theme.textMuted },
  figureLabel: { fontSize: 12, color: theme.textMuted, marginTop: 1 },
  historyCard: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  historyTitle: { color: theme.text, fontSize: 14.5, fontWeight: '600' },
  historyDate: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  historyColumnLabel: { color: theme.textMuted, fontSize: 11, fontWeight: '500' },
  historySetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  historySetIndex: { color: theme.textMuted, fontSize: 13, fontWeight: '700', width: 26 },
  historySetValue: { color: theme.text, fontSize: 14, fontWeight: '600', marginLeft: 12 },
  logButton: { marginTop: 18, borderRadius: 8 },
  logButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default ExerciseDetail;
