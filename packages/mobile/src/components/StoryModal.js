import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@clerk/clerk-expo';
import { createStory } from '../api/endpoints';

const StoryModal = ({ visible, onClose, onSuccess }) => {
  const { getToken } = useAuth();
  const [mode, setMode] = useState('text');
  const [text, setText] = useState('');
  const [media, setMedia] = useState(null);
  const [background, setBackground] = useState('#000000');
  const [loading, setLoading] = useState(false);

  const bgColors = [
    '#000000',
    '#4f46e5',
    '#7c3aed',
    '#db2777',
    '#e11d48',
    '#ca8a04',
    '#0d9488',
  ];

  const pickMedia = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission required', 'We need permission to access your media');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'video' 
        ? ['videos']
        : ['images'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });

    if (!result.canceled) {
      setMedia(result.assets[0]);
      setMode('media');
      setText('');
    }
  };

  const handleCreateStory = async () => {
    const mediaType = mode === 'media'
      ? media?.type?.includes('video') ? 'video' : 'image'
      : 'text';

    if (mediaType === 'text' && !text) {
      Alert.alert('Error', 'Please enter some text');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('content', text);
      formData.append('media_type', mediaType);
      formData.append('background_color', background);

      if (media && mode === 'media') {
        formData.append('media', {
          uri: media.uri,
          type: media.type?.includes('video') ? 'video/mp4' : 'image/jpeg',
          name: media.type?.includes('video') ? 'story_video.mp4' : 'story_image.jpg',
        });
      }

      const token = await getToken();
      const data = await createStory(formData, token);

      if (data.success) {
        Alert.alert('Success', 'Story created successfully');
        onSuccess?.();
        onClose();
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Story</Text>
          <TouchableOpacity onPress={handleCreateStory} disabled={loading} style={styles.postButtonWrapper}>
            <Text style={[styles.postButton, loading && styles.postButtonDisabled]}>
              {loading ? 'Posting...' : 'Post'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Mode Selector */}
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'text' && styles.activeModeButton]}
              onPress={() => {
                setMode('text');
                setMedia(null);
              }}
            >
              <Ionicons name="text" size={20} color={mode === 'text' ? '#4f46e5' : '#6b7280'} />
              <Text style={[styles.modeText, mode === 'text' && styles.activeModeText]}>Text</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'media' && styles.activeModeButton]}
              onPress={() => pickMedia('image')}
            >
              <Ionicons name="image" size={20} color={mode === 'media' ? '#4f46e5' : '#6b7280'} />
              <Text style={[styles.modeText, mode === 'media' && styles.activeModeText]}>Media</Text>
            </TouchableOpacity>
          </View>

          {/* Preview */}
          <View style={[styles.preview, { backgroundColor: mode === 'text' ? background : '#000' }]}>
            {mode === 'media' && media ? (
              <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
            ) : (
              <Text style={styles.previewText}>{text || 'Your story text...'}</Text>
            )}
          </View>

          {/* Text Input */}
          {mode === 'text' && (
            <>
              <TextInput
                style={styles.textInput}
                placeholder="What's on your mind?"
                placeholderTextColor="#9ca3af"
                value={text}
                onChangeText={setText}
                multiline
                maxLength={200}
              />

              {/* Background Colors */}
              <Text style={styles.sectionTitle}>Background Color</Text>
              <View style={styles.colorPicker}>
                {bgColors.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorButton,
                      { backgroundColor: color },
                      background === color && styles.selectedColor,
                    ]}
                    onPress={() => setBackground(color)}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
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
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  postButtonWrapper: {
    padding: 8,
    marginRight: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  postButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4f46e5',
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  activeModeButton: {
    backgroundColor: '#eef2ff',
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeModeText: {
    color: '#4f46e5',
  },
  preview: {
    height: 400,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default StoryModal;
