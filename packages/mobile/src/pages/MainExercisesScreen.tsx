import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
// expo-image, like every other exercise thumbnail in the app: it recycles views
// and keeps a memory + disk cache where React Native's Image does not.
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import endpoints from '../api/endpoints';
import { EXERCISE_THUMB, exerciseThumbStyle } from '../config/layout';
import { API_URL } from '../config/environment';
import { mediaVariantUrl, resolvePublicMediaUrl, type WorkoutStats } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';
import { logHandledError } from '../utils/feedback';
import { capitalizeFirst, formatNumber } from '../utils/format';
import ScreenHeader from '../components/ScreenHeader';
import PillTabs from '../components/ui/PillTabs';

type ExerciseBreakdown = WorkoutStats['exerciseBreakdown'][number];
type StatsPeriod = 'week' | 'month' | 'year';

/**
 * The movements that carried the period, heaviest total volume first.
 *
 * One row per movement: its place, its picture, the name, the sets and reps
 * under it, and the volume on the right where the eye lands when scanning
 * down. A bodyweight movement has no volume to show, so it shows its reps
 * there instead of a misleading "0 kg".
 */
const MainExercisesScreen = ({ navigation }: NavigationOnlyProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const { getToken } = useAuthContext();
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [exercises, setExercises] = useState<ExerciseBreakdown[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setFailed(false);
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const data = await endpoints.getWorkoutStats(period, token);
        if (active) setExercises(data.success ? data.exerciseBreakdown ?? [] : []);
      } catch (error) {
        logHandledError('main-exercises-stats', error);
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [getToken, period]);

  const nameOf = (item: ExerciseBreakdown) => {
    const key = item.name.toLowerCase().replace(/[\s-]/g, '_').replace('pull_up', 'pullup');
    return capitalizeFirst(String(t(`statistics.ex_${key}`, item.name)), language);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('statistics.main_exercises', 'Ana egzersizler')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PillTabs
          tabs={[
            { key: 'week', label: t('statistics.last_7_days', 'Son 7 gün') },
            { key: 'month', label: t('statistics.last_30_days', 'Son 30 gün') },
            { key: 'year', label: t('statistics.last_year', 'Son 12 ay') },
          ]}
          selected={period}
          onSelect={setPeriod}
        />

        {loading ? (
          <View style={styles.state}><ActivityIndicator color={theme.textMuted} /></View>
        ) : failed || exercises.length === 0 ? (
          <Text style={[styles.lead, { color: theme.textMuted }]}>
            {failed ? t('stats.load_failed', 'İstatistikler yüklenemedi.') : t('stats.no_sets_period', 'Bu dönemde tamamlanmış set yok.')}
          </Text>
        ) : (
          <>
            <Text style={[styles.lead, { color: theme.textSecondary }]}>
              {t('stats.main_exercises_lead', 'Toplam hacme göre sıralı.')}
            </Text>
            <View style={[styles.list, { borderTopColor: theme.border }]}>
              {exercises.map((item, index) => {
                const artwork = resolvePublicMediaUrl(item.gifUrl || item.imageUrl, API_URL);
                const hasVolume = (item.volume || 0) > 0;
                return (
                  <View key={item.exerciseId || item.name} style={[styles.row, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.rank, { color: theme.textMuted }]}>{index + 1}</Text>
                    <View style={[styles.artwork, { backgroundColor: artwork ? '#FFFFFF' : theme.surfaceLight }]}>
                      {artwork ? (
                        <Image
                          source={{ uri: mediaVariantUrl(artwork, 'thumb') }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          recyclingKey={item.exerciseId || item.name}
                        />
                      ) : (
                        <Ionicons name="barbell-outline" size={20} color={theme.textMuted} />
                      )}
                    </View>
                    <View style={styles.name}>
                      <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>{nameOf(item)}</Text>
                      <Text numberOfLines={1} style={[styles.meta, { color: theme.textMuted }]}>
                        {t('monthly_report.sets_count', { count: item.sets || 0, defaultValue: '{{count}} set' })}
                        {hasVolume ? ` · ${t('stats.reps_count', { count: formatNumber(item.reps || 0, language), defaultValue: '{{count}} tekrar' })}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.figure, { color: theme.text }]}>
                      {hasVolume ? formatNumber(item.volume, language) : formatNumber(item.reps || 0, language)}
                      <Text style={[styles.unit, { color: theme.textMuted }]}>
                        {hasVolume ? ' kg' : ` ${t('stats.reps', 'Tekrar').toLocaleLowerCase(language)}`}
                      </Text>
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 40 },
  lead: { fontSize: 14, lineHeight: 20, paddingHorizontal: 16, marginTop: 18 },
  list: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: 16, fontSize: 14, fontWeight: '600', textAlign: 'center', fontVariant: ['tabular-nums'] },
  artwork: {
    ...exerciseThumbStyle(EXERCISE_THUMB.large),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  name: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12.5, marginTop: 3 },
  figure: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 12.5, fontWeight: '500' },
  state: { height: 240, alignItems: 'center', justifyContent: 'center' },
});

export default MainExercisesScreen;
