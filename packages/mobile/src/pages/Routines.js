import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import RoutineBuilderModal from '../components/RoutineBuilderModal';

// ── Inline Routine Card with timer ──────────────────────────────────────────
const RoutineCard = ({ routine, theme }) => {
  const { t } = useTranslation();
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const startTimeRef = useRef(null);
  const intervalRef = useRef(null);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const totalVolume = routine.exercises.reduce((total, ex) =>
    total + ex.sets.reduce((t, s) => t + (s.weight || 0) * (s.reps || 0), 0), 0
  );
  const totalSets = routine.exercises.reduce((t, ex) => t + ex.sets.length, 0);

  const handleStart = () => {
    startTimeRef.current = new Date();
    setElapsed(0);
    setActive(true);
    intervalRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
  };

  const handleFinish = () => {
    Alert.alert(
      t('routines.finish', 'Finish Workout?'),
      `${formatTime(elapsed)} • ${Math.round(totalVolume)} ${t('common.kg', 'kg')}`,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('routines.finish', 'Finish'), style: 'destructive', onPress: saveWorkout }
      ]
    );
  };

  const saveWorkout = async () => {
    clearInterval(intervalRef.current);
    setSaving(true);
    try {
      const endTime = new Date();
      const durationMinutes = Math.max(1, Math.round(elapsed / 60));
      const payload = {
        name: routine.name,
        startTime: startTimeRef.current,
        endTime,
        durationMinutes,
        volumeKg: Math.round(totalVolume * 10) / 10,
        exercises: routine.exercises.map(ex => ({
          exerciseId: ex.exerciseId?._id || ex.exerciseId,
          sets: ex.sets.map(s => ({ weight: s.weight || 0, reps: s.reps || 0 }))
        }))
      };
      const { data } = await api.post('/api/workout', payload);
      if (data.success) {
        setActive(false);
        setElapsed(0);
        setDone(true);
        setTimeout(() => setDone(false), 4000);
      }
    } catch (err) {
      Alert.alert(t('common.error', 'Hata'), err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.routineCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
      {/* Card Header */}
      <View style={styles.routineCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.routineTitle, { color: theme.text }]}>{routine.name}</Text>
          <Text style={[styles.routineMeta, { color: theme.textMuted }]}>
            {totalSets} {t('routines.sets')} • {Math.round(totalVolume)} {t('common.kg', 'kg')} {t('common.total', 'total')}
          </Text>
        </View>
        {active && (
          <View style={[styles.timerBadge, { backgroundColor: theme.primary + '20', borderColor: theme.primary + '40' }]}>
            <Ionicons name="timer-outline" size={14} color={theme.primary} />
            <Text style={[styles.timerText, { color: theme.primary }]}>{formatTime(elapsed)}</Text>
          </View>
        )}
      </View>

      {/* Exercise list with sets */}
      <View style={styles.exerciseList}>
        {routine.exercises.map((ex, exIdx) => (
          <View key={exIdx} style={styles.exerciseRow}>
            <View style={[styles.exBullet, { backgroundColor: theme.primary }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.exName, { color: theme.text }]}>{ex.exerciseId?.name || t('routines.exercise', 'Exercise')}</Text>
              <Text style={[styles.exSets, { color: theme.textMuted }]}>
                {ex.sets.map((s, i) => `${i + 1}: ${s.weight}${t('common.kg', 'kg')} × ${s.reps}`).join('  ')}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Success Banner */}
      {done && (
        <View style={[styles.successBanner, { backgroundColor: '#22c55e20', borderColor: '#22c55e40' }]}>
          <Ionicons name="trophy" size={18} color="#22c55e" />
          <Text style={{ color: '#22c55e', fontWeight: 'bold', marginLeft: 8 }}>
            {t('routines.workout_started', 'Workout saved! 🏆')}
          </Text>
        </View>
      )}

      {/* Button */}
      {!active ? (
        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: theme.primary }]}
          onPress={handleStart}
        >
          <Ionicons name="play-circle" size={20} color="#fff" />
          <Text style={styles.startBtnText}>{t('routines.start_routine', 'Start Routine')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.finishBtn, { borderColor: '#ef4444', backgroundColor: '#ef444410' }]}
          onPress={handleFinish}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#ef4444" />
              <Text style={[styles.finishBtnText, { color: '#ef4444' }]}>
                {t('routines.finish', 'Finish')} • {formatTime(elapsed)}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

// ── Main Routines Page ───────────────────────────────────────────────────────
const Routines = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchRoutines = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/routine');
      if (data.success) setRoutines(data.routines);
    } catch (error) {
      console.error('Error fetching routines:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutines();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t('routines.title', 'Routines')}</Text>
        </View>
        <View style={styles.proBadge}>
          <Text style={styles.proText}>PRO</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>

        {/* Start Empty Workout */}
        <TouchableOpacity
          style={[styles.emptyWorkoutBtn, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add" size={22} color={theme.textMuted} />
          <Text style={[styles.emptyWorkoutText, { color: theme.text }]}>
            {t('routines.start_empty', 'Start Empty Workout')}
          </Text>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.gridBtn, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}
            onPress={() => setShowModal(true)}
          >
            <Ionicons name="clipboard-outline" size={18} color={theme.text} />
            <Text style={[styles.gridBtnText, { color: theme.text }]}>{t('routines.new_routine', 'New Routine')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.gridBtn, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={18} color={theme.text} />
            <Text style={[styles.gridBtnText, { color: theme.text }]}>{t('routines.discover', 'Discover')}</Text>
          </TouchableOpacity>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
            {t('routines.my_routines', 'My Routines').toUpperCase()} ({routines.length})
          </Text>
          <TouchableOpacity onPress={() => setShowModal(true)}>
            <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Routines */}
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : routines.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={48} color={theme.border} />
            <Text style={[styles.emptyStateText, { color: theme.textMuted }]}>
              {t('routines.no_routines', 'No routines yet')}
            </Text>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: theme.primary }]}
              onPress={() => setShowModal(true)}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                {t('routines.new_routine', 'Create Routine')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {routines.map(routine => (
              <RoutineCard key={routine._id} routine={routine} theme={theme} />
            ))}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      <RoutineBuilderModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onRoutineCreated={(r) => {
          setRoutines(prev => [r, ...prev]);
          setShowModal(false);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  proBadge: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proText: {
    color: '#000',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    gap: 12,
  },
  emptyWorkoutText: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  gridBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  gridBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  // RoutineCard styles
  routineCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  routineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  routineTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  routineMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginLeft: 8,
  },
  timerText: {
    fontWeight: 'bold',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  exerciseList: {
    gap: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  exBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  exName: {
    fontSize: 14,
    fontWeight: '600',
  },
  exSets: {
    fontSize: 12,
    marginTop: 2,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  startBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  finishBtnText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default Routines;
