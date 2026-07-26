import React from 'react';
import { ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { BarChart } from 'react-native-chart-kit';
import { Appbar, Surface, Text, useTheme as usePaperTheme, TouchableRipple } from 'react-native-paper';

const WorkoutsDetailScreen = ({ navigation, route }) => {
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width - 32, 688);
  const { t } = useTranslation();
  const { theme } = useTheme();
  const paperTheme = usePaperTheme();
  const styles = getStyles(theme, paperTheme);

  const statsData = route?.params?.statsData ?? null;
  const totalWorkouts = statsData?.totalWorkouts ?? 0;
  const labels = statsData?.stats?.labels ?? [];
  const workoutsPerLabel = statsData?.stats?.workouts ?? [];
  const avgPerSession = labels.length > 0 ? (totalWorkouts / labels.length).toFixed(1) : 0;

  const hasData = labels.length > 0;

  const chartData = {
    labels: labels.slice(-6),
    datasets: [{ data: workoutsPerLabel.slice(-6).map(v => v || 0) }],
  };

  return (
    <Surface elevation={0} style={styles.container}>
      {/* Header */}
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content title={t('monthly_report.workouts_detail', 'Antrenmanlar Detayı')} titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Summary Cards */}
        <Surface elevation={0} style={styles.summaryRow}>
          <Surface style={styles.summaryCard} elevation={1}>
            <Text variant="labelMedium" style={styles.summaryLabel}>{t('monthly_report.total', 'Toplam')}</Text>
            <Text variant="displaySmall" style={styles.summaryValue}>{totalWorkouts}</Text>
            <Text variant="labelMedium" style={styles.summaryUnit}>{t('monthly_report.chart_unit_workouts', 'seans')}</Text>
          </Surface>
          <Surface style={styles.summaryCard} elevation={1}>
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
              fromZero
              chartConfig={{
                backgroundColor: theme.surface,
                backgroundGradientFrom: theme.surface,
                backgroundGradientTo: theme.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => theme.primary,
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

        <Surface elevation={0} style={{ height: 40 }} />
      </ScrollView>
    </Surface>
  );
};

const getStyles = (theme, paperTheme) => ({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.background,
    borderBottomWidth: 1, 
    borderBottomColor: theme.border,
    elevation: 0,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 16 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  summaryCard: {
    flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: theme.border, alignItems: 'flex-start',
  },
  summaryLabel: { color: theme.textMuted, marginBottom: 8, fontWeight: '500' },
  summaryValue: { fontWeight: 'bold', color: theme.text },
  summaryUnit: { color: theme.textMuted, marginTop: 2 },
  chartSection: { marginBottom: 24 },
  sectionTitle: { fontWeight: '600', color: theme.textMuted, marginBottom: 12, paddingHorizontal: 4 },
  chart: { borderRadius: 16, overflow: 'hidden' },
  noData: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  noDataText: { color: theme.textMuted },
});

export default WorkoutsDetailScreen;
