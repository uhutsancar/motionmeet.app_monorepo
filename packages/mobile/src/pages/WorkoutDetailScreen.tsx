import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
// expo-image: the same recycling, caching thumbnail every other exercise row
// in the app uses, so the artwork here looks and loads identically.
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import dayjs from '../utils/dayjs';
import { capitalizeFirst, formatDuration, formatNumber, formatWeight } from '../utils/format';
import { useTheme } from '../context/ThemeContext';
import ScreenHeader from '../components/ScreenHeader';
import StatStrip from '../components/charts/StatStrip';
import ShareBar from '../components/charts/ShareBar';
import { bodyPartLabel } from '../utils/exerciseLabels';
import { EXERCISE_THUMB, exerciseThumbStyle } from '../config/layout';
import { API_URL } from '../config/environment';
import type { BaseNavigationScreenProps, WorkoutDetailRouteParams } from '../navigation/types';
import { mediaVariantUrl, resolvePublicMediaUrl, type Exercise, type ExerciseSet, type WorkoutExercise } from '@motionmeet/shared';

/**
 * The movement's own picture, when the backend hydrated one.
 *
 * Every other list of exercises in the app leads with the artwork, so a session
 * opened from a post was the one place a member had to read five names to work
 * out what they had done.
 */
const exerciseArtwork = (exercise: WorkoutExercise): string | null => {
  const hydrated = typeof exercise.exerciseId === 'object' ? (exercise.exerciseId as Exercise) : null;
  return resolvePublicMediaUrl(hydrated?.gifUrl || hydrated?.imageUrl, API_URL);
};

/**
 * One finished session, read the way it was logged: the totals in one strip,
 * then each exercise with its sets as rows. Warm-up, drop and failure sets
 * carry a letter in place of their number, as they do while logging, so the
 * working sets are the ones counted 1, 2, 3.
 */
