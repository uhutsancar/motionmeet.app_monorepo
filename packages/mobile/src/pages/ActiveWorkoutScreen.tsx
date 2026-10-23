// React Native's Image is used on purpose: Expo Go ships its own native
// expo-image build, and when it disagrees with the version installed here the
// view renders blank instead of erroring, so exercise photos and GIFs vanish.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Image, View, Alert, AppState, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput, IconButton, TouchableRipple } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/AuthProvider';
import { getExerciseHistory } from '../api/endpoints';
import { logHandledError, showInfo } from '../utils/feedback';
import { exerciseMeta, exerciseTitle } from '../utils/exerciseLabels';
import { formatNumber, formatWeight } from '../utils/format';
import { useTheme } from '../context/ThemeContext';
import { useAppSelector } from '../store/hooks';
import SoftButton from '../components/ui/SoftButton';
import ExercisePickerModal from '../components/ExercisePickerModal';
import KeyboardAwareScrollView from '../components/KeyboardAwareScrollView';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { EXERCISE_THUMB, exerciseThumbStyle } from '../config/layout';
import type { Exercise, ExerciseSessionEntry, ExerciseSet } from '@motionmeet/shared';
import { createOperationId, elapsedWorkoutSeconds, parseDecimalInput, resolvePublicMediaUrl } from '@motionmeet/shared';
import type { ActiveWorkoutExercise, ActiveWorkoutSet, WorkoutSummaryData } from '../types/workoutDraft';
import {
  clearActiveWorkoutDraft,
  createActiveWorkoutDraft,
  loadActiveWorkoutDraft,
  saveActiveWorkoutDraft,
  updateActiveWorkoutDraft,
  type ActiveWorkoutDraft,
} from '../features/workout/activeWorkoutDraft';
import { API_URL } from '../config/environment';
import type { NavigationProp, ParamListBase, RouteProp } from '@react-navigation/native';

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/** How long typing may pause before the draft is written to storage. */
const DRAFT_SAVE_DELAY_MS = 400;

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

const exercisesFromRoutine = (routine: IncomingRoutine | undefined): ActiveWorkoutExercise[] =>
  (routine?.exercises ?? []).map((entry) => {
    const exercise = typeof entry.exerciseId === 'object' ? entry.exerciseId : null;
    return {
      id: exercise?._id || (typeof entry.exerciseId === 'string' ? entry.exerciseId : '') || entry.id || entry._id || '',
      name: exercise?.name || entry.exerciseName || entry.name || 'Exercise',
      muscleGroup: exercise?.muscleGroup || entry.muscleGroup || '',
      equipment: exercise?.equipment || entry.equipment || '',
      imageUrl: resolvePublicMediaUrl(exercise?.gifUrl || exercise?.imageUrl, API_URL) ?? undefined,
      sets: entry.sets.map((set) => ({
        reps: set.reps ? String(set.reps) : '',
        weight: set.weight ? String(set.weight) : '',
        done: false,
        setType: set.setType || 'normal',
      })),
    };
  });

const repsOf = (set: ActiveWorkoutSet): number => Math.round(parseDecimalInput(set.reps) ?? 0);
const weightOf = (set: ActiveWorkoutSet): number => parseDecimalInput(set.weight) ?? 0;

