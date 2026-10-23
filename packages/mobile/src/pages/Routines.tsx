import React, { useCallback, useState, useRef } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useScrollToTopOnTabPress } from '../hooks/useScrollToTopOnTabPress';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import { getRoutines } from '../api/endpoints';
import RoutineBuilderModal from '../components/RoutineBuilderModal';
import ScreenHeader from '../components/ScreenHeader';
import SoftButton from '../components/ui/SoftButton';
import { logHandledError } from '../utils/feedback';
import { exerciseTitle } from '../utils/exerciseLabels';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useActiveWorkoutDraft } from '../features/workout/useActiveWorkoutDraft';
import { useScrollEdge } from '../hooks/useScrollEdge';
import { TYPE } from '../config/layout';
import type { Exercise, Routine } from '@motionmeet/shared';
import type { NavigationLike, NavigationOnlyProps } from '../navigation/types';

interface RoutineCardProps { routine: Routine; navigation: NavigationLike }

/**
 * A routine as Hevy lists it: the name, which movements it holds in one grey
 * line, and the button that starts it. The set-by-set weights the card used
 * to spell out belong to the workout screen, where they can be changed.
 */
const RoutineCard = ({ routine, navigation }: RoutineCardProps) => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const exercises = routine.exercises || [];
  const totalSets = exercises.reduce((sum, exercise) => sum + (exercise.sets?.length || 0), 0);
  const names = exercises
    .map((exercise) => (typeof exercise.exerciseId === 'object' ? (exercise.exerciseId as Exercise).name : exercise.exerciseName) || '')
    .filter(Boolean)
    .map((name) => exerciseTitle(name, i18n.language))
    .join(', ');

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.text }]}>{routine.name}</Text>
      {names ? <Text numberOfLines={2} style={[styles.cardBody, { color: theme.textMuted }]}>{names}</Text> : null}
      <Text style={[styles.cardMeta, { color: theme.textMuted }]}>
        {t('workout.exercises_count', { count: exercises.length, defaultValue: '{{count}} egzersiz' })}
        {' · '}
        {t('monthly_report.sets_count', { count: totalSets, defaultValue: '{{count}} set' })}
      </Text>
      <SoftButton
        primary
        label={t('routines.start_routine', 'Rutini başlat')}
        onPress={() => navigation.navigate('ActiveWorkoutScreen', { routine })}
        style={styles.cardAction}
      />
    </View>
  );
};

/**
 * The workout tab in Hevy's order: start an empty session, make or find a
 * routine, then the member's own routines. One way to each action - the
 * header "+" and the second "New routine" inside the empty state repeated the
 * buttons right above them.
 */
