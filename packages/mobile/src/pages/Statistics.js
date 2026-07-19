import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Chip, Divider, List } from 'react-native-paper';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const StatisticsMenu = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();

  const menuItems = [
    {
      icon: 'bar-chart-outline',
      paperIcon: 'chart-bar',
      title: t('statistics.sets_per_muscle', 'Kas grubu başına set sayısı'),
      subtitle: t('statistics.sets_desc', 'Her kas grubu için yapılan set sayısı.'),
      pro: true,
      route: 'AdvancedStatisticsScreen',
    },
    {
      icon: 'aperture-outline',
      paperIcon: 'chart-donut',
      title: t('statistics.muscle_dist_chart', 'Kas dağılımı (Grafik)'),
      subtitle: t('statistics.muscle_dist_desc', 'Mevcut ve önceki kas dağılımlarınızı karşılaştırın.'),
      pro: false,
      route: 'MuscleDistribution',
    },
    {
      paperIcon: 'human',
      title: t('statistics.muscle_dist_body', 'Kas dağılımı (Vücut)'),
      subtitle: t('statistics.muscle_body_desc', 'Çalıştırılan kasların haftalık ısı haritası.'),
      pro: false,
      route: 'MuscleDistributionBodyScreen',
    },
    {
      paperIcon: 'dumbbell',
      title: t('statistics.main_exercises', 'Ana egzersizler'),
      subtitle: t('statistics.main_ex_desc', 'En sık yaptığınız egzersizlerin listesi.'),
      pro: false,
      route: 'MainExercisesScreen',
    },
    {
      paperIcon: 'trophy-outline',
      title: t('statistics.leaderboard', 'Lider Tablosu Egzersizleri'),
      subtitle: t('statistics.leaderboard_desc', 'Lider tablosuna uygun egzersizlerin listesi.'),
      pro: false,
      route: 'LeaderboardScreen',
    },
    {
      paperIcon: 'file-document-outline',
      title: t('statistics.monthly_report', 'Aylık Rapor'),
      subtitle: t('statistics.monthly_desc', 'Aylık antrenman ve istatistiklerinizin özeti.'),
      pro: false,
      route: 'MonthlyReportScreen',
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Appbar.Header style={{ backgroundColor: theme.surface, elevation: 0 }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content title={t('statistics.title', 'İstatistikler')} titleStyle={{ color: theme.text, fontWeight: '700' }} />
      </Appbar.Header>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <List.Subheader style={{ color: theme.textMuted }}>
          {t('statistics.adv_stats', 'Gelişmiş İstatistikler')}
        </List.Subheader>

        <Divider />

        {menuItems.map((item, index) => (
          <React.Fragment key={index}>
            <List.Item
              title={item.title}
              description={item.subtitle}
              titleStyle={{ color: theme.text, fontWeight: '500' }}
              descriptionStyle={{ color: theme.textMuted }}
              descriptionNumberOfLines={2}
              left={(props) => (
                <List.Icon {...props} icon={item.paperIcon} color={theme.textMuted} />
              )}
              right={(props) =>
                item.pro ? (
                  <Chip
                    {...props}
                    compact
                    style={{ backgroundColor: '#eab308', alignSelf: 'center', marginRight: 4 }}
                    textStyle={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}
                  >
                    PRO
                  </Chip>
                ) : (
                  <List.Icon {...props} icon="chevron-right" color={theme.border} />
                )
              }
              onPress={() => item.route && navigation.navigate(item.route)}
              style={{ backgroundColor: theme.surface, paddingVertical: 4 }}
            />
            <Divider />
          </React.Fragment>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default StatisticsMenu;
