import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const StatisticsMenu = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme);

  const menuItems = [
    {
      icon: 'bar-chart-outline',
      title: t('statistics.sets_per_muscle', 'Kas grubu başına set sayısı'),
      subtitle: t('statistics.sets_desc', 'Her kas grubu için yapılan set sayısı.'),
      pro: true,
      route: null
    },
    {
      icon: 'aperture-outline',
      title: t('statistics.muscle_dist_chart', 'Kas dağılımı (Grafik)'),
      subtitle: t('statistics.muscle_dist_desc', 'Mevcut ve önceki kas dağılımlarınızı karşılaştırın.'),
      pro: false,
      route: 'MuscleDistribution'
    },
    {
      icon: 'body-outline',
      title: t('statistics.muscle_dist_body', 'Kas dağılımı (Vücut)'),
      subtitle: t('statistics.muscle_body_desc', 'Çalıştırılan kasların haftalık ısı haritası.'),
      pro: false,
      route: null
    },
    {
      icon: 'barbell-outline',
      title: t('statistics.main_exercises', 'Ana egzersizler'),
      subtitle: t('statistics.main_ex_desc', 'En sık yaptığınız egzersizlerin listesi.'),
      pro: false,
      route: null
    },
    {
      icon: 'podium-outline',
      title: t('statistics.leaderboard', 'Lider Tablosu Egzersizleri'),
      subtitle: t('statistics.leaderboard_desc', 'Lider tablosuna uygun egzersizlerin listesi.'),
      pro: false,
      route: null
    },
    {
      icon: 'document-text-outline',
      title: t('statistics.monthly_report', 'Aylık Rapor'),
      subtitle: t('statistics.monthly_desc', 'Aylık antrenman ve istatistiklerinizin özeti.'),
      pro: false,
      route: 'MonthlyReportScreen'
    }
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('statistics.title', 'İstatistikler')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
         <Text style={styles.sectionHeader}>{t('statistics.adv_stats', 'Gelişmiş İstatistikler')}</Text>
         
         <View style={styles.menuList}>
           {menuItems.map((item, index) => (
             <TouchableOpacity 
               key={index} 
               style={styles.menuItem}
               onPress={() => item.route && navigation.navigate(item.route)}
               activeOpacity={item.route ? 0.7 : 1}
             >
                <View style={styles.iconBox}>
                   <Ionicons name={item.icon} size={26} color={theme.textMuted} />
                </View>
                <View style={styles.menuTextContent}>
                   <View style={styles.titleRow}>
                     <Text style={styles.itemTitle}>{item.title}</Text>
                     {item.pro && (
                       <View style={styles.proBadge}>
                          <Text style={styles.proText}>PRO</Text>
                       </View>
                     )}
                   </View>
                   <Text style={styles.itemSubtitle} numberOfLines={2}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.border} />
             </TouchableOpacity>
           ))}
         </View>
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  sectionHeader: { fontSize: 15, color: theme.textMuted, fontWeight: '600', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  menuList: { borderTopWidth: 1, borderTopColor: theme.border },
  menuItem: { 
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, 
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: theme.border 
  },
  iconBox: { width: 32, justifyContent: 'flex-start', alignItems: 'flex-start', paddingTop: 2 },
  menuTextContent: { flex: 1, paddingRight: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  itemTitle: { fontSize: 16, color: theme.text, fontWeight: '500' },
  itemSubtitle: { fontSize: 14, color: theme.textMuted, lineHeight: 20 },
  proBadge: { backgroundColor: '#eab308', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  proText: { color: theme.background, fontSize: 10, fontWeight: 'bold' }
});

export default StatisticsMenu;
