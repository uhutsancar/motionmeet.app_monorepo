import React from 'react';
import { View, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { Surface, Text, IconButton, Button, Appbar, Card } from 'react-native-paper';

const LeaderboardScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  
  // Dummy data to fulfill "no empty screens" requirement with premium aesthetics
  const leaderboards = [
      { id: 1, name: t('statistics.ex_bench_press', 'Bench Press'), icon: 'barbell', topScore: '145 kg', users: 1240, color: '#3b82f6' },
      { id: 2, name: t('statistics.ex_squat', 'Squat'), icon: 'body', topScore: '210 kg', users: 950, color: '#eab308' },
      { id: 3, name: t('statistics.ex_deadlift', 'Deadlift'), icon: 'fitness', topScore: '240 kg', users: 1120, color: '#ef4444' },
      { id: 4, name: t('statistics.ex_pullup', 'Pull-up'), icon: 'caret-up-circle', topScore: '45 reps', users: 3400, color: '#10b981' }
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <Appbar.Header style={{ backgroundColor: theme.background, elevation: 0, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content title={t('statistics.leaderboard', 'Lider Tablosu')} titleStyle={{ fontWeight: '700', fontSize: 17, color: theme.text }} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Surface elevation={0} style={{ backgroundColor: theme.surfaceLight, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: theme.border, alignItems: 'flex-start' }}>
              <View style={{ backgroundColor: '#eab308', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginBottom: 8 }}>
                  <Text style={{ color: isDark ? '#000' : '#fff', fontSize: 10, fontWeight: '900' }}>PRO</Text>
              </View>
              <Text style={{ fontSize: 14, color: theme.textMuted, lineHeight: 20 }}>{t('statistics.leaderboard_desc', 'Lider tablosuna uygun egzersizlerin listesi.')}</Text>
          </Surface>
          
          <View style={{ paddingBottom: 20 }}>
             {leaderboards.map((item, index) => (
                <Surface key={item.id} elevation={2} style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 20, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                        <View style={{ width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12, backgroundColor: item.color + '20' }}>
                            <Ionicons name={item.icon} size={24} color={item.color} />
                        </View>
                        <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.text }}>{item.name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 10 }}>
                        <View style={{ alignItems: 'center' }}>
                            <Text variant="labelSmall" style={{ color: theme.textMuted, marginBottom: 4 }}>{t('statistics.top_score', 'Top Score')}</Text>
                            <Text variant="titleMedium" style={{ fontWeight: '800', color: theme.text }}>{item.topScore}</Text>
                        </View>
                        <View style={{ alignItems: 'center' }}>
                            <Text variant="labelSmall" style={{ color: theme.textMuted, marginBottom: 4 }}>{t('statistics.participants', 'Participants')}</Text>
                            <Text variant="titleMedium" style={{ fontWeight: '800', color: theme.text }}>{item.users.toLocaleString()}</Text>
                        </View>
                    </View>
                    <Button 
                        mode="contained" 
                        buttonColor={item.color} 
                        textColor="#fff" 
                        style={{ borderRadius: 12 }} 
                        contentStyle={{ paddingVertical: 4 }}
                        labelStyle={{ fontSize: 15, fontWeight: '700' }}
                    >
                        {t('statistics.view_rankings', 'View Rankings')}
                    </Button>
                </Surface>
             ))}
          </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LeaderboardScreen;
