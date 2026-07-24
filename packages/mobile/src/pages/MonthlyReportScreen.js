import React, { useState, useEffect } from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { BarChart } from 'react-native-chart-kit';
import Svg, { Polygon, Line, Text as SvgText } from 'react-native-svg';
import { getWorkoutStats } from '../api/endpoints';
import { useAuthContext } from '../context/AuthProvider';
import { Appbar, Text, Surface, TouchableRipple, ActivityIndicator, Divider, Chip, Button } from 'react-native-paper';
import { useMuscleGroups } from '../hooks/useMuscleGroups';

const MonthlyReportScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const chartWidth = Math.min(width - 32, 688);
  const RADAR_SIZE = Math.min(width - 80, 420);
  const CENTER = RADAR_SIZE / 2;
  const RADIUS = RADAR_SIZE / 2 - 30;
  const { t } = useTranslation();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState('workouts');
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuthContext();
  const { data: muscleGroupsList } = useMuscleGroups();

  const now = new Date();
  const MONTH_NAMES_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const monthName = MONTH_NAMES_TR[now.getMonth()] + ' ' + now.getFullYear();

  useEffect(() => {
    const fetchMonthlyStats = async () => {
      try {
        const token = await getToken();
        const data = await getWorkoutStats('month', token);
        if (data.success) setStatsData(data);
      } catch (err) {
        console.error('Monthly report fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMonthlyStats();
  }, [getToken]);

  const chartLabels = statsData?.stats?.labels?.length ? statsData.stats.labels : ['', '', '', '', '', ''];

  const getChartData = () => {
    if (!statsData?.stats) return [0, 0, 0, 0, 0, 0];
    if (activeTab === 'volume') return statsData.stats.volumes || [];
    if (activeTab === 'duration') return statsData.stats.durations || [];
    if (activeTab === 'sets') return statsData.stats.reps || [];
    // workouts: 1 for each label that has volume data, else 0
    return (statsData.stats.volumes || []).map(v => (v > 0 ? 1 : 0));
  };

  const slicedLabels = chartLabels.slice(-6);
  const slicedData = getChartData().slice(-6).map(v => v || 0);

  // Ensure at least one non-zero value for BarChart to render correctly
  const safeData = slicedData.every(v => v === 0) ? slicedData.map(() => 0) : slicedData;

  // Radar chart
  const radarLabels = muscleGroupsList.map(mg => t(`muscle_groups.${mg.code}`, mg.name));
  const currentRadarValues = muscleGroupsList.map(mg => statsData?.muscleDistribution?.[mg.code] ?? 0.02);
  const previousRadarValues = muscleGroupsList.map(() => 0.1);
  const angles = radarLabels.map((_, i) => (Math.PI * 2 * i) / Math.max(radarLabels.length, 1) - Math.PI / 2);
  const getPoint = (val, idx) =>
    `${CENTER + (RADIUS * Math.max(val, 0.02)) * Math.cos(angles[idx])},${CENTER + (RADIUS * Math.max(val, 0.02)) * Math.sin(angles[idx])}`;
  const currentPolygon = currentRadarValues.map((v, i) => getPoint(v, i)).join(' ');
  const previousPolygon = previousRadarValues.map((v, i) => getPoint(v, i)).join(' ');
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  const daysOfWeek = [
    t('monthly_report.days.mon', 'Pzt'), t('monthly_report.days.tue', 'Sal'),
    t('monthly_report.days.wed', 'Çar'), t('monthly_report.days.thu', 'Per'),
    t('monthly_report.days.fri', 'Cum'), t('monthly_report.days.sat', 'Cts'),
    t('monthly_report.days.sun', 'Paz'),
  ];
  const calendarDays = [null, null, null, null, null, null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];

  const tabs = [
    { id: 'workouts', label: t('monthly_report.workouts', 'Antrenmanlar') },
    { id: 'duration', label: t('monthly_report.duration', 'Süre') },
    { id: 'volume', label: t('monthly_report.volume', 'Hacim') },
    { id: 'sets', label: t('monthly_report.sets', 'Set') },
  ];

  // Stat card configs
  const statCards = [
    {
      key: 'workouts',
      label: t('monthly_report.workouts', 'Antrenmanlar'),
      value: statsData?.totalWorkouts ?? 0,
      unit: '',
      screen: 'WorkoutsDetailScreen',
      accentColor: theme.primary,
    },
    {
      key: 'duration',
      label: t('monthly_report.duration', 'Süre'),
      value: statsData?.totalDuration ?? 0,
      unit: 'min',
      screen: 'DurationDetailScreen',
      accentColor: '#3b82f6',
    },
    {
      key: 'volume',
      label: t('monthly_report.volume', 'Hacim'),
      value: statsData?.totalVolume ?? 0,
      unit: 'kg',
      screen: 'VolumeDetailScreen',
      accentColor: theme.primary,
    },
    {
      key: 'sets',
      label: t('monthly_report.sets', 'Set'),
      value: statsData?.totalSets ?? 0,
      unit: '',
      screen: 'SetsDetailScreen',
      accentColor: '#a855f7',
    },
  ];

  const getBarColor = () => {
    if (activeTab === 'duration') return '#3b82f6';
    if (activeTab === 'sets') return '#a855f7';
    return theme.primary;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <Appbar.Header style={{ backgroundColor: theme.background, elevation: 0, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content title={monthName} titleStyle={{ fontWeight: '700', fontSize: 18, color: theme.text }} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Title & Subtitle */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
          <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.text }}>{monthName}</Text>
          <Text variant="bodyMedium" style={{ color: theme.textMuted, marginTop: 4 }}>{statsData?.totalWorkouts ?? 0} {t('monthly_report.workouts', 'Antrenmanlar').toLowerCase()}</Text>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: 10 }} contentContainerStyle={{ paddingHorizontal: 10, gap: 10, paddingBottom: 8 }}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <Chip
                key={tab.id}
                mode="outlined"
                selected={isActive}
                onPress={() => setActiveTab(tab.id)}
                style={{ backgroundColor: isActive ? theme.primary : theme.surface, borderColor: theme.border, borderRadius: 20 }}
                textStyle={{ color: isActive ? '#000' : theme.textMuted, fontWeight: isActive ? 'bold' : '600' }}
              >
                {tab.label}
              </Chip>
            );
          })}
        </ScrollView>

        {/* Bar Chart */}
        {loading ? (
          <ActivityIndicator animating={true} color={theme.primary} size="large" style={{ marginVertical: 40 }} />
        ) : (
          <View style={{ paddingHorizontal: 16, marginTop: 8, position: 'relative' }}>
            <BarChart
              data={{
                labels: slicedLabels,
                datasets: [{ data: safeData }],
              }}
              width={chartWidth}
              height={200}
              fromZero
              chartConfig={{
                backgroundColor: theme.surface,
                backgroundGradientFrom: theme.surface,
                backgroundGradientTo: theme.surface,
                decimalPlaces: 0,
                color: () => getBarColor(),
                labelColor: () => theme.textMuted,
                barPercentage: 0.55,
                propsForBackgroundLines: { stroke: theme.border, strokeDasharray: '4' },
              }}
              style={{ borderRadius: 16, overflow: 'hidden', marginTop: 4 }}
              showValuesOnTopOfBars
              withInnerLines
            />
            {/* Y-axis label */}
            <Text style={{ position: 'absolute', top: 8, right: 24, fontSize: 11, color: theme.textMuted, fontWeight: '600' }}>
              {activeTab === 'volume' ? 'kg' :
               activeTab === 'duration' ? 'dk' :
               activeTab === 'sets' ? 'set' : 'seans'}
            </Text>
          </View>
        )}

        <Divider style={{ marginVertical: 24, backgroundColor: theme.surface, height: 1 }} />

        {/* Summary (Özet) */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text variant="titleMedium" style={{ color: theme.textMuted, fontWeight: '600' }}>{t('monthly_report.summary', 'Özet')}</Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', paddingHorizontal: 20 }}>
          {statCards.map(card => (
            <Surface
              key={card.key}
              elevation={1}
              style={{ width: '48%', backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 18, borderWidth: 1, borderColor: theme.border, overflow: 'hidden', position: 'relative' }}
            >
                <TouchableRipple onPress={() => navigation.navigate(card.screen, { statsData })} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} borderless><View /></TouchableRipple>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text variant="bodyMedium" style={{ color: theme.text, fontWeight: '500' }}>{card.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </View>
                <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.text, marginBottom: 12 }}>
                    {card.value.toLocaleString()}
                    {card.unit ? <Text style={{ fontSize: 14, fontWeight: 'normal' }}>{' '}{card.unit}</Text> : null}
                </Text>
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, backgroundColor: card.accentColor }} />
            </Surface>
          ))}
        </View>

        <Divider style={{ marginVertical: 24, backgroundColor: theme.surface, height: 1 }} />

        {/* Workout Days Log */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text variant="titleMedium" style={{ color: theme.textMuted, fontWeight: '600' }}>{t('monthly_report.workout_days_log', 'Antrenman Günleri Kaydı')}</Text>
        </View>

        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <FontAwesome5 name="fire" size={40} color="#ef4444" solid />
          <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.text, marginTop: 10 }}>{t('monthly_report.weekly_streak', { count: 0 }, '0 Haftalık Seri')}</Text>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            {daysOfWeek.map((d, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', color: theme.textMuted, fontSize: 12, paddingBottom: 6 }}>{d}</Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {calendarDays.map((num, i) => (
              <View key={i} style={{ width: `${100 / 7}%`, height: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                {num && <Text style={{ fontSize: 16, color: theme.text, fontWeight: '500' }}>{num}</Text>}
              </View>
            ))}
          </View>
        </View>

        <Divider style={{ marginVertical: 24, backgroundColor: theme.surface, height: 1 }} />

        {/* Muscle Distribution */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text variant="titleMedium" style={{ color: theme.textMuted, fontWeight: '600' }}>{t('monthly_report.muscle_distribution', 'Kas Dağılımı')}</Text>
        </View>

        <View style={{ alignItems: 'center' }}>
          <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
            {gridLevels.map((lvl, index) => (
              <Polygon
                key={`grid-${index}`}
                points={radarLabels.map((_, i) => getPoint(lvl, i)).join(' ')}
                stroke={theme.border}
                strokeWidth="1"
                fill="none"
              />
            ))}
            {radarLabels.map((_, i) => (
              <Line
                key={`axis-${i}`}
                x1={CENTER} y1={CENTER}
                x2={CENTER + RADIUS * Math.cos(angles[i])} y2={CENTER + RADIUS * Math.sin(angles[i])}
                stroke={theme.border} strokeWidth="1"
              />
            ))}
            <Polygon points={previousPolygon} stroke={theme.textMuted} strokeWidth="2" fill="none" />
            <Polygon points={currentPolygon} stroke={theme.primary} strokeWidth="2" fill={theme.primary + '22'} />
            {radarLabels.map((label, i) => {
              const x = CENTER + (RADIUS + 22) * Math.cos(angles[i]);
              const y = CENTER + (RADIUS + 22) * Math.sin(angles[i]);
              return (
                <SvgText key={`label-${i}`} x={x} y={y + 4} fontSize="10" fill={theme.textMuted} textAnchor="middle">
                  {label}
                </SvgText>
              );
            })}
          </Svg>

          <View style={{ flexDirection: 'row', gap: 16, marginTop: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.textMuted }} />
              <Text style={{ fontSize: 12, color: theme.textMuted }}>{MONTH_NAMES_TR[now.getMonth() === 0 ? 11 : now.getMonth() - 1]} {now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary }} />
              <Text style={{ fontSize: 12, color: theme.textMuted }}>{monthName}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 14), backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border }}>
        <Button mode="contained" buttonColor={theme.primary} textColor="#FFFFFF" icon="share-variant" style={{ borderRadius: 14 }} contentStyle={{ minHeight: 50 }} labelStyle={{ fontSize: 15, fontWeight: '900' }}>
            {t('monthly_report.share', 'Paylaş')}
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default MonthlyReportScreen;
