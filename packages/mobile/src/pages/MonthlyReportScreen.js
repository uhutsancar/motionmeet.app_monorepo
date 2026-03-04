import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { LineChart } from 'react-native-chart-kit';
import Svg, { Polygon, Line, Text as SvgText, Circle } from 'react-native-svg';
import api from '../api/client';

const { width } = Dimensions.get('window');
const RADAR_SIZE = width - 80;
const CENTER = RADAR_SIZE / 2;
const RADIUS = RADAR_SIZE / 2 - 30;

const MonthlyReportScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [activeTab, setActiveTab] = useState('workouts');
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const MONTH_NAMES_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const monthName = MONTH_NAMES_TR[now.getMonth()] + ' ' + now.getFullYear();

  useEffect(() => {
    const fetchMonthlyStats = async () => {
      try {
        const { data } = await api.get('/api/workout/stats?period=month');
        if (data.success) setStatsData(data);
      } catch (err) {
        console.error('Monthly report fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMonthlyStats();
  }, []);

  const chartLabels = statsData?.stats?.labels?.length ? statsData.stats.labels : ['', '', '', '', '', ''];
  const getChartData = () => {
    if (!statsData?.stats) return [0, 0, 0, 0, 0, 0];
    const d = activeTab === 'volume' ? statsData.stats.volumes
      : activeTab === 'duration' ? statsData.stats.durations
      : activeTab === 'sets' ? statsData.stats.reps
      : statsData.stats.volumes.map(() => 1); // workouts count placeholder
    return d.length ? d : [0];
  };

  const MUSCLE_KEYS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Abs'];
  const MUSCLE_LABELS_TR = { Chest: 'Göğüs', Back: 'Sırt', Legs: 'Bacak', Shoulders: 'Omuz', Arms: 'Kol', Abs: 'Core Bölgesi' };
  const radarLabels = MUSCLE_KEYS.map(k => MUSCLE_LABELS_TR[k]);
  const currentRadarValues = MUSCLE_KEYS.map(k => statsData?.muscleDistribution?.[k] ?? 0.02);
  const previousRadarValues = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];

  const angles = radarLabels.map((_, i) => (Math.PI * 2 * i) / radarLabels.length - Math.PI / 2);
  const getPoint = (val, idx) => `${CENTER + (RADIUS * Math.max(val, 0.02)) * Math.cos(angles[idx])},${CENTER + (RADIUS * Math.max(val, 0.02)) * Math.sin(angles[idx])}`;

  const currentPolygon = currentRadarValues.map((v, i) => getPoint(v, i)).join(' ');
  const previousPolygon = previousRadarValues.map((v, i) => getPoint(v, i)).join(' ');
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  const daysOfWeek = [
    t('monthly_report.days.mon', 'Pzt'), t('monthly_report.days.tue', 'Sal'), t('monthly_report.days.wed', 'Çar'),
    t('monthly_report.days.thu', 'Per'), t('monthly_report.days.fri', 'Cum'), t('monthly_report.days.sat', 'Cts'), t('monthly_report.days.sun', 'Paz')
  ];
  
  // Fake February 2026 calendar (starts on Sunday, but let's assume Monday start for Europe)
  // 1 is Sunday. So Pzt=, Sal=, Çar=, Per=, Cum=, Cts=, Paz=1
  const calendarDays = [null, null, null, null, null, null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];

  const tabs = [
    { id: 'workouts', label: t('monthly_report.workouts', 'Antrenmanlar') },
    { id: 'duration', label: t('monthly_report.duration', 'Süre') },
    { id: 'volume', label: t('monthly_report.volume', 'Hacim') },
    { id: 'sets', label: t('monthly_report.sets', 'Set') }
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{monthName}</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Title & Chart Area */}
        <View style={styles.titleSection}>
          <Text style={styles.largeMonthTitle}>{monthName}</Text>
          <Text style={styles.deltaSubtitle}>{statsData?.totalWorkouts ?? 0} antrenman</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.primary} size="large" style={{ marginVertical: 40 }} />
        ) : (
        <LineChart
          data={{
            labels: chartLabels.slice(-6),
            datasets: [{ data: getChartData().slice(-6).map(v => v || 0) }]
          }}
          width={width}
          height={180}
          chartConfig={{
            backgroundColor: theme.background,
            backgroundGradientFrom: theme.background,
            backgroundGradientTo: theme.background,
            color: (opacity = 1) => theme.primary,
            labelColor: (opacity = 1) => theme.textMuted,
            strokeWidth: 2,
            propsForDots: { r: "0", strokeWidth: "0" }
          }}
          bezier
          withInnerLines={true}
          withOuterLines={false}
          withVerticalLines={false}
          style={styles.chart}
        />
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContainer}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, isActive && { backgroundColor: theme.primary }]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[styles.tabText, isActive && { color: '#000', fontWeight: 'bold' }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.divider} />

        {/* Summary (Özet) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('monthly_report.summary', 'Özet')}</Text>
        </View>

        <View style={styles.statsGrid}>
           <View style={styles.statSquare}>
              <Text style={styles.statLabel}>{t('monthly_report.workouts', 'Antrenmanlar')}</Text>
              <Text style={styles.statLargeVal}>{statsData?.totalWorkouts ?? 0}</Text>
              <Text style={styles.statDiffPos}>↑ {statsData?.totalWorkouts ?? 0}</Text>
           </View>
           <View style={styles.statSquare}>
              <Text style={styles.statLabel}>{t('monthly_report.duration', 'Süre')}</Text>
              <Text style={styles.statLargeVal}>{statsData?.totalDuration ?? 0}<Text style={styles.statUnit}>min</Text></Text>
              <Text style={styles.statDiffPos}>↑ {statsData?.totalDuration ?? 0}min</Text>
           </View>
           <View style={styles.statSquare}>
              <Text style={styles.statLabel}>{t('monthly_report.volume', 'Hacim')}</Text>
              <Text style={styles.statLargeVal}>{statsData?.totalVolume ?? 0} <Text style={styles.statUnit}>kg</Text></Text>
              <Text style={styles.statDiffPos}>↑ {statsData?.totalVolume ?? 0} kg</Text>
           </View>
           <View style={styles.statSquare}>
              <Text style={styles.statLabel}>{t('monthly_report.sets', 'Set')}</Text>
              <Text style={styles.statLargeVal}>{statsData?.totalSets ?? 0}</Text>
              <Text style={styles.statDiffPos}>↑ {statsData?.totalSets ?? 0}</Text>
           </View>
        </View>

        <View style={styles.divider} />

        {/* Workout Days Log (Antrenman Günleri Kaydı) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('monthly_report.workout_days_log', 'Antrenman Günleri Kaydı')}</Text>
        </View>

        <View style={styles.streakContainer}>
          <FontAwesome5 name="fire" size={40} color="#ef4444" solid />
          <Text style={styles.streakText}>{t('monthly_report.weekly_streak', { count: 0 }, '0 Haftalık Seri')}</Text>
        </View>

        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeaderRow}>
            {daysOfWeek.map((d, i) => (
              <Text key={i} style={[styles.calDayHeader, i === 6 && { color: theme.text, fontWeight: 'bold', borderBottomWidth: 1, borderColor: theme.border }]}>{d}</Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendarDays.map((num, i) => (
              <View key={i} style={styles.calCell}>
                {num && <Text style={styles.calNum}>{num}</Text>}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Muscle Distribution */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('monthly_report.muscle_distribution', 'Kas Dağılımı')}</Text>
        </View>

        <View style={styles.radarContainer}>
          <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
            {/* Draw web grid */}
            {gridLevels.map((lvl, index) => (
              <Polygon
                key={`grid-${index}`}
                points={radarLabels.map((_, i) => getPoint(lvl, i)).join(' ')}
                stroke={theme.border}
                strokeWidth="1"
                fill="none"
              />
            ))}

            {/* Draw axis lines */}
            {radarLabels.map((_, i) => (
              <Line
                key={`axis-${i}`}
                x1={CENTER} y1={CENTER}
                x2={CENTER + RADIUS * Math.cos(angles[i])} y2={CENTER + RADIUS * Math.sin(angles[i])}
                stroke={theme.border} strokeWidth="1"
              />
            ))}

            {/* Previous target polygon */}
            <Polygon points={previousPolygon} stroke={theme.textMuted} strokeWidth="2" fill="none" />

            {/* Current value polygon */}
            <Polygon points={currentPolygon} stroke={theme.primary} strokeWidth="2" fill={theme.primary + '1A'} />

            {/* Draw texts around */}
            {radarLabels.map((label, i) => {
                const x = CENTER + (RADIUS + 20) * Math.cos(angles[i]);
                const y = CENTER + (RADIUS + 20) * Math.sin(angles[i]);
                return (
                  <SvgText key={`label-${i}`} x={x} y={y + 4} fontSize="10" fill={theme.textMuted} textAnchor="middle">
                    {label}
                  </SvgText>
                );
            })}
          </Svg>
          
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <Circle cx="4" cy="4" r="4" fill={theme.textMuted} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.textMuted }} />
              <Text style={styles.legendText}>Ocak 2026</Text>
            </View>
            <View style={styles.legendItem}>
              <Circle cx="4" cy="4" r="4" fill={theme.primary} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary }} />
              <Text style={styles.legendText}>Şubat 2026</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.shareBtn}>
          <Ionicons name="push-outline" size={20} color="#000" style={{ transform: [{ rotate: '180deg' }] }} />
          <Text style={styles.shareText}>{t('monthly_report.share', 'Paylaş')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border
  },
  iconBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  scrollContent: { paddingBottom: 40 },
  titleSection: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  largeMonthTitle: { fontSize: 24, fontWeight: 'bold', color: theme.text },
  deltaSubtitle: { fontSize: 16, color: theme.textMuted, marginTop: 4 },
  chart: { marginVertical: 10 },
  tabScroll: { marginHorizontal: 10 },
  tabContainer: { paddingHorizontal: 10, gap: 10 },
  tabBtn: { 
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, 
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border
  },
  tabText: { color: theme.textMuted, fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: theme.surface, marginVertical: 24 },
  sectionHeader: { paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 16, color: theme.textMuted, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', paddingHorizontal: 20 },
  statSquare: { 
    width: '48%', backgroundColor: theme.surface, borderRadius: 16, 
    paddingHorizontal: 16, paddingVertical: 20, borderWidth: 1, borderColor: theme.border
  },
  statLabel: { fontSize: 15, color: theme.text, fontWeight: '500', marginBottom: 12 },
  statLargeVal: { fontSize: 22, fontWeight: 'bold', color: theme.text, marginBottom: 4 },
  statUnit: { fontSize: 14, fontWeight: 'normal' },
  statDiffPos: { fontSize: 12, color: theme.textMuted, fontWeight: 'bold' },
  streakContainer: { alignItems: 'center', marginBottom: 20 },
  streakText: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginTop: 10 },
  calendarContainer: { paddingHorizontal: 20 },
  calendarHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  calDayHeader: { flex: 1, textAlign: 'center', color: theme.textMuted, fontSize: 12, paddingBottom: 6 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100/7}%`, height: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  calNum: { fontSize: 16, color: theme.text, fontWeight: '500' },
  radarContainer: { alignItems: 'center' },
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 20, marginBottom: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12, color: theme.textMuted },
  bottomBar: { 
    position: 'absolute', bottom: 0, left: 0, right: 0, 
    padding: 20, backgroundColor: theme.background, 
    borderTopWidth: 1, borderTopColor: theme.border 
  },
  shareBtn: {
    backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8
  },
  shareText: { color: '#000', fontSize: 16, fontWeight: 'bold' }
});

export default MonthlyReportScreen;
