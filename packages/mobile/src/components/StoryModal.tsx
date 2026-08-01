import React, { useMemo, useRef, useState } from 'react';
import {
  TextInput,
  Image,
  View,
  useWindowDimensions,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthContext } from "../context/AuthProvider";
import { createStory } from '../api/endpoints';
import { uploadMedia } from '../api/mediaUpload';

import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Surface, TouchableRipple, Text } from 'react-native-paper';
import { FullScreenModal } from './ResponsiveModal';
import KeyboardAwareScrollView from './KeyboardAwareScrollView';
import {
  getUserFacingError,
  logHandledError,
  showError,
  showSuccess,
} from '../utils/feedback';
import { createOperationId, type Story } from '@motionmeet/shared';
import { VideoView, useVideoPlayer } from 'expo-video';
import type { ImagePickerAsset } from 'expo-image-picker';

type StoryMode = 'text' | 'media';
interface StoryModalProps { visible: boolean; onClose: () => void; onSuccess?: () => void }
interface StoryVideoPreviewProps { uri: string; style: StyleProp<ViewStyle> }
interface UploadedMedia { signature: string; key: string }

const StoryVideoPreview = ({ uri, style }: StoryVideoPreviewProps) => {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="cover"
      nativeControls={false}
      surfaceType="textureView"
      accessibilityLabel="Story video preview"
    />
  );
};

