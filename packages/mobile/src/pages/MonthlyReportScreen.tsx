import React, { useState, useEffect } from 'react';
import { Share, View, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { BarChart } from 'react-native-chart-kit';
import Svg, { Circle, Polygon, Line, Text as SvgText } from 'react-native-svg';
import { getWorkoutStats } from '../api/endpoints';
import { useAuthContext } from '../context/AuthProvider';
import { Appbar, Text, Surface, TouchableRipple, ActivityIndicator, Divider, Chip } from 'react-native-paper';
import { useMuscleGroups } from '../hooks/useMuscleGroups';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { CARD, gridItemWidth } from '../config/layout';
import { logHandledError } from '../utils/feedback';
import type { WorkoutStats } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';

type ReportTab = 'workouts' | 'duration' | 'volume' | 'sets';

const MonthlyReportScreen = ({ navigation }: NavigationOnlyProps) => {
  const insets = useSafeAreaInsets();
  const {
    columnGap,
    contentWidth,
    horizontalPadding,
  } = useResponsiveLayout();
  // Summary tiles are small enough to sit two per row on every phone.
  const statCardWidth = gridItemWidth(contentWidth, columnGap, 2);
  const chartWidth = Math.max(1, Math.min(contentWidth, 688));
  const RADAR_SIZE = Math.max(1, Math.min(contentWidth, 420));
  const CENTER = RADAR_SIZE / 2;
  const radarLabelGutter = RADAR_SIZE < 300 ? 36 : 44;
  const RADIUS = Math.max(24, RADAR_SIZE / 2 - radarLabelGutter);
  const calendarCellSize = Math.max(
    22,
    Math.min(34, (contentWidth - 32) / 7 - 3),
  );
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const chartAccent = theme.dark ? '#60A5FA' : '#2563EB';

  const [activeTab, setActiveTab] = useState<ReportTab>('workouts');
  const [statsData, setStatsData] = useState<WorkoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuthContext();
  const { data: muscleGroupsList } = useMuscleGroups();

  const now = new Date();
  const monthName = new Intl.DateTimeFormat(i18n.resolvedLanguage || 'en', {
    month: 'long',
    year: 'numeric',
  }).format(now);

  useEffect(() => {
    const fetchMonthlyStats = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const data = await getWorkoutStats('calendar_month', token);
        if (data.success) setStatsData(data);
      } catch (err) {
        logHandledError('load-monthly-report', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMonthlyStats();
  }, [getToken]);

  const chartLabels = statsData?.stats?.labels || [];

  const getChartData = (): number[] => {
    if (!statsData?.stats) return [0, 0, 0, 0, 0, 0];
    if (activeTab === 'volume') return statsData.stats.volumes || [];
    if (activeTab === 'duration') return statsData.stats.durations || [];
    if (activeTab === 'sets') return statsData.stats.sets || [];
    return statsData.stats.workouts || [];
  };

  const slicedData = getChartData().slice(-6).map(value => Number(value) || 0);
  // react-native-chart-kit expects at least one point and matching label/data lengths.
  const safeData = slicedData.length ? slicedData : [0];
  const safeLabels = safeData.map((_, index) => chartLabels.slice(-6)[index] || '');

  // Radar chart
  const radarLabels = muscleGroupsList.map(mg => String(t(`muscle_groups.${mg.code}`, mg.name)));
  const currentRadarValues = muscleGroupsList.map(mg => statsData?.muscleDistribution?.[mg.code] ?? 0);
  const angles = radarLabels.map((_, i) => (Math.PI * 2 * i) / Math.max(radarLabels.length, 1) - Math.PI / 2);
  const getPoint = (val: number, idx: number): string => {
    const normalizedValue = Math.min(1, Math.max(Number(val) || 0, 0));
    return `${CENTER + (RADIUS * normalizedValue) * Math.cos(angles[idx])},${CENTER + (RADIUS * normalizedValue) * Math.sin(angles[idx])}`;
  };
  const currentPolygon = currentRadarValues.map((v, i) => getPoint(v, i)).join(' ');
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];
  const hasDistribution = currentRadarValues.some(value => value > 0);

  const daysOfWeek = [
    t('monthly_report.days.mon', 'Pzt'), t('monthly_report.days.tue', 'Sal'),
    t('monthly_report.days.wed', 'Çar'), t('monthly_report.days.thu', 'Per'),
    t('monthly_report.days.fri', 'Cum'), t('monthly_report.days.sat', 'Cts'),
    t('monthly_report.days.sun', 'Paz'),
  ];
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const firstDayOffset = (new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getUTCDay() + 6) % 7;
  const calendarDays: Array<number | null> = [
    ...Array(firstDayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const currentMonthPrefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-`;
  const workoutDays = new Set(
    (statsData?.workoutDates ?? [])
      .filter(date => date.startsWith(currentMonthPrefix))
      .map(date => Number(date.slice(-2)))
  );

  const tabs = [
    { id: 'workouts', label: t('monthly_report.workouts', 'Antrenmanlar') },
    { id: 'duration', label: t('monthly_report.duration', 'Süre') },
    { id: 'volume', label: t('monthly_report.volume', 'Hacim') },
    { id: 'sets', label: t('monthly_report.sets', 'Set') },
  ];

  const shareReport = async () => {
    await Share.share({
      message: t('monthly_report.share_message', {
        month: monthName,
        workouts: statsData?.totalWorkouts ?? 0,
        volume: Math.round(statsData?.totalVolume ?? 0),
        duration: Math.round(statsData?.totalDuration ?? 0),
      }),
    });
  };

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
      unit: t('common.min', 'min'),
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
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.background, elevation: 0, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content title={monthName} titleStyle={{ fontWeight: '700', fontSize: 18, color: theme.text }} />
        <Appbar.Action
          icon="share-variant"
          color={theme.text}
          onPress={shareReport}
          accessibilityLabel={t('monthly_report.share', 'Paylaş')}
        />
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
                onPress={() => setActiveTab(tab.id as ReportTab)}
                style={{ backgroundColor: isActive ? theme.primary : theme.surface, borderColor: theme.border, borderRadius: 20 }}
                textStyle={{ color: isActive ? '#FFFFFF' : theme.textMuted, fontWeight: isActive ? 'bold' : '600' }}
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
          <View style={{ paddingHorizontal: horizontalPadding, marginTop: 8, position: 'relative', overflow: 'hidden' }}>
            <BarChart
              data={{
                labels: safeLabels,
                datasets: [{ data: safeData }],
              }}
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
              {activeTab === 'volume' ? t('monthly_report.chart_unit_volume', 'kg') :
               activeTab === 'duration' ? t('monthly_report.chart_unit_duration', 'min') :
               activeTab === 'sets' ? t('monthly_report.chart_unit_sets', 'sets') :
               t('monthly_report.chart_unit_workouts', 'sessions')}
            </Text>
          </View>
        )}

        <Divider style={{ marginVertical: 24, backgroundColor: theme.surface, height: 1 }} />

        {/* Summary (Özet) */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text variant="titleMedium" style={{ color: theme.textMuted, fontWeight: '600' }}>{t('monthly_report.summary', 'Özet')}</Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: columnGap, paddingHorizontal: horizontalPadding }}>
          {statCards.map(card => (
            <Surface
              key={card.key}
              elevation={0}
              style={{ width: statCardWidth, backgroundColor: theme.surface, borderRadius: CARD.radius, paddingHorizontal: CARD.padding, paddingVertical: CARD.padding, borderWidth: 1, borderColor: theme.border, overflow: 'hidden', position: 'relative' }}
            >
                <TouchableRipple onPress={() => navigation.navigate(card.screen, { statsData })} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} borderless><View /></TouchableRipple>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text numberOfLines={2} style={{ flex: 1, minWidth: 0, paddingRight: 8, color: theme.text, fontWeight: '500' }}>{card.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                  style={{ fontSize: 19, fontWeight: 'bold', color: theme.text, marginBottom: 8 }}
                >
                    {card.value.toLocaleString()}
                    {card.unit ? <Text style={{ fontSize: 14, fontWeight: 'normal' }}>{' '}{card.unit}</Text> : null}
                </Text>
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderBottomLeftRadius: CARD.radius, borderBottomRightRadius: CARD.radius, backgroundColor: card.accentColor }} />
            </Surface>
          ))}
        </View>

        <Divider style={{ marginVertical: 24, backgroundColor: theme.surface, height: 1 }} />

        {/* Workout Days Log */}
        <Surface
          elevation={0}
          style={{
            marginHorizontal: horizontalPadding,
            padding: 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="titleMedium" style={{ color: theme.text, fontWeight: '800' }}>
                {t('monthly_report.workout_days_log', 'Antrenman Günleri Kaydı')}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 11.5, marginTop: 3 }}>
                {workoutDays.size} {t('monthly_report.active_days', 'aktif gün')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: `${theme.danger}18` }}>
              <Ionicons name="flame" size={18} color={theme.danger} />
              <Text style={{ color: theme.text, fontSize: 11.5, fontWeight: '900' }}>
                {statsData?.currentStreakDays ?? 0}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            {daysOfWeek.map((d, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', color: theme.textMuted, fontSize: 11, fontWeight: '700', paddingBottom: 6 }}>{d}</Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {calendarDays.map((num, i) => {
              const isWorkoutDay = num !== null && workoutDays.has(num);
              const isToday = num === now.getUTCDate();
              return (
                <View key={i} style={{ width: `${100 / 7}%`, height: 42, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                  {num && (
                    <View
                      style={{
                        width: calendarCellSize,
                        height: calendarCellSize,
                        borderRadius: Math.min(10, calendarCellSize * 0.3),
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: isToday && !isWorkoutDay ? 1 : 0,
                        borderColor: chartAccent,
                        backgroundColor: isWorkoutDay ? chartAccent : 'transparent',
                        shadowColor: isWorkoutDay ? chartAccent : 'transparent',
                        shadowOpacity: isWorkoutDay ? 0.22 : 0,
                        shadowRadius: 8,
                        elevation: isWorkoutDay ? 2 : 0,
                      }}
                    >
                      <Text style={{ fontSize: 14, color: isWorkoutDay ? '#FFFFFF' : theme.text, fontWeight: isWorkoutDay || isToday ? '800' : '500' }}>{num}</Text>
                      {isWorkoutDay && <View style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' }} />}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </Surface>

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
            {hasDistribution && (
              <>
                <Polygon points={currentPolygon} stroke={chartAccent} strokeWidth="3" strokeLinejoin="round" fill={`${chartAccent}28`} />
                {currentRadarValues.map((value, index) => {
                  const pointRadius = RADIUS * Math.min(
                    1,
                    Math.max(Number(value) || 0, 0),
                  );
                  return (
                    <Circle
                      key={`${radarLabels[index]}-point`}
                      cx={CENTER + pointRadius * Math.cos(angles[index])}
                      cy={CENTER + pointRadius * Math.sin(angles[index])}
                      r="3.5"
                      fill={theme.surface}
                      stroke={chartAccent}
                      strokeWidth="2.5"
                    />
                  );
                })}
              </>
            )}
            <Circle cx={CENTER} cy={CENTER} r="2.5" fill={chartAccent} />
            {radarLabels.map((label, i) => {
              const cosine = Math.cos(angles[i]);
              const x = CENTER + (RADIUS + 18) * cosine;
              const y = CENTER + (RADIUS + 18) * Math.sin(angles[i]);
              return (
                <SvgText
                  key={`label-${i}`}
                  x={x}
                  y={y + 4}
                  fontSize={RADAR_SIZE < 280 ? 8.5 : 10}
                  fontWeight="600"
                  fill={theme.textSecondary}
                  textAnchor={cosine > 0.25 ? 'end' : cosine < -0.25 ? 'start' : 'middle'}
                >
                  {label}
                </SvgText>
              );
            })}
          </Svg>

          <View style={{ flexDirection: 'row', gap: 16, marginTop: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: chartAccent }} />
              <Text style={{ fontSize: 12, color: theme.textMuted }}>{monthName}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: Math.max(insets.bottom, 16) + 8 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default MonthlyReportScreen;
