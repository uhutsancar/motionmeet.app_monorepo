import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from "../context/AuthProvider";
import endpoints from '../api/endpoints';
import { Appbar, Surface, Text, ActivityIndicator, useTheme as usePaperTheme } from 'react-native-paper';

const AdvancedStatisticsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const paperTheme = usePaperTheme();
  const { getToken } = useAuthContext();
  
  const [loading, setLoading] = useState(true);
  const [muscleData, setMuscleData] = useState([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = await getToken();
      const data = await endpoints.getWorkoutStats('month', token);
      if (data.success && data.muscleDistribution) {
        const formatted = Object.entries(data.muscleDistribution)
          .map(([name, val]) => ({ name, value: Math.round(val * 100) }))
          .sort((a, b) => b.value - a.value);
        setMuscleData(formatted);
      }
    } catch (error) {
      console.log('Error fetching advanced stats', error);
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => ({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      backgroundColor: theme.background,
      borderBottomWidth: 1, 
      borderBottomColor: theme.border,
      elevation: 0,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
    content: { padding: 16 },
    card: {
      backgroundColor: theme.surface, borderRadius: 16, padding: 20,
      borderWidth: 1, borderColor: theme.border,
    },
    row: { marginBottom: 20, backgroundColor: 'transparent' },
    rowInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, backgroundColor: 'transparent' },
    muscleName: { fontWeight: '700', color: theme.text },
    muscleValue: { fontWeight: '800', color: theme.primary },
    barBackground: { height: 10, backgroundColor: theme.surfaceLight, borderRadius: 5, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 5 },
    emptyState: { alignItems: 'center', marginTop: 60, backgroundColor: 'transparent' },
    emptyText: { marginTop: 12, color: theme.textMuted }
  }), [theme]);

  return (
    <Surface style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content title={t('statistics.sets_per_muscle', 'Kas grubu başına set')} titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
        ) : muscleData.length === 0 ? (
          <Surface style={styles.emptyState} elevation={0}>
             <Ionicons name="bar-chart-outline" size={48} color={theme.textMuted} />
             <Text variant="bodyLarge" style={styles.emptyText}>{t('common.no_data', 'Veri bulunamadı')}</Text>
          </Surface>
        ) : (
          <Surface style={styles.card} elevation={2}>
            {muscleData.map((item, index) => {
              const translatedName = t(`statistics.muscle_${item.name.toLowerCase()}`, item.name);
              return (
              <Surface key={index} style={styles.row} elevation={0}>
                <Surface style={styles.rowInfo} elevation={0}>
                  <Text variant="titleMedium" style={styles.muscleName}>{translatedName}</Text>
                  <Text variant="titleMedium" style={styles.muscleValue}>{item.value}%</Text>
                </Surface>
                <Surface style={styles.barBackground} elevation={0}>
                  <Surface style={[styles.barFill, { width: `${item.value}%`, backgroundColor: theme.primary }]} elevation={0} />
                </Surface>
              </Surface>
            )})}
          </Surface>
        )}
      </ScrollView>
    </Surface>
  );
};

export default AdvancedStatisticsScreen;
