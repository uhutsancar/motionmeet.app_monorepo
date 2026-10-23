import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import ScreenHeader from '../components/ScreenHeader';
import RadarChart from '../components/charts/RadarChart';
import ActivityCalendar from '../components/charts/ActivityCalendar';
import { toMuscleAxes } from '../features/stats/muscleAxes';
import { toDayBuckets, weekStreak, type DayBucket } from '../features/stats/dailySeries';
import NavRow from '../components/ui/NavRow';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import { useMuscleGroups } from '../hooks/useMuscleGroups';
import { useScrollEdge } from '../hooks/useScrollEdge';
import { getWorkoutStats, getWorkouts } from '../api/endpoints';
import { logHandledError } from '../utils/feedback';
import { formatDuration, formatNumber } from '../utils/format';
import dayjs from '../utils/dayjs';
import { TYPE } from '../config/layout';
import type { Workout, WorkoutStats } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';

const CALENDAR_WEEKS = 16;

/**
 * The statistics home. It answers "am I training regularly, and on what?"
 * with two pictures the rest of the app does not repeat: sixteen weeks of
 * training days as a calendar grid, and the hexagon of where the last month's
 * sets went. The weekly bars live on the profile; the reports follow as rows.
 */
const StatisticsMenu = ({ navigation }: NavigationOnlyProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme, isDark } = useTheme();
  const { getToken } = useAuthContext();
  const { data: muscleGroups } = useMuscleGroups();
  const headerEdge = useScrollEdge();
  const [month, setMonth] = useState<WorkoutStats | null>(null);
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayBucket | null>(null);

  const load = useCallback(async () => {
    try {
      setFailed(false);
      const token = await getToken();
      if (!token) return;
      const [monthData, workoutData] = await Promise.all([
        getWorkoutStats('month', token),
        getWorkouts(token),
      ]);
      if (monthData.success) setMonth(monthData);
      if (workoutData.success) setWorkouts(workoutData.workouts || []);
    } catch (error) {
      logHandledError('load-statistics', error);
      setFailed(true);
    }
  }, [getToken]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const muscleAxes = toMuscleAxes(muscleGroups as Array<{ code: string; name: string }>, month, t, language);
  const trained = muscleAxes.some((axis) => axis.value > 0);
  const days = workouts ? toDayBuckets(workouts, CALENDAR_WEEKS) : [];
  const trainedDays = days.filter((day) => day.workouts > 0).length;
  const streak = weekStreak(days);
  const shownDay = selectedDay ?? [...days].reverse().find((day) => day.workouts > 0) ?? null;

  const weekdays = [
    t('monthly_report.days.mon', 'Pzt'), t('monthly_report.days.tue', 'Sal'), t('monthly_report.days.wed', 'Çar'),
    t('monthly_report.days.thu', 'Per'), t('monthly_report.days.fri', 'Cum'), t('monthly_report.days.sat', 'Cts'),
    t('monthly_report.days.sun', 'Paz'),
  ];

  const summary = [
    { key: 'workouts', label: t('stats.workouts', 'Antrenman'), value: formatNumber(month?.totalWorkouts ?? 0, language) },
    { key: 'duration', label: t('stats.duration', 'Süre'), value: formatDuration(month?.totalDuration ?? 0, language) },
    { key: 'volume', label: t('stats.volume', 'Hacim'), value: formatNumber(month?.totalVolume ?? 0, language), unit: 'kg' },
    { key: 'sets', label: t('stats.sets', 'Set'), value: formatNumber(month?.totalSets ?? 0, language) },
  ];

  const reports: Array<{ icon: React.ComponentProps<typeof NavRow>['icon']; title: string; route: string }> = [
    { icon: 'calendar-outline', title: t('statistics.monthly_report', 'Aylık rapor'), route: 'MonthlyReportScreen' },
    { icon: 'trending-up-outline', title: t('statistics.advanced', 'Gelişmiş istatistikler'), route: 'AdvancedStatisticsScreen' },
    { icon: 'trophy-outline', title: t('statistics.records', 'Kişisel rekorlar'), route: 'LeaderboardScreen' },
    { icon: 'barbell-outline', title: t('statistics.main_exercises', 'Ana egzersizler'), route: 'MainExercisesScreen' },
    { icon: 'body-outline', title: t('statistics.muscle_dist', 'Kas dağılımı'), route: 'MuscleDistribution' },
    { icon: 'resize-outline', title: t('measurements.title', 'Ölçümler'), route: 'MeasurementsScreen' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScreenHeader
        title={t('statistics.title', 'İstatistikler')}
        onBack={() => navigation.goBack()}
        scrolled={headerEdge.scrolled}
        actions={[{
          icon: 'calendar-clear-outline',
          onPress: () => navigation.navigate('MonthlyReportScreen'),
          accessibilityLabel: t('statistics.monthly_report', 'Aylık rapor'),
        }]}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={headerEdge.onScroll}
        scrollEventThrottle={headerEdge.scrollEventThrottle}
      >
        {failed ? (
          <Pressable onPress={() => void load()} style={styles.pad} accessibilityRole="button">
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>
              {t('stats.load_failed', 'İstatistikler yüklenemedi.')}{' '}
              <Text style={{ color: theme.primary, fontWeight: '600' }}>{t('common.retry', 'Tekrar dene')}</Text>
            </Text>
          </Pressable>
        ) : null}

        {/* The last thirty days as four plain figures, two by two. */}
        <Text style={[styles.caption, styles.pad, { color: theme.textMuted }]}>{t('statistics.last_30_days', 'Son 30 gün')}</Text>
        <View style={[styles.summary, styles.pad]}>
          {summary.map((item) => (
            <View key={item.key} style={styles.summaryCell}>
              <Text style={[styles.summaryValue, { color: theme.text }]} numberOfLines={1}>
                {item.value}
                {item.unit ? <Text style={[styles.unit, { color: theme.textMuted }]}> {item.unit}</Text> : null}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.section, styles.pad]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('stats.consistency', 'Antrenman takvimi')}</Text>
          <Text style={[styles.note, { color: theme.textMuted }]}>
            {workouts
              ? streak >= 2
                ? t('stats.consistency_streak', {
                    days: trainedDays,
                    weeks: streak,
                    defaultValue: 'Son 16 haftada {{days}} gün · {{weeks}} haftadır aralıksız',
                  })
                : t('stats.consistency_days', { days: trainedDays, defaultValue: 'Son 16 haftada {{days}} gün antrenman' })
              : ' '}
          </Text>
          <View style={{ marginTop: 12 }}>
            {workouts ? (
              <ActivityCalendar
                days={days}
                selectedKey={shownDay?.key}
                onSelect={setSelectedDay}
                weekdayLabels={weekdays}
                monthLabel={(key) => dayjs(key).format('MMM')}
                lessLabel={t('stats.less', 'Az')}
                moreLabel={t('stats.more', 'Çok')}
                accessibilityLabel={t('stats.consistency_a11y', {
                  days: trainedDays,
                  defaultValue: 'Son 16 haftada {{days}} antrenman günü',
                })}
              />
            ) : (
              <View style={{ height: 150 }} />
            )}
          </View>
          {shownDay ? (
            <Text style={[styles.readout, { color: theme.text }]}>
              {dayjs(shownDay.key).format('D MMMM dddd')}
              <Text style={{ color: theme.textMuted }}>
                {'  '}
                {shownDay.workouts
                  ? `${t('monthly_report.workouts_count', { count: shownDay.workouts, defaultValue: '{{count}} antrenman' })} · ${formatDuration(shownDay.duration, language)}`
                  : t('stats.rest_day', 'Dinlenme günü')}
              </Text>
            </Text>
          ) : null}
        </View>

        <View style={[styles.section, styles.pad]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('stats.muscles_30_days', 'Kas grupları · son 30 gün')}</Text>
            <Pressable onPress={() => navigation.navigate('MuscleDistribution')} hitSlop={10} accessibilityRole="button">
              <Text style={[styles.action, { color: theme.primary }]}>{t('stats.all_stats', 'Tümü')}</Text>
            </Pressable>
          </View>
          {trained ? (
            <View style={{ marginTop: 8 }}>
              <RadarChart
                axes={muscleAxes}
                currentLabel={t('statistics.last_30_days', 'Son 30 gün')}
                previousLabel={t('stats.previous_30_days', 'Önceki 30 gün')}
                maxSize={320}
                accessibilityLabel={muscleAxes.map((axis) => `${axis.label} ${axis.display}`).join(', ')}
              />
            </View>
          ) : (
            <Text style={[styles.note, { color: theme.textMuted }]}>{t('stats.no_sets_period', 'Bu dönemde tamamlanmış set yok.')}</Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, styles.reportsTitle, { color: theme.text }]}>{t('statistics.reports', 'Raporlar')}</Text>
        <View style={[styles.rows, { borderTopColor: theme.border }]}>
          {reports.map(({ route, icon, title }, index) => (
            <NavRow key={route} icon={icon} title={title} onPress={() => navigation.navigate(route)} last={index === reports.length - 1} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingTop: 4, paddingBottom: 40 },
  pad: { paddingHorizontal: 16 },
  caption: { fontSize: TYPE.meta, fontWeight: '500' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, rowGap: 12 },
  summaryCell: { width: '50%' },
  summaryValue: { fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 12.5, fontWeight: '500' },
  summaryLabel: { fontSize: TYPE.meta, marginTop: 1 },
  section: { marginTop: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontSize: TYPE.section, fontWeight: '700' },
  action: { fontSize: 13.5, fontWeight: '600' },
  note: { fontSize: 13, marginTop: 3 },
  readout: { fontSize: 13, marginTop: 10, fontVariant: ['tabular-nums'] },
  reportsTitle: { paddingHorizontal: 16, marginTop: 32, marginBottom: 6 },
  rows: { borderTopWidth: StyleSheet.hairlineWidth },
});

export default StatisticsMenu;
