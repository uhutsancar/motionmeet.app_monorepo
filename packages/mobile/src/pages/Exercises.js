import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, ActivityIndicator, Modal, FlatList, Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import CustomExerciseModal from '../components/CustomExerciseModal';
import moment from 'moment';

const { height, width } = Dimensions.get('window');

const MUSCLE_GROUPS = [
  "all", "Abdominals", "Abductors", "Adductors", "Biceps", "Calves", "Chest",
  "Forearms", "Glutes", "Hamstrings", "Lats", "Lower Back", "Middle Back",
  "Neck", "Quadriceps", "Shoulders", "Traps", "Triceps"
];

const EQUIPMENT_LIST = [
  "all", "Barbell", "Dumbbell", "Kettlebell", "Machine", "Cable",
  "Bodyweight", "Band", "Plate", "Other"
];

const Exercises = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("all");
  const [equipmentFilter, setEquipmentFilter] = useState("all");
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [exerciseStats, setExerciseStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [filterType, setFilterType] = useState(null); // 'muscle' | 'equipment'

  // Memoize styles to prevent recreation on every render
  const styles = React.useMemo(() => getStyles(theme), [theme]);

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

  const navigateToDetail = async (exercise) => {
    // Navigate to dedicated detail screen which handles its own stats fetch
    if (navigation) {
      navigation.navigate('ExerciseDetail', { exercise });
    } else {
      // Fallback: open in-page modal
      setSelectedExercise(exercise);
      setShowDetailModal(true);
      setExerciseStats(null);
      setStatsLoading(true);
      try {
        const { data } = await api.get(`/api/exercise/${exercise._id}/stats`);
        if (data.success) {
          setExerciseStats(data.stats);
        }
      } catch (error) {
        console.error("Error fetching exercise stats:", error);
      } finally {
        setStatsLoading(false);
      }
    }
  };

  useEffect(() => {
    // Better debouncing: wait 500ms after last keystroke before fetching
    const delayDebounceFn = setTimeout(() => {
      fetchExercises();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, muscleFilter, equipmentFilter]);

  const openFilter = (type) => {
    setFilterType(type);
    setShowFilterModal(true);
  };

  const selectFilter = (value) => {
    if (filterType === 'muscle') setMuscleFilter(value);
    else setEquipmentFilter(value);
    setShowFilterModal(false);
  };

  const renderFilterItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.filterItem, (filterType === 'muscle' ? muscleFilter === item : equipmentFilter === item) && styles.filterItemActive]}
      onPress={() => selectFilter(item)}
    >
      <Text style={[styles.filterItemText, (filterType === 'muscle' ? muscleFilter === item : equipmentFilter === item) && styles.filterItemTextActive]}>
        {item === 'all' ? (filterType === 'muscle' ? t('exercises.all_muscles', 'All Muscles') : t('exercises.all_equipment', 'All Equipment')) : item}
      </Text>
      {(filterType === 'muscle' ? muscleFilter === item : equipmentFilter === item) && (
        <Ionicons name="checkmark" size={20} color={theme.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('menu.exercises', 'Exercises')}</Text>
          <Text style={styles.headerSubtitle}>{exercises.length} {t('exercises.available', 'available')}</Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
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
          {searchQuery !== "" && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Buttons */}
        <View style={styles.filtersWrapper}>
          <TouchableOpacity 
            style={styles.filterBlockBtn} 
            onPress={() => openFilter('equipment')}
          >
            <Text style={styles.filterBlockText}>
              {equipmentFilter === 'all' ? t('exercises.all_equipment', 'Tüm Ekipmanlar') : equipmentFilter}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.filterBlockBtn} 
            onPress={() => openFilter('muscle')}
          >
            <Text style={styles.filterBlockText}>
              {muscleFilter === 'all' ? t('exercises.all_muscles', 'Tüm Kaslar') : muscleFilter}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator color={theme.primary} size="large" />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.listHeader}>{t('exercises.recent', 'Son Egzersizler')}</Text>
            {exercises.slice(0, 4).map((item) => (
              <TouchableOpacity 
                key={`recent-${item._id}`}
                style={styles.exerciseCard}
                onPress={() => navigateToDetail(item)}
              >
                <View style={[styles.imageCircle, { backgroundColor: theme.surface }]}>
                  <Ionicons name="body" size={32} color={theme.textMuted} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.exerciseName}>{item.name}</Text>
                  <Text style={styles.exerciseDesc}>{item.muscleGroup} • {item.equipment}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            ))}

            <Text style={[styles.listHeader, { marginTop: 10 }]}>{t('exercises.all', 'Tüm Egzersizler')}</Text>
            {exercises.map((item) => (
              <TouchableOpacity 
                key={`all-${item._id}`}
                style={styles.exerciseCard}
                onPress={() => navigateToDetail(item)}
              >
                <View style={[styles.imageCircle, { backgroundColor: theme.surface }]}>
                  <Ionicons name="body" size={32} color={theme.textMuted} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.exerciseName}>{item.name}</Text>
                  <Text style={styles.exerciseDesc}>{item.muscleGroup} • {item.equipment}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Filter Modal */}
      <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFilterModal(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalKnob} />
              <Text style={styles.modalTitle}>
                {filterType === 'muscle' ? t('exercises.select_muscle', 'Select Muscle Group') : t('exercises.select_equipment', 'Select Equipment')}
              </Text>
            </View>
                <FlatList
                  data={filterType === 'muscle' ? MUSCLE_GROUPS : EQUIPMENT_LIST}
                  renderItem={renderFilterItem}
                  keyExtractor={item => item}
                  showsVerticalScrollIndicator={false}
                />
          </View>
        </TouchableOpacity>
      </Modal>

      <CustomExerciseModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} onExerciseCreated={(newEx) => setExercises([newEx, ...exercises])} />
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: 20, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 28, fontWeight: '900', color: theme.text, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: theme.textMuted, fontWeight: '600', marginTop: 2 },
  addButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  content: { flex: 1, paddingHorizontal: 20 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, height: 54, marginBottom: 16 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: '100%', color: theme.text, fontSize: 16, fontWeight: '500' },
  filtersWrapper: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  filterBlockBtn: { flex: 1, backgroundColor: theme.surface, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  filterBlockText: { color: theme.text, fontSize: 14, fontWeight: '600' },
  listHeader: { fontSize: 14, fontWeight: '600', color: theme.textMuted, marginBottom: 8, paddingHorizontal: 4 },
  exerciseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.background, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
  imageCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginRight: 16, overflow: 'hidden' },
  cardInfo: { flex: 1 },
  exerciseName: { fontSize: 16, fontWeight: '500', color: theme.text, marginBottom: 4 },
  exerciseDesc: { fontSize: 13, color: theme.textMuted },
  loadingWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { paddingTop: 60, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: theme.textMuted, textAlign: 'center', marginTop: 8, paddingHorizontal: 40, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: theme.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: height * 0.7, paddingHorizontal: 20 },
  modalHeader: { alignItems: 'center', paddingVertical: 15 },
  modalKnob: { width: 40, height: 5, borderRadius: 3, backgroundColor: theme.border, marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text },
  filterItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  filterItemActive: {},
  filterItemText: { fontSize: 16, color: theme.text, fontWeight: '500' },
  filterItemTextActive: { color: theme.primary, fontWeight: 'bold' },
  detailCard: { backgroundColor: theme.surface, borderRadius: 35, padding: 25, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  closeDetailBtn: { position: 'absolute', top: 20, right: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' },
  detailHeaderCenter: { alignItems: 'center', marginTop: 10 },
  detailTitle: { fontSize: 24, fontWeight: '900', color: theme.text, textAlign: 'center' },
  statsGrid: { flexDirection: 'row', gap: 12, marginTop: 25 },
  statBox: { flex: 1, backgroundColor: theme.background, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: theme.border },
  statLabel: { fontSize: 10, fontWeight: '800', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 5 },
  statValue: { fontSize: 22, fontWeight: '900', color: theme.text },
  chartSection: { marginTop: 25, backgroundColor: theme.background, borderRadius: 25, padding: 20, borderWidth: 1, borderColor: theme.border },
  chartLabel: { fontSize: 12, fontWeight: '800', color: theme.text, marginBottom: 15 },
  miniChart: { width: '100%' },
  noDataBox: { alignItems: 'center', py: 20 },
  noDataText: { fontSize: 12, color: theme.textMuted, textAlign: 'center', marginTop: 10, fontWeight: '500' },
  doneBtn: { backgroundColor: theme.primary, borderRadius: 20, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: 25 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default Exercises;
