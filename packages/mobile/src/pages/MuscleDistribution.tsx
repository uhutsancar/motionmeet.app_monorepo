import React, { useState, useEffect } from 'react';
import { ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import Svg, { Circle, Polygon, Line, Text as SvgText } from 'react-native-svg';
import { getWorkoutStats } from '../api/endpoints';
import { useAuthContext } from '../context/AuthProvider';
import { useMuscleGroups } from '../hooks/useMuscleGroups';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { logHandledError } from '../utils/feedback';
import type { WorkoutStats } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';

type StatsPeriod = 'week' | 'month' | 'year';
interface MuscleGroupOption { code: string; name: string }

const MuscleDistribution = ({ navigation }: NavigationOnlyProps) => {
  const {
    columns,
    columnGap,
    contentWidth,
    horizontalPadding,
  } = useResponsiveLayout();
  const statCardWidth =
    columns === 2 ? (contentWidth - columnGap) / 2 : contentWidth;
  const SIZE = Math.max(1, Math.min(contentWidth, 420));
  const CENTER = SIZE / 2;
  const labelGutter = SIZE < 300 ? 36 : 44;
  const RADIUS = Math.max(24, SIZE / 2 - labelGutter);
  const { t } = useTranslation();
  const { theme } = useTheme();
  const chartAccent = theme.dark ? '#60A5FA' : '#2563EB';
  const styles = getStyles(theme, chartAccent);
  const { data: rawMuscleGroups, isLoading: isMusclesLoading } = useMuscleGroups();
  const muscleGroupsList: MuscleGroupOption[] = rawMuscleGroups;
  const { getToken } = useAuthContext();

  const [period, setPeriod] = useState<StatsPeriod>('month');
  const [showDropdown, setShowDropdown] = useState(false);
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [loading, setLoading] = useState(true);

  const periodLabels: Record<StatsPeriod, string> = {
    week: t('statistics.last_7_days', 'Son 7 gün'),
    month: t('statistics.last_30_days', 'Son 30 gün'),
    year: t('statistics.last_year', 'Son 1 yıl'),
  };

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const data = await getWorkoutStats(period, token);
        if (data.success) {
          setStats(data);
        }
      } catch (error) {
        logHandledError('load-muscle-stats', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [getToken, period]);

  const MUSCLE_KEYS = muscleGroupsList.map(mg => mg.code);

  const values = MUSCLE_KEYS.map(k => stats?.muscleDistribution?.[k] ?? 0);
  const angles = MUSCLE_KEYS.map((_, i) => (Math.PI * 2 * i) / (MUSCLE_KEYS.length || 1) - Math.PI / 2);

  const getPoint = (val: number, idx: number): string => {
    const normalizedValue = Math.min(1, Math.max(Number(val) || 0, 0.03));
    const r = RADIUS * normalizedValue;
    return `${CENTER + r * Math.cos(angles[idx])},${CENTER + r * Math.sin(angles[idx])}`;
  };

  const currentPolygon = values.map((v, i) => getPoint(v, i)).join(' ');
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];
  const hasDistribution = values.some(value => value > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <Surface elevation={0} style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {t('statistics.muscle_dist', 'Kas Dağılımı')}
        </Text>
        <View style={styles.iconBtn} />
      </Surface>

      <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: horizontalPadding, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Period dropdown */}
        <Surface elevation={0} style={{ alignSelf: 'center', marginTop: 10 }}>
          <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowDropdown(!showDropdown)}>
            <Text style={styles.dropdownText}>{periodLabels[period]}</Text>
            <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
          </TouchableOpacity>
          {showDropdown && (
            <Surface elevation={0} style={[styles.dropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {Object.entries(periodLabels).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.dropdownItem, { borderBottomColor: theme.border }]}
                  onPress={() => { setPeriod(key as StatsPeriod); setShowDropdown(false); }}
                >
                  <Text style={{ color: period === key ? theme.primary : theme.text, fontWeight: period === key ? 'bold' : 'normal' }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </Surface>
          )}
        </Surface>

        {/* Radar Chart */}
        <Surface elevation={0} style={styles.chartContainer}>
          {loading || isMusclesLoading ? (
            <ActivityIndicator color={theme.primary} size="large" style={{ marginVertical: 60 }} />
          ) : (
            <Svg width={SIZE} height={SIZE}>
              {/* Grid rings */}
              {gridLevels.map((lvl, index) => (
                <Polygon
                  key={`grid-${index}`}
                  points={MUSCLE_KEYS.map((_, i) => getPoint(lvl, i)).join(' ')}
                  stroke={theme.border}
                  strokeWidth="1"
                  fill="none"
                />
              ))}

              {/* Axis lines */}
              {MUSCLE_KEYS.map((_, i) => (
                <Line
                  key={`axis-${i}`}
                  x1={CENTER} y1={CENTER}
                  x2={CENTER + RADIUS * Math.cos(angles[i])}
                  y2={CENTER + RADIUS * Math.sin(angles[i])}
                  stroke={theme.border}
                  strokeWidth="1"
                />
              ))}

              {/* Data polygon */}
              {hasDistribution && (
                <>
                  <Polygon
                    points={currentPolygon}
                    stroke={chartAccent}
                    strokeWidth="3"
                    strokeLinejoin="round"
                    fill={`${chartAccent}28`}
                  />
                  {values.map((value, index) => {
                    const pointRadius = RADIUS * Math.min(
                      1,
                      Math.max(Number(value) || 0, 0.03),
                    );
                    return (
                      <Circle
                        key={`${MUSCLE_KEYS[index]}-point`}
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

              {/* Labels */}
              {MUSCLE_KEYS.map((key, i) => {
                const cosine = Math.cos(angles[i]);
                const x = CENTER + (RADIUS + 18) * cosine;
                const y = CENTER + (RADIUS + 18) * Math.sin(angles[i]);
                const mg = muscleGroupsList.find(m => m.code === key);
                return (
                  <SvgText
                    key={`label-${i}`}
                    x={x} y={y + 4}
                    fontSize={SIZE < 280 ? 8.5 : 10}
                    fontWeight="600"
                    fill={theme.textSecondary}
                    textAnchor={cosine > 0.25 ? 'end' : cosine < -0.25 ? 'start' : 'middle'}
                  >
                    {String(t(`muscle_groups.${key}`, mg?.name || key))}
                  </SvgText>
                );
              })}
            </Svg>
          )}

          <Surface elevation={0} style={styles.legendRow}>
            <Surface elevation={0} style={styles.legendItem}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: chartAccent }} />
              <Text style={styles.legendText}>{t('statistics.current', 'Güncel')}</Text>
            </Surface>
            {!hasDistribution && (
              <Text style={styles.legendText}>{t('monthly_report.no_data', 'Bu dönem için veri yok')}</Text>
            )}
          </Surface>
        </Surface>

        {/* Stats Grid — dynamic */}
        <Surface elevation={0} style={[styles.statsGrid, { gap: columnGap }]}>
          <Surface elevation={0} style={[styles.statSquare, { width: statCardWidth }]}>
            <Text style={styles.statLabel}>{t('statistics.workouts', 'Antrenman')}</Text>
            <Text style={styles.statLargeVal}>{stats?.totalWorkouts ?? 0}</Text>
            <Text style={styles.statDiffPos}>● {t('statistics.current_period', 'Güncel dönem')}</Text>
          </Surface>
          <Surface elevation={0} style={[styles.statSquare, { width: statCardWidth }]}>
            <Text style={styles.statLabel}>{t('statistics.duration', 'Süre')}</Text>
            <Text style={styles.statLargeVal}>{stats?.totalDuration ?? 0}<Text style={{ fontSize: 14, fontWeight: 'normal' }}>min</Text></Text>
            <Text style={styles.statDiffPos}>● {t('statistics.current_period', 'Güncel dönem')}</Text>
          </Surface>
          <Surface elevation={0} style={[styles.statSquare, { width: statCardWidth }]}>
            <Text style={styles.statLabel}>{t('statistics.volume', 'Hacim')}</Text>
            <Text style={styles.statLargeVal}>{stats?.totalVolume ?? 0} <Text style={{ fontSize: 14, fontWeight: 'normal' }}>kg</Text></Text>
            <Text style={styles.statDiffPos}>● {t('statistics.current_period', 'Güncel dönem')}</Text>
          </Surface>
          <Surface elevation={0} style={[styles.statSquare, { width: statCardWidth }]}>
            <Text style={styles.statLabel}>{t('statistics.sets', 'Set')}</Text>
            <Text style={styles.statLargeVal}>{stats?.totalSets ?? 0}</Text>
            <Text style={styles.statDiffPos}>● {t('statistics.current_period', 'Güncel dönem')}</Text>
          </Surface>
        </Surface>

      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme, chartAccent: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  iconBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, minWidth: 0, paddingHorizontal: 8, textAlign: 'center', fontSize: 18, fontWeight: '700', color: theme.text },
  dropdownBtn: {
    backgroundColor: theme.surface, alignSelf: 'center', paddingHorizontal: 20,
    paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10
  },
  dropdownText: { color: theme.text, fontSize: 16, fontWeight: '600' },
  dropdownMenu: {
    position: 'absolute', top: 50, left: 0, right: 0,
    borderRadius: 12, borderWidth: 1, overflow: 'hidden', zIndex: 100,
  },
  dropdownItem: { padding: 14, borderBottomWidth: 1 },
  chartContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12, color: theme.textMuted },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statSquare: {
    backgroundColor: theme.surface, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 20, borderWidth: 1, borderColor: theme.border
  },
  statLabel: { fontSize: 15, color: theme.textMuted, fontWeight: '500', marginBottom: 12 },
  statLargeVal: { fontSize: 22, fontWeight: 'bold', color: theme.text, marginBottom: 4 },
  statDiffPos: { fontSize: 12, color: chartAccent, fontWeight: 'bold' }
});

export default MuscleDistribution;
