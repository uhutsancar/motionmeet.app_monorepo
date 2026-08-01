import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Appbar,
  Surface,
  Text,
} from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import { getPersonalRecords } from '../api/endpoints';
import type { PersonalRecord } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';

const ACCENTS = ['#3b82f6', '#eab308', '#ef4444', '#10b981'];

const LeaderboardScreen = ({ navigation }: NavigationOnlyProps) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { getToken } = useAuthContext();
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadRecords = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const data = await getPersonalRecords(token);
        if (active && data.success) setRecords(data.records || []);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadRecords();
    return () => {
      active = false;
    };
  }, [getToken]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.background, elevation: 0, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Appbar.BackAction accessibilityLabel={t('common.back', 'Back')} onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content title={t('statistics.records', 'Personal Records')} titleStyle={{ fontWeight: '700', fontSize: 17, color: theme.text }} />
      </Appbar.Header>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            width: '100%',
            maxWidth: 720,
            alignSelf: 'center',
            padding: 16,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Surface elevation={0} style={{ backgroundColor: theme.surfaceLight, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: theme.border }}>
            <Text style={{ fontSize: 14, color: theme.textMuted, lineHeight: 20 }}>
              {t('statistics.records_desc', 'Your strongest completed set for each exercise.')}
            </Text>
          </Surface>

          {records.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 64 }}>
              <Ionicons name="trophy-outline" size={48} color={theme.textMuted} />
              <Text style={{ color: theme.text, fontWeight: '800', marginTop: 14 }}>
                {t('statistics.no_records_yet', 'No records yet')}
              </Text>
              <Text style={{ color: theme.textMuted, textAlign: 'center', marginTop: 6 }}>
                {t('statistics.log_more_workouts', 'Complete workouts to see your records here.')}
              </Text>
            </View>
          ) : records.map((record, index) => {
            const accent = ACCENTS[index % ACCENTS.length];
            return (
              <Surface key={record.exerciseId} elevation={1} style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: theme.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12, backgroundColor: `${accent}20` }}>
                    <Ionicons name="trophy-outline" size={22} color={accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={2} style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>{record.name}</Text>
                    <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 3 }}>
                      {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(record.recordedAt))}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', flexShrink: 1, maxWidth: '40%' }}>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                      style={{ color: accent, fontSize: 20, fontWeight: '900' }}
                    >
                      {record.value} kg
                    </Text>
                    <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                      {record.reps} {t('routines.reps', 'reps').toLowerCase()}
                    </Text>
                  </View>
                </View>
              </Surface>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default LeaderboardScreen;
