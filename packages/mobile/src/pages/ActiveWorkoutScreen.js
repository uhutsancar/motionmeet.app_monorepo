import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const ActiveWorkoutScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme);
  const kbAppearance = isDark ? 'dark' : 'light';

  const routine = route?.params?.routine;

  // Initialize exercises from routine or empty
  const [exercises, setExercises] = useState(() => {
    if (routine?.exercises?.length) {
      return routine.exercises.map(e => ({
        id: e.exerciseId?._id || e._id,
        name: e.exerciseId?.name || 'Exercise',
        muscleGroup: e.exerciseId?.muscleGroup || '',
        equipment: e.exerciseId?.equipment || '',
        sets: e.sets.map(s => ({
          reps: s.reps ? String(s.reps) : '',
          weight: s.weight ? String(s.weight) : '',
          done: false,
          setType: s.setType || 'normal'
        }))
      }));
    }
    return [];
  });

  const [workoutName, setWorkoutName] = useState(routine?.name || t('workout.my_workout', 'Antrenmanım'));
  const [workoutNote, setWorkoutNote] = useState('');
  
  // ── Real Timer ───────────────────────────────────────────────────
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  // ── Dynamic Stats ────────────────────────────────────────────────
  const totalVolume = exercises.reduce((total, ex) =>
    total + ex.sets.filter(s => s.done).reduce((t, s) =>
      t + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0), 0
  );

  const totalSets = exercises.reduce((t, ex) => t + ex.sets.filter(s => s.done).length, 0);

  // ── Set Operations ────────────────────────────────────────────────
  const addSet = (exIndex) => {
    const newEx = [...exercises];
    newEx[exIndex].sets.push({ reps: '', weight: '', done: false, setType: 'normal' });
    setExercises(newEx);
  };

  const toggleSet = (exIndex, setIndex) => {
    const newEx = [...exercises];
    newEx[exIndex].sets[setIndex].done = !newEx[exIndex].sets[setIndex].done;
    setExercises(newEx);
  };

  const updateSetField = (exIndex, setIndex, field, val) => {
    const newEx = [...exercises];
    newEx[exIndex].sets[setIndex][field] = val;
    setExercises(newEx);
  };

  const removeExercise = (exIndex) => {
    const newEx = [...exercises];
    newEx.splice(exIndex, 1);
    setExercises(newEx);
  };

  // ── Finish ────────────────────────────────────────────────────────
  const handleFinish = () => {
    clearInterval(timerRef.current);
    const workoutData = {
      name: workoutName,
      note: workoutNote,
      duration: elapsedSeconds,
      totalVolume: Math.round(totalVolume),
      totalSets: totalSets,
      exercises: exercises.map(ex => ({
        exerciseId: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        sets: ex.sets.filter(s => s.done || (s.weight && s.reps)).map(s => ({
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
          clearInterval(timerRef.current);
          navigation.goBack();
        }}
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.downBtn}>
            <Ionicons name="chevron-down" size={24} color={theme.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
            <View style={styles.miniStatsHeader}>
              <Text style={styles.miniStatText}>Hacim <Text style={styles.miniStatVal}>{totalVolume.toFixed(0)} kg</Text></Text>
              <Text style={styles.miniStatText}>Set <Text style={styles.miniStatVal}>{totalSets}</Text></Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
          <Text style={styles.finishBtnText}>{t('workout.finish', 'Bitir')}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        
        {/* Title */}
        <View style={styles.titleArea}>
          <TextInput
            style={styles.workoutTitleInput}
            value={workoutName}
            onChangeText={setWorkoutName}
            placeholder={t('workout.name_placeholder', 'Antrenman Adı')}
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View style={styles.noteInputArea}>
          <TextInput
            style={styles.noteInput}
            placeholder={t('workout.add_workout_note', 'Antrenman notu ekle')}
            placeholderTextColor={theme.textMuted}
            value={workoutNote}
            onChangeText={setWorkoutNote}
          />
        </View>

        {exercises.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={48} color={theme.border} />
            <Text style={{ color: theme.textMuted, marginTop: 12, textAlign: 'center' }}>
              {t('workout.no_exercises_yet', 'Egzersiz eklenmedi')}
            </Text>
          </View>
        )}

        {/* Exercises */}
        {exercises.map((ex, exIndex) => (
          <View key={exIndex} style={styles.exerciseCard}>
            <View style={styles.exHeader}>
              <Text style={styles.exNameText}>{ex.name}</Text>
              <TouchableOpacity onPress={() => {
                Alert.alert(ex.name, '', [
                  { text: t('common.cancel', 'İptal'), style: 'cancel' },
                  { text: t('workout.remove_exercise', 'Kaldır'), style: 'destructive', onPress: () => removeExercise(exIndex) }
                ]);
              }}>
                <Ionicons name="ellipsis-horizontal" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            {ex.muscleGroup ? (
              <Text style={{ color: theme.textMuted, fontSize: 12, marginBottom: 8 }}>{ex.muscleGroup} • {ex.equipment}</Text>
            ) : null}

            {/* Sets header */}
            <View style={styles.setsLabels}>
              <Text style={[styles.setLabelText, { width: 30, textAlign: 'center' }]}>Set</Text>
              <Text style={[styles.setLabelText, { width: 50, textAlign: 'center' }]}>kg</Text>
              <Text style={[styles.setLabelText, { width: 50, textAlign: 'center' }]}>Tkr</Text>
              <Ionicons name="checkmark" size={18} color={theme.textMuted} style={{ width: 30, textAlign: 'center' }} />
            </View>

            {ex.sets.map((s, setIndex) => (
              <View key={setIndex} style={[styles.setRow, s.done && styles.setRowDone]}>
                <Text style={[styles.setNumText, s.done && styles.setNumTextDone]}>{setIndex + 1}</Text>
                <TextInput 
                  style={[styles.setNumInput, s.done && styles.setInputDone]} 
                  keyboardType="numeric"
                  placeholder="-"
                  placeholderTextColor={theme.textMuted}
                  value={s.weight}
                  onChangeText={(val) => updateSetField(exIndex, setIndex, 'weight', val)}
                  keyboardAppearance={kbAppearance}
                />
                <TextInput 
                  style={[styles.setNumInput, s.done && styles.setInputDone]} 
                  keyboardType="numeric"
                  placeholder="-"
                  placeholderTextColor={theme.textMuted}
                  value={s.reps}
                  onChangeText={(val) => updateSetField(exIndex, setIndex, 'reps', val)}
                  keyboardAppearance={kbAppearance}
                />
                <TouchableOpacity 
                  style={[styles.doneCheckBtn, s.done && styles.doneCheckBtnActive]}
                  onPress={() => toggleSet(exIndex, setIndex)}
                >
                  {s.done && <Ionicons name="checkmark" size={16} color="#fff" />}
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exIndex)}>
              <Ionicons name="add" size={16} color={theme.text} />
              <Text style={styles.addSetBtnText}>+ {t('workout.add_set', 'Set Ekle')}</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.cancelWorkoutBtn} onPress={handleCancel}>
          <Text style={styles.cancelWorkoutText}>{t('workout.cancel_workout', 'Antrenmanı İptal Et')}</Text>
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.surface
  },
  downBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'flex-start' },
  timerText: { fontSize: 18, fontWeight: '900', color: theme.text, fontVariant: ['tabular-nums'] },
  miniStatsHeader: { flexDirection: 'row', gap: 10, marginTop: 2 },
  miniStatText: { fontSize: 11, color: theme.textMuted },
  miniStatVal: { color: theme.text, fontWeight: 'bold' },
  finishBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  finishBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  titleArea: { marginTop: 20 },
  workoutTitleInput: { fontSize: 24, fontWeight: 'bold', color: theme.text },
  noteInputArea: { marginTop: 10, marginBottom: 20 },
  noteInput: { fontSize: 15, color: theme.text },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  exerciseCard: { marginBottom: 24 },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  exNameText: { color: '#3b82f6', fontSize: 16, fontWeight: 'bold' },
  setsLabels: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 8, paddingHorizontal: 10 },
  setLabelText: { fontSize: 12, color: theme.textMuted, fontWeight: 'bold' },
  setRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  setRowDone: { backgroundColor: '#10b98120' },
  setNumText: { width: 30, textAlign: 'center', color: theme.textMuted, fontWeight: 'bold', backgroundColor: theme.surface, paddingVertical: 4, borderRadius: 6 },
  setNumTextDone: { color: '#10b981', backgroundColor: 'transparent' },
  setNumInput: { width: 55, textAlign: 'center', color: theme.text, backgroundColor: theme.surface, paddingVertical: 6, borderRadius: 8, fontWeight: '500' },
  setInputDone: { backgroundColor: 'transparent', color: '#10b981' },
  doneCheckBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center' },
  doneCheckBtnActive: { backgroundColor: '#10b981' },
  addSetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 6, marginTop: 10, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, backgroundColor: theme.surface },
  addSetBtnText: { color: theme.text, fontSize: 13, fontWeight: '600' },
  cancelWorkoutBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 16 },
  cancelWorkoutText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
});

export default ActiveWorkoutScreen;
