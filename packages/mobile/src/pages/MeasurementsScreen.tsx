import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import type { BodyMeasurement, BodyMeasurementMetric } from '@motionmeet/shared';
import { getMeasurements, deleteMeasurement } from '../api/endpoints';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { MEASUREMENT_METRICS, dayKeyToDate } from '../config/measurements';
import { formatNumber } from '../utils/format';
import ScreenHeader from '../components/ScreenHeader';
import LineChart from '../components/charts/LineChart';
import type { NavigationOnlyProps } from '../navigation/types';

/** Newest first is how the API returns them; charts need the opposite. */
const chartPoints = (measurements: BodyMeasurement[], metric: BodyMeasurementMetric) =>
  measurements
    .filter(entry => typeof entry[metric] === 'number')
    .slice(0, 12)
    .reverse()
    .map(entry => ({ day: entry.measuredOn, value: entry[metric] as number }));

/**
 * Body measurements over time. One metric at a time as a line in the app's
 * one hue - not a colour per metric - with the latest value of every metric
 * listed beside its change since the entry before. A change is shown with
 * its sign in grey: whether a kilo up is good news depends on the person.
 */
const MeasurementsScreen = ({ navigation }: NavigationOnlyProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const { getToken } = useAuthContext();

  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeMetric, setActiveMetric] = useState<BodyMeasurementMetric>('weightKg');
  const [selected, setSelected] = useState<number | null>(null);

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
    () => new Intl.DateTimeFormat(language.startsWith('tr') ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
    [language],
  );
  const shortFormatter = useMemo(
    () => new Intl.DateTimeFormat(language.startsWith('tr') ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' }),
    [language],
  );
  const value = (amount: number, unit: string) =>
    unit === '%' ? `%${formatNumber(amount, language, 1)}` : `${formatNumber(amount, language, 1)} ${unit}`;

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
    };
  }), [measurements]);

  const activeConfig = MEASUREMENT_METRICS.find(metric => metric.key === activeMetric) ?? MEASUREMENT_METRICS[0];
  const points = useMemo(() => chartPoints(measurements, activeMetric), [measurements, activeMetric]);
  const selectedIndex = selected === null ? points.length - 1 : Math.min(selected, points.length - 1);
  const selectedPoint = points[selectedIndex];

  const chooseMetric = (metric: BodyMeasurementMetric) => {
    setActiveMetric(metric);
    setSelected(null);
  };

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={t('measurements.title', 'Ölçümler')}
        onBack={() => navigation.goBack()}
        actions={[{ icon: 'add', onPress: () => openEntry(), accessibilityLabel: t('measurements.add', 'Ölçüm ekle') }]}
      />

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={theme.textMuted} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />}
        >
          {measurements.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('measurements.empty_title', 'Henüz ölçüm yok')}</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                {t('measurements.empty_text', 'Kilonu ve vücut ölçülerini kaydet, değişimi zaman içinde takip et.')}
              </Text>
              <Button mode="contained" onPress={() => openEntry()} style={styles.emptyButton} contentStyle={{ height: 46 }}>
                {t('measurements.add', 'Ölçüm ekle')}
              </Button>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
                {MEASUREMENT_METRICS.map(metric => {
                  const isActive = metric.key === activeMetric;
                  return (
                    <Pressable
                      key={metric.key}
                      onPress={() => chooseMetric(metric.key)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isActive }}
                      style={[styles.tab, { backgroundColor: isActive ? theme.surfaceLight : 'transparent' }]}
                    >
                      <Text style={{ color: isActive ? theme.text : theme.textMuted, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>
                        {t(metric.labelKey, metric.fallback)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.readout}>
                <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                  {selectedPoint ? dateFormatter.format(dayKeyToDate(selectedPoint.day)) : t(activeConfig.labelKey, activeConfig.fallback)}
                </Text>
                <Text style={[styles.readoutValue, { color: theme.text }]}>
                  {selectedPoint ? value(selectedPoint.value, activeConfig.unit) : t('measurements.not_logged', 'Kaydedilmedi')}
                </Text>
              </View>
              {points.length >= 2 ? (
                <View style={styles.pad}>
                  <LineChart
                    data={points.map(point => ({ key: point.day, label: shortFormatter.format(dayKeyToDate(point.day)), value: point.value }))}
                    selectedIndex={selectedIndex}
                    onSelect={setSelected}
                    zeroBased={false}
                    formatTick={(tick) => formatNumber(tick, language, 1)}
                    accessibilityLabel={t(activeConfig.labelKey, activeConfig.fallback)}
                  />
                </View>
              ) : (
                <Text style={[styles.hint, { color: theme.textMuted }]}>
                  {t('measurements.chart_hint', 'Grafiği görmek için en az iki kayıt gir.')}
                </Text>
              )}

              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('measurements.latest', 'Son değerler')}</Text>
              <View style={[styles.table, { borderTopColor: theme.border }]}>
                {summaries.map(summary => (
                  <Pressable
                    key={summary.metric.key}
                    onPress={() => chooseMetric(summary.metric.key)}
                    style={({ pressed }) => [styles.row, { borderBottomColor: theme.border }, pressed && { backgroundColor: theme.surfaceLight }]}
                  >
                    <View style={styles.rowLabel}>
                      <Text style={{ color: theme.text, fontSize: 14.5, fontWeight: summary.metric.key === activeMetric ? '700' : '500' }} numberOfLines={1}>
                        {t(summary.metric.labelKey, summary.metric.fallback)}
                      </Text>
                      <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                        {summary.latestDay ? dateFormatter.format(dayKeyToDate(summary.latestDay)) : t('measurements.not_logged', 'Kaydedilmedi')}
                      </Text>
                    </View>
                    <View style={styles.rowValue}>
                      <Text style={[styles.figure, { color: summary.latestValue === null ? theme.textMuted : theme.text }]}>
                        {summary.latestValue === null ? '–' : value(summary.latestValue, summary.metric.unit)}
                      </Text>
                      {summary.delta !== null && summary.delta !== 0 ? (
                        <Text style={[styles.delta, { color: theme.textMuted }]}>
                          {`${summary.delta > 0 ? '+' : '−'}${formatNumber(Math.abs(summary.delta), language, 1)}`}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('measurements.history', 'Geçmiş')}</Text>
              <View style={[styles.table, { borderTopColor: theme.border }]}>
                {measurements.map(entry => {
                  const logged = MEASUREMENT_METRICS.filter(metric => typeof entry[metric.key] === 'number');
                  return (
                    <View key={entry.id} style={[styles.historyRow, { borderBottomColor: theme.border }]}>
                      <View style={styles.rowLabel}>
                        <Text style={{ color: theme.text, fontSize: 14.5, fontWeight: '600' }}>{dateFormatter.format(dayKeyToDate(entry.measuredOn))}</Text>
                        <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 3 }}>
                          {logged.map(metric => `${t(metric.labelKey, metric.fallback)} ${value(entry[metric.key] as number, metric.unit)}`).join(' · ')}
                        </Text>
                        {!!entry.note && <Text style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 4 }}>{entry.note}</Text>}
                      </View>
                      <Pressable onPress={() => openEntry(entry)} hitSlop={6} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={t('common.edit', 'Düzenle')}>
                        <Ionicons name="create-outline" size={19} color={theme.textMuted} />
                      </Pressable>
                      <Pressable onPress={() => confirmDelete(entry)} hitSlop={6} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={t('common.delete', 'Sil')}>
                        <Ionicons name="trash-outline" size={19} color={theme.textMuted} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 40 },
  pad: { paddingHorizontal: 16 },
  tabs: { gap: 6, paddingHorizontal: 16, paddingTop: 8 },
  tab: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center' },
  readout: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10 },
  readoutValue: { fontSize: 20, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', paddingHorizontal: 16, marginTop: 28, marginBottom: 6 },
  table: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { flex: 1, minWidth: 0, paddingVertical: 10 },
  rowValue: { alignItems: 'flex-end', marginLeft: 12 },
  figure: { fontSize: 14.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  delta: { fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 16, paddingRight: 6, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingHorizontal: 16, paddingTop: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  emptyButton: { marginTop: 18, alignSelf: 'flex-start', borderRadius: 10 },
});

export default MeasurementsScreen;