const Routines = ({ navigation }: NavigationOnlyProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const { horizontalPadding } = useResponsiveLayout();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const headerEdge = useScrollEdge();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopOnTabPress(scrollRef);
  const activeWorkout = useActiveWorkoutDraft();

  const loaded = useRef(false);
  const fetchRoutines = useCallback(async (cursor: string | null = null) => {
    try {
      if (cursor) setLoadingMore(true);
      else if (!loaded.current) setLoading(true);
      setFailed(false);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const data = await getRoutines(token, cursor);
      if (data.success) {
        setRoutines((current) => {
          if (!cursor) return data.routines || [];
          const knownIds = new Set(current.map((routine) => routine._id));
          return [...current, ...(data.routines || []).filter((routine) => !knownIds.has(routine._id))];
        });
        setNextCursor(data.nextCursor);
        loaded.current = true;
      }
    } catch (error) {
      logHandledError('load-routines', error);
      if (!cursor) setFailed(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [getToken]);

  // Refetched whenever the tab is opened: a routine saved from a finished
  // workout, or a load that failed while offline, shows up without a restart.
  useFocusEffect(useCallback(() => {
    void fetchRoutines();
  }, [fetchRoutines]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScreenHeader large scrolled={headerEdge.scrolled} title={t('routines.title', 'Antrenman')} />

      <ScrollView
        ref={scrollRef}
        onScroll={headerEdge.onScroll}
        scrollEventThrottle={headerEdge.scrollEventThrottle}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void fetchRoutines(); }}
            tintColor={theme.textMuted}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
      >
        {activeWorkout ? (
          <View style={[styles.resume, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="timer-outline" size={20} color={theme.primary} />
            <View style={styles.resumeText}>
              <Text style={[styles.resumeTitle, { color: theme.text }]}>
                {t('active_workout.in_progress', 'Devam eden antrenman')}
              </Text>
              <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 12.5, marginTop: 2 }}>
                {activeWorkout.name}
              </Text>
            </View>
            <SoftButton
              primary
              label={t('active_workout.resume', 'Devam et')}
              onPress={() => navigation.navigate('ActiveWorkoutScreen')}
              style={styles.resumeAction}
            />
          </View>
        ) : null}

        <Text style={[styles.section, { color: theme.textSecondary }]}>{t('routines.quick_start', 'Hızlı başlangıç')}</Text>
        <View style={styles.row}>
          <SoftButton
            large
            icon="add"
            label={t('routines.start_empty', 'Boş antrenmana başla')}
            onPress={() => navigation.navigate('ActiveWorkoutScreen', {
              routine: {
                name: t('routines.quick_workout', 'Hızlı antrenman'),
                exercises: [],
              },
            })}
          />
        </View>

        <Text style={[styles.section, { color: theme.textSecondary }]}>{t('routines.routines_section', 'Rutinler')}</Text>
        <View style={styles.row}>
          <SoftButton large icon="clipboard-outline" label={t('routines.new_routine', 'Yeni rutin')} onPress={() => setShowModal(true)} />
          <SoftButton large icon="search" label={t('routines.discover', 'Keşfet')} onPress={() => navigation.navigate('Exercises')} />
        </View>

        <Text style={[styles.heading, { color: theme.text }]}>
          {t('routines.my_routines', 'Rutinlerim')}
          {routines.length ? <Text style={{ color: theme.textMuted, fontWeight: '600' }}> ({routines.length}{nextCursor ? '+' : ''})</Text> : null}
        </Text>

        {loading ? (
          <ActivityIndicator color={theme.textMuted} style={{ marginTop: 28 }} />
        ) : failed && routines.length === 0 ? (
          <Pressable onPress={() => void fetchRoutines()} accessibilityRole="button">
            <Text style={[styles.empty, { color: theme.textMuted }]}>
              {t('routines.load_failed', 'Rutinler yüklenemedi.')}{' '}
              <Text style={{ color: theme.primary, fontWeight: '600' }}>{t('common.retry', 'Tekrar dene')}</Text>
            </Text>
          </Pressable>
        ) : routines.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            {t('routines.no_routines', 'Henüz rutin yok')}. {t('routines.no_routines_hint', 'Sonraki antrenmanın için tekrar kullanılabilir bir plan oluştur.')}
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {routines.map((routine) => (
              <RoutineCard key={routine._id} routine={routine} navigation={navigation} />
            ))}
            {nextCursor && (
              <SoftButton
                label={t('common.load_more', 'Daha fazla')}
                busy={loadingMore}
                onPress={() => fetchRoutines(nextCursor)}
              />
            )}
          </View>
        )}
      </ScrollView>

      <RoutineBuilderModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onRoutineCreated={(routine) => {
          setRoutines((current) => [routine, ...current]);
          setShowModal(false);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingTop: 4, paddingBottom: 32 },
  resume: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6 },
  resumeText: { flex: 1, minWidth: 0 },
  resumeTitle: { fontSize: TYPE.row, fontWeight: '600' },
  resumeAction: { flex: 0, paddingHorizontal: 14 },
  section: { fontSize: 13, fontWeight: '500', marginTop: 14, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  heading: { fontSize: TYPE.section + 1, fontWeight: '700', marginTop: 24, marginBottom: 10 },
  empty: { fontSize: 13.5, lineHeight: 19 },
  card: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  cardTitle: { fontSize: TYPE.section, fontWeight: '600' },
  cardBody: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  cardMeta: { fontSize: TYPE.meta, marginTop: 4 },
  cardAction: { flex: 0, marginTop: 10 },
});

export default Routines;
