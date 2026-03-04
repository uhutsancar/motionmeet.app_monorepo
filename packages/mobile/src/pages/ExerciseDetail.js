import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Image, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import moment from 'moment';

const ExerciseDetail = ({ route, navigation }) => {
  const { exercise } = route.params;
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme);
  const { t } = useTranslation();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get(`/api/exercise/${exercise._id}/stats`);
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
  }, [exercise._id]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.moreBtn}>
          <Ionicons name="ellipsis-horizontal" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Placeholder for Exercise Video/GIF */}
        <View style={styles.mediaContainer}>
          <View style={[styles.placeholderMedia, { backgroundColor: theme.surface }]}>
             <Ionicons name="play-circle-outline" size={48} color={theme.textMuted} />
             <Text style={{ color: theme.textMuted, marginTop: 8 }}>{t('exercises.media_placeholder', 'Video Eklenecek')}</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.title}>{exercise.name}</Text>
          <Text style={styles.subtitle}>{exercise.muscleGroup} • {exercise.equipment}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('exercises.instructions', 'Nasıl Yapılır?')}</Text>
          <Text style={styles.bodyText}>
            1. {t('exercises.demo_instruction1', 'Ağırlığı iki elinizle sıkıca kavrayın ve dengenizi sağlayın.')}{'\n'}
            2. {t('exercises.demo_instruction2', 'Nefes vererek ağırlığı kaldırın, tepe noktasında kaslarınızı sıkın.')}{'\n'}
            3. {t('exercises.demo_instruction3', 'Nefes alarak ağırlığı kontrollü bir şekilde başlangıç pozisyonuna indirin.')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('exercises.history', 'Geçmiş Rekorlar')}</Text>
          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
          ) : (
            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <Text style={styles.statLabel}>{t('exercises.personal_record', 'Personal Record')}</Text>
                  <Text style={styles.statValue}>{stats?.personalRecord || 0} <Text style={{fontSize: 14, color: theme.textMuted}}>kg</Text></Text>
              </View>
              <View style={[styles.statBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <Text style={styles.statLabel}>{t('exercises.total_sessions', 'Total Sessions')}</Text>
                  <Text style={styles.statValue}>{stats?.totalSessions || 0}</Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.logButton}>
          <Text style={styles.logButtonText}>{t('exercises.log_workout', 'Antrenman Kaydet')}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingpx: 20, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  moreBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  mediaContainer: { width: '100%', aspectRatio: 16/9, paddingHorizontal: 20, marginTop: 10 },
  placeholderMedia: { flex: 1, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  infoSection: { paddingHorizontal: 20, marginTop: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: theme.border },
  title: { fontSize: 24, fontWeight: 'bold', color: theme.text, marginBottom: 4 },
  subtitle: { fontSize: 15, color: theme.textMuted, fontWeight: '500' },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 12 },
  bodyText: { fontSize: 15, color: theme.text, lineHeight: 24, opacity: 0.9 },
  statsGrid: { flexDirection: 'row', gap: 12, marginTop: 8 },
  statBox: { flex: 1, borderRadius: 16, padding: 16, borderWidth: 1 },
  statLabel: { fontSize: 12, fontWeight: '700', color: theme.textMuted, marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '900', color: theme.text },
  logButton: { marginHorizontal: 20, marginTop: 32, backgroundColor: theme.primary, borderRadius: 100, height: 56, justifyContent: 'center', alignItems: 'center' },
  logButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

export default ExerciseDetail;
