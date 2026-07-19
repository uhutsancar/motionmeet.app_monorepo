import React, { useState, useEffect } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Appbar, Button, Chip, Divider, Surface, Text } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import RoutineBuilderModal from '../components/RoutineBuilderModal';

/* ── Routine Card ─────────────────────────────────────────────────────────── */
const RoutineCard = ({ routine, theme, navigation }) => {
  const { t } = useTranslation();

  const totalVolume = routine.exercises.reduce(
    (total, ex) => total + ex.sets.reduce((t, s) => t + (s.weight || 0) * (s.reps || 0), 0),
    0
  );
  const totalSets = routine.exercises.reduce((t, ex) => t + ex.sets.length, 0);

  return (
    <Surface style={{ borderRadius: 20, padding: 16, gap: 12, backgroundColor: theme.surfaceLight }} elevation={1}>
      {/* Title row */}
      <Surface elevation={0} style={{ backgroundColor: 'transparent' }}>
        <Text variant="titleMedium" style={{ color: theme.text, fontWeight: 'bold' }}>
          {routine.name}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.textMuted, marginTop: 2 }}>
          {totalSets} {t('routines.sets', 'set')} • {Math.round(totalVolume)} {t('common.kg', 'kg')} {t('common.total', 'total')}
        </Text>
      </Surface>

      {/* Exercise list */}
      <Surface elevation={0} style={{ gap: 6, backgroundColor: 'transparent' }}>
        {routine.exercises.map((ex, exIdx) => (
          <Surface elevation={0} key={exIdx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 2, backgroundColor: 'transparent' }}>
            <Surface elevation={0} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary, marginTop: 6 }} />
            <Surface elevation={0} style={{ flex: 1, backgroundColor: 'transparent' }}>
              <Text variant="bodyMedium" style={{ color: theme.text, fontWeight: '600' }}>
                {ex.exerciseId?.name || t('routines.exercise', 'Exercise')}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.textMuted, marginTop: 2 }}>
                {ex.sets.map((s, i) => `${i + 1}: ${s.weight}${t('common.kg', 'kg')} × ${s.reps}`).join('  ')}
              </Text>
            </Surface>
          </Surface>
        ))}
      </Surface>

      <Divider style={{ marginVertical: 4, backgroundColor: theme.border }} />

      <Button
        mode="contained"
        icon="play-circle"
        onPress={() => navigation.navigate('ActiveWorkoutScreen', { routine })}
        style={{ borderRadius: 14 }}
        contentStyle={{ paddingVertical: 4 }}
        labelStyle={{ fontWeight: 'bold', fontSize: 15 }}
      >
        {t('routines.start_routine', 'Start Routine')}
      </Button>
    </Surface>
  );
};

/* ── Main Routines Page ─────────────────────────────────────────────────────── */
const Routines = ({ navigation }) => {
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
      <Appbar.Header style={{ backgroundColor: theme.surface, elevation: 0 }}>
        <Appbar.Content
          title={t('routines.title', 'Routines')}
          titleStyle={{ color: theme.text, fontWeight: 'bold', fontSize: 22 }}
        />
        <Chip compact style={{ backgroundColor: '#fbbf24', marginRight: 12 }} textStyle={{ color: '#000', fontWeight: 'bold', fontSize: 11 }}>
          PRO
        </Chip>
        <Appbar.Action icon="plus" color={theme.primary} onPress={() => setShowModal(true)} />
      </Appbar.Header>

      <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>

        {/* Quick action buttons */}
        <Button
          mode="outlined"
          icon="plus"
          onPress={() => setShowModal(true)}
          style={{ borderRadius: 16, marginBottom: 12, borderColor: theme.border }}
          contentStyle={{ paddingVertical: 6 }}
          labelStyle={{ fontWeight: '600', color: theme.primary }}
        >
          {t('routines.start_empty', 'Start Empty Workout')}
        </Button>

        <Surface elevation={0} style={{ flexDirection: 'row', gap: 10, marginBottom: 24, backgroundColor: 'transparent' }}>
          <Button
            mode="outlined"
            icon="clipboard-outline"
            onPress={() => setShowModal(true)}
            style={{ flex: 1, borderRadius: 12, borderColor: theme.border }}
            labelStyle={{ fontWeight: '600', fontSize: 13, color: theme.textSecondary }}
          >
            {t('routines.new_routine', 'New Routine')}
          </Button>
          <Button
            mode="outlined"
            icon="magnify"
            onPress={() => navigation.navigate('Tabs', { screen: 'Exercises' })}
            style={{ flex: 1, borderRadius: 12, borderColor: theme.border }}
            labelStyle={{ fontWeight: '600', fontSize: 13, color: theme.textSecondary }}
          >
            {t('routines.discover', 'Discover')}
          </Button>
        </Surface>

        {/* Section header */}
        <Surface elevation={0} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, backgroundColor: 'transparent' }}>
          <Text variant="labelSmall" style={{ color: theme.textMuted, letterSpacing: 1.5, fontWeight: 'bold' }}>
            {t('routines.my_routines', 'MY ROUTINES')} ({routines.length})
          </Text>
        </Surface>

        {/* Routines list */}
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : routines.length === 0 ? (
          <Surface elevation={0} style={{ alignItems: 'center', paddingVertical: 48, gap: 12, backgroundColor: 'transparent' }}>
            <Text variant="headlineMedium" style={{ color: theme.border }}>🏋️</Text>
            <Text variant="bodyLarge" style={{ color: theme.textMuted, fontWeight: '600' }}>
              {t('routines.no_routines', 'No routines yet')}
            </Text>
            <Button
              mode="contained"
              onPress={() => setShowModal(true)}
              style={{ borderRadius: 12, marginTop: 8 }}
              labelStyle={{ fontWeight: 'bold' }}
            >
              {t('routines.new_routine', 'Create Routine')}
            </Button>
          </Surface>
        ) : (
          <Surface elevation={0} style={{ gap: 16, backgroundColor: 'transparent' }}>
            {routines.map((routine) => (
              <RoutineCard
                key={routine._id}
                routine={routine}
                theme={theme}
                navigation={navigation}
              />
            ))}
          </Surface>
        )}

        <Surface elevation={0} style={{ height: 60, backgroundColor: 'transparent' }} />
      </ScrollView>

      <RoutineBuilderModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onRoutineCreated={(r) => {
          setRoutines((prev) => [r, ...prev]);
          setShowModal(false);
        }}
      />
    </SafeAreaView>
  );
};

export default Routines;
