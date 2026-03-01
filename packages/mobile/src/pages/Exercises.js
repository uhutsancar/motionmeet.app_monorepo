import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import CustomExerciseModal from '../components/CustomExerciseModal';

const Exercises = () => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { t } = useTranslation();

  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("all");
  const [equipmentFilter, setEquipmentFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);

  const fetchExercises = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (muscleFilter !== "all") params.muscleGroup = muscleFilter;
      if (equipmentFilter !== "all") params.equipment = equipmentFilter;

      const { data } = await api.get('/api/exercise', { params });
      if (data.success) {
        setExercises(data.exercises);
      }
    } catch (error) {
      console.error("Error fetching exercises:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchExercises();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, muscleFilter, equipmentFilter]);

  const muscleFilterLabel = muscleFilter === 'all' ? t('exercises.muscle', 'Muscle') : muscleFilter;
  const equipmentFilterLabel = equipmentFilter === 'all' ? t('exercises.equipment', 'Equipment') : equipmentFilter;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('menu.exercises', 'Exercises')}</Text>
        <TouchableOpacity onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.textMuted} style={styles.searchIcon} />
          <TextInput 
            style={styles.searchInput}
            placeholder={t('exercises.search', 'Search Exercises')}
            placeholderTextColor={theme.textMuted}
            selectionColor={theme.primary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity style={styles.filterBtn}>
              <Text style={styles.filterBtnText}>{muscleFilterLabel}</Text>
              <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterBtn}>
              <Text style={styles.filterBtnText}>{equipmentFilterLabel}</Text>
              <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          </ScrollView>
        </View>

        <Text style={styles.listHeader}>{t('exercises.all', 'All Exercises')}</Text>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {exercises.length > 0 ? (
              exercises.map(ex => (
                <TouchableOpacity key={ex._id} style={styles.exerciseCard}>
                  <View style={styles.exerciseIcon}>
                    <Ionicons name="barbell" size={24} color={theme.primary} />
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {t('exercises.target_muscles', 'Target Muscles')}: {ex.muscleGroup} • {t('exercises.equipment', 'Equipment')}: {ex.equipment}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 }}>
                <Ionicons name="barbell-outline" size={48} color={theme.border} />
                <Text style={{ color: theme.textMuted, marginTop: 12, fontWeight: '600' }}>{t('exercises.not_found', 'No exercises found.')}</Text>
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>

      <CustomExerciseModal 
        visible={showModal} 
        onClose={() => setShowModal(false)} 
        onExerciseCreated={(newEx) => {
          setExercises([newEx, ...exercises]);
        }}
      />
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: theme.text,
    fontSize: 16,
  },
  filtersContainer: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 16,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterBtnText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  listHeader: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 8,
  },
  scrollView: {
    flex: 1,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  exerciseIcon: {
    width: 48,
    height: 48,
    backgroundColor: theme.surfaceLight || theme.background,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: theme.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  exerciseMeta: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});

export default Exercises;
