// React Native's Image is used on purpose: Expo Go ships its own native
// expo-image build, and when it disagrees with the version installed here the
// view renders blank instead of erroring, so exercise photos and GIFs vanish.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Searchbar,
  Surface,
  Text,
} from 'react-native-paper';
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
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useScrollToTopOnTabPress } from '../hooks/useScrollToTopOnTabPress';
import { EXERCISE_THUMB, exerciseThumbStyle } from '../config/layout';
import type { NavigationOnlyProps } from '../navigation/types';

type FilterType = 'muscle' | 'equipment';
interface FilterOption {
  type: FilterType;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

const Exercises = ({ navigation }: NavigationOnlyProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
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
  const requestSequenceRef = useRef(0);

  const fetchExercises = useCallback(async (cursor: string | null = null, requestId: number | null = null) => {
    const activeRequestId = requestId ?? ++requestSequenceRef.current;
    try {
      if (cursor) setLoadingMore(true);
      else setLoading(true);
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
      }
    } finally {
      if (requestSequenceRef.current === activeRequestId) {
        setLoading(false);
        setLoadingMore(false);
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
          minHeight: 58,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 18,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        }}
      >
        {isAll ? (
          // "Everything" is not a thing to draw, so the slot is held open and
          // the names below stay on one line with the ones that are.
          <View style={{ width: 34, height: 34 }} />
        ) : filterType === 'equipment' ? (
          <EquipmentAvatar code={item} size={34} selected={isActive} />
        ) : (
          <MuscleAvatar code={item} size={34} selected={isActive} />
        )}

        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            minWidth: 0,
            color: isActive ? theme.primary : theme.text,
            fontSize: 15,
            fontWeight: isActive ? '800' : '600',
          }}
        >
          {filterLabel(filterType, item)}
        </Text>

        {isActive ? <Ionicons name="checkmark" size={19} color={theme.primary} /> : null}
      </TouchableOpacity>
    );
  };

  const renderExercise: ListRenderItem<Exercise> = ({ item }) => {
    const imageUrl = resolvePublicMediaUrl(item.gifUrl, API_URL);

    return (
      <TouchableOpacity
        activeOpacity={0.72}
        onPress={() => navigation.navigate('ExerciseDetail', { exercise: item })}
        style={{
          minHeight: 76,
          marginHorizontal: horizontalPadding,
          paddingVertical: 10,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <View
          style={{
            ...exerciseThumbStyle(EXERCISE_THUMB.large),
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: imageUrl ? '#FFFFFF' : theme.surfaceLight,
          }}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <Ionicons name="barbell" size={24} color={theme.textMuted} />
          )}
        </View>
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
            {item.muscleGroup || t('exercises.muscle', 'Muscle')} · {item.equipment || t('exercises.equipment', 'Equipment')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={t('menu.exercises', 'Exercises')}
        actions={[
          {
            icon: 'add',
            onPress: () => setShowCreateModal(true),
            accessibilityLabel: t('exercises.create', 'Egzersiz olustur'),
          },
        ]}
      />

      <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: horizontalPadding, paddingTop: 4 }}>
        <Searchbar
          placeholder={t('exercises.search', 'Search exercises')}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{
            height: 44,
            borderRadius: 14,
            backgroundColor: theme.surfaceLight,
            elevation: 0,
          }}
          inputStyle={{ minHeight: 0, color: theme.text, fontSize: 14 }}
          placeholderTextColor={theme.textMuted}
          iconColor={theme.textMuted}
        />

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 16 }}>
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
                style={{
                  flex: 1,
                  minHeight: 42,
                  paddingHorizontal: 11,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderRadius: 10,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: active ? theme.primary : theme.border,
                  backgroundColor: active ? theme.primarySoft : theme.surface,
                }}
              >
                <Ionicons
                  name={filter.icon}
                  size={17}
                  color={active ? theme.primary : theme.textSecondary}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    marginHorizontal: 7,
                    color: active ? theme.primary : theme.textSecondary,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {filterLabel(filter.type, filter.value)}
                </Text>
                <Ionicons name="chevron-down" size={15} color={theme.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}>
            {t('exercises.all_exercises', 'All exercises')}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700' }}>
            {exercises.length}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={exercises}
          keyExtractor={(item) => item._id}
          renderItem={renderExercise}
          style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}
          contentContainerStyle={{ paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreExercises}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                size="small"
                color={theme.primary}
                style={{ paddingVertical: 18 }}
              />
            ) : null
          }
          ListEmptyComponent={
            <Surface
              elevation={0}
              style={{
                marginHorizontal: horizontalPadding,
                marginTop: 4,
                padding: 24,
                alignItems: 'center',
                borderRadius: 12,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.border,
                backgroundColor: theme.surface,
              }}
            >
              <Ionicons name="search-outline" size={27} color={theme.textMuted} />
              <Text style={{ marginTop: 10, color: theme.text, fontSize: 15, fontWeight: '700' }}>
                {t('exercises.not_found', 'No exercises found')}
              </Text>
              <Text style={{ marginTop: 4, color: theme.textMuted, fontSize: 12, textAlign: 'center' }}>
                {t('exercises.try_filters', 'Try another search or clear a filter.')}
              </Text>
            </Surface>
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
          <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <Text style={{ color: theme.text, fontSize: 19, fontWeight: '800' }}>
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