const ActiveWorkoutScreen = ({ navigation, route }: ActiveWorkoutProps) => {
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const { getToken } = useAuthContext();
  const ownerId = useAppSelector((state) => state.user.value?._id ?? null);
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

  const [exercises, setExercises] = useState<ActiveWorkoutExercise[]>([]);
  const [workoutName, setWorkoutName] = useState('');
  const [workoutNote, setWorkoutNote] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  /**
   * Identity and start time of the session on screen. Null until the stored
   * draft has been read, so nothing is written over it before then.
   */
  const [session, setSession] = useState<Pick<ActiveWorkoutDraft, 'draftId' | 'startedAt' | 'saveOperationId'> | null>(null);

  const applyDraft = useCallback((draft: ActiveWorkoutDraft) => {
    setExercises(draft.exercises);
    setWorkoutName(draft.name);
    setWorkoutNote(draft.note);
    setSession({ draftId: draft.draftId, startedAt: draft.startedAt, saveOperationId: draft.saveOperationId });
  }, []);

  // ── Restore or start ─────────────────────────────────────────────
  // A routine passed in means "start this"; no routine means "carry on".
  // Starting while another workout is unfinished asks first instead of
  // silently replacing the one that already has sets in it.
  const restoredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ownerId || restoredForRef.current === ownerId) return;
    restoredForRef.current = ownerId;
    const startFresh = () => {
      const draft = createActiveWorkoutDraft(ownerId, routine?.name || t('workout.my_workout', 'Antrenmanım'), exercisesFromRoutine(routine));
      applyDraft(draft);
      void saveActiveWorkoutDraft(draft).catch((error) => logHandledError('save-workout-draft', error));
    };
    loadActiveWorkoutDraft(ownerId)
      .then((stored) => {
        if (!stored) return startFresh();
        if (!routine) return applyDraft(stored);
        Alert.alert(
          t('active_workout.unfinished_title', 'Devam eden bir antrenmanın var'),
          t('active_workout.unfinished_body', { name: stored.name, defaultValue: '"{{name}}" henüz bitmedi. Ona devam edebilir ya da silip yenisini başlatabilirsin.' }),
          [
            { text: t('active_workout.resume', 'Devam et'), onPress: () => applyDraft(stored) },
            { text: t('active_workout.discard_and_start', 'Sil ve yenisini başlat'), style: 'destructive', onPress: startFresh },
          ],
          { cancelable: false },
        );
      })
      .catch((error) => {
        logHandledError('load-workout-draft', error);
        startFresh();
      });
  }, [applyDraft, ownerId, routine, t]);

  // ── Persist ──────────────────────────────────────────────────────
  const latestDraftRef = useRef<ActiveWorkoutDraft | null>(null);
  latestDraftRef.current = session && ownerId
    ? { version: 1, ownerId, ...session, updatedAt: Date.now(), name: workoutName, note: workoutNote, exercises }
    : null;

  const flushDraft = useCallback(() => {
    const draft = latestDraftRef.current;
    if (draft) void updateActiveWorkoutDraft(draft).catch((error) => logHandledError('save-workout-draft', error));
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    const timer = setTimeout(flushDraft, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [exercises, flushDraft, session, workoutName, workoutNote]);

  // The OS may kill a backgrounded app without warning, so the pending write
  // cannot wait for the debounce.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushDraft();
    });
    return () => {
      subscription.remove();
      flushDraft();
    };
  }, [flushDraft]);

  // ── Timer ────────────────────────────────────────────────────────
  // Always derived from the start instant, so it is right after a restore,
  // a locked screen or the app coming back from the background.
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startedAt = session?.startedAt ?? null;
  useEffect(() => {
    if (startedAt === null) return undefined;
    setElapsedSeconds(elapsedWorkoutSeconds(startedAt));
    const timer = setInterval(() => setElapsedSeconds(elapsedWorkoutSeconds(startedAt)), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  // ── Previous performance ─────────────────────────────────────────
  // The last logged session per exercise fills the "previous" column so the
  // athlete can see what to beat without leaving the screen. Keyed on the
  // exercise ids only, so typing into a set does not refetch or drop a
  // request that is still on its way; an id whose request failed is forgotten
  // so the next change can try it again.
  const [previousSets, setPreviousSets] = useState<Record<string, PreviousSet[]>>({});
  const requestedPreviousRef = useRef<Set<string>>(new Set());
  const exerciseIdsKey = exercises.map((exercise) => exercise.id).join('|');

  useEffect(() => {
    const pending = exerciseIdsKey
      .split('|')
      .filter((id) => Boolean(id) && !requestedPreviousRef.current.has(id));
    if (pending.length === 0) return;
    pending.forEach((id) => requestedPreviousRef.current.add(id));

    const loadPrevious = async () => {
      const token = await getToken();
      const entries = await Promise.all(pending.map(async (id) => {
        if (!token) return [id, null] as const;
        try {
          const data = await getExerciseHistory(id, token, 1);
          return [id, data.success ? (data.history[0]?.sets ?? []) : null] as const;
        } catch {
          return [id, null] as const;
        }
      }));
      const loaded: Array<[string, PreviousSet[]]> = [];
      for (const [id, sets] of entries) {
        if (sets) loaded.push([id, sets]);
        else requestedPreviousRef.current.delete(id);
      }
      if (loaded.length) setPreviousSets((current) => ({ ...current, ...Object.fromEntries(loaded) }));
    };
    loadPrevious().catch((error) => logHandledError('load-previous-sets', error));
  }, [exerciseIdsKey, getToken]);

  // ── Dynamic Stats ────────────────────────────────────────────────
  const totalVolume = exercises.reduce((total, ex) =>
    total + ex.sets.filter(s => s.done).reduce((sum, s) => sum + weightOf(s) * repsOf(s), 0), 0
  );

  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.done).length, 0);

  // ── Set Operations ────────────────────────────────────────────────
  /**
   * Adds a set that already carries the numbers from the one above it.
   *
   * A second set of an exercise is almost always the same weight for the same
   * reps as the first, so an empty row meant retyping both fields every time.
   * The new row copies the last set that has anything in it, and falls back to
   * what was logged for this exercise last session when the athlete has not
   * filled anything in yet. Either is a starting point to correct, not a
   * commitment: the set still has to be ticked to count.
   */
  const addSet = (exIndex: number) => {
    setExercises((current) => current.map((exercise, index) => {
      if (index !== exIndex) return exercise;
      const lastFilled = [...exercise.sets].reverse().find((set) => set.weight || set.reps);
      const previous = previousSets[exercise.id]?.[exercise.sets.length];
      const seed = {
        weight: lastFilled?.weight || (previous?.weight ? String(previous.weight) : ''),
        reps: lastFilled?.reps || (previous?.reps ? String(previous.reps) : ''),
      };
      return {
        ...exercise,
        sets: [
          ...exercise.sets,
          // `done` is deliberately false: a copied number is a suggestion, and
          // ticking it is what turns it into a logged set.
          { ...seed, done: false, setType: 'normal' as const },
        ],
      };
    }));
  };

  /** Replaces one set without touching the objects other rows still hold. */
  const updateSet = (exIndex: number, setIndex: number, patch: Partial<ActiveWorkoutSet>) => {
    setExercises((current) => current.map((exercise, index) => (
      index !== exIndex
        ? exercise
        : { ...exercise, sets: exercise.sets.map((set, position) => (position === setIndex ? { ...set, ...patch } : set)) }
    )));
  };

  /**
   * Ticking a set with no reps typed takes last session's numbers for that
   * row, the way the placeholder column suggests. With nothing to take, the
   * tick is refused: a set of zero reps is a typo, not a logged set.
   */
  const toggleSet = (exIndex: number, setIndex: number) => {
    const exercise = exercises[exIndex];
    const set = exercise?.sets[setIndex];
    if (!exercise || !set) return;
    if (set.done) return updateSet(exIndex, setIndex, { done: false });
    if (parseDecimalInput(set.reps) !== null) return updateSet(exIndex, setIndex, { done: true });
    const previous = previousSets[exercise.id]?.[setIndex];
    if (previous?.reps) {
      return updateSet(exIndex, setIndex, {
        done: true,
        reps: String(previous.reps),
        weight: set.weight || (previous.weight ? String(previous.weight) : ''),
      });
    }
    showInfo(
      t('active_workout.reps_needed_title', 'Tekrar sayısı gir'),
      t('active_workout.reps_needed_body', 'Seti tamamlamak için önce kaç tekrar yaptığını yaz.'),
    );
  };

  const updateSetField = (exIndex: number, setIndex: number, field: 'reps' | 'weight', val: string) => {
    updateSet(exIndex, setIndex, { [field]: val });
  };

  const removeExercise = (exIndex: number) => {
    setExercises((current) => current.filter((_, index) => index !== exIndex));
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
    if (!session || !ownerId) return;
    if (totalSets === 0) {
      Alert.alert(
        t('common.error', 'Error'),
        t('active_workout.complete_one_set', 'Complete at least one set before finishing.')
      );
      return;
    }
    const operationId = session.saveOperationId ?? createOperationId('workout');
    if (!session.saveOperationId) {
      setSession({ ...session, saveOperationId: operationId });
      void updateActiveWorkoutDraft({
        version: 1, ownerId, ...session, saveOperationId: operationId, updatedAt: Date.now(),
        name: workoutName, note: workoutNote, exercises,
      }).catch((error) => logHandledError('save-workout-draft', error));
    }
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
          weight: weightOf(s),
          reps: repsOf(s),
          completed: s.done
        }))
      })).filter(ex => ex.sets.length > 0)
    };
    navigation.navigate('WorkoutSummaryScreen', { workoutData, operationId, startedAt: session.startedAt });
  };

  const handleCancel = () => {
    Alert.alert(
      t('workout.cancel_workout', 'Antrenmanı İptal Et'),
      t('workout.cancel_confirm', 'Bu antrenmanı iptal etmek istiyor musun? Kaydedilmeyecek.'),
      [
        { text: t('common.no', 'Hayır'), style: 'cancel' },
        { text: t('common.yes', 'Evet'), style: 'destructive', onPress: () => {
          // Dropped first so the unmount flush has nothing left to write back.
          latestDraftRef.current = null;
          setSession(null);
          if (ownerId) void clearActiveWorkoutDraft(ownerId).catch((error) => logHandledError('clear-workout-draft', error));
          navigation.goBack();
        }}
      ]
    );
  };

  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      {/* Hevy's bar: minimise on the left, the clock and running totals in
          the middle, a short Finish at the edge. Flat, with one hairline -
          the elevated slab drew a shadow across the whole screen. */}
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingLeft: 4, paddingRight: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }}>
        {/* Minimises rather than ends: the workout keeps running and the
            Routines tab offers the way back. */}
        <IconButton icon="chevron-down" size={24} iconColor={theme.text} onPress={() => navigation.goBack()} accessibilityLabel={t('active_workout.minimize', 'Antrenmanı küçült')} style={{ margin: 0 }} />
        <View style={{ flex: 1, minWidth: 0, marginLeft: 2 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, fontVariant: ['tabular-nums'] }}>{formatTime(elapsedSeconds)}</Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: theme.textMuted, marginTop: 1, fontVariant: ['tabular-nums'] }}>
            {formatNumber(Math.round(totalVolume), i18n.language)} {t('common.kg', 'kg')}
            {'  ·  '}
            {t('monthly_report.sets_count', { count: totalSets, defaultValue: '{{count}} set' })}
          </Text>
        </View>
        <SoftButton
          primary
          fill={false}
          dimmed={totalSets === 0}
          label={t('workout.finish', 'Bitir')}
          onPress={handleFinish}
        />
      </View>

        <KeyboardAwareScrollView
          contentContainerStyle={{
            width: '100%',
            maxWidth: 720,
            alignSelf: 'center',
            paddingHorizontal: horizontalPadding,
            paddingBottom: 40,
            paddingTop: 10,
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
          style={{ backgroundColor: 'transparent', fontSize: 18, fontWeight: '700', marginBottom: 0, paddingHorizontal: 0, height: 44 }}
          textColor={theme.text}
          placeholderTextColor={theme.textMuted}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          accessibilityLabel={t('workout.name_placeholder', 'Workout name')}
        />

        <TextInput
          mode="flat"
          placeholder={t('workout.add_workout_note', 'Antrenman notu ekle')}
          value={workoutNote}
          onChangeText={setWorkoutNote}
          multiline
          style={{ backgroundColor: 'transparent', width: '100%', minWidth: 0, fontSize: 14, marginBottom: 12, paddingHorizontal: 0, minHeight: 36 }}
          textColor={theme.text}
          placeholderTextColor={theme.textMuted}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          accessibilityLabel={t('workout.add_workout_note', 'Workout note')}
        />

        {exercises.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="barbell-outline" size={30} color={theme.textMuted} />
            <Text style={{ color: theme.textMuted, marginTop: 10, textAlign: 'center', fontSize: 13.5 }}>
              {t('workout.no_exercises_yet', 'Egzersiz eklenmedi')}
            </Text>
          </View>
        )}

        {/* Exercises */}
        {exercises.map((ex, exIndex) => (
          <View key={ex.id || `exercise-${exIndex}`} style={{ paddingTop: 12, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
                {ex.imageUrl ? (
                  <Image
                    source={{ uri: ex.imageUrl }}
                    style={{ ...exerciseThumbStyle(EXERCISE_THUMB.medium), marginRight: 10, backgroundColor: '#FFFFFF' }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ ...exerciseThumbStyle(EXERCISE_THUMB.medium), marginRight: 10, backgroundColor: theme.surfaceLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="barbell" size={22} color={theme.textMuted} />
                  </View>
                )}
                <Text
                  numberOfLines={2}
                  style={{ flex: 1, color: theme.primary, fontWeight: '600', fontSize: 15 }}
                >
                  {exerciseTitle(ex.name, i18n.language)}
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
              <Text variant="bodySmall" style={{ color: theme.textMuted, marginBottom: 10 }}>{exerciseMeta(ex, t, i18n.language)}</Text>
            ) : null}

            {/* Sets header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: setRowGap, marginBottom: 6, paddingHorizontal: 4 }}>
              <Text variant="labelSmall" style={{ color: theme.textMuted, fontWeight: '500', width: 28, textAlign: 'center' }}>
                {t('workout.set_column', 'SET')}
              </Text>
              <Text variant="labelSmall" numberOfLines={1} style={{ color: theme.textMuted, fontWeight: '500', flex: 1, minWidth: 0, textAlign: 'center' }}>
                {t('workout.previous_column', 'ÖNCEKİ')}
              </Text>
              <Text variant="labelSmall" style={{ color: theme.textMuted, fontWeight: '500', width: setFieldWidth, textAlign: 'center' }}>
                {t('common.kg', 'KG')}
              </Text>
              <Text variant="labelSmall" numberOfLines={1} style={{ color: theme.textMuted, fontWeight: '500', width: setFieldWidth, textAlign: 'center' }}>
                {t('workout.reps_column', 'TEKRAR')}
              </Text>
              <View style={{ width: 30, alignItems: 'center' }}>
                <Ionicons name="checkmark" size={16} color={theme.textMuted} />
              </View>
            </View>

            {ex.sets.map((s, setIndex) => {
              const previous = previousSets[ex.id]?.[setIndex];
              const previousLabel = previous
                ? `${formatWeight(Number(previous.weight) || 0, i18n.language)} kg × ${previous.reps}`
                : '—';
              return (
              <View key={setIndex} style={{ flexDirection: 'row', alignItems: 'center', gap: setRowGap, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 8, backgroundColor: s.done ? doneGreen : 'transparent', marginBottom: 3 }}>
                <View style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: s.done ? doneText : theme.text, fontWeight: '600' }}>{setIndex + 1}</Text>
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
                  keyboardType="decimal-pad"
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
                  keyboardType="number-pad"
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
              style={{ marginTop: 8, minHeight: 32, borderRadius: 8, backgroundColor: theme.surfaceLight, alignItems: 'center', justifyContent: 'center' }}
              accessibilityRole="button"
              accessibilityLabel={t('workout.add_set', 'Set Ekle')}
              borderless
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="add" size={16} color={theme.text} />
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>{t('workout.add_set', 'Set Ekle')}</Text>
              </View>
            </TouchableRipple>
          </View>
        ))}

        <View style={{ gap: 8, marginTop: 4, marginBottom: 16 }}>
          <SoftButton
            large
            primary
            icon="add"
            label={t('active_workout.add_exercise', 'Egzersiz Ekle')}
            onPress={() => setPickerVisible(true)}
          />
          <SoftButton
            large
            danger
            label={t('workout.cancel_workout', 'Antrenmanı İptal Et')}
            onPress={handleCancel}
          />
        </View>
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
