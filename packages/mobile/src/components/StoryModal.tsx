import React, { useMemo, useRef, useState } from 'react';
import {
  TextInput,
  Image,
  ScrollView,
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
import { TouchableRipple, Text } from 'react-native-paper';
import { FullScreenModal } from './ResponsiveModal';
import {
  getUserFacingError,
  logHandledError,
  showError,
  showSuccess,
} from '../utils/feedback';
import { createOperationId, type Story } from '@motionmeet/shared';
import { VideoView, useVideoPlayer } from 'expo-video';
import type { ImagePickerAsset } from 'expo-image-picker';


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

  const [text, setText] = useState('');
  const [media, setMedia] = useState<ImagePickerAsset | null>(null);
  const [background, setBackground] = useState('#000000');
  const [loading, setLoading] = useState(false);
  const operationIdRef = useRef(createOperationId('story'));
  const uploadedMediaRef = useRef<UploadedMedia | null>(null);
  const isNarrow = width < 360;
  const contentPadding = isNarrow ? 12 : 16;
  const headerSideWidth = Math.max(64, Math.min(82, width * 0.23));
  const swatchSize = isNarrow ? 30 : 34;
  const overlayFontSize = Math.round(Math.max(20, Math.min(28, height * 0.03)));
  const canPublish = !loading && (Boolean(media) || text.trim().length > 0);

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
    // The canvas fills every pixel left between the header and the tool bar,
    // so the story is composed at the size it will be published at. The
    // wrapper owns the spacing so the canvas can never overflow sideways.
    canvasWrapper: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: contentPadding,
      paddingVertical: contentPadding,
    },
    canvas: {
      flex: 1,
      width: '100%',
      maxWidth: 620,
      borderRadius: 20,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#000',
    },
    mediaPreview: {
      ...StyleSheet.absoluteFillObject,
    },
    // Text is typed straight onto the canvas instead of a separate form field.
    canvasText: {
      ...StyleSheet.absoluteFillObject,
      paddingHorizontal: 24,
      paddingVertical: 32,
      fontSize: overlayFontSize,
      lineHeight: Math.round(overlayFontSize * 1.3),
      fontWeight: '800',
      color: '#fff',
      textAlign: 'center',
      textAlignVertical: 'center',
      backgroundColor: 'transparent',
      textShadowColor: 'rgba(0,0,0,0.55)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
    },
    mediaHint: {
      position: 'absolute',
      left: 24,
      right: 24,
      bottom: 20,
      color: 'rgba(255,255,255,0.72)',
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    removeMediaButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    toolBar: {
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: contentPadding,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.background,
    },
    toolButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    colorPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingRight: 4,
    },
    colorButton: {
      width: swatchSize,
      height: swatchSize,
      borderRadius: swatchSize / 2,
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
    overlayFontSize,
    swatchSize,
    theme,
  ]);

  const resetDraft = () => {
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
      operationIdRef.current = createOperationId('story');
      uploadedMediaRef.current = null;
    }
  };

  const handleCreateStory = async () => {
    const mediaType: Story['media_type'] = media
      ? (media.type?.includes('video') ? 'video' : 'image')
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
        media
          ? `${media.assetId || media.uri}:${media.fileSize || 0}`
          : '';
      let uploadedKey = uploadedMediaRef.current?.signature === mediaSignature
        ? uploadedMediaRef.current.key
        : undefined;
      if (media && !uploadedKey) {
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

        <View style={styles.canvasWrapper}>
        <View style={[styles.canvas, { backgroundColor: media ? '#000' : background }]}>
          {media ? (
            media.type?.includes('video') ? (
              <StoryVideoPreview uri={media.uri} style={styles.mediaPreview} />
            ) : (
              <Image
                source={{ uri: media.uri }}
                style={styles.mediaPreview}
                resizeMode="cover"
                accessibilityLabel={t('feed.media', 'Media')}
              />
            )
          ) : null}

          <TextInput
            style={styles.canvasText}
            // No prompt text on the canvas: tapping it is enough, and an empty
            // canvas reads as the story it will actually publish.
            placeholder=""
            value={text}
            editable={!loading}
            onChangeText={(value) => {
              setText(value);
              operationIdRef.current = createOperationId('story');
            }}
            multiline
            maxLength={200}
            accessibilityLabel={t('feed.add_text', 'Add text')}
          />

          {media ? (
            <TouchableRipple
              style={styles.removeMediaButton}
              onPress={() => {
                setMedia(null);
                uploadedMediaRef.current = null;
                operationIdRef.current = createOperationId('story');
              }}
              disabled={loading}
              borderless
              accessibilityLabel={t('feed.remove_media', 'Remove media')}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableRipple>
          ) : null}
        </View>
        </View>

        <View style={styles.toolBar}>
          <TouchableRipple
            style={styles.toolButton}
            onPress={pickMedia}
            disabled={loading}
            borderless
            accessibilityLabel={t('feed.select_media', 'Choose from gallery')}
          >
            <Ionicons name="images" size={20} color={theme.text} />
          </TouchableRipple>

          {!media && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.colorPicker}
              style={{ flex: 1 }}
            >
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
            </ScrollView>
          )}
        </View>
      </View>
    </FullScreenModal>
  );
};

export default StoryModal;
