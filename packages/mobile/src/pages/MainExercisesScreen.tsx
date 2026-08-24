import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from "../context/AuthProvider";
import endpoints from '../api/endpoints';
import { Surface, Text, ActivityIndicator } from 'react-native-paper';
import type { WorkoutStats } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';
import { logHandledError } from '../utils/feedback';
import ScreenHeader from '../components/ScreenHeader';

type ExerciseBreakdown = WorkoutStats['exerciseBreakdown'][number];

const MainExercisesScreen = ({ navigation }: NavigationOnlyProps) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { getToken } = useAuthContext();
  
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<ExerciseBreakdown[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const data = await endpoints.getWorkoutStats('month', token);
      if (data.success && data.exerciseBreakdown) {
        setExercises(data.exerciseBreakdown);
      }
    } catch (error) {
      logHandledError('main-exercises-stats', error);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      backgroundColor: theme.background,
      borderBottomWidth: 1, 
      borderBottomColor: theme.border,
      elevation: 0,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      padding: 16,
      paddingBottom: 40,
    },
    list: { backgroundColor: theme.surface, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, overflow: 'hidden' },
    listItem: {
      flexDirection: 'row', alignItems: 'center', padding: 16,
      borderBottomWidth: 1, borderBottomColor: theme.border,
      backgroundColor: 'transparent'
    },
    rankBadge: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary + '20',
      justifyContent: 'center', alignItems: 'center', marginRight: 16
    },
    rankText: { fontWeight: '800', color: theme.primary },
    itemInfo: { flex: 1, minWidth: 0, backgroundColor: 'transparent' },
    itemName: { fontWeight: '600', color: theme.text, marginBottom: 4 },
    itemValue: { color: theme.textMuted },
    emptyState: { alignItems: 'center', marginTop: 60, backgroundColor: 'transparent' },
    emptyText: { marginTop: 12, color: theme.textMuted }
  }), [theme]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={t('statistics.main_exercises', 'Ana egzersizler')}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
        ) : exercises.length === 0 ? (
          <Surface style={styles.emptyState} elevation={0}>
             <Ionicons name="barbell-outline" size={48} color={theme.textMuted} />
             <Text variant="bodyLarge" style={styles.emptyText}>{t('common.no_data', 'Veri bulunamadı')}</Text>
          </Surface>
        ) : (
          <Surface style={styles.list} elevation={0}>
             {exercises.map((item, index) => {
                const tKey = item.name.toLowerCase().replace(/[\s-]/g, '_').replace('pull_up', 'pullup');
                const translatedName = String(t(`statistics.ex_${tKey}`, item.name));
                return (
                <Surface key={index} style={[styles.listItem, index === exercises.length - 1 && { borderBottomWidth: 0 }]} elevation={0}>
                    <Surface style={styles.rankBadge} elevation={0}>
                        <Text variant="titleMedium" style={styles.rankText}>#{index + 1}</Text>
                    </Surface>
                    <Surface style={styles.itemInfo} elevation={0}>
                        <Text variant="titleMedium" numberOfLines={2} style={styles.itemName}>{translatedName}</Text>
                        <Text variant="bodyMedium" style={styles.itemValue}>
                          {(item.volume || 0).toLocaleString()} {t('common.kg', 'kg')} · {(item.reps || 0).toLocaleString()} {t('routines.reps', 'reps').toLowerCase()} · {item.sets || 0} {t('statistics.sets', 'sets').toLowerCase()}
                        </Text>
                    </Surface>
                </Surface>
             )})}
          </Surface>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default MainExercisesScreen;
