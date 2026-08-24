import React from 'react';
import {
  ScrollView,
  StatusBar,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import ScreenHeader from '../components/ScreenHeader';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import type { NavigationOnlyProps } from '../navigation/types';

interface StatisticsItem {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  route: string;
  color?: string;
}

const StatisticsMenu = ({ navigation }: NavigationOnlyProps) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const {
    columns,
    columnGap,
    contentWidth,
    horizontalPadding,
  } = useResponsiveLayout();
  const cardWidth =
    columns === 2 ? (contentWidth - columnGap) / 2 : contentWidth;

  const primaryItems: Array<StatisticsItem & { color: string }> = [
    {
      icon: 'analytics-outline',
      title: t('statistics.advanced', 'Advanced statistics'),
      subtitle: t('statistics.advanced_desc', 'Volume, set, repetition and duration details.'),
      route: 'AdvancedStatisticsScreen',
      color: theme.primary,
    },
    {
      icon: 'body-outline',
      title: t('statistics.muscle_dist', 'Muscle distribution'),
      subtitle: t('statistics.muscle_dist_desc', 'See which muscles you trained.'),
      route: 'MuscleDistribution',
      color: '#3B82F6',
    },
    {
      icon: 'trophy-outline',
      title: t('statistics.records', 'Personal records'),
      subtitle: t('statistics.records_desc', 'Your strongest completed sets.'),
      route: 'LeaderboardScreen',
      color: '#F59E0B',
    },
    {
      icon: 'calendar-outline',
      title: t('statistics.monthly_report', 'Monthly report'),
      subtitle: t('statistics.monthly_desc', 'Calendar, consistency and monthly summary.'),
      route: 'MonthlyReportScreen',
      color: '#8B5CF6',
    },
  ];

  const secondaryItems: StatisticsItem[] = [
    {
      icon: 'barbell-outline',
      title: t('statistics.main_exercises', 'Main exercises'),
      subtitle: t('statistics.main_ex_desc', 'Your most frequently logged movements.'),
      route: 'MainExercisesScreen',
    },
    {
      icon: 'grid-outline',
      title: t('statistics.muscle_dist_body', 'Muscle load grid'),
      subtitle: t('statistics.muscle_body_desc', 'Compare each muscle group’s training share.'),
      route: 'MuscleDistributionBodyScreen',
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScreenHeader
        title={t('statistics.title', 'Statistics')}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          paddingHorizontal: horizontalPadding,
          paddingTop: 16,
          paddingBottom: 36,
        }}
      >
        <Surface
          elevation={0}
          style={{
            padding: 18,
            borderRadius: 18,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
            backgroundColor: theme.surface,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.primarySoft,
              }}
            >
              <Ionicons name="stats-chart-outline" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>
                {t('statistics.overview_title', 'Understand your training')}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 3 }}>
                {t('statistics.overview_subtitle', 'Review volume, consistency, muscle balance and personal records.')}
              </Text>
            </View>
          </View>
        </Surface>

        <View style={{ marginTop: 20, marginBottom: 10 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
            {t('statistics.reports', 'Reports')}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 11.5, marginTop: 3 }}>
            {t('statistics.reports_desc', 'Open a report for detailed training insights.')}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: columnGap }}>
          {primaryItems.map(item => (
            <TouchableOpacity
              key={item.route}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              onPress={() => navigation.navigate(item.route)}
              style={{
                width: cardWidth,
                minHeight: 166,
                padding: 15,
                borderRadius: 16,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.border,
                backgroundColor: theme.surface,
              }}
            >
              <View
                style={{
                  width: 39,
                  height: 39,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${item.color}18`,
                }}
              >
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800', marginTop: 13 }}>
                {item.title}
              </Text>
              <Text numberOfLines={3} style={{ color: theme.textMuted, fontSize: 11, lineHeight: 16, marginTop: 5 }}>
                {item.subtitle}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto', paddingTop: 10 }}>
                <Text style={{ color: item.color, fontSize: 11, fontWeight: '800' }}>
                  {t('statistics.view_details', 'View details')}
                </Text>
                <Ionicons name="arrow-forward" size={13} color={item.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800', marginTop: 22, marginBottom: 10 }}>
          {t('statistics.more_insights', 'More insights')}
        </Text>

        <Surface
          elevation={0}
          style={{
            overflow: 'hidden',
            borderRadius: 14,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
            backgroundColor: theme.surface,
          }}
        >
          {secondaryItems.map((item, index) => (
            <TouchableOpacity
              key={item.route}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              onPress={() => navigation.navigate(item.route)}
              style={{
                minHeight: 72,
                paddingHorizontal: 14,
                paddingVertical: 11,
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: index < secondaryItems.length - 1 ? 1 : 0,
                borderBottomColor: theme.border,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.surfaceLight,
                }}
              >
                <Ionicons name={item.icon} size={19} color={theme.textSecondary} />
              </View>
              <View style={{ flex: 1, paddingHorizontal: 11 }}>
                <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '800' }}>{item.title}</Text>
                <Text numberOfLines={1} style={{ color: theme.textMuted, fontSize: 10.5, marginTop: 3 }}>
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
