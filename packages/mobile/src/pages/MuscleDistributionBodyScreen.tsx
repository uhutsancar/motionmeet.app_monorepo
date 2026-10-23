import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import { getWorkoutStats } from '../api/endpoints';
import { useMuscleGroups } from '../hooks/useMuscleGroups';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { logHandledError } from '../utils/feedback';
import { formatNumber } from '../utils/format';
import ScreenHeader from '../components/ScreenHeader';
import PillTabs from '../components/ui/PillTabs';
import { NOT_A_MUSCLE } from '../features/stats/muscleAxes';
import type { WorkoutStats } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';

type StatsPeriod = 'week' | 'month' | 'year';

/**
 * Fill strength for each load step, as a hex alpha on the accent: one hue,
 * light to dark. A group with no sets has no fill at all, so the gaps in a
 * week stand out the way untrained muscles do on a body map.
 */
const STEP_ALPHA = ['24', '47', '80', 'E6'];
/** The darkest step carries white text; the lighter ones keep the ink. */
const SOLID_STEP = STEP_ALPHA.length - 1;

const stepOf = (sets: number, most: number): number =>
  sets <= 0 || most <= 0 ? -1 : Math.min(SOLID_STEP, Math.floor((sets / most) * STEP_ALPHA.length - 1e-9));

/**
 * Every muscle group in a fixed order, shaded by the sets it received.
 *
 * The distribution screen already ranks the groups; this one answers the
 * other question - what did I leave out? - so the order never changes and
 * zero is shown as zero. Replaces a grid of identical icon tiles coloured
 * red, orange and yellow by thresholds nobody could read back.
 */
const MuscleDistributionBodyScreen = ({ navigation }: NavigationOnlyProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { theme } = useTheme();
  const { getToken } = useAuthContext();
  const { columns } = useResponsiveLayout();
  const { data: muscleGroups, isLoading: musclesLoading } = useMuscleGroups();
  const [period, setPeriod] = useState<StatsPeriod>('week');
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setFailed(false);
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const data = await getWorkoutStats(period, token);
        if (active) setStats(data.success ? data : null);
      } catch (error) {
        logHandledError('load-muscle-grid', error);
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [getToken, period]);

  const cells = (muscleGroups as Array<{ code: string; name: string }>)
    .map((group) => ({
      key: group.code,
      label: String(t(`muscle_groups.${group.code}`, group.name || group.code)),
      sets: stats?.muscleSets?.[group.code] ?? 0,
    }))
    // Cardio and full-body work are not muscles a week can leave out, so
    // they appear only when something was logged under them.
    .filter((cell) => !NOT_A_MUSCLE.has(cell.key) || cell.sets > 0);
  const most = Math.max(0, ...cells.map((cell) => cell.sets));
  const idle = cells.filter((cell) => cell.sets === 0);
  const perRow = columns >= 2 ? 3 : 2;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('statistics.muscle_dist_body', 'Kas yükü tablosu')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PillTabs
          tabs={[
            { key: 'week', label: t('statistics.last_7_days', 'Son 7 gün') },
            { key: 'month', label: t('statistics.last_30_days', 'Son 30 gün') },
            { key: 'year', label: t('statistics.last_year', 'Son 12 ay') },
          ]}
          selected={period}
          onSelect={setPeriod}
        />

        {loading || musclesLoading ? (
          <View style={styles.state}><ActivityIndicator color={theme.textMuted} /></View>
        ) : failed ? (
          <Text style={[styles.lead, { color: theme.textMuted }]}>{t('stats.load_failed', 'İstatistikler yüklenemedi.')}</Text>
        ) : (
          <>
            <Text style={[styles.lead, { color: theme.textSecondary }]}>
              {most === 0
                ? t('stats.no_sets_period', 'Bu dönemde tamamlanmış set yok.')
                : idle.length === 0
                  ? t('stats.muscle_load_all', 'Bu dönemde bütün kas grupları çalıştı.')
                  : t('stats.muscle_load_idle', {
                      names: idle.map((cell) => cell.label).join(', '),
                      defaultValue: 'Hiç set almayanlar: {{names}}.',
                    })}
            </Text>

            <View style={styles.grid}>
              {cells.map((cell) => {
                const step = stepOf(cell.sets, most);
                const solid = step === SOLID_STEP;
                return (
                  <View
                    key={cell.key}
                    accessible
                    accessibilityLabel={`${cell.label}, ${t('monthly_report.sets_count', { count: cell.sets, defaultValue: '{{count}} set' })}`}
                    style={[
                      styles.cell,
                      { width: `${100 / perRow}%` },
                    ]}
                  >
                    <View
                      style={[
                        styles.fill,
                        step < 0
                          ? { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }
                          : { backgroundColor: theme.primary + STEP_ALPHA[step] },
                      ]}
                    >
                      <Text numberOfLines={1} style={[styles.cellLabel, { color: solid ? '#FFFFFF' : theme.text }]}>
                        {cell.label}
                      </Text>
                      <Text style={[styles.cellValue, { color: solid ? '#FFFFFF' : step < 0 ? theme.textMuted : theme.text }]}>
                        {formatNumber(cell.sets, language)}
                        <Text style={styles.cellUnit}> {t('monthly_report.chart_unit_sets', 'set')}</Text>
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.scale} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={[styles.scaleLabel, { color: theme.textMuted }]}>{t('stats.scale_less', 'Az')}</Text>
              {STEP_ALPHA.map((alpha) => (
                <View key={alpha} style={[styles.swatch, { backgroundColor: theme.primary + alpha }]} />
              ))}
              <Text style={[styles.scaleLabel, { color: theme.textMuted }]}>{t('stats.scale_more', 'Çok')}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 40 },
  lead: { fontSize: 14, lineHeight: 20, paddingHorizontal: 16, marginTop: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 13, marginTop: 14 },
  cell: { padding: 3 },
  fill: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, minHeight: 72, justifyContent: 'space-between' },
  cellLabel: { fontSize: 13.5, fontWeight: '600' },
  cellValue: { fontSize: 17, fontWeight: '700', marginTop: 6, fontVariant: ['tabular-nums'] },
  cellUnit: { fontSize: 12.5, fontWeight: '500' },
  scale: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, marginTop: 14 },
  scaleLabel: { fontSize: 12, marginHorizontal: 4 },
  swatch: { width: 18, height: 10, borderRadius: 2 },
  state: { height: 240, alignItems: 'center', justifyContent: 'center' },
});

export default MuscleDistributionBodyScreen;
