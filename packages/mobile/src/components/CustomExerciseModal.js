import React, { useState } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@clerk/clerk-expo';
import api, { setAuthToken } from '../api/client';

const CustomExerciseModal = ({ visible, onClose, onExerciseCreated }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const styles = getStyles(theme);
  
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [saving, setSaving] = useState(false);

  const [showMuscles, setShowMuscles] = useState(false);
  const [showEquipment, setShowEquipment] = useState(false);

  const muscleGroups = [
    "Abdominals", "Biceps", "Calves", "Chest", "Forearms", 
    "Glutes", "Hamstrings", "Lats", "Lower Back", "Quadriceps", "Shoulders", "Triceps"
  ];

  const equipmentList = [
    "Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "Band", "Kettlebell"
  ];

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

      // Always fetch a fresh token to avoid stale/expired token issues
      const freshToken = await getToken();
      if (freshToken) {
        setAuthToken(freshToken);
      }

      const { data } = await api.post("/api/exercise", {
        name: name.trim(),
        muscleGroup,
        equipment,
      });

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

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.iconButton}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('exercises.new_exercise', 'Yeni Egzersiz')}</Text>
            <TouchableOpacity onPress={handleSubmit} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>{t('exercises.create', 'Oluştur')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('exercises.exercise_name', 'Egzersiz Adı')} *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t('exercises.exercise_name_placeholder', 'Örn. Meyilli Dumbbell Press')}
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('exercises.muscle_group', 'Hedef Kas Grubu')} *</Text>
              <TouchableOpacity 
                style={[styles.selectBtn, muscleGroup && styles.selectBtnActive]} 
                onPress={() => { setShowMuscles(!showMuscles); setShowEquipment(false); }}
              >
                <Text style={{ color: muscleGroup ? theme.text : theme.textMuted }}>
                  {muscleGroup || t('exercises.select_muscle', 'Kas Grubu Seç')}
                </Text>
                <Ionicons name={showMuscles ? "chevron-up" : "chevron-down"} size={16} color={theme.textMuted} />
              </TouchableOpacity>
              {showMuscles && (
                <View style={styles.optionsList}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                    {muscleGroups.map(m => (
                      <TouchableOpacity 
                        key={m} 
                        style={[styles.optionItem, muscleGroup === m && { backgroundColor: theme.primary + '20' }]} 
                        onPress={() => { setMuscleGroup(m); setShowMuscles(false); }}
                      >
                        <Text style={{ color: muscleGroup === m ? theme.primary : theme.text, fontWeight: muscleGroup === m ? 'bold' : 'normal' }}>{m}</Text>
                        {muscleGroup === m && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('exercises.equipment', 'Ekipman')} *</Text>
              <TouchableOpacity 
                style={[styles.selectBtn, equipment && styles.selectBtnActive]} 
                onPress={() => { setShowEquipment(!showEquipment); setShowMuscles(false); }}
              >
                <Text style={{ color: equipment ? theme.text : theme.textMuted }}>
                  {equipment || t('exercises.select_equipment', 'Ekipman Seç')}
                </Text>
                <Ionicons name={showEquipment ? "chevron-up" : "chevron-down"} size={16} color={theme.textMuted} />
              </TouchableOpacity>
              {showEquipment && (
                <View style={styles.optionsList}>
                  {equipmentList.map(e => (
                    <TouchableOpacity 
                      key={e} 
                      style={[styles.optionItem, equipment === e && { backgroundColor: theme.primary + '20' }]} 
                      onPress={() => { setEquipment(e); setShowEquipment(false); }}
                    >
                      <Text style={{ color: equipment === e ? theme.primary : theme.text, fontWeight: equipment === e ? 'bold' : 'normal' }}>{e}</Text>
                      {equipment === e && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            
            <View style={{ height: 100 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const getStyles = (theme) => StyleSheet.create({
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  iconButton: {
    padding: 4,
  },
  saveButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 64,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: theme.text,
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    color: theme.text,
    fontSize: 15,
  },
  selectBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
  },
  selectBtnActive: {
    borderColor: theme.primary,
  },
  optionsList: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
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
});

export default CustomExerciseModal;
