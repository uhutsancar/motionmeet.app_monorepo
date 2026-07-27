import React, { useCallback, useState, useEffect } from 'react';
import { ScrollView, ActivityIndicator } from 'react-native';
import { Surface, TouchableRipple, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from "../context/AuthProvider";
import { getWorkoutStats } from '../api/endpoints';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { logHandledError } from '../utils/feedback';

const MuscleDistributionBodyScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { getToken } = useAuthContext();
  const {
    columns,
    columnGap,
    contentWidth,
    horizontalPadding,
  } = useResponsiveLayout();
  const gridItemWidth =
    columns === 2 ? (contentWidth - columnGap) / 2 : contentWidth;
  
  const [loading, setLoading] = useState(true);
  const [muscleData, setMuscleData] = useState([]);

  const fetchStats = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await getWorkoutStats('month', token);
      if (data.success && data.muscleDistribution) {
        const formatted = Object.entries(data.muscleDistribution)
          .map(([name, val]) => ({ name, value: Math.round(val * 100) }))
          .sort((a, b) => b.value - a.value);
        setMuscleData(formatted);
      }
    } catch (error) {
      logHandledError('load-muscle-grid', error);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const getIntensityColor = (val) => {
    if (val > 80) return '#ef4444'; // Red
    if (val > 50) return '#f97316'; // Orange
    if (val > 20) return '#eab308'; // Yellow
    return theme.textMuted;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Surface elevation={0} style={styles.header}>
        <TouchableRipple borderless style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableRipple>
        <Text style={styles.headerTitle}>{t('statistics.muscle_dist_body', 'Muscle load grid')}</Text>
        <Surface elevation={0} style={{ width: 40 }} />
      </Surface>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: horizontalPadding },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
        ) : muscleData.length === 0 ? (
          <Surface elevation={0} style={styles.emptyState}>
             <Ionicons name="body-outline" size={48} color={theme.textMuted} />
             <Text style={styles.emptyText}>{t('common.no_data', 'Veri bulunamadı')}</Text>
          </Surface>
        ) : (
          <Surface elevation={0} style={[styles.grid, { gap: columnGap }]}>
             {muscleData.map((item, index) => {
                const translatedName = t(`statistics.muscle_${item.name.toLowerCase()}`, item.name);
                return (
                <Surface elevation={0} key={index} style={[styles.gridItem, { width: gridItemWidth }]}>
                   <Surface elevation={0} style={[styles.iconBox, { backgroundColor: getIntensityColor(item.value) + '20' }]}>
                      <Ionicons name="fitness-outline" size={28} color={getIntensityColor(item.value)} />
                   </Surface>
                   <Text style={styles.itemName}>{translatedName}</Text>
                   <Text style={[styles.itemValue, { color: getIntensityColor(item.value) }]}>{item.value}{t('statistics.training_share_percent', '% share')}</Text>
                </Surface>
             )})}
          </Surface>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme) => ({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.border
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingTop: 16, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: {
    backgroundColor: theme.surface, padding: 16, borderRadius: 20,
    alignItems: 'center', borderWidth: 1, borderColor: theme.border,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3
  },
  iconBox: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  itemName: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 4, textAlign: 'center' },
  itemValue: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 12, fontSize: 15, color: theme.textMuted }
});

export default MuscleDistributionBodyScreen;
