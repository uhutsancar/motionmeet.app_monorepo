import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const LeaderboardScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme, isDark);
  
  // Dummy data to fulfill "no empty screens" requirement with premium aesthetics
  const leaderboards = [
      { id: 1, name: 'Bench Press', icon: 'barbell', topScore: '145 kg', users: 1240, color: '#3b82f6' },
      { id: 2, name: 'Squat', icon: 'body', topScore: '210 kg', users: 950, color: '#eab308' },
      { id: 3, name: 'Deadlift', icon: 'fitness', topScore: '240 kg', users: 1120, color: '#ef4444' },
      { id: 4, name: 'Pull-up', icon: 'caret-up-circle', topScore: '45 reps', users: 3400, color: '#10b981' }
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('statistics.leaderboard', 'Lider Tablosu')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.promoBox}>
              <View style={styles.proBadge}><Text style={styles.proText}>PRO</Text></View>
              <Text style={styles.promoText}>{t('statistics.leaderboard_desc', 'Lider tablosuna uygun egzersizlerin listesi.')}</Text>
          </View>
          
          <View style={styles.list}>
             {leaderboards.map((item, index) => (
                <View key={item.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
                            <Ionicons name={item.icon} size={24} color={item.color} />
                        </View>
                        <Text style={styles.cardTitle}>{item.name}</Text>
                    </View>
                    <View style={styles.cardStats}>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>Top Score</Text>
                            <Text style={styles.statValue}>{item.topScore}</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>Participants</Text>
                            <Text style={styles.statValue}>{item.users.toLocaleString()}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={[styles.viewBtn, { backgroundColor: item.color }]} activeOpacity={0.8}>
                        <Text style={styles.viewBtnText}>View Rankings</Text>
                    </TouchableOpacity>
                </View>
             ))}
          </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.border
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
  content: { padding: 16 },
  promoBox: {
      backgroundColor: theme.surfaceLight, borderRadius: 16, padding: 16,
      marginBottom: 20, borderWidth: 1, borderColor: theme.border, alignItems: 'flex-start'
  },
  proBadge: { backgroundColor: '#eab308', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginBottom: 8 },
  proText: { color: isDark ? '#000' : '#fff', fontSize: 10, fontWeight: '900' },
  promoText: { fontSize: 14, color: theme.textMuted, lineHeight: 20 },
  list: { paddingBottom: 20 },
  card: {
      backgroundColor: theme.surface, borderRadius: 20, padding: 20,
      marginBottom: 16, borderWidth: 1, borderColor: theme.border,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  iconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 10 },
  statBox: { alignItems: 'center' },
  statLabel: { fontSize: 12, color: theme.textMuted, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '800', color: theme.text },
  viewBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  viewBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' }
});

export default LeaderboardScreen;
