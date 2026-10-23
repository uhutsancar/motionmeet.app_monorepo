import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import { getPersonalRecords } from '../api/endpoints';
import ScreenHeader from '../components/ScreenHeader';
import dayjs from '../utils/dayjs';
import { logHandledError } from '../utils/feedback';
import { capitalizeFirst, formatNumber, formatWeight } from '../utils/format';
import type { PersonalRecord } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';

/**
 * The heaviest completed set for each movement, newest record first.
 *
 * Sorted by date rather than weight: ranking a deadlift against a curl says
 * nothing, while "what did I just beat" is the question a person opens this
 * with. Each row is the movement and the set itself - weight, then reps -
 * in text colours only; the old trophy badges cycled four colours that meant
 * nothing.
 */
const LeaderboardScreen = ({ navigation }: NavigationOnlyProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const { getToken } = useAuthContext();
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const loadRecords = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const data = await getPersonalRecords(token);
        if (active && data.success) setRecords(data.records || []);
      } catch (error) {
        logHandledError('load-personal-records', error);
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadRecords();
    return () => {
      active = false;
    };
  }, [getToken]);

  const sorted = useMemo(
    () => [...records].sort((left, right) => dayjs(right.recordedAt).valueOf() - dayjs(left.recordedAt).valueOf()),
    [records],
  );
  const latest = sorted[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('statistics.records', 'Kişisel rekorlar')} onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.state}><ActivityIndicator color={theme.textMuted} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.lead, { color: theme.textSecondary }]}>
            {failed
              ? t('stats.load_failed', 'İstatistikler yüklenemedi.')
              : latest
                ? t('stats.records_lead', {
                    count: sorted.length,
                    date: dayjs(latest.recordedAt).format('D MMMM'),
                    defaultValue: '{{count}} harekette rekorun var. Sonuncusu {{date}} tarihinde.',
                  })
                : t('statistics.log_more_workouts', 'Rekorlarını burada görmek için antrenman tamamla.')}
          </Text>

          {sorted.length > 0 && (
            <View style={[styles.list, { borderTopColor: theme.border }]}>
              {sorted.map((record) => (
                <View key={record.exerciseId} style={[styles.row, { borderBottomColor: theme.border }]}>
                  <View style={styles.name}>
                    <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
                      {capitalizeFirst(record.name, language)}
                    </Text>
                    <Text style={[styles.date, { color: theme.textMuted }]}>
                      {dayjs(record.recordedAt).format('D MMM YYYY')}
                    </Text>
                  </View>
                  <Text style={[styles.weight, { color: theme.text }]}>
                    {formatWeight(record.value, language)}
                    <Text style={[styles.unit, { color: theme.textMuted }]}> kg</Text>
                    <Text style={[styles.reps, { color: theme.textSecondary }]}>  × {formatNumber(record.reps, language)}</Text>
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 40 },
  lead: { fontSize: 14, lineHeight: 20, paddingHorizontal: 16, paddingTop: 8 },
  list: { marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600' },
  date: { fontSize: 12.5, marginTop: 3 },
  weight: { fontSize: 15.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 13, fontWeight: '500' },
  reps: { fontSize: 14, fontWeight: '600' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default LeaderboardScreen;
