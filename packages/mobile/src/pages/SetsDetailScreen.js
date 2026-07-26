import React from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { Surface, TouchableRipple, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { BarChart } from 'react-native-chart-kit';

const SetsDetailScreen = ({ navigation, route }) => {
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width - 32, 688);
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const statsData = route?.params?.statsData ?? null;
  const totalSets = statsData?.totalSets ?? 0;
  const labels = statsData?.stats?.labels ?? [];
  const sets = statsData?.stats?.sets ?? [];
  const totalWorkouts = statsData?.totalWorkouts ?? 0;
  const avgSets = totalWorkouts > 0
    ? Math.round(totalSets / totalWorkouts)
    : 0;
  const hasData = labels.length > 0;

  const chartData = {
    labels: labels.slice(-6),
    datasets: [{ data: sets.slice(-6).map(v => v || 0) }],
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Surface elevation={0} style={styles.header}>
        <TouchableRipple borderless style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableRipple>
        <Text style={styles.headerTitle}>{t('monthly_report.sets_detail', 'Set Detayı')}</Text>
        <Surface elevation={0} style={{ width: 34 }} />
      </Surface>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Surface elevation={0} style={styles.summaryRow}>
          <Surface elevation={0} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t('monthly_report.total', 'Toplam')}</Text>
            <Text style={styles.summaryValue}>{totalSets}</Text>
            <Text style={styles.summaryUnit}>{t('monthly_report.chart_unit_sets', 'set')}</Text>
          </Surface>
          <Surface elevation={0} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t('monthly_report.avg_per_session', 'Seans Başına Ort.')}</Text>
            <Text style={styles.summaryValue}>{avgSets}</Text>
            <Text style={styles.summaryUnit}>{t('monthly_report.chart_unit_sets', 'set')}</Text>
          </Surface>
        </Surface>

        <Surface elevation={0} style={styles.chartSection}>
          <Text style={styles.sectionTitle}>{t('monthly_report.trend_title', 'Trend')}</Text>
          {!hasData ? (
            <Surface elevation={0} style={styles.noData}>
              <Ionicons name="layers-outline" size={48} color={theme.textMuted} />
              <Text style={styles.noDataText}>{t('monthly_report.no_data', 'Bu dönem için veri yok')}</Text>
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
                color: () => '#a855f7',
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
    </SafeAreaView>
  );
};

const getStyles = (theme) => ({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  iconBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 16 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  summaryCard: {
    flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: theme.border,
  },
  summaryLabel: { fontSize: 13, color: theme.textMuted, marginBottom: 8, fontWeight: '500' },
  summaryValue: { fontSize: 28, fontWeight: 'bold', color: theme.text },
  summaryUnit: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  chartSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: theme.textMuted, marginBottom: 12, paddingHorizontal: 4 },
  chart: { borderRadius: 16, overflow: 'hidden' },
  noData: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  noDataText: { color: theme.textMuted, fontSize: 15 },
});

export default SetsDetailScreen;
