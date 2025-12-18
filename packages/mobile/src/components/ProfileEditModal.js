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

const ProfileEditModal = ({ visible, onClose }) => {
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
      Alert.alert('Permission required', 'We need permission to access your photos');
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
      
      Alert.alert('Success', 'Profile updated successfully!');
      onClose();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update profile');
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
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Picture */}
          <View style={styles.section}>
            <Text style={styles.label}>Profile Picture</Text>
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
            <Text style={styles.label}>Cover Photo</Text>
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
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#9ca3af"
              value={editForm.full_name}
              onChangeText={(text) =>
                setEditForm({ ...editForm, full_name: text })
              }
            />
          </View>

          {/* Username */}
          <View style={styles.section}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your username"
              placeholderTextColor="#9ca3af"
              value={editForm.username}
              onChangeText={(text) =>
                setEditForm({ ...editForm, username: text })
              }
              autoCapitalize="none"
            />
          </View>

          {/* Bio */}
          <View style={styles.section}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell us about yourself"
              placeholderTextColor="#9ca3af"
              value={editForm.bio}
              onChangeText={(text) => setEditForm({ ...editForm, bio: text })}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your location"
              placeholderTextColor="#9ca3af"
              value={editForm.location}
              onChangeText={(text) =>
                setEditForm({ ...editForm, location: text })
              }
            />
          </View>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
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
    backgroundColor: '#fff',
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
