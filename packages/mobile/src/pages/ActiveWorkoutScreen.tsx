import React, { useState, useEffect, useRef } from 'react';
import { View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Surface, TextInput, Button, IconButton, TouchableRipple } from 'react-native-paper';
const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/AuthProvider';
import { getExerciseHistory } from '../api/endpoints';
import { logHandledError } from '../utils/feedback';
import { useTheme } from '../context/ThemeContext';
import ExercisePickerModal from '../components/ExercisePickerModal';
import KeyboardAwareScrollView from '../components/KeyboardAwareScrollView';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { CARD, EXERCISE_THUMB, exerciseThumbStyle } from '../config/layout';
import type { Exercise, ExerciseSessionEntry, ExerciseSet } from '@motionmeet/shared';
import { resolvePublicMediaUrl } from '@motionmeet/shared';
import type { ActiveWorkoutExercise, WorkoutSummaryData } from '../types/workoutDraft';
import { API_URL } from '../config/environment';
import { Image } from 'expo-image';
import type { NavigationProp, ParamListBase, RouteProp } from '@react-navigation/native';

interface IncomingRoutineExercise {
  exerciseId?: string | Exercise | null;
  id?: string;
  _id?: string;
  exerciseName?: string;
  name?: string;
  muscleGroup?: string;
  equipment?: string;
  sets: Array<Partial<ExerciseSet> & { reps?: number | string; weight?: number | string }>;
}
interface IncomingRoutine { name?: string; exercises?: IncomingRoutineExercise[] }
type PreviousSet = ExerciseSessionEntry['sets'][number];
interface ActiveWorkoutProps { navigation: NavigationProp<ParamListBase>; route: RouteProp<ParamListBase> }

