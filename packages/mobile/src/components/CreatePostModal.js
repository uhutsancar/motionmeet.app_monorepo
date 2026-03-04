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
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-expo';
import { createNewPost } from '../features/posts/postsSlice';

import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

const CreatePostModal = ({ visible, onClose, onSuccess }) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = getStyles(theme);
  const dispatch = useDispatch();
  const { getToken } = useAuth();
  const user = useSelector((state) => state.user.value);
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('feed.permission_required'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages([...images, ...result.assets]);
    }
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    if (!user) {
      Alert.alert(t('common.error'), t('common.user_not_found'));
      return;
    }

    if (!content.trim() && images.length === 0) {
      Alert.alert(t('common.error'), t('feed.add_content_error'));
      return;
    }

    try {
      setLoading(true);
      
      const formData = new FormData();
      formData.append('content', content);
      
      let postType = 'text';
      if (images.length > 0 && content.trim()) {
        postType = 'text_with_image';
      } else if (images.length > 0) {
        postType = 'image';
      }
      formData.append('post_type', postType);

      images.forEach((image, index) => {
        const uriParts = image.uri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        
        formData.append('images', {
          uri: image.uri,
          name: `post_${index}.${fileType}`,
          type: `image/${fileType}`,
        });
      });

      // Retry once if token is stale on first call
      let token = await getToken();
      if (!token) {
        await new Promise(res => setTimeout(res, 500));
        token = await getToken();
      }

      await dispatch(createNewPost({ postData: formData, token })).unwrap();
      
      Alert.alert(t('common.success'), t('feed.post_published'));
      setContent('');
      setImages([]);
      
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (error) {
      Alert.alert(t('common.error'), error.message || t('feed.publish_failed'));
    } finally {
      setLoading(false);
    }
  };

  if (!visible || !user) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('feed.create_post', 'Yeni Gönderi')}</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.userSection}>
            <Image
              source={{ uri: user.profile_picture }}
              style={styles.avatar}
            />
            <View>
              <Text style={styles.userName}>{user.full_name}</Text>
              <Text style={styles.username}>@{user.username}</Text>
            </View>
          </View>

          <TextInput
            style={styles.textInput}
            placeholder={t('feed.whats_on_mind', 'Neler düşünüyorsun?')}
            placeholderTextColor={theme.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={1000}
            keyboardAppearance={isDark ? 'dark' : 'light'}
          />

          {images.length > 0 && (
            <View style={styles.imagesContainer}>
              {images.map((image, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri: image.uri }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={28} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.imageButton}
            onPress={pickImages}
          >
            <Ionicons name="image-outline" size={24} color={theme.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.publishButton, { backgroundColor: loading ? theme.primary + '80' : theme.primary }]}
            onPress={handlePublish}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.publishButtonText}>{t('feed.post_action', 'Paylaş')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const getStyles = (theme) => StyleSheet.create({
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
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  username: {
    fontSize: 14,
    color: theme.textMuted,
  },
  textInput: {
    fontSize: 16,
    color: theme.text,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  imageWrapper: {
    position: 'relative',
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: theme.background,
    borderRadius: 14,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  imageButton: {
    padding: 8,
  },
  publishButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  publishButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
    textTransform: 'uppercase',
  },
});

export default CreatePostModal;
