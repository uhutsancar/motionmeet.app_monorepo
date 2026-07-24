import React, { useState, useEffect } from 'react';
import { ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { getExerciseStats } from '../api/endpoints';
import { useAuthContext } from '../context/AuthProvider';
import { Appbar, Text, Surface, Button, useTheme as usePaperTheme, TouchableRipple } from 'react-native-paper';

const ExerciseDetail = ({ route, navigation }) => {
  const { exercise } = route.params;
  const { theme, isDark } = useTheme();
  const paperTheme = usePaperTheme();
  const styles = getStyles(theme, paperTheme);
  const { t } = useTranslation();

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
        console.error("Error fetching exercise stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [exercise._id, getToken]);

  return (
    <Surface elevation={0} style={styles.container}>
      {/* Header */}
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content title="" />
        <Appbar.Action icon="dots-horizontal" onPress={() => {}} color={theme.text} />
      </Appbar.Header>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Placeholder for Exercise Video/GIF */}
        <Surface elevation={0} style={styles.mediaContainer}>
          <Surface style={[styles.placeholderMedia, { backgroundColor: theme.surface }]} elevation={1}>
             <Ionicons name="play-circle-outline" size={48} color={theme.textMuted} />
             <Text variant="bodyMedium" style={{ color: theme.textMuted, marginTop: 8 }}>{t('exercises.media_placeholder', 'Video Eklenecek')}</Text>
          </Surface>
        </Surface>

        <Surface elevation={0} style={styles.infoSection}>
          <Text variant="headlineMedium" style={styles.title}>{exercise.name}</Text>
          <Text variant="titleMedium" style={styles.subtitle}>{exercise.muscleGroup} • {exercise.equipment}</Text>
        </Surface>

        <Surface elevation={0} style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>{t('exercises.instructions', 'Nasıl Yapılır?')}</Text>
          <Text variant="bodyLarge" style={styles.bodyText}>
            1. {t('exercises.demo_instruction1', 'Ağırlığı iki elinizle sıkıca kavrayın ve dengenizi sağlayın.')}{'\n'}
            2. {t('exercises.demo_instruction2', 'Nefes vererek ağırlığı kaldırın, tepe noktasında kaslarınızı sıkın.')}{'\n'}
            3. {t('exercises.demo_instruction3', 'Nefes alarak ağırlığı kontrollü bir şekilde başlangıç pozisyonuna indirin.')}
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
          onPress={() => {}}
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
