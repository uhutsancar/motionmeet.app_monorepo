import React, { useState, useEffect } from 'react';
import { ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Surface, TouchableRipple, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import Svg, { Polygon, Line, Text as SvgText } from 'react-native-svg';
import { getWorkoutStats } from '../api/endpoints';
import { useAuthContext } from '../context/AuthProvider';
import { useMuscleGroups } from '../hooks/useMuscleGroups';

const MuscleDistribution = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const SIZE = Math.min(width - 80, 420);
  const CENTER = SIZE / 2;
  const RADIUS = SIZE / 2 - 30;
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { data: muscleGroupsList, isLoading: isMusclesLoading } = useMuscleGroups();
  const { getToken } = useAuthContext();

  const [period, setPeriod] = useState('month');
  const [showDropdown, setShowDropdown] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const periodLabels = { week: 'Son 7 Gün', month: 'Son 30 Gün', year: 'Son 1 Yıl' };

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const data = await getWorkoutStats(period, token);
        if (data.success) {
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching muscle stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [getToken, period]);

  const MUSCLE_KEYS = muscleGroupsList.map(mg => mg.code);

  const values = MUSCLE_KEYS.map(k => stats?.muscleDistribution?.[k] ?? 0);
  const angles = MUSCLE_KEYS.map((_, i) => (Math.PI * 2 * i) / (MUSCLE_KEYS.length || 1) - Math.PI / 2);

  const getPoint = (val, idx) => {
    const r = RADIUS * Math.max(val, 0.03);
    return `${CENTER + r * Math.cos(angles[idx])},${CENTER + r * Math.sin(angles[idx])}`;
  };

  const currentPolygon = values.map((v, i) => getPoint(v, i)).join(' ');
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <Surface elevation={0} style={styles.header}>
        <TouchableRipple borderless style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableRipple>
        <Text style={styles.headerTitle}>{t('statistics.muscle_dist', 'Kas Dağılımı')}</Text>
        <Surface elevation={0} style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableRipple borderless style={styles.iconBtn}>
            <Ionicons name="help-circle-outline" size={24} color={theme.textMuted} />
          </TouchableRipple>
          <TouchableRipple borderless style={styles.iconBtn}>
            <Ionicons name="share-outline" size={24} color={theme.textMuted} />
          </TouchableRipple>
        </Surface>
      </Surface>

      <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Period dropdown */}
        <Surface elevation={0} style={{ alignSelf: 'center', marginTop: 10 }}>
          <TouchableRipple borderless style={styles.dropdownBtn} onPress={() => setShowDropdown(!showDropdown)}>
            <Text style={styles.dropdownText}>{periodLabels[period]}</Text>
            <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
          </TouchableRipple>
          {showDropdown && (
            <Surface elevation={0} style={[styles.dropdownMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {Object.entries(periodLabels).map(([key, label]) => (
                <TouchableRipple borderless
                  key={key}
                  style={[styles.dropdownItem, { borderBottomColor: theme.border }]}
                  onPress={() => { setPeriod(key); setShowDropdown(false); }}
                >
                  <Text style={{ color: period === key ? theme.primary : theme.text, fontWeight: period === key ? 'bold' : 'normal' }}>
                    {label}
                  </Text>
                </TouchableRipple>
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
              <Polygon
                points={currentPolygon}
                stroke={theme.primary}
                strokeWidth="2"
                fill={theme.primary + '25'}
              />

              {/* Labels */}
              {MUSCLE_KEYS.map((key, i) => {
                const x = CENTER + (RADIUS + 20) * Math.cos(angles[i]);
                const y = CENTER + (RADIUS + 20) * Math.sin(angles[i]);
                const mg = muscleGroupsList.find(m => m.code === key);
                return (
                  <SvgText
                    key={`label-${i}`}
                    x={x} y={y + 4}
                    fontSize="10"
                    fill={theme.textMuted}
                    textAnchor="middle"
                  >
                    {t(`muscle_groups.${key}`, mg?.name || key)}
                  </SvgText>
                );
              })}
            </Svg>
          )}

          <Surface elevation={0} style={styles.legendRow}>
            <Surface elevation={0} style={styles.legendItem}>
              <Surface elevation={0} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary }} />
              <Text style={styles.legendText}>{t('statistics.current', 'Güncel')}</Text>
            </Surface>
            <Surface elevation={0} style={styles.legendItem}>
              <Surface elevation={0} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.textMuted }} />
              <Text style={styles.legendText}>{t('statistics.previous', 'Önceki')}</Text>
            </Surface>
          </Surface>
        </Surface>

        {/* Stats Grid — dynamic */}
        <Surface elevation={0} style={styles.statsGrid}>
          <Surface elevation={0} style={styles.statSquare}>
            <Text style={styles.statLabel}>{t('statistics.workouts', 'Antrenman')}</Text>
            <Text style={styles.statLargeVal}>{stats?.totalWorkouts ?? 0}</Text>
            <Text style={styles.statDiffPos}>↑ {stats?.totalWorkouts ?? 0}</Text>
          </Surface>
          <Surface elevation={0} style={styles.statSquare}>
            <Text style={styles.statLabel}>{t('statistics.duration', 'Süre')}</Text>
            <Text style={styles.statLargeVal}>{stats?.totalDuration ?? 0}<Text style={{ fontSize: 14, fontWeight: 'normal' }}>min</Text></Text>
            <Text style={styles.statDiffPos}>↑ {stats?.totalDuration ?? 0}min</Text>
          </Surface>
          <Surface elevation={0} style={styles.statSquare}>
            <Text style={styles.statLabel}>{t('statistics.volume', 'Hacim')}</Text>
            <Text style={styles.statLargeVal}>{stats?.totalVolume ?? 0} <Text style={{ fontSize: 14, fontWeight: 'normal' }}>kg</Text></Text>
            <Text style={styles.statDiffPos}>↑ {stats?.totalVolume ?? 0} kg</Text>
          </Surface>
          <Surface elevation={0} style={styles.statSquare}>
            <Text style={styles.statLabel}>{t('statistics.sets', 'Set')}</Text>
            <Text style={styles.statLargeVal}>{stats?.totalSets ?? 0}</Text>
            <Text style={styles.statDiffPos}>↑ {stats?.totalSets ?? 0}</Text>
          </Surface>
        </Surface>

      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme) => ({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  iconBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
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
  chartContainer: { alignItems: 'center', marginTop: 30 },
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 10, marginBottom: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12, color: theme.textMuted },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  statSquare: {
    width: '48%', backgroundColor: theme.surface, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 20, borderWidth: 1, borderColor: theme.border
  },
  statLabel: { fontSize: 15, color: theme.textMuted, fontWeight: '500', marginBottom: 12 },
  statLargeVal: { fontSize: 22, fontWeight: 'bold', color: theme.text, marginBottom: 4 },
  statDiffPos: { fontSize: 12, color: '#34d399', fontWeight: 'bold' }
});

export default MuscleDistribution;
