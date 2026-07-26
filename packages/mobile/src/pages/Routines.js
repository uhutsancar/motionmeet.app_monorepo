import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Divider,
  Surface,
  Text,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import { getRoutines } from '../api/endpoints';
import RoutineBuilderModal from '../components/RoutineBuilderModal';

const RoutineCard = ({ routine, theme, navigation }) => {
  const { t } = useTranslation();
  const exercises = routine.exercises || [];
  const totalSets = exercises.reduce((sum, exercise) => sum + (exercise.sets?.length || 0), 0);

  return (
    <Surface
      elevation={0}
      style={{
        padding: 16,
        gap: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
      }}
    >
      <View>
        <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>
          {routine.name}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 3 }}>
          {exercises.length} {t('workout.exercises', 'exercises')} · {totalSets} {t('routines.sets', 'sets')}
        </Text>
      </View>

      <View style={{ gap: 9 }}>
        {exercises.slice(0, 3).map((exercise, index) => (
          <View key={exercise._id || index} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text
              style={{
                width: 28,
                color: theme.textMuted,
                fontSize: 11,
                fontWeight: '800',
                paddingTop: 1,
              }}
            >
              {String(index + 1).padStart(2, '0')}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                {exercise.exerciseId?.name || t('routines.exercise', 'Exercise')}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                {(exercise.sets || [])
                  .map((set) => `${set.weight || 0} ${t('common.kg', 'kg')} × ${set.reps || 0}`)
                  .join('  ·  ')}
              </Text>
            </View>
          </View>
        ))}
        {exercises.length > 3 && (
          <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700', marginLeft: 28 }}>
            +{exercises.length - 3} {t('profile.more_exercises', 'more exercises')}
          </Text>
        )}
      </View>

      <Divider style={{ backgroundColor: theme.border }} />
      <Button
        mode="contained"
        icon="play"
        onPress={() => navigation.navigate('ActiveWorkoutScreen', { routine })}
        style={{ borderRadius: 10 }}
        contentStyle={{ minHeight: 44 }}
        labelStyle={{ fontWeight: '800', fontSize: 14 }}
      >
        {t('routines.start_routine', 'Start routine')}
      </Button>
    </Surface>
  );
};

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
      const data = await getRoutines(token, cursor);
      if (data.success) {
        setRoutines((current) => {
          if (!cursor) return data.routines || [];
          const knownIds = new Set(current.map((routine) => routine._id));
          return [...current, ...(data.routines || []).filter((routine) => !knownIds.has(routine._id))];
        });
        setNextCursor(data.nextCursor);
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
      <Appbar.Header
        statusBarHeight={0}
        style={{
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          elevation: 0,
        }}
      >
        <Appbar.Content
          title={t('routines.title', 'Routines')}
          titleStyle={{ color: theme.text, fontSize: 23, fontWeight: '800' }}
        />
        <Appbar.Action icon="plus" color={theme.text} onPress={() => setShowModal(true)} />
      </Appbar.Header>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          paddingHorizontal: 16,
          paddingTop: 20,
          paddingBottom: 32,
        }}
      >
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: theme.text, fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.4 }}>
            {t('routines.ready_title', 'Ready to train?')}
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 4 }}>
            {t('routines.ready_subtitle', 'Start a blank workout or continue with one of your plans.')}
          </Text>
        </View>

        <Surface
          elevation={0}
          style={{
            padding: 16,
            marginBottom: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.energySoft,
              }}
            >
              <Ionicons name="barbell-outline" size={22} color={theme.text} />
            </View>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
                {t('routines.start_empty', 'Start empty workout')}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
                {t('routines.empty_subtitle', 'Add exercises as you train.')}
              </Text>
            </View>
            <Button
              compact
              mode="contained"
              onPress={() => navigation.navigate('ActiveWorkoutScreen', {
                routine: {
                  name: t('routines.quick_workout', 'Quick workout'),
                  exercises: [],
                },
              })}
              style={{ borderRadius: 9 }}
              contentStyle={{ minHeight: 38 }}
              labelStyle={{ fontSize: 12, fontWeight: '800' }}
            >
              {t('common.start', 'Start')}
            </Button>
          </View>
        </Surface>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          <Button
            mode="outlined"
            icon="clipboard-outline"
            onPress={() => setShowModal(true)}
            style={{ flex: 1, borderRadius: 10, borderColor: theme.border }}
            labelStyle={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}
          >
            {t('routines.new_routine', 'New routine')}
          </Button>
          <Button
            mode="outlined"
            icon="magnify"
            onPress={() => navigation.navigate('Exercises')}
            style={{ flex: 1, borderRadius: 10, borderColor: theme.border }}
            labelStyle={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}
          >
            {t('routines.discover', 'Explore')}
          </Button>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>
            {t('routines.my_routines', 'My routines')}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700' }}>{routines.length}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 36 }} />
        ) : routines.length === 0 ? (
          <Surface
            elevation={0}
            style={{
              alignItems: 'center',
              padding: 24,
              gap: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.surface,
            }}
          >
            <Ionicons name="clipboard-outline" size={28} color={theme.textMuted} />
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>
              {t('routines.no_routines', 'No routines yet')}
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 18, textAlign: 'center' }}>
              {t('routines.no_routines_hint', 'Create a repeatable plan for your next session.')}
            </Text>
            <Button
              mode="contained"
              onPress={() => setShowModal(true)}
              style={{ borderRadius: 10, marginTop: 6 }}
              labelStyle={{ fontWeight: '800' }}
            >
              {t('routines.new_routine', 'Create routine')}
            </Button>
          </Surface>
        ) : (
          <View style={{ gap: 12 }}>
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
                style={{ borderRadius: 10 }}
              >
                {t('common.load_more', 'Load more')}
              </Button>
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

export default Routines;
