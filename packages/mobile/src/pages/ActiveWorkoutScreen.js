import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Text, Surface, TextInput, Button, IconButton, Divider, TouchableRipple } from 'react-native-paper';
import { formatTime } from '@motionmeet/shared';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const ActiveWorkoutScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <Surface elevation={2} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8, backgroundColor: theme.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <IconButton icon="chevron-down" size={28} iconColor={theme.text} onPress={() => navigation.goBack()} />
          <View style={{ marginLeft: 4 }}>
            <Text variant="titleLarge" style={{ fontWeight: '900', color: theme.text, fontVariant: ['tabular-nums'] }}>{formatTime(elapsedSeconds)}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
              <Text variant="labelSmall" style={{ color: theme.textMuted }}>Hacim <Text style={{ color: theme.text, fontWeight: 'bold' }}>{totalVolume.toFixed(0)} kg</Text></Text>
              <Text variant="labelSmall" style={{ color: theme.textMuted }}>Set <Text style={{ color: theme.text, fontWeight: 'bold' }}>{totalSets}</Text></Text>
            </View>
          </View>
        </View>
        <Button mode="contained" onPress={handleFinish} style={{ borderRadius: 12, marginRight: 8 }} labelStyle={{ fontWeight: 'bold' }}>
          {t('workout.finish', 'Bitir')}
        </Button>
      </Surface>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
        
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
        />

        <TextInput
          mode="flat"
          placeholder={t('workout.add_workout_note', 'Antrenman notu ekle')}
          value={workoutNote}
          onChangeText={setWorkoutNote}
          style={{ backgroundColor: 'transparent', fontSize: 16, marginBottom: 24, paddingHorizontal: 0 }}
          textColor={theme.text}
          placeholderTextColor={theme.textMuted}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
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
          <Surface key={exIndex} elevation={1} style={{ marginBottom: 24, borderRadius: 16, padding: 16, backgroundColor: theme.surface }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text variant="titleMedium" style={{ color: theme.primary, fontWeight: 'bold' }}>{ex.name}</Text>
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
              />
            </View>

            {ex.muscleGroup ? (
              <Text variant="bodySmall" style={{ color: theme.textMuted, marginBottom: 16 }}>{ex.muscleGroup} • {ex.equipment}</Text>
            ) : null}

            {/* Sets header */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 8, paddingHorizontal: 10 }}>
              <Text variant="labelMedium" style={{ color: theme.textMuted, fontWeight: 'bold', width: 30, textAlign: 'center' }}>Set</Text>
              <Text variant="labelMedium" style={{ color: theme.textMuted, fontWeight: 'bold', width: 60, textAlign: 'center' }}>kg</Text>
              <Text variant="labelMedium" style={{ color: theme.textMuted, fontWeight: 'bold', width: 60, textAlign: 'center' }}>Tkr</Text>
              <Ionicons name="checkmark" size={18} color={theme.textMuted} style={{ width: 30, textAlign: 'center' }} />
            </View>

            {ex.sets.map((s, setIndex) => (
              <View key={setIndex} style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: s.done ? '#10b98120' : 'transparent', marginBottom: 4 }}>
                <View style={{ width: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: s.done ? 'transparent' : theme.background, paddingVertical: 8, borderRadius: 8 }}>
                    <Text style={{ color: s.done ? '#10b981' : theme.textMuted, fontWeight: 'bold' }}>{setIndex + 1}</Text>
                </View>
                <TextInput 
                  mode="outlined"
                  dense
                  keyboardType="numeric"
                  placeholder="-"
                  value={s.weight}
                  onChangeText={(val) => updateSetField(exIndex, setIndex, 'weight', val)}
                  keyboardAppearance={kbAppearance}
                  style={{ width: 60, textAlign: 'center', backgroundColor: s.done ? 'transparent' : theme.background, height: 40 }}
                  textColor={s.done ? '#10b981' : theme.text}
                  placeholderTextColor={theme.textMuted}
                  outlineStyle={{ borderColor: 'transparent', borderRadius: 8 }}
                />
                <TextInput 
                  mode="outlined"
                  dense
                  keyboardType="numeric"
                  placeholder="-"
                  value={s.reps}
                  onChangeText={(val) => updateSetField(exIndex, setIndex, 'reps', val)}
                  keyboardAppearance={kbAppearance}
                  style={{ width: 60, textAlign: 'center', backgroundColor: s.done ? 'transparent' : theme.background, height: 40 }}
                  textColor={s.done ? '#10b981' : theme.text}
                  placeholderTextColor={theme.textMuted}
                  outlineStyle={{ borderColor: 'transparent', borderRadius: 8 }}
                />
                <TouchableRipple 
                  style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: s.done ? '#10b981' : theme.background, justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => toggleSet(exIndex, setIndex)}
                  borderless
                >
                  {s.done && <Ionicons name="checkmark" size={18} color="#fff" />}
                </TouchableRipple>
              </View>
            ))}

            <Button
              mode="text"
              icon="plus"
              onPress={() => addSet(exIndex)}
              textColor={theme.text}
              style={{ alignSelf: 'center', marginTop: 12, borderRadius: 20 }}
            >
              {t('workout.add_set', 'Set Ekle')}
            </Button>
          </Surface>
        ))}

        <Button
            mode="text"
            textColor="#ef4444"
            onPress={handleCancel}
            style={{ marginVertical: 16 }}
            labelStyle={{ fontWeight: 'bold' }}
        >
            {t('workout.cancel_workout', 'Antrenmanı İptal Et')}
        </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ActiveWorkoutScreen;
