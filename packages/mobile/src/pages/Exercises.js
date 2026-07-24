import React, { useCallback, useState, useEffect } from 'react';
import { View, FlatList, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Appbar, Searchbar, Chip, Surface, Text, IconButton, Modal, Portal, List } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from "../context/AuthProvider";
import { getExercises } from '../api/endpoints';
import CustomExerciseModal from '../components/CustomExerciseModal';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import { useMuscleGroups } from '../hooks/useMuscleGroups';
import { useEquipment } from '../hooks/useEquipment';

// Fallback to local server IP for static assets if needed
const API_BASE = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:4000';

const Exercises = ({ navigation }) => {
  const { theme } = useTheme();
  const { height } = useWindowDimensions();
  const { t } = useTranslation();
  const { getToken } = useAuthContext();

  const { data: muscleGroupsList } = useMuscleGroups();
  const { data: equipmentListItems } = useEquipment();

  const MUSCLE_GROUPS = ["all", ...muscleGroupsList.map(mg => mg.code)];
  const EQUIPMENT_LIST = ["all", ...equipmentListItems.map(eq => eq.code)];

  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("all");
  const [equipmentFilter, setEquipmentFilter] = useState("all");
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterType, setFilterType] = useState(null); // 'muscle' | 'equipment'

  const fetchExercises = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (muscleFilter !== "all") params.muscleGroup = muscleFilter;
      if (equipmentFilter !== "all") params.equipment = equipmentFilter;

      const token = await getToken();
      const data = await getExercises(params, token);
      if (data.success) {
        setExercises(data.exercises);
      }
    } catch (error) {
      console.error("Error fetching exercises:", error);
    } finally {
      setLoading(false);
    }
  }, [equipmentFilter, getToken, muscleFilter, searchQuery]);

  const navigateToDetail = (exercise) => {
    navigation.navigate('ExerciseDetail', { exercise });
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchExercises();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
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

  const renderFilterItem = ({ item }) => {
    const isActive = filterType === 'muscle' ? muscleFilter === item : equipmentFilter === item;
    
    let label = item;
    if (item === 'all') {
      label = filterType === 'muscle' ? t('exercises.all_muscles', 'All Muscles') : t('exercises.all_equipment', 'All Equipment');
    } else {
      label = filterType === 'muscle' 
        ? t(`muscle_groups.${item}`, muscleGroupsList.find(mg => mg.code === item)?.name || item)
        : t(`equipment.${item}`, equipmentListItems.find(eq => eq.code === item)?.name || item);
    }

    return (
      <List.Item
        title={label}
        onPress={() => selectFilter(item)}
        titleStyle={{ color: isActive ? theme.primary : theme.text, fontWeight: isActive ? 'bold' : '500' }}
        right={props => isActive ? <List.Icon {...props} icon="check" color={theme.primary} /> : null}
        style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
      />
    );
  };

  const renderExercise = ({ item }) => {
    const imageUrl = item.gifUrl ? `${API_BASE}/dataset/${item.gifUrl.replace('.gif', '.jpg').replace('videos/', 'images/')}` : null;

    return (
      <Surface style={{ marginHorizontal: 16, marginBottom: 12, borderRadius: 16, backgroundColor: theme.surface }} elevation={1}>
        <List.Item
          onPress={() => navigateToDetail(item)}
          title={item.name}
          titleStyle={{ color: theme.text, fontWeight: 'bold' }}
          description={`${item.muscleGroup} • ${item.equipment}`}
          descriptionStyle={{ color: theme.textMuted }}
          left={props => (
            <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: theme.surfaceLight, justifyContent: 'center', alignItems: 'center', marginLeft: 8, overflow: 'hidden' }}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <Ionicons name="body" size={32} color={theme.textMuted} />
              )}
            </View>
          )}
          right={props => <List.Icon {...props} icon="chevron-right" color={theme.textMuted} />}
          style={{ paddingVertical: 8 }}
        />
      </Surface>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <Appbar.Header style={{ backgroundColor: theme.surface, elevation: 0, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Appbar.Content 
          title={t('menu.exercises', 'Exercises')} 
          titleStyle={{ fontSize: 24, fontWeight: '900', color: theme.text }}
        />
        <Appbar.Action icon="plus-circle" size={28} color={theme.primary} onPress={() => setShowCreateModal(true)} />
      </Appbar.Header>
      <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 16, marginBottom: 14 }}>
        <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.15, marginBottom: 4 }}>
          EXERCISE LIBRARY
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 14 }}>
          {exercises.length} {t('exercises.available', 'available')} · Find the right movement for your session.
        </Text>
        <Searchbar
          placeholder={t('exercises.search', 'Search Exercises')}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{ backgroundColor: theme.surface, borderRadius: 16, elevation: 0, borderWidth: 1, borderColor: theme.border }}
          inputStyle={{ color: theme.text }}
          placeholderTextColor={theme.textMuted}
          iconColor={theme.textMuted}
        />
      </View>

      <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 16 }}>
        <Chip 
          mode="outlined" 
          onPress={() => openFilter('equipment')} 
          style={{ flex: 1, backgroundColor: theme.surface, borderColor: theme.border }}
          textStyle={{ color: theme.text }}
          icon="dumbbell"
        >
          {equipmentFilter === 'all' ? t('exercises.all_equipment', 'All Equipment') : t(`equipment.${equipmentFilter}`, equipmentFilter)}
        </Chip>
        <Chip 
          mode="outlined" 
          onPress={() => openFilter('muscle')} 
          style={{ flex: 1, backgroundColor: theme.surface, borderColor: theme.border }}
          textStyle={{ color: theme.text }}
          icon="human"
        >
          {muscleFilter === 'all' ? t('exercises.all_muscles', 'All Muscles') : t(`muscle_groups.${muscleFilter}`, muscleFilter)}
        </Chip>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={item => item._id}
          renderItem={renderExercise}
          style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}
          contentContainerStyle={{ paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="barbell-outline" size={48} color={theme.border} />
              <Text style={{ marginTop: 16, color: theme.textMuted, fontSize: 16 }}>
                {t('exercises.not_found', 'No exercises found')}
              </Text>
            </View>
          }
        />
      )}

      <Portal>
        <Modal 
          visible={showFilterModal} 
          onDismiss={() => setShowFilterModal(false)}
          contentContainerStyle={{ backgroundColor: theme.background, margin: 20, borderRadius: 24, maxHeight: height * 0.7, padding: 0, overflow: 'hidden' }}
        >
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <Text variant="titleLarge" style={{ color: theme.text, fontWeight: 'bold' }}>
              {filterType === 'muscle' ? t('exercises.select_muscle', 'Select Muscle Group') : t('exercises.select_equipment', 'Select Equipment')}
            </Text>
          </View>
          <FlatList
            data={filterType === 'muscle' ? MUSCLE_GROUPS : EQUIPMENT_LIST}
            renderItem={renderFilterItem}
            keyExtractor={item => item}
          />
        </Modal>
      </Portal>

      <CustomExerciseModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} onExerciseCreated={(newEx) => setExercises([newEx, ...exercises])} />
    </SafeAreaView>
  );
};

export default Exercises;
