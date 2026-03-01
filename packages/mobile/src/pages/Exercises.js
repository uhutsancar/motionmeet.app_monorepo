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

const Exercises = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme);
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

  const muscleGroups = [
    "all", "Abdominals", "Abductors", "Adductors", "Biceps", "Calves", "Chest",
    "Forearms", "Glutes", "Hamstrings", "Lats", "Lower Back", "Middle Back",
    "Neck", "Quadriceps", "Shoulders", "Traps", "Triceps"
  ];

  const equipmentList = [
    "all", "Barbell", "Dumbbell", "Kettlebell", "Machine", "Cable",
    "Bodyweight", "Band", "Plate", "Other"
  ];

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

  const fetchExerciseStats = async (exercise) => {
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
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchExercises();
    }, 400);

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

        {/* Filter Pills */}
        <View style={styles.filtersWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPills}>
            <TouchableOpacity 
              style={[styles.pill, muscleFilter !== 'all' && styles.pillActive]} 
              onPress={() => openFilter('muscle')}
            >
              <Ionicons name="fitness-outline" size={16} color={muscleFilter !== 'all' ? '#fff' : theme.primary} />
              <Text style={[styles.pillText, muscleFilter !== 'all' && styles.pillTextActive]}>
                {muscleFilter === 'all' ? t('exercises.muscle', 'Muscle') : muscleFilter}
              </Text>
              <Ionicons name="chevron-down" size={14} color={muscleFilter !== 'all' ? '#fff' : theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.pill, equipmentFilter !== 'all' && styles.pillActive]} 
              onPress={() => openFilter('equipment')}
            >
              <Ionicons name="barbell-outline" size={16} color={equipmentFilter !== 'all' ? '#fff' : theme.primary} />
              <Text style={[styles.pillText, equipmentFilter !== 'all' && styles.pillTextActive]}>
                {equipmentFilter === 'all' ? t('exercises.equipment', 'Equipment') : equipmentFilter}
              </Text>
              <Ionicons name="chevron-down" size={14} color={equipmentFilter !== 'all' ? '#fff' : theme.textMuted} />
            </TouchableOpacity>
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator color={theme.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={exercises}
            keyExtractor={(item) => item._id}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={<Text style={styles.listHeader}>{t('exercises.library', 'Library')}</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.exerciseCard}
                onPress={() => fetchExerciseStats(item)}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name="barbell" size={24} color={theme.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.exerciseName}>{item.name}</Text>
                  <View style={styles.badgeRow}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.muscleGroup}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: theme.surfaceLight }]}>
                      <Text style={[styles.badgeText, { color: theme.textMuted }]}>{item.equipment}</Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.border} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={64} color={theme.border} />
                <Text style={styles.emptyTitle}>{t('exercises.not_found', 'No results')}</Text>
                <Text style={styles.emptySubtitle}>{t('exercises.try_another', 'Try changing your filters or search term.')}</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 40 }}
          />
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
              data={filterType === 'muscle' ? muscleGroups : equipmentList}
              renderItem={renderFilterItem}
              keyExtractor={(item) => item}
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} transparent animationType="fade" onRequestClose={() => setShowDetailModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
             <TouchableOpacity style={styles.closeDetailBtn} onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
             </TouchableOpacity>
             
             <View style={styles.detailHeaderCenter}>
                <View style={[styles.iconContainer, { width: 70, height: 70, borderRadius: 25, marginBottom: 15 }]}>
                  <Ionicons name="barbell" size={32} color={theme.primary} />
                </View>
                <Text style={styles.detailTitle}>{selectedExercise?.name}</Text>
                <View style={[styles.badgeRow, { marginTop: 10 }]}>
                    <View style={styles.badge}><Text style={styles.badgeText}>{selectedExercise?.muscleGroup}</Text></View>
                    <View style={[styles.badge, { backgroundColor: theme.surfaceLight }]}><Text style={[styles.badgeText, { color: theme.textMuted }]}>{selectedExercise?.equipment}</Text></View>
                </View>
             </View>

             <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                   <Text style={styles.statLabel}>{t('exercises.personal_record', 'Personal Record')}</Text>
                   <Text style={styles.statValue}>{exerciseStats?.personalRecord || 0} <Text style={{fontSize: 14, color: theme.textMuted}}>kg</Text></Text>
                </View>
                <View style={styles.statBox}>
                   <Text style={styles.statLabel}>{t('exercises.total_sessions', 'Total Sessions')}</Text>
                   <Text style={styles.statValue}>{exerciseStats?.totalSessions || 0}</Text>
                </View>
             </View>

             <View style={styles.chartSection}>
                <Text style={styles.chartLabel}>{t('exercises.progress_history', 'Progress History')}</Text>
                {statsLoading ? (
                  <ActivityIndicator color={theme.primary} style={{ marginVertical: 30 }} />
                ) : exerciseStats?.history?.length > 1 ? (
                  <View style={styles.miniChart}>
                    <View style={{ height: 80, flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>
                      {exerciseStats.history.slice(-10).map((h, i) => (
                        <View key={i} style={{ 
                          flex: 1, 
                          height: `${Math.max(15, (h.maxWeight / Math.max(...exerciseStats.history.map(x => x.maxWeight), 1)) * 100)}%`, 
                          backgroundColor: theme.primary, 
                          borderRadius: 6,
                          opacity: 0.4 + (i * 0.06) 
                        }} />
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                        <Text style={{ fontSize: 10, color: theme.textMuted }}>{moment(exerciseStats.history[0].date).format("MMM DD")}</Text>
                        <Text style={{ fontSize: 10, color: theme.textMuted }}>{moment(exerciseStats.history[exerciseStats.history.length-1].date).format("MMM DD")}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noDataBox}>
                    <Ionicons name="analytics-outline" size={32} color={theme.border} />
                    <Text style={styles.noDataText}>{t('exercises.more_sessions_needed', 'Keep training to see your progress!')}</Text>
                  </View>
                )}
             </View>

             <TouchableOpacity style={styles.doneBtn} onPress={() => setShowDetailModal(false)}>
                <Text style={styles.doneBtnText}>{t('common.done', 'Done')}</Text>
             </TouchableOpacity>
          </View>
        </View>
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
  filtersWrapper: { marginBottom: 20 },
  filterPills: { gap: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, gap: 8 },
  pillActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  pillText: { fontSize: 14, fontWeight: '700', color: theme.text },
  pillTextActive: { color: '#fff' },
  listHeader: { fontSize: 12, fontWeight: '800', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 },
  exerciseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, padding: 16, borderRadius: 22, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  iconContainer: { width: 52, height: 52, borderRadius: 18, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', marginRight: 16, borderWidth: 1, borderColor: theme.border },
  cardInfo: { flex: 1 },
  exerciseName: { fontSize: 17, fontWeight: 'bold', color: theme.text, marginBottom: 6 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: theme.primary + '15' },
  badgeText: { fontSize: 10, fontWeight: '800', color: theme.primary, textTransform: 'uppercase' },
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