const WorkoutDetailScreen = ({ navigation, route }: BaseNavigationScreenProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const workout = (route.params as WorkoutDetailRouteParams | undefined)?.workout;

  if (!workout || typeof workout !== 'object') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('workout.details', 'Antrenman')} onBack={() => navigation.goBack()} />
        <Text style={[styles.note, { color: theme.textMuted }]}>{t('workout.not_available', 'Antrenman ayrıntıları bulunamadı.')}</Text>
      </SafeAreaView>
    );
  }

  const exercises = workout.exercises || [];
  const totalSets = exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  // Where the session's sets went, by the catalogue's body part: Hevy's
  // "muscle split" for one workout, as a single bar rather than a chart.
  const split = new Map<string, { label: string; sets: number }>();
  exercises.forEach((exercise) => {
    const hydrated = typeof exercise.exerciseId === 'object' ? (exercise.exerciseId as Exercise) : null;
    const raw = hydrated?.muscleGroup || '';
    if (!raw) return;
    const entry = split.get(raw) ?? { label: bodyPartLabel(raw, t, language), sets: 0 };
    entry.sets += exercise.sets.length;
    split.set(raw, entry);
  });
  const splitParts = [...split.entries()].map(([key, entry]) => ({
    key,
    label: entry.label,
    value: entry.sets,
    display: t('monthly_report.sets_count', { count: entry.sets, defaultValue: '{{count}} set' }),
  }));
  const setBadge: Record<string, { letter: string; color: string }> = {
    warmup: { letter: t('workout.set_letter_warmup', 'I'), color: theme.warning },
    drop: { letter: 'D', color: theme.secondary },
    failure: { letter: t('workout.set_letter_failure', 'T'), color: theme.danger },
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('workout.details', 'Antrenman')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pad}>
          <Text style={[styles.title, { color: theme.text }]}>{workout.name || t('workout.my_workout', 'Antrenman')}</Text>
          <Text style={[styles.date, { color: theme.textMuted }]}>
            {dayjs(workout.startTime || workout.createdAt).format('D MMMM YYYY, dddd · HH:mm')}
          </Text>
        </View>

        <View style={styles.strip}>
          <StatStrip
            cells={[
              { key: 'duration', label: t('stats.duration', 'Süre'), value: formatDuration(workout.durationMinutes || 0, language) },
              { key: 'volume', label: t('stats.volume', 'Hacim'), value: formatNumber(workout.volumeKg || 0, language), unit: 'kg' },
              { key: 'sets', label: t('stats.sets', 'Set'), value: formatNumber(totalSets, language) },
            ]}
          />
        </View>

        {splitParts.length > 1 ? (
          <View style={[styles.pad, styles.split]}>
            <Text style={[styles.splitTitle, { color: theme.text }]}>{t('monthly_report.muscle_distribution', 'Kas dağılımı')}</Text>
            <ShareBar parts={splitParts} accessibilityLabel={splitParts.map((part) => `${part.label} ${part.display}`).join(', ')} />
          </View>
        ) : null}

        {exercises.length > 0 ? exercises.map((exercise: WorkoutExercise, exerciseIndex: number) => {
          const artwork = exerciseArtwork(exercise);
          const name = (typeof exercise.exerciseId === 'object' ? (exercise.exerciseId as Exercise).name : null)
            || exercise.exerciseName || t('routines.exercise', 'Egzersiz');
          let workingSet = 0;
          return (
            <View key={exercise.id || exerciseIndex} style={[styles.exercise, { borderBottomColor: theme.border }]}>
              <View style={styles.heading}>
                <View style={[styles.thumb, { backgroundColor: artwork ? '#FFFFFF' : theme.surfaceLight }]}>
                  {artwork ? (
                    <Image source={{ uri: mediaVariantUrl(artwork, 'thumb') }} style={styles.thumbImage} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <Ionicons name="barbell-outline" size={20} color={theme.textMuted} />
                  )}
                </View>
                <Text numberOfLines={2} style={[styles.exerciseName, { color: theme.text }]}>{capitalizeFirst(name, language)}</Text>
              </View>

              <View style={styles.setHeader}>
                <Text style={[styles.setCol, { color: theme.textMuted }]}>{t('workout.set_column', 'SET')}</Text>
                <Text style={[styles.setMain, { color: theme.textMuted }]}>{t('workout.weight_reps', 'Ağırlık × tekrar')}</Text>
              </View>
              {exercise.sets.map((set: ExerciseSet, setIndex: number) => {
                const badge = setBadge[set.setType ?? 'normal'];
                if (!badge) workingSet += 1;
                return (
                  <View key={set.id || setIndex} style={styles.setRow}>
                    <Text style={[styles.setCol, styles.setNumber, { color: badge ? badge.color : theme.text }]}>
                      {badge ? badge.letter : workingSet}
                    </Text>
                    <Text style={[styles.setMain, styles.setValue, { color: theme.text }]}>
                      {`${formatWeight(set.weight || 0, language)} kg × ${formatNumber(set.reps || 0, language)}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        }) : (
          <Text style={[styles.note, { color: theme.textMuted }]}>{t('workout.no_exercises_yet', 'Bu antrenmanda egzersiz yok.')}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  pad: { paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 19, fontWeight: '700', letterSpacing: -0.2 },
  date: { fontSize: 13, marginTop: 3 },
  strip: { marginTop: 16 },
  split: { paddingTop: 18, paddingBottom: 6 },
  splitTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  exercise: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { ...exerciseThumbStyle(EXERCISE_THUMB.medium), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  exerciseName: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '600' },
  setHeader: { flexDirection: 'row', marginTop: 14, marginBottom: 4 },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 34 },
  setCol: { width: 44, fontSize: 11.5, fontWeight: '500' },
  setMain: { flex: 1, fontSize: 11.5, fontWeight: '500' },
  setNumber: { fontSize: 14, fontWeight: '600' },
  setValue: { fontSize: 14.5, fontWeight: '400', fontVariant: ['tabular-nums'] },
  note: { fontSize: 14, padding: 16 },
});

export default WorkoutDetailScreen;
