// React Native's Image is used on purpose: Expo Go ships its own native
// expo-image build, and when it disagrees with the version installed here the
// view renders blank instead of erroring, so exercise photos and GIFs vanish.
import React, { useEffect, useRef, useState } from 'react';
import { Image, TextInput, ActivityIndicator, View, StyleSheet } from 'react-native';
import { Surface, TouchableRipple, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from "../context/AuthProvider";
import { setAuthToken } from '../api/client';
import { getExercises, createRoutine } from '../api/endpoints';
import { BottomSheetModal } from './ResponsiveModal';
import KeyboardAwareScrollView from './KeyboardAwareScrollView';
import {
  CONTENT_LIMITS,
  createOperationId,
  resolvePublicMediaUrl,
  type Exercise,
  type ExerciseSet,
  type Routine,
} from '@motionmeet/shared';
import { API_URL } from '../config/environment';
import { EXERCISE_THUMB, exerciseThumbStyle } from '../config/layout';
import {
  getUserFacingError,
  logHandledError,
  showError,
  showInfo,
  showSuccess,
} from '../utils/feedback';

interface RoutineBuilderModalProps {
  visible: boolean;
  onClose: () => void;
  onRoutineCreated: (routine: Routine) => void;
}

interface SelectedExercise {
  exerciseId: Exercise;
  sets: ExerciseSet[];
}

const RoutineBuilderModal = ({ visible, onClose, onRoutineCreated }: RoutineBuilderModalProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const styles = getStyles(theme);

  const [name, setName] = useState("");
  const [folder, setFolder] = useState("My Routines");
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [exercisesData, setExercisesData] = useState<Exercise[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);
  const [saving, setSaving] = useState(false);
  const operationIdRef = useRef<string | null>(null);

  const invalidateDraft = () => {
    operationIdRef.current = null;
  };

  // Load all exercises when modal opens; filter when user types
  useEffect(() => {
    if (!visible) return;
    const fetchEx = async () => {
      try {
        setLoadingEx(true);
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        const data = await getExercises({ search: searchQuery.trim() }, token);
        if (data.success) setExercisesData(data.exercises);
      } catch (error) {
        logHandledError('routine-exercise-search', error);
      } finally {
        setLoadingEx(false);
      }
    };
    const delay = searchQuery.trim().length > 0 ? setTimeout(fetchEx, 400) : (fetchEx(), undefined);
    return () => {
      if (delay) clearTimeout(delay);
    };
  }, [getToken, searchQuery, visible]);

  const addExercise = (ex: Exercise) => {
    if (saving) return;
    if (selectedExercises.find(e => e.exerciseId._id === ex._id)) {
      showInfo(t('common.info', 'Bilgi'), t('routines.already_added', 'Zaten eklendi'));
      return;
    }
    const newEx: SelectedExercise = {
      exerciseId: ex,
      sets: [{ setType: 'normal', reps: 0, weight: 0, completed: false }]
    };
    setSelectedExercises([...selectedExercises, newEx]);
    setSearchQuery("");
    invalidateDraft();
  };

  const removeExercise = (id: string) => {
    if (saving) return;
    setSelectedExercises(selectedExercises.filter(e => e.exerciseId._id !== id));
    invalidateDraft();
  };

  const addSet = (exIndex: number) => {
    if (saving) return;
    const updated = [...selectedExercises];
    updated[exIndex].sets.push({ setType: 'normal', reps: 0, weight: 0, completed: false });
    setSelectedExercises(updated);
    invalidateDraft();
  };

  const updateSet = (
    exIndex: number,
    setIndex: number,
    field: 'reps' | 'weight',
    value: number,
  ) => {
    if (saving) return;
    const updated = [...selectedExercises];
    updated[exIndex].sets[setIndex][field] = value;
    setSelectedExercises(updated);
    invalidateDraft();
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (!name.trim()) {
      showError(t('common.error'), t('routines.name_required', 'Rutin adı gerekli'));
      return;
    }
    if (selectedExercises.length === 0) {
      showError(t('common.error'), t('routines.add_exercises_first', 'Önce egzersiz ekle'));
      return;
    }

    try {
      setSaving(true);

      // Always fetch a fresh token before saving
      const freshToken = await getToken();
      if (!freshToken) throw new Error('Authentication required');
      if (freshToken) setAuthToken(freshToken);

      operationIdRef.current ||= createOperationId('routine');
      const payload = {
        operationId: operationIdRef.current,
        name: name.trim(),
        folder,
        exercises: selectedExercises.map(e => ({
          exerciseId: e.exerciseId._id,
          sets: e.sets
        }))
      };

      const data = await createRoutine(payload, freshToken);
      if (data.success) {
        showSuccess(t('common.success', 'Başarılı'), t('routines.routine_created', 'Rutin oluşturuldu!'));
        onRoutineCreated(data.routine);
        setName("");
        setFolder("My Routines");
        setSelectedExercises([]);
        setSearchQuery("");
        operationIdRef.current = null;
        onClose?.();
      } else {
        showError(t('common.error'), data.message || t('common.error', 'Bir hata oluştu'));
      }
    } catch (error) {
      logHandledError('create-routine', error);
      showError(
        t('common.error'),
        getUserFacingError(error, t('routines.create_failed', 'Rutin oluşturulamadı.')),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setName("");
    setSelectedExercises([]);
    setSearchQuery("");
    operationIdRef.current = null;
    onClose();
  };

  return (
    <BottomSheetModal
      visible={visible}
      onRequestClose={handleClose}
      backgroundColor={theme.background}
      heightRatio={0.94}
      dismissOnBackdrop={!saving}
    >
        <Surface elevation={0} style={styles.modalContent}>
          <Surface elevation={0} style={styles.header}>
            <TouchableRipple borderless onPress={handleClose} disabled={saving} style={styles.iconBtn}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableRipple>
            <Text
              style={styles.headerTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {t('routines.build_routine', 'Rutin Oluştur')}
            </Text>
            <TouchableRipple borderless onPress={handleSubmit} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
              <Text style={styles.saveBtnText}>{t('routines.save', 'Kaydet')}</Text>
            </TouchableRipple>
          </Surface>

          <KeyboardAwareScrollView
            avoidKeyboard
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Surface elevation={0} style={styles.inputGroup}>
              <Text style={styles.label}>{t('routines.routine_name', 'Rutin Adı')}</Text>
              <TextInput 
                style={styles.input} 
                value={name} 
                editable={!saving}
                maxLength={CONTENT_LIMITS.routineName}
                onChangeText={(value) => {
                  setName(value);
                  invalidateDraft();
                }}
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
                  editable={!saving}
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
                  exercisesData.slice(0, 20).map(ex => {
                    const mediaUrl = resolvePublicMediaUrl(ex.gifUrl, API_URL);
                    return (
                    <TouchableRipple borderless key={ex._id} onPress={() => addExercise(ex)} disabled={saving} style={styles.resItem}>
                      <Surface
                        elevation={0}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' }}
                      >
                        <Surface elevation={0} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' }}>
                          <Surface elevation={0} style={{ ...exerciseThumbStyle(EXERCISE_THUMB.small), overflow: 'hidden', backgroundColor: mediaUrl ? '#FFFFFF' : theme.surfaceLight, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                            {mediaUrl ? (
                              <Image source={{ uri: mediaUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            ) : (
                              <Ionicons name="barbell" size={20} color={theme.textMuted} />
                            )}
                          </Surface>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text numberOfLines={2} style={{ color: theme.text, fontWeight: '500' }}>{ex.name}</Text>
                            <Text numberOfLines={1} style={{ color: theme.textMuted, fontSize: 12 }}>{ex.muscleGroup} • {ex.equipment}</Text>
                          </View>
                        </Surface>
                        <Ionicons name="add-circle-outline" size={22} color={theme.primary} />
                      </Surface>
                    </TouchableRipple>
                    );
                  })
                )}
              </Surface>
            </Surface>

            {selectedExercises.map((se, exIndex) => {
              const selectedMediaUrl = resolvePublicMediaUrl(se.exerciseId.gifUrl, API_URL);
              return (
              <Surface elevation={0} key={exIndex} style={styles.exCard}>
                <Surface elevation={0} style={styles.exCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <Surface elevation={0} style={{ ...exerciseThumbStyle(EXERCISE_THUMB.small), overflow: 'hidden', backgroundColor: selectedMediaUrl ? '#FFFFFF' : theme.surfaceLight, marginRight: 10, alignItems: 'center', justifyContent: 'center' }}>
                      {selectedMediaUrl ? (
                        <Image source={{ uri: selectedMediaUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <Ionicons name="barbell" size={18} color={theme.textMuted} />
                      )}
                    </Surface>
                    <Text numberOfLines={2} style={styles.exName}>{se.exerciseId.name}</Text>
                  </View>
                  <TouchableRipple borderless onPress={() => removeExercise(se.exerciseId._id)} disabled={saving}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableRipple>
                </Surface>

                {se.sets.map((set, setIndex) => (
                  <Surface elevation={0} key={setIndex} style={styles.setRow}>
                    <Text style={styles.setText}>{setIndex + 1}</Text>
                    <View style={styles.setFieldGroup}>
                      <TextInput
                        style={styles.setInt}
                        keyboardType="numeric"
                        value={set.weight.toString()}
                        editable={!saving}
                        onChangeText={(v) => updateSet(exIndex, setIndex, 'weight', Number(v))}
                      />
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        style={styles.setUnit}
                      >
                        {t('common.kg', 'kg')}
                      </Text>
                    </View>
                    <View style={styles.setFieldGroup}>
                      <TextInput
                        style={styles.setInt}
                        keyboardType="numeric"
                        value={set.reps.toString()}
                        editable={!saving}
                        onChangeText={(v) => updateSet(exIndex, setIndex, 'reps', Number(v))}
                      />
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.62}
                        style={styles.setUnit}
                      >
                        {t('routines.reps', 'Tekrar')}
                      </Text>
                    </View>
                  </Surface>
                ))}

                <TouchableRipple borderless onPress={() => addSet(exIndex)} disabled={saving} style={styles.addSetBtn}>
                  <Text style={styles.addSetText}>+ {t('routines.add_set', 'SET EKLE')}</Text>
                </TouchableRipple>
              </Surface>
              );
            })}

            <View style={{ height: 100 }} />
          </KeyboardAwareScrollView>
        </Surface>
    </BottomSheetModal>
  );
};

const getStyles = (theme: MotionTheme) => StyleSheet.create({
  modalContent: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerTitle: { flex: 1, minWidth: 0, textAlign: 'center', color: theme.text, fontSize: 18, fontWeight: 'bold' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { backgroundColor: theme.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
  scroll: { flex: 1, padding: 20 },
  scrollContent: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: 40 },
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
  exName: { flex: 1, minWidth: 0, color: theme.text, fontWeight: 'bold' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  setText: { color: theme.textMuted, width: 20 },
  setFieldGroup: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  setInt: { flex: 1, minWidth: 0, backgroundColor: theme.background, borderRadius: 8, padding: 6, textAlign: 'center', color: theme.text },
  setUnit: { maxWidth: 42, color: theme.textMuted, fontSize: 12 },
  addSetBtn: { marginTop: 10, alignSelf: 'center' },
  addSetText: { color: theme.primary, fontWeight: 'bold', fontSize: 12 }
});

export default RoutineBuilderModal;
