import React, { useState, useEffect } from 'react';
import { ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { API_URL } from '../config/environment';
import { resolvePublicMediaUrl } from '@motionmeet/shared';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { getExerciseStats } from '../api/endpoints';
import { useAuthContext } from '../context/AuthProvider';
import { Appbar, Text, Surface, Button, useTheme as usePaperTheme, TouchableRipple } from 'react-native-paper';
import { logHandledError } from '../utils/feedback';

const ExerciseDetail = ({ route, navigation }) => {
  const { exercise } = route.params;
  const { theme, isDark } = useTheme();
  const paperTheme = usePaperTheme();
  const styles = getStyles(theme, paperTheme);
  const { t, i18n } = useTranslation();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuthContext();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = await getToken();
        const data = await getExerciseStats(exercise._id, token);
        if (data.success) {
          setStats(data.stats);
        }
      } catch (error) {
        logHandledError('load-exercise-stats', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [exercise._id, getToken]);

  const language = i18n.resolvedLanguage?.split('-')[0] || 'en';
  const steps = exercise.instructionSteps?.[language] || exercise.instructionSteps?.en || [];
  const instruction = exercise.instructions?.[language] || exercise.instructions?.en || '';
  const mediaUrl = resolvePublicMediaUrl(exercise.gifUrl, API_URL);

  const startWorkout = () => {
    navigation.navigate('ActiveWorkoutScreen', {
      routine: {
        name: exercise.name,
        exercises: [{
          exerciseId: exercise,
          sets: [{ reps: '', weight: '', setType: 'normal' }],
        }],
      },
    });
  };

  return (
    <Surface elevation={0} style={styles.container}>
      {/* Header */}
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content title="" />
      </Appbar.Header>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <Surface elevation={0} style={styles.mediaContainer}>
          {mediaUrl ? (
            <Image source={{ uri: mediaUrl }} style={styles.media} contentFit="contain" accessibilityLabel={exercise.name} />
          ) : (
            <Surface style={[styles.placeholderMedia, { backgroundColor: theme.surface }]} elevation={1}>
              <Ionicons name="barbell-outline" size={48} color={theme.textMuted} />
              <Text variant="bodyMedium" style={{ color: theme.textMuted, marginTop: 8 }}>
                {t('exercises.media_unavailable', 'Media unavailable')}
              </Text>
            </Surface>
          )}
        </Surface>

        <Surface elevation={0} style={styles.infoSection}>
          <Text variant="headlineMedium" style={styles.title}>{exercise.name}</Text>
          <Text variant="titleMedium" style={styles.subtitle}>{exercise.muscleGroup} • {exercise.equipment}</Text>
        </Surface>

        <Surface elevation={0} style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>{t('exercises.instructions', 'Nasıl Yapılır?')}</Text>
          <Text variant="bodyLarge" style={styles.bodyText}>
            {steps.length
              ? steps.map((step, index) => `${index + 1}. ${step}`).join('\n')
              : instruction || t('exercises.instructions_unavailable', 'Instructions are not available for this exercise yet.')}
          </Text>
        </Surface>

        <Surface elevation={0} style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>{t('exercises.history', 'Geçmiş Rekorlar')}</Text>
          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
          ) : (
            <Surface elevation={0} style={styles.statsGrid}>
              <Surface style={[styles.statBox, { borderColor: theme.border, backgroundColor: theme.surface }]} elevation={1}>
                  <Text variant="labelMedium" style={styles.statLabel}>{t('exercises.personal_record', 'Personal Record')}</Text>
                  <Text variant="headlineSmall" style={styles.statValue}>{stats?.personalRecord || 0} <Text variant="bodyMedium" style={{color: theme.textMuted}}>kg</Text></Text>
              </Surface>
              <Surface style={[styles.statBox, { borderColor: theme.border, backgroundColor: theme.surface }]} elevation={1}>
                  <Text variant="labelMedium" style={styles.statLabel}>{t('exercises.total_sessions', 'Total Sessions')}</Text>
                  <Text variant="headlineSmall" style={styles.statValue}>{stats?.totalSessions || 0}</Text>
              </Surface>
            </Surface>
          )}
        </Surface>

        <Button 
          mode="contained" 
          style={styles.logButton} 
          contentStyle={{ height: 56 }}
          labelStyle={styles.logButtonText}
          buttonColor={theme.primary}
          onPress={startWorkout}
        >
          {t('exercises.log_workout', 'Antrenman Kaydet')}
        </Button>

      </ScrollView>
    </Surface>
  );
};

const getStyles = (theme, paperTheme) => ({
  container: { flex: 1, backgroundColor: theme.background },
  header: { backgroundColor: theme.background, elevation: 0 },
  mediaContainer: { width: '100%', aspectRatio: 16/9, paddingHorizontal: 20, marginTop: 10 },
  media: { flex: 1, borderRadius: 16, backgroundColor: theme.surface },
  placeholderMedia: { flex: 1, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  infoSection: { paddingHorizontal: 20, marginTop: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: theme.border },
  title: { fontWeight: 'bold', color: theme.text, marginBottom: 4 },
  subtitle: { color: theme.textMuted, fontWeight: '500' },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontWeight: 'bold', color: theme.text, marginBottom: 12 },
  bodyText: { color: theme.text, lineHeight: 24, opacity: 0.9 },
  statsGrid: { flexDirection: 'row', gap: 12, marginTop: 8 },
  statBox: { flex: 1, borderRadius: 16, padding: 16, borderWidth: 1 },
  statLabel: { fontWeight: '700', color: theme.textMuted, marginBottom: 6 },
  statValue: { fontWeight: '900', color: theme.text },
  logButton: { marginHorizontal: 20, marginTop: 32, borderRadius: 100 },
  logButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

export default ExerciseDetail;