const ActiveWorkoutScreen = ({ navigation, route }: ActiveWorkoutProps) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { getToken } = useAuthContext();
  const kbAppearance = isDark ? 'dark' : 'light';
  const { horizontalPadding, isNarrow } = useResponsiveLayout();
  const setFieldWidth = isNarrow ? 46 : 56;
  const setRowGap = isNarrow ? 4 : 8;
  // Completed rows use a solid accent band, matching the logging apps athletes
  // are used to, so a finished set is unmistakable at a glance.
  const doneGreen = isDark ? '#1B5E20' : '#DCF5DD';
  const doneText = isDark ? '#FFFFFF' : '#12551A';

  const routeParams = route.params as { routine?: IncomingRoutine } | undefined;
  const routine = routeParams?.routine;

  // Initialize exercises from routine or empty
  const [exercises, setExercises] = useState<ActiveWorkoutExercise[]>(() => {
    if (routine?.exercises?.length) {
      return routine.exercises.map(e => {
        const exercise = typeof e.exerciseId === 'object' ? e.exerciseId : null;
        return {
        id: exercise?._id || (typeof e.exerciseId === 'string' ? e.exerciseId : '') || e.id || e._id || '',
        name: exercise?.name || e.exerciseName || e.name || 'Exercise',
        muscleGroup: exercise?.muscleGroup || e.muscleGroup || '',
        equipment: exercise?.equipment || e.equipment || '',
        imageUrl: resolvePublicMediaUrl(exercise?.gifUrl || exercise?.imageUrl, API_URL) ?? undefined,
        sets: e.sets.map(s => ({
          reps: s.reps ? String(s.reps) : '',
          weight: s.weight ? String(s.weight) : '',
          done: false,
          setType: s.setType || 'normal'
        }))
      }});
    }
    return [];
  });

  const [workoutName, setWorkoutName] = useState(routine?.name || t('workout.my_workout', 'Antrenmanım'));
  const [workoutNote, setWorkoutNote] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  
  // ── Real Timer ───────────────────────────────────────────────────
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Previous performance ─────────────────────────────────────────
  // The last logged session per exercise fills the "previous" column so the
  // athlete can see what to beat without leaving the screen.
  const [previousSets, setPreviousSets] = useState<Record<string, PreviousSet[]>>({});
  const requestedPreviousRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pending = exercises
      .map((exercise) => exercise.id)
      .filter((id): id is string => Boolean(id) && !requestedPreviousRef.current.has(id));
    if (pending.length === 0) return;
    pending.forEach((id) => requestedPreviousRef.current.add(id));

    let cancelled = false;
    const loadPrevious = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const entries = await Promise.all(pending.map(async (id) => {
          try {
            const data = await getExerciseHistory(id, token, 1);
            return [id, data.success ? (data.history[0]?.sets ?? []) : []] as const;
          } catch {
            return [id, [] as PreviousSet[]] as const;
          }
        }));
        if (!cancelled) setPreviousSets((current) => ({ ...current, ...Object.fromEntries(entries) }));
      } catch (error) {
        logHandledError('load-previous-sets', error);
      }
    };
    void loadPrevious();
    return () => { cancelled = true; };
  }, [exercises, getToken]);



  // ── Dynamic Stats ────────────────────────────────────────────────
  const totalVolume = exercises.reduce((total, ex) =>
    total + ex.sets.filter(s => s.done).reduce((t, s) =>
      t + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0), 0
  );

  const totalSets = exercises.reduce((t, ex) => t + ex.sets.filter(s => s.done).length, 0);

  // ── Set Operations ────────────────────────────────────────────────
  const addSet = (exIndex: number) => {
    const newEx = [...exercises];
    newEx[exIndex].sets.push({ reps: '', weight: '', done: false, setType: 'normal' });
    setExercises(newEx);
  };

  const toggleSet = (exIndex: number, setIndex: number) => {
    const newEx = [...exercises];
    newEx[exIndex].sets[setIndex].done = !newEx[exIndex].sets[setIndex].done;
    setExercises(newEx);
  };

  const updateSetField = (exIndex: number, setIndex: number, field: 'reps' | 'weight', val: string) => {
    const newEx = [...exercises];
    newEx[exIndex].sets[setIndex][field] = val;
    setExercises(newEx);
  };

  const removeExercise = (exIndex: number) => {
    const newEx = [...exercises];
    newEx.splice(exIndex, 1);
    setExercises(newEx);
  };

  const addExercise = (exercise: Exercise) => {
    setExercises((current) => {
      if (current.some((item) => item.id === exercise._id)) return current;
      return [
        ...current,
        {
          id: exercise._id,
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          equipment: exercise.equipment,
          imageUrl: resolvePublicMediaUrl(exercise.gifUrl || exercise.imageUrl, API_URL) ?? undefined,
          sets: [{ reps: '', weight: '', done: false, setType: 'normal' }],
        },
      ];
    });
  };

  // ── Finish ────────────────────────────────────────────────────────
  const handleFinish = () => {
    if (totalSets === 0) {
      Alert.alert(
        t('common.error', 'Error'),
        t('active_workout.complete_one_set', 'Complete at least one set before finishing.')
      );
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    const workoutData: WorkoutSummaryData = {
      name: workoutName,
      note: workoutNote,
      duration: elapsedSeconds,
      totalVolume: Math.round(totalVolume),
      totalSets: totalSets,
      exercises: exercises.map(ex => ({
        exerciseId: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        equipment: ex.equipment,
        imageUrl: ex.imageUrl,
        sets: ex.sets.filter(s => s.done).map(s => ({
          setType: s.setType || 'normal',
          weight: parseFloat(s.weight) || 0,
          reps: parseInt(s.reps) || 0,
          completed: s.done
        }))
      })).filter(ex => ex.sets.length > 0)
    };
    navigation.navigate('WorkoutSummaryScreen', { workoutData });
  };

  const handleCancel = () => {
    Alert.alert(
      t('workout.cancel_workout', 'Antrenmanı İptal Et'),
      t('workout.cancel_confirm', 'Bu antrenmanı iptal etmek istiyor musun? Kaydedilmeyecek.'),
      [
        { text: t('common.no', 'Hayır'), style: 'cancel' },
        { text: t('common.yes', 'Evet'), style: 'destructive', onPress: () => {
          if (timerRef.current) clearInterval(timerRef.current);
          navigation.goBack();
        }}
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <Surface elevation={2} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8, backgroundColor: theme.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <IconButton icon="chevron-down" size={28} iconColor={theme.text} onPress={() => navigation.goBack()} accessibilityLabel={t('common.close', 'Close workout')} />
          <View style={{ marginLeft: 4 }}>
            <Text variant="titleLarge" style={{ fontWeight: '900', color: theme.text, fontVariant: ['tabular-nums'] }}>{formatTime(elapsedSeconds)}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
              <Text variant="labelSmall" style={{ color: theme.textMuted }}>Hacim <Text style={{ color: theme.text, fontWeight: 'bold' }}>{totalVolume.toFixed(0)} kg</Text></Text>
              <Text variant="labelSmall" style={{ color: theme.textMuted }}>Set <Text style={{ color: theme.text, fontWeight: 'bold' }}>{totalSets}</Text></Text>
            </View>
          </View>
        </View>
        <Button mode="contained" onPress={handleFinish} disabled={totalSets === 0} style={{ borderRadius: 12, marginRight: 8 }} labelStyle={{ fontWeight: 'bold' }}>
          {t('workout.finish', 'Bitir')}
        </Button>
      </Surface>

        <KeyboardAwareScrollView
          contentContainerStyle={{
            width: '100%',
            maxWidth: 720,
            alignSelf: 'center',
            paddingHorizontal: horizontalPadding,
            paddingBottom: 40,
            paddingTop: 16,
          }}
          extraScrollHeight={28}
          showsVerticalScrollIndicator={false}
        >
        
        {/* Title */}
        <TextInput
          mode="flat"
          value={workoutName}
          onChangeText={setWorkoutName}
          placeholder={t('workout.name_placeholder', 'Antrenman Adı')}
          style={{ backgroundColor: 'transparent', fontSize: 24, fontWeight: 'bold', marginBottom: 8, paddingHorizontal: 0 }}
          textColor={theme.text}
          placeholderTextColor={theme.textMuted}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          accessibilityLabel={t('workout.name_placeholder', 'Workout name')}
        />

        <TextInput
          mode="outlined"
          placeholder={t('workout.add_workout_note', 'Antrenman notu ekle')}
          value={workoutNote}
          onChangeText={setWorkoutNote}
          style={{ backgroundColor: theme.surfaceLight, width: '100%', minWidth: 0, fontSize: 14, marginBottom: 14 }}
          textColor={theme.text}
          placeholderTextColor={theme.textMuted}
          outlineStyle={{ borderColor: 'transparent', borderRadius: 12 }}
          accessibilityLabel={t('workout.add_workout_note', 'Workout note')}
        />

        {exercises.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="barbell-outline" size={48} color={theme.border} />
            <Text style={{ color: theme.textMuted, marginTop: 12, textAlign: 'center' }}>
              {t('workout.no_exercises_yet', 'Egzersiz eklenmedi')}
            </Text>
          </View>
        )}

        {/* Exercises */}
        {exercises.map((ex, exIndex) => (
          <Surface key={exIndex} elevation={0} style={{ marginBottom: 12, borderRadius: CARD.radius, padding: isNarrow ? 10 : CARD.padding, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
                {ex.imageUrl ? (
                  <Image
                    source={{ uri: ex.imageUrl }}
                    style={{ ...exerciseThumbStyle(EXERCISE_THUMB.medium), marginRight: 10, backgroundColor: '#FFFFFF' }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{ ...exerciseThumbStyle(EXERCISE_THUMB.medium), marginRight: 10, backgroundColor: theme.surfaceLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="barbell" size={22} color={theme.textMuted} />
                  </View>
                )}
                <Text
                  variant="titleMedium"
                  numberOfLines={2}
                  style={{ flex: 1, color: theme.primary, fontWeight: 'bold' }}
                >
                  {ex.name}
                </Text>
              </View>
              <IconButton
                icon="dots-horizontal"
                size={20}
                iconColor={theme.textMuted}
                onPress={() => {
                  Alert.alert(ex.name, '', [
                    { text: t('common.cancel', 'İptal'), style: 'cancel' },
                    { text: t('workout.remove_exercise', 'Kaldır'), style: 'destructive', onPress: () => removeExercise(exIndex) }
                  ]);
                }}
                accessibilityLabel={t('workout.exercise_actions', { name: ex.name, defaultValue: `${ex.name} actions` })}
              />
            </View>

            {ex.muscleGroup ? (
              <Text variant="bodySmall" style={{ color: theme.textMuted, marginBottom: 10 }}>{ex.muscleGroup} • {ex.equipment}</Text>
            ) : null}

            {/* Sets header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: setRowGap, marginBottom: 6, paddingHorizontal: 4 }}>
              <Text variant="labelSmall" style={{ color: theme.textMuted, fontWeight: '700', width: 28, textAlign: 'center' }}>
                {t('workout.set_column', 'SET')}
              </Text>
              <Text variant="labelSmall" numberOfLines={1} style={{ color: theme.textMuted, fontWeight: '700', flex: 1, minWidth: 0, textAlign: 'center' }}>
                {t('workout.previous_column', 'ÖNCEKİ')}
              </Text>
              <Text variant="labelSmall" style={{ color: theme.textMuted, fontWeight: '700', width: setFieldWidth, textAlign: 'center' }}>
                {t('common.kg', 'KG')}
              </Text>
              <Text variant="labelSmall" numberOfLines={1} style={{ color: theme.textMuted, fontWeight: '700', width: setFieldWidth, textAlign: 'center' }}>
                {t('workout.reps_column', 'TEKRAR')}
              </Text>
              <View style={{ width: 30, alignItems: 'center' }}>
                <Ionicons name="checkmark" size={16} color={theme.textMuted} />
              </View>
            </View>

            {ex.sets.map((s, setIndex) => {
              const previous = previousSets[ex.id]?.[setIndex];
              const previousLabel = previous
                ? `${previous.weight}${t('common.kg', 'kg')} x ${previous.reps}`
                : '—';
              return (
              <View key={setIndex} style={{ flexDirection: 'row', alignItems: 'center', gap: setRowGap, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 8, backgroundColor: s.done ? doneGreen : 'transparent', marginBottom: 3 }}>
                <View style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: s.done ? doneText : theme.text, fontWeight: '700' }}>{setIndex + 1}</Text>
                </View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 12, color: s.done ? doneText : theme.textMuted }}
                >
                  {previousLabel}
                </Text>
                <TextInput
                  mode="outlined"
                  dense
                  keyboardType="numeric"
                  placeholder="-"
                  value={s.weight}
                  onChangeText={(val) => updateSetField(exIndex, setIndex, 'weight', val)}
                  keyboardAppearance={kbAppearance}
                  style={{ width: setFieldWidth, textAlign: 'center', backgroundColor: s.done ? 'transparent' : theme.background, height: 36 }}
                  textColor={s.done ? doneText : theme.text}
                  placeholderTextColor={theme.textMuted}
                  outlineStyle={{ borderColor: 'transparent', borderRadius: 8 }}
                  accessibilityLabel={t('workout.set_weight', { set: setIndex + 1, defaultValue: `Set ${setIndex + 1} weight` })}
                />
                <TextInput
                  mode="outlined"
                  dense
                  keyboardType="numeric"
                  placeholder="-"
                  value={s.reps}
                  onChangeText={(val) => updateSetField(exIndex, setIndex, 'reps', val)}
                  keyboardAppearance={kbAppearance}
                  style={{ width: setFieldWidth, textAlign: 'center', backgroundColor: s.done ? 'transparent' : theme.background, height: 36 }}
                  textColor={s.done ? doneText : theme.text}
                  placeholderTextColor={theme.textMuted}
                  outlineStyle={{ borderColor: 'transparent', borderRadius: 8 }}
                  accessibilityLabel={t('workout.set_reps', { set: setIndex + 1, defaultValue: `Set ${setIndex + 1} reps` })}
                />
                <TouchableRipple
                  style={{ width: 30, height: 30, borderRadius: 7, backgroundColor: s.done ? '#22A06B' : theme.background, justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => toggleSet(exIndex, setIndex)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: s.done }}
                  accessibilityLabel={t('workout.complete_set', { set: setIndex + 1, defaultValue: `Complete set ${setIndex + 1}` })}
                  borderless
                >
                  <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark" size={16} color={s.done ? '#fff' : theme.textMuted} />
                  </View>
                </TouchableRipple>
              </View>
              );
            })}

            <TouchableRipple
              onPress={() => addSet(exIndex)}
              style={{ marginTop: 8, minHeight: 38, borderRadius: 8, backgroundColor: theme.surfaceLight, alignItems: 'center', justifyContent: 'center' }}
              accessibilityRole="button"
              accessibilityLabel={t('workout.add_set', 'Set Ekle')}
              borderless
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="add" size={16} color={theme.text} />
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>{t('workout.add_set', 'Set Ekle')}</Text>
              </View>
            </TouchableRipple>
          </Surface>
        ))}

        <Button
            mode="outlined"
            icon="plus"
            onPress={() => setPickerVisible(true)}
            style={{ borderRadius: 14, marginBottom: 12, borderStyle: 'dashed' }}
            contentStyle={{ minHeight: 50 }}
            textColor={theme.primary}
        >
            {t('active_workout.add_exercise', 'Egzersiz Ekle')}
        </Button>

        <Surface elevation={0} style={{ borderRadius: 14, backgroundColor: theme.surface, marginTop: 4, marginBottom: 16 }}>
          <Button
              mode="text"
              textColor="#ef4444"
              onPress={handleCancel}
              style={{ borderRadius: 14 }}
              contentStyle={{ minHeight: 50 }}
              labelStyle={{ fontWeight: 'bold' }}
          >
              {t('workout.cancel_workout', 'Antrenmanı İptal Et')}
          </Button>
        </Surface>
        </KeyboardAwareScrollView>
      <ExercisePickerModal
        visible={pickerVisible}
        onDismiss={() => setPickerVisible(false)}
        onSelect={addExercise}
        excludedIds={exercises.map((exercise) => exercise.id)}
      />
    </SafeAreaView>
  );
};

export default ActiveWorkoutScreen;
