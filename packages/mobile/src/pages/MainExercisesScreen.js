import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '@clerk/clerk-expo';
import api from '../api/client';

const MainExercisesScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { getToken } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = await getToken();
      const { data } = await api.get('/api/workout/stats?period=month', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success && data.exerciseBreakdown) {
        setExercises(data.exerciseBreakdown);
      }
    } catch (error) {
      console.log('Error fetching main exercises stats', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('statistics.main_exercises', 'Ana egzersizler')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
        ) : exercises.length === 0 ? (
          <View style={styles.emptyState}>
             <Ionicons name="barbell-outline" size={48} color={theme.textMuted} />
             <Text style={styles.emptyText}>{t('common.no_data', 'Veri bulunamadı')}</Text>
          </View>
        ) : (
          <View style={styles.list}>
             {exercises.map((item, index) => (
                <View key={index} style={styles.listItem}>
                    <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>#{index + 1}</Text>
                    </View>
                    <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemValue}>{item.total.toLocaleString()} total reps</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.border} />
                </View>
             ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.border
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
  content: { padding: 16 },
  list: { backgroundColor: theme.surface, borderRadius: 20, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  listItem: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: theme.border
  },
  rankBadge: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary + '20',
    justifyContent: 'center', alignItems: 'center', marginRight: 16
  },
  rankText: { fontSize: 15, fontWeight: '800', color: theme.primary },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 4 },
  itemValue: { fontSize: 13, color: theme.textMuted },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 12, fontSize: 15, color: theme.textMuted }
});

export default MainExercisesScreen;
