import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Button, Surface, Text, TouchableRipple } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import type { BodyMeasurement, BodyMeasurementMetric } from '@motionmeet/shared';
import { getMeasurements, deleteMeasurement } from '../api/endpoints';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { MEASUREMENT_METRICS, dayKeyToDate, formatMetricValue } from '../config/measurements';
import { CARD } from '../config/layout';
import type { NavigationOnlyProps } from '../navigation/types';

/** Newest first is how the API returns them; charts need the opposite. */
const chartPoints = (measurements: BodyMeasurement[], metric: BodyMeasurementMetric) =>
  measurements
    .filter(entry => typeof entry[metric] === 'number')
    .slice(0, 12)
    .reverse()
    .map(entry => ({ day: entry.measuredOn, value: entry[metric] as number }));

const MeasurementsScreen = ({ navigation }: NavigationOnlyProps) => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { getToken } = useAuthContext();
  const { contentWidth, horizontalPadding } = useResponsiveLayout();
  const styles = getStyles(theme);

  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeMetric, setActiveMetric] = useState<BodyMeasurementMetric>('weightKg');

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await getMeasurements(token);
      setMeasurements(Array.isArray(response?.measurements) ? response.measurements : []);
    } catch {
      // A failed refresh keeps whatever is already on screen rather than
      // blanking the history the athlete was reading.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  // Coming back from the entry screen must show the value that was just saved.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
    [i18n.language],
  );
  const shortFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'numeric' }),
    [i18n.language],
  );

  /** Latest value per metric, plus the change since the previous entry. */
  const summaries = useMemo(() => MEASUREMENT_METRICS.map(metric => {
    const logged = measurements.filter(entry => typeof entry[metric.key] === 'number');
    const latest = logged[0];
    const previous = logged[1];
    const delta = latest && previous ? (latest[metric.key] as number) - (previous[metric.key] as number) : null;
    return {
      metric,
      latestValue: latest ? (latest[metric.key] as number) : null,
      latestDay: latest?.measuredOn ?? null,
      delta,
      entryCount: logged.length,
    };
  }), [measurements]);

  const activeConfig = MEASUREMENT_METRICS.find(metric => metric.key === activeMetric) ?? MEASUREMENT_METRICS[0];
  const points = useMemo(() => chartPoints(measurements, activeMetric), [measurements, activeMetric]);
  const chartWidth = Math.max(240, Math.min(contentWidth, 688));

  const confirmDelete = useCallback((entry: BodyMeasurement) => {
    Alert.alert(
      t('measurements.delete_title', 'Delete measurement'),
      t('measurements.delete_message', 'This entry will be removed permanently.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            const token = await getToken();
            if (!token) return;
            // Optimistic: the row leaves immediately, and a failed call is
            // corrected by the reload that follows.
            setMeasurements(current => current.filter(item => item.id !== entry.id));
            try {
              await deleteMeasurement(entry.id, token);
            } finally {
              load();
            }
          },
        },
      ],
    );
  }, [getToken, load, t]);

  const openEntry = useCallback((measurement?: BodyMeasurement) => {
    navigation.navigate('MeasurementEntryScreen', measurement ? { measurement } : undefined);
  }, [navigation]);

  const hasHistory = measurements.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Surface elevation={0} style={styles.header}>
        <TouchableRipple borderless style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableRipple>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('measurements.title', 'Measurements')}
        </Text>
        <TouchableRipple
          borderless
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel={t('measurements.add', 'Add measurement')}
          onPress={() => openEntry()}
        >
          <Ionicons name="add" size={26} color={theme.primary} />
        </TouchableRipple>
      </Surface>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />}
        >
          {!hasHistory ? (
            <Surface elevation={0} style={styles.emptyCard}>
              <Ionicons name="body-outline" size={34} color={theme.primary} />
              <Text style={styles.emptyTitle}>{t('measurements.empty_title', 'No measurements yet')}</Text>
              <Text style={styles.emptyText}>
                {t('measurements.empty_text', 'Log your weight and body measurements to follow your progress over time.')}
              </Text>
              <Button mode="contained" onPress={() => openEntry()} style={styles.emptyButton} contentStyle={styles.emptyButtonContent}>
                {t('measurements.add', 'Add measurement')}
              </Button>
            </Surface>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.metricTabs}
              >
                {MEASUREMENT_METRICS.map(metric => {
                  const selected = metric.key === activeMetric;
                  return (
                    <TouchableRipple
                      key={metric.key}
                      borderless
                      onPress={() => setActiveMetric(metric.key)}
                      style={[styles.metricTab, selected && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    >
                      <Text style={[styles.metricTabLabel, selected && { color: '#FFFFFF' }]} numberOfLines={1}>
                        {t(metric.labelKey, metric.fallback)}
                      </Text>
                    </TouchableRipple>
                  );
                })}
              </ScrollView>

              <Surface elevation={0} style={styles.chartCard}>
                <Text style={styles.chartTitle}>
                  {t(activeConfig.labelKey, activeConfig.fallback)}
                  <Text style={styles.chartUnit}>{`  ${activeConfig.unit}`}</Text>
                </Text>
                {points.length >= 2 ? (
                  <LineChart
                    data={{
                      labels: points.map(point => shortFormatter.format(dayKeyToDate(point.day))),
                      datasets: [{ data: points.map(point => point.value) }],
                    }}
                    width={chartWidth}
                    height={190}
                    withInnerLines={false}
                    withOuterLines={false}
                    chartConfig={{
                      backgroundGradientFrom: theme.background,
                      backgroundGradientTo: theme.background,
                      decimalPlaces: 1,
                      color: () => activeConfig.color,
                      labelColor: () => theme.textMuted,
                      propsForDots: { r: '3.5' },
                    }}
                    bezier
                    style={styles.chart}
                  />
                ) : (
                  <Text style={styles.chartHint}>
                    {t('measurements.chart_hint', 'Log at least two entries to see the trend.')}
                  </Text>
                )}
              </Surface>

              <Text style={styles.sectionTitle}>{t('measurements.latest', 'Latest values')}</Text>
              <Surface elevation={0} style={styles.summaryCard}>
                {summaries.map((summary, index) => (
                  <TouchableRipple
                    key={summary.metric.key}
                    onPress={() => setActiveMetric(summary.metric.key)}
                    style={[styles.summaryRow, index > 0 && styles.summaryRowDivided]}
                  >
                    <>
                      <View style={[styles.summaryDot, { backgroundColor: summary.metric.color }]} />
                      <View style={styles.summaryLabelWrap}>
                        <Text style={styles.summaryLabel} numberOfLines={1}>
                          {t(summary.metric.labelKey, summary.metric.fallback)}
                        </Text>
                        <Text style={styles.summaryMeta} numberOfLines={1}>
                          {summary.latestDay
                            ? dateFormatter.format(dayKeyToDate(summary.latestDay))
                            : t('measurements.not_logged', 'Not logged')}
                        </Text>
                      </View>
                      <View style={styles.summaryValueWrap}>
                        <Text style={styles.summaryValue} numberOfLines={1}>
                          {summary.latestValue === null ? '-' : `${formatMetricValue(summary.latestValue)} ${summary.metric.unit}`}
                        </Text>
                        {summary.delta !== null && summary.delta !== 0 && (
                          <Text
                            style={[styles.summaryDelta, { color: summary.delta > 0 ? theme.success : theme.coral }]}
                            numberOfLines={1}
                          >
                            {`${summary.delta > 0 ? '+' : ''}${formatMetricValue(summary.delta)} ${summary.metric.unit}`}
                          </Text>
                        )}
                      </View>
                    </>
                  </TouchableRipple>
                ))}
              </Surface>

              <Text style={styles.sectionTitle}>{t('measurements.history', 'History')}</Text>
              {measurements.map(entry => {
                const logged = MEASUREMENT_METRICS.filter(metric => typeof entry[metric.key] === 'number');
                return (
                  <Surface key={entry.id} elevation={0} style={styles.historyCard}>
                    <View style={styles.historyHead}>
                      <Text style={styles.historyDate} numberOfLines={1}>
                        {dateFormatter.format(dayKeyToDate(entry.measuredOn))}
                      </Text>
                      <View style={styles.historyActions}>
                        <TouchableRipple
                          borderless
                          style={styles.historyAction}
                          accessibilityRole="button"
                          accessibilityLabel={t('common.edit', 'Edit')}
                          onPress={() => openEntry(entry)}
                        >
                          <Ionicons name="create-outline" size={18} color={theme.textSecondary} />
                        </TouchableRipple>
                        <TouchableRipple
                          borderless
                          style={styles.historyAction}
                          accessibilityRole="button"
                          accessibilityLabel={t('common.delete', 'Delete')}
                          onPress={() => confirmDelete(entry)}
                        >
                          <Ionicons name="trash-outline" size={18} color={theme.danger} />
                        </TouchableRipple>
                      </View>
                    </View>
                    <View style={styles.historyValues}>
                      {logged.map(metric => (
                        <View key={metric.key} style={styles.historyChip}>
                          <Text style={styles.historyChipLabel} numberOfLines={1}>
                            {t(metric.labelKey, metric.fallback)}
                          </Text>
                          <Text style={styles.historyChipValue} numberOfLines={1}>
                            {`${formatMetricValue(entry[metric.key])} ${metric.unit}`}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {!!entry.note && <Text style={styles.historyNote}>{entry.note}</Text>}
                  </Surface>
                );
              })}

              <Button
                mode="contained"
                icon="plus"
                onPress={() => openEntry()}
                style={styles.addButton}
                contentStyle={styles.addButtonContent}
              >
                {t('measurements.add', 'Add measurement')}
              </Button>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: theme.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: theme.text, fontSize: 17, fontWeight: '900' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: 12, paddingBottom: 40 },
  metricTabs: { gap: 8, paddingBottom: 12, paddingRight: 4 },
  metricTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    backgroundColor: theme.surfaceLight,
  },
  metricTabLabel: { color: theme.textSecondary, fontSize: 12, fontWeight: '800' },
  chartCard: {
    backgroundColor: theme.background,
    borderRadius: CARD.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    paddingVertical: CARD.padding,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  chartTitle: { alignSelf: 'flex-start', paddingHorizontal: 10, color: theme.text, fontSize: 14, fontWeight: '900' },
  chartUnit: { color: theme.textMuted, fontSize: 12, fontWeight: '700' },
  chart: { marginTop: 8, borderRadius: CARD.radius, marginLeft: -8 },
  chartHint: { color: theme.textMuted, fontSize: 12, paddingVertical: 26, paddingHorizontal: 14, textAlign: 'center' },
  sectionTitle: { color: theme.text, fontSize: 14, fontWeight: '900', marginTop: 18, marginBottom: 8 },
  summaryCard: { backgroundColor: theme.background, borderRadius: CARD.radius, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, overflow: 'hidden' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11 },
  summaryRowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
  summaryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  summaryLabelWrap: { flex: 1, minWidth: 0 },
  summaryLabel: { color: theme.text, fontSize: 13, fontWeight: '800' },
  summaryMeta: { color: theme.textMuted, fontSize: 10.5, marginTop: 2 },
  summaryValueWrap: { alignItems: 'flex-end', maxWidth: '42%' },
  summaryValue: { color: theme.text, fontSize: 14, fontWeight: '900' },
  summaryDelta: { fontSize: 10.5, fontWeight: '800', marginTop: 2 },
  historyCard: {
    backgroundColor: theme.background,
    borderRadius: CARD.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    padding: CARD.padding,
    marginBottom: CARD.gap,
  },
  historyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyDate: { flex: 1, minWidth: 0, color: theme.text, fontSize: 13, fontWeight: '900' },
  historyActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  historyAction: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  historyValues: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  historyChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.surfaceLight },
  historyChipLabel: { color: theme.textMuted, fontSize: 9.5, fontWeight: '700' },
  historyChipValue: { color: theme.text, fontSize: 12.5, fontWeight: '900', marginTop: 1 },
  historyNote: { color: theme.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 10 },
  emptyCard: {
    backgroundColor: theme.background,
    borderRadius: CARD.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    padding: 22,
    alignItems: 'center',
    marginTop: 24,
  },
  emptyTitle: { color: theme.text, fontSize: 15, fontWeight: '900', marginTop: 12 },
  emptyText: { color: theme.textMuted, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  emptyButton: { marginTop: 16, borderRadius: 10 },
  emptyButtonContent: { height: 44, paddingHorizontal: 14 },
  addButton: { marginTop: 6, borderRadius: 10 },
  addButtonContent: { height: 46 },
});

export default MeasurementsScreen;
