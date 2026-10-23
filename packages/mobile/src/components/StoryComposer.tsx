import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createOperationId, type Story, type StoryOverlay } from '@motionmeet/shared';
import { useAuthContext } from '../context/AuthProvider';
import { createStory } from '../api/endpoints';
import { uploadMedia } from '../api/mediaUpload';
import { useAppSelector } from '../store/hooks';
import { useStoryFrame } from '../hooks/useStoryFrame';
import { ensureMediaLibraryPermission } from '../utils/permissions';
import {
  getUserFacingError,
  logHandledError,
  showError,
  showSuccess,
} from '../utils/feedback';
import StoryDraggableOverlay from './story/StoryDraggableOverlay';
import StoryLocationSheet from './story/StoryLocationSheet';
import StoryTextEditor from './story/StoryTextEditor';

interface StoryComposerProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /**
   * A picture to start from instead of opening the gallery, such as a
   * workout card. The author still adds text, moves things and decides
   * whether to post; the picture can be swapped like any other.
   */
  initialMedia?: ImagePickerAsset | null;
}

interface StoryVideoPreviewProps {
  uri: string;
}

const StoryVideoPreview = ({ uri }: StoryVideoPreviewProps) => {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
      surfaceType="textureView"
      accessibilityLabel="Story video"
    />
  );
};

let overlaySequence = 0;
const nextOverlayId = (): string => `draft-${Date.now()}-${(overlaySequence += 1)}`;

const newTextOverlay = (): StoryOverlay => ({
  id: nextOverlayId(),
  kind: 'text',
  text: '',
  x: 0.5,
  y: 0.42,
  scale: 1,
  rotation: 0,
  font: 'classic',
  color: '#FFFFFF',
  align: 'center',
  backdrop: 'none',
});

/**
 * The story composer.
 *
 * Opening it goes straight to the photo roll — there is no blank canvas to fill
 * in first, because a story here always starts from something you shot. Once a
 * picture is chosen, captions and a place sticker are laid on top of it, and
 * what the author drags into place is exactly what a viewer sees: overlays are
 * stored as fractions of the frame, so the same story reads identically on
 * every screen size.
 */
