import React, { useState, useMemo } from 'react';
import { 
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from "../context/AuthProvider";
import { setAuthToken } from '../api/client';
import { createExercise } from '../api/endpoints';
import { Text, TextInput, Button, TouchableRipple, Surface } from 'react-native-paper';
import EquipmentAvatar from './EquipmentAvatar';
import ScreenHeader from './ScreenHeader';
import { useMuscleGroups } from '../hooks/useMuscleGroups';
import { useEquipment } from '../hooks/useEquipment';
import { BottomSheetModal } from './ResponsiveModal';
import KeyboardAwareScrollView from './KeyboardAwareScrollView';
import {
  getUserFacingError,
  logHandledError,
  showError,
} from '../utils/feedback';
import { CONTENT_LIMITS, type Exercise } from '@motionmeet/shared';

interface CustomExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onExerciseCreated?: (exercise: Exercise) => void;
}

const CustomExerciseModal = ({ visible, onClose, onExerciseCreated }: CustomExerciseModalProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [saving, setSaving] = useState(false);

  const [showMuscles, setShowMuscles] = useState(false);
  const [showEquipment, setShowEquipment] = useState(false);

  const { data: muscleGroupsList } = useMuscleGroups();
  const { data: equipmentListItems } = useEquipment();

  const muscleGroups = muscleGroupsList.map(mg => mg.code);
  const equipmentList = equipmentListItems.map(eq => eq.code);

  const handleSubmit = async () => {
    if (saving) return;
    if (!name.trim()) {
      showError(t('common.error'), t('exercises.missing_name', 'Exercise name is required'));
      return;
    }
    
    if (!muscleGroup || !equipment) {
      showError(t('common.error'), t('exercises.missing_fields', 'Please select muscle group and equipment'));
      return;
    }

    try {
      setSaving(true);

      const freshToken = await getToken();
      if (!freshToken) throw new Error('Authentication required');
      setAuthToken(freshToken);

      const data = await createExercise({
        name: name.trim(),
        muscleGroup,
        equipment,
      }, freshToken);

      if (data.success) {
        if (onExerciseCreated) onExerciseCreated(data.exercise);
        resetDraft();
        onClose();
      } else {
        showError(t('common.error'), data.message || t('exercises.create_failed', 'Failed to create exercise'));
      }
    } catch (error) {
      logHandledError('create-exercise', error);
      showError(
        t('common.error'),
        getUserFacingError(error, t('exercises.create_failed', 'Failed to create exercise')),
      );
    } finally {
      setSaving(false);
    }
  };

  const resetDraft = () => {
    setName("");
    setMuscleGroup("");
    setEquipment("");
    setShowMuscles(false);
    setShowEquipment(false);
  };

  const handleClose = () => {
    if (saving) return;
    resetDraft();
    onClose();
  };

  const styles = useMemo(() => StyleSheet.create({
    modalContent: {
      flex: 1,
      backgroundColor: theme.background,
      overflow: 'hidden',
    },
    header: {
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      elevation: 0,
    },
    headerTitle: {
      color: theme.text,
      fontSize: 16.5,
      fontWeight: '700',
    },
    formContent: {
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
      padding: 20,
      paddingBottom: 40,
    },
    inputGroup: {
      marginBottom: 20,
      backgroundColor: 'transparent',
    },
    label: {
      color: theme.text,
      fontWeight: '600',
      marginBottom: 8,
    },
    selectBtn: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 14,
    },
    selectBtnActive: {
      borderColor: theme.primary,
    },
    optionsList: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 8,
      marginTop: 4,
      overflow: 'hidden',
    },
    optionItem: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    }
  }), [theme]);

  return (
    <BottomSheetModal
      visible={visible}
      onRequestClose={handleClose}
      backgroundColor={theme.background}
      heightRatio={0.82}
      dismissOnBackdrop={!saving}
    >
        <Surface style={styles.modalContent} elevation={0}>
          
          <ScreenHeader
            title={t('exercises.new_exercise', 'Yeni Egzersiz')}
            backIcon="close"
            onBack={saving ? undefined : handleClose}
            trailing={
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={saving}
                disabled={saving}
                buttonColor={theme.primary}
                style={{ borderRadius: 20 }}
                labelStyle={{ fontSize: 14, fontWeight: '700' }}
              >
                {!saving && t('exercises.create', 'Oluştur')}
              </Button>
            }
          />

          <KeyboardAwareScrollView
            avoidKeyboard
            style={{ flex: 1 }}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            
            <Surface elevation={0} style={styles.inputGroup}>
              <Text variant="titleMedium" style={styles.label}>{t('exercises.exercise_name', 'Egzersiz Adı')} *</Text>
              <TextInput
                mode="outlined"
                value={name}
                editable={!saving}
                maxLength={CONTENT_LIMITS.exerciseName}
                onChangeText={setName}
                placeholder={t('exercises.exercise_name_placeholder', 'Örn. Meyilli Dumbbell Press')}
                placeholderTextColor={theme.textMuted}
                outlineColor={theme.border}
                activeOutlineColor={theme.primary}
                style={{ backgroundColor: theme.surface, fontSize: 15 }}
                textColor={theme.text}
                theme={{ colors: { background: theme.background } }}
              />
            </Surface>

            <Surface elevation={0} style={styles.inputGroup}>
              <Text variant="titleMedium" style={styles.label}>{t('exercises.muscle_group', 'Hedef Kas Grubu')} *</Text>
              <TouchableRipple 
                style={[styles.selectBtn, muscleGroup && styles.selectBtnActive]} 
                disabled={saving}
                onPress={() => { setShowMuscles(!showMuscles); setShowEquipment(false); }}
              >
                <Surface elevation={0} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', backgroundColor: 'transparent' }}>
                  <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, paddingRight: 8, color: muscleGroup ? theme.text : theme.textMuted }}>
                    {muscleGroup ? t(`muscle_groups.${muscleGroup}`, muscleGroup) : t('exercises.select_muscle', 'Kas Grubu Seç')}
                  </Text>
                  <Ionicons name={showMuscles ? "chevron-up" : "chevron-down"} size={16} color={theme.textMuted} />
                </Surface>
              </TouchableRipple>
              {showMuscles && (
                <Surface style={styles.optionsList} elevation={0}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                    {muscleGroups.map(m => (
                      <TouchableRipple 
                        key={m} 
                        disabled={saving}
                        style={[styles.optionItem, muscleGroup === m && { backgroundColor: theme.primary + '20' }]} 
                        onPress={() => { setMuscleGroup(m); setShowMuscles(false); }}
                      >
                        <Surface elevation={0} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', backgroundColor: 'transparent' }}>
                          <Text numberOfLines={2} style={{ flex: 1, minWidth: 0, paddingRight: 8, color: muscleGroup === m ? theme.primary : theme.text, fontWeight: muscleGroup === m ? 'bold' : 'normal' }}>
                            {t(`muscle_groups.${m}`, muscleGroupsList.find(mg => mg.code === m)?.name || m)}
                          </Text>
                          {muscleGroup === m && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                        </Surface>
                      </TouchableRipple>
                    ))}
                  </ScrollView>
                </Surface>
              )}
            </Surface>

            <Surface elevation={0} style={styles.inputGroup}>
              <Text variant="titleMedium" style={styles.label}>{t('exercises.equipment', 'Ekipman')} *</Text>
              <TouchableRipple 
                style={[styles.selectBtn, equipment && styles.selectBtnActive]} 
                disabled={saving}
                onPress={() => { setShowEquipment(!showEquipment); setShowMuscles(false); }}
              >
                <Surface elevation={0} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, width: '100%', backgroundColor: 'transparent' }}>
                  {equipment ? <EquipmentAvatar code={equipment} size={30} selected /> : null}
                  <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, paddingRight: 8, color: equipment ? theme.text : theme.textMuted }}>
                    {equipment ? t(`equipment.${equipment}`, equipment) : t('exercises.select_equipment', 'Ekipman Seç')}
                  </Text>
                  <Ionicons name={showEquipment ? "chevron-up" : "chevron-down"} size={16} color={theme.textMuted} />
                </Surface>
              </TouchableRipple>
              {showEquipment && (
                <Surface style={styles.optionsList} elevation={0}>
                  {equipmentList.map(e => (
                    <TouchableRipple 
                      key={e} 
                      disabled={saving}
                      style={[styles.optionItem, equipment === e && { backgroundColor: theme.primary + '20' }]} 
                      onPress={() => { setEquipment(e); setShowEquipment(false); }}
                    >
                      <Surface elevation={0} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, width: '100%', backgroundColor: 'transparent' }}>
                        {/* The name is still the label; the drawing beside it
                            only makes the right row quicker to find. */}
                        <EquipmentAvatar code={e} size={30} selected={equipment === e} />
                        <Text numberOfLines={2} style={{ flex: 1, minWidth: 0, paddingRight: 8, color: equipment === e ? theme.primary : theme.text, fontWeight: equipment === e ? 'bold' : 'normal' }}>
                          {t(`equipment.${e}`, equipmentListItems.find(eq => eq.code === e)?.name || e)}
                        </Text>
                        {equipment === e && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                      </Surface>
                    </TouchableRipple>
                  ))}
                </Surface>
              )}
            </Surface>
            
            <View style={{ height: 100, backgroundColor: 'transparent' }} />
          </KeyboardAwareScrollView>
        </Surface>
    </BottomSheetModal>
  );
};

export default CustomExerciseModal;
