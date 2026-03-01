import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';
import { setAuthToken } from '../api/client';

const { width } = Dimensions.get('window');
const CHART_W = width - 48;
const CHART_H = 160;
const BAR_H = 110;

/* ─── Simple SVG-free Line Chart ─────────────────────────────────────────── */
const LineChart = ({ data = [], color, theme }) => {
  if (!data.length) return <View style={{ height: CHART_H, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: theme.textMuted, fontSize: 12 }}>—</Text></View>;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1 || 1)) * (CHART_W - 24),
    y: CHART_H - 20 - ((v / max) * (CHART_H - 36)),
  }));

  // Build smooth SVG-like path with Views (connect segments)
  return (
    <View style={{ height: CHART_H, position: 'relative' }}>
      {/* Segments */}
      {points.slice(1).map((pt, i) => {
        const prev = points[i];
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View key={i} style={{
            position: 'absolute',
            left: prev.x + 12,
            top: prev.y,
            width: len,
            height: 2.5,
            backgroundColor: color,
            borderRadius: 2,
            transform: [{ rotate: `${angle}deg` }],
            transformOrigin: 'left center',
          }} />
        );
      })}
      {/* Area fill (aproximation using opacity on each column) */}
      {points.map((pt, i) => (
        <View key={`area-${i}`} style={{
          position: 'absolute',
          left: pt.x + 8,
          top: pt.y + 2,
          width: (CHART_W - 24) / (data.length - 1 || 1),
          height: CHART_H - 20 - pt.y,
          backgroundColor: color,
          opacity: 0.06,
        }} />
      ))}
      {/* Dots */}
      {points.map((pt, i) => (
        <View key={`dot-${i}`} style={{
          position: 'absolute',
          left: pt.x + 12 - 5,
          top: pt.y - 5,
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: color,
          borderWidth: 2, borderColor: '#fff',
          shadowColor: color, shadowRadius: 4, shadowOpacity: 0.6, elevation: 3,
        }} />
      ))}
    </View>
  );
};

/* ─── Bar Chart ────────────────────────────────────────────────────────────── */
const BarChart = ({ labels = [], data = [], color, theme }) => {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_H + 24, gap: 4 }}>
      {data.map((val, i) => {
        const barH = Math.max(6, (val / max) * BAR_H);
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <Text style={{ color: theme.textMuted, fontSize: 9, fontWeight: 'bold' }} numberOfLines={1}>
              {val > 0 ? (val > 999 ? `${(val / 1000).toFixed(1)}k` : val) : ''}
            </Text>
            <View style={{
              width: '100%', height: barH,
              backgroundColor: color, borderRadius: 6,
              opacity: 0.75 + (i / (data.length - 1 || 1)) * 0.25,
            }} />
            <Text style={{ color: theme.textMuted, fontSize: 9 }} numberOfLines={1}>{labels[i] || ''}</Text>
          </View>
        );
      })}
    </View>
  );
};

