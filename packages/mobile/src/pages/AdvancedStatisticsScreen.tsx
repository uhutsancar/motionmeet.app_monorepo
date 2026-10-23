import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import { getWorkoutStats } from '../api/endpoints';
import { logHandledError } from '../utils/feedback';
import { capitalizeFirst, formatCompact, formatDuration, formatNumber } from '../utils/format';
import { latestActiveIndex } from '../components/charts/scale';
import dayjs from '../utils/dayjs';
import ScreenHeader from '../components/ScreenHeader';
import BarChart from '../components/charts/BarChart';
import StatStrip from '../components/charts/StatStrip';
import BarList from '../components/charts/BarList';
import PillTabs from '../components/ui/PillTabs';
import { useScrollEdge } from '../hooks/useScrollEdge';
import { TYPE } from '../config/layout';
import { toPeriodBuckets, type PeriodBucket, type StatsPeriod } from '../features/stats/periodSeries';
import type { WorkoutStats } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';

type Metric = 'volume' | 'reps' | 'duration' | 'sets';

/**
 * Volume, reps, time and sets over a week, a month or a year. One chart at a
 * time, switched by the strip of totals above it, instead of three charts in
 * three colours stacked down the page; the period's heaviest movements close
 * the screen.
 */
const AdvancedStatisticsScreen = ({ navigation }: NavigationOnlyProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const { getToken } = useAuthContext();
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const [metric, setMetric] = useState<Metric>('volume');
  const [statsData, setStatsData] = useState<WorkoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const headerEdge = useScrollEdge();

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const data = await getWorkoutStats(period, token);
      if (data.success) setStatsData(data);
      else setFailed(true);
    } catch (error) {
      logHandledError('load-advanced-stats', error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [getToken, period]);

  useEffect(() => {
    setSelected(null);
    void fetchStats();
  }, [fetchStats]);

  const buckets = toPeriodBuckets(statsData?.stats, period);
  const selectedIndex = selected ?? latestActiveIndex(buckets.map((item) => item[metric]));
  const bucket = buckets[selectedIndex];
  const totals: Record<Metric, number> = {
    volume: statsData?.totalVolume ?? 0,
    reps: buckets.reduce((sum, item) => sum + item.reps, 0),
    duration: statsData?.totalDuration ?? 0,
    sets: statsData?.totalSets ?? 0,
  };

  const labelOf = (item: PeriodBucket) =>
    period === 'year' ? dayjs(`${item.key}-01`).format('MMM') : period === 'week' ? dayjs(item.key).format('dd') : dayjs(item.key).format('D');
  const bucketTitle = (item: PeriodBucket) =>
    period === 'year' ? dayjs(`${item.key}-01`).format('MMMM YYYY') : dayjs(item.key).format('D MMMM dddd');
  const describe = (value: number): string =>
    metric === 'duration'
      ? formatDuration(value, language)
      : metric === 'volume'
        ? `${formatNumber(value, language)} kg`
        : metric === 'reps'
          ? t('stats.reps_count', { count: value, defaultValue: '{{count}} tekrar' })
          : t('monthly_report.sets_count', { count: value, defaultValue: '{{count}} set' });

  const exerciseRows = (statsData?.exerciseBreakdown ?? []).map((item) => ({
    key: item.exerciseId || item.name,
    label: capitalizeFirst(item.name, language),
    value: item.volume,
    display: `${formatNumber(item.volume, language)} kg`,
  }));

  // What one session looks like on average in this period: the question the
  // totals above cannot answer, and the one that shows a program getting
  // denser or lighter without counting how often it was done.
  const sessions = statsData?.totalWorkouts ?? 0;
  const averages = sessions
    ? [
        { key: 'duration', label: t('stats.avg_duration', 'Ortalama süre'), value: formatDuration(Math.round(totals.duration / sessions), language) },
        { key: 'volume', label: t('stats.avg_volume', 'Ortalama hacim'), value: `${formatNumber(Math.round(totals.volume / sessions), language)} kg` },
        { key: 'sets', label: t('stats.avg_sets', 'Ortalama set'), value: formatNumber(Math.round((totals.sets / sessions) * 10) / 10, language, 1) },
        { key: 'reps', label: t('stats.avg_reps', 'Ortalama tekrar'), value: formatNumber(Math.round(totals.reps / sessions), language) },
      ]
    : [];

  const periods: Array<{ key: StatsPeriod; label: string }> = [
    { key: 'week', label: t('statistics.last_7_days', 'Son 7 gün') },
    { key: 'month', label: t('statistics.last_30_days', 'Son 30 gün') },
    { key: 'year', label: t('statistics.last_year', 'Son 12 ay') },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={t('statistics.advanced', 'Gelişmiş istatistikler')}
        onBack={() => navigation.goBack()}
        scrolled={headerEdge.scrolled}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={headerEdge.onScroll}
        scrollEventThrottle={headerEdge.scrollEventThrottle}
      >
        <PillTabs tabs={periods} selected={period} onSelect={setPeriod} />

        {loading ? (
          <View style={styles.state}><ActivityIndicator color={theme.textMuted} /></View>
        ) : failed ? (
          <Pressable onPress={() => void fetchStats()} style={styles.state} accessibilityRole="button">
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>
              {t('stats.load_failed', 'İstatistikler yüklenemedi.')}{' '}
              <Text style={{ color: theme.primary, fontWeight: '600' }}>{t('common.retry', 'Tekrar dene')}</Text>
            </Text>
          </Pressable>
        ) : (
          <>
            <View style={{ marginTop: 12 }}>
              <StatStrip
                selectedKey={metric}
                onSelect={(key) => setMetric(key as Metric)}
                cells={[
                  { key: 'volume', label: t('stats.volume', 'Hacim'), value: formatNumber(totals.volume, language), unit: 'kg' },
                  { key: 'reps', label: t('stats.reps', 'Tekrar'), value: formatNumber(totals.reps, language) },
                  { key: 'duration', label: t('stats.duration', 'Süre'), value: formatDuration(totals.duration, language) },
                  { key: 'sets', label: t('stats.sets', 'Set'), value: formatNumber(totals.sets, language) },
                ]}
              />
            </View>
            <View style={styles.readout}>
              <Text style={{ color: theme.textMuted, fontSize: 12.5 }}>{bucket ? bucketTitle(bucket) : ''}</Text>
              <Text style={[styles.readoutValue, { color: theme.text }]}>{bucket ? describe(bucket[metric]) : ''}</Text>
            </View>
            <View style={styles.pad}>
              <BarChart
                variant="lollipop"
                data={buckets.map((item) => ({ key: item.key, label: labelOf(item), value: item[metric] }))}
                selectedIndex={selectedIndex}
                onSelect={setSelected}
                integer={metric === 'sets' || metric === 'reps'}
                formatTick={(value) => (metric === 'duration' ? formatNumber(value, language) : formatCompact(value, language))}
                height={180}
              />
            </View>

            {averages.length ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, styles.pad, { color: theme.text }]}>{t('stats.per_workout', 'Antrenman başına')}</Text>
                <View style={[styles.averages, { borderTopColor: theme.border }]}>
                  {averages.map((item, index) => (
                    <View
                      key={item.key}
                      style={[styles.averageRow, index < averages.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}
                    >
                      <Text style={[styles.averageLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                      <Text style={[styles.averageValue, { color: theme.text }]}>{item.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={[styles.pad, styles.section]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('stats.top_exercises', 'En çok hacim yapılan hareketler')}</Text>
              {exerciseRows.length ? (
                <View style={{ marginTop: 16 }}><BarList rows={exerciseRows} /></View>
              ) : (
                <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 6 }}>{t('stats.no_sets_period', 'Bu dönemde tamamlanmış set yok.')}</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 40 },
  pad: { paddingHorizontal: 16 },
  readout: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  readoutValue: { fontSize: 20, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },
  section: { marginTop: 28 },
  sectionTitle: { fontSize: TYPE.section, fontWeight: '700' },
  averages: { marginTop: 6, marginLeft: 16, borderTopWidth: StyleSheet.hairlineWidth },
  averageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, paddingRight: 16 },
  averageLabel: { fontSize: TYPE.body },
  averageValue: { fontSize: TYPE.body, fontWeight: '600', fontVariant: ['tabular-nums'] },
  state: { height: 300, alignItems: 'center', justifyContent: 'center' },
});

export default AdvancedStatisticsScreen;
