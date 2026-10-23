import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { getWorkoutStats } from '../api/endpoints';
import { useAuthContext } from '../context/AuthProvider';
import { useMuscleGroups } from '../hooks/useMuscleGroups';
import { logHandledError } from '../utils/feedback';
import { formatDuration, formatNumber } from '../utils/format';
import ScreenHeader from '../components/ScreenHeader';
import StatStrip from '../components/charts/StatStrip';
import BarList from '../components/charts/BarList';
import RadarChart from '../components/charts/RadarChart';
import { toMuscleAxes } from '../features/stats/muscleAxes';
import NavRow from '../components/ui/NavRow';
import PillTabs from '../components/ui/PillTabs';
import type { WorkoutStats } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';

type StatsPeriod = 'week' | 'month' | 'year';

/**
 * Where the sets went: each muscle group's share of the period's sets, as a
 * sorted list. The question is "am I training everything, or the same few
 * groups?", so the biggest block is the ranking itself; the period's totals
 * sit above it as one strip of figures.
 */
const MuscleDistribution = ({ navigation }: NavigationOnlyProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const { getToken } = useAuthContext();
  const { data: muscleGroups, isLoading: musclesLoading } = useMuscleGroups();
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const periods: Array<{ key: StatsPeriod; label: string }> = [
    { key: 'week', label: t('statistics.last_7_days', 'Son 7 gün') },
    { key: 'month', label: t('statistics.last_30_days', 'Son 30 gün') },
    { key: 'year', label: t('statistics.last_year', 'Son 12 ay') },
  ];
  const previousLabels: Record<StatsPeriod, string> = {
    week: t('stats.previous_7_days', 'Önceki 7 gün'),
    month: t('stats.previous_30_days', 'Önceki 30 gün'),
    year: t('stats.previous_12_months', 'Önceki 12 ay'),
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setFailed(false);
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const data = await getWorkoutStats(period, token);
        if (active) setStats(data.success ? data : null);
      } catch (error) {
        logHandledError('load-muscle-stats', error);
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [getToken, period]);

  const groups = muscleGroups as Array<{ code: string; name: string }>;
  const axes = toMuscleAxes(groups, stats, t, language);
  const previousSets = stats?.previousMuscleSets;
  const previousTotal = previousSets ? Object.values(previousSets).reduce((sum, count) => sum + count, 0) : 0;
  const rows = groups
    .map((group) => ({
      key: group.code,
      label: String(t(`muscle_groups.${group.code}`, group.name || group.code)),
      value: stats?.muscleDistribution?.[group.code] ?? 0,
      // Last period's share of its own sets, so the tick compares like with like.
      previous: previousTotal > 0 ? (previousSets?.[group.code] ?? 0) / previousTotal : undefined,
    }))
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value)
    .map((row) => ({ ...row, display: `%${formatNumber(row.value * 100, language)}` }));
  const leader = rows[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('statistics.muscle_dist', 'Kas dağılımı')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PillTabs tabs={periods} selected={period} onSelect={setPeriod} />

        {loading || musclesLoading ? (
          <View style={styles.state}><ActivityIndicator color={theme.textMuted} /></View>
        ) : failed ? (
          <Text style={[styles.note, { color: theme.textMuted }]}>{t('stats.load_failed', 'İstatistikler yüklenemedi.')}</Text>
        ) : (
          <>
            <View style={styles.block}>
              <StatStrip
                cells={[
                  { key: 'workouts', label: t('stats.workouts', 'Antrenman'), value: formatNumber(stats?.totalWorkouts ?? 0, language) },
                  { key: 'duration', label: t('stats.duration', 'Süre'), value: formatDuration(stats?.totalDuration ?? 0, language) },
                  { key: 'volume', label: t('stats.volume', 'Hacim'), value: formatNumber(stats?.totalVolume ?? 0, language), unit: 'kg' },
                  { key: 'sets', label: t('stats.sets', 'Set'), value: formatNumber(stats?.totalSets ?? 0, language) },
                ]}
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('stats.sets_by_muscle', 'Setlerin kas gruplarına dağılımı')}</Text>
              <Text style={[styles.note, { color: theme.textMuted }]}>
                {leader
                  ? t('stats.muscle_leader', { name: leader.label, share: leader.display, defaultValue: 'En çok {{name}} çalıştı: setlerin {{share}} kadarı.' })
                  : t('stats.no_sets_period', 'Bu dönemde tamamlanmış set yok.')}
              </Text>
              {rows.length ? (
                <>
                  <View style={styles.radar}>
                    <RadarChart
                      axes={axes}
                      currentLabel={periods.find((item) => item.key === period)?.label ?? ''}
                      previousLabel={previousLabels[period]}
                      accessibilityLabel={axes.map((axis) => `${axis.label} ${axis.display}`).join(', ')}
                    />
                  </View>
                  <View style={styles.list}><BarList rows={rows} /></View>
                </>
              ) : null}
            </View>

            <View style={[styles.links, { borderTopColor: theme.border }]}>
              <NavRow
                icon="grid-outline"
                title={t('statistics.muscle_dist_body', 'Kas yükü tablosu')}
                subtitle={t('statistics.muscle_body_desc', 'Her kas grubunun antrenmandaki payı')}
                onPress={() => navigation.navigate('MuscleDistributionBodyScreen')}
                last
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 40 },
  block: { marginTop: 18 },
  section: { paddingHorizontal: 16, marginTop: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  note: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  radar: { marginTop: 14 },
  list: { marginTop: 22 },
  links: { marginTop: 32, borderTopWidth: StyleSheet.hairlineWidth },
  state: { height: 240, alignItems: 'center', justifyContent: 'center' },
});

export default MuscleDistribution;
