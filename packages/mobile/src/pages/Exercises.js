import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Appbar,
  List,
  Searchbar,
  Surface,
  Text,
} from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { resolvePublicMediaUrl } from '@motionmeet/shared';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import { getExercises } from '../api/endpoints';
import CustomExerciseModal from '../components/CustomExerciseModal';
import { useMuscleGroups } from '../hooks/useMuscleGroups';
import { useEquipment } from '../hooks/useEquipment';
import { API_URL } from '../config/environment';
import { BottomSheetModal } from '../components/ResponsiveModal';
import { logHandledError } from '../utils/feedback';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const Exercises = ({ navigation }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const { data: muscleGroupsList } = useMuscleGroups();
  const { data: equipmentListItems } = useEquipment();
  const { horizontalPadding } = useResponsiveLayout();

  const muscleGroups = ['all', ...muscleGroupsList.map((group) => group.code)];
  const equipment = ['all', ...equipmentListItems.map((item) => item.code)];
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('all');
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterType, setFilterType] = useState(null);

  const fetchExercises = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (muscleFilter !== 'all') params.muscleGroup = muscleFilter;
      if (equipmentFilter !== 'all') params.equipment = equipmentFilter;
      const token = await getToken();
      const data = await getExercises(params, token);
      if (data.success) setExercises(data.exercises || []);
    } catch (error) {
      logHandledError('load-exercises', error);
    } finally {
      setLoading(false);
    }
  }, [equipmentFilter, getToken, muscleFilter, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(fetchExercises, 400);
    return () => clearTimeout(timer);
  }, [fetchExercises]);

  const openFilter = (type) => {
    setFilterType(type);
    setShowFilterModal(true);
  };

  const selectFilter = (value) => {
    if (filterType === 'muscle') setMuscleFilter(value);
    else setEquipmentFilter(value);
    setShowFilterModal(false);
  };

  const filterLabel = (type, value) => {
    if (value === 'all') {
      return type === 'muscle'
        ? t('exercises.all_muscles', 'All muscles')
        : t('exercises.all_equipment', 'All equipment');
    }
    if (type === 'muscle') {
      return t(
        `muscle_groups.${value}`,
        muscleGroupsList.find((group) => group.code === value)?.name || value,
      );
    }
    return t(
      `equipment.${value}`,
      equipmentListItems.find((item) => item.code === value)?.name || value,
    );
  };

  const renderFilterItem = ({ item }) => {
    const selectedValue = filterType === 'muscle' ? muscleFilter : equipmentFilter;
    const isActive = selectedValue === item;
    return (
      <List.Item
        title={filterLabel(filterType, item)}
        onPress={() => selectFilter(item)}
        titleStyle={{
          color: isActive ? theme.primary : theme.text,
          fontSize: 14,
          fontWeight: isActive ? '800' : '600',
        }}
        right={(props) => (
          isActive ? <List.Icon {...props} icon="check" color={theme.primary} /> : null
        )}
        style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
      />
    );
  };

  const renderExercise = ({ item }) => {
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
            width: 54,
            height: 54,
            borderRadius: 10,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.surfaceLight,
          }}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <Ionicons name="barbell-outline" size={24} color={theme.textMuted} />
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
          title={t('menu.exercises', 'Exercises')}
          titleStyle={{ color: theme.text, fontSize: 23, fontWeight: '800' }}
        />
        <Appbar.Action icon="plus" color={theme.text} onPress={() => setShowCreateModal(true)} />
      </Appbar.Header>

      <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: horizontalPadding, paddingTop: 18 }}>
        <Text style={{ color: theme.text, fontSize: 21, lineHeight: 27, fontWeight: '800', letterSpacing: -0.3 }}>
          {t('exercises.library_title', 'Movement library')}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
          {t('exercises.library_subtitle', 'Search by name, muscle group or equipment.')}
        </Text>
        <Searchbar
          placeholder={t('exercises.search', 'Search exercises')}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{
            height: 46,
            marginTop: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            elevation: 0,
          }}
          inputStyle={{ minHeight: 0, color: theme.text, fontSize: 14 }}
          placeholderTextColor={theme.textMuted}
          iconColor={theme.textMuted}
        />

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 16 }}>
          {[
            { type: 'equipment', value: equipmentFilter, icon: 'barbell-outline' },
            { type: 'muscle', value: muscleFilter, icon: 'body-outline' },
          ].map((filter) => {
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
                  borderWidth: 1,
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
          data={exercises}
          keyExtractor={(item) => item._id}
          renderItem={renderExercise}
          style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}
          contentContainerStyle={{ paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Surface
              elevation={0}
              style={{
                marginHorizontal: horizontalPadding,
                marginTop: 4,
                padding: 24,
                alignItems: 'center',
                borderRadius: 12,
                borderWidth: 1,
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
        onExerciseCreated={(newExercise) => setExercises((current) => [newExercise, ...current])}
      />
    </SafeAreaView>
  );
};

export default Exercises;
