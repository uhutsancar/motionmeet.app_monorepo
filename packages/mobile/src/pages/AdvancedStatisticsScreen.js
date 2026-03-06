import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '@clerk/clerk-expo';
import api from '../api/client';

const AdvancedStatisticsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { getToken } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [muscleData, setMuscleData] = useState([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = await getToken();
      const { data } = await api.get('/api/workout/stats?period=month', {
        headers: { Authorization: `Bearer ${token}` }
      });
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('statistics.sets_per_muscle', 'Kas grubu başına set')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
        ) : muscleData.length === 0 ? (
          <View style={styles.emptyState}>
             <Ionicons name="bar-chart-outline" size={48} color={theme.textMuted} />
             <Text style={styles.emptyText}>{t('common.no_data', 'Veri bulunamadı')}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {muscleData.map((item, index) => {
              const translatedName = t(`statistics.muscle_${item.name.toLowerCase()}`, item.name);
              return (
              <View key={index} style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.muscleName}>{translatedName}</Text>
                  <Text style={styles.muscleValue}>{item.value}%</Text>
                </View>
                <View style={styles.barBackground}>
                  <View style={[styles.barFill, { width: `${item.value}%`, backgroundColor: theme.primary }]} />
                </View>
              </View>
            )})}
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
  card: {
    backgroundColor: theme.surface, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: theme.border, shadowColor: '#000',
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2
  },
  row: { marginBottom: 20 },
  rowInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  muscleName: { fontSize: 15, fontWeight: '700', color: theme.text },
  muscleValue: { fontSize: 14, fontWeight: '800', color: theme.primary },
  barBackground: { height: 10, backgroundColor: theme.surfaceLight, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 12, fontSize: 15, color: theme.textMuted }
});

export default AdvancedStatisticsScreen;
