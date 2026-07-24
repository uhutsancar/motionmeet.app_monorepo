import React, { useCallback, useState, useEffect } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Appbar, Button, Chip, Divider, Surface, Text } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from "../context/AuthProvider";
import { getRoutines } from '../api/endpoints';
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
    <Surface style={{
      borderRadius: 20,
      padding: 16,
      gap: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOpacity: theme.dark ? 0.2 : 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    }} elevation={1}>
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
        {routine.exercises.slice(0, 4).map((ex, exIdx) => (
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
        {routine.exercises.length > 4 && (
          <Text variant="labelMedium" style={{ color: theme.primary, fontWeight: '800', marginLeft: 16 }}>
            +{routine.exercises.length - 4} {t('profile.more_exercises', 'more exercises')}
          </Text>
        )}
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
  const { getToken } = useAuthContext();

  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchRoutines = useCallback(async (cursor = null) => {
    try {
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      const token = await getToken();
      const routinesData = await getRoutines(token, cursor);
      if (routinesData.success) {
        setRoutines((currentRoutines) => {
          if (!cursor) return routinesData.routines;
          const knownIds = new Set(currentRoutines.map((routine) => routine._id));
          return [
            ...currentRoutines,
            ...routinesData.routines.filter((routine) => !knownIds.has(routine._id)),
          ];
        });
        setNextCursor(routinesData.nextCursor);
      }
    } catch (error) {
      console.error('Error fetching routines:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchRoutines();
  }, [fetchRoutines]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <Appbar.Header style={{ backgroundColor: theme.surface, elevation: 0, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Appbar.Content
          title={t('routines.title', 'Routines')}
          titleStyle={{ color: theme.text, fontWeight: '900', fontSize: 24 }}
        />
        <Chip compact style={{ backgroundColor: '#fbbf24', marginRight: 12 }} textStyle={{ color: '#000', fontWeight: 'bold', fontSize: 11 }}>
          PRO
        </Chip>
        <Appbar.Action icon="plus" color={theme.primary} onPress={() => setShowModal(true)} />
      </Appbar.Header>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', padding: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >

        <Surface elevation={0} style={{ backgroundColor: 'transparent', marginBottom: 18 }}>
          <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }}>
            TRAIN WITH INTENT
          </Text>
          <Text style={{ color: theme.text, fontSize: 27, lineHeight: 34, fontWeight: '900', letterSpacing: -0.8, marginTop: 4 }}>
            What are we training today?
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 5 }}>
            Start quickly or choose a routine built around your goals.
          </Text>
        </Surface>

        {/* Quick action buttons */}
        <Button
          mode="contained"
          icon="plus"
          onPress={() => setShowModal(true)}
          style={{ borderRadius: 16, marginBottom: 12 }}
          contentStyle={{ minHeight: 52 }}
          labelStyle={{ fontWeight: '900' }}
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
            onPress={() => navigation.navigate('Exercises')}
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
            {nextCursor && (
              <Button
                mode="outlined"
                onPress={() => fetchRoutines(nextCursor)}
                loading={loadingMore}
                disabled={loadingMore}
              >
                {t('common.load_more', 'Load more')}
              </Button>
            )}
          </Surface>
        )}

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
