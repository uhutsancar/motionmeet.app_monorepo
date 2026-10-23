import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { getPersonalRecords, getWorkoutStats } from '../api/endpoints';
import { useAuthContext } from '../context/AuthProvider';
import { useMuscleGroups } from '../hooks/useMuscleGroups';
import { logHandledError } from '../utils/feedback';
import { formatCompact, formatDuration, formatNumber, formatWeight } from '../utils/format';
import { exerciseTitle } from '../utils/exerciseLabels';
import dayjs from '../utils/dayjs';
import ScreenHeader from '../components/ScreenHeader';
import LineChart from '../components/charts/LineChart';
import StatStrip from '../components/charts/StatStrip';
import BarList from '../components/charts/BarList';
import ShareBar from '../components/charts/ShareBar';
import { useScrollEdge } from '../hooks/useScrollEdge';
import { TYPE } from '../config/layout';
import { toMuscleAxes } from '../features/stats/muscleAxes';
import { toMonthDays, type MonthMetric } from '../features/stats/monthSeries';
import { latestActiveIndex } from '../components/charts/scale';
import type { PersonalRecord, WorkoutStats } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';

const DETAIL_ROUTES: Record<MonthMetric, string> = {
  workouts: 'WorkoutsDetailScreen',
  duration: 'DurationDetailScreen',
  volume: 'VolumeDetailScreen',
  sets: 'SetsDetailScreen',
};

/**
 * The month so far. Answers "how did this month go?": the four totals sit
 * in one strip and double as the chart's metric tabs, the chart shows every
 * day of the month up to today, then the training days on a calendar and
 * where the sets went.
 */
