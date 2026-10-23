import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import KeyboardAwareScrollView from '../components/KeyboardAwareScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface, Text, TextInput, TouchableRipple } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import ScreenHeader from '../components/ScreenHeader';
import type { BodyMeasurement, BodyMeasurementMetric } from '@motionmeet/shared';
import { getMeasurements, saveMeasurement, type SaveMeasurementPayload } from '../api/endpoints';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { MEASUREMENT_METRICS, dayKeyToDate, toDayKey } from '../config/measurements';
import { CARD } from '../config/layout';
import type { NavigationOnlyProps, RouteLike } from '../navigation/types';

interface MeasurementEntryProps extends NavigationOnlyProps {
  route?: RouteLike<{ measurement?: BodyMeasurement }>;
}

type DraftValues = Record<BodyMeasurementMetric, string>;

const emptyDraft = (): DraftValues =>
  Object.fromEntries(MEASUREMENT_METRICS.map(metric => [metric.key, ''])) as DraftValues;

/** An existing entry opens pre-filled so editing a day never wipes the rest. */
const draftFrom = (measurement?: BodyMeasurement): DraftValues => {
  const draft = emptyDraft();
  if (!measurement) return draft;
  for (const metric of MEASUREMENT_METRICS) {
    const value = measurement[metric.key];
    if (typeof value === 'number') draft[metric.key] = `${value}`;
  }
  return draft;
};