/* ─── Stat Card ────────────────────────────────────────────────────────────── */
const StatCard = ({ icon, label, value, unit, sub, color, theme }) => (
  <View style={[statStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    <View style={[statStyles.iconBox, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <View style={statStyles.cardContent}>
      <Text style={[statStyles.label, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[statStyles.value, { color: theme.text }]}>
        {value.toLocaleString()}{' '}
        <Text style={{ fontSize: 14, color: theme.textMuted }}>{unit}</Text>
      </Text>
      {sub ? <Text style={[statStyles.sub, { color: color }]}>{sub}</Text> : null}
    </View>
  </View>
);
const statStyles = StyleSheet.create({
  card: { flex: 1, padding: 14, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardContent: { flex: 1 },
  label: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  value: { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  sub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});

/* ─── Main Page ─────────────────────────────────────────────────────────────── */
const Statistics = ({ navigation }) => {
  const { getToken } = useAuth();
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const s = getStyles(theme);

  const PERIODS = [
    { key: 'week', label: t('statistics.week', 'Hafta') },
    { key: 'month', label: t('statistics.month', 'Ay') },
    { key: 'year', label: t('statistics.year', 'Yıl') },
  ];

  const [period, setPeriod] = useState('month');
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartTab, setChartTab] = useState('volume'); // volume | duration

  const fetchStats = useCallback(async (p) => {
    setLoading(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      const { data } = await api.get(`/api/workout/stats?period=${p}`);
      if (data.success) setStatsData(data);
    } catch (e) {
      console.error('Stats fetch error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(period); }, [period]);

  const chartData = statsData?.stats;
  const lineData = chartTab === 'volume' ? chartData?.volumes : chartData?.durations;

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('statistics.title', 'İstatistikler')}</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Line Chart Card */}
        <View style={[s.card, { marginTop: 8 }]}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{t('statistics.progress', 'Aylık İlerleme')}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </View>

          {/* Chart tab: volume / duration */}
          <View style={[s.chartTabs, { backgroundColor: theme.background }]}>
            {[{ key: 'volume', label: t('statistics.volume', 'Hacim') }, { key: 'duration', label: t('statistics.duration', 'Süre') }].map(tab => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setChartTab(tab.key)}
                style={[s.chartTabBtn, chartTab === tab.key && { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}
              >
                <Text style={[s.chartTabText, { color: chartTab === tab.key ? theme.primary : theme.textMuted }]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <View style={{ height: CHART_H, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            <LineChart data={lineData || []} color={theme.primary} theme={theme} />
          )}

          {/* X-axis labels */}
          {!loading && chartData?.labels?.length > 0 && (
            <View style={{ flexDirection: 'row', paddingHorizontal: 12, marginTop: 4 }}>
              {chartData.labels.map((l, i) => (
                <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: theme.textMuted }} numberOfLines={1}>{l}</Text>
              ))}
            </View>
          )}

          {/* Period tabs */}
          <View style={[s.periodTabs, { backgroundColor: theme.background }]}>
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p.key}
                onPress={() => setPeriod(p.key)}
                style={[s.periodTab, period === p.key && { backgroundColor: theme.surfaceLight }]}
              >
                <Text style={[s.periodTabText, { color: period === p.key ? theme.text : theme.textMuted, fontWeight: period === p.key ? '700' : '500' }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stat Cards Row */}
        {!loading && statsData && (
          <View style={s.statRow}>
            <StatCard
              icon="barbell" color="#3b82f6" theme={theme}
              label={t('statistics.total_volume', 'Toplam Hacim')}
              value={statsData.totalVolume} unit="kg"
              sub={`${statsData.totalWorkouts} ${t('statistics.workouts', 'antrenman')}`}
            />
            <StatCard
              icon="flame" color="#f59e0b" theme={theme}
              label={t('statistics.calories', 'Yakılan Kalori')}
              value={statsData.totalCalories} unit="kcal"
              sub={statsData.totalDuration > 0 ? `${Math.round(statsData.totalCalories / (statsData.totalWorkouts || 1))} ${t('statistics.per_session', 'ort./seans')}` : null}
            />
          </View>
        )}

        {/* Bar Chart — Top Exercises */}
        {!loading && statsData?.exerciseBreakdown?.length > 0 && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>{t('statistics.top_exercises', 'En İyi Egzersizler')}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </View>
            <BarChart
              labels={statsData.exerciseBreakdown.map(e => e.name)}
              data={statsData.exerciseBreakdown.map(e => e.total)}
              color={theme.primary}
              theme={theme}
            />
          </View>
        )}

        {/* Best Performance */}
        {!loading && statsData && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>{t('statistics.best_performance', 'En İyi Performans')}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </View>
            <View style={{ gap: 12 }}>
              <View style={[s.perfRow, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <Text style={[s.perfLabel, { color: theme.textMuted }]}>{t('statistics.recent_record', 'Güncel Rekord')}</Text>
                <Text style={[s.perfValue, { color: theme.text }]}>{statsData.totalVolume.toLocaleString()} kg</Text>
              </View>
              <View style={s.perfRow}>
                <Text style={[s.perfLabel, { color: theme.textMuted }]}>{t('statistics.daily_avg', 'Günlük ort.')}</Text>
                <Text style={[s.perfValue, { color: theme.text }]}>
                  {statsData.totalWorkouts > 0 ? Math.round(statsData.totalDuration / statsData.totalWorkouts) : 0} {t('common.min', 'dk')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {loading && !statsData && (
          <View style={{ paddingTop: 80, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  headerTitle: { fontSize: 18, fontWeight: '800', color: theme.text },
  card: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: theme.surface, borderRadius: 22,
    padding: 20, borderWidth: 1, borderColor: theme.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
  chartTabs: {
    flexDirection: 'row', borderRadius: 12, padding: 3, marginBottom: 12, alignSelf: 'flex-start',
  },
  chartTabBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9 },
  chartTabText: { fontSize: 12, fontWeight: '600' },
  periodTabs: {
    flexDirection: 'row', borderRadius: 16, padding: 4,
    marginTop: 16, alignSelf: 'stretch',
  },
  periodTab: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  periodTabText: { fontSize: 13 },
  statRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 12 },
  perfRow: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12 },
  perfLabel: { fontSize: 13 },
  perfValue: { fontSize: 15, fontWeight: '700' },
});

export default Statistics;
