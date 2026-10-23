// React Native's Image is used on purpose: Expo Go ships its own native
// expo-image build, and when it disagrees with the version installed here the
// view renders blank instead of erroring, so exercise photos and GIFs vanish.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Surface,
  Text,
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { resolvePublicMediaUrl, type Exercise } from '@motionmeet/shared';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import { getExercises } from '../api/endpoints';
import CustomExerciseModal from '../components/CustomExerciseModal';
import EquipmentAvatar from '../components/EquipmentAvatar';
import MuscleAvatar from '../components/MuscleAvatar';
import { useMuscleGroups } from '../hooks/useMuscleGroups';
import { useEquipment } from '../hooks/useEquipment';
import { API_URL } from '../config/environment';
import { BottomSheetModal } from '../components/ResponsiveModal';
import { logHandledError } from '../utils/feedback';
import { exerciseMeta, exerciseTitle } from '../utils/exerciseLabels';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useScrollToTopOnTabPress } from '../hooks/useScrollToTopOnTabPress';
import { CONTROL, EXERCISE_THUMB, TYPE, exerciseThumbStyle } from '../config/layout';
import { useScrollEdge } from '../hooks/useScrollEdge';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import type { NavigationOnlyProps } from '../navigation/types';

type FilterType = 'muscle' | 'equipment';
interface FilterOption {
  type: FilterType;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

const Exercises = ({ navigation }: NavigationOnlyProps) => {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const { getToken } = useAuthContext();
  const { data: muscleGroupsList } = useMuscleGroups();
  const { data: equipmentListItems } = useEquipment();
  const { horizontalPadding } = useResponsiveLayout();

  const muscleGroups = ['all', ...muscleGroupsList.map((group) => group.code)];
  const equipment = ['all', ...equipmentListItems.map((item) => item.code)];
  const listRef = useRef<FlatList<Exercise>>(null);
  useScrollToTopOnTabPress(listRef);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('all');
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterType, setFilterType] = useState<FilterType | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const requestSequenceRef = useRef(0);
  const headerEdge = useScrollEdge();
  // The list under the search field keeps its last rows above the keyboard.
  const keyboard = useKeyboardInset();