/** Accepts both 82.4 and the comma form a Turkish keyboard produces. */
const parseInput = (raw: string): number | null => {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const MeasurementEntryScreen = ({ navigation, route }: MeasurementEntryProps) => {
  const existing = route?.params?.measurement;
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { getToken } = useAuthContext();
  const { horizontalPadding, isNarrow } = useResponsiveLayout();
  const styles = getStyles(theme);

  const [dayKey, setDayKey] = useState<string>(existing?.measuredOn ?? toDayKey(new Date()));
  const [values, setValues] = useState<DraftValues>(() => draftFrom(existing));
  const [note, setNote] = useState<string>(existing?.note ?? '');
  const [saving, setSaving] = useState(false);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }),
    [i18n.language],
  );

  const today = toDayKey(new Date());
  const isToday = dayKey === today;

  // Saving replaces the whole day, so a day that already has values must open
  // pre-filled - otherwise adding today's weight would silently wipe the waist
  // and arm figures logged earlier the same day.
  const loadedDayRef = useRef<string | null>(existing ? existing.measuredOn : null);
  useEffect(() => {
    if (loadedDayRef.current === dayKey) return;
    let active = true;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await getMeasurements(token);
        if (!active) return;
        const sameDay = (response?.measurements ?? []).find(entry => entry.measuredOn === dayKey);
        loadedDayRef.current = dayKey;
        setValues(draftFrom(sameDay));
        setNote(sameDay?.note ?? '');
      } catch {
        // A failed lookup leaves the form as-is; the day simply starts empty.
      }
    })();
    return () => { active = false; };
  }, [dayKey, getToken]);

  const shiftDay = useCallback((days: number) => {
    setDayKey(current => {
      const next = dayKeyToDate(current);
      next.setDate(next.getDate() + days);
      // Measurements can only be logged for a day that has already happened.
      const nextKey = toDayKey(next);
      return nextKey > toDayKey(new Date()) ? current : nextKey;
    });
  }, []);

  const setValue = useCallback((metric: BodyMeasurementMetric, raw: string) => {
    // Digits plus a single separator: the numeric keypad on Android still lets
    // other characters through.
    const cleaned = raw.replace(/[^0-9.,]/g, '').replace(/([.,])(?=.*[.,])/g, '');
    setValues(current => ({ ...current, [metric]: cleaned }));
  }, []);

  const onSave = useCallback(async () => {
    const payload: SaveMeasurementPayload = { measuredOn: dayKey, note: note.trim() };
    let provided = 0;

    for (const metric of MEASUREMENT_METRICS) {
      const parsed = parseInput(values[metric.key]);
      if (parsed === null) continue;
      if (Number.isNaN(parsed) || parsed < metric.min || parsed > metric.max) {
        Toast.show({
          type: 'error',
          text1: t(metric.labelKey, metric.fallback),
          text2: t('measurements.range_error', 'Value must be between {{min}} and {{max}}.', { min: metric.min, max: metric.max }),
        });
        return;
      }
      payload[metric.key] = parsed;
      provided += 1;
    }

    if (provided === 0) {
      Toast.show({
        type: 'error',
        text1: t('measurements.title', 'Measurements'),
        text2: t('measurements.empty_error', 'Enter at least one value before saving.'),
      });
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      await saveMeasurement(payload, token);
      Toast.show({ type: 'success', text1: t('measurements.saved', 'Measurement saved') });
      navigation.goBack();
    } catch {
      Toast.show({
        type: 'error',
        text1: t('measurements.title', 'Measurements'),
        text2: t('measurements.save_error', 'Could not save the measurement. Please try again.'),
      });
    } finally {
      setSaving(false);
    }
  }, [dayKey, getToken, navigation, note, t, values]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={existing ? t('measurements.edit', 'Edit measurement') : t('measurements.add', 'Add measurement')}
        backIcon="close"
        onBack={() => navigation.goBack()}
        textAction={{ label: t('common.save', 'Save'), onPress: () => void onSave(), busy: saving }}
      />

        <KeyboardAwareScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          extraScrollHeight={24}
        >
          <Surface elevation={0} style={styles.dateCard}>
            <TouchableRipple
              borderless
              style={styles.dateArrow}
              accessibilityRole="button"
              accessibilityLabel={t('measurements.previous_day', 'Previous day')}
              onPress={() => shiftDay(-1)}
            >
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </TouchableRipple>
            <View style={styles.dateLabelWrap}>
              <Text style={styles.dateLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {dateFormatter.format(dayKeyToDate(dayKey))}
              </Text>
              <Text style={styles.dateHint}>
                {isToday ? t('measurements.today', 'Today') : t('measurements.past_entry', 'Past entry')}
              </Text>
            </View>
            <TouchableRipple
              borderless
              disabled={isToday}
              style={[styles.dateArrow, isToday && styles.dateArrowDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('measurements.next_day', 'Next day')}
              onPress={() => shiftDay(1)}
            >
              <Ionicons name="chevron-forward" size={20} color={isToday ? theme.textMuted : theme.text} />
            </TouchableRipple>
          </Surface>

          {/* The label sits above the box rather than floating inside it: names
              like "Sağ bacak (cm)" do not fit a half-width outlined input and
              were being clipped away to nothing. */}
          <View style={[styles.grid, isNarrow && styles.gridNarrow]}>
            {MEASUREMENT_METRICS.map(metric => (
              <View key={metric.key} style={[styles.field, isNarrow && styles.fieldNarrow]}>
                <Text style={styles.fieldLabel} numberOfLines={1}>
                  {`${t(metric.labelKey, metric.fallback)} (${metric.unit})`}
                </Text>
                <TextInput
                  mode="outlined"
                  dense
                  value={values[metric.key]}
                  onChangeText={text => setValue(metric.key, text)}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  returnKeyType="done"
                  placeholder="—"
                  style={styles.input}
                  outlineColor={theme.border}
                  activeOutlineColor={theme.primary}
                  textColor={theme.text}
                />
              </View>
            ))}
          </View>

          <Text style={[styles.fieldLabel, styles.noteLabel]}>{t('measurements.note', 'Note')}</Text>
          <TextInput
            mode="outlined"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
            numberOfLines={3}
            style={[styles.input, styles.noteInput]}
            outlineColor={theme.border}
            activeOutlineColor={theme.primary}
            textColor={theme.text}
          />

          <Text style={styles.footnote}>
            {t('measurements.upsert_hint', 'Saving again for the same day updates that entry.')}
          </Text>

        </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: theme.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: theme.text, fontSize: 17, fontWeight: '700' },
  content: { paddingTop: 12, paddingBottom: 132 },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceLight,
    borderRadius: CARD.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  dateArrow: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dateArrowDisabled: { opacity: 0.4 },
  dateLabelWrap: { flex: 1, minWidth: 0, alignItems: 'center' },
  dateLabel: { color: theme.text, fontSize: 14, fontWeight: '700' },
  dateHint: { color: theme.textMuted, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, columnGap: CARD.gap },
  gridNarrow: { columnGap: 8 },
  field: { width: '48%', marginBottom: 12 },
  // Under ~300dp of content two number fields stop being readable side by side.
  fieldNarrow: { width: '100%' },
  fieldLabel: { color: theme.textSecondary, fontSize: 11.5, fontWeight: '700', marginBottom: 4, paddingLeft: 2 },
  noteLabel: { marginTop: 2 },
  input: { backgroundColor: theme.background, fontSize: 14 },
  noteInput: { marginTop: 4, minHeight: 76 },
  footnote: { color: theme.textMuted, fontSize: 11, lineHeight: 16, marginTop: 10 },
  saveButton: { marginTop: 16, borderRadius: 10 },
  saveButtonContent: { height: 48 },
});

export default MeasurementEntryScreen;
