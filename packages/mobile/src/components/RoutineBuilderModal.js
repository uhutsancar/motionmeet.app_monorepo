import React, { useState, useEffect } from 'react';
import { Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { Surface, TouchableRipple, Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from "../context/AuthProvider";
import { setAuthToken } from '../api/client';
import { getExercises, createRoutine } from '../api/endpoints';
import Toast from 'react-native-toast-message';

const RoutineBuilderModal = ({ visible, onClose, onRoutineCreated }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const styles = getStyles(theme);

  const [name, setName] = useState("");
  const [folder, setFolder] = useState("My Routines");
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [exercisesData, setExercisesData] = useState([]);
  const [loadingEx, setLoadingEx] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load all exercises when modal opens; filter when user types
  useEffect(() => {
    if (!visible) return;
    const fetchEx = async () => {
      try {
        setLoadingEx(true);
        const token = await getToken();
        const data = await getExercises({ search: searchQuery.trim() }, token);
        if (data.success) setExercisesData(data.exercises);
      } catch (error) {
        console.error('Exercise search error:', error);
      } finally {
        setLoadingEx(false);
      }
    };
    const delay = searchQuery.trim().length > 0 ? setTimeout(fetchEx, 400) : (fetchEx(), undefined);
    return () => clearTimeout(delay);
  }, [searchQuery, visible]);

  const addExercise = (ex) => {
    if (selectedExercises.find(e => e.exerciseId._id === ex._id)) {
      Toast.show({ type: 'info', text1: t('common.error'), text2: t('routines.already_added', 'Zaten eklendi') });
      return;
    }
    const newEx = {
      exerciseId: ex,
      sets: [{ setType: 'normal', reps: 0, weight: 0, completed: false }]
    };
    setSelectedExercises([...selectedExercises, newEx]);
    setSearchQuery("");
  };

  const removeExercise = (id) => {
    setSelectedExercises(selectedExercises.filter(e => e.exerciseId._id !== id));
  };

  const addSet = (exIndex) => {
    const updated = [...selectedExercises];
    updated[exIndex].sets.push({ setType: 'normal', reps: 0, weight: 0, completed: false });
    setSelectedExercises(updated);
  };

  const updateSet = (exIndex, setIndex, field, value) => {
    const updated = [...selectedExercises];
    updated[exIndex].sets[setIndex][field] = value;
    setSelectedExercises(updated);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('routines.name_required', 'Rutin adı gerekli'));
      return;
    }
    if (selectedExercises.length === 0) {
      Alert.alert(t('common.error'), t('routines.add_exercises_first', 'Önce egzersiz ekle'));
      return;
    }

    try {
      setSaving(true);

      // Always fetch a fresh token before saving
      const freshToken = await getToken();
      if (freshToken) setAuthToken(freshToken);

      const payload = {
        name: name.trim(),
        folder,
        exercises: selectedExercises.map(e => ({
          exerciseId: e.exerciseId._id,
          sets: e.sets
        }))
      };

      const data = await createRoutine(payload, freshToken);
      if (data.success) {
        Alert.alert(t('common.success', 'Başarılı'), t('routines.routine_created', 'Rutin oluşturuldu!'));
        onRoutineCreated(data.routine);
        handleClose();
      } else {
        Alert.alert(t('common.error'), data.message || t('common.error', 'Bir hata oluştu'));
      }
    } catch (error) {
      console.error('Routine save error:', error.response?.data || error.message);
      Alert.alert(t('common.error'), error.response?.data?.message || error.message || t('common.error', 'Bir hata oluştu'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setName("");
    setSelectedExercises([]);
    setSearchQuery("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <Surface elevation={0} style={styles.modalContent}>
          <Surface elevation={0} style={styles.header}>
            <TouchableRipple borderless onPress={handleClose} style={styles.iconBtn}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableRipple>
            <Text style={styles.headerTitle}>{t('routines.build_routine', 'Rutin Oluştur')}</Text>
            <TouchableRipple borderless onPress={handleSubmit} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
              <Text style={styles.saveBtnText}>{t('routines.save', 'Kaydet')}</Text>
            </TouchableRipple>
          </Surface>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Surface elevation={0} style={styles.inputGroup}>
              <Text style={styles.label}>{t('routines.routine_name', 'Rutin Adı')}</Text>
              <TextInput 
                style={styles.input} 
                value={name} 
                onChangeText={setName} 
                placeholder={t('routines.routine_name', 'Rutin Adı')} 
                placeholderTextColor={theme.textMuted} 
              />
            </Surface>

            <Surface elevation={0} style={styles.searchSection}>
              <Text style={styles.label}>{t('routines.add_exercises', 'Egzersiz Ekle')}</Text>
              <Surface elevation={0} style={styles.searchBar}>
                <Ionicons name="search" size={18} color={theme.textMuted} />
                <TextInput 
                  style={styles.searchInt} 
                  placeholder={t('routines.search_exercise', 'Egzersiz ara...')} 
                  value={searchQuery} 
                  onChangeText={setSearchQuery} 
                  placeholderTextColor={theme.textMuted}
                />
              </Surface>

            {/* Always show exercise list (search filters it) */}
              <Surface elevation={0} style={styles.searchResults}>
                {loadingEx ? (
                  <ActivityIndicator size="small" color={theme.primary} style={{ padding: 12 }} />
                ) : exercisesData.length === 0 ? (
                  <Text style={{ color: theme.textMuted, padding: 12, textAlign: 'center' }}>
                    {t('exercises.not_found', 'Egzersiz bulunamadı')}
                  </Text>
                ) : (
                  exercisesData.slice(0, 20).map(ex => (
                    <TouchableRipple borderless key={ex._id} onPress={() => addExercise(ex)} style={styles.resItem}>
                      <Surface elevation={0} style={{ flex: 1 }}>
                        <Text style={{ color: theme.text, fontWeight: '500' }}>{ex.name}</Text>
                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>{ex.muscleGroup} • {ex.equipment}</Text>
                      </Surface>
                      <Ionicons name="add-circle-outline" size={22} color={theme.primary} />
                    </TouchableRipple>
                  ))
                )}
              </Surface>
            </Surface>

            {selectedExercises.map((se, exIndex) => (
              <Surface elevation={0} key={exIndex} style={styles.exCard}>
                <Surface elevation={0} style={styles.exCardHeader}>
                  <Text style={styles.exName}>{se.exerciseId.name}</Text>
                  <TouchableRipple borderless onPress={() => removeExercise(se.exerciseId._id)}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableRipple>
                </Surface>

                {se.sets.map((set, setIndex) => (
                  <Surface elevation={0} key={setIndex} style={styles.setRow}>
                    <Text style={styles.setText}>{setIndex + 1}</Text>
                    <TextInput 
                      style={styles.setInt} 
                      keyboardType="numeric" 
                      value={set.weight.toString()} 
                      onChangeText={(v) => updateSet(exIndex, setIndex, 'weight', Number(v))}
                    />
                    <Text style={styles.setUnit}>{t('common.kg', 'kg')}</Text>
                    <TextInput 
                      style={styles.setInt} 
                      keyboardType="numeric" 
                      value={set.reps.toString()} 
                      onChangeText={(v) => updateSet(exIndex, setIndex, 'reps', Number(v))}
                    />
                    <Text style={styles.setUnit}>{t('routines.reps', 'Tekrar')}</Text>
                  </Surface>
                ))}

                <TouchableRipple borderless onPress={() => addSet(exIndex)} style={styles.addSetBtn}>
                  <Text style={styles.addSetText}>+ {t('routines.add_set', 'SET EKLE')}</Text>
                </TouchableRipple>
              </Surface>
            ))}

            <Surface elevation={0} style={{ height: 100 }} />
          </ScrollView>
        </Surface>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const getStyles = (theme) => ({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerTitle: { color: theme.text, fontSize: 18, fontWeight: 'bold' },
  iconBtn: { padding: 4 },
  saveBtn: { backgroundColor: theme.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
  scroll: { padding: 20 },
  inputGroup: { marginBottom: 4 },
  searchSection: { marginBottom: 4 },
  label: { color: theme.text, fontWeight: 'bold', marginBottom: 8 },
  input: { backgroundColor: theme.surfaceLight, borderRadius: 12, padding: 12, color: theme.text, marginBottom: 20 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceLight, borderRadius: 12, paddingHorizontal: 12, marginBottom: 10 },
  searchInt: { flex: 1, padding: 12, color: theme.text },
  searchResults: { backgroundColor: theme.surfaceLight, borderRadius: 12, padding: 8, marginBottom: 20 },
  resItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  exCard: { backgroundColor: theme.surfaceLight, borderRadius: 16, padding: 16, marginBottom: 16 },
  exCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  exName: { color: theme.text, fontWeight: 'bold' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  setText: { color: theme.textMuted, width: 20 },
  setInt: { backgroundColor: theme.background, borderRadius: 8, padding: 6, width: 60, textAlign: 'center', color: theme.text },
  setUnit: { color: theme.textMuted, fontSize: 12 },
  addSetBtn: { marginTop: 10, alignSelf: 'center' },
  addSetText: { color: theme.primary, fontWeight: 'bold', fontSize: 12 }
});

export default RoutineBuilderModal;
