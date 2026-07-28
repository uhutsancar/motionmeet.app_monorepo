import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import { useTheme } from '../context/ThemeContext';
import { Appbar, Surface, Text } from 'react-native-paper';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const WorkoutDetailScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { horizontalPadding, isNarrow } = useResponsiveLayout({
    minTwoColumnWidth: 420,
  });
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const workout = route?.params?.workout;

  if (!workout || typeof workout !== 'object') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <Appbar.Header style={styles.header} statusBarHeight={0}>
          <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
          <Appbar.Content title={t('workout.details', 'Workout Details')} titleStyle={styles.headerTitle} />
        </Appbar.Header>
        <Surface elevation={0} style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.textMuted} />
          <Text variant="bodyLarge" style={styles.emptyText}>{t('workout.not_available', 'Workout details are not available')}</Text>
        </Surface>
      </SafeAreaView>
    );
  }

  const exercises = workout.exercises || [];
  const totalSets = exercises.reduce((total, exercise) => total + (exercise.sets?.length || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Appbar.Header style={styles.header} statusBarHeight={0}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content title={t('workout.details', 'Workout Details')} titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="headlineMedium" style={styles.title}>{workout.name || t('workout.my_workout', 'Workout')}</Text>
        <Text variant="bodyMedium" style={styles.date}>
          {moment(workout.startTime || workout.createdAt).format('D MMM YYYY, HH:mm')}
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
        {exercises.length > 0 ? exercises.map((exercise, exerciseIndex) => (
          <Surface key={exercise._id || exerciseIndex} style={styles.exerciseCard} elevation={1}>
            <Text variant="titleMedium" style={styles.exerciseName}>
              {exercise.exerciseId?.name || exercise.name || t('routines.exercise', 'Exercise')}
            </Text>
            {(exercise.sets || []).map((set, setIndex) => (
              <Surface elevation={0} key={set._id || setIndex} style={styles.setRow}>
                <Text variant="bodyMedium" style={styles.setIndex}>{setIndex + 1}</Text>
                <Text variant="bodyMedium" style={styles.setValue}>{set.weight || 0} kg</Text>
                <Text variant="bodyMedium" style={styles.setValue}>{set.reps || 0} reps</Text>
              </Surface>
            ))}
          </Surface>
        )) : (
          <Text variant="bodyMedium" style={styles.emptyText}>{t('workout.no_exercises_yet', 'No exercises')}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme) => ({
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
    flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 14, padding: 12,
  },
  statCardNarrow: { flex: 0, width: '100%' },
  statLabel: { color: theme.textMuted, marginBottom: 6 },
  statValue: { color: theme.text, fontWeight: '700' },
  sectionTitle: { color: theme.text, fontWeight: '700', marginBottom: 12 },
  exerciseCard: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 16, padding: 16, marginBottom: 12,
  },
  exerciseName: { color: theme.primary, fontWeight: '700', marginBottom: 10 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 14 },
  setIndex: { color: theme.textMuted, width: 22, fontWeight: '700' },
  setValue: { color: theme.text, flex: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: theme.textMuted, textAlign: 'center', marginTop: 10 },
});

export default WorkoutDetailScreen;
