import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
// expo-image: the same recycling, caching thumbnail every other exercise row
// in the app uses, so the artwork here looks and loads identically.
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import dayjs from '../utils/dayjs';

import { useTheme, type MotionTheme } from '../context/ThemeContext';
import { Surface, Text } from 'react-native-paper';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import ScreenHeader from '../components/ScreenHeader';
import { EXERCISE_THUMB, exerciseThumbStyle } from '../config/layout';
import { API_URL } from '../config/environment';
import type { BaseNavigationScreenProps, WorkoutDetailRouteParams } from '../navigation/types';
import { mediaVariantUrl, resolvePublicMediaUrl, type Exercise, type WorkoutExercise } from '@motionmeet/shared';

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

const WorkoutDetailScreen = ({ navigation, route }: BaseNavigationScreenProps) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { horizontalPadding, isNarrow } = useResponsiveLayout({
    minTwoColumnWidth: 420,
  });
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const routeParams = route.params as WorkoutDetailRouteParams | undefined;
  const workout = routeParams?.workout;

  if (!workout || typeof workout !== 'object') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('workout.details', 'Workout Details')} onBack={() => navigation.goBack()} />
        <Surface elevation={0} style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.textMuted} />
          <Text variant="bodyLarge" style={styles.emptyText}>{t('workout.not_available', 'Workout details are not available')}</Text>
        </Surface>
      </SafeAreaView>
    );
  }

  const exercises = workout.exercises || [];
  const totalSets = exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('workout.details', 'Workout Details')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="headlineMedium" style={styles.title}>{workout.name || t('workout.my_workout', 'Workout')}</Text>
        <Text variant="bodyMedium" style={styles.date}>
          {dayjs(workout.startTime || workout.createdAt).format('D MMM YYYY, HH:mm')}
        </Text>

        <Surface elevation={0} style={[styles.statsRow, isNarrow && styles.statsRowNarrow]}>
          <Surface style={[styles.statCard, isNarrow && styles.statCardNarrow]} elevation={1}>
            <Text variant="labelSmall" style={styles.statLabel}>{t('statistics.duration', 'Duration')}</Text>
            <Text variant="titleMedium" style={styles.statValue}>{workout.durationMinutes || 0} min</Text>
          </Surface>
          <Surface style={[styles.statCard, isNarrow && styles.statCardNarrow]} elevation={1}>
            <Text variant="labelSmall" style={styles.statLabel}>{t('statistics.volume', 'Volume')}</Text>
            <Text variant="titleMedium" style={styles.statValue}>{workout.volumeKg || 0} kg</Text>
          </Surface>
          <Surface style={[styles.statCard, isNarrow && styles.statCardNarrow]} elevation={1}>
            <Text variant="labelSmall" style={styles.statLabel}>{t('statistics.sets', 'Sets')}</Text>
            <Text variant="titleMedium" style={styles.statValue}>{totalSets}</Text>
          </Surface>
        </Surface>

        <Text variant="titleLarge" style={styles.sectionTitle}>{t('workout.exercises', 'Exercises')}</Text>
        {exercises.length > 0 ? exercises.map((exercise: WorkoutExercise, exerciseIndex: number) => {
          const artwork = exerciseArtwork(exercise);
          return (
          <Surface key={exercise.id || exerciseIndex} style={styles.exerciseCard} elevation={1}>
            <View style={styles.exerciseHeading}>
              <View style={styles.thumb}>
                {artwork ? (
                  <Image
                    source={{ uri: mediaVariantUrl(artwork, 'thumb') }}
                    style={styles.thumbImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Ionicons name="barbell" size={20} color={theme.primary} />
                )}
              </View>
              <Text variant="titleMedium" numberOfLines={2} style={styles.exerciseName}>
                {(typeof exercise.exerciseId === 'object' ? (exercise.exerciseId as Exercise).name : null) || exercise.exerciseName || t('routines.exercise', 'Exercise')}
              </Text>
            </View>
            {exercise.sets.map((set, setIndex) => (
              <Surface elevation={0} key={set.id || setIndex} style={styles.setRow}>
                <Text variant="bodyMedium" style={styles.setIndex}>{setIndex + 1}</Text>
                <Text variant="bodyMedium" style={styles.setValue}>{set.weight || 0} kg</Text>
                <Text variant="bodyMedium" style={styles.setValue}>{set.reps || 0} reps</Text>
              </Surface>
            ))}
          </Surface>
          );
        }) : (
          <Text variant="bodyMedium" style={styles.emptyText}>{t('workout.no_exercises_yet', 'No exercises')}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.background,
    borderBottomWidth: 1, 
    borderBottomColor: theme.border,
    elevation: 0,
  },
  headerTitle: { color: theme.text, fontSize: 17, fontWeight: '700' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingTop: 20, paddingBottom: 48 },
  title: { color: theme.text, fontWeight: '800' },
  date: { color: theme.textMuted, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 28 },
  statsRowNarrow: { flexDirection: 'column' },
  statCard: {
    flex: 1, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border,
    borderRadius: 14, padding: 12,
  },
  statCardNarrow: { flex: 0, width: '100%' },
  statLabel: { color: theme.textMuted, marginBottom: 6 },
  statValue: { color: theme.text, fontWeight: '700' },
  sectionTitle: { color: theme.text, fontWeight: '700', marginBottom: 12 },
  exerciseCard: {
    backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border,
    borderRadius: 16, padding: 16, marginBottom: 12,
  },
  exerciseHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  thumb: {
    ...exerciseThumbStyle(EXERCISE_THUMB.medium),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  exerciseName: { flex: 1, minWidth: 0, color: theme.primary, fontWeight: '700' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 14 },
  setIndex: { color: theme.textMuted, width: 22, fontWeight: '700' },
  setValue: { color: theme.text, flex: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: theme.textMuted, textAlign: 'center', marginTop: 10 },
});

export default WorkoutDetailScreen;