const StoryComposer = ({ visible, onClose, onSuccess, initialMedia }: StoryComposerProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { frameWidth, frameHeight, onFrameLayout } = useStoryFrame();
  const { getToken } = useAuthContext();
  const user = useAppSelector((state) => state.user.value);

  const [media, setMedia] = useState<ImagePickerAsset | null>(null);
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [overTrash, setOverTrash] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const operationIdRef = useRef(createOperationId('story'));
  const uploadedRef = useRef<{ signature: string; key: string } | null>(null);
  // Guards the picker against being launched twice while its sheet animates in.
  const pickerBusyRef = useRef(false);
  // True once the gallery has been offered for the current opening.
  const launchedRef = useRef(false);

  const reset = useCallback(() => {
    setMedia(null);
    setOverlays([]);
    setEditingId(null);
    setLocationOpen(false);
    setDragging(false);
    setOverTrash(false);
    operationIdRef.current = createOperationId('story');
    uploadedRef.current = null;
  }, []);

  const close = useCallback(() => {
    if (publishing) return;
    reset();
    onClose();
  }, [onClose, publishing, reset]);

  const pickMedia = useCallback(async ({ closeOnCancel }: { closeOnCancel: boolean }) => {
    if (pickerBusyRef.current) return;
    pickerBusyRef.current = true;
    try {
      // A refusal is never final: the button asks again next time, and only a
      // permanent block sends the member to the OS settings.
      const permission = await ensureMediaLibraryPermission();
      if (!permission.granted) {
        if (permission.outcome === 'denied') {
          showError(t('common.error'), t('feed.permission_required_media'));
        }
        if (closeOnCancel) close();
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.85,
        videoMaxDuration: 60,
      });

      if (result.canceled || !result.assets[0]) {
        if (closeOnCancel) close();
        return;
      }

      setMedia(result.assets[0]);
      uploadedRef.current = null;
      operationIdRef.current = createOperationId('story');
    } catch (error) {
      logHandledError('story-pick-media', error);
      if (closeOnCancel) close();
    } finally {
      pickerBusyRef.current = false;
    }
  }, [close, t]);

  // Opening the composer is the same gesture as opening the gallery: there is
  // nothing to look at until a picture has been chosen.
  //
  // The ref makes it exactly once per opening. Watching the draft instead would
  // reopen the gallery on the way out, because publishing clears the draft
  // while the modal is still on screen.
  useEffect(() => {
    if (!visible) {
      launchedRef.current = false;
      reset();
      return;
    }
    if (launchedRef.current) return;
    launchedRef.current = true;
    if (initialMedia) {
      setMedia(initialMedia);
      return;
    }
    void pickMedia({ closeOnCancel: true });
  }, [initialMedia, pickMedia, reset, visible]);

  const commitOverlay = useCallback((next: StoryOverlay) => {
    setOverlays((current) => current.map((overlay) => (overlay.id === next.id ? next : overlay)));
  }, []);

  const deleteOverlay = useCallback((overlayId: string) => {
    setOverlays((current) => current.filter((overlay) => overlay.id !== overlayId));
  }, []);

  const handleDragState = useCallback((isDragging: boolean, isOverTrash: boolean) => {
    setDragging(isDragging);
    setOverTrash(isOverTrash);
  }, []);

  const addText = () => {
    const overlay = newTextOverlay();
    setOverlays((current) => [...current, overlay]);
    setEditingId(overlay.id);
  };

  const addLocation = (place: string) => {
    setLocationOpen(false);
    setOverlays((current) => [
      ...current,
      {
        ...newTextOverlay(),
        kind: 'location',
        text: place,
        y: 0.72,
        scale: 0.6,
      },
    ]);
  };

  const editing = overlays.find((overlay) => overlay.id === editingId) ?? null;

  const publish = async () => {
    if (!media || publishing) return;
    try {
      setPublishing(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');

      const signature = `${media.assetId || media.uri}:${media.fileSize || 0}`;
      let uploadedKey = uploadedRef.current?.signature === signature ? uploadedRef.current.key : undefined;
      if (!uploadedKey) {
        uploadedKey = await uploadMedia(media, 'stories', token);
        uploadedRef.current = { signature, key: uploadedKey };
      }

      const mediaType: Story['media_type'] = media.type?.includes('video') ? 'video' : 'image';
      const data = await createStory(
        {
          operationId: operationIdRef.current,
          content: '',
          media_type: mediaType,
          background_color: '',
          overlays: overlays.filter((overlay) => overlay.text.trim().length > 0),
          uploadedKey,
        },
        token,
      );

      if (!data.success) {
        showError(t('common.error'), data.message || t('feed.story_create_failed'));
        return;
      }

      showSuccess(t('common.success'), t('feed.story_created'));
      reset();
      onSuccess?.();
      onClose();
    } catch (error) {
      logHandledError('create-story', error);
      showError(t('common.error'), getUserFacingError(error, t('feed.story_create_failed')));
    } finally {
      setPublishing(false);
    }
  };

  if (!visible) return null;

  const avatar = typeof user?.profile_picture === 'string' ? user.profile_picture.trim() : '';
  const isVideo = Boolean(media?.type?.includes('video'));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      presentationStyle="fullScreen"
      hardwareAccelerated
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <GestureHandlerRootView style={styles.root}>
        {/* The frame is the whole screen so the composed story and the story a
            viewer opens are the same picture, edge to edge, on every device. */}
        <View style={styles.frame} onLayout={onFrameLayout}>
          {media ? (
            isVideo ? (
              <StoryVideoPreview uri={media.uri} />
            ) : (
              // Contain, like the viewer: the draft has to show exactly what
              // will be posted, and a phone taller than 9:16 would otherwise
              // crop the edges off a share card's text.
              <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
            )
          ) : (
            <View style={styles.pending}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          )}

          {overlays.map((overlay) => (
            <StoryDraggableOverlay
              key={overlay.id}
              overlay={overlay}
              frameWidth={frameWidth}
              frameHeight={frameHeight}
              onDragStateChange={handleDragState}
              onCommit={commitOverlay}
              onDelete={deleteOverlay}
              onEdit={setEditingId}
            />
          ))}
        </View>

        {/* Tool rail */}
        {media && !editing && !locationOpen && (
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <Pressable
              onPress={close}
              hitSlop={12}
              style={styles.roundButton}
              accessibilityRole="button"
              accessibilityLabel={t('common.close', 'Kapat')}
            >
              <Ionicons name="close" size={25} color="#FFFFFF" />
            </Pressable>

            <View style={styles.spacer} />

            <View style={styles.toolRail}>
              <Pressable
                onPress={addText}
                style={styles.roundButton}
                accessibilityRole="button"
                accessibilityLabel={t('story.add_text', 'Metin ekle')}
              >
                <Text style={styles.aaLabel}>Aa</Text>
              </Pressable>
              <Pressable
                onPress={() => setLocationOpen(true)}
                style={styles.roundButton}
                accessibilityRole="button"
                accessibilityLabel={t('story.add_location', 'Konum ekle')}
              >
                <Ionicons name="location-outline" size={22} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={() => void pickMedia({ closeOnCancel: false })}
                style={styles.roundButton}
                accessibilityRole="button"
                accessibilityLabel={t('story.change_media', 'Fotografi degistir')}
              >
                <Ionicons name="images-outline" size={21} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        )}

        {/* Drop target: the caption being dragged is deleted when released here. */}
        {dragging && (
          <View
            style={[styles.trashZone, { bottom: Math.max(insets.bottom, 16) + 26 }]}
            pointerEvents="none"
          >
            <View style={[styles.trashCircle, overTrash && styles.trashCircleActive]}>
              <Ionicons name="trash-outline" size={overTrash ? 27 : 23} color="#FFFFFF" />
            </View>
            <Text style={styles.trashLabel}>
              {t('story.drag_to_delete', 'Silmek icin surukle')}
            </Text>
          </View>
        )}

        {/* Share row */}
        {media && !editing && !locationOpen && !dragging && (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
            <View style={styles.sharePill}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.shareAvatar} />
              ) : (
                <View style={[styles.shareAvatar, styles.shareAvatarFallback]}>
                  <Text style={styles.shareAvatarLetter}>
                    {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              <Text style={styles.sharePillLabel} numberOfLines={1}>
                {t('feed.your_story', 'Hikayem')}
              </Text>
            </View>

            <Pressable
              onPress={publish}
              disabled={publishing}
              style={[styles.sendButton, publishing && styles.sendButtonBusy]}
              accessibilityRole="button"
              accessibilityLabel={t('feed.post_action', 'Paylas')}
            >
              {publishing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="arrow-forward" size={23} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        )}

        {editing && (
          <StoryTextEditor
            key={editing.id}
            overlay={editing}
            onCancel={() => {
              // A caption that was never typed into should not linger as an
              // invisible, undeletable hit target.
              if (!editing.text.trim()) deleteOverlay(editing.id);
              setEditingId(null);
            }}
            onDone={(next) => {
              commitOverlay(next);
              setEditingId(null);
            }}
          />
        )}

        {locationOpen && (
          <StoryLocationSheet onCancel={() => setLocationOpen(false)} onPick={addLocation} />
        )}
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  pending: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    zIndex: 30,
  },
  spacer: { flex: 1 },
  toolRail: {
    gap: 12,
    alignItems: 'center',
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,26,0.55)',
  },
  aaLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  trashZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
    zIndex: 40,
  },
  trashCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,26,0.62)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  trashCircleActive: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(217,66,73,0.92)',
    borderColor: '#FFFFFF',
  },
  trashLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    zIndex: 30,
  },
  sharePill: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 50,
    paddingHorizontal: 8,
    borderRadius: 25,
    backgroundColor: 'rgba(20,20,26,0.62)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  shareAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  shareAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#312E81',
  },
  shareAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sharePillLabel: {
    flex: 1,
    minWidth: 0,
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7A4DF5',
  },
  sendButtonBusy: {
    opacity: 0.7,
  },
});

export default StoryComposer;
