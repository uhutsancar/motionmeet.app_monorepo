import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import ScreenHeader from '../ScreenHeader';
import BarChart from '../charts/BarChart';
import StatStrip from '../charts/StatStrip';
import dayjs from '../../utils/dayjs';
import { formatCompact, formatDuration, formatNumber } from '../../utils/format';
import { toMonthDays, type MonthMetric } from '../../features/stats/monthSeries';
import type { BaseNavigationScreenProps, WorkoutStatsRouteParams } from '../../navigation/types';

interface MonthMetricDetailProps extends BaseNavigationScreenProps {
  metric: MonthMetric;
}

/**
 * One metric of the month, day by day: the total and the daily average over
 * the days that had training, the month as columns, and the same days as a
 * list underneath, so every value can be read without tapping the chart.
 * Shared by the four detail routes, which used to be four copies of one
 * screen with a different field name.
 */
const MonthMetricDetail = ({ navigation, route, metric }: MonthMetricDetailProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const statsData = (route.params as WorkoutStatsRouteParams | undefined)?.statsData ?? null;
  const days = toMonthDays(statsData?.stats);
  const [selected, setSelected] = useState(Math.max(0, days.length - 1));

  const titles: Record<MonthMetric, string> = {
    workouts: t('monthly_report.workouts', 'Antrenmanlar'),
    duration: t('monthly_report.duration', 'Süre'),
    volume: t('monthly_report.volume', 'Hacim'),
    sets: t('monthly_report.sets', 'Set'),
  };
  const format = (value: number): { value: string; unit?: string } => {
    if (metric === 'duration') return { value: formatDuration(value, language) };
    if (metric === 'volume') return { value: formatNumber(value, language), unit: 'kg' };
    return { value: formatNumber(value, language) };
  };

  const active = days.filter((day) => day.workouts > 0);
  const total = days.reduce((sum, day) => sum + day[metric], 0);
  const average = active.length ? total / active.length : 0;
  const best = active.reduce((top, day) => (day[metric] > top ? day[metric] : top), 0);
  const tick = (value: number) =>
    metric === 'duration' ? `${formatNumber(value, language)}` : formatCompact(value, language);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScreenHeader title={titles[metric]} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lead, { color: theme.textMuted }]}>
          {dayjs().format('MMMM YYYY')} · {t('monthly_report.active_days_count', { count: active.length, defaultValue: '{{count}} aktif gün' })}
        </Text>
        <StatStrip
          cells={[
            { key: 'total', label: t('monthly_report.total', 'Toplam'), ...format(total) },
            { key: 'average', label: t('monthly_report.avg_per_active_day', 'Aktif gün ort.'), ...format(Math.round(average * 10) / 10) },
            { key: 'best', label: t('monthly_report.best_day', 'En yüksek gün'), ...format(best) },
          ]}
        />
        <View style={styles.chart}>
          <BarChart
            data={days.map((day) => ({ key: day.key, label: String(day.day), value: day[metric] }))}
            selectedIndex={selected}
            onSelect={setSelected}
            integer={metric === 'workouts' || metric === 'sets'}
            formatTick={tick}
            accessibilityLabel={titles[metric]}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('monthly_report.by_day', 'Günlere göre')}</Text>
        {active.length ? (
          <View style={[styles.table, { borderTopColor: theme.border }]}>
            {[...active].reverse().map((day) => {
              const figure = format(day[metric]);
              return (
                <View key={day.key} style={[styles.row, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.rowLabel, { color: theme.text }]}>{dayjs(day.key).format('D MMMM, dddd')}</Text>
                  <Text style={[styles.rowValue, { color: theme.text }]}>
                    {figure.value}
                    {figure.unit ? <Text style={{ color: theme.textMuted }}> {figure.unit}</Text> : null}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={[styles.note, { color: theme.textMuted }]}>{t('monthly_report.no_data', 'Bu ay henüz antrenman yok.')}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 40 },
  lead: { fontSize: 13, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  chart: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', paddingHorizontal: 16, marginTop: 28, marginBottom: 6 },
  table: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 46, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  note: { fontSize: 13, paddingHorizontal: 16 },
});

export default MonthMetricDetail;
