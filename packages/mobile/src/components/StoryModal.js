import React, { useState, useMemo } from 'react';
import {
  Modal,
  TextInput,
  Image,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthContext } from "../context/AuthProvider";
import { createStory } from '../api/endpoints';

import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Surface, TouchableRipple, Text } from 'react-native-paper';

const StoryModal = ({ visible, onClose, onSuccess }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
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

  const styles = useMemo(() => ({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      minHeight: 64,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: 'transparent'
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
      fontWeight: 'bold',
      color: theme.text,
    },
    postButton: {
      fontSize: 16,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    content: {
      flex: 1,
      padding: 16,
    },
    modeSelector: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
      backgroundColor: 'transparent'
    },
    modeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modeText: {
      fontSize: 14,
      fontWeight: 'bold',
    },
    preview: {
      height: 400,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
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
      borderColor: theme.border,
      borderRadius: 16,
      padding: 16,
      fontSize: 16,
      color: theme.text,
      minHeight: 100,
      textAlignVertical: 'top',
      marginBottom: 20,
      backgroundColor: theme.surface,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    colorPicker: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      paddingBottom: 40,
      backgroundColor: 'transparent'
    },
    colorButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 3,
      borderColor: 'transparent',
    },
    selectedColor: {
      borderColor: theme.text,
    },
  }), [theme]);

  const pickMedia = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('feed.permission_required_media'));
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
      Alert.alert(t('common.error'), t('feed.add_text_error'));
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

      let token = await getToken();
      const data = await createStory(formData, token);

      if (data.success) {
        Alert.alert(t('common.success'), t('feed.story_created'));
        onSuccess?.();
        onClose();
      } else {
        Alert.alert(t('common.error'), data.message);
      }
    } catch (error) {
      Alert.alert(t('common.error'), error.message);
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <Surface elevation={0} style={styles.header}>
          <TouchableRipple onPress={onClose} style={styles.backButton} borderless>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableRipple>
          <Text style={styles.headerTitle}>{t('feed.create_story')}</Text>
          <TouchableRipple onPress={handleCreateStory} disabled={loading} style={styles.postButtonWrapper} borderless>
            <Text style={[styles.postButton, { color: loading ? theme.primary + '80' : theme.primary }]}>
              {loading ? t('common.saving') : t('feed.post_action')}
            </Text>
          </TouchableRipple>
        </Surface>

        <ScrollView style={styles.content}>
          <Surface elevation={0} style={styles.modeSelector}>
            <TouchableRipple
              style={[styles.modeButton, { backgroundColor: mode === 'text' ? theme.surface + '80' : theme.surface }]}
              onPress={() => {
                setMode('text');
                setMedia(null);
              }}
              borderless
            >
              <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
                <Ionicons name="text" size={20} color={mode === 'text' ? theme.primary : theme.textMuted} />
                <Text style={[styles.modeText, { color: mode === 'text' ? theme.primary : theme.textMuted }]}>{t('feed.text')}</Text>
              </Surface>
            </TouchableRipple>
            <TouchableRipple
              style={[styles.modeButton, { backgroundColor: mode === 'media' ? theme.surface + '80' : theme.surface }]}
              onPress={() => pickMedia('image')}
              borderless
            >
              <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
                <Ionicons name="image" size={20} color={mode === 'media' ? theme.primary : theme.textMuted} />
                <Text style={[styles.modeText, { color: mode === 'media' ? theme.primary : theme.textMuted }]}>{t('feed.media')}</Text>
              </Surface>
            </TouchableRipple>
          </Surface>

          <Surface elevation={0} style={[styles.preview, { backgroundColor: mode === 'text' ? background : '#000' }]}>
            {mode === 'media' && media ? (
              <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
            ) : (
              <Text style={styles.previewText}>{text || t('feed.story_text_placeholder')}</Text>
            )}
          </Surface>

          {mode === 'text' && (
            <>
              <TextInput
                style={styles.textInput}
                placeholder={t('feed.whats_on_mind')}
                placeholderTextColor={theme.textMuted}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={200}
              />

              <Text style={styles.sectionTitle}>{t('feed.background_color')}</Text>
              <Surface elevation={0} style={styles.colorPicker}>
                {bgColors.map((color) => (
                  <TouchableRipple
                    key={color}
                    style={[
                      styles.colorButton,
                      { backgroundColor: color },
                      background === color && styles.selectedColor,
                    ]}
                    onPress={() => setBackground(color)}
                    borderless
                  >
                    <Surface elevation={0} style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }} />
                  </TouchableRipple>
                ))}
              </Surface>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default StoryModal;
