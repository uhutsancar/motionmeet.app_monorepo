import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import { BarChart } from 'react-native-chart-kit';
import { Surface, Text } from 'react-native-paper';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import ScreenHeader from '../components/ScreenHeader';
import type { BaseNavigationScreenProps, WorkoutStatsRouteParams } from '../navigation/types';

const WorkoutsDetailScreen = ({ navigation, route }: BaseNavigationScreenProps) => {
  const { columns, contentWidth, horizontalPadding } = useResponsiveLayout({
    minTwoColumnWidth: 420,
  });
  const chartWidth = Math.max(1, Math.min(contentWidth, 688));
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const routeParams = route.params as WorkoutStatsRouteParams | undefined;
  const statsData = routeParams?.statsData ?? null;
  const totalWorkouts = statsData?.totalWorkouts ?? 0;
  const labels = statsData?.stats?.labels ?? [];
  const workoutsPerLabel = statsData?.stats?.workouts ?? [];
  const avgPerSession = labels.length > 0 ? (totalWorkouts / labels.length).toFixed(1) : 0;

  const chartValues = workoutsPerLabel.slice(-6).map(value => Number(value) || 0);
  const hasData = chartValues.length > 0;

  const chartData = {
    labels: labels.slice(-chartValues.length),
    datasets: [{ data: chartValues }],
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <ScreenHeader
        title={t('monthly_report.workouts_detail', 'Antrenmanlar Detayı')}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >

        {/* Summary Cards */}
        <Surface elevation={0} style={[styles.summaryRow, columns === 1 && styles.summaryRowNarrow]}>
          <Surface style={[styles.summaryCard, columns === 1 && styles.summaryCardNarrow]} elevation={1}>
            <Text variant="labelMedium" style={styles.summaryLabel}>{t('monthly_report.total', 'Toplam')}</Text>
            <Text variant="displaySmall" style={styles.summaryValue}>{totalWorkouts}</Text>
            <Text variant="labelMedium" style={styles.summaryUnit}>{t('monthly_report.chart_unit_workouts', 'seans')}</Text>
          </Surface>
          <Surface style={[styles.summaryCard, columns === 1 && styles.summaryCardNarrow]} elevation={1}>
            <Text variant="labelMedium" style={styles.summaryLabel}>{t('monthly_report.avg_per_active_day', 'Aktif Gün Başına Ort.')}</Text>
            <Text variant="displaySmall" style={styles.summaryValue}>{avgPerSession}</Text>
            <Text variant="labelMedium" style={styles.summaryUnit}>{t('monthly_report.chart_unit_workouts', 'seans')}</Text>
          </Surface>
        </Surface>

        {/* Bar Chart */}
        <Surface elevation={0} style={styles.chartSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>{t('monthly_report.trend_title', 'Trend')}</Text>
          {!hasData ? (
            <Surface elevation={0} style={styles.noData}>
              <Ionicons name="bar-chart-outline" size={48} color={theme.textMuted} />
              <Text variant="bodyMedium" style={styles.noDataText}>{t('monthly_report.no_data', 'Bu dönem için veri yok')}</Text>
            </Surface>
          ) : (
            <BarChart
              data={chartData}
              width={chartWidth}
              height={200}
              yAxisLabel=""
              yAxisSuffix=""
              fromZero
              chartConfig={{
                backgroundColor: theme.surface,
                backgroundGradientFrom: theme.surface,
                backgroundGradientTo: theme.surface,
                decimalPlaces: 0,
                color: (_opacity = 1) => theme.primary,
                labelColor: () => theme.textMuted,
                barPercentage: 0.6,
                propsForBackgroundLines: { stroke: theme.border, strokeDasharray: '4' },
              }}
              style={styles.chart}
              showValuesOnTopOfBars
              withInnerLines
            />
          )}
        </Surface>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.background,
    borderBottomWidth: 1, 
    borderBottomColor: theme.border,
    elevation: 0,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingTop: 16, paddingBottom: 40 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  summaryRowNarrow: { flexDirection: 'column' },
  summaryCard: {
    flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, alignItems: 'flex-start',
  },
  summaryCardNarrow: { flex: 0, width: '100%' },
  summaryLabel: { color: theme.textMuted, marginBottom: 8, fontWeight: '500' },
  summaryValue: { fontWeight: 'bold', color: theme.text },
  summaryUnit: { color: theme.textMuted, marginTop: 2 },
  chartSection: { marginBottom: 24, overflow: 'hidden' },
  sectionTitle: { fontWeight: '600', color: theme.textMuted, marginBottom: 12, paddingHorizontal: 4 },
  chart: { borderRadius: 16, overflow: 'hidden' },
  noData: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  noDataText: { color: theme.textMuted },
});

export default WorkoutsDetailScreen;
