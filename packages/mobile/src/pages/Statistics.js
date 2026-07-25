import React from 'react';
import { ScrollView, StatusBar, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Surface, Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const StatisticsMenu = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const menuItems = [
    {
      icon: 'stats-chart-outline',
      title: t('statistics.sets_per_muscle', 'Sets by muscle group'),
      subtitle: t('statistics.sets_desc', 'Review how your weekly volume is distributed.'),
      pro: true,
      route: 'AdvancedStatisticsScreen',
    },
    {
      icon: 'pie-chart-outline',
      title: t('statistics.muscle_dist_chart', 'Muscle distribution'),
      subtitle: t('statistics.muscle_dist_desc', 'Compare current and previous training periods.'),
      route: 'MuscleDistribution',
    },
    {
      icon: 'body-outline',
      title: t('statistics.muscle_dist_body', 'Body heat map'),
      subtitle: t('statistics.muscle_body_desc', 'See which muscles you trained this week.'),
      route: 'MuscleDistributionBodyScreen',
    },
    {
      icon: 'barbell-outline',
      title: t('statistics.main_exercises', 'Main exercises'),
      subtitle: t('statistics.main_ex_desc', 'Your most frequently logged movements.'),
      route: 'MainExercisesScreen',
    },
    {
      icon: 'trophy-outline',
      title: t('statistics.leaderboard', 'Exercise leaderboard'),
      subtitle: t('statistics.leaderboard_desc', 'Compare eligible lifts with the community.'),
      route: 'LeaderboardScreen',
    },
    {
      icon: 'document-text-outline',
      title: t('statistics.monthly_report', 'Monthly report'),
      subtitle: t('statistics.monthly_desc', 'A concise summary of your training month.'),
      route: 'MonthlyReportScreen',
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Appbar.Header
        style={{
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          elevation: 0,
        }}
      >
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content
          title={t('statistics.title', 'Statistics')}
          titleStyle={{ color: theme.text, fontSize: 22, fontWeight: '800' }}
        />
      </Appbar.Header>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          paddingHorizontal: 16,
          paddingTop: 20,
          paddingBottom: 32,
        }}
      >
        <Text style={{ color: theme.text, fontSize: 21, fontWeight: '800' }}>
          {t('statistics.overview_title', 'Understand your training')}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 16 }}>
          {t('statistics.overview_subtitle', 'Open a report to see volume, consistency and muscle balance.')}
        </Text>

        <Surface
          elevation={0}
          style={{
            overflow: 'hidden',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
          }}
        >
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.route}
              activeOpacity={0.72}
              onPress={() => navigation.navigate(item.route)}
              style={{
                minHeight: 74,
                paddingHorizontal: 14,
                paddingVertical: 11,
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: index < menuItems.length - 1 ? 1 : 0,
                borderBottomColor: theme.border,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.surfaceLight,
                }}
              >
                <Ionicons name={item.icon} size={20} color={theme.textSecondary} />
              </View>
              <View style={{ flex: 1, paddingHorizontal: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.pro && (
                    <View
                      style={{
                        marginLeft: 7,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: theme.energy,
                      }}
                    >
                      <Text style={{ color: '#121417', fontSize: 8, fontWeight: '900' }}>PRO</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: theme.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 }} numberOfLines={2}>
                  {item.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
};

export default StatisticsMenu;
