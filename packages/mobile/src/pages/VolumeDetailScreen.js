import React from 'react';
import { ScrollView, Dimensions } from 'react-native';
import { Surface, TouchableRipple, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { BarChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

const VolumeDetailScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const statsData = route?.params?.statsData ?? null;
  const totalVolume = statsData?.totalVolume ?? 0;
  const labels = statsData?.stats?.labels ?? [];
  const volumes = statsData?.stats?.volumes ?? [];
  const avgVolume = labels.length > 0
    ? Math.round(volumes.reduce((a, b) => a + (b || 0), 0) / labels.length)
    : 0;
  const hasData = labels.length > 0;

  const chartData = {
    labels: labels.slice(-6),
    datasets: [{ data: volumes.slice(-6).map(v => v || 0) }],
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Surface elevation={0} style={styles.header}>
        <TouchableRipple borderless style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableRipple>
        <Text style={styles.headerTitle}>{t('monthly_report.volume_detail', 'Hacim Detayı')}</Text>
        <Surface elevation={0} style={{ width: 34 }} />
      </Surface>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Surface elevation={0} style={styles.summaryRow}>
          <Surface elevation={0} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t('monthly_report.total', 'Toplam')}</Text>
            <Text style={styles.summaryValue}>{totalVolume.toLocaleString()}</Text>
            <Text style={styles.summaryUnit}>{t('monthly_report.chart_unit_volume', 'kg')}</Text>
          </Surface>
          <Surface elevation={0} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t('monthly_report.avg_per_session', 'Seans Başına Ort.')}</Text>
            <Text style={styles.summaryValue}>{avgVolume.toLocaleString()}</Text>
            <Text style={styles.summaryUnit}>{t('monthly_report.chart_unit_volume', 'kg')}</Text>
          </Surface>
        </Surface>

        <Surface elevation={0} style={styles.chartSection}>
          <Text style={styles.sectionTitle}>{t('monthly_report.trend_title', 'Trend')}</Text>
          {!hasData ? (
            <Surface elevation={0} style={styles.noData}>
              <Ionicons name="trending-up-outline" size={48} color={theme.textMuted} />
              <Text style={styles.noDataText}>{t('monthly_report.no_data', 'Bu dönem için veri yok')}</Text>
            </Surface>
          ) : (
            <BarChart
              data={chartData}
              width={width - 32}
              height={200}
              fromZero
              chartConfig={{
                backgroundColor: theme.surface,
                backgroundGradientFrom: theme.surface,
                backgroundGradientTo: theme.surface,
                decimalPlaces: 0,
                color: () => theme.primary,
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

        {/* Exercise Breakdown if available */}
        {statsData?.exerciseBreakdown?.length > 0 && (
          <Surface elevation={0} style={styles.breakdownSection}>
            <Text style={styles.sectionTitle}>{t('statistics.top_exercises', 'En İyi Egzersizler')}</Text>
            {statsData.exerciseBreakdown.slice(0, 5).map((ex, i) => (
              <Surface elevation={0} key={i} style={styles.breakdownRow}>
                <Text style={styles.breakdownRank}>#{i + 1}</Text>
                <Text style={styles.breakdownName}>{ex.name}</Text>
                <Text style={styles.breakdownValue}>{ex.total?.toLocaleString()} kg</Text>
              </Surface>
            ))}
          </Surface>
        )}

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
  content: { padding: 16 },
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
  breakdownSection: { marginBottom: 24 },
  breakdownRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border, gap: 12,
  },
  breakdownRank: { fontSize: 14, fontWeight: '700', color: theme.primary, width: 28 },
  breakdownName: { flex: 1, fontSize: 15, color: theme.text, fontWeight: '500' },
  breakdownValue: { fontSize: 14, color: theme.textMuted, fontWeight: '600' },
});

export default VolumeDetailScreen;
