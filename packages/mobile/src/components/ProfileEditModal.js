import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-expo';
import { updateUser } from '../features/user/userSlice';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

const ProfileEditModal = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const { getToken } = useAuth();
  const user = useSelector((state) => state.user.value);
  const [loading, setLoading] = useState(false);

  const [editForm, setEditForm] = useState({
    full_name: '',
    username: '',
    bio: '',
    location: '',
    profile_picture: null,
    cover_photo: null,
  });

  // Update form when user data changes or modal opens
  React.useEffect(() => {
    if (visible && user) {
      setEditForm({
        full_name: user.full_name || '',
        username: user.username || '',
        bio: user.bio || '',
        location: user.location || '',
        profile_picture: null,
        cover_photo: null,
      });
    }
  }, [visible, user]);

  const pickImage = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('feed.permission_required'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: type === 'profile' ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      if (type === 'profile') {
        setEditForm({ ...editForm, profile_picture: result.assets[0] });
      } else {
        setEditForm({ ...editForm, cover_photo: result.assets[0] });
      }
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      const formData = new FormData();
      formData.append('full_name', editForm.full_name);
      formData.append('username', editForm.username);
      formData.append('bio', editForm.bio);
      formData.append('location', editForm.location);

      if (editForm.profile_picture) {
        const uriParts = editForm.profile_picture.uri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        
        formData.append('profile', {
          uri: editForm.profile_picture.uri,
          name: `profile.${fileType}`,
          type: `image/${fileType}`,
        });
      }

      if (editForm.cover_photo) {
        const uriParts = editForm.cover_photo.uri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        
        formData.append('cover', {
          uri: editForm.cover_photo.uri,
          name: `cover.${fileType}`,
          type: `image/${fileType}`,
        });
      }

      const token = await getToken();
      await dispatch(updateUser({ userData: formData, token })).unwrap();
      
      Alert.alert(t('common.success'), t('profile.profile_updated'));
      onClose();
    } catch (error) {
      Alert.alert(t('common.error'), error.message || t('profile.update_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t('profile.edit_profile')}</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Picture */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.textMuted }]}>{t('profile.profile_picture', 'Profil Fotoğrafı')}</Text>
            <TouchableOpacity
              style={styles.imageButton}
              onPress={() => pickImage('profile')}
            >
              <Image
                source={{
                  uri: editForm.profile_picture
                    ? editForm.profile_picture.uri
                    : user?.profile_picture,
                }}
                style={styles.profileImage}
              />
              <View style={styles.imageOverlay}>
                <Ionicons name="camera" size={24} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Cover Photo */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.textMuted }]}>{t('profile.cover_photo', 'Kapak Fotoğrafı')}</Text>
            <TouchableOpacity
              style={styles.coverButton}
              onPress={() => pickImage('cover')}
            >
              {editForm.cover_photo || user?.cover_photo ? (
                <Image
                  source={{
                    uri: editForm.cover_photo
                      ? editForm.cover_photo.uri
                      : user?.cover_photo,
                  }}
                  style={styles.coverImage}
                />
              ) : (
                <View style={styles.coverPlaceholder} />
              )}
              <View style={styles.imageOverlay}>
                <Ionicons name="camera" size={24} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Full Name */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.textMuted }]}>{t('profile.full_name', 'Ad Soyad')}</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceLight }]}
              placeholder={t('profile.full_name_placeholder', 'Ad Soyadınızı girin')}
              placeholderTextColor={theme.textMuted}
              value={editForm.full_name}
              onChangeText={(text) => setEditForm({ ...editForm, full_name: text })}
            />
          </View>

          {/* Username */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.textMuted }]}>{t('profile.username', 'Kullanıcı Adı')}</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceLight }]}
              placeholder={t('profile.username_placeholder', 'Kullanıcı adınızı girin')}
              placeholderTextColor={theme.textMuted}
              value={editForm.username}
              onChangeText={(text) => setEditForm({ ...editForm, username: text })}
              autoCapitalize="none"
            />
          </View>

          {/* Bio */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.textMuted }]}>{t('profile.bio', 'Bio')}</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceLight }]}
              placeholder={t('profile.bio_placeholder', 'Kendinizden bahsedin')}
              placeholderTextColor={theme.textMuted}
              value={editForm.bio}
              onChangeText={(text) => setEditForm({ ...editForm, bio: text })}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.textMuted }]}>{t('profile.location', 'Konum')}</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceLight }]}
              placeholder={t('profile.location_placeholder', 'Konumunuzu girin')}
              placeholderTextColor={theme.textMuted}
              value={editForm.location}
              onChangeText={(text) => setEditForm({ ...editForm, location: text })}
            />
          </View>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.primary }, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>{t('profile.save_changes', 'Değişiklikleri Kaydet')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  imageButton: {
    alignSelf: 'flex-start',
    position: 'relative',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverButton: {
    position: 'relative',
    width: '100%',
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#a78bfa',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#111827',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginBottom: 40,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#a5b4fc',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ProfileEditModal;
