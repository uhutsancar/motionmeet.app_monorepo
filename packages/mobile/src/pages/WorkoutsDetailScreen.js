import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { BarChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

const WorkoutsDetailScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const statsData = route?.params?.statsData ?? null;
  const totalWorkouts = statsData?.totalWorkouts ?? 0;
  const labels = statsData?.stats?.labels ?? [];
  // workouts per label: approximate by counting non-zero volume days
  const volumes = statsData?.stats?.volumes ?? [];
  const workoutsPerLabel = volumes.map(v => (v > 0 ? 1 : 0));
  const avgPerSession = labels.length > 0 ? (totalWorkouts / labels.length).toFixed(1) : 0;

  const hasData = labels.length > 0;

  const chartData = {
    labels: labels.slice(-6),
    datasets: [{ data: workoutsPerLabel.slice(-6).map(v => v || 0) }],
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('monthly_report.workouts_detail', 'Antrenmanlar Detayı')}</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t('monthly_report.total', 'Toplam')}</Text>
            <Text style={styles.summaryValue}>{totalWorkouts}</Text>
            <Text style={styles.summaryUnit}>{t('monthly_report.chart_unit_workouts', 'seans')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t('monthly_report.avg_per_session', 'Seans Başına Ort.')}</Text>
            <Text style={styles.summaryValue}>{avgPerSession}</Text>
            <Text style={styles.summaryUnit}>{t('monthly_report.chart_unit_workouts', 'seans')}</Text>
          </View>
        </View>

        {/* Bar Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>{t('monthly_report.trend_title', 'Trend')}</Text>
          {!hasData ? (
            <View style={styles.noData}>
              <Ionicons name="bar-chart-outline" size={48} color={theme.textMuted} />
              <Text style={styles.noDataText}>{t('monthly_report.no_data', 'Bu dönem için veri yok')}</Text>
            </View>
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
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
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
    borderWidth: 1, borderColor: theme.border, alignItems: 'flex-start',
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

export default WorkoutsDetailScreen;
