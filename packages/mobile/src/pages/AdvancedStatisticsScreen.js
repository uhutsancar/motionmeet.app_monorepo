import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Appbar,
  Chip,
  Surface,
  Text,
} from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import { getWorkoutStats } from '../api/endpoints';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const MetricCard = ({ icon, label, value, unit, color, theme, width }) => (
  <Surface
    elevation={0}
    style={{
      width,
      minHeight: 94,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    }}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${color}18`,
        }}
      >
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <Text style={{ flex: 1, color: theme.textMuted, fontSize: 11, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      style={{ color: theme.text, fontSize: 21, fontWeight: '900', marginTop: 9 }}
    >
      {Number(value || 0).toLocaleString()}
      {unit ? <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700' }}> {unit}</Text> : null}
    </Text>
  </Surface>
);

const ChartCard = ({ icon, title, color, theme, children }) => (
  <Surface
    elevation={0}
    style={{
      paddingVertical: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      overflow: 'hidden',
    }}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 12 }}>
      <Ionicons name={icon} size={18} color={color} />
      <Text numberOfLines={1} style={{ flex: 1, color: theme.text, fontSize: 15, fontWeight: '800' }}>
        {title}
      </Text>
    </View>
    <View style={{ width: '100%', alignItems: 'center', overflow: 'hidden' }}>
      {children}
    </View>
  </Surface>
);

const AdvancedStatisticsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { getToken } = useAuthContext();
  const [period, setPeriod] = useState('month');
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const {
    columns,
    columnGap,
    contentWidth,
    horizontalPadding,
  } = useResponsiveLayout({ minTwoColumnWidth: 460 });
  const metricWidth =
    columns === 2 ? (contentWidth - columnGap) / 2 : contentWidth;

  const chartWidth = Math.max(1, Math.min(contentWidth - 2, 670));
  const blue = theme.dark ? '#60A5FA' : '#2563EB';
  const green = '#22A06B';
  const purple = '#8B5CF6';

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const token = await getToken();
      const data = await getWorkoutStats(period, token);
      if (data.success) {
        setStatsData(data);
      } else {
        setLoadFailed(true);
      }
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [getToken, period]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!active) return;
      await fetchStats();
    };
    load();
    return () => {
      active = false;
    };
  }, [fetchStats]);

  const chartData = useMemo(() => {
    const stats = statsData?.stats || {};
    const labels = stats.labels || [];
    const narrowPointLimit = period === 'year' ? 6 : 5;
    const regularPointLimit = period === 'year' ? 12 : period === 'week' ? 7 : 10;
    const pointLimit = contentWidth < 400 ? narrowPointLimit : regularPointLimit;
    const start = Math.max(0, labels.length - pointLimit);
    return {
      labels: labels.slice(start),
      volumes: (stats.volumes || []).slice(start),
      reps: (stats.reps || []).slice(start),
      durations: (stats.durations || []).slice(start),
    };
  }, [contentWidth, period, statsData]);

  const safeSeries = (values) => (
    values.length ? values.map(value => Number(value) || 0) : [0]
  );
  const safeLabels = chartData.labels.length ? chartData.labels : [''];
  const totalReps = (statsData?.stats?.reps || []).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const hasData = (statsData?.totalWorkouts || 0) > 0;
  const muscleData = Object.entries(statsData?.muscleDistribution || {})
    .map(([name, value]) => ({
      name,
      value: Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 100))),
    }))
    .sort((a, b) => b.value - a.value);

  const chartConfig = (color) => ({
    backgroundGradientFrom: theme.surface,
    backgroundGradientTo: theme.surface,
    decimalPlaces: 0,
    color: () => color,
    labelColor: () => theme.textMuted,
    propsForBackgroundLines: {
      stroke: theme.border,
      strokeDasharray: '4',
    },
    propsForDots: {
      r: '3',
      strokeWidth: '2',
      stroke: color,
    },
    barPercentage: 0.55,
  });

  const periods = [
    { value: 'week', label: t('statistics.week', 'Week') },
    { value: 'month', label: t('statistics.month', 'Month') },
    { value: 'year', label: t('statistics.year', 'Year') },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <Appbar.Header
        statusBarHeight={0}
        style={{
          backgroundColor: theme.background,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          elevation: 0,
        }}
      >
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content
          title={t('statistics.advanced', 'Advanced statistics')}
          titleStyle={{ color: theme.text, fontSize: 18, fontWeight: '800' }}
        />
      </Appbar.Header>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          paddingHorizontal: horizontalPadding,
          paddingTop: 16,
          paddingBottom: 36,
          gap: 14,
        }}
      >
        <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>
          {t('statistics.advanced_desc', 'Volume, set, repetition and duration details.')}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {periods.map(item => {
            const selected = period === item.value;
            return (
              <Chip
                key={item.value}
                selected={selected}
                onPress={() => setPeriod(item.value)}
                mode="outlined"
                style={{
                  flex: 1,
                  borderColor: selected ? blue : theme.border,
                  backgroundColor: selected ? blue : theme.surface,
                }}
                textStyle={{ color: selected ? '#FFFFFF' : theme.textSecondary, fontWeight: '800' }}
              >
                {item.label}
              </Chip>
            );
          })}
        </View>

        {loading ? (
          <View style={{ minHeight: 320, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={blue} />
          </View>
        ) : loadFailed ? (
          <Surface
            elevation={0}
            style={{
              minHeight: 220,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.surface,
            }}
          >
            <Ionicons name="cloud-offline-outline" size={38} color={theme.textMuted} />
            <Text style={{ color: theme.text, fontWeight: '800', marginTop: 12 }}>
              {t('statistics.load_failed', 'Statistics could not be loaded.')}
            </Text>
            <Chip mode="outlined" onPress={fetchStats} style={{ marginTop: 14 }}>
              {t('common.retry', 'Retry')}
            </Chip>
          </Surface>
        ) : !hasData ? (
          <Surface
            elevation={0}
            style={{
              minHeight: 220,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.surface,
            }}
          >
            <Ionicons name="analytics-outline" size={40} color={theme.textMuted} />
            <Text style={{ color: theme.text, fontWeight: '800', marginTop: 12 }}>
              {t('common.no_data', 'No data yet')}
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center', marginTop: 5 }}>
              {t('statistics.log_more_workouts', 'Complete workouts to see your statistics here.')}
            </Text>
          </Surface>
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: columnGap }}>
              <MetricCard
                icon="trending-up-outline"
                label={t('statistics.volume', 'Volume')}
                value={statsData?.totalVolume}
                unit={t('common.kg', 'kg')}
                color={blue}
                theme={theme}
                width={metricWidth}
              />
              <MetricCard
                icon="repeat-outline"
                label={t('profile.reps', 'Repetitions')}
                value={totalReps}
                unit={t('routines.reps', 'reps').toLowerCase()}
                color={green}
                theme={theme}
                width={metricWidth}
              />
              <MetricCard
                icon="time-outline"
                label={t('statistics.duration', 'Duration')}
                value={statsData?.totalDuration}
                unit={t('common.min', 'min')}
                color="#3284FF"
                theme={theme}
                width={metricWidth}
              />
              <MetricCard
                icon="layers-outline"
                label={t('statistics.sets', 'Sets')}
                value={statsData?.totalSets}
                unit=""
                color={purple}
                theme={theme}
                width={metricWidth}
              />
            </View>

            <ChartCard
              icon="trending-up-outline"
              title={t('statistics.volume', 'Volume')}
              color={blue}
              theme={theme}
            >
              <LineChart
                data={{ labels: safeLabels, datasets: [{ data: safeSeries(chartData.volumes) }] }}
                width={chartWidth}
                height={220}
                fromZero
                bezier
                withShadow={false}
                chartConfig={chartConfig(blue)}
                style={{ borderRadius: 14 }}
              />
            </ChartCard>

            <ChartCard
              icon="repeat-outline"
              title={t('profile.reps', 'Repetitions')}
              color={green}
              theme={theme}
            >
              <BarChart
                data={{ labels: safeLabels, datasets: [{ data: safeSeries(chartData.reps) }] }}
                width={chartWidth}
                height={210}
                fromZero
                showValuesOnTopOfBars
                chartConfig={chartConfig(green)}
                style={{ borderRadius: 14 }}
              />
            </ChartCard>

            <ChartCard
              icon="time-outline"
              title={t('statistics.duration', 'Duration')}
              color="#3284FF"
              theme={theme}
            >
              <LineChart
                data={{ labels: safeLabels, datasets: [{ data: safeSeries(chartData.durations) }] }}
                width={chartWidth}
                height={210}
                fromZero
                withShadow={false}
                chartConfig={chartConfig('#3284FF')}
                style={{ borderRadius: 14 }}
              />
            </ChartCard>

            <Surface
              elevation={0}
              style={{
                padding: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surface,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Ionicons name="body-outline" size={18} color={purple} />
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}>
                  {t('statistics.muscle_dist', 'Muscle distribution')}
                </Text>
              </View>
              {muscleData.map(item => (
                <View key={item.name} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <Text numberOfLines={2} style={{ flex: 1, minWidth: 0, color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
                      {t(`muscle_groups.${item.name}`, item.name)}
                    </Text>
                    <Text style={{ flexShrink: 0, color: blue, fontSize: 12, fontWeight: '900' }}>{item.value}%</Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: theme.surfaceLight }}>
                    <View
                      style={{
                        width: `${item.value}%`,
                        height: '100%',
                        borderRadius: 4,
                        backgroundColor: blue,
                      }}
                    />
                  </View>
                </View>
              ))}
            </Surface>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AdvancedStatisticsScreen;
