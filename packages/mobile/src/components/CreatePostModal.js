import React, { useRef, useState } from 'react';
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
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { CONTENT_LIMITS, createOperationId } from '@motionmeet/shared';
import {
  getUserFacingError,
  logHandledError,
  showError,
  showSuccess,
} from '../utils/feedback';

const CreatePostModal = ({ visible, onClose, onSuccess }) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { usableWidth } = useResponsiveLayout();
  const contentPadding = usableWidth < 360 ? 12 : 20;
  const imageSize = Math.max(
    64,
    Math.min(100, (usableWidth - contentPadding * 2 - 8) / 2),
  );
  const styles = getStyles(theme, contentPadding, imageSize);
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
  const operationIdRef = useRef(null);
  const uploadCacheRef = useRef(null);

  const resetPendingSubmission = () => {
    operationIdRef.current = null;
    uploadCacheRef.current = null;
  };

  const handleClose = () => {
    if (loading) return;
    setContent('');
    setImages([]);
    resetPendingSubmission();
    onClose?.();
  };

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
      selectionLimit: Math.max(1, CONTENT_LIMITS.postMediaItems - images.length),
      quality: 0.8,
    });

    if (!result.canceled) {
      const availableSlots = Math.max(0, CONTENT_LIMITS.postMediaItems - images.length);
      if (availableSlots === 0) {
        showError(
          t('common.error'),
          t('feed.media_limit', `A post can contain at most ${CONTENT_LIMITS.postMediaItems} images.`),
        );
        return;
      }
      const selected = result.assets.slice(0, availableSlots);
      if (result.assets.length > availableSlots) {
        showError(
          t('common.error'),
          t('feed.media_limit', `A post can contain at most ${CONTENT_LIMITS.postMediaItems} images.`),
        );
      }
      setImages((current) => [...current, ...selected]);
      resetPendingSubmission();
    }
  };

  const removeImage = (index) => {
    setImages((current) => current.filter((_, i) => i !== index));
    resetPendingSubmission();
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
      const token = await getToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');

      const mediaSignature = images
        .map((image) => `${image.assetId || image.uri}:${image.fileSize || 0}`)
        .join('|');
      let uploadedKeys = uploadCacheRef.current?.signature === mediaSignature
        ? uploadCacheRef.current.keys
        : null;
      if (!uploadedKeys) {
        uploadedKeys = await Promise.all(
          images.map((image) => uploadMedia(image, 'posts', token))
        );
        uploadCacheRef.current = { signature: mediaSignature, keys: uploadedKeys };
      }
      operationIdRef.current ||= createOperationId('post');
      await dispatch(createNewPost({
        postData: {
          operationId: operationIdRef.current,
          content,
          post_type: postType,
          uploadedKeys,
        },
        token,
      })).unwrap();
      
      showSuccess(t('common.success'), t('feed.post_published'));
      setContent('');
      setImages([]);
      resetPendingSubmission();
      
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
      onRequestClose={handleClose}
      backgroundColor={theme.background}
    >
      <Surface elevation={0} style={styles.container}>
        <Surface elevation={0} style={styles.header}>
          <TouchableRipple borderless onPress={handleClose} disabled={loading} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={theme.text} />
          </TouchableRipple>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={styles.headerTitle}
          >
            {t('feed.create_post', 'Yeni Gönderi')}
          </Text>
          <Surface elevation={0} style={{ width: 40 }} />
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
            <Surface elevation={0} style={styles.userText}>
              <Text numberOfLines={1} style={styles.userName}>{user.full_name}</Text>
              <Text numberOfLines={1} style={styles.username}>@{user.username}</Text>
            </Surface>
          </Surface>

          <TextInput
            style={styles.textInput}
            placeholder={t('feed.whats_on_mind', 'Neler düşünüyorsun?')}
            placeholderTextColor={theme.textMuted}
            value={content}
            editable={!loading}
            onChangeText={(value) => {
              setContent(value);
              operationIdRef.current = null;
            }}
            multiline
            maxLength={CONTENT_LIMITS.post}
            keyboardAppearance={isDark ? 'dark' : 'light'}
          />

          {images.length > 0 && (
            <Surface elevation={0} style={styles.imagesContainer}>
              {images.map((image, index) => (
                <Surface elevation={0} key={image.assetId || image.uri || String(index)} style={styles.imageWrapper}>
                  <Image source={{ uri: image.uri }} style={styles.image} />
                  <TouchableRipple borderless
                    style={styles.removeButton}
                    onPress={() => removeImage(index)}
                    disabled={loading}
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
            disabled={loading}
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

const getStyles = (theme, contentPadding, imageSize) => ({
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    padding: contentPadding,
    paddingBottom: 28,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  userText: {
    flex: 1,
    minWidth: 0,
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
    width: imageSize,
    height: imageSize,
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
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: contentPadding,
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
