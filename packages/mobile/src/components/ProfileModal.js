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
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { updateUser } from '../features/user/userSlice';
import Toast from 'react-native-toast-message';

const ProfileModal = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = getStyles(theme);
  const dispatch = useDispatch();
  
  const currentUser = useSelector((state) => state.user.value);
  
  const [formData, setFormData] = useState({
    full_name: currentUser?.full_name || '',
    username: currentUser?.username || '',
    weight: currentUser?.weight?.toString() || '0',
    height: currentUser?.height?.toString() || '0',
    bio: currentUser?.bio || '',
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    try {
      setSaving(true);
      
      const payload = {
        full_name: formData.full_name,
        username: formData.username,
        weight: Number(formData.weight),
        height: Number(formData.height),
        bio: formData.bio,
      };

      await dispatch(updateUser(payload)).unwrap();
      Toast.show({
        type: 'success',
        text1: t('common.success'),
        text2: t('profile.profile_updated'),
      });
      onClose();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: error.message || t('profile.update_failed'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('profile.edit_profile')}</Text>
            <TouchableOpacity 
              onPress={handleSubmit} 
              disabled={saving}
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
            >
              <Text style={styles.saveButtonText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('profile.full_name')}</Text>
              <TextInput
                style={styles.input}
                value={formData.full_name}
                onChangeText={(text) => setFormData({ ...formData, full_name: text })}
                placeholder={t('profile.full_name_placeholder')}
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('profile.username')}</Text>
              <TextInput
                style={styles.input}
                value={formData.username}
                onChangeText={(text) => setFormData({ ...formData, username: text })}
                placeholder={t('profile.username_placeholder')}
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>{t('profile.weight_kg', 'Ağırlık (kg)')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.weight}
                  onChangeText={(text) => setFormData({ ...formData, weight: text })}
                  placeholder="e.g. 75"
                  keyboardType="numeric"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>{t('profile.height_cm', 'Boy (cm)')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.height}
                  onChangeText={(text) => setFormData({ ...formData, height: text })}
                  placeholder="e.g. 180"
                  keyboardType="numeric"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('profile.bio')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.bio}
                onChangeText={(text) => setFormData({ ...formData, bio: text })}
                placeholder={t('profile.bio_placeholder')}
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
            
            <View style={{ height: 40 }} />
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
    height: '85%',
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
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: theme.text,
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.surfaceLight,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    color: theme.text,
    fontSize: 15,
  },
  textArea: {
    minHeight: 100,
  }
});

export default ProfileModal;
