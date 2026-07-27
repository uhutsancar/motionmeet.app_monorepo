import React, { useState } from 'react';
import { TextInput, Image, ActivityIndicator } from 'react-native';
import { Surface, TouchableRipple, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { useAuthContext } from "../context/AuthProvider";
import { createNewPost } from '../features/posts/postsSlice';
import { uploadMedia } from '../api/mediaUpload';

import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { FullScreenModal } from './ResponsiveModal';
import KeyboardAwareScrollView from './KeyboardAwareScrollView';
import {
  getUserFacingError,
  logHandledError,
  showError,
  showSuccess,
} from '../utils/feedback';

const CreatePostModal = ({ visible, onClose, onSuccess }) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = getStyles(theme);
  const dispatch = useDispatch();
  const { getToken } = useAuthContext();
  const user = useSelector((state) => state.user.value);
  const profilePicture =
    typeof user?.profile_picture === 'string'
      ? user.profile_picture.trim()
      : '';
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      showError(t('common.error'), t('feed.permission_required'));
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
      showError(t('common.error'), t('common.user_not_found'));
      return;
    }

    if (!content.trim() && images.length === 0) {
      showError(t('common.error'), t('feed.add_content_error'));
      return;
    }

    try {
      setLoading(true);
      
      let postType = 'text';
      if (images.length > 0 && content.trim()) {
        postType = 'text_with_image';
      } else if (images.length > 0) {
        postType = 'image';
      }
      // Retry once if token is stale on first call
      let token = await getToken();
      if (!token) {
        await new Promise(res => setTimeout(res, 500));
        token = await getToken();
      }

      const uploadedKeys = await Promise.all(
        images.map((image) => uploadMedia(image, 'posts', token))
      );
      await dispatch(createNewPost({
        postData: { content, post_type: postType, uploadedKeys },
        token,
      })).unwrap();
      
      showSuccess(t('common.success'), t('feed.post_published'));
      setContent('');
      setImages([]);
      
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (error) {
      logHandledError('create-post', error);
      showError(
        t('common.error'),
        getUserFacingError(error, t('feed.publish_failed')),
      );
    } finally {
      setLoading(false);
    }
  };

  if (!visible || !user) {
    return null;
  }

  return (
    <FullScreenModal
      visible={visible}
      onRequestClose={onClose}
      backgroundColor={theme.background}
    >
      <Surface elevation={0} style={styles.container}>
        <Surface elevation={0} style={styles.header}>
          <TouchableRipple borderless onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={theme.text} />
          </TouchableRipple>
          <Text style={styles.headerTitle}>{t('feed.create_post', 'Yeni Gönderi')}</Text>
          <Surface elevation={0} style={{ width: 28 }} />
        </Surface>

        <KeyboardAwareScrollView
          avoidKeyboard={false}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Surface elevation={0} style={styles.userSection}>
            {profilePicture ? (
              <Image
                source={{ uri: profilePicture }}
                style={styles.avatar}
              />
            ) : (
              <Surface elevation={0} style={[styles.avatar, { backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 18 }}>
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </Surface>
            )}
            <Surface elevation={0}>
              <Text style={styles.userName}>{user.full_name}</Text>
              <Text style={styles.username}>@{user.username}</Text>
            </Surface>
          </Surface>

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
            <Surface elevation={0} style={styles.imagesContainer}>
              {images.map((image, index) => (
                <Surface elevation={0} key={index} style={styles.imageWrapper}>
                  <Image source={{ uri: image.uri }} style={styles.image} />
                  <TouchableRipple borderless
                    style={styles.removeButton}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={28} color="#ef4444" />
                  </TouchableRipple>
                </Surface>
              ))}
            </Surface>
          )}
        </KeyboardAwareScrollView>

        <Surface elevation={0} style={styles.bottomBar}>
          <TouchableRipple borderless
            style={styles.imageButton}
            onPress={pickImages}
          >
            <Ionicons name="image-outline" size={24} color={theme.textMuted} />
          </TouchableRipple>

          <TouchableRipple borderless
            style={[styles.publishButton, { backgroundColor: loading ? theme.primary + '80' : theme.primary }]}
            onPress={handlePublish}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.publishButtonText}>{t('feed.post_action', 'Paylaş')}</Text>
            )}
          </TouchableRipple>
        </Surface>
      </Surface>
    </FullScreenModal>
  );
};

const getStyles = (theme) => ({
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
  },
  contentContainer: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 28,
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
    borderRadius: 10,
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