const MonthlyReportScreen = ({ navigation }: NavigationOnlyProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const { getToken } = useAuthContext();
  const { data: muscleGroups } = useMuscleGroups();
  const [metric, setMetric] = useState<MonthMetric>('workouts');
  const [statsData, setStatsData] = useState<WorkoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const headerEdge = useScrollEdge();

  const now = new Date();
  const monthName = dayjs(now).format('MMMM YYYY');
  const days = toMonthDays(statsData?.stats, now);
  const [selected, setSelected] = useState<number | null>(null);
  const selectedIndex = selected ?? latestActiveIndex(days.map((item) => item[metric]));

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const data = await getWorkoutStats('calendar_month', token);
        if (data.success) setStatsData(data);
        // Records are a section of the report, not a condition for it: if
        // they fail to load the rest of the month still shows.
        getPersonalRecords(token)
          .then((result) => { if (result.success) setRecords(result.records || []); })
          .catch((error) => logHandledError('load-monthly-records', error));
      } catch (error) {
        logHandledError('load-monthly-report', error);
        setFailed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  const activeDays = days.filter((day) => day.workouts > 0);
  const workoutDays = new Set(activeDays.map((day) => day.day));
  const totals: Record<MonthMetric, number> = {
    workouts: statsData?.totalWorkouts ?? 0,
    duration: statsData?.totalDuration ?? 0,
    volume: statsData?.totalVolume ?? 0,
    sets: statsData?.totalSets ?? 0,
  };
  const day = days[selectedIndex];
  // The month as it built up: each day carries everything before it, so the
  // line answers "how far into the month's total am I?" where daily bars
  // (kept on the detail screens) answer "what happened on that day?".
  const running = days.reduce<number[]>((sums, item) => {
    sums.push((sums[sums.length - 1] ?? 0) + item[metric]);
    return sums;
  }, []);
  const describe = (name: MonthMetric, value: number): string =>
    name === 'duration'
      ? formatDuration(value, language)
      : name === 'volume'
        ? `${formatNumber(value, language)} kg`
        : name === 'sets'
          ? t('monthly_report.sets_count', { count: value, defaultValue: '{{count}} set' })
          : t('monthly_report.workouts_count', { count: value, defaultValue: '{{count}} antrenman' });

  const muscleAxes = toMuscleAxes(muscleGroups as Array<{ code: string; name: string }>, statsData, t, language);
  const trainedMuscles = muscleAxes.some((axis) => axis.value > 0);

  const monthRecords = records
    .filter((record) => dayjs(record.recordedAt).isSame(dayjs(now), 'month'))
    .sort((left, right) => dayjs(right.recordedAt).valueOf() - dayjs(left.recordedAt).valueOf());
  const topExercises = (statsData?.exerciseBreakdown ?? [])
    .filter((item) => item.volume > 0)
    .map((item) => ({
      key: item.exerciseId || item.name,
      label: exerciseTitle(item.name, language),
      value: item.volume,
      display: `${formatNumber(item.volume, language)} kg`,
    }));

  const weekdays = [
    t('monthly_report.days.mon', 'Pzt'), t('monthly_report.days.tue', 'Sal'), t('monthly_report.days.wed', 'Çar'),
    t('monthly_report.days.thu', 'Per'), t('monthly_report.days.fri', 'Cum'), t('monthly_report.days.sat', 'Cts'),
    t('monthly_report.days.sun', 'Paz'),
  ];
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getUTCDay() + 6) % 7;
  const cells: Array<number | null> = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7) cells.push(null);

  const shareReport = async () => {
    await Share.share({
      message: t('monthly_report.share_message', {
        month: monthName,
        workouts: totals.workouts,
        volume: Math.round(totals.volume),
        duration: Math.round(totals.duration),
      }),
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={monthName}
        scrolled={headerEdge.scrolled}
        onBack={() => navigation.goBack()}
        actions={[{ icon: 'share-outline', onPress: shareReport, accessibilityLabel: t('monthly_report.share', 'Paylaş') }]}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={headerEdge.onScroll}
        scrollEventThrottle={headerEdge.scrollEventThrottle}
      >
        {loading ? (
          <View style={styles.state}><ActivityIndicator color={theme.textMuted} /></View>
        ) : failed ? (
          <Text style={[styles.note, styles.pad, { color: theme.textMuted }]}>{t('stats.load_failed', 'İstatistikler yüklenemedi.')}</Text>
        ) : (
          <>
            <Text style={[styles.lead, { color: theme.textSecondary }]}>
              {!activeDays.length
                ? t('monthly_report.no_data', 'Bu ay henüz antrenman yok.')
                : (statsData?.currentStreakDays ?? 0) >= 2
                  ? t('monthly_report.lead', {
                      days: activeDays.length,
                      streak: statsData?.currentStreakDays ?? 0,
                      defaultValue: 'Bu ay {{days}} gün antrenman yaptın. Güncel seri: {{streak}} gün.',
                    })
                  : t('monthly_report.lead_days', { days: activeDays.length, defaultValue: 'Bu ay {{days}} gün antrenman yaptın.' })}
            </Text>

            <StatStrip
              selectedKey={metric}
              onSelect={(key) => setMetric(key as MonthMetric)}
              cells={[
                { key: 'workouts', label: t('monthly_report.workouts', 'Antrenman'), value: formatNumber(totals.workouts, language) },
                { key: 'duration', label: t('monthly_report.duration', 'Süre'), value: formatDuration(totals.duration, language) },
                { key: 'volume', label: t('monthly_report.volume', 'Hacim'), value: formatNumber(totals.volume, language), unit: 'kg' },
                { key: 'sets', label: t('monthly_report.sets', 'Set'), value: formatNumber(totals.sets, language) },
              ]}
            />

            <View style={styles.readout}>
              <Text style={[styles.readoutDay, { color: theme.textMuted }]}>
                {day
                  ? t('monthly_report.until_day', { day: dayjs(day.key).format('D MMMM'), defaultValue: '{{day}} itibarıyla toplam' })
                  : ''}
              </Text>
              <Text style={[styles.readoutValue, { color: theme.text }]}>
                {day ? describe(metric, running[selectedIndex] ?? 0) : ''}
                {day && day[metric] > 0 ? (
                  <Text style={{ color: theme.textMuted, fontSize: 13, fontWeight: '400' }}>
                    {'  '}+{describe(metric, day[metric])} {t('monthly_report.that_day', 'o gün')}
                  </Text>
                ) : null}
              </Text>
            </View>
            <View style={styles.pad}>
              <LineChart
                data={days.map((item, index) => ({ key: item.key, label: String(item.day), value: running[index] }))}
                selectedIndex={selectedIndex}
                onSelect={setSelected}
                integer={metric === 'workouts' || metric === 'sets'}
                formatTick={(value) => (metric === 'duration' ? formatNumber(value, language) : formatCompact(value, language))}
                height={160}
                accessibilityLabel={t('monthly_report.running_chart', 'Ay boyunca birikimli toplam')}
              />
            </View>
            <Pressable
              onPress={() => navigation.navigate(DETAIL_ROUTES[metric], { statsData })}
              accessibilityRole="button"
              style={styles.detailLink}
              hitSlop={8}
            >
              <Text style={{ color: theme.primary, fontSize: 13.5, fontWeight: '600' }}>{t('monthly_report.daily_details', 'Günlere göre ayrıntı')}</Text>
            </Pressable>

            <View style={[styles.section, styles.pad]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('monthly_report.workout_days', 'Antrenman günleri')}</Text>
              <View style={styles.weekRow}>
                {weekdays.map((name) => (
                  <Text key={name} style={[styles.weekday, { color: theme.textMuted }]}>{name}</Text>
                ))}
              </View>
              {Array.from({ length: cells.length / 7 }, (_, week) => (
                <View key={week} style={styles.weekRow}>
                  {cells.slice(week * 7, week * 7 + 7).map((date, index) => {
                    const trained = date !== null && workoutDays.has(date);
                    const today = date === now.getUTCDate();
                    return (
                      <View key={`${week}-${index}`} style={styles.dayCell}>
                        {date !== null && (
                          <View
                            style={[
                              styles.dayDot,
                              trained && { backgroundColor: theme.primary },
                              today && !trained && { borderWidth: 1.5, borderColor: theme.textSecondary },
                            ]}
                            accessible
                            accessibilityLabel={`${date}${trained ? `, ${t('monthly_report.trained', 'antrenman var')}` : ''}`}
                          >
                            <Text style={{ color: trained ? '#FFFFFF' : future(date, now) ? theme.textMuted : theme.text, fontSize: 13, fontWeight: trained || today ? '600' : '400' }}>
                              {date}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            <View style={[styles.section, styles.pad]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('monthly_report.records', 'Bu ayın rekorları')}</Text>
              {monthRecords.length ? (
                <View style={{ marginTop: 8 }}>
                  {monthRecords.map((record, index) => (
                    <View
                      key={record.exerciseId}
                      style={[styles.recordRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={[styles.recordName, { color: theme.text }]}>{exerciseTitle(record.name, language)}</Text>
                        <Text style={[styles.recordDate, { color: theme.textMuted }]}>{dayjs(record.recordedAt).format('D MMMM')}</Text>
                      </View>
                      <Text style={[styles.recordValue, { color: theme.text }]}>
                        {formatWeight(record.value, language)}
                        <Text style={{ color: theme.textMuted, fontWeight: '500', fontSize: 12.5 }}> kg</Text>
                        <Text style={{ color: theme.textSecondary, fontWeight: '600', fontSize: 13.5 }}>  × {formatNumber(record.reps, language)}</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.note, { color: theme.textMuted }]}>{t('monthly_report.no_records', 'Bu ay henüz yeni rekor yok.')}</Text>
              )}
            </View>

            <View style={[styles.section, styles.pad]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('monthly_report.muscle_distribution', 'Kas dağılımı')}</Text>
              {trainedMuscles ? (
                <View style={{ marginTop: 12 }}>
                  <ShareBar
                    parts={muscleAxes.map((axis) => ({ key: axis.key, label: axis.label, value: axis.value, display: axis.display }))}
                    accessibilityLabel={muscleAxes.map((axis) => `${axis.label} ${axis.display}`).join(', ')}
                  />
                </View>
              ) : (
                <Text style={[styles.note, { color: theme.textMuted }]}>{t('stats.no_sets_period', 'Bu dönemde tamamlanmış set yok.')}</Text>
              )}
            </View>

            {topExercises.length ? (
              <View style={[styles.section, styles.pad]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('stats.top_exercises', 'En çok hacim yapılan hareketler')}</Text>
                <View style={{ marginTop: 16 }}><BarList rows={topExercises} muted /></View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const future = (date: number, now: Date): boolean => date > now.getUTCDate();

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 40 },
  pad: { paddingHorizontal: 16 },
  lead: { fontSize: 13.5, lineHeight: 19, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  readout: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  readoutDay: { fontSize: 12.5 },
  readoutValue: { fontSize: 20, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },
  detailLink: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10 },
  section: { marginTop: 28 },
  sectionTitle: { fontSize: TYPE.section, fontWeight: '700' },
  note: { fontSize: 13, marginTop: 6 },
  weekRow: { flexDirection: 'row', marginTop: 8 },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  recordName: { fontSize: TYPE.row, fontWeight: '500' },
  recordDate: { fontSize: TYPE.meta, marginTop: 1 },
  recordValue: { fontSize: 14.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: '500' },
  dayCell: { flex: 1, alignItems: 'center' },
  dayDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  state: { height: 300, alignItems: 'center', justifyContent: 'center' },
});

export default MonthlyReportScreen;