const StoryModal = ({ visible, onClose, onSuccess }: StoryModalProps) => {
  const { width, height } = useWindowDimensions();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const [mode, setMode] = useState<StoryMode>('text');
  const [text, setText] = useState('');
  const [media, setMedia] = useState<ImagePickerAsset | null>(null);
  const [background, setBackground] = useState('#000000');
  const [loading, setLoading] = useState(false);
  const operationIdRef = useRef(createOperationId('story'));
  const uploadedMediaRef = useRef<UploadedMedia | null>(null);
  const isNarrow = width < 360;
  const contentPadding = isNarrow ? 12 : 16;
  const headerSideWidth = Math.max(64, Math.min(82, width * 0.23));
  const previewHeight = Math.max(220, Math.min(
    (width - contentPadding * 2) * 1.12,
    height * 0.46,
    420,
  ));
  const canPublish = !loading && (
    mode === 'text' ? text.trim().length > 0 : Boolean(media)
  );

  const bgColors = [
    '#000000',
    '#4f46e5',
    '#7c3aed',
    '#db2777',
    '#e11d48',
    '#ca8a04',
    '#0d9488',
  ];

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 58,
      paddingHorizontal: isNarrow ? 8 : 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
      flexShrink: 0,
    },
    headerSide: {
      width: headerSideWidth,
      height: 58,
      justifyContent: 'center',
      flexShrink: 0,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    postButtonWrapper: {
      minHeight: 42,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 17,
      fontWeight: '800',
      color: theme.text,
    },
    postButton: {
      fontSize: isNarrow ? 12 : 13,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
      padding: contentPadding,
      paddingBottom: 36,
    },
    modeSelector: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
      backgroundColor: 'transparent'
    },
    modeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modeText: {
      fontSize: 14,
      fontWeight: 'bold',
    },
    preview: {
      height: previewHeight,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
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
      fontSize: 22,
      lineHeight: 29,
      fontWeight: '800',
      color: '#fff',
      textAlign: 'center',
      paddingHorizontal: 20,
    },
    emptyMedia: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 24,
    },
    emptyMediaText: {
      color: theme.textMuted,
      textAlign: 'center',
      fontSize: 14,
      fontWeight: '700',
    },
    textInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 16,
      fontSize: 16,
      color: theme.text,
      minHeight: 96,
      textAlignVertical: 'top',
      marginBottom: 18,
      backgroundColor: theme.surface,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 10,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    colorPicker: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 11,
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
  }), [
    contentPadding,
    headerSideWidth,
    isNarrow,
    previewHeight,
    theme,
  ]);

  const resetDraft = () => {
    setMode('text');
    setText('');
    setMedia(null);
    setBackground('#000000');
    operationIdRef.current = createOperationId('story');
    uploadedMediaRef.current = null;
  };

  const handleClose = () => {
    if (loading) return;
    resetDraft();
    onClose?.();
  };

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      showError(t('common.error'), t('feed.permission_required_media'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled) {
      const selectedAsset = result.assets[0];
      if (!selectedAsset) return;
      setMedia(selectedAsset);
      setMode('media');
      setText('');
      operationIdRef.current = createOperationId('story');
      uploadedMediaRef.current = null;
    }
  };

  const handleCreateStory = async () => {
    const mediaType: Story['media_type'] = mode === 'media'
      ? media?.type?.includes('video') ? 'video' : 'image'
      : 'text';

    if (mediaType === 'text' && !text) {
      showError(t('common.error'), t('feed.add_text_error'));
      return;
    }

    try {
      setLoading(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const mediaSignature =
        media && mode === 'media'
          ? `${media.assetId || media.uri}:${media.fileSize || 0}`
          : '';
      let uploadedKey = uploadedMediaRef.current?.signature === mediaSignature
        ? uploadedMediaRef.current.key
        : undefined;
      if (media && mode === 'media' && !uploadedKey) {
        uploadedKey = await uploadMedia(media, 'stories', token);
        uploadedMediaRef.current = { signature: mediaSignature, key: uploadedKey };
      }
      const data = await createStory({
        operationId: operationIdRef.current,
        content: text,
        media_type: mediaType,
        background_color: background,
        uploadedKey,
      }, token);

      if (data.success) {
        showSuccess(t('common.success'), t('feed.story_created'));
        resetDraft();
        onSuccess?.();
        onClose?.();
      } else {
        showError(t('common.error'), data.message || t('feed.story_create_failed'));
      }
    } catch (error) {
      logHandledError('create-story', error);
      showError(
        t('common.error'),
        getUserFacingError(error, t('feed.story_create_failed', 'Hikaye oluşturulamadı.')),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <FullScreenModal
      visible={visible}
      onRequestClose={handleClose}
      backgroundColor={theme.background}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.headerSide, { alignItems: 'flex-start' }]}>
            <TouchableRipple
              onPress={handleClose}
              style={styles.backButton}
              borderless
              disabled={loading}
              accessibilityLabel={t('common.back', 'Back')}
            >
              <Ionicons name="arrow-back" size={23} color={theme.text} />
            </TouchableRipple>
          </View>
          <Text
            style={styles.headerTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            {t('feed.create_story')}
          </Text>
          <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>
            <TouchableRipple
              onPress={handleCreateStory}
              disabled={!canPublish}
              style={styles.postButtonWrapper}
              borderless
              accessibilityLabel={t('feed.post_action')}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                style={[styles.postButton, { color: canPublish ? theme.primary : theme.textMuted }]}
              >
                {loading ? t('common.saving') : t('feed.post_action')}
              </Text>
            </TouchableRipple>
          </View>
        </View>

        <KeyboardAwareScrollView
          avoidKeyboard={false}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Surface elevation={0} style={styles.modeSelector}>
            <TouchableRipple
              style={[styles.modeButton, { backgroundColor: mode === 'text' ? theme.surface + '80' : theme.surface }]}
              disabled={loading}
              onPress={() => {
                setMode('text');
                setMedia(null);
                operationIdRef.current = createOperationId('story');
                uploadedMediaRef.current = null;
              }}
              borderless
            >
              <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
                <Ionicons name="text" size={20} color={mode === 'text' ? theme.primary : theme.textMuted} />
                <Text
                  numberOfLines={1}
                  style={[styles.modeText, { color: mode === 'text' ? theme.primary : theme.textMuted }]}
                >
                  {t('feed.text')}
                </Text>
              </Surface>
            </TouchableRipple>
            <TouchableRipple
              style={[styles.modeButton, { backgroundColor: mode === 'media' ? theme.surface + '80' : theme.surface }]}
              onPress={pickMedia}
              disabled={loading}
              borderless
            >
              <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' }}>
                <Ionicons name="image" size={20} color={mode === 'media' ? theme.primary : theme.textMuted} />
                <Text
                  numberOfLines={1}
                  style={[styles.modeText, { color: mode === 'media' ? theme.primary : theme.textMuted }]}
                >
                  {t('feed.media')}
                </Text>
              </Surface>
            </TouchableRipple>
          </Surface>

          <Surface elevation={0} style={[styles.preview, { backgroundColor: mode === 'text' ? background : '#000' }]}>
            {mode === 'media' ? (
              media ? (
                media.type?.includes('video') ? (
                  <StoryVideoPreview uri={media.uri} style={styles.mediaPreview} />
                ) : (
                  <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
                )
              ) : (
                <View style={styles.emptyMedia}>
                  <Ionicons name="images-outline" size={38} color={theme.textMuted} />
                  <Text style={styles.emptyMediaText}>
                    {t('workout_summary.add_media', 'Add photo or video')}
                  </Text>
                </View>
              )
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
                editable={!loading}
                onChangeText={(value) => {
                  setText(value);
                  operationIdRef.current = createOperationId('story');
                }}
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
                    disabled={loading}
                    onPress={() => {
                      setBackground(color);
                      operationIdRef.current = createOperationId('story');
                    }}
                    borderless
                    accessibilityRole="button"
                    accessibilityLabel={color}
                  >
                    <View style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }} />
                  </TouchableRipple>
                ))}
              </Surface>
            </>
          )}
        </KeyboardAwareScrollView>
      </View>
    </FullScreenModal>
  );
};

export default StoryModal;
