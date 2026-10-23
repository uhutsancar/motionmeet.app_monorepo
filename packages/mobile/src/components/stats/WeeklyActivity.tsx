import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuthContext } from '../../context/AuthProvider';
import { getWorkoutStats } from '../../api/endpoints';
import { logHandledError } from '../../utils/feedback';
import dayjs from '../../utils/dayjs';
import { formatCompact, formatDuration, formatNumber } from '../../utils/format';
import { toWeekBuckets, WEEKS_SHOWN, type WeekBucket } from '../../features/stats/weeklySeries';
import { CONTROL, TYPE } from '../../config/layout';
import BarChart from '../charts/BarChart';

type Metric = 'duration' | 'volume' | 'workouts';

/**
 * Twelve weeks of training, one bar per week, the way Hevy opens a profile:
 * the selected week's figure on top, the bars, and three chips that switch
 * what the bars count. The figure and the chips replace a boxed strip of three
 * numbers that repeated on every statistics screen.
 */
const WeeklyActivity = () => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { getToken } = useAuthContext();
  const language = i18n.language;
  const [weeks, setWeeks] = useState<WeekBucket[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [metric, setMetric] = useState<Metric>('duration');
  const [selected, setSelected] = useState(WEEKS_SHOWN - 1);

  const load = useCallback(async () => {
    try {
      setFailed(false);
      const token = await getToken();
      if (!token) return;
      const data = await getWorkoutStats('weeks', token);
      setWeeks(toWeekBuckets(data.success ? data.stats : undefined));
    } catch (error) {
      logHandledError('load-weekly-activity', error);
      setFailed(true);
    }
  }, [getToken]);

  // Refetched on focus, so a workout saved a moment ago is already counted
  // when the member comes back to the profile.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const week = weeks?.[selected];
  const isCurrent = selected === WEEKS_SHOWN - 1;
  const rangeLabel = (key: string) => {
    const start = dayjs(key);
    return `${start.format('D MMM')} – ${start.add(6, 'day').format('D MMM')}`;
  };
  const figure = (item: WeekBucket | undefined): { value: string; unit?: string } => {
    if (!item) return { value: '–' };
    if (metric === 'duration') return { value: formatDuration(item.duration, language) };
    if (metric === 'volume') return { value: formatNumber(item.volume, language), unit: 'kg' };
    return { value: t('monthly_report.workouts_count', { count: item.workouts, defaultValue: '{{count}} antrenman' }) };
  };
  // Duration is charted in hours so the axis steps land on whole hours
  // (0, 1, 2, 3 sa) instead of on 100-minute marks that read as 1,7 sa.
  const chartValue = (item: WeekBucket) => (metric === 'duration' ? item.duration / 60 : item[metric]);
  const tick = (value: number) =>
    metric === 'duration' ? `${formatNumber(value, language, 1)}${language.startsWith('tr') ? ' sa' : ' h'}` : formatCompact(value, language);
  const shown = figure(week);

  const chips: Array<{ key: Metric; label: string }> = [
    { key: 'duration', label: t('stats.duration', 'Süre') },
    { key: 'volume', label: t('stats.volume', 'Hacim') },
    { key: 'workouts', label: t('stats.workouts', 'Antrenman') },
  ];

  if (failed) {
    return (
      <Pressable onPress={() => void load()} style={styles.state} accessibilityRole="button">
        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
          {t('stats.load_failed', 'İstatistikler yüklenemedi.')}{' '}
          <Text style={{ color: theme.primary, fontWeight: '600' }}>{t('common.retry', 'Tekrar dene')}</Text>
        </Text>
      </Pressable>
    );
  }
  if (!weeks) {
    return <View style={styles.state}><ActivityIndicator color={theme.textMuted} /></View>;
  }

  return (
    <View>
      <View style={styles.readout}>
        <Text style={[styles.figure, { color: theme.text }]} numberOfLines={1}>
          {shown.value}
          {shown.unit ? <Text style={[styles.unit, { color: theme.textMuted }]}> {shown.unit}</Text> : null}
          <Text style={[styles.when, { color: theme.textMuted }]}>
            {'  '}{isCurrent ? t('stats.this_week_lower', 'bu hafta') : week ? rangeLabel(week.key) : ''}
          </Text>
        </Text>
        <Text style={[styles.span, { color: theme.textMuted }]}>{t('stats.last_12_weeks', 'Son 12 hafta')}</Text>
      </View>
      <View style={styles.chart}>
        <BarChart
          data={weeks.map((item) => ({ key: item.key, label: dayjs(item.key).format('D MMM'), value: chartValue(item) }))}
          selectedIndex={selected}
          onSelect={setSelected}
          integer={metric === 'workouts'}
          formatTick={tick}
          height={150}
          accessibilityLabel={t('stats.weekly_chart_a11y', 'Son 12 haftanın haftalık grafiği')}
        />
      </View>
      <View style={styles.chips} accessibilityRole="tablist">
        {chips.map((chip) => {
          const active = chip.key === metric;
          return (
            <Pressable
              key={chip.key}
              onPress={() => setMetric(chip.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: active ? theme.primary : theme.surfaceLight, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.chipLabel, { color: active ? '#FFFFFF' : theme.text }]}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  readout: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 16, gap: 8 },
  figure: { flex: 1, minWidth: 0, fontSize: TYPE.figure, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 13, fontWeight: '500' },
  when: { fontSize: 13, fontWeight: '400' },
  span: { fontSize: TYPE.meta },
  chart: { paddingHorizontal: 16, paddingTop: 12 },
  chips: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginTop: 12 },
  chip: { height: CONTROL.height - 2, paddingHorizontal: 14, borderRadius: 15, justifyContent: 'center' },
  chipLabel: { fontSize: 13, fontWeight: '600' },
  state: { height: 220, alignItems: 'center', justifyContent: 'center' },
});

export default WeeklyActivity;
