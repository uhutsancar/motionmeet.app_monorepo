import React, { useState, useMemo } from 'react';
import { 
  Modal, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from "../context/AuthProvider";
import { setAuthToken } from '../api/client';
import { createExercise } from '../api/endpoints';
import { Appbar, Text, TextInput, Button, TouchableRipple, Surface } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMuscleGroups } from '../hooks/useMuscleGroups';
import { useEquipment } from '../hooks/useEquipment';

const CustomExerciseModal = ({ visible, onClose, onExerciseCreated }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
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
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('exercises.missing_name', 'Exercise name is required'));
      return;
    }
    
    if (!muscleGroup || !equipment) {
      Alert.alert(t('common.error'), t('exercises.missing_fields', 'Please select muscle group and equipment'));
      return;
    }

    try {
      setSaving(true);

      const freshToken = await getToken();
      if (freshToken) {
        setAuthToken(freshToken);
      }

      const data = await createExercise({
        name: name.trim(),
        muscleGroup,
        equipment,
      }, freshToken);

      if (data.success) {
        if (onExerciseCreated) onExerciseCreated(data.exercise);
        handleClose();
      } else {
        Alert.alert(t('common.error'), data.message || t('exercises.create_failed', 'Failed to create exercise'));
      }
    } catch (error) {
      console.error('Exercise creation error:', error.response?.data || error.message);
      Alert.alert(
        t('common.error'), 
        error.response?.data?.message || error.message || t('common.error', 'An error occurred')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setName("");
    setMuscleGroup("");
    setEquipment("");
    setShowMuscles(false);
    setShowEquipment(false);
    onClose();
  };

  const styles = useMemo(() => ({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      height: '75%',
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
      fontSize: 18,
      fontWeight: 'bold',
    },
    formContainer: {
      padding: 20,
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
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 14,
    },
    selectBtnActive: {
      borderColor: theme.primary,
    },
    optionsList: {
      backgroundColor: theme.surface,
      borderWidth: 1,
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
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <Surface style={[styles.modalContent, { paddingBottom: insets.bottom }]} elevation={4}>
          
          <Appbar.Header style={styles.header}>
            <Appbar.Action icon="close" onPress={handleClose} color={theme.text} />
            <Appbar.Content title={t('exercises.new_exercise', 'Yeni Egzersiz')} titleStyle={styles.headerTitle} />
            <Button 
              mode="contained" 
              onPress={handleSubmit} 
              loading={saving} 
              disabled={saving}
              buttonColor={theme.primary}
              style={{ borderRadius: 20, marginRight: 8 }}
              labelStyle={{ fontSize: 14, fontWeight: 'bold' }}
            >
              {!saving && t('exercises.create', 'Oluştur')}
            </Button>
          </Appbar.Header>

          <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
            
            <Surface elevation={0} style={styles.inputGroup}>
              <Text variant="titleMedium" style={styles.label}>{t('exercises.exercise_name', 'Egzersiz Adı')} *</Text>
              <TextInput
                mode="outlined"
                value={name}
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
                onPress={() => { setShowMuscles(!showMuscles); setShowEquipment(false); }}
              >
                <Surface elevation={0} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', backgroundColor: 'transparent' }}>
                  <Text style={{ color: muscleGroup ? theme.text : theme.textMuted }}>
                    {muscleGroup ? t(`muscle_groups.${muscleGroup}`, muscleGroup) : t('exercises.select_muscle', 'Kas Grubu Seç')}
                  </Text>
                  <Ionicons name={showMuscles ? "chevron-up" : "chevron-down"} size={16} color={theme.textMuted} />
                </Surface>
              </TouchableRipple>
              {showMuscles && (
                <Surface style={styles.optionsList} elevation={2}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                    {muscleGroups.map(m => (
                      <TouchableRipple 
                        key={m} 
                        style={[styles.optionItem, muscleGroup === m && { backgroundColor: theme.primary + '20' }]} 
                        onPress={() => { setMuscleGroup(m); setShowMuscles(false); }}
                      >
                        <Surface elevation={0} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', backgroundColor: 'transparent' }}>
                          <Text style={{ color: muscleGroup === m ? theme.primary : theme.text, fontWeight: muscleGroup === m ? 'bold' : 'normal' }}>
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
                onPress={() => { setShowEquipment(!showEquipment); setShowMuscles(false); }}
              >
                <Surface elevation={0} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', backgroundColor: 'transparent' }}>
                  <Text style={{ color: equipment ? theme.text : theme.textMuted }}>
                    {equipment ? t(`equipment.${equipment}`, equipment) : t('exercises.select_equipment', 'Ekipman Seç')}
                  </Text>
                  <Ionicons name={showEquipment ? "chevron-up" : "chevron-down"} size={16} color={theme.textMuted} />
                </Surface>
              </TouchableRipple>
              {showEquipment && (
                <Surface style={styles.optionsList} elevation={2}>
                  {equipmentList.map(e => (
                    <TouchableRipple 
                      key={e} 
                      style={[styles.optionItem, equipment === e && { backgroundColor: theme.primary + '20' }]} 
                      onPress={() => { setEquipment(e); setShowEquipment(false); }}
                    >
                      <Surface elevation={0} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', backgroundColor: 'transparent' }}>
                        <Text style={{ color: equipment === e ? theme.primary : theme.text, fontWeight: equipment === e ? 'bold' : 'normal' }}>
                          {t(`equipment.${e}`, equipmentListItems.find(eq => eq.code === e)?.name || e)}
                        </Text>
                        {equipment === e && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                      </Surface>
                    </TouchableRipple>
                  ))}
                </Surface>
              )}
            </Surface>
            
            <Surface elevation={0} style={{ height: 100, backgroundColor: 'transparent' }} />
          </ScrollView>
        </Surface>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default CustomExerciseModal;