  const fetchExercises = useCallback(async (cursor: string | null = null, requestId: number | null = null) => {
    const activeRequestId = requestId ?? ++requestSequenceRef.current;
    try {
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setFailed(false);
      const params: Record<string, string | number | boolean | undefined> = {};
      if (searchQuery) params.search = searchQuery;
      if (muscleFilter !== 'all') params.muscleGroup = muscleFilter;
      if (equipmentFilter !== 'all') params.equipment = equipmentFilter;
      params.limit = 50;
      if (cursor) params.cursor = cursor;
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const data = await getExercises(params, token);
      if (requestSequenceRef.current !== activeRequestId) return;
      if (data.success) {
        if (cursor) {
          setExercises((current) => {
            const knownIds = new Set(current.map((exercise) => exercise._id));
            return [
              ...current,
              ...(data.exercises || []).filter((exercise) => !knownIds.has(exercise._id)),
            ];
          });
        } else {
          setExercises(data.exercises || []);
        }
        setNextCursor(data.nextCursor || null);
      }
    } catch (error) {
      if (requestSequenceRef.current === activeRequestId) {
        logHandledError('load-exercises', error);
        // A failed first page is said out loud with a way to try again,
        // instead of reading as "no exercises match".
        if (!cursor) setFailed(true);
      }
    } finally {
      if (requestSequenceRef.current === activeRequestId) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [equipmentFilter, getToken, muscleFilter, searchQuery]);

  useEffect(() => {
    const requestId = ++requestSequenceRef.current;
    setLoading(true);
    setLoadingMore(false);
    setNextCursor(null);
    const timer = setTimeout(() => fetchExercises(null, requestId), 400);
    return () => clearTimeout(timer);
  }, [fetchExercises]);

  // Coming back to the tab reloads a catalogue that never arrived, so a
  // connection that dropped when the tab was first built heals by itself.
  // Only a failed load is retried: an empty result for a search is an answer.
  const retryOnFocus = useRef<() => void>(() => undefined);
  retryOnFocus.current = () => { if (failed) void fetchExercises(null); };
  useFocusEffect(useCallback(() => { retryOnFocus.current(); }, []));

  const refresh = useCallback(() => {
    setRefreshing(true);
    void fetchExercises(null);
  }, [fetchExercises]);

  const loadMoreExercises = useCallback(() => {
    if (nextCursor && !loading && !loadingMore) {
      void fetchExercises(nextCursor);
    }
  }, [fetchExercises, loading, loadingMore, nextCursor]);

  const openFilter = (type: FilterType) => {
    setFilterType(type);
    setShowFilterModal(true);
  };

  const selectFilter = (value: string) => {
    if (filterType === 'muscle') setMuscleFilter(value);
    else setEquipmentFilter(value);
    setShowFilterModal(false);
  };

  const filterLabel = (type: FilterType | null, value: string): string => {
    if (value === 'all') {
      return type === 'muscle'
        ? t('exercises.all_muscles', 'All muscles')
        : t('exercises.all_equipment', 'All equipment');
    }
    if (type === 'muscle') {
      return String(t(
        `muscle_groups.${value}`,
        muscleGroupsList.find((group) => group.code === value)?.name || value,
      ));
    }
    return String(t(
      `equipment.${value}`,
      equipmentListItems.find((item) => item.code === value)?.name || value,
    ));
  };

  /*
   * A plain row rather than Paper's List.Item.
   *
   * List.Item puts its `left` slot hard against the edge of the sheet — the
   * drawings ended up touching the screen with the labels floating away from
   * them. Laying the row out here gives the picture, the name and the tick one
   * consistent gutter, and the same row serves both filters.
   */
  const renderFilterItem: ListRenderItem<string> = ({ item }) => {
    const selectedValue = filterType === 'muscle' ? muscleFilter : equipmentFilter;
    const isActive = selectedValue === item;
    const isAll = item === 'all';

    return (
      <TouchableOpacity
        activeOpacity={0.72}
        onPress={() => selectFilter(item)}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        style={{
          minHeight: 52,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 18,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        }}
      >
        {isAll ? (
          // "Everything" is not a thing to draw, so the slot is held open and
          // the names below stay on one line with the ones that are.
          <View style={{ width: 32, height: 32 }} />
        ) : filterType === 'equipment' ? (
          <EquipmentAvatar code={item} size={32} selected={isActive} />
        ) : (
          <MuscleAvatar code={item} size={32} selected={isActive} />
        )}

        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            minWidth: 0,
            color: isActive ? theme.primary : theme.text,
            fontSize: TYPE.row,
            fontWeight: isActive ? '600' : '400',
          }}
        >
          {filterLabel(filterType, item)}
        </Text>

        {isActive ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
      </TouchableOpacity>
    );
  };

  const renderExercise: ListRenderItem<Exercise> = ({ item }) => {
    const imageUrl = resolvePublicMediaUrl(item.gifUrl, API_URL);

    return (
      <Pressable
        onPress={() => navigation.navigate('ExerciseDetail', { exercise: item })}
        style={({ pressed }) => ({
          minHeight: 60,
          paddingVertical: 8,
          paddingHorizontal: horizontalPadding,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: pressed ? theme.surfaceLight : 'transparent',
        })}
      >
        <View
          style={{
            ...exerciseThumbStyle(EXERCISE_THUMB.medium),
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: imageUrl ? '#FFFFFF' : theme.surfaceLight,
          }}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <Ionicons name="barbell-outline" size={19} color={theme.textMuted} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, paddingLeft: 12 }}>
          <Text style={{ color: theme.text, fontSize: TYPE.row, fontWeight: '600' }} numberOfLines={1}>
            {exerciseTitle(item.name, i18n.language)}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: TYPE.meta, marginTop: 2 }} numberOfLines={1}>
            {exerciseMeta(item, t, i18n.language)}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScreenHeader
        large
        scrolled={headerEdge.scrolled}
        title={t('menu.exercises', 'Exercises')}
        actions={[
          {
            icon: 'add',
            onPress: () => setShowCreateModal(true),
            accessibilityLabel: t('exercises.create', 'Egzersiz olustur'),
          },
        ]}
      />

      <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: horizontalPadding, paddingTop: 2, paddingBottom: 8 }}>
        <View
          style={{
            height: CONTROL.field,
            borderRadius: 10,
            paddingHorizontal: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: theme.surfaceLight,
          }}
        >
          <Ionicons name="search" size={17} color={theme.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('exercises.search', 'Search exercises')}
            placeholderTextColor={theme.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            style={{ flex: 1, minWidth: 0, color: theme.text, fontSize: TYPE.body, paddingVertical: 0 }}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.clear', 'Temizle')}>
              <Ionicons name="close-circle" size={17} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* Two filters as chips, like Hevy's "Any equipment / Any muscle":
            grey until one is chosen, then the chosen value in the accent. */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {([
            { type: 'equipment', value: equipmentFilter, icon: 'barbell-outline' },
            { type: 'muscle', value: muscleFilter, icon: 'body-outline' },
          ] satisfies FilterOption[]).map((filter) => {
            const active = filter.value !== 'all';
            return (
              <TouchableOpacity
                key={filter.type}
                activeOpacity={0.72}
                onPress={() => openFilter(filter.type)}
                accessibilityRole="button"
                style={{
                  flex: 1,
                  height: CONTROL.height,
                  paddingHorizontal: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  borderRadius: CONTROL.radius,
                  backgroundColor: active ? theme.primarySoft : theme.surfaceLight,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    flexShrink: 1,
                    color: active ? theme.primary : theme.text,
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  {filterLabel(filter.type, filter.value)}
                </Text>
                <Ionicons name="chevron-down" size={13} color={active ? theme.primary : theme.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={theme.textMuted} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={exercises}
          keyExtractor={(item) => item._id}
          renderItem={renderExercise}
          onScroll={headerEdge.onScroll}
          scrollEventThrottle={headerEdge.scrollEventThrottle}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.textMuted} />}
          style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}
          contentContainerStyle={{ paddingBottom: 30 + keyboard.height }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreExercises}
          onEndReachedThreshold={0.35}
          ListHeaderComponent={
            exercises.length ? (
              // No counter beside the heading: the list pages in by cursor, so
              // the only number available was "rows loaded so far".
              <Text style={{ color: theme.textMuted, fontSize: 13, fontWeight: '600', paddingHorizontal: horizontalPadding, paddingTop: 6, paddingBottom: 4 }}>
                {searchQuery || muscleFilter !== 'all' || equipmentFilter !== 'all'
                  ? t('exercises.results', 'Sonuçlar')
                  : t('exercises.all_exercises', 'All exercises')}
              </Text>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                size="small"
                color={theme.textMuted}
                style={{ paddingVertical: 18 }}
              />
            ) : null
          }
          ListEmptyComponent={
            failed ? (
              <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingTop: 48 }}>
                <Ionicons name="cloud-offline-outline" size={26} color={theme.textMuted} />
                <Text style={{ marginTop: 10, color: theme.text, fontSize: TYPE.section, fontWeight: '600' }}>
                  {t('exercises.load_failed', 'Egzersizler yüklenemedi')}
                </Text>
                <Text style={{ marginTop: 4, color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>
                  {t('common.check_connection', 'Bağlantını kontrol edip tekrar dene.')}
                </Text>
                <Pressable onPress={() => void fetchExercises(null)} hitSlop={8} style={{ marginTop: 14 }} accessibilityRole="button">
                  <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '600' }}>{t('common.retry', 'Tekrar dene')}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingTop: 48 }}>
                <Ionicons name="search-outline" size={26} color={theme.textMuted} />
                <Text style={{ marginTop: 10, color: theme.text, fontSize: TYPE.section, fontWeight: '600' }}>
                  {t('exercises.not_found', 'No exercises found')}
                </Text>
                <Text style={{ marginTop: 4, color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>
                  {t('exercises.try_filters', 'Try another search or clear a filter.')}
                </Text>
              </View>
            )
          }
        />
      )}

      <BottomSheetModal
        visible={showFilterModal}
        onRequestClose={() => setShowFilterModal(false)}
        backgroundColor={theme.surface}
        heightRatio={0.72}
      >
        <Surface
          elevation={0}
          style={{
            flex: 1,
            width: '100%',
            maxWidth: 620,
            alignSelf: 'center',
            overflow: 'hidden',
            backgroundColor: theme.surface,
          }}
        >
          <View style={{ paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }}>
            <Text style={{ color: theme.text, fontSize: TYPE.section + 1, fontWeight: '700' }}>
              {filterType === 'muscle'
                ? t('exercises.select_muscle', 'Select muscle group')
                : t('exercises.select_equipment', 'Select equipment')}
            </Text>
          </View>
          <FlatList
            data={filterType === 'muscle' ? muscleGroups : equipment}
            renderItem={renderFilterItem}
            keyExtractor={(item) => item}
          />
        </Surface>
      </BottomSheetModal>

      <CustomExerciseModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onExerciseCreated={(newExercise: Exercise) => setExercises((current) => [newExercise, ...current])}
      />
    </SafeAreaView>
  );
};

export default Exercises;
